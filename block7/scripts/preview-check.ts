import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../api/src/app.js';
import {MemoryStore} from '../api/test/memory-store.js';
const port=41000+Math.floor(Math.random()*10000);const origin=`http://localhost:${port}`;
const server=createApp(new MemoryStore(),{origin}).listen(0,'localhost');await new Promise<void>(r=>server.once('listening',r));
const address=server.address();if(!address||typeof address==='string')throw new Error('No test API port');
const apiOrigin=`http://localhost:${address.port}`;
const web=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','localhost','--port',String(port),'--strictPort'],{cwd:resolve('web'),stdio:'pipe'});web.stdout.resume();web.stderr.resume();let browser;
try{for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({executablePath:process.env.CHROME_PATH??['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome'].find(existsSync),headless:true,args:['--no-sandbox']});const page=await browser.newPage();
// Redirect only API fetches to the isolated fixture; keep real browser CORS checks.
await page.addInitScript((apiOrigin)=>{
 const original=window.fetch.bind(window);
 window.fetch=(input,init)=>{
  if(typeof input==='string'){
   const url=new URL(input,location.href);
   if(url.pathname.startsWith('/api/'))input=apiOrigin+url.pathname+url.search;
  }
  return original(input,init);
 };
},apiOrigin);

for(const route of ['/dishes','/dishes/1','/admin/chefs','/admin/ingredients/new']){await page.goto(origin+route);await page.getByRole('heading').first().waitFor();await page.reload();await page.getByRole('heading').first().waitFor();}
await page.goto(origin+'/dishes');await page.getByRole('heading',{name:'Bò lúc lắc',exact:true}).waitFor();
assert.equal((await fetch(origin+'/assets/missing.js')).status,404);
const html=await readFile('web/dist/index.html','utf8');const asset=html.match(/src="([^"]+\.js)"/)![1];const bundle=await (await fetch(origin+asset)).text();assert.doesNotMatch(bundle,/DATABASE_URL|postgresql:\/\/|PrismaClient/);
console.log('Preview PASS: built SPA, history fallback, assets, API CORS, no backend secrets.');
}finally{await browser?.close();web.kill();server.close();}
