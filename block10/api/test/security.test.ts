import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStore } from './memory-store.js';
import { authFixture, credentials } from './auth-fixture.js';
import { totp } from '../src/security.js';

test('TOTP RFC vector SHA1',()=>assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',1),'287082'));
test('MFA survives forgot/reset; pending expiry and cancellation; password change revokes all sessions',async()=>{
 const f=await authFixture(),app=createApp(new MemoryStore(),{auth:f.deps}),a=request.agent(app);
 const csrf=(await a.get('/api/auth/csrf')).body.data.csrfToken;let access='';
 const post=(path:string,body:any={})=>a.post('/api/auth'+path).set('X-CSRF-Token',csrf).set('Authorization','Bearer '+access).send(body);
 const login=(password=credentials.password)=>post('/login',{email:credentials.email,password,recaptchaToken:f.captcha()});
 access=(await login()).body.data.accessToken;
 const setup=(await post('/settings/mfa/setup',{password:credentials.password})).body.data;
 const enabled=(await post('/settings/mfa/confirm',{code:totp(setup.secret,Math.floor(f.deps.now!()/30000))})).body.data;
 await login();f.advance(300001);await post('/mfa/verify',{code:enabled.recoveryCodes[0]}).expect(400);
 await login();await post('/mfa/cancel').expect(200);await post('/mfa/verify',{code:enabled.recoveryCodes[0]}).expect(400);
 await post('/forgot',{email:credentials.email});const raw=new URL(f.emails.at(-1)!.value).searchParams.get('token');await post('/reset/prepare',{token:raw}).expect(200);
 await post('/reset',{password:'ResetPassword8!',passwordConfirm:'ResetPassword8!'}).expect(200);
 assert.equal((await login('ResetPassword8!')).body.data.mfaRequired,true);
 access=(await post('/mfa/verify',{code:enabled.recoveryCodes[0]})).body.data.accessToken;
 await post('/settings/password',{password:'ResetPassword8!',code:enabled.recoveryCodes[1],newPassword:'ChangedPassword8!',passwordConfirm:'ChangedPassword8!'}).expect(200);
 await a.get('/api/auth/me').set('Authorization','Bearer '+access).expect(401);
 assert.equal((await login('ChangedPassword8!')).body.data.mfaRequired,true);
});
test('RBAC: viewer, editor, admin and role revocation',async()=>{
 const f=await authFixture(),app=createApp(new MemoryStore(),{auth:f.deps});
 async function client(role:'viewer'|'editor'|'admin'){
  const u=(await f.repository.read('user','active-user'))!;await f.repository.write('user',{...u,role});
  const a=request.agent(app),csrf=(await a.get('/api/auth/csrf')).body.data.csrfToken;
  const access=(await a.post('/api/auth/login').set('X-CSRF-Token',csrf).send({...credentials,recaptchaToken:f.captcha()})).body.data.accessToken;
  return {a,csrf,access};
 }
 const viewer=await client('viewer');await viewer.a.post('/api/dishes').set('Authorization','Bearer '+viewer.access).set('X-CSRF-Token',viewer.csrf).send({}).expect(403);await viewer.a.get('/api/chefs').set('Authorization','Bearer '+viewer.access).expect(403);
 const editor=await client('editor');await editor.a.get('/api/chefs/all').set('Authorization','Bearer '+editor.access).expect(200);await editor.a.post('/api/chefs').set('Authorization','Bearer '+editor.access).set('X-CSRF-Token',editor.csrf).send({}).expect(403);await editor.a.get('/api/auth/users').set('Authorization','Bearer '+editor.access).expect(403);
 const admin=await client('admin');await admin.a.get('/api/auth/users').set('Authorization','Bearer '+admin.access).expect(200);
});
test('MFA setup, pending session, replay, recovery and password reset invariants',async()=>{
 const f=await authFixture(),app=createApp(new MemoryStore(),{auth:f.deps});let access='';
 const a=request.agent(app),csrf=(await a.get('/api/auth/csrf')).body.data.csrfToken;
 const post=(path:string,body:any={})=>a.post('/api/auth'+path).set('X-CSRF-Token',csrf).set('Authorization','Bearer '+access).send(body);
 const login=()=>post('/login',{...credentials,recaptchaToken:f.captcha()});
 access=(await login()).body.data.accessToken;
 const setup=(await post('/settings/mfa/setup',{password:credentials.password}).expect(200)).body.data;
 assert.match(setup.qr,/^data:image\/png;base64,/);
 const code=()=>totp(setup.secret,Math.floor(f.deps.now!()/30000));
 const enabled=(await post('/settings/mfa/confirm',{code:code()}).expect(200)).body.data;
 assert.equal(enabled.recoveryCodes.length,10);
 await a.get('/api/auth/settings').set('Authorization','Bearer '+access).expect(401);
 const pending=await login();assert.equal(pending.body.data.mfaRequired,true);assert.equal(pending.body.data.accessToken,undefined);
 await post('/refresh').expect(401);
 await post('/mfa/verify',{code:code()}).expect(400);
 f.advance(30000);access=(await post('/mfa/verify',{code:code()}).expect(200)).body.data.accessToken;
 await post('/mfa/verify',{code:code()}).expect(400);
 await login();access=(await post('/mfa/verify',{code:enabled.recoveryCodes[0]}).expect(200)).body.data.accessToken;
 await login();await post('/mfa/verify',{code:enabled.recoveryCodes[0]}).expect(400);
 for(let i=0;i<4;i++)await post('/mfa/verify',{code:'invalid'}).expect(i===3?429:400);
 f.advance(900001);await login();access=(await post('/mfa/verify',{code:enabled.recoveryCodes[1]}).expect(200)).body.data.accessToken;
 const state=(await a.get('/api/auth/settings').set('Authorization','Bearer '+access)).body.data;assert.equal(state.mfaEnabled,true);assert.equal(state.recoveryRemaining,8);
 // Atomic consumption permits only one concurrent use of a recovery code.
 const results=await Promise.all([post('/settings/mfa/recovery',{password:credentials.password,code:enabled.recoveryCodes[2]}),post('/settings/mfa/recovery',{password:credentials.password,code:enabled.recoveryCodes[2]})]);
 assert.equal(results.filter(x=>x.status===200).length,1);
});
