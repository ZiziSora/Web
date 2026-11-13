import assert from 'node:assert/strict';
import { test as originalTest, after } from 'node:test';
import request from 'supertest';

import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
const local=new AsyncLocalStorage<any>();const runs:any[]=[];
function clean(v:any,k=''):any{if(/password|token|cookie|authorization|otp|secret|hash|sid|^value$|^id$|replacedBy/i.test(k))return v===null?null:'[REDACTED]';if(Array.isArray(v))return v.map(x=>clean(x));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clean(x,k)]));if(typeof v==='string')return v.replace(/([?&]token=)[^& ]+/g,'$1[REDACTED]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[JWT ?? CHE]');return v;}
const proto=(request as any).Test.prototype,old=proto.end;
proto.end=function(cb:any){const run=local.getStore(),self=this;return old.call(this,(e:any,r:any)=>{if(run&&r)run.http.push(clean({method:self.method,path:new URL(self.url).pathname,requestHeaders:self.header,request:self._data,status:r.status,responseHeaders:r.headers,response:r.body}));cb?.(e,r);});};
function test(name:string,fn:any){originalTest(name,async(t:any)=>{const run={name,status:'PASS',http:[],snapshots:[]};runs.push(run);await local.run(run,async()=>{try{await fn(t);}catch(e){run.status='FAIL';throw e;}});});}
function snapshot(label:string,data:any){local.getStore()?.snapshots.push({label,data:clean(data)});}
after(()=>{mkdirSync('presentation/evidence',{recursive:true});writeFileSync('presentation/evidence/http.json',JSON.stringify({environment:'Memory repository; mailer/CAPTCHA test',capturedAt:new Date().toISOString(),runs},null,2));});

import { decodeJwt, SignJWT } from 'jose';
import { createApp } from '../api/src/app.js';
import { digest } from '../api/src/auth-store.js';
import { authFixture, credentials } from '../api/test/auth-fixture.js';
import { MemoryStore } from '../api/test/memory-store.js';
import { ISSUER, AUDIENCE } from '../api/src/tokens.js';
import { authConfig } from '../api/src/auth-config.js';
import { CaptchaUnavailable, googleRecaptcha } from '../api/src/recaptcha.js';

async function setup(ttls: { accessTokenTtlMs?: number; refreshTokenTtlMs?: number } = {}) {
  const fixture = await authFixture();
  Object.assign(fixture.deps.config, ttls);
  const app = createApp(new MemoryStore(), { auth: fixture.deps });
  async function browser() {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.data.csrfToken as string;
    const post = (path: string, data: object = {}) => agent.post('/api/auth' + path).set('X-CSRF-Token', csrf).send(data);
    const login = () => post('/login', credentials).expect(200);
    return { agent, csrf, post, login };
  }
  return { ...fixture, app, browser };
}
const refreshCookie = (res: { headers: Record<string, unknown> }) => (res.headers['set-cookie'] as unknown as string[]).find(c => c.startsWith('block9.refresh='))!.split(';')[0];
const tokenIn = (cookie: string) => cookie.split('=')[1];
const bearer = (token: string) => 'Bearer ' + token;

test('login issues short JWT and an HttpOnly refresh cookie; cookie alone cannot authorize CRUD', async () => {
  const f = await setup(), b = await f.browser(), result = await b.login();
  const token = result.body.data.accessToken, claims = decodeJwt(token);
  assert.equal(claims.iss, ISSUER); assert.equal(claims.aud, AUDIENCE);
  assert.equal(Number(claims.exp) - Number(claims.iat), 600);
  assert.equal(claims.userVersion, 0); assert.equal(claims.sessionVersion, 0);
  assert.equal(claims.passwordHash, undefined);
  const cookie = (result.headers['set-cookie'] as unknown as string[]).find(x => x.startsWith('block9.refresh='))!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\/api\/auth/); assert.doesNotMatch(cookie, /Domain=/);
  const row = await f.repository.read('refreshToken', digest(tokenIn(refreshCookie(result))));
  assert.ok(row); assert.equal(JSON.stringify(row).includes(tokenIn(refreshCookie(result))), false);
  await b.agent.get('/api/auth/me').set('Authorization', bearer(token)).expect(200);
  await b.agent.get('/api/chefs/all').expect(401);
  await b.agent.post('/api/dishes').set('X-CSRF-Token', b.csrf).send({}).expect(401);
});

