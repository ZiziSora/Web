import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createCaptcha, validPassword } from '../src/auth.js';
import { authConfig } from '../src/auth-config.js';
import { digest, PersistentSessionStore } from '../src/auth-store.js';
import { MemoryStore } from './memory-store.js';
import { authFixture, credentials, csrfFrom, captchaIdFrom } from './auth-fixture.js';

async function fixture() {
  const auth = await authFixture(); const store = new MemoryStore();
  const app = createApp(store, { auth: auth.deps });
  const agent = request.agent(app);
  const page = await agent.get('/login').expect(200);
  let csrf = csrfFrom(page.text);
  const post = (url: string, body: Record<string, unknown> = {}) => agent.post(url).type('form').send({ _csrf: csrf, ...body });
  const login = async () => {
    const result = await post('/login', credentials).expect(303);
    const page = await agent.get('/admin/dishes/new').expect(200); csrf = csrfFrom(page.text);
    return result;
  };
  const captchaBody = (html: string) => ({ captchaId: captchaIdFrom(html), captcha: auth.captchaAnswer(html) });
  const register = async (email = 'new@example.com') => {
    const page = await agent.get('/register').expect(200);
    return post('/register', { email, password: credentials.password, passwordConfirm: credentials.password, role: 'admin', ...captchaBody(page.text) }).expect(303);
  };
  return { ...auth, app, agent, store, post, login, register, captchaBody, initialCookie: cookie(page), getCsrf: () => csrf };
}
const cookie = (result: { headers: Record<string, unknown> }) => (result.headers['set-cookie'] as string[])[0].split(';')[0];

test('bcrypt password boundaries, real CAPTCHA output and strict configuration', async () => {
  assert.equal(validPassword('1234567'), false);
  assert.equal(validPassword('12345678'), true);
  assert.equal(validPassword('a'.repeat(72)), true);
  assert.equal(validPassword('a'.repeat(73)), false);
  assert.equal(validPassword('😀'.repeat(18)), true);
  assert.equal(validPassword('😀'.repeat(19)), false);
  assert.equal(validPassword(' 123456 '), true); // whitespace is part of the password
  const a = await bcrypt.hash('12345678', 12), b = await bcrypt.hash('12345678', 12);
  assert.notEqual(a, b); assert.match(a, /^\$2b\$12\$/);
  assert.equal(await bcrypt.compare('12345678', a), true);
  const captcha = createCaptcha(); assert.equal(captcha.answer.length, 6);
  assert.doesNotMatch(captcha.image, /<text|<script/); assert.ok(!captcha.image.includes(captcha.answer));
  assert.throws(() => authConfig({}));
  assert.throws(() => authConfig({ SESSION_SECRET: 'a'.repeat(32), AUTH_TOKEN_SECRET: 'b'.repeat(32), NODE_ENV: 'production', APP_BASE_URL: 'http://example.com' }));
});

test('anonymous requests to every admin route redirect before CSRF and never change data', async () => {
  const f = await fixture();
  await request(f.app).get('/dishes').expect(200);
  await request(f.app).get('/dishes/1').expect(200);
  for (const resource of ['dishes','chefs','ingredients']) {
    for (const path of [`/admin/${resource}`, `/admin/${resource}/new`, `/admin/${resource}/1/edit`, `/admin/${resource}/1/delete`])
      await request(f.app).get(path).expect(303).expect('Location', '/login');
    for (const method of ['post','patch','delete'] as const)
      await request(f.app)[method](`/admin/${resource}/1`).send({ name: 'changed' }).expect(303).expect('Location', '/login');
    await request(f.app).post(`/admin/${resource}`).type('form').send({ name: 'changed' }).expect(303);
  }
  await request(f.app).get('/admin').expect(303).expect('Location', '/login');
  assert.equal(f.store.rows.dishes[0].name, 'Bò lúc lắc');
});

