import { installCaptcha } from './captcha-fixture.js';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { createApp } from '../api/src/app.js';
import { MemoryStore } from '../api/test/memory-store.js';
import { authFixture, credentials } from '../api/test/auth-fixture.js';

const port = 20000 + Math.floor(Math.random() * 20000), origin = `http://localhost:${port}`;
const f = await authFixture(undefined, origin), store = new MemoryStore();
const server = createApp(store, { origin, auth: f.deps }).listen(0, 'localhost');
await new Promise<void>(r => server.once('listening', r));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No API port');
const api = `http://localhost:${address.port}/api`;
const web = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', 'localhost', '--port', String(port), '--strictPort'], {
  cwd: resolve('web'), env: { ...process.env, VITE_API_BASE_URL: api, VITE_RECAPTCHA_SITE_KEY: 'browser-test-public-key' }, stdio: 'pipe',
});
web.stdout.resume(); web.stderr.resume();
let browser;
const errors: string[] = [];
let refreshRequests = 0;
server.on('request', req => { if (req.url === '/api/auth/refresh' && req.method === 'POST') refreshRequests++; });

const watch = (page: Page) => page.on('pageerror', error => errors.push(error.message));
const ready = async (page: Page) => { await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]')); };
const noOverflow = async (page: Page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? ['/usr/bin/google-chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  await mkdir('artifacts', { recursive: true });
  for (const width of [1440, 390]) {
    console.log(`Auth browser: ${width}px account flow`);
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await installCaptcha(context, f);
    const page = await context.newPage(); watch(page);
    let documents = 0; page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) documents++; });
    await page.goto(origin + '/dishes');
    await page.getByRole('heading', { name: 'Bò lúc lắc', exact: true }).waitFor();
    await page.locator('.main-nav').getByRole('link', { name: 'Đăng ký', exact: true }).click();
    await page.getByRole('heading', { name: 'Tạo tài khoản' }).waitFor();
    const email = `learner${width}@example.com`, password = 'Password8!';
    await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.locator('#passwordConfirm').fill('mismatch');
    await page.getByRole('button', { name: 'Tôi không phải người máy' }).click();
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Mật khẩu nhập lại không khớp.' }).waitFor();
    await page.locator('#passwordConfirm').fill(password);
    await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click(); assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
    await noOverflow(page); await page.screenshot({ path: `artifacts/auth-register-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await page.waitForURL('**/activate?email=*');
    await page.getByRole('button', { name: /Gửi lại mã sau/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Gửi lại mã sau/ }).isDisabled(), true);
    await page.locator('#otp').fill(f.emails.find(m => m.kind === 'activation' && m.email === email)!.value);
    await noOverflow(page); await page.screenshot({ path: `artifacts/auth-activate-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Kích hoạt', exact: true }).click(); await page.waitForURL('**/login?status=activated');
    await page.locator('#email').fill(email); await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Tôi không phải người máy' }).click();
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/admin/dishes'); await ready(page);
    assert.equal(documents, 1, 'registration, activation and login are CSR transitions');
    await noOverflow(page);
    assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] });
    assert.equal(await page.evaluate(() => document.cookie.includes('block9.refresh')), false);
    assert.ok((await context.cookies()).some(c => c.name === 'block9.refresh' && c.httpOnly && c.path === '/api/auth'));
    await page.reload(); await ready(page); await page.locator('.account-email').filter({ hasText: email }).waitFor();

    console.log(`Auth browser: ${width}px refresh/multiple tabs`);
    // In-tab single flight: three requests must rotate exactly once and retry once.
    f.advance(f.deps.config.accessTokenTtlMs + 1000);
    const refreshBefore = refreshRequests;
    const resources = await page.evaluate(async () => {
      const modulePath = '/src/api/client.ts';
      const { api } = await import(modulePath);
      return Promise.all(['/chefs/all', '/ingredients/all', '/chefs/options/all'].map(path => api(path)));
    });
    assert.equal(resources.length, 3); assert.equal(refreshRequests - refreshBefore, 1);

    const tab = await context.newPage(); watch(tab);
    await tab.goto(origin + '/admin/chefs'); await tab.locator('.resource-table').waitFor();
    f.advance(f.deps.config.accessTokenTtlMs + 1000);
    await Promise.all([page, tab].map(p => p.evaluate(async () => {
      const modulePath = '/src/api/client.ts'; const { api } = await import(modulePath); return api('/ingredients/all');
    })));
    console.log(`Auth browser: ${width}px logout`);
    await page.locator('.main-nav').getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.waitForURL('**/login'); await tab.waitForURL('**/login');

    await page.locator('#email').fill(email); await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Tôi không phải người máy' }).click();
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/admin/dishes');
    // A second device has an independent refresh cookie and must also be revoked by reset.
    const device = await browser.newContext({ viewport: { width, height: 900 } });
    await installCaptcha(device, f);
    const other = await device.newPage(); watch(other);
    await other.goto(origin + '/login'); await other.locator('#email').fill(email); await other.locator('#password').fill(password);
    await other.getByRole('button', { name: 'Tôi không phải người máy' }).click();
    await other.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await other.waitForURL('**/admin/dishes');
    await page.locator('.main-nav').getByRole('button', { name: 'Đăng xuất', exact: true }).click(); await page.waitForURL('**/login');
    await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
    await page.getByRole('heading', {name:'Quên mật khẩu',exact:true}).waitFor();
    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: 'Gửi hướng dẫn', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Nếu thông tin phù hợp' }).waitFor();
    const reset = f.emails.filter(m => m.kind === 'reset' && m.email === email).at(-1)!.value;
    await noOverflow(page); await page.screenshot({ path: `artifacts/auth-forgot-${width}.png`, fullPage: true });
    await page.goto(reset); await page.waitForURL(origin + '/reset'); await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).waitFor();
    assert.equal(await page.locator('body').innerText().then(text => text.includes(new URL(reset).searchParams.get('token')!)), false);
    await page.reload(); await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).waitFor();
    await page.locator('#password').fill('NewPassword8!'); await page.locator('#passwordConfirm').fill('NewPassword8!');
    await noOverflow(page); await page.screenshot({ path: `artifacts/auth-reset-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click(); await page.waitForURL('**/login?status=reset');
    await other.locator('.admin-nav a[href="/admin/chefs"]').click(); await other.waitForURL('**/login');
    await page.locator('#email').fill(email); await page.locator('#password').fill('NewPassword8!');
    await page.getByRole('button', { name: 'Tôi không phải người máy' }).click();
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/admin/dishes');
    await context.close(); await device.close();
  }
  // Widget expiration/errors and mandatory login verification use the actual React
  // component with an intercepted provider script, never a runtime bypass.
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } }); await installCaptcha(context, f);
  const page = await context.newPage(); watch(page);
  await page.goto(origin + '/login'); await page.locator('#email').fill(credentials.email); await page.locator('#password').fill('bad');
  assert.equal(await page.getByRole('button', { name: 'Đăng nhập', exact: true }).isDisabled(), true);
  await noOverflow(page); await page.screenshot({ path: 'artifacts/auth-login-captcha-390.png', fullPage: true });
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Tôi không phải người máy' }).click(); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Email hoặc mật khẩu' }).waitFor(); await ready(page); assert.equal(await page.getByRole('button', { name: 'Đăng nhập', exact: true }).isDisabled(), true); }
  await page.getByRole('button', { name: 'Tôi không phải người máy' }).click();
  await page.evaluate(() => (window as unknown as { block9TestExpire(): void }).block9TestExpire());
  assert.equal(await page.getByRole('button', { name: 'Đăng nhập', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Thử lại reCAPTCHA' }).click(); await page.getByRole('button', { name: 'Tôi không phải người máy' }).waitFor();
  await page.evaluate(() => (window as unknown as { block9TestError(): void }).block9TestError());
  await page.getByRole('alert').filter({ hasText: 'reCAPTCHA gặp lỗi' }).waitFor();
  await page.getByRole('button', { name: 'Thử lại reCAPTCHA' }).click();
  await page.getByRole('button', { name: 'Tôi không phải người máy' }).click(); await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await page.waitForURL('**/admin/dishes');
  // Authorization failures never trigger refresh; expiration retries once only.
  const callApi = () => page.evaluate(async () => {
    const modulePath = '/src/api/client.ts'; const { api } = await import(modulePath);
    try { await api('/chefs/all'); return ''; } catch (e) { return (e as {code:string}).code; }
  });
  const responseHeaders = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
  const beforeForbidden = refreshRequests;
  await page.route('**/api/chefs/all', route => route.request().method()==='OPTIONS' ? route.continue() : route.fulfill({ status:403, headers:responseHeaders, contentType:'application/json', body:JSON.stringify({ok:false,error:{code:'CSRF_INVALID',message:'Forbidden'}}) }));
  assert.equal(await callApi(),'CSRF_INVALID'); assert.equal(refreshRequests,beforeForbidden);
  await page.unroute('**/api/chefs/all');
  const beforeExpired = refreshRequests;
  let apiAttempts = 0;
  await page.route('**/api/chefs/all', route => {
    if (route.request().method()==='OPTIONS') return route.continue();
    apiAttempts++;
    return route.fulfill({status:401,headers:responseHeaders,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'ACCESS_EXPIRED',message:'Expired'}})});
  });
  assert.equal(await callApi(),'ACCESS_EXPIRED');
  assert.equal(apiAttempts,2); assert.equal(refreshRequests-beforeExpired,1);
  await page.unroute('**/api/chefs/all');
  await page.waitForURL('**/login');
  await context.close();

  const networkContext=await browser.newContext(); await installCaptcha(networkContext, f); const networkPage=await networkContext.newPage(); watch(networkPage);
  await networkPage.goto(origin+'/login'); await networkPage.locator('#email').fill(credentials.email); await networkPage.locator('#password').fill(credentials.password);
  await networkPage.getByRole('button', { name: 'Tôi không phải người máy' }).click();
  await networkPage.getByRole('button',{name:'Đăng nhập',exact:true}).click(); await networkPage.waitForURL('**/admin/dishes'); await ready(networkPage);
  f.advance(f.deps.config.accessTokenTtlMs+1000);
  let networkRefreshAttempts=0;
  await networkPage.route('**/api/auth/refresh', route=>{
    if(route.request().method()==='OPTIONS')return route.continue();
    networkRefreshAttempts++;return route.abort('failed');
  });
  await networkPage.evaluate(async()=>{
    const modulePath='/src/api/client.ts'; const {api}=await import(modulePath);
    try{await api('/chefs/all');}catch{}
  });
  assert.equal(networkRefreshAttempts,1,'an ambiguous refresh network failure is never retried automatically');
  await networkContext.close();
  assert.deepEqual(errors, []);
  console.log('Auth browser PASS: CSR account flows at 1440/390px, OTP, reset reload, memory-only JWT, HttpOnly refresh, single-flight, multiple tabs/devices, revocation and widget errors. Google/SMTP are isolated test dependencies.');
} catch (error) {
  for (const context of browser?.contexts() ?? []) for (const page of context.pages()) {
    console.error('Failure page:', page.url(), (await page.locator('main').innerText().catch(() => '')).slice(0, 1200));
    await page.screenshot({path:'artifacts/auth-failure.png',fullPage:true}).catch(() => {});
  }
  throw error;
} finally { await browser?.close(); web.kill(); server.close(); }
