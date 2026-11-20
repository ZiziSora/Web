import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
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
  const context=await browser.newContext({viewport:{width,height:1000}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});await installCaptcha(context,f);const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  async function login(){await page.goto(origin+'/login');await page.locator('#email').fill(credentials.email);await page.locator('#password').fill(credentials.password);await page.getByRole('button',{name:'Tôi không phải người máy'}).click();await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();}
  await login();await page.waitForURL('**/admin/dishes');await page.getByRole('link',{name:'Cài đặt',exact:true}).click();await page.getByText('Chưa bật',{exact:true}).waitFor();
  const setupForm=page.locator('form').filter({has:page.getByRole('button',{name:'Bật MFA',exact:true})});await setupForm.locator('[name=password]').fill(credentials.password);
  const showPassword=setupForm.getByRole('button',{name:'Hiện mật khẩu hiện tại',exact:true});await showPassword.focus();await page.getByRole('tooltip',{name:'Hiện mật khẩu hiện tại'}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('tooltip').count(),0);
  await showPassword.click();assert.equal(await setupForm.locator('[name=password]').getAttribute('type'),'text');await setupForm.getByRole('button',{name:'Ẩn mật khẩu hiện tại',exact:true}).click();assert.equal(await setupForm.locator('[name=password]').getAttribute('type'),'password');
  await setupForm.getByRole('button',{name:'Bật MFA',exact:true}).click();
  await page.locator('.security-secret').waitFor();const secret=(await page.locator('.security-secret').textContent())!;
  await page.screenshot({path:`artifacts/security-setup-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[name=code]').fill(totp(secret,Math.floor(f.deps.now!()/30000)));await page.getByRole('button',{name:'Xác nhận bật MFA'}).click();await page.getByRole('heading',{name:'Đã cập nhật bảo mật'}).waitFor();
  const recovery=(await page.locator('pre').textContent())!.split('\n');assert.equal(recovery.length,10);
  await page.getByRole('button',{name:'Sao chép mã',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã sao chép mã.'}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),recovery.join('\n'));
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Tải mã xuống',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'the-table-recovery.txt');assert.equal(await readFile((await download.path())!,'utf8'),recovery.join('\n'));
  await page.screenshot({path:`artifacts/security-recovery-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

  await login();await page.waitForURL('**/mfa');await page.reload();await page.locator('[name=code]').fill(recovery[0]);await page.getByRole('button',{name:'Xác minh',exact:true}).click();await page.waitForURL('**/admin/dishes');
  await page.goto(origin+'/settings');await page.getByText(/Đang bật/).waitFor();await page.screenshot({path:`artifacts/security-settings-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const disable=page.locator('form').filter({has:page.getByRole('button',{name:'Xác nhận tắt MFA',exact:true})});await disable.locator('[name=password]').fill(credentials.password);await disable.locator('[name=code]').fill(recovery[1]);await disable.getByRole('button',{name:'Xác nhận tắt MFA',exact:true}).click();await page.getByRole('heading',{name:'Đã cập nhật bảo mật'}).waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 // Exercise the same UI with each role; the API remains the authority.
 const original=(await f.repository.read('user','active-user'))!;
 for(const width of [1440,390]){
  for(const role of ['viewer','editor'] as const)await f.repository.write('user',{...original,id:'ui-'+role,email:role+'@example.com',role,userVersion:0});
  const contexts=[];
  try{
   for(const role of ['viewer','editor','admin'] as const){
    const c=await browser.newContext({viewport:{width,height:1000}});contexts.push(c);await installCaptcha(c,f);const p=await c.newPage();
    p.on('pageerror',e=>{throw e;});await p.goto(origin+'/login');await p.locator('#email').fill(role==='admin'?credentials.email:role+'@example.com');await p.locator('#password').fill(credentials.password);await p.getByRole('button',{name:'Tôi không phải người máy'}).click();await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.waitForURL(role==='viewer'?'**/dishes':'**/admin/dishes');
    if(role==='viewer'){assert.equal(await p.getByRole('link',{name:'Quản trị',exact:true}).count(),0);await p.goto(origin+'/admin/dishes');await p.getByRole('heading',{name:'Không có quyền truy cập'}).waitFor();}
    if(role==='editor'){await p.goto(origin+'/admin/chefs');await p.locator('.resource-table tbody tr').first().waitFor();assert.equal(await p.locator('.row-actions a').count(),0);await p.goto(origin+'/admin/users');await p.getByRole('heading',{name:'Không có quyền truy cập'}).waitFor();}
    if(role==='admin'){
     await p.goto(origin+'/admin/users');await p.getByRole('rowheader',{name:'viewer@example.com',exact:true}).waitFor();
     const row=p.getByRole('row').filter({has:p.getByRole('rowheader',{name:'viewer@example.com',exact:true})});await row.getByRole('button',{name:'Cấp editor',exact:true}).click();await row.getByRole('button',{name:'Thu hồi editor',exact:true}).waitFor();assert.equal((await f.repository.read('user','ui-viewer'))!.role,'editor');
     const identity=await f.repository.read('user','ui-viewer');assert.equal(identity!.userVersion,1);
     await row.getByRole('button',{name:'Thu hồi editor',exact:true}).click();await row.getByRole('button',{name:'Cấp editor',exact:true}).waitFor();assert.equal((await f.repository.read('user','ui-viewer'))!.role,'viewer');assert.equal((await f.repository.read('user','ui-viewer'))!.userVersion,2);
     await p.screenshot({path:`artifacts/users-ui-${width}.png`,fullPage:true});
    }
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
  }finally{for(const c of contexts)await c.close();}
 }
 console.log('Security browser PASS: role UI, grant/revoke, password visibility, clipboard/download, desktop/mobile settings, QR, recovery display after logout, pending reload, recovery login and MFA disable.');
}finally{await browser?.close();web.kill();await new Promise<void>(r=>server.close(()=>r()));}
