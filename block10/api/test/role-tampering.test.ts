import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryStore } from './memory-store.js';
import { authFixture, credentials } from './auth-fixture.js';

test('client-supplied roles cannot elevate viewer/editor; only admin can grant editor',async()=>{
 const f=await authFixture(), original=(await f.repository.read('user','active-user'))!;
 await f.repository.write('user',{...original,role:'viewer'});
 await f.repository.write('user',{...original,id:'owner',email:'owner@example.com',role:'admin'});
 await f.repository.write('user',{...original,id:'writer',email:'writer@example.com',role:'editor'});
 const app=createApp(new MemoryStore(),{auth:f.deps});
 async function login(email:string){
  const agent=request.agent(app),csrf=(await agent.get('/api/auth/csrf')).body.data.csrfToken;
  const grant=(await agent.post('/api/auth/login').set('X-CSRF-Token',csrf).send({email,password:credentials.password,recaptchaToken:f.captcha(),role:'admin',isAdmin:true})).body.data;
  return {agent,grant,post:(path:string,body:object)=>agent.post(path).set('Authorization','Bearer '+grant.accessToken).set('X-CSRF-Token',csrf).set('X-Role','admin').send(body)};
 }
 for(const [email,id,role] of [[credentials.email,'active-user','viewer'],['writer@example.com','writer','editor']]){
  const client=await login(email);assert.equal(client.grant.user.role,role);
  await client.post('/api/auth/users/'+id+'/role',{role:'admin',isAdmin:true}).expect(403);
  await client.post('/api/auth/users/'+id+'/role',{role:'editor'}).expect(403);
  await client.post('/api/chefs',{role:'admin',name:'Injected',specialty:'Injected'}).expect(403);
  assert.equal((await f.repository.read('user',id))!.role,role);
 }
 const viewer=await login(credentials.email), admin=await login('owner@example.com');
 await admin.post('/api/auth/users/active-user/role',{role:'admin'}).expect(400);
 await admin.post('/api/auth/users/owner/role',{role:'viewer'}).expect(403);
 await admin.post('/api/auth/users/active-user/role',{role:'editor',isAdmin:true}).expect(200);
 assert.equal((await f.repository.read('user','active-user'))!.role,'editor');
 await viewer.agent.get('/api/auth/me').set('Authorization','Bearer '+viewer.grant.accessToken).expect(401);
 const promoted=await login(credentials.email);assert.equal(promoted.grant.user.role,'editor');
 await admin.post('/api/auth/users/active-user/role',{role:'viewer'}).expect(200);
 await promoted.post('/api/dishes',{role:'admin'}).expect(401);
 assert.equal((await f.repository.read('user','active-user'))!.role,'viewer');
});
