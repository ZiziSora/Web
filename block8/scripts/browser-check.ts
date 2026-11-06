import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.js';
import { MemoryStore } from '../test/memory-store.js';
import { buildSeedDishes, sampleChefs, sampleIngredients } from '../prisma/seed.js';

const store = new MemoryStore();
store.rows.chefs = sampleChefs.map((row,index)=>({...row,id:index+1}));
store.rows.ingredients = sampleIngredients.map((row,index)=>({...row,id:index+1}));
store.rows.dishes = buildSeedDishes().slice(0,13).map((row,index)=>({
  ...row,id:index+1, chefs:[{id:1,name:sampleChefs[0].name}], ingredients:[{id:1,name:sampleIngredients[0].name}],
}));
const server = createApp(store).listen(0,'127.0.0.1');
await new Promise<void>(resolve=>server.once('listening',resolve));
const address=server.address();
if(!address || typeof address==='string') throw new Error('Không mở được server.');
const origin=`http://127.0.0.1:${address.port}`;
await mkdir('artifacts',{recursive:true});
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const javaScriptEnabled of [false,true]) for(const width of [1440,390]) {
    const context=await browser.newContext({javaScriptEnabled,viewport:{width,height:1000}});
    const page=await context.newPage();
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    let documents=0; page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()) documents++;});
    const suffix=`${width}-${javaScriptEnabled?'js':'nojs'}`;
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
    const child=spawn(process.execPath,['dist/src/server.js'],{env:{...process.env,DATABASE_URL:process.env.DATABASE_URL??'postgresql://localhost/table?schema=block8',PORT:'0'},stdio:'pipe'});
    child.stderr.resume();
    try {
      const port=await new Promise<string>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Production startup timeout')),15000);
        child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);reject(new Error('Production exit '+code));});
        child.stdout.on('data',(data:Buffer)=>{const match=data.toString().match(/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
      });
      const response=await fetch(`http://127.0.0.1:${port}/unknown`);assert.equal(response.status,404);assert.match(await response.text(),/Có lẽ bạn đã rẽ nhầm bàn/);
      for(const asset of ['styles.css','app.js','favicon.svg']) assert.equal((await fetch(`http://127.0.0.1:${port}/${asset}`)).status,200);
    } finally {child.kill('SIGTERM');await new Promise<void>(resolve=>child.once('close',()=>resolve()));}
  }
  console.log('PASS: SSR documents, navigation, CRUD, no-JS, picker, responsive, reduced motion and production assets.');
} finally {
  await browser?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
}
