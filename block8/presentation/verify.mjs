import { chromium } from '../node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, '.qa'); await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const issues = [];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();
  page.on('pageerror', error => issues.push(error.message));
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  await page.goto(url);
  assert.equal(await page.locator('.slide').count(), 21);
  assert.equal(await page.locator('#slide-picker option').count(), 21);
  for (let i=1; i<=21; i++) {
    await page.selectOption('#slide-picker', String(i-1));
    await page.waitForFunction(index=>document.querySelector('.slide.active')?.id===`slide-${index}`,i);
    const problems = await page.locator('.slide.active').evaluate(slide=>{
      const parent=slide.getBoundingClientRect(), footer=slide.querySelector('.footer').getBoundingClientRect();
      const scale=parent.width/1280;
      const bad=[];
      for(const el of slide.querySelectorAll('.body,h1,h2,.lead')) {
        const r=el.getBoundingClientRect();
        if(r.bottom>footer.top-6*scale || r.right>parent.right+1 || r.left<parent.left-1) bad.push(`bounds:${el.className||el.tagName}`);
        if(el.scrollHeight>el.clientHeight+3 || el.scrollWidth>el.clientWidth+3) bad.push(`overflow:${el.className||el.tagName}:${el.scrollHeight}/${el.clientHeight}`);
      }
      for(const img of slide.querySelectorAll('img')) if(!img.complete||img.naturalWidth===0) bad.push('image:'+img.getAttribute('src'));
      for(const el of slide.querySelectorAll('.body p,.body li,.body td,.body pre,.body h3')) {
        if(el.closest('.speaker-notes'))continue;
        const r=el.getBoundingClientRect();
        if(r.bottom>footer.top-5*scale) bad.push(`content:${el.tagName}:${el.textContent.slice(0,45)}`);
      }
      return bad;
    });
    issues.push(...problems.map(issue=>`Slide ${i}: ${issue}`));
    await page.locator('.slide.active').screenshot({ path: path.join(out, `slide-${String(i).padStart(2,'0')}.png`) });
    await page.click('#notes-toggle');
    assert.equal(await page.locator('#notes-drawer').isVisible(), true);
    assert.match(await page.locator('.notes-content').innerText(), /Lời trình bày/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#notes-drawer').isVisible(), false);
  }
  await page.goto(url+'#slide-13');
  assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-13');
  await page.locator('.slide.active h2').click(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-14');
  await page.click('#previous'); assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-13');
  await page.click('#appendix'); assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-17');
  await page.click('#appendix'); assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-1');
  await page.locator('.slide.active h1').click(); await page.keyboard.press('End'); assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-21');
  await page.keyboard.press('Home'); assert.equal(await page.locator('.slide.active').getAttribute('id'),'slide-1');
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.slide:visible').count(),21);
  assert.equal(await page.locator('.nav').isVisible(),false);
  await page.pdf({path:path.join(out,'print-preview.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:'screen'});
  await page.goto(pathToFileURL(path.join(root,'evidence.html')).href);
  assert.equal(await page.locator('tbody tr').count(),33);
  await page.fill('#filter','S05'); assert.equal(await page.locator('tbody tr:visible').count(),1);
  assert.match(await page.locator('tbody tr:visible').innerText(),/Restart/);
  await context.close();
  for(const viewport of [{width:1920,height:1080},{width:390,height:844}]) {
    const c=await browser.newContext({viewport}); const p=await c.newPage(); await p.goto(url+'#slide-14');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const box=await p.locator('.slide.active').boundingBox(); assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1);
    await p.screenshot({path:path.join(out,`viewport-${viewport.width}.png`)}); await c.close();
  }
  const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:1366,height:850}});
  const p=await noJs.newPage(); await p.goto(url); assert.equal(await p.locator('.slide:visible').count(),21); await noJs.close();
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({slides:21,evidenceCases:33,issues},null,2));
  if(issues.length) { console.error(issues.join('\n')); process.exitCode=1; }
  else console.log('PASS: 21 slide layouts, notes, keyboard/dropdown/hash, 33 evidence cases, print, mobile and no-JS.');
} finally { await browser.close(); }
