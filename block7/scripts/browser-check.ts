import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createApp } from '../api/src/app.js';
import { MemoryStore } from '../api/test/memory-store.js';
const webPort = 20000 + Math.floor(Math.random() * 20000);
const webOrigin = `http://localhost:${webPort}`;
const store = new MemoryStore();
const server = createApp(store, { origin: webOrigin }).listen(0, 'localhost');
const requests: {method:string;type:string|undefined}[]=[];
server.on('request',req=>requests.push({method:req.method??'',type:req.headers['content-type']}));
await new Promise<void>(r => server.once('listening', r));
const address = server.address();
if (!address || typeof address === 'string')
    throw new Error('No API port');
const web = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', 'localhost', '--port', String(webPort), '--strictPort'], { cwd: resolve('web'), env: { ...process.env, VITE_API_BASE_URL: `http://localhost:${address.port}/api` }, stdio: 'pipe' });
web.stdout.resume();
web.stderr.resume();
let browser;
try {
    for (let i = 0; i < 100; i++) {
        try {
            if ((await fetch(webOrigin)).ok)
                break;
        }
        catch { }
        await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(existsSync), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    const batches: {url:string;count:number}[]=[];
    page.on('response', async response => {
      if (!response.url().includes('/api/') || response.request().method()!=='GET' || response.status()!==200) return;
      try { const body=await response.json(); if(Array.isArray(body.data?.items)) batches.push({url:response.url(),count:body.data.items.length}); } catch {}
    });
    page.on('pageerror', e => errors.push(e.message));
    // React warnings are console errors, not uncaught page errors.
    page.on('console', message => {
      const text = message.text();
      if (['error', 'warning'].includes(message.type()) && text.includes('key') && /spread|spreading/i.test(text)) errors.push(text);
    });
    await page.goto(webOrigin + '/dishes');
    await page.getByRole('heading', { name: 'Bò lúc lắc', exact: true }).waitFor();
    await mkdir('artifacts', { recursive: true });
    // Hero motion uses CSS timelines and pauses without restarting them.
    const art = page.getByRole('img',{name:'Bàn ăn The Table'});
    const running = () => page.waitForFunction(()=>document.querySelector('.table-illustration')?.getAttribute('data-motion')==='running');
    await art.scrollIntoViewIfNeeded();
    await running();
    assert.equal(await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).animationDuration),'32s');
    assert.equal(await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).transformOrigin),'260px 321px');
    const before = await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).transform);
    await page.waitForFunction(old=>getComputedStyle(document.querySelector('.hero-plate')!).transform!==old,before);
    await page.getByRole('button',{name:'Tạm dừng chuyển động'}).focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.hero-motion-toggle')?.getAttribute('aria-pressed')==='true');
    const paused = await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).transform);
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).transform),paused);
    await page.getByRole('button',{name:'Tiếp tục chuyển động'}).click();
    await running();
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>document.querySelector('.table-illustration')?.getAttribute('data-motion')==='paused');
    await art.scrollIntoViewIfNeeded(); await running();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>document.querySelector('.table-illustration')?.getAttribute('data-motion')==='paused');
    await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await running();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Tạm dừng chuyển động'}).waitFor({state:'hidden'});
    assert.equal(await page.locator('.hero-plate').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await running();
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      await art.scrollIntoViewIfNeeded(); await running();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const [svg,plate] = await Promise.all([art.boundingBox(),page.locator('.hero-plate').boundingBox()]);
      assert.ok(svg && plate && plate.x>=svg.x && plate.y>=svg.y && plate.x+plate.width<=svg.x+svg.width && plate.y+plate.height<=svg.y+svg.height);
      await page.locator('.menu-hero').screenshot({path:'artifacts/hero-motion-'+width+'.png'});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({ path: 'artifacts/menu-desktop.png', fullPage: true });
    await page.getByRole('link',{name:'Xem chi tiết Bò lúc lắc'}).click();
    await page.locator('.detail-main h1').waitFor();
    assert.ok(requests.some(r=>r.method==='GET'));
    assert.ok(requests.filter(r=>r.method==='GET').every(r=>r.type===undefined));
    assert.equal(requests.filter(r=>r.method==='OPTIONS').length,0,'GET must not preflight');
    await page.getByRole('link',{name:'Trở lại thực đơn'}).click();
    // Pagination operates on complete filtered lists; never on just the visible page.
    const snapshot = structuredClone(store.rows);
    for (const count of [0, 1, 6, 7, 13]) {
      for (const resource of ['dishes', 'chefs', 'ingredients'] as const) {
        const original = snapshot[resource][0];
        store.rows[resource] = Array.from({length:count}, (_, i) => ({...structuredClone(original), id:i+1, name:'Mục ' + (i+1)}));
        const routes = resource === 'dishes' ? ['/dishes','/admin/dishes'] : ['/admin/' + resource];
        for (const path of routes) {
          await page.goto(webOrigin + path);
          await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
          const selector = path === '/dishes' ? '.book-content .dish-card' : '.resource-table tbody tr';
          assert.equal(await page.locator(selector).count(), Math.min(count,6));
          assert.equal(await page.getByRole('navigation',{name:'Phân trang'}).count(), count>6?1:0);
          if (count>6) {
            await page.getByRole('link',{name:path==='/dishes'?'Trang sau':'Sau',exact:true}).focus();
            await page.keyboard.press('Enter');
            await page.locator(selector).filter({hasText:'Mục 7'}).first().waitFor();
            assert.equal(new URL(page.url()).searchParams.get('page'),'2');
            await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
            assert.equal(await page.locator(selector).count(),Math.min(count-6,6));
            assert.ok(await page.locator(selector).first().innerText().then(x=>x.includes('Mục 7')));
            await page.locator('h1:focus, h2:focus').waitFor();
            if(path==='/dishes') assert.equal(await page.locator('.dish-number').first().innerText(),'07');
            await page.reload();
            await page.locator(selector).first().waitFor();
            assert.ok((await page.locator(selector).first().innerText()).includes('Mục 7'));
            await page.getByRole('link',{name:path==='/dishes'?'Trang trước':'Trước',exact:true}).click();
            assert.equal(new URL(page.url()).searchParams.get('page'),null);
            await page.goBack();
            await page.waitForURL('**page=2');
            await page.goForward();
            await page.waitForURL(url=>!url.searchParams.has('page'));
          }
          if (count === 7) {
            await page.goto(webOrigin+path+'?q='+encodeURIComponent('Mục'));
            await page.locator(selector).first().waitFor();
            await page.getByRole('heading').first().click();
            await page.keyboard.press('ArrowLeft');
            assert.equal(new URL(page.url()).searchParams.get('page'),null);
            await page.keyboard.press('ArrowRight');
            await page.waitForURL('**page=2');
            await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
            assert.equal(new URL(page.url()).searchParams.get('q'),'Mục');
            await page.keyboard.press('ArrowRight');
            assert.equal(new URL(page.url()).searchParams.get('page'),'2');
            await page.getByRole('searchbox').focus();
            await page.keyboard.press('ArrowLeft');
            assert.equal(new URL(page.url()).searchParams.get('page'),'2','editing must not change page');
            await page.getByRole('heading').first().click();
            await page.keyboard.press('Shift+ArrowLeft');
            assert.equal(new URL(page.url()).searchParams.get('page'),'2','modifier must not change page');
            await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',repeat:true})));
            assert.equal(new URL(page.url()).searchParams.get('page'),'2','held keys must not repeat navigation');
            await page.keyboard.press('ArrowLeft');
            await page.waitForURL(url=>!url.searchParams.has('page'));
            await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
            assert.equal(new URL(page.url()).searchParams.get('q'),'Mục');
          }
          for(const bad of ['0','-1','abc','1.5','9007199254740992','999']) {
            await page.goto(webOrigin+path+'?page='+bad);
            await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
            const expected = bad==='999' && count>6 ? String(Math.ceil(count/6)) : null;
            await page.waitForURL(url=>url.searchParams.get('page')===expected);
          }
        }
        store.rows[resource]=structuredClone(snapshot[resource]);
      }
    }
    for(const resource of ['dishes','chefs','ingredients'] as const) {
      store.rows[resource]=Array.from({length:13},(_,i)=>({...structuredClone(snapshot[resource][0]),id:i+1,name:'Mục '+(i+1)}));
    }
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      for(const path of ['/dishes','/admin/dishes','/admin/chefs','/admin/ingredients']) {
        await page.goto(webOrigin+path+'?page=3');
        await page.getByText('Hiển thị 13–13 trên 13 mục').waitFor();
        await page.screenshot({path:'artifacts/paged-'+path.replaceAll('/','-')+'-'+width+'.png',fullPage:true});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.getByRole('searchbox').fill('Mục 13');
        await page.getByRole('searchbox').press('Enter');
        await page.waitForURL(url=>!url.searchParams.has('page') && url.searchParams.get('q')==='Mục 13');
        await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
        assert.equal(await page.getByRole('navigation',{name:'Phân trang'}).count(),0);
        await page.reload();
        await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
        await page.screenshot({path:'artifacts/pagination-'+path.replaceAll('/','-')+'-'+width+'.png',fullPage:true});
      }
    }
    // Filters/sort affect the whole result before server pagination and survive reload.
    const beforeFilter=structuredClone(store.rows.dishes);
    store.rows.dishes=store.rows.dishes.map((row,i)=>({...row,price:String(i*100),category:i%2?'B':'A',available:i%2===0}));
    await page.goto(webOrigin+'/admin/dishes?page=3');
    await page.getByText('Hiển thị 13–13 trên 13 mục').waitFor();
    if(!await page.locator('.query-filters').getAttribute('open').then(v=>v!==null)) await page.locator('.query-filters summary').click();
    await page.getByRole('searchbox').fill('Muc');
    await page.getByLabel('Danh mục',{exact:true}).selectOption('A');
    await page.getByLabel('Giá từ (VNĐ)',{exact:true}).fill('200');
    await page.getByLabel('Giá đến (VNĐ)',{exact:true}).fill('800');
    await page.getByLabel('Phục vụ',{exact:true}).selectOption('true');
    await page.getByLabel('Sắp xếp',{exact:true}).selectOption('price-desc');
    await page.getByRole('searchbox').press('Enter');
    await page.getByText('Hiển thị 1–4 trên 4 mục').waitFor();
    assert.ok((await page.getByRole('rowheader').first().innerText()).includes('Mục 9'));
    assert.equal(new URL(page.url()).searchParams.has('page'),false);
    await page.reload();await page.getByText('Hiển thị 1–4 trên 4 mục').waitFor();
    assert.equal(await page.getByLabel('Sắp xếp',{exact:true}).inputValue(),'price-desc');
    await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();
    await page.getByText('Hiển thị 1–6 trên 13 mục').waitFor();
    // Automatic queries: debounce, IME, validation, individual chips and history.
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(webOrigin+'/admin/dishes');
    await page.getByRole('rowheader').first().waitFor();
    const search = page.getByRole('searchbox');
    const queryRequests: string[] = [];
    const recordQuery = (request: import('playwright-core').Request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/dishes' && url.searchParams.has('q')) queryRequests.push(url.searchParams.get('q')!);
    };
    page.on('request', recordQuery);
    await search.fill('M');
    await page.waitForTimeout(80);
    await search.fill('Mục 13');
    await page.waitForTimeout(150);
    assert.equal(new URL(page.url()).searchParams.has('q'), false, 'typing waits for debounce');
    await page.waitForURL(url => url.searchParams.get('q') === 'Mục 13');
    await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
    assert.deepEqual(queryRequests, ['Mục 13'], 'only final typed term is requested');
    assert.ok(await search.evaluate(el => el === document.activeElement));
    // The explicit search button flushes the pending term without a second request.
    await search.fill('Mục 12');
    await page.getByRole('button',{name:'Tìm kiếm',exact:true}).click();
    await page.waitForURL(url => url.searchParams.get('q') === 'Mục 12');
    await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
    await page.waitForTimeout(350);
    assert.deepEqual(queryRequests, ['Mục 13','Mục 12']);
    await page.getByRole('button', {name:'Xóa từ khóa',exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('q'));
    await search.dispatchEvent('compositionstart');
    await search.fill('Mục 12');
    await page.waitForTimeout(400);
    await search.press('Enter');
    assert.equal(new URL(page.url()).searchParams.has('q'), false, 'IME never submits partial text');
    await search.dispatchEvent('compositionend');
    await page.waitForURL(url => url.searchParams.get('q') === 'Mục 12');
    await page.getByRole('button', {name:'Xóa tất cả',exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('q'));
    await page.getByLabel('Danh mục',{exact:true}).selectOption('A');
    await page.waitForURL(url => url.searchParams.get('category') === 'A');
    await page.getByLabel('Giá từ (VNĐ)',{exact:true}).fill('800');
    await page.getByLabel('Giá đến (VNĐ)',{exact:true}).fill('200');
    await page.getByText('Giá đến phải lớn hơn hoặc bằng giá từ.',{exact:true}).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('minPrice'), false, 'invalid prices stay local');
    await page.getByLabel('Giá đến (VNĐ)',{exact:true}).fill('1000');
    await page.waitForURL(url => url.searchParams.get('maxPrice') === '1000');
    await page.getByRole('button',{name:'Bỏ Danh mục: A',exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('category'));
    assert.equal(new URL(page.url()).searchParams.get('minPrice'), '800');
    await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('minPrice'));
    for (const price of ['-1', '10000000000', '2.333', 'abc']) {
      await page.getByLabel('Giá từ (VNĐ)',{exact:true}).fill(price);
      await page.waitForTimeout(350);
      assert.equal(await page.getByLabel('Giá từ (VNĐ)',{exact:true}).inputValue(), price, 'invalid draft is retained: '+price);
      assert.equal(await page.getByLabel('Giá từ (VNĐ)',{exact:true}).getAttribute('aria-invalid'), 'true', 'invalid price: '+price);
      assert.equal(new URL(page.url()).searchParams.has('minPrice'), false);
    }
    await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();
    await page.getByLabel('Danh mục',{exact:true}).selectOption('A');
    await page.waitForURL(url => url.searchParams.get('category') === 'A');
    await search.fill('pending navigation');
    await page.goBack();
    await page.waitForTimeout(400);
    assert.equal(new URL(page.url()).searchParams.has('q'), false, 'Back cancels pending debounce');
    assert.equal(await search.inputValue(), '');
    await page.goForward();
    assert.equal(await page.getByLabel('Danh mục',{exact:true}).inputValue(), 'A');
    await page.reload();
    assert.equal(await page.getByLabel('Danh mục',{exact:true}).inputValue(), 'A');
    await page.getByRole('button',{name:'Xóa tất cả',exact:true}).click();
    page.off('request', recordQuery);
    // Guest search keeps the chosen sort while ranking by relevance.
    await page.goto(webOrigin+'/dishes?sort=price-desc');
    await page.getByRole('searchbox').fill('Mục');
    await page.waitForURL(url => url.searchParams.get('q') === 'Mục');
    assert.ok(await page.getByLabel('Sắp xếp',{exact:true}).isDisabled());
    assert.equal(await page.getByLabel('Sắp xếp',{exact:true}).inputValue(), 'relevance');
    await page.getByRole('button',{name:'Xóa từ khóa',exact:true}).click();
    await page.waitForURL(url => !url.searchParams.has('q'));
    assert.equal(await page.getByLabel('Sắp xếp',{exact:true}).inputValue(), 'price-desc');
    for (const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      for (const path of ['/dishes','/admin/dishes']) {
        await page.goto(webOrigin+path+'?category=A&minPrice=200&available=true');
        await page.getByRole('button',{name:'Bỏ Danh mục: A',exact:true}).waitFor();
        const filters=page.locator('.query-filters');
        assert.equal(await filters.evaluate(el => el.hasAttribute('open')), width >= 768);
        if (width < 768) await filters.locator('summary').click();
        assert.ok(await page.getByLabel('Giá từ (VNĐ)',{exact:true}).isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator('.query-controls').screenshot({path:'artifacts/search-'+(path === '/dishes' ? 'menu' : 'admin')+'-'+width+'.png'});
      }
    }
    store.rows.dishes=beforeFilter;
    // Book-specific interactions: reduced motion, rapid input, resize and history cancellation.
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(webOrigin+'/dishes');
    await page.locator('.book-content .dish-card').first().waitFor();
    await page.screenshot({path:'artifacts/book-desktop.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('link',{name:'Trang sau',exact:true}).click();
    await page.waitForURL('**page=2');
    await page.locator('.book-content .dish-card').filter({hasText:'Mục 7'}).waitFor();
    assert.equal(await page.locator('.book-turn').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.getByRole('link',{name:'Trang trước',exact:true}).click();
    await page.goBack();
    await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
    assert.equal(new URL(page.url()).searchParams.get('page'),'2');
    await page.getByRole('link',{name:'Trang sau',exact:true}).click();
    await page.setViewportSize({width:390,height:900});
    await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
    await page.goto(webOrigin+'/dishes');
    await page.locator('.book-content .dish-card').first().waitFor();
    await page.screenshot({path:'artifacts/book-mobile.png',fullPage:true});
    await page.getByRole('link',{name:'Trang sau',exact:true}).evaluate(el=>{(el as HTMLElement).click();(el as HTMLElement).click();});
    await page.waitForFunction(()=>!document.querySelector('.menu-book[aria-busy="true"]'));
    assert.equal(new URL(page.url()).searchParams.get('page'),'2');
    // All three pagination UIs are exercised with fixtures beyond one batch.
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(webOrigin+'/admin/dishes/1/edit');
    const chefs=page.locator('.relation-fieldset').filter({has:page.locator('legend', {hasText:'Đầu bếp biết nấu món này'})});
    const ingredients=page.locator('.relation-fieldset').filter({has:page.locator('legend', {hasText:'Nguyên liệu của món'})});
    await chefs.getByText('Đã tải 6 mục',{exact:true}).waitFor();
    await chefs.getByRole('button',{name:'Tải thêm',exact:true}).click();
    await chefs.getByText('Đã tải 12 mục',{exact:true}).waitFor();
    await chefs.getByLabel('Mục 7',{exact:true}).check();
    await chefs.getByRole('searchbox').fill('muc 13');
    await chefs.getByRole('searchbox').press('Enter');
    assert.equal(new URL(page.url()).pathname,'/admin/dishes/1/edit','search Enter must not save the form');
    await chefs.getByText('Đã tải 1 mục · Đã hết danh sách',{exact:true}).waitFor();
    await chefs.getByRole('button',{name:'Bỏ chọn Mục 7',exact:true}).waitFor();
    await chefs.getByLabel('Mục 13',{exact:true}).check();
    await chefs.getByRole('searchbox').fill('');
    await chefs.getByText('Đã tải 6 mục',{exact:true}).waitFor();
    await chefs.getByRole('button',{name:'Bỏ chọn Mục 13',exact:true}).waitFor();
    await ingredients.locator('.options-scroll').scrollIntoViewIfNeeded();
    await ingredients.locator('.options-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await ingredients.getByText('Đã tải 12 mục',{exact:true}).waitFor();
    const beforeScroll=await ingredients.locator('.options-scroll').evaluate(el=>el.scrollTop);
    assert.ok(beforeScroll>0,'append retains scroll position');
    await ingredients.getByRole('searchbox').fill('không có');
    await ingredients.getByText('Không tìm thấy tên phù hợp.').waitFor();
    assert.equal(await ingredients.getByRole('checkbox').count(),0);
    await ingredients.getByRole('searchbox').fill('');
    await ingredients.getByText('Đã tải 6 mục',{exact:true}).waitFor();
    // A failed next batch keeps inputs, checkboxes and loaded rows intact.
    await page.route('**/api/chefs/options?**', async route=>{
      if(new URL(route.request().url()).searchParams.has('after')) await route.fulfill({status:500,body:'offline'});
      else await route.continue();
    });
    await chefs.getByRole('button',{name:'Tải thêm',exact:true}).click();
    await chefs.getByRole('alert').waitFor();
    assert.equal(await chefs.getByRole('checkbox').count(),6);
    await chefs.getByRole('button',{name:'Bỏ chọn Mục 7',exact:true}).waitFor();
    await page.unroute('**/api/chefs/options?**');
    await chefs.getByRole('button',{name:'Thử lại',exact:true}).click();
    await chefs.getByText('Đã tải 12 mục',{exact:true}).waitFor();
    assert.ok(await chefs.getByLabel('Mục 7',{exact:true}).isChecked());
    await page.screenshot({path:'artifacts/relationship-paging-1440.png',fullPage:true});
    await page.setViewportSize({width:390,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'artifacts/relationship-paging-390.png',fullPage:true});
    // Late responses from one condition must never replace a different query.
    await page.goto(webOrigin+'/admin/dishes');
    await page.getByRole('rowheader').first().waitFor();
    let releaseOld!:()=>void;
    const heldOld=new Promise<void>(resolve=>{releaseOld=resolve;});
    await page.route('**/api/dishes?**',async route=>{
      if(new URL(route.request().url()).searchParams.get('q')==='Mục 1') {
        const response=await route.fetch();await heldOld;
        try {await route.fulfill({response});} catch {}
      } else await route.continue();
    });
    await page.getByRole('searchbox').fill('Mục 1');
    const requested=page.waitForRequest(req=>new URL(req.url()).searchParams.get('q')==='Mục 1');
    await requested;
    await page.getByRole('searchbox').fill('Mục 13');
    await page.getByRole('searchbox').press('Enter');
    await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
    releaseOld();await page.waitForTimeout(150);
    assert.equal(await page.getByRole('rowheader').count(),1);
    assert.ok((await page.getByRole('rowheader').innerText()).includes('Mục 13'));
    await page.unroute('**/api/dishes?**');
    // Fuzzy presentation uses a controlled server response; ranking is tested on real PG.
    await page.route('**/api/dishes?**',async route=>{
      const data=await store.list('dishes',{page:1,pageSize:6,q:'',sort:'id',mode:'fuzzy',fallback:false});
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':webOrigin},body:JSON.stringify({ok:true,data})});
    });
    await page.goto(webOrigin+'/dishes?q=monn');
    await page.locator('.search-summary').filter({hasText:'Các món có tên gần giống'}).waitFor();
    await page.unroute('**/api/dishes?**');
    // A removed last page clamps to the new final page on reload.
    store.rows.ingredients=store.rows.ingredients.slice(0,6);
    await page.goto(webOrigin+'/admin/ingredients?page=3');
    await page.waitForURL(url=>!url.searchParams.has('page'));
    await page.getByText('Hiển thị 1–6 trên 6 mục').waitFor();
    store.rows=structuredClone(snapshot);
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(webOrigin+'/dishes');
    await page.getByRole('heading',{name:'Bò lúc lắc',exact:true}).waitFor();
    let docs = 0;
    page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame())
        docs++; });
    await page.getByRole('searchbox').fill('unknown');
    await page.getByRole('searchbox').press('Enter');
    await page.getByText('Chưa có món phù hợp.').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('q'), 'unknown');
    assert.equal(docs, 0);
    await page.goto(webOrigin + '/admin/chefs/new');
    await page.getByLabel('Tên đầu bếp').fill('Browser test');
    await page.getByRole('button', { name: 'Thêm đầu bếp', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Tên đầu bếp').inputValue(), 'Browser test');
    await page.getByLabel('Chuyên môn').fill('Âu');
    docs = 0;
    await page.getByRole('button', { name: 'Thêm đầu bếp', exact: true }).click();
    await page.locator('.notice.success').waitFor();
    assert.equal(docs, 0);
    await page.reload();
    assert.equal(store.rows.chefs.filter(c => c.name === 'Browser test').length, 1);
    const id = store.rows.chefs.at(-1)!.id;
    await page.goto(`${webOrigin}/admin/chefs/${id}/delete`);
    await page.getByRole('button', { name: 'Xác nhận xóa' }).waitFor();
    assert.ok(store.rows.chefs.some(c => c.id === id));
    docs = 0;
    await page.getByRole('button', { name: 'Xác nhận xóa' }).click();
    await page.locator('.notice.success').waitFor();
    assert.equal(docs, 0);
    assert.ok(!store.rows.chefs.some(c => c.id === id));
    await page.goto(webOrigin + '/admin/ingredients/1/delete');
    await page.getByRole('heading', { name: 'Chưa thể xóa nguyên liệu' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Xác nhận xóa' }).count(), 0);
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const route of ['/dishes', '/dishes/1', '/admin/dishes', '/admin/dishes/new', '/admin/dishes/1/edit', '/admin/dishes/1/delete', '/dishes/999']) {
            await page.goto(webOrigin + route);
            await page.waitForTimeout(150);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflows');
        }
        await page.screenshot({ path: `artifacts/page-${width}.png`, fullPage: true });
    }
    for (const [resource, extra] of [['ingredients',{unit:'kg'}],['dishes',{description:'Mô tả thử',price:'123456.78',category:'Thử'}]] as const) {
      await page.goto(webOrigin+'/admin/'+resource+'/new');
      await page.locator('#name').fill('<script>Browser</script>');
      for(const [key,value] of Object.entries(extra)) await page.locator('#'+key).fill(value);
      docs=0;await page.locator('form button[type=submit], form .form-actions button').click();await page.locator('.notice.success').waitFor();assert.equal(docs,0);
      const row=store.rows[resource].at(-1)!;
      await page.goto(webOrigin+'/admin/'+resource+'/'+row.id+'/edit');await page.locator('#name').fill('Đã sửa');await page.locator('form .form-actions button').click();await page.locator('.notice.success').waitFor();assert.equal(store.rows[resource].at(-1)!.name,'Đã sửa');
      await page.goto(webOrigin+'/admin/'+resource+'/'+row.id+'/delete');await page.getByRole('button',{name:'Xác nhận xóa'}).click();await page.locator('.notice.success').waitFor();
    }
    // Missing records return to their own list, including direct URLs and reloads.
    for (const [route, heading, back] of [
      ['/dishes/99', 'Không tìm thấy món ăn', '/dishes'],
      ['/admin/dishes/99/edit', 'Không tìm thấy món ăn', '/admin/dishes'],
      ['/admin/ingredients/99/edit', 'Không tìm thấy nguyên liệu', '/admin/ingredients'],
      ['/admin/ingredients/99/delete', 'Không tìm thấy nguyên liệu', '/admin/ingredients'],
      ['/admin/chefs/99/edit', 'Không tìm thấy đầu bếp', '/admin/chefs'],
      ['/missing-page', 'Trang này không còn ở đây.', '/dishes'],
    ]) {
      await page.goto(webOrigin + route);
      await page.getByRole('heading', {name: heading, exact: true}).waitFor();
      await page.reload();
      await page.getByRole('heading', {name: heading, exact: true}).waitFor();
      await page.locator('.status-actions a').click();
      assert.equal(new URL(page.url()).pathname, back);
    }
    await page.goto(webOrigin + '/admin/ingredients');
    await page.getByRole('searchbox', {name: 'Tìm nguyên liệu'}).fill('hanh tay');
    await page.getByRole('searchbox').press('Enter');
    await page.getByRole('rowheader').filter({hasText:'Hành tây'}).waitFor();
    await page.getByRole('searchbox').fill('không có');
    await page.getByRole('searchbox').press('Enter');
    await page.getByRole('heading', {name: 'Chưa có kết quả phù hợp.'}).waitFor();
    await page.getByRole('button', {name:'Xóa tất cả',exact:true}).click();
    await page.getByRole('rowheader').filter({hasText:'Hành tây'}).waitFor();
    // A client-side transition between edit IDs must never initialize the new form with old data.
    store.rows.dishes.push({...store.rows.dishes[0], id: 88, name:'Món thứ hai'});
    await page.goto(webOrigin + '/admin/dishes/1/edit');
    await page.getByLabel('Tên món ăn').waitFor();
    await page.route('**/api/dishes/88', async route => { await new Promise(r => setTimeout(r, 250)); await route.continue(); });
    await page.evaluate(() => {
      history.pushState({}, '', '/admin/dishes/88/edit');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.getByLabel('Tên món ăn').waitFor();
    await page.waitForFunction(() => (document.querySelector('#name') as HTMLInputElement)?.value === 'Món thứ hai');
    await page.unroute('**/api/dishes/88');
    assert.equal(await page.getByLabel('Tên món ăn').inputValue(), 'Món thứ hai');
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height:900});
      for (const [name, route] of [['missing-dish','/dishes/99'], ['ingredients','/admin/ingredients'], ['detail','/dishes/1'], ['form','/admin/dishes/1/edit'], ['missing-ingredient','/admin/ingredients/99/edit']]) {
        await page.goto(webOrigin + route);
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' overflows');
        await page.screenshot({path: 'artifacts/' + name + '-' + width + '.png', fullPage:true});
      }
    }
    // Late mutation responses must not redirect away from the page selected by the user.
    for (const operation of ['create', 'delete']) {
      let release!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; });
      const target = `http://localhost:${address.port}/api/chefs${operation==='delete'?'/44':''}`;
      store.rows.chefs.push({id:44,name:'Late mutation',specialty:'Việt'});
      await page.goto(webOrigin + (operation==='create'?'/admin/chefs/new':'/admin/chefs/44/delete'));
      await page.route(target,async route=>{
        if (['GET','OPTIONS'].includes(route.request().method())) { await route.continue(); return; }
        await held;
        await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':webOrigin},body:JSON.stringify({ok:true,data:operation==='delete'?null:{id:44,name:'Late mutation',specialty:'Việt',dishes:[]}})});
      });
      if(operation==='create') {await page.getByLabel('Tên đầu bếp').fill('Late mutation');await page.getByLabel('Chuyên môn').fill('Việt');}
      const pending=page.waitForRequest(request=>request.url()===target&&request.method()===(operation==='delete'?'DELETE':'POST'));
      await page.getByRole('button',{name:operation==='delete'?'Xác nhận xóa':'Thêm đầu bếp',exact:true}).click();
      await pending;
      await page.locator('.main-nav').getByRole('link',{name:'Thực đơn',exact:true}).click();
      await page.getByRole('heading',{name:'Thực đơn của chúng tôi.'}).waitFor();
      const response=page.waitForResponse(res=>res.url()===target&&res.request().method()!=='OPTIONS');
      release();await response;await page.waitForTimeout(150);
      assert.equal(new URL(page.url()).pathname,'/dishes');
      await page.unroute(target);
      store.rows.chefs=store.rows.chefs.filter(c=>c.id!==44);
    }
    for(const body of [
      {ok:true,data:{id:1,name:'Wrong list shape'}},
      {ok:false,error:{code:'VALIDATION_FAILED',message:{invalid:true}}},
      {ok:false,error:{code:'VALIDATION_FAILED',message:'Invalid',fields:{form:{invalid:true}}}},
    ]) {
      await page.route(`http://localhost:${address.port}/api/**`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}));
      await page.goto(webOrigin+'/dishes');
      await page.getByRole('heading',{name:'Chưa thể tải thông tin.'}).waitFor();
      await page.unroute(`http://localhost:${address.port}/api/**`);
    }
    await page.route(`http://localhost:${address.port}/api/**`,route=>route.fulfill({status:500,body:'unavailable'}));await page.goto(webOrigin+'/dishes');await page.getByRole('heading',{name:'Chưa thể tải thông tin.'}).waitFor();await page.unroute(`http://localhost:${address.port}/api/**`);
    await page.route(`http://localhost:${address.port}/api/**`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto(webOrigin + '/dishes');
    await page.getByRole('heading', { name: 'Chưa thể tải thông tin.' }).waitFor();
    await page.unroute(`http://localhost:${address.port}/api/**`);
    for(const method of ['POST','PATCH']) {
      assert.ok(requests.some(r=>r.method===method&&r.type==='application/json'));
    }
    assert.ok(requests.some(r=>r.method==='OPTIONS'),'writes still preflight');
    assert.ok(requests.some(r=>r.method==='DELETE'&&r.type===undefined));
    // Large chef associations stay compact; full lists are searchable and bounded.
    const savedRows=structuredClone(store.rows);
    store.rows.chefs=[{id:901,name:'Đầu bếp nhiều món',specialty:'Ẩm thực Việt'},{id:902,name:'Đầu bếp một món',specialty:'Món Việt'},{id:903,name:'Đầu bếp hai món',specialty:'Món Việt'},{id:904,name:'Đầu bếp mới',specialty:'Món Việt'}];
    store.rows.dishes=Array.from({length:120},(_,index)=>({id:1000+index,name:'Món gà · biến thể '+(index+1),price:'100000',category:'Món Việt',available:true,chefs:[{id:901,name:'Đầu bếp nhiều món'},...(index===0?[{id:902,name:'Đầu bếp một món'}]:[]),...(index<2?[{id:903,name:'Đầu bếp hai món'}]:[])],ingredients:[]}));
    store.rows.ingredients=[{id:905,name:'Nguyên liệu nhiều món',unit:'g'}];
    store.rows.dishes=store.rows.dishes.map(dish=>({...dish,description:'Món ăn thử nghiệm cho danh sách nhiều liên kết.',ingredients:[{id:905,name:'Nguyên liệu nhiều món'}]}));
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      let releaseList!:()=>void;
      const listGate=new Promise<void>(resolve=>{releaseList=resolve;});
      await page.route('**/api/chefs?**',async route=>{await listGate;await route.continue();});
      await page.goto(webOrigin+'/admin/chefs');
      await page.locator('.list-placeholder-table .skeleton-line').first().waitFor();
      assert.notEqual(await page.locator('.list-placeholder .skeleton-line').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('.loading-ring').count(),0);
      await page.screenshot({path:'artifacts/chefs-skeleton-'+width+'.png',fullPage:true});
      releaseList();
      const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Đầu bếp nhiều món #901'})});
      await row.waitFor();
      await page.unroute('**/api/chefs?**');
      assert.equal(await row.locator('.chef-dishes-preview a').count(),2);
      assert.ok((await row.boundingBox())!.height < (width===390?420:220),'collapsed chef row stays compact');
      assert.equal(await page.getByRole('row').filter({hasText:'Đầu bếp một món'}).locator('.chef-dishes-preview a').count(),1);
      assert.equal(await page.getByRole('row').filter({hasText:'Đầu bếp hai món'}).locator('.chef-dishes-preview a').count(),2);
      await page.screenshot({path:'artifacts/chefs-compact-'+width+'.png',fullPage:true});
      await row.getByRole('button',{name:'Xem tất cả món ăn của Đầu bếp nhiều món'}).click();
      const region=row.getByRole('region',{name:'Món ăn của Đầu bếp nhiều món'});
      assert.equal(await region.getByRole('link').count(),120);
      assert.ok((await region.boundingBox())!.height<=221);
      assert.ok(await region.evaluate(el=>el.scrollHeight>el.clientHeight));
      const findDish=row.getByRole('searchbox',{name:'Tìm món của Đầu bếp nhiều món'});
      await findDish.fill('bien the 119');
      assert.equal(await region.getByRole('link').count(),1);
      assert.equal(await region.getByRole('link').getAttribute('href'),'/admin/dishes/1118/edit');
      await page.screenshot({path:'artifacts/chefs-expanded-'+width+'.png',fullPage:true});
      await findDish.fill('không tồn tại');
      await region.getByText('Không có món phù hợp. Thử tên khác.').waitFor();
      await row.getByRole('button',{name:'Thu gọn món ăn của Đầu bếp nhiều món'}).click();
      assert.equal(await region.count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    let releaseEditor!:()=>void;
    const editorGate=new Promise<void>(resolve=>{releaseEditor=resolve;});
    await page.route('**/api/chefs/901',async route=>{await editorGate;await route.continue();});
    await page.goto(webOrigin+'/admin/chefs/901/edit');
    await page.locator('.loading-view .skeleton-input').first().waitFor();
    await page.screenshot({path:'artifacts/chef-editor-skeleton.png',fullPage:true});
    releaseEditor();
    await page.getByLabel('Tên đầu bếp').waitFor();
    await page.unroute('**/api/chefs/901');
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(webOrigin+'/admin/ingredients');
      const ingredientRow=page.getByRole('row').filter({hasText:'Nguyên liệu nhiều món'});
      await ingredientRow.waitFor();
      assert.equal(await ingredientRow.locator('.chef-dishes-preview a').count(),2);
      await page.screenshot({path:'artifacts/ingredients-compact-'+width+'.png',fullPage:true});
      await ingredientRow.getByRole('button',{name:'Xem tất cả món ăn dùng Nguyên liệu nhiều món'}).click();
      const ingredientRegion=ingredientRow.getByRole('region',{name:'Món ăn dùng Nguyên liệu nhiều món'});
      assert.equal(await ingredientRegion.getByRole('link').count(),120);
      assert.ok((await ingredientRegion.boundingBox())!.height<=221);
      await ingredientRow.getByRole('searchbox').fill('bien the 119');
      assert.equal(await ingredientRegion.getByRole('link').count(),1);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      let releaseMenu!:()=>void;
      const menuGate=new Promise<void>(resolve=>{releaseMenu=resolve;});
      await page.route('**/api/dishes?**',async route=>{await menuGate;await route.continue();});
      await page.goto(webOrigin+'/dishes');
      await page.locator('.menu-skeleton .book-skeleton-entry').first().waitFor();
      assert.equal(await page.locator('.menu-skeleton .book-skeleton-entry').count(),6);
      await page.locator('.menu-skeleton').screenshot({path:'artifacts/menu-skeleton-'+width+'.png'});
      releaseMenu();
      await page.locator('.book-content .dish-card').first().waitFor();
      await page.unroute('**/api/dishes?**');
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(webOrigin+'/dishes');
    await page.locator('.book-content .dish-card').first().waitFor();
    let releaseJump!:()=>void;
    const jumpGate=new Promise<void>(resolve=>{releaseJump=resolve;});
    const requestedPages:string[]=[];
    await page.route('**/api/dishes?**',async route=>{
      requestedPages.push(new URL(route.request().url()).searchParams.get('page')!);
      await jumpGate;await route.continue();
    });
    await page.getByRole('link',{name:'Trang 20',exact:true}).evaluate(el=>{(el as HTMLElement).click();(el as HTMLElement).click();});
    await page.locator('.menu-book .book-skeleton-entry').first().waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 20',exact:true}).getAttribute('aria-current'),'page','selected page updates before the response');
    assert.equal(await page.getByRole('link',{name:'Trang 1',exact:true}).getAttribute('aria-current'),null);
    await page.getByText('Đang tải trang 20…',{exact:true}).waitFor();
    await page.setViewportSize({width:390,height:1000});
    assert.equal(await page.locator('.book-page-mobile').innerText(),'Trang 20/20');
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.menu-book').screenshot({path:'artifacts/menu-page-loading.png'});
    releaseJump();
    const jump=page.locator('.book-turn[data-distance="19"]');
    await jump.waitFor();
    await page.getByRole('link',{name:'Trang 1',exact:true}).evaluate(el=>(el as HTMLElement).click());
    assert.equal(new URL(page.url()).searchParams.get('page'),'20','navigation remains locked during the turn');
    assert.equal(await jump.evaluate(el=>getComputedStyle(el).animationDuration),'0.845s');
    await page.locator('.book-content .book-leaf').first().getByRole('heading',{name:'Món gà · biến thể 1',exact:true}).waitFor();
    await page.locator('.book-content .book-leaf').last().getByRole('heading',{name:'Món gà · biến thể 120',exact:true}).waitFor();
    await page.locator('.book-binding').screenshot({path:'artifacts/menu-distant-turn.png'});
    await page.waitForFunction(()=>!document.querySelector('.book-turn'));
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 115',exact:true}).waitFor();
    assert.deepEqual(requestedPages,['20'],'distant jumps request only the destination, once');
    await page.unroute('**/api/dishes?**');
    await page.getByRole('link',{name:'Trang 1',exact:true}).click();
    await page.locator('.book-turn.turn-back[data-distance="19"]').waitFor();
    await page.waitForFunction(()=>!document.querySelector('.book-turn'));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('link',{name:'Trang 20',exact:true}).click();
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 115',exact:true}).waitFor();
    assert.equal(await page.locator('.book-turn').count(),0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Pending selection follows URL history; failed requests restore the loaded page.
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(webOrigin+'/dishes');
    await page.locator('.book-content .dish-card').first().waitFor();
    let releaseHistory!:()=>void;
    const historyGate=new Promise<void>(resolve=>{releaseHistory=resolve;});
    await page.route('**/api/dishes?**',async route=>{
      if(new URL(route.request().url()).searchParams.get('page')!=='20') { await route.continue(); return; }
      const response=await route.fetch();await historyGate;
      try { await route.fulfill({response}); } catch { /* Back can abort a pending request. */ }
    });
    await page.getByRole('link',{name:'Trang 20',exact:true}).click();
    await page.getByText('Đang tải trang 20…',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 20',exact:true}).getAttribute('aria-current'),'page');
    await page.goBack();
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 1',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 1',exact:true}).getAttribute('aria-current'),'page');
    await page.goForward();
    await page.getByText('Đang tải trang 20…',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 20',exact:true}).getAttribute('aria-current'),'page');
    releaseHistory();
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 115',exact:true}).waitFor();
    await page.unroute('**/api/dishes?**');
    let releaseFailure!:()=>void;
    const failureGate=new Promise<void>(resolve=>{releaseFailure=resolve;});
    let failPage=true;
    await page.route('**/api/dishes?**',async route=>{
      if(failPage && new URL(route.request().url()).searchParams.get('page')==='19') {
        await failureGate;
        await route.fulfill({status:500,headers:{'Access-Control-Allow-Origin':webOrigin},body:'unavailable'});
      } else await route.continue();
    });
    await page.getByRole('link',{name:'Trang 19',exact:true}).click();
    await page.getByText('Đang tải trang 19…',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 19',exact:true}).getAttribute('aria-current'),'page');
    assert.equal(await page.getByRole('link',{name:'Trang 17',exact:true}).count(),1,'page window follows the pending selection');
    releaseFailure();
    await page.locator('.notice.error').waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 20',exact:true}).getAttribute('aria-current'),'page','failure restores the loaded page');
    assert.equal(new URL(page.url()).searchParams.get('page'),'19','retry keeps the failed destination');
    failPage=false;
    await page.getByRole('button',{name:'Thử lại',exact:true}).click();
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 109',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 19',exact:true}).getAttribute('aria-current'),'page');
    await page.unroute('**/api/dishes?**');
    store.rows.dishes=store.rows.dishes.slice(0,12);
    await page.getByRole('link',{name:'Trang 20',exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get('page')==='2');
    await page.locator('.book-content').getByRole('heading',{name:'Món gà · biến thể 7',exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Trang 2',exact:true}).getAttribute('aria-current'),'page','server-clamped page owns the final selection');
    await page.emulateMedia({reducedMotion:'no-preference'});
    store.rows=savedRows;
    await new Promise<void>(r => server.close(() => r()));
    await page.goto(webOrigin + '/dishes');
    await page.getByRole('heading', { name: 'Chưa thể tải thông tin.' }).waitFor();
    assert.ok(batches.length>0);
    assert.ok(batches.every(batch=>batch.count<=6),'all network list batches are bounded to six');
    await import('node:fs/promises').then(fs=>fs.writeFile('artifacts/network-batches.json',JSON.stringify(batches,null,2)));
    assert.deepEqual(errors, []);
    console.log('Browser PASS: three pagination UIs, bounded network batches, filter/sort/reload, query races, selected relations, retry, keyboard, book/reduced motion, CRUD, mobile, malformed response and API offline.');
}
finally {
    await browser?.close();
    if (web.pid)
        web.kill('SIGTERM');
    server.close();
}
