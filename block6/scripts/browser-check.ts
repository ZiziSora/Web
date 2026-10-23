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
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(webOrigin + '/dishes');
    await page.getByRole('heading', { name: 'Bò lúc lắc', exact: true }).waitFor();
    await mkdir('artifacts', { recursive: true });
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
          const selector = path === '/dishes' ? '.dish-card' : '.resource-table tbody tr';
          assert.equal(await page.locator(selector).count(), Math.min(count,6));
          assert.equal(await page.getByRole('navigation',{name:'Phân trang'}).count(), count>6?1:0);
          if (count>6) {
            await page.getByRole('link',{name:'Sau',exact:true}).focus();
            await page.keyboard.press('Enter');
            await page.locator(selector).filter({hasText:'Mục 7'}).first().waitFor();
            assert.equal(new URL(page.url()).searchParams.get('page'),'2');
            assert.equal(await page.locator(selector).count(),Math.min(count-6,6));
            assert.ok(await page.locator(selector).first().innerText().then(x=>x.includes('Mục 7')));
            assert.equal(await page.locator('h1:focus, h2:focus').count(),1);
            if(path==='/dishes') assert.equal(await page.locator('.dish-number').first().innerText(),'07');
            await page.reload();
            await page.locator(selector).first().waitFor();
            assert.ok((await page.locator(selector).first().innerText()).includes('Mục 7'));
            await page.getByRole('link',{name:'Trước',exact:true}).click();
            assert.equal(new URL(page.url()).searchParams.get('page'),null);
            await page.goBack();
            await page.waitForURL('**page=2');
            await page.goForward();
            await page.waitForURL(url=>!url.searchParams.has('page'));
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
        if(path==='/dishes') await page.getByRole('button',{name:'Tìm món'}).click();
        await page.waitForURL(url=>!url.searchParams.has('page') && url.searchParams.get('q')==='Mục 13');
        await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
        assert.equal(await page.getByRole('navigation',{name:'Phân trang'}).count(),0);
        await page.reload();
        await page.getByText('Hiển thị 1–1 trên 1 mục').waitFor();
        await page.screenshot({path:'artifacts/pagination-'+path.replaceAll('/','-')+'-'+width+'.png',fullPage:true});
      }
    }
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
    await page.getByRole('button', { name: 'Tìm món' }).click();
    await page.getByText('Chưa tìm thấy món bạn muốn.').waitFor();
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
    await page.getByRole('rowheader').filter({hasText:'Hành tây'}).waitFor();
    await page.getByRole('searchbox').fill('không có');
    await page.getByRole('heading', {name: 'Chưa có kết quả phù hợp.'}).waitFor();
    await page.getByRole('button', {name:'Xóa bộ lọc'}).click();
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
    await new Promise<void>(r => server.close(() => r()));
    await page.goto(webOrigin + '/dishes');
    await page.getByRole('heading', { name: 'Chưa thể tải thông tin.' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Browser PASS: CORS, CSR navigation, validation, CRUD, direct URLs, mobile, malformed response, API offline.');
}
finally {
    await browser?.close();
    if (web.pid)
        web.kill('SIGTERM');
    server.close();
}
