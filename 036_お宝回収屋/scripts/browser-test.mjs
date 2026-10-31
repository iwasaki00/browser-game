import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const [width,height]of [[320,568],[390,844],[1280,900]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,isMobile:width<500});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5176/');await page.locator('#start').click();await page.waitForTimeout(100);
 assert.ok(await page.locator('#beach').isVisible());const dims=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));assert.ok(dims.w<=width);assert.ok(dims.h<=height+1,JSON.stringify(dims));
 const box=await page.locator('#beach').boundingBox();
 // Real pointer gestures across the surface, then verify a persisted excavation mask.
 for(let n=0;n<3;n++){await page.mouse.move(box.x+20,box.y+box.height*42/325);await page.mouse.down();await page.mouse.move(box.x+box.width-20,box.y+box.height*42/325,{steps:60});await page.mouse.up();}
 await page.locator('#help').click();await page.locator('#manual-save').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('finders-dev-v1')).digs>0);const mask=await page.evaluate(()=>JSON.parse(localStorage.getItem('finders-dev-v1')).explorationAreas[0].mask);assert.ok(mask.some(n=>n>0));await page.locator('#close').click();
 // Seed a controlled progression using the same game engine and persistence module.
 const expected=await page.evaluate(async()=>{const e=await import('/src/engine.ts'),storage=await import('/src/save.ts');const s=e.createState(1234);s.currentFN=10000;s.collectedTreasures=Array.from({length:20},(_,i)=>'test:'+i);e.refresh(s);e.buy(s,'B101');e.buy(s,'B104');const p=e.plot(s);p.mask.fill(1);const f=p.items[0];e.recover(s,f.uid);e.reward(s,f.uid);Object.assign(window.__finders.getState(),s);window.__finders.refresh();await window.__finders.save();return {fn:s.currentFN,uid:f.uid};});
 await page.reload();await page.locator('#start').click();await page.waitForTimeout(100);assert.match(await page.locator('#money').textContent(),new RegExp(expected.fn.toLocaleString()));await page.locator('[data-panel="collection"]').click();assert.match(await page.locator('#sheet-body').textContent(),/錆びたボルト/);await page.locator('#close').click();
 await page.locator('[data-panel="shop"]').click();await page.locator('[data-buy="B102"]').click();assert.match(await page.locator('[data-buy="B102"]').textContent(),/購入済み/);await page.locator('#close').click();
 await page.locator('[data-panel="equipment"]').click();assert.match(await page.locator('#sheet-body').textContent(),/工程の処理能力/);await page.locator('#close').click();
 await page.locator('[data-panel="areas"]').click();await page.locator('#new-plot').click();assert.equal(await page.locator('#plot-label').textContent(),'BEACH / 02');
 await page.locator('#help').click();await page.locator('#dev').click();await page.locator('#dev-jackpot').click();await page.locator('#close').click();
 const beforeJackpot=await page.evaluate(()=>{const s=window.__finders.getState();s.explorationAreas[s.currentPlot].items.at(-1).state='stored';window.__finders.refresh();return s.currentFN;});
 await page.locator('#wash').click();await page.locator('#clean').click();assert.match(await page.locator('#sheet-title').textContent(),/JACKPOT/);assert.match(await page.locator('#sheet-body').textContent(),/18,000/);await page.locator('#next-find').click();assert.equal(await page.evaluate(()=>window.__finders.getState().currentFN),beforeJackpot+18000);
 await page.locator('#wash').click();assert.equal(await page.evaluate(()=>window.__finders.getState().currentFN),beforeJackpot+18000);
 const fallback=await page.evaluate(async()=>{const store=await import('/src/save.ts');await window.__finders.save();const open=indexedDB.open;try{indexedDB.open=()=>{throw Error('injected IDB unavailable');};const restored=await store.load();return restored.currentFN;}finally{indexedDB.open=open;}});assert.equal(fallback,beforeJackpot+18000);
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.locator('#beach').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();
 await page.screenshot({path:`docs/ui-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);results.push({width,height,layout:'PASS',pointerDig:'PASS',saveRestore:'PASS',shop:'PASS',collection:'PASS',equipment:'PASS',newPlot:'PASS',jackpotUI:'PASS',IDBFallback:'PASS',pointerCancel:'PASS',pageErrors:errors});await context.close();
}await writeFile('docs/ui-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}finally{await browser.close();}

// Exercise the actual reveal and jackpot settlement screens with one live item.
