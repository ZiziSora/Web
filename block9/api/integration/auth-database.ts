import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { decodeJwt } from 'jose';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/auth-store.js';
import { MemoryStore } from '../test/memory-store.js';
import { authFixture, credentials } from '../test/auth-fixture.js';

test('PostgreSQL: restart persistence, refresh/logout/reset races, atomic OTP and counters', {
  timeout: 240000, skip: !process.env.AUTH_TEST_DATABASE_URL,
}, async () => {
  const schema = 'block9_test_' + randomBytes(16).toString('hex');
  const url = new URL(process.env.AUTH_TEST_DATABASE_URL!); url.searchParams.set('schema', schema);
  const pool = new pg.Pool({ connectionString: process.env.AUTH_TEST_DATABASE_URL, connectionTimeoutMillis: 15000 });
  const db = createDatabase(url.toString()); let created = false;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
    const push = spawnSync(process.execPath, [resolve('../node_modules/prisma/build/index.js'), 'db', 'push'], {
      env: { ...process.env, DATABASE_URL: url.toString(), DOTENV_CONFIG_PATH: resolve('../artifacts/no-dotenv-for-tests') }, stdio: 'pipe', timeout: 90000,
    });
    assert.equal(push.status, 0, 'Không thể tạo schema kiểm thử auth.');
    const repository = new PrismaAuthRepository(db), f = await authFixture(repository);
    let app = createApp(new MemoryStore(), { auth: f.deps });
    async function browser() {
      const agent = request.agent(app), bootstrap = await agent.get('/api/auth/csrf').expect(200);
      const csrf = bootstrap.body.data.csrfToken;
      const anon = (bootstrap.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      const post = (path: string, data: object = {}) => agent.post('/api/auth' + path).set('X-CSRF-Token', csrf).send(data);
      return { agent, post, csrf, anon };
    }
    const a = await browser(), first = await a.post('/login', credentials).expect(200);
    const access = first.body.data.accessToken, claims = decodeJwt(access);
    const cookie = (first.headers['set-cookie'] as unknown as string[]).find(x => x.startsWith('block9.refresh='))!.split(';')[0];
    await db.$disconnect();
    const restartedDb = createDatabase(url.toString());
    try {
      app = createApp(new MemoryStore(), { auth: { ...f.deps, repository: new PrismaAuthRepository(restartedDb) } });
      await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + access).expect(200);
      const rotate = () => request(app).post('/api/auth/refresh').set('Cookie', [a.anon, cookie]).set('X-CSRF-Token', a.csrf);
      const rotations = await Promise.all([rotate(), rotate()]);
      assert.deepEqual(rotations.map(r => r.status).sort(), [200, 401]);
      await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + rotations.find(r => r.status === 200)!.body.data.accessToken).expect(401);
      assert.ok((await restartedDb.authSession.findUniqueOrThrow({ where: { id: String(claims.sid) } })).revokedAt);
      const b = await browser(), login = await b.post('/login', credentials).expect(200);
      await Promise.all([b.post('/refresh'), b.post('/logout')]);
      assert.ok((await restartedDb.authSession.findUniqueOrThrow({ where: { id: String(decodeJwt(login.body.data.accessToken).sid) } })).revokedAt);

      const c = await browser(), email = 'pending@example.com';
      await c.post('/register', { email, password: '12345678', passwordConfirm: '12345678', recaptchaToken: f.captcha() }).expect(200);
      const otp = f.emails.at(-1)!.value;
      const activations = await Promise.all([c.post('/activate', { email, otp }), c.post('/activate', { email, otp })]);
      assert.deepEqual(activations.map(r => r.status).sort(), [200, 400]);
      await Promise.all(Array.from({ length: 3 }, () => c.post('/login', { ...credentials, password: 'wrongpass' })));
      assert.equal((await c.post('/login', credentials).expect(400)).body.error.captchaRequired, true);

      await c.post('/forgot', { email: credentials.email }).expect(200);
      const token = new URL(f.emails.at(-1)!.value).searchParams.get('token');
      const d = await browser(), e = await browser();
      await d.post('/reset/prepare', { token }).expect(200); await e.post('/reset/prepare', { token }).expect(200);
      const resets = await Promise.all([
        d.post('/reset', { password: 'password-A', passwordConfirm: 'password-A' }),
        e.post('/reset', { password: 'password-B', passwordConfirm: 'password-B' }),
      ]);
      assert.deepEqual(resets.map(r => r.status).sort(), [200, 400]);
      assert.equal((await restartedDb.user.findUniqueOrThrow({ where: { id: 'active-user' } })).userVersion, 1);
      assert.equal(await restartedDb.authSession.count({ where: { userId: 'active-user', revokedAt: null } }), 0);
    } finally { await restartedDb.$disconnect(); }
  } finally {
    await db.$disconnect();
    if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
