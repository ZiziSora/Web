import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.js';
import { MemoryStore } from '../test/memory-store.js';
import { authFixture, credentials } from '../test/auth-fixture.js';
import { createCaptcha } from '../src/auth.js';
import { buildSeedDishes, sampleChefs, sampleIngredients } from '../prisma/seed.js';

const store = new MemoryStore();
store.rows.chefs = sampleChefs.map((row,index)=>({...row,id:index+1}));
store.rows.ingredients = sampleIngredients.map((row,index)=>({...row,id:index+1}));
store.rows.dishes = buildSeedDishes().slice(0,13).map((row,index)=>({
  ...row,id:index+1, chefs:[{id:1,name:sampleChefs[0].name}], ingredients:[{id:1,name:sampleIngredients[0].name}],
}));
const auth = await authFixture();
let latestCaptcha = '';
const server = createApp(store, { auth: { ...auth.deps, captcha: () => {
  const generated = createCaptcha(); latestCaptcha = generated.answer; return generated;
} } }).listen(0,'127.0.0.1');
await new Promise<void>(resolve=>server.once('listening',resolve));
const address=server.address();
if(!address || typeof address==='string') throw new Error('Không mở được server.');
const origin=`http://127.0.0.1:${address.port}`;
await mkdir('artifacts',{recursive:true});
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  // Hold a real POST to inspect pending UI without changing the server behavior.
  {
    const context = await browser.newContext({ viewport:{width:390,height:1000} });
    const page = await context.newPage();
    await page.goto(origin+'/login');
    const form = page.locator('[data-auth-form]');
    await form.evaluate((element: HTMLFormElement) => element.requestSubmit());
    assert.equal(await form.getAttribute('data-pending'), null, 'Invalid forms stay interactive');
    await page.getByLabel('Email',{exact:true}).fill(credentials.email);
    await page.getByLabel('Mật khẩu',{exact:true}).fill('wrong-password');
    const toggle = page.getByRole('button',{name:'Hiện mật khẩu',exact:true});
    await toggle.focus(); await page.keyboard.press('Space');
    assert.equal(await page.locator('#password').getAttribute('type'),'text');
    assert.equal(await page.getByRole('button',{name:'Ẩn mật khẩu'}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#password').inputValue(),'wrong-password');
    await page.getByRole('button',{name:'Ẩn mật khẩu'}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.clock.install();
    // Keep the document interactive while the browser sends a native POST.
    await page.evaluate(() => {
      const frame=document.createElement('iframe'); frame.name='auth-result'; frame.hidden=true;
      document.body.append(frame);
      document.querySelector<HTMLFormElement>('[data-auth-form]')!.target='auth-result';
    });
    let release!: () => void, posted!: () => void, posts=0;
    const held = new Promise<void>(resolve => { release=resolve; });
    const received = new Promise<void>(resolve => { posted=resolve; });
    await page.route('**/login',async route => {
      if(route.request().method()!=='POST') return route.continue();
      posts++; assert.match(route.request().postData()!,/password=wrong-password/);
      posted(); await held; await route.continue();
    });
    const responseReceived = page.waitForResponse(response => response.url()===origin+'/login' && response.request().method()==='POST');
    try {
      await form.evaluate((element: HTMLFormElement) => element.requestSubmit(element.querySelector<HTMLButtonElement>('button[type="submit"]')!));
      await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Pending POST was not sent')),10000))]);
      // Inspect the source form while the result frame waits for its response.
      await page.evaluate(() => { const form=document.querySelector<HTMLFormElement>('[data-auth-form]')!; form.requestSubmit(); form.requestSubmit(); });
      await page.clock.runFor(20);
      const state = await page.evaluate(() => ({
        busy:document.querySelector('[data-auth-form]')!.getAttribute('aria-busy'),
        disabled:document.querySelector<HTMLButtonElement>('.auth-submit-button')!.disabled,
        label:document.querySelector('[data-submit-label]')!.textContent,
        spinner:!document.querySelector<HTMLElement>('[data-submit-spinner]')!.hidden,
        animation:getComputedStyle(document.querySelector('[data-submit-spinner] svg')!).animationName,
        inputDisabled:document.querySelector<HTMLInputElement>('#email')!.disabled,
      }));
      assert.deepEqual(state,{busy:'true',disabled:true,label:'Đang đăng nhập…',spinner:true,animation:'none',inputDisabled:false});
      await page.clock.fastForward(8100);
      assert.match(await page.evaluate(() => document.querySelector('.auth-pending-status')!.textContent!),/vui lòng chờ thêm/);
      assert.equal(posts,1,'Repeated submissions produce one POST');
      await page.screenshot({path:'artifacts/auth-pending-mobile.png',fullPage:true});
    } finally { release(); }
    assert.equal((await responseReceived).status(),400);
    // Exercise BFCache restoration explicitly; native navigation flows follow below.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    assert.equal(await page.locator('[data-auth-form]').getAttribute('aria-busy'),null);
    assert.equal(await page.getByRole('button',{name:'Đăng nhập',exact:true}).isEnabled(),true);
    assert.equal(await page.locator('[data-submit-spinner]').isVisible(),false);
    assert.equal(await page.locator('.auth-pending-status').textContent(),'');
    await context.close();
  }
  for(const javaScriptEnabled of [false,true]) for(const width of [1440,390]) {
    const context=await browser.newContext({javaScriptEnabled,viewport:{width,height:1000}});
    const page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    let documents=0; page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()) documents++;});
    const suffix=`${width}-${javaScriptEnabled?'js':'nojs'}`;
    await page.goto(origin+'/admin/dishes');
    await page.waitForURL('**/login');
    for (const route of ['/register', '/activate', '/forgot', '/login']) {
      await page.goto(origin + route);
      assert.ok(await page.locator('.auth-panel .lucide').count()>0,'Icons render in server HTML');
      assert.equal(await page.getByRole('button',{name:'Hiện mật khẩu',exact:true}).isVisible(),javaScriptEnabled && route==='/login' || javaScriptEnabled && route==='/register');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${route} overflows at ${suffix}`);
      await page.screenshot({path:`artifacts/auth-${route.slice(1)}-${suffix}.png`,fullPage:true});
    }
    const email = `browser-${suffix}@example.com`;
    await page.goto(origin+'/register');
    await page.getByLabel('Email', {exact:true}).fill(email);
    await page.getByLabel('Mật khẩu', {exact:true}).fill('12345678');
    await page.getByLabel('Mã trong ảnh', {exact:true}).fill(latestCaptcha);
    await page.getByRole('button', {name:'Tạo tài khoản'}).click();
    await page.waitForURL('**/activate?email=*');
    await page.getByLabel('Mã kích hoạt', {exact:true}).fill(auth.emails.findLast(message=>message.kind==='activation'&&message.email===email)!.value);
    await page.getByRole('button', {name:'Kích hoạt',exact:true}).click();
    await page.waitForURL('**/login?status=activated');
    await page.goto(origin+'/admin'); await page.waitForURL('**/login');
    await page.getByLabel('Email', {exact:true}).fill(email);
    await page.getByLabel('Mật khẩu', {exact:true}).fill('12345678');
    await page.getByRole('button', {name:'Đăng nhập'}).click(); await page.waitForURL('**/admin/dishes');
    await page.getByRole('button', {name:'Đăng xuất'}).click(); await page.waitForURL('**/login');
    await page.goto(origin+'/forgot');
    await page.getByLabel('Email', {exact:true}).fill(email);
    await page.getByRole('button', {name:'Gửi hướng dẫn'}).click(); await page.locator('.auth-notice[role="status"]').waitFor();
    const reset = new URL(auth.emails.findLast(message=>message.kind==='reset'&&message.email===email)!.value);
    await page.goto(origin+reset.pathname+reset.search);
    await page.screenshot({path:`artifacts/auth-reset-${suffix}.png`,fullPage:true});
    await page.getByLabel('Mật khẩu mới', {exact:true}).fill('password-new');
    await page.getByRole('button', {name:'Đổi mật khẩu'}).click(); await page.waitForURL('**/login?status=reset');
    await page.getByLabel('Email', {exact:true}).fill(email);
    await page.getByLabel('Mật khẩu', {exact:true}).fill('password-new');
    await page.getByRole('button', {name:'Đăng nhập'}).click(); await page.waitForURL('**/admin/dishes');
    await page.getByRole('button', {name:'Đăng xuất'}).click(); await page.waitForURL('**/login');
    await page.getByLabel('Email', {exact:true}).fill(credentials.email);
    await page.getByLabel('Mật khẩu', {exact:true}).fill(credentials.password);
    await page.getByRole('button', {name:'Đăng nhập'}).click();
    await page.waitForURL('**/admin/dishes');
    await page.goto(origin+'/dishes');
    assert.equal(await page.locator('.dish-card').count(),6);
    await page.screenshot({path:`artifacts/menu-${suffix}.png`,fullPage:true});
    let before=documents;
    await page.locator('[rel="next"]').click(); await page.waitForURL('**/dishes?page=2#menu');
    assert.equal(await page.locator('.dish-card').count(),6);assert.ok(documents>before,'Page changes must load an HTML document');
    await page.goBack();await page.waitForURL('**/dishes');
    await page.goto(origin+'/dishes?page=2');
    await page.getByRole('searchbox').fill('pasta');
    if(!javaScriptEnabled) await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get('q')==='pasta'&&!url.searchParams.has('page'));
    assert.equal(await page.locator('.dish-card').count(),2);
    await page.reload();assert.equal(await page.locator('.dish-card').count(),2);
    if(javaScriptEnabled) {
      await page.goto(origin+'/dishes');
      const search=page.getByRole('searchbox');
      await search.dispatchEvent('compositionstart');await search.fill('pasta');
      await page.waitForTimeout(450);assert.equal(new URL(page.url()).searchParams.has('q'),false);
      await search.dispatchEvent('compositionend');
      await page.waitForURL(url=>url.searchParams.get('q')==='pasta');
      await page.goto(origin+'/dishes');
      before=documents;await page.getByRole('searchbox').fill('nam');await page.getByRole('searchbox').press('Enter');
      await page.waitForURL(url=>url.searchParams.get('q')==='nam');await page.waitForTimeout(450);
      assert.equal(documents-before,1,'Enter cancels pending debounce');
      await page.goto(origin+'/dishes');await page.locator('body').click({position:{x:2,y:2}});await page.keyboard.press('ArrowRight');
      await page.waitForURL('**/dishes?page=2#menu');
      await page.keyboard.press('ArrowLeft');await page.waitForURL('**/dishes#menu');
    }
    for(const resource of ['dishes','chefs','ingredients']) {
      await page.goto(`${origin}/admin/${resource}?page=2`);
      assert.equal(await page.locator('tbody tr').count(),6);
      await page.screenshot({path:`artifacts/${resource}-${suffix}.png`,fullPage:true});
    }
    await page.goto(origin+'/admin/chefs');
    await page.locator('.related-details summary').first().click();
    assert.equal(await page.locator('.related-details').first().locator('li').count(),13);
    if(javaScriptEnabled) { await page.locator('.related-details').first().getByRole('searchbox').fill('pasta');assert.equal(await page.locator('.related-details').first().locator('li:visible').count(),2); }
    await page.goto(origin+'/admin/dishes/new');
    const picker=page.locator('[data-picker]').first();
    if(javaScriptEnabled) {
      assert.equal(await picker.locator('.checkbox-option:visible').count(),6);
      await picker.getByRole('button',{name:'Tải thêm'}).click();assert.equal(await picker.locator('.checkbox-option:visible').count(),12);
      await picker.getByRole('searchbox').fill(sampleChefs[19].name);await picker.getByRole('searchbox').press('Enter');
      await picker.locator('input[type="checkbox"]').last().check();
      await picker.getByRole('searchbox').fill('Nguyễn');await picker.getByRole('searchbox').press('Enter');
      assert.equal(await picker.locator('input:checked').count(),1);assert.equal(await picker.locator('.selected-options li').count(),1);
      const ingredients=page.locator('[data-picker]').nth(1);
      assert.equal(await ingredients.locator('.checkbox-option:visible').count(),6);
      await ingredients.locator('.options-scroll').evaluate(element=>{element.scrollTop=element.scrollHeight;element.dispatchEvent(new Event('scroll'));});
      assert.equal(await ingredients.locator('.checkbox-option:visible').count(),12);
      await ingredients.getByRole('searchbox').fill('kg');await ingredients.getByRole('searchbox').press('Enter');
      assert.equal(await ingredients.locator('.checkbox-option:visible').count(),0,'Picker searches names, not units');
      await ingredients.getByRole('searchbox').fill('');await ingredients.getByRole('searchbox').press('Enter');

    } else {
      assert.equal(await picker.locator('.checkbox-option').count(),20);
      await picker.locator('input[type="checkbox"]').last().check();
    }
    await page.getByLabel('Tên món ăn').fill('Món browser '+suffix);
    await page.getByLabel('Mô tả món ăn').fill('Giữ checkbox ẩn sau validation.');
    await page.getByLabel('Giá (VNĐ)').fill('invalid');await page.getByLabel('Danh mục').fill('Test');
    await page.getByRole('button',{name:'Thêm món ăn'}).click();await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('input[name="chefIds"]:checked').inputValue(),'20');
    assert.equal(await page.getByLabel('Tên món ăn').inputValue(),'Món browser '+suffix);
    await page.getByLabel('Giá (VNĐ)').fill('123456.78');
    await page.screenshot({path:`artifacts/form-${suffix}.png`,fullPage:true});
    await page.getByRole('button',{name:'Thêm món ăn'}).click();await page.waitForURL('**/admin/dishes?status=created');
    await page.reload();assert.equal(store.rows.dishes.filter(row=>row.name==='Món browser '+suffix).length,1);
    const created=store.rows.dishes.at(-1)!;assert.equal(created.chefs?.[0].id,20);
    await page.goto(`${origin}/admin/dishes/${created.id}/delete`);
    await page.getByRole('button',{name:'Xác nhận xóa'}).click();await page.waitForURL('**/admin/dishes?status=deleted');
    assert.ok(!store.rows.dishes.some(row=>row.id===created.id));
    await page.goto(origin+'/admin/ingredients/1/delete');assert.equal(await page.getByRole('button',{name:'Xác nhận xóa'}).count(),0);
    for(const route of ['/dishes','/dishes/1','/admin/dishes','/admin/chefs','/admin/ingredients','/admin/dishes/new','/dishes/nope']) {
      await page.goto(origin+route);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} overflows at ${suffix}`);
    }
    if(javaScriptEnabled) {
      await page.emulateMedia({reducedMotion:'reduce'});await page.goto(origin+'/dishes');
      assert.equal(await page.locator('[data-motion-toggle]').isVisible(),false);
      await page.locator('[rel="next"]').click();await page.waitForURL('**/dishes?page=2#menu');
      assert.equal(await page.locator('.ssr-turn').evaluate(element=>getComputedStyle(element).display),'none');
    }
    assert.deepEqual(errors,[]);await context.close();
    console.log(`PASS browser ${suffix}`);
  }
  if(existsSync('dist/src/server.js')) {
    const child=spawn(process.execPath,['dist/src/server.js'],{env:{...process.env,DATABASE_URL:'postgresql://localhost/table?schema=block8',PORT:'0',NODE_ENV:'production',APP_BASE_URL:'https://example.test',SESSION_SECRET:auth.deps.config.sessionSecret,AUTH_TOKEN_SECRET:auth.deps.config.tokenSecret,SMTP_HOST:'smtp.example.test',SMTP_USER:'test',SMTP_PASS:'test',SMTP_FROM:'test@example.test'},stdio:'pipe'});
    child.stderr.resume();
    try {
      const port=await new Promise<string>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Production startup timeout')),15000);
        child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);reject(new Error('Production exit '+code));});
        child.stdout.on('data',(data:Buffer)=>{const match=data.toString().match(/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      });
      for(const asset of ['styles.css','app.js','favicon.svg']) assert.equal((await fetch(`http://127.0.0.1:${port}/${asset}`)).status,200);
    } finally {child.kill('SIGTERM');await new Promise<void>(resolve=>child.once('close',()=>resolve()));}
  }
  console.log('PASS: registration/OTP/login/logout/reset, real CAPTCHA, SSR/CRUD, no-JS, responsive and compiled production assets.');
} finally {
  await browser?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
}
