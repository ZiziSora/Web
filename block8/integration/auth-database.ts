import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/auth-store.js';
import { MemoryStore } from '../test/memory-store.js';
import { authFixture, credentials, csrfFrom, captchaIdFrom } from '../test/auth-fixture.js';

test('PostgreSQL auth: persistence, atomic OTP/reset consumption and concurrent rate counters', { timeout: 180000 }, async () => {
  if (!process.env.AUTH_TEST_DATABASE_URL) throw new Error('Cần AUTH_TEST_DATABASE_URL riêng; không tự đọc .env.');
  const schema = 'block8_test_' + randomBytes(16).toString('hex');
  const url = new URL(process.env.AUTH_TEST_DATABASE_URL); url.searchParams.set('schema', schema);
  const pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, connectionTimeoutMillis: 15000 });
  const db = createDatabase(url.toString()); let created = false;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
    const push = spawnSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'db', 'push'], {
      env: { ...process.env, DATABASE_URL: url.toString(), DOTENV_CONFIG_PATH: resolve('artifacts/dotenv-disabled-do-not-create') }, stdio: 'pipe', timeout: 90000,
    });
    assert.equal(push.status, 0, 'Không thể tạo schema kiểm thử auth.');
    const repository = new PrismaAuthRepository(db), f = await authFixture(repository);
    const app = createApp(new MemoryStore(), { auth: f.deps });
    const agent = request.agent(app), page = await agent.get('/login').expect(200);
    const login = await agent.post('/login').type('form').send({ ...credentials, _csrf: csrfFrom(page.text) }).expect(303);
    const sid = (login.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await db.$disconnect();
    const restartedDb = createDatabase(url.toString());
    try {
      const restarted = createApp(new MemoryStore(), { auth: { ...f.deps, repository: new PrismaAuthRepository(restartedDb) } });
      await request(restarted).get('/admin/dishes').set('Cookie', sid).expect(200);
    } finally { await restartedDb.$disconnect(); }
    const registerPage = await agent.get('/register').expect(200);
    await agent.post('/register').type('form').send({ email: 'pending@example.com', password: '12345678', passwordConfirm: '12345678', _csrf: csrfFrom(registerPage.text), captchaId: captchaIdFrom(registerPage.text), captcha: f.captchaAnswer(registerPage.text) }).expect(303);
    const otp = f.emails.at(-1)!.value;
    const activate = () => agent.post('/activate').type('form').send({ email: 'pending@example.com', otp, _csrf: csrfFrom(registerPage.text) });
    const activationResults = await Promise.all([activate(), activate()]);
    assert.deepEqual(activationResults.map(r => r.status).sort(), [303, 400]);
    // Three concurrent wrong-password requests must all contribute to the shared counter.
    const bad = () => agent.post('/login').type('form').send({ email: credentials.email, password: 'wrongpass', _csrf: csrfFrom(registerPage.text) });
    await Promise.all([bad(), bad(), bad()]);
    const challenge = await agent.get('/login?email=' + credentials.email).expect(200);
    assert.match(challenge.text, /name="captchaId"/);
    await agent.post('/forgot').type('form').send({ email: credentials.email, _csrf: csrfFrom(registerPage.text) }).expect(200);
    const link = new URL(f.emails.at(-1)!.value);
    const a = request.agent(app), b = request.agent(app);
    const pa = await a.get(link.pathname + link.search).expect(200), pb = await b.get(link.pathname + link.search).expect(200);
    const resets = await Promise.all([
      a.post('/reset').type('form').send({ password: 'password-A', passwordConfirm: 'password-A', _csrf: csrfFrom(pa.text) }),
      b.post('/reset').type('form').send({ password: 'password-B', passwordConfirm: 'password-B', _csrf: csrfFrom(pb.text) }),
    ]);
    assert.deepEqual(resets.map(r => r.status).sort(), [303, 400]);
    await request(app).get('/admin/dishes').set('Cookie', sid).expect(303).expect('Location', '/login');
    assert.equal(await db.session.count({ where: { userId: 'active-user' } }), 0);
  } finally {
    await db.$disconnect();
    // schema is generated locally above, never taken from an external identifier.
    if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
