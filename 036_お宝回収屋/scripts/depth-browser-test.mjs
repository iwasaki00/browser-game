import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.canvasLabels=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(window.canvasLabels.length>200)window.canvasLabels.shift();window.canvasLabels.push(String(text));return fill.call(this,text,...args);};});await page.goto('http://localhost:5176/');await page.locator('#start').click();
 await page.evaluate(async()=>{const e=await import('/src/engine.ts'),s=e.createState(123);s.ownedTools=['B101','B102','B104','B105','B201'];s.quickSlots=['hand','B101','B105','B201'];s.equippedTools=['B101','B105','B201'];s.explorationAreas[0].items=[{uid:'deep-proof',id:'B007',x:185,y:155,depth:245,quality:1,state:'buried',tool:'hand'}];Object.assign(window.__finders.getState(),s);window.__finders.refresh();window.__finders.select('hand');window.testOriginalRandom=Math.random;Math.random=()=>0;});
 const box=await page.locator('#beach').boundingBox(),screen=(x,y)=>({x:box.x+(180+(x-180)*(.8+.2*y/280))/360*box.width,y:box.y+(48+.88*y)/325*box.height});
 const results=[];let handSawCue=false;
 for(const [id,limit,name]of [['hand',80,'hand'],['B101',180,'small-shovel'],['B105',280,'large-shovel']]){
  const before=await page.evaluate(()=>[...window.__finders.getState().explorationAreas[0].mask]);await page.locator('#quick [data-slot="'+({hand:0,B101:1,B105:2}[id])+'"]').click();assert.deepEqual(await page.evaluate(()=>window.__finders.getState().explorationAreas[0].mask),before);
  for(let n=0;n<30;n++){const a=screen(174,155),b=screen(206,155);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.move(a.x,a.y,{steps:10});await page.mouse.up();const depth=await page.evaluate(()=>window.__finders.getState().explorationAreas[0].mask[15*36+18]*280);if(depth>=limit-1e-7)break;}
  const depth=await page.evaluate(()=>window.__finders.getState().explorationAreas[0].mask[15*36+18]*280);assert.ok(Math.abs(depth-limit)<1e-7);assert.equal(await page.evaluate(()=>window.__finders.getState().explorationAreas[0].items[0].state),'buried');
  if(id==='hand'){
   // A further swipe at the limit produces the quiet local cue under deterministic test RNG.
   const a=screen(183,155),b=screen(193,155);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();handSawCue=await page.locator('#hand-feedback').isVisible();assert.ok(handSawCue);assert.match(await page.locator('#hint').textContent(),/手応え/);assert.equal(await page.locator('#toast').evaluate(e=>e.classList.contains('visible')),false);
   const cdp=await context.newCDPSession(page),finger=screen(185,155);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:finger.x,y:finger.y}]});assert.ok(await page.locator('#touch-tool').isVisible());const tool=await page.locator('#touch-tool').boundingBox();assert.ok(tool.y+tool.height<finger.y);await page.screenshot({path:'docs/v041-touch-hand-cue.png',fullPage:true});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const cue=await page.locator('#hand-feedback').boundingBox();assert.ok(cue.y>screen(185,155).y);assert.ok(!/80|180|280/.test(await page.locator('#hint').textContent()));
  }
  await page.waitForTimeout(60);await page.screenshot({path:`docs/v041-depth-${name}.png`,fullPage:true});
  const pixel=await page.evaluate(async()=>{const {project}=await import('/src/surface.ts'),q=project(205,155);return Array.from(document.querySelector('#beach').getContext('2d').getImageData(Math.floor(q.x*2),Math.floor(q.y*2),1,1).data).slice(0,3);});
  results.push({id,depth,pixel});if(id==='hand'){await page.waitForTimeout(1600);assert.equal(await page.locator('#hand-feedback').isVisible(),false);assert.ok(!(await page.locator('#hint').textContent()).includes('手応え'));}
  await page.evaluate(()=>window.__finders.save());await page.reload();await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.__finders.getState().explorationAreas[0].mask[15*36+18]*280),depth);
  await page.evaluate(()=>{Math.random=()=>0;});
 }
 assert.ok(results[0].pixel.reduce((a,b)=>a+b,0)>results[1].pixel.reduce((a,b)=>a+b,0));assert.ok(results[1].pixel.reduce((a,b)=>a+b,0)>results[2].pixel.reduce((a,b)=>a+b,0));
 const p=screen(185,155);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__finders.getState().explorationAreas[0].items[0].state),'stored');await page.locator('#wash').click();await page.locator('#clean').click();await page.locator('#next-find').waitFor({state:'visible'});assert.match(await page.locator('#sheet-body').textContent(),/120 FN/);await page.locator('#next-find').click();
 assert.deepEqual(await page.evaluate(()=>window.canvasLabels.filter(s=>/^(80|180|280)$/.test(s))),[]);assert.ok(!/深さ\s*(80|180|280)/.test(await page.locator('main').textContent()));assert.deepEqual(errors,[]);const report={version:'0.4.1',viewport:[390,844],sameHoleStages:results,handCue:handSawCue,V05NoDepthLabels:'PASS',touchCueAndToolDoNotOverlap:'PASS',saveAfterEveryStage:'PASS',deepRecoveryAndWash:'PASS',errors};await writeFile('docs/depth-ui-results-v041.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
