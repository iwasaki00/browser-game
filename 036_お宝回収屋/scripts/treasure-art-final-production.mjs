import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {createState} from '../src/engine.ts';
import {spawn} from '../src/dev-actions.ts';
import {migrate} from '../src/save.ts';
import {treasureSpriteMap,SHEET_NAMES} from '../src/treasure-sprite-map.ts';
const root=path.resolve('dist'),prefix='/browser-game/'+encodeURIComponent('036_お宝回収屋')+'/',results=[];
const server=createServer((req,res)=>{
 try{
  const pathname=new URL(req.url,'http://local').pathname;
  if(!pathname.startsWith(prefix))throw Error();
  const target=path.resolve(root,decodeURIComponent(pathname.slice(prefix.length))||'index.html');
  if(!target.startsWith(root+path.sep)||!statSync(target).isFile())throw Error();
  res.setHeader('Content-Type',target.endsWith('.png')?'image/png':target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(target));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const files=readdirSync(path.join(root,'assets'));
for(const name of SHEET_NAMES)assert.equal(files.filter(f=>f.startsWith(name+'-')&&f.endsWith('.png')).length,1);
const code=files.filter(f=>/\.(js|css)$/.test(f)).map(f=>readFileSync(path.join(root,'assets',f),'utf8')).join('\n');
for(const marker of ['__finders','lab-set-fn','lab-spawn','finders-debug-v1','DEBUG FN','AUTO-01','LINE-01','dev-actions'])assert.ok(!code.includes(marker),'debug marker '+marker);
const fixture=createState(734);for(const e of Object.values(treasureSpriteMap).filter(e=>e.available))fixture.discoveredTreasures[e.treasureId]={count:1,best:1,first:'2026-11-13T00:00:00Z',locations:[],tools:['hand']};
for(const id of ['B001','R004','G003'])spawn(fixture,id,{state:'stored'});
migrate(fixture); // Validate test data using the same rules as normal saves.
const url='http://127.0.0.1:'+server.address().port+prefix;
try{
 for(const channel of ['chrome','msedge'])for(const failure of [false,true]){
  const b=await chromium.launch({channel,headless:true});
  try{
   const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
   await c.addInitScript(s=>{if(!localStorage.getItem('finders-v1'))localStorage.setItem('finders-v1',JSON.stringify(s));},fixture);
   const p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
   if(failure)await p.route('**/beach_daily_sheet-*.png',r=>r.abort());
   await p.goto(url);await p.locator('#start').click();
   assert.equal(await p.evaluate(()=>typeof window.__finders),'undefined');
   await p.locator('#wash').click();
   if(failure)await p.waitForFunction(()=>!!document.querySelector('.wash-card .treasure-visual>svg'));
   else await p.locator('.wash-card img').evaluate(img=>img.decode());
   await p.locator('#skip-clean').click();assert.match(await p.locator('#reveal-reward').textContent(),/FN/);
   await p.locator('#next-find').click();await p.locator('#skip-clean').click();await p.locator('#next-find').click();await p.locator('#skip-clean').click();await p.locator('#skip-clean').click();
   await p.locator('[data-panel="collection"]').click();
   let renderedSprites=0,renderedFallbacks=0;
   for(const field of ['B','R','G']){
    await p.locator('#book-field').selectOption(field);await p.locator('#book-status').selectOption('found');
    do{
     renderedSprites+=await p.locator('#book-list .treasure-sprite').count();renderedFallbacks+=await p.locator('#book-list .treasure-visual>svg').count();
     await p.locator('#book-list img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
     for(const img of await p.locator('#book-list img').all())assert.equal(await img.evaluate(i=>i.naturalWidth),256);
     if(await p.locator('#book-next').isDisabled())break;
     await p.locator('#book-next').click();
    }while(true);
   }
   assert.equal(renderedSprites,failure?260:300);assert.equal(renderedFallbacks,failure?40:0);
   await p.locator('#close').click();await p.locator('#help').click();await p.locator('#lab-trigger').click({clickCount:5});assert.equal(await p.locator('#debug-lab').count(),0);await p.locator('#manual-save').click();
   await p.waitForFunction(()=>JSON.parse(localStorage.getItem('finders-v1')).currentFN>0);
   assert.ok(requests.every(r=>new URL(r).origin===new URL(url).origin&&new URL(r).pathname.startsWith(prefix)),'asset escaped deployment prefix');
   assert.equal(new Set(requests.filter(r=>r.includes('_sheet-')).map(r=>new URL(r).pathname)).size,9);
   assert.deepEqual(errors,[]);results.push({channel,simulatedMissingSheet:failure,sheetsRequested:9,relativePath:true,washReward:true,collection300:true,renderedSprites,renderedFallbacks,debugAbsent:true,save:true,errors});await c.close();
  }finally{await b.close();}
 }
 writeFileSync('docs/treasure-art-final/production-results.json',JSON.stringify(results,null,2)+'\n');console.log({cases:results.length,sheets:9,pass:true});
}finally{await new Promise(r=>server.close(r));}