test('registration CAPTCHA precedes creation/email, role is ignored, duplicate response is identical', async () => {
  const f = await fixture();
  await f.post('/register', { email: 'new@example.com', password: credentials.password }).expect(400);
  assert.equal(await f.repository.userByEmail('new@example.com'), null); assert.equal(f.emails.length, 0);
  const result = await f.register(' New@Example.com ');
  const user = (await f.repository.userByEmail('new@example.com'))!;
  assert.equal(user.role, 'viewer'); assert.equal(user.status, 'pending'); assert.match(user.passwordHash, /^\$2b\$12\$/);
  assert.equal(await bcrypt.compare(credentials.password, user.passwordHash), true);
  assert.equal(f.emails.length, 1); assert.doesNotMatch(result.text, new RegExp(f.emails[0].value));
  const challenge = (await f.repository.read('activationChallenge', user.id))!;
  assert.notEqual(challenge.otpHash, f.emails[0].value);
  const duplicate = await f.register();
  assert.equal(duplicate.status, result.status); assert.equal(duplicate.headers.location, result.headers.location);
  assert.equal(duplicate.text, result.text); assert.equal(f.emails.length, 1);
  assert.equal((await f.repository.userByEmail(user.email))!.passwordHash, user.passwordHash);
});

test('CAPTCHA rejects expired, reused, wrong-purpose and other anonymous sessions', async () => {
  const f = await fixture();
  const page = await f.agent.get('/register').expect(200);
  const body = { email: 'captcha@example.com', password: credentials.password, passwordConfirm: credentials.password, ...f.captchaBody(page.text) };
  const other = request.agent(f.app); const otherPage = await other.get('/login').expect(200);
  await other.post('/register').type('form').send({ ...body, _csrf: csrfFrom(otherPage.text) }).expect(400);
  // Wrong purpose is rejected without granting login permission.
  for (let n = 0; n < 3; n++) await f.post('/login', { ...credentials, password: 'wrongpass' }).expect(400);
  await f.post('/login', { ...credentials, ...body, email: credentials.email }).expect(400);
  await f.post('/register', { ...body, captcha: 'wrong' }).expect(400);
  await f.post('/register', body).expect(400);
  const fresh = await f.agent.get('/register').expect(200);
  const expired = f.captchaBody(fresh.text); f.advance(5 * 60000 + 1);
  await f.post('/register', { ...body, ...expired }).expect(400);
  assert.equal(await f.repository.userByEmail(body.email), null); assert.equal(f.emails.length, 0);
});

test('pending user denied; OTP error stays generic, activation consumes once without login', async () => {
  const f = await fixture(); await f.register();
  const pending = { email: 'new@example.com', password: credentials.password };
  const bad = await f.post('/login', pending).expect(400);
  const unknown = await f.post('/login', { ...pending, email: 'missing@example.com' }).expect(400);
  assert.equal(bad.text, unknown.text.replaceAll('missing@example.com', 'new@example.com'));
  const fail = await f.post('/activate', { email: pending.email, otp: 'xxxxxx' }).expect(400);
  f.advance(10 * 60000 + 1);
  const expired = await f.post('/activate', { email: pending.email, otp: f.emails[0].value }).expect(400);
  assert.equal(fail.text, expired.text);
  await f.post('/activate/resend', { email: pending.email }).expect(303);
  const otp = f.emails.at(-1)!.value;
  await f.post('/login', { email: pending.email, password: otp }).expect(400);
  await f.post('/activate', { email: pending.email, otp }).expect(303).expect('Location', '/login?status=activated');
  const user = (await f.repository.userByEmail(pending.email))!;
  assert.equal(user.status, 'active'); assert.ok(user.emailVerifiedAt);
  await f.agent.get('/admin').expect(303).expect('Location', '/login');
  const reused = await f.post('/activate', { email: pending.email, otp }).expect(400);
  assert.equal(fail.text, reused.text);
});