test('CSRF on every mutation, exact CORS origin and public reads', async () => {
  const f = await setup(), b = await f.browser(), grant = await b.login(), token = grant.body.data.accessToken;
  for (const path of ['/login', '/register', '/refresh', '/logout', '/reset', '/forgot']) await b.agent.post('/api/auth' + path).send(credentials).expect(403);
  await b.agent.patch('/api/dishes/1').set('Authorization', bearer(token)).send({ name: 'Changed' }).expect(403);
  await b.agent.post('/api/auth/logout').set('X-CSRF-Token', b.csrf).set('Origin', 'https://evil.test').expect(403);
  const preflight = await request(f.app).options('/api/dishes/1').set('Origin', 'http://localhost:5179').set('Access-Control-Request-Method', 'PATCH').expect(204);
  assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
  assert.match(preflight.headers['access-control-allow-headers'], /Authorization/);
  const denied = await request(f.app).get('/api/dishes').set('Origin', 'http://evil.test');
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
  for (const path of ['/api/dishes', '/api/dishes/facets', '/api/dishes/1']) await request(f.app).get(path).expect(200);
  await request(f.app).patch('/API/DiShEs/1').send({name:'Unauthorized'}).expect(401);
  for (const path of ['/api/chefs', '/api/ingredients/options/all', '/api/ingredients/1', '/API/CHEFS/all', '/api/InGrEdIeNtS/1']) await request(f.app).get(path).expect(401);
});

test('JWT rejects invalid signature, algorithm, issuer, audience, future issuance and missing claims', async () => {
  const f = await setup(), b = await f.browser(), result = await b.login(), original = result.body.data.accessToken;
  const claims = decodeJwt(original);
  for (const [payload, secret, alg] of [
    [claims, 'another-secret-at-least-32-bytes-long', 'HS256'],
    [{ ...claims, iss: 'other' }, f.deps.config.jwtSecret, 'HS256'],
    [{ ...claims, aud: 'other' }, f.deps.config.jwtSecret, 'HS256'],
    [{ ...claims, iat: Number(claims.iat) + 60 }, f.deps.config.jwtSecret, 'HS256'],
    [{ ...claims, sid: undefined }, f.deps.config.jwtSecret, 'HS256'],
    [claims, f.deps.config.jwtSecret.repeat(2), 'HS384'],
  ] as const) {
    const token = await new SignJWT(payload).setProtectedHeader({ alg, typ: 'JWT' }).sign(new TextEncoder().encode(secret));
    const res = await request(f.app).get('/api/auth/me').set('Authorization', bearer(token)).expect(401);
    assert.equal(res.body.error.code, 'ACCESS_INVALID');
  }
});

test('both database versions and active status are checked without cache', async () => {
  const f = await setup(), b = await f.browser(), grant = await b.login(), access = grant.body.data.accessToken, claims = decodeJwt(access);
  const session = (await f.repository.read('authSession', String(claims.sid)))!;
  await f.repository.write('authSession', { ...session, sessionVersion: 1 });
  assert.equal((await b.agent.get('/api/auth/me').set('Authorization', bearer(access)).expect(401)).body.error.code, 'SESSION_REVOKED');
  await f.repository.write('authSession', session);
  const user = (await f.repository.read('user', String(claims.sub)))!;
  for (const replacement of [{ ...user, userVersion: 1 }, { ...user, status: 'pending' }]) {
    await f.repository.write('user', replacement);
    await b.agent.get('/api/auth/me').set('Authorization', bearer(access)).expect(401);
  }
});

