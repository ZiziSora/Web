import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { authFixture, credentials } from '../api/test/auth-fixture.js';
import { createApp } from '../api/src/app.js';
import { MemoryStore } from '../api/test/memory-store.js';
import { installCaptcha } from './captcha-fixture.js';
import { totp } from '../api/src/security.js';
const port=22000+Math.floor(Math.random()*10000),origin=`http://localhost:${port}`,f=await authFixture(undefined,origin);
const server=createApp(new MemoryStore(),{origin,auth:f.deps}).listen(0,'localhost');await new Promise<void>(r=>server.once('listening',r));
const address=server.address();if(!address||typeof address==='string')throw Error('No API');
const web=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','localhost','--port',String(port),'--strictPort'],{cwd:resolve('web'),env:{...process.env,VITE_API_BASE_URL:`http://localhost:${address.port}/api`,VITE_RECAPTCHA_SITE_KEY:'fixture'},stdio:'pipe'});web.stdout.resume();web.stderr.resume();let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync),headless:true});
 await mkdir('artifacts',{recursive:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});await installCaptcha(context,f);const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  async function login(){await page.goto(origin+'/login');await page.locator('#email').fill(credentials.email);await page.locator('#password').fill(credentials.password);await page.getByRole('button',{name:'Tôi không phải người máy'}).click();await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();}
  await login();await page.waitForURL('**/admin/dishes');await page.getByRole('link',{name:'Cài đặt',exact:true}).click();await page.getByText('Chưa bật',{exact:true}).waitFor();
  const setupForm=page.locator('form').filter({has:page.getByRole('button',{name:'Bật MFA',exact:true})});await setupForm.locator('[name=password]').fill(credentials.password);await setupForm.getByRole('button',{name:'Bật MFA',exact:true}).click();
  await page.locator('.security-secret').waitFor();const secret=(await page.locator('.security-secret').textContent())!;
  await page.screenshot({path:`artifacts/security-setup-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[name=code]').fill(totp(secret,Math.floor(f.deps.now!()/30000)));await page.getByRole('button',{name:'Xác nhận bật MFA'}).click();await page.getByRole('heading',{name:'Đã cập nhật bảo mật'}).waitFor();
  const recovery=(await page.locator('pre').textContent())!.split('\n');assert.equal(recovery.length,10);
  await login();await page.waitForURL('**/mfa');await page.reload();await page.locator('[name=code]').fill(recovery[0]);await page.getByRole('button',{name:'Xác minh',exact:true}).click();await page.waitForURL('**/admin/dishes');
  await page.goto(origin+'/settings');await page.getByText(/Đang bật/).waitFor();await page.screenshot({path:`artifacts/security-settings-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const disable=page.locator('form').filter({has:page.getByRole('button',{name:'Xác nhận tắt MFA',exact:true})});await disable.locator('[name=password]').fill(credentials.password);await disable.locator('[name=code]').fill(recovery[1]);await disable.getByRole('button').click();await page.getByRole('heading',{name:'Đã cập nhật bảo mật'}).waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Security browser PASS: desktop/mobile settings, QR, recovery display after logout, pending reload, recovery login and MFA disable.');
}finally{await browser?.close();web.kill();await new Promise<void>(r=>server.close(()=>r()));}