test('OTP resend invalidates old code, preserves attempts, cooldown and lock return 429', async () => {
  const f = await fixture(); await f.register();
  const email = 'new@example.com', old = f.emails[0].value;
  await f.post('/activate/resend', { email }).expect(429).expect('Retry-After', /\d+/);
  await f.post('/activate', { email, otp: 'xxxxxx' }).expect(400);
  const user = (await f.repository.userByEmail(email))!;
  f.advance(60001);
  await f.post('/activate/resend', { email }).expect(303);
  assert.equal((await f.repository.read('activationChallenge', user.id))!.attempts, 1);
  await f.post('/activate', { email, otp: old }).expect(400);
  for (let i = 0; i < 2; i++) await f.post('/activate', { email, otp: 'xxxxxx' }).expect(400);
  await f.post('/activate', { email, otp: 'xxxxxx' }).expect(429);
  await f.post('/activate', { email, otp: f.emails.at(-1)!.value }).expect(429);
  await f.post('/activate/resend', { email }).expect(429);
  assert.equal((await f.repository.read('user', user.id))!.status, 'pending');
});

test('login rotates sid, persists across application restart, logout deletes and revokes old sid', async () => {
  const f = await fixture();
  const anon = f.initialCookie;
  const loggedIn = await f.login(); const sid = cookie(loggedIn);
  assert.notEqual(sid, anon);
  assert.match((loggedIn.headers['set-cookie'] as unknown as string[])[0], /HttpOnly/);
  assert.match((loggedIn.headers['set-cookie'] as unknown as string[])[0], /SameSite=Lax/);
  const restarted = createApp(f.store, { auth: f.deps });
  await request(restarted).get('/admin/dishes').set('Cookie', sid).expect(200);
  await f.post('/logout').expect(303);
  await request(restarted).get('/admin/dishes').set('Cookie', sid).expect(303).expect('Location', '/login');
  await request(f.app).get('/admin/dishes').set('Cookie', anon).expect(303).expect('Location', '/login');
});

test('CSRF blocks auth, CRUD and method override; unicode CSRF cannot trigger 500', async () => {
  const f = await fixture();
  await request(f.app).post('/login').type('form').send(credentials).expect(403);
  await f.post('/login', { ...credentials, _csrf: '😀'.repeat(32) }).expect(403);
  await f.login();
  await f.agent.post('/admin/chefs').type('form').send({ name: 'x', specialty: 'y' }).expect(403);
  await f.post('/admin/chefs/1', { _method: 'DELETE', _csrf: 'cross-site' }).expect(403);
  await f.agent.post('/logout').expect(403);
  assert.equal(f.store.rows.chefs.length, 1);
  await f.post('/admin/chefs', { name: 'Allowed', specialty: 'SSR' }).expect(303);
});

test('login CAPTCHA starts at 3 failures, does not reset failures, and cookie changes do not reset lock', async () => {
  const f = await fixture();
  for (let n = 0; n < 3; n++) await f.post('/login', { ...credentials, password: 'wrongpass' }).expect(400);
  await f.post('/login', credentials).expect(400); // correct password cannot bypass CAPTCHA
  for (let n = 3; n < 10; n++) {
    const page = await f.agent.get('/login?email=' + credentials.email).expect(200);
    await f.post('/login', { ...credentials, password: 'wrongpass', ...f.captchaBody(page.text) }).expect(n === 9 ? 429 : 400);
  }
  const page = await f.agent.get('/login?email=' + credentials.email).expect(200);
  await f.post('/login', { ...credentials, ...f.captchaBody(page.text) }).expect(429);
  const stranger = request.agent(f.app); const start = await stranger.get('/login').expect(200);
  await stranger.post('/login').type('form').send({ ...credentials, _csrf: csrfFrom(start.text) }).expect(429);
  f.advance(15 * 60000 + 1);
  await f.post('/login', credentials).expect(303);
});