test('refresh rotates token, keeps versions and absolute expiry; reuse revokes that session', async () => {
  const f = await setup(), b = await f.browser(), first = await b.login(), oldCookie = refreshCookie(first), oldClaims = decodeJwt(first.body.data.accessToken);
  const before = (await f.repository.read('authSession', String(oldClaims.sid)))!;
  f.advance(f.deps.config.accessTokenTtlMs + 1000);
  const expired = await b.agent.get('/api/auth/me').set('Authorization', bearer(first.body.data.accessToken)).expect(401);
  assert.equal(expired.body.error.code, 'ACCESS_EXPIRED');
  const next = await b.post('/refresh').expect(200), newCookie = refreshCookie(next);
  assert.notEqual(newCookie, oldCookie);
  assert.equal(decodeJwt(next.body.data.accessToken).sessionVersion, 0);
  const after = (await f.repository.read('authSession', String(oldClaims.sid)))!;
  assert.deepEqual(after.expiresAt, before.expiresAt);
  assert.equal((await f.repository.read('refreshToken', digest(tokenIn(oldCookie))))!.replacedBy, digest(tokenIn(newCookie)));
  await b.agent.get('/api/auth/me').set('Authorization', bearer(next.body.data.accessToken)).expect(200);
  // Keep the same anonymous session, overriding only the refresh cookie.
  const csrfRes = await request(f.app).get('/api/auth/csrf');
  const anonCookie = (csrfRes.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  await request(f.app).post('/api/auth/refresh').set('Cookie', [anonCookie, oldCookie]).set('X-CSRF-Token', csrfRes.body.data.csrfToken).expect(401);
  assert.equal((await b.agent.get('/api/auth/me').set('Authorization', bearer(next.body.data.accessToken)).expect(401)).body.error.code, 'SESSION_REVOKED');
  await b.post('/refresh').expect(401);
});

test('logout invalidates current access immediately, including expired access, preserving other devices', async () => {
  const f = await setup(), a = await f.browser(), b = await f.browser(), one = await a.login(), two = await b.login();
  f.advance(f.deps.config.accessTokenTtlMs + 1000);
  await a.post('/logout').expect(200);
  const row = (await f.repository.read('authSession', String(decodeJwt(one.body.data.accessToken).sid)))!;
  assert.equal(row.sessionVersion, 1); assert.ok(row.revokedAt);
  assert.equal((await a.agent.get('/api/auth/me').set('Authorization', bearer(one.body.data.accessToken)).expect(401)).body.error.code, 'SESSION_REVOKED');
  await a.post('/refresh').expect(401);
  await b.post('/refresh').expect(200);
  assert.equal((await f.repository.read('user', 'active-user'))!.userVersion, 0);
  assert.equal((await f.repository.read('authSession', String(decodeJwt(two.body.data.accessToken).sid)))!.revokedAt, null);
});

test('refresh cannot extend 8-hour deadline and final access is capped to session expiry', async () => {
  const f = await setup(), b = await f.browser(), first = await b.login();
  const session = (await f.repository.read('authSession', String(decodeJwt(first.body.data.accessToken).sid)))!;
  f.advance(f.deps.config.refreshTokenTtlMs - 60_000);
  const near = await b.post('/refresh').expect(200);
  assert.ok(near.body.data.expiresAt <= session.expiresAt.getTime());
  f.advance(60_001);
  const freshCsrf = (await b.agent.get('/api/auth/csrf')).body.data.csrfToken;
  await b.post('/refresh').set('X-CSRF-Token', freshCsrf).expect(401);
  await b.agent.get('/api/auth/me').set('Authorization', bearer(near.body.data.accessToken)).expect(401);
});

test('registration, OTP activation and duplicate email preserve account and never auto-login', async () => {
  const f = await setup(), b = await f.browser(), email = ' New@Example.com ';
  const registration = { email, password: 'Password8!', passwordConfirm: 'Password8!' };
  await b.post('/register', registration).expect(400);
  const first = await b.post('/register', { ...registration, recaptchaToken: f.captcha(), role: 'admin' }).expect(200);
  const user = (await f.repository.userByEmail('new@example.com'))!;
  snapshot('User ??ng k?',user);snapshot('Email OTP test',f.emails);assert.equal(user.role, 'viewer'); assert.equal(user.status, 'pending'); assert.match(user.passwordHash, /^\$2[ab]\$12\$/);
  const duplicate = await b.post('/register', { ...registration, password: 'OtherPass8!', passwordConfirm: 'OtherPass8!', recaptchaToken: f.captcha() }).expect(200);
  assert.deepEqual(first.body, duplicate.body); assert.equal(f.emails.length, 1);
  assert.deepEqual(await f.repository.userByEmail('new@example.com'), user);
  await b.post('/activate', { email, otp: '9999999' }).expect(400);
  const otp = f.emails[0].value;
  await b.post('/activate', { email, otp }).expect(200);
  await b.post('/activate', { email, otp }).expect(400);
  await b.agent.get('/api/auth/me').expect(401);
  await b.post('/login', { email, password: 'Password8!' }).expect(200);
});

test('password length counts Unicode characters and enforces bcrypt byte limit', async () => {
  const f = await setup(), b = await f.browser();
  for (const [i, password] of ['1234567', 'é'.repeat(37), '😀'.repeat(19)].entries()) await b.post('/register', { email: `invalid${i}@test.com`, password, passwordConfirm: password, recaptchaToken: f.captcha() }).expect(400);
  for (const [i, password] of ['12345678', 'é'.repeat(36), '😀'.repeat(8)].entries()) await b.post('/register', { email: `valid${i}@test.com`, password, passwordConfirm: password, recaptchaToken: f.captcha() }).expect(200);
  await b.post('/register', { email: 'confirm@test.com', password: 'Password8!', passwordConfirm: 'Different8', recaptchaToken: f.captcha() }).expect(400);
});

test('OTP expiry, resend cooldown, old-code invalidation and lock survive resend', async () => {
  const f = await setup(), b = await f.browser(), email = 'otp@test.com';
  await b.post('/register', { email, password: 'Password8!', passwordConfirm: 'Password8!', recaptchaToken: f.captcha() }).expect(200);
  const first = f.emails[0].value;
  await b.post('/activate/resend', { email }).expect(429);
  f.advance(61_000);
  await b.post('/activate/resend', { email }).expect(200);
  const second = f.emails.at(-1)!.value; assert.notEqual(first, second);
  await b.post('/activate', { email, otp: first }).expect(400);
  for (let i = 0; i < 3; i++) await b.post('/activate', { email, otp: 'bad' }).expect(400);
  await b.post('/activate', { email, otp: 'bad' }).expect(429);
  await b.post('/activate/resend', { email }).expect(429);
  f.advance(15 * 60_000 + 1);
  await b.post('/activate', { email, otp: second }).expect(400);
  await b.post('/activate/resend', { email }).expect(200);
  await b.post('/activate', { email, otp: f.emails.at(-1)!.value }).expect(200);
});

test('login requires captcha after third failure, solving captcha does not reset failure count', async () => {
  const f = await setup(), b = await f.browser(), bad = { ...credentials, password: 'bad' };
  for (let i = 0; i < 3; i++) {
    const res = await b.post('/login', bad).expect(400);
    assert.equal(res.body.error.captchaRequired, i === 2);
  }
  assert.equal((await b.post('/login', credentials).expect(400)).body.error.code, 'CAPTCHA_REQUIRED');
  for (let i = 3; i < 9; i++) await b.post('/login', { ...bad, recaptchaToken: f.captcha() }).expect(400);
  const locked = await b.post('/login', { ...bad, recaptchaToken: f.captcha() }).expect(429);
  assert.ok(Number(locked.headers['retry-after']) > 0);
  const other = await f.browser();
  await other.post('/login', { ...credentials, recaptchaToken: f.captcha() }).expect(429);
  f.advance(15 * 60_000 + 1);
  await other.login();
});

test('forgot has uniform responses; reset is single-use and revokes access/refresh on every device', async () => {
  const f = await setup(), a = await f.browser(), b = await f.browser(), one = await a.login(), two = await b.login();
  const known = await a.post('/forgot', { email: credentials.email }).expect(200);
  const unknown = await a.post('/forgot', { email: 'unknown@test.com' }).expect(200);
  assert.deepEqual(known.body, unknown.body);
  const link = f.emails.at(-1)!.value, rawToken = new URL(link).searchParams.get('token')!;
  assert.match(link, /^http:\/\/localhost:5179\/reset/);
  const prepare = await a.post('/reset/prepare', { token: rawToken }).expect(200);
  assert.doesNotMatch(JSON.stringify(prepare.body), new RegExp(rawToken));
  snapshot('Reset sau prepare',await f.repository.resetByHash(digest(rawToken)));assert.equal((await f.repository.resetByHash(digest(rawToken)))!.usedAt, null);
  await a.post('/reset/prepare').expect(200);
  await a.post('/reset', { password: 'NewPassword8!', passwordConfirm: 'wrong' }).expect(400);
  const resetDone=await a.post('/reset', { password: 'NewPassword8!', passwordConfirm: 'NewPassword8!' }).expect(200);assert.equal(resetDone.body.data?.accessToken,undefined);
  assert.equal((await f.repository.read('user', 'active-user'))!.userVersion, 1);
  for (const grant of [one, two]) await request(f.app).get('/api/auth/me').set('Authorization', bearer(grant.body.data.accessToken)).expect(401);
  await b.post('/refresh').expect(401);
  await a.post('/reset/prepare', { token: rawToken }).expect(400);
  await a.post('/login', credentials).expect(400);
  await a.post('/login', { ...credentials, password: 'NewPassword8!' }).expect(200);
});

test('new reset supersedes old, token expires, SMTP errors do not disclose secrets', async () => {
  const f = await setup(), b = await f.browser();
  await b.post('/forgot', { email: credentials.email });
  const old = new URL(f.emails.at(-1)!.value).searchParams.get('token');
  await b.post('/forgot', { email: credentials.email });
  const current = new URL(f.emails.at(-1)!.value).searchParams.get('token');
  await b.post('/reset/prepare', { token: old }).expect(400);
  f.advance(30 * 60_000 + 1);
  await b.post('/reset/prepare', { token: current }).expect(400);
  const logs: string[] = [];
  f.deps.logger = { error: message => logs.push(message) };
  f.deps.mailer.reset = async () => { throw new Error('SMTP_PASS=secret token=hidden'); };
  const app = createApp(new MemoryStore(), { auth: f.deps });
  const agent = request.agent(app), csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
  const res = await agent.post('/api/auth/forgot').set('X-CSRF-Token', csrf).send({ email: credentials.email }).expect(200);
  assert.doesNotMatch(JSON.stringify(res.body) + logs.join(''), /SMTP_PASS|secret|hidden|active@example/);
});

test('concurrent refresh reuse revokes the family; logout racing refresh never resurrects session', async () => {
  const f = await setup(), b = await f.browser(), grant = await b.login(), cookie = refreshCookie(grant);
  const bootstrap = await request(f.app).get('/api/auth/csrf');
  const anon = (bootstrap.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  const rotate = () => request(f.app).post('/api/auth/refresh').set('Cookie', [anon, cookie]).set('X-CSRF-Token', bootstrap.body.data.csrfToken);
  const responses = await Promise.all([rotate(), rotate()]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
  const winner = responses.find(r => r.status === 200)!;
  await b.agent.get('/api/auth/me').set('Authorization', bearer(winner.body.data.accessToken)).expect(401);
  const c = await f.browser(), fresh = await c.login();
  await Promise.all([c.post('/refresh'), c.post('/logout')]);
  const row = (await f.repository.read('authSession', String(decodeJwt(fresh.body.data.accessToken).sid)))!;
  assert.ok(row.revokedAt); await c.post('/refresh').expect(401);
});

test('server config requires independent secrets and HTTPS production origin', () => {
  const env = { SESSION_SECRET: 's'.repeat(40), AUTH_TOKEN_SECRET: 't'.repeat(40), JWT_SECRET: 'j'.repeat(40), APP_BASE_URL: 'http://localhost:5179' };
  assert.equal(authConfig(env).secure, false);
  assert.throws(() => authConfig({ ...env, JWT_SECRET: env.SESSION_SECRET }));
  assert.throws(() => authConfig({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => authConfig({ ...env, JWT_SECRET: '' }));
});

test('TTL environment config defaults, seconds conversion and invalid values', () => {
  const env = { SESSION_SECRET: 's'.repeat(40), AUTH_TOKEN_SECRET: 't'.repeat(40), JWT_SECRET: 'j'.repeat(40), APP_BASE_URL: 'http://localhost:5179' };
  const defaults = authConfig(env);
  assert.equal(defaults.accessTokenTtlMs, 600_000);
  assert.equal(defaults.refreshTokenTtlMs, 28_800_000);
  const custom = authConfig({ ...env, ACCESS_TOKEN_TTL_SECONDS: '5', REFRESH_TOKEN_TTL_SECONDS: '20' });
  assert.equal(custom.accessTokenTtlMs, 5000); assert.equal(custom.refreshTokenTtlMs, 20000);
  for (const key of ['ACCESS_TOKEN_TTL_SECONDS', 'REFRESH_TOKEN_TTL_SECONDS']) {
    for (const value of ['', ' ', '0', '-1', '1.5', '10m', 'Infinity', '1e3', '9007199254740991'])
      assert.throws(() => authConfig({ ...env, [key]: value }), new RegExp(key));
  }
});

test('custom TTL controls JWT, refresh cookie/database deadline and rotation without extending login', async () => {
  const f = await setup({ accessTokenTtlMs: 5000, refreshTokenTtlMs: 20000 });
  const b = await f.browser(), initial = await b.login(), access = initial.body.data.accessToken;
  const claims = decodeJwt(access);
  assert.equal(Number(claims.exp) - Number(claims.iat), 5);
  assert.match((initial.headers['set-cookie'] as unknown as string[]).find(c => c.startsWith('block9.refresh='))!, /Max-Age=20;/);
  const row = (await f.repository.read('authSession', String(claims.sid)))!;
  assert.equal(row.expiresAt.getTime() - row.createdAt.getTime(), 20000);
  f.advance(6000);
  assert.equal((await b.agent.get('/api/auth/me').set('Authorization', bearer(access)).expect(401)).body.error.code, 'ACCESS_EXPIRED');
  await b.post('/refresh').expect(200);
  f.advance(11000);
  const last = await b.post('/refresh').expect(200);
  assert.ok(last.body.data.expiresAt <= row.expiresAt.getTime());
  const replacement = (await f.repository.read('refreshToken', digest(tokenIn(refreshCookie(last)))))!;
  assert.deepEqual(replacement.expiresAt, row.expiresAt);
  f.advance(3001);
  await b.post('/refresh').expect(401);
});

test('Google verifier checks hostname, fails closed on network/malformed/secret error', async () => {
  const fake = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
  assert.equal(await googleRecaptcha('secret', 'localhost', fake({ success: true, hostname: 'localhost' })).verify('response'), true);
  assert.equal(await googleRecaptcha('secret', 'localhost', fake({ success: true, hostname: 'evil.test' })).verify('response'), false);
  assert.equal(await googleRecaptcha('secret', 'localhost', fake({ success: false, 'error-codes': ['timeout-or-duplicate'] })).verify('response'), false);
  for (const response of [{}, { success: false, 'error-codes': ['invalid-input-secret'] }]) await assert.rejects(googleRecaptcha('secret', 'localhost', fake(response)).verify('response'), CaptchaUnavailable);
  await assert.rejects(googleRecaptcha('secret', 'localhost', (async () => { throw new Error(); }) as typeof fetch).verify('response'), CaptchaUnavailable);
});

test('Acceptance: anonymous mutations, pending, wrong CAPTCHA, payload role, forgot limit',async()=>{
 const f=await setup(),b=await f.browser();
 for(const method of ['post','patch','delete'] as const)await b.agent[method]('/api/dishes'+(method==='post'?'':'/1')).send({}).expect(401);
 const body={email:'pending@example.com',password:'Password8!',passwordConfirm:'Password8!'},n=f.emails.length;
 await b.post('/register',body).expect(400);assert.equal(await f.repository.userByEmail(body.email),null);assert.equal(f.emails.length,n);await b.post('/register',{...body,recaptchaToken:'invalid'}).expect(400);assert.equal(await f.repository.userByEmail(body.email),null);assert.equal(f.emails.length,n);
 await b.post('/register',{...body,recaptchaToken:f.captcha()}).expect(200);
 const pending=await b.post('/login',body).expect(400);assert.equal(pending.body.data?.accessToken,undefined);snapshot('Pending',await f.repository.userByEmail(body.email));
 const login=await b.login(),parts=login.body.data.accessToken.split('.');parts[1]=Buffer.from(JSON.stringify({...decodeJwt(login.body.data.accessToken),role:'admin'})).toString('base64url');await b.agent.get('/api/auth/me').set('Authorization',bearer(parts.join('.'))).expect(401);
 for(let i=0;i<5;i++)await b.post('/forgot',{email:'limit@example.com'}).expect(200);
 const limited=await b.post('/forgot',{email:'limit@example.com'}).expect(429);assert.equal(limited.body.error.code,'RATE_LIMITED');
});

test('Acceptance: public query parity and OTP pending unchanged',async()=>{
 const f=await setup(),b=await f.browser(),grant=await b.login();
 for(const query of ['?q=bo&page=1&pageSize=6','?page=2&pageSize=1','?mode=advanced&q=bo']){const a=await request(f.app).get('/api/dishes'+query).expect(200);const c=await request(f.app).get('/api/dishes'+query).set('Authorization',bearer(grant.body.data.accessToken)).expect(200);assert.deepEqual(a.body,c.body);}
 const email='otp-pending@example.com';await b.post('/register',{email,password:'Password8!',passwordConfirm:'Password8!',recaptchaToken:f.captcha()}).expect(200);
 await b.post('/activate',{email,otp:'0000000'}).expect(400);assert.equal((await f.repository.userByEmail(email))!.status,'pending');f.advance(601000);await b.post('/activate',{email,otp:f.emails.at(-1)!.value}).expect(400);assert.equal((await f.repository.userByEmail(email))!.status,'pending');snapshot('Pending after invalid OTP',await f.repository.userByEmail(email));
});
