import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:1000},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage();await page.goto('http://127.0.0.1:5176/');await page.locator('#start').click();
 await page.evaluate(async()=>{
  const {createState}=await import('/src/engine.ts'),{treasure}=await import('/src/data.ts');
  const state=createState(812);state.settings.short=true;
  for(const id of ['B001','B007','B100','R004','R025','R094','G007','G098','G093']){
   const t=treasure(id);state.discoveredTreasures[id]={count:1,best:t.baseValueFN,first:'2026-11-15T00:00:00Z',locations:[t.locations[0]],tools:['hand']};
  }
  Object.assign(window.__finders.getState(),state);window.__finders.refresh();
 });
 await page.locator('[data-panel="collection"]').click();await page.locator('#book-status').selectOption('found');
 for(const id of ['B100','R094','G093']){
  await page.locator('#book-field').selectOption(id[0]);assert.equal(await page.locator('#book-list .book-entry').count(),3);
  const image=page.locator('#book-list img[data-treasure-fallback="'+id+'"]');await image.evaluate(i=>i.decode());assert.equal(await image.count(),1);
  await page.locator('[data-book-detail="'+id+'"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/treasure-art-final/book-'+id+'.png'});
 }
 await context.close();console.log('Representative collection captures: B100 R094 G093');
}finally{await browser.close();}