test('forgot response is uniform; new reset invalidates old; GET does not consume; POST revokes all sessions', async () => {
  const f = await fixture(); const sid = cookie(await f.login());
  // Compare the same anonymous form to keep the account header out of enumeration checks.
  const guest = request.agent(f.app); const first = await guest.get('/forgot').expect(200); const csrf = csrfFrom(first.text);
  const send = (email: string) => guest.post('/forgot').type('form').send({ email, _csrf: csrf });
  const known = await send(credentials.email).expect(200);
  const unknown = await send('missing@example.com').expect(200);
  assert.equal(known.text, unknown.text.replaceAll('missing@example.com', credentials.email));
  const old = f.emails.at(-1)!.value;
  await send(credentials.email).expect(200); const link = f.emails.at(-1)!.value;
  await guest.get(new URL(old).pathname + new URL(old).search).expect(400);
  const path = new URL(link).pathname + new URL(link).search;
  const page = await guest.get(path).expect(200);
  assert.ok(!page.text.includes(new URL(link).searchParams.get('token')!));
  const user = (await f.repository.userByEmail(credentials.email))!;
  assert.equal((await f.repository.read('passwordReset', user.id))!.usedAt, null);
  await guest.get(path).expect(200);
  await guest.post('/login').type('form').send({ email: credentials.email, password: new URL(link).searchParams.get('token'), _csrf: csrf }).expect(400);
  await guest.post('/reset').type('form').send({ password: '1234567', passwordConfirm: '1234567', _csrf: csrfFrom(page.text) }).expect(400);
  await guest.post('/reset').type('form').send({ password: '12345678', passwordConfirm: '12345678', _csrf: csrfFrom(page.text) }).expect(303).expect('Location', '/login?status=reset');
  await request(f.app).get('/admin/dishes').set('Cookie', sid).expect(303).expect('Location', '/login');
  await guest.get('/admin').expect(303).expect('Location', '/login');
  await guest.get(path).expect(400);
  assert.equal(await bcrypt.compare('12345678', (await f.repository.read('user', user.id))!.passwordHash), true);
});

test('reset expiry, concurrent consumption and forgot limits are enforced', async () => {
  const f = await fixture();
  await f.post('/forgot', { email: credentials.email }).expect(200);
  const expiredLink = new URL(f.emails.at(-1)!.value); f.advance(30 * 60000 + 1);
  await f.agent.get(expiredLink.pathname + expiredLink.search).expect(400);
  await f.post('/forgot', { email: credentials.email }).expect(200);
  const link = new URL(f.emails.at(-1)!.value);
  const a = request.agent(f.app), b = request.agent(f.app);
  const pa = await a.get(link.pathname + link.search).expect(200), pb = await b.get(link.pathname + link.search).expect(200);
  const results = await Promise.all([
    a.post('/reset').type('form').send({ _csrf: csrfFrom(pa.text), password: 'newpass-A', passwordConfirm: 'newpass-A' }),
    b.post('/reset').type('form').send({ _csrf: csrfFrom(pb.text), password: 'newpass-B', passwordConfirm: 'newpass-B' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [303, 400]);
  for (let i = 0; i < 3; i++) await f.post('/forgot', { email: credentials.email }).expect(200);
  await f.post('/forgot', { email: credentials.email }).expect(429).expect('Retry-After', /\d+/);
});

test('SMTP failure stays generic and logs no email, OTP, token or credentials', async () => {
  const f = await fixture(); const messages: string[] = [];
  const app = createApp(f.store, { auth: { ...f.deps, logger: { error: message => messages.push(message) }, mailer: { activation: async () => { throw Error('secret OTP'); }, reset: async () => { throw Error('SMTP_PASSWORD token'); } } } });
  const agent = request.agent(app); const page = await agent.get('/forgot').expect(200);
  const response = await agent.post('/forgot').type('form').send({ _csrf: csrfFrom(page.text), email: credentials.email }).expect(200);
  assert.doesNotMatch(response.text + messages.join(), /SMTP_PASSWORD|secret OTP/);
  assert.equal(messages.length, 1);
});

test('session store refuses a stale save after logout or password reset', async () => {
  const f = await fixture();
  const store = new PersistentSessionStore(f.repository);
  const data = { cookie: { expires: new Date(Date.now() + 60000), originalMaxAge: 60000 }, userId: 'active-user', authVersion: 0 } as Parameters<typeof store.set>[1];
  const set = () => new Promise<void>((resolve, reject) => store.set('opaque-old-sid', data, error => error ? reject(error) : resolve()));
  await set(); assert.ok(await f.repository.read('session', digest('opaque-old-sid')));
  await new Promise<void>((resolve, reject) => store.destroy('opaque-old-sid', error => error ? reject(error) : resolve()));
  await set(); assert.equal(await f.repository.read('session', digest('opaque-old-sid')), null);
  const user = (await f.repository.read('user', 'active-user'))!;
  await f.repository.write('user', { ...user, authVersion: 1 });
  await new Promise<void>((resolve, reject) => store.set('different-sid', data, error => error ? reject(error) : resolve()));
  assert.equal(await f.repository.read('session', digest('different-sid')), null);
});

test('IP limits cover malformed login/register and CAPTCHA issuance; OTP send cap includes registration', async () => {
  const f = await fixture();
  for (let n = 0; n < 60; n++) await f.post('/login', { email: 'missing@example.com', password: 'x' }).expect(400);
  await f.post('/login', credentials).expect(429);
  const r = await fixture();
  for (let n = 0; n < 10; n++) await r.post('/register', { email: 'x@example.com', password: '12345678' }).expect(400);
  await r.post('/register', { email: 'x@example.com', password: '12345678' }).expect(429);

  const c = await fixture();
  for (let n = 0; n < 60; n++) await c.agent.get('/register').expect(200);
  await c.agent.get('/register').expect(429).expect('Retry-After', /\d+/);

  const o = await fixture(); await o.register();
  for (let n = 0; n < 4; n++) {
    o.advance(60001);
    await o.post('/activate/resend', { email: 'new@example.com' }).expect(303);
  }
  o.advance(60001);
  await o.post('/activate/resend', { email: 'new@example.com' }).expect(429);
  assert.equal(o.emails.length, 5);
});

test('authenticated session expires after a fixed eight hours, including after session modifications', async () => {
  const f = await fixture(); const sid = cookie(await f.login());
  const rawId = decodeURIComponent(sid.split('=')[1]).slice(2).split('.')[0];
  const original = (await f.repository.read('session', digest(rawId)))!.expiresAt;
  f.advance(3600000);
  await f.post('/forgot', { email: credentials.email }).expect(200);
  const link = new URL(f.emails.at(-1)!.value);
  await f.agent.get(link.pathname + link.search).expect(200);
  assert.equal((await f.repository.read('session', digest(rawId)))!.expiresAt.getTime(), original.getTime());
  f.advance(7 * 3600000 + 1);
  await request(f.app).get('/admin').set('Cookie', sid).expect(303).expect('Location', '/login');
});

test('correct login CAPTCHA permits password authentication and successful login resets email failures', async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) await f.post('/login', { ...credentials, password: 'wrongpass' }).expect(400);
  const page = await f.agent.get('/login?email=' + credentials.email).expect(200);
  const result = await f.post('/login', { ...credentials, ...f.captchaBody(page.text) }).expect(303);
  await request(f.app).get('/admin/dishes').set('Cookie', cookie(result)).expect(200);
  const guest = request.agent(f.app); const fresh = await guest.get('/login?email=' + credentials.email).expect(200);
  assert.doesNotMatch(fresh.text, /name="captchaId"/);
  await guest.post('/login').type('form').send({ ...credentials, _csrf: csrfFrom(fresh.text) }).expect(303);
});
