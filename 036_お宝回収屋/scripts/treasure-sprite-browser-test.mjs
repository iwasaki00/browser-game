import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const output=process.env.SPRITE_ART_OUTPUT??'docs';
const results=[],base=process.env.BASE_URL??'http://localhost:5176/';
for(const channel of ['chrome','msedge']){
 const browser=await chromium.launch({channel,headless:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<500,isMobile:width<500});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.locator('#start').click();
   const atlas=await page.evaluate(async()=>{
    const {treasureSpriteMap,SHEET_NAMES}=await import('/src/treasure-sprite-map.ts');
    const {sheetURLs}=await import('/src/treasure-assets.ts');
    const {treasureShape}=await import('/src/reveal.ts');
    const stage=document.createElement('div');stage.id='sprite-test-stage';
    stage.style.cssText='position:fixed;inset:0;z-index:999;background:#f0efe4;overflow:auto;padding:20px;display:grid;grid-template-columns:repeat(auto-fill,80px);gap:12px;align-content:start';
    document.body.append(stage);let occupied=0,blank=0;
    for(const name of SHEET_NAMES){
     const img=new Image();img.src=sheetURLs[name];await img.decode();
     if(img.naturalWidth!==256||img.naturalHeight!==160)throw Error('sheet dimensions');
     const c=document.createElement('canvas');c.width=256;c.height=160;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
     const all=Object.values(treasureSpriteMap).filter(e=>e.sheet===name);
     for(let i=0;i<40;i++){
      const col=i%8,row=Math.floor(i/8),entry=all.find(e=>e.col===col&&e.row===row);
      const rgba=ctx.getImageData(col*32,row*32,32,32).data;
      const pixels=rgba.filter((_,j)=>j%4===3&&rgba[j]>0).length;
      if(entry?.available){if(pixels<20)throw Error('empty prototype '+entry.treasureId);occupied++;
       const holder=document.createElement('div');holder.innerHTML=treasureShape(entry.treasureId)+'<small style="display:block">'+entry.treasureId+'</small>';stage.append(holder);
      }else{if(pixels!==0)throw Error('unexpected painted cell '+name+':'+i);blank++;}
     }
    }
    await Promise.all([...stage.querySelectorAll('img')].map(img=>img.decode()));
    for(const wrapper of stage.querySelectorAll('.treasure-sprite')){
     const bounds=wrapper.getBoundingClientRect(),img=wrapper.querySelector('img'),v=wrapper.parentElement;
     if(bounds.width!==32||bounds.height!==32||getComputedStyle(wrapper).overflow!=='hidden')throw Error('crop size');
     if(img.getBoundingClientRect().width!==256)throw Error('atlas resized by legacy CSS');
     if(v.getBoundingClientRect().width!==32)throw Error('rarity changed size');
    }
    return {occupied,blank,rendered:stage.querySelectorAll('.treasure-sprite').length};
   });
   assert.deepEqual(atlas,{occupied:114,blank:246,rendered:114});
   if(channel==='chrome'&&width===390)await page.screenshot({path:output+'/treasure-sprites-prototypes.png'});
   await page.evaluate(()=>document.querySelector('#sprite-test-stage').remove());
   await page.evaluate(async()=>{
    const {createState}=await import('/src/engine.ts'),{treasures}=await import('/src/data.ts');
    const s=createState(732);for(const t of treasures)s.discoveredTreasures[t.id]={count:1,best:t.baseValueFN,first:'2026-11-13T00:00:00Z',locations:[t.locations[0]],tools:['hand']};
    Object.assign(window.__finders.getState(),s);window.__finders.refresh();
   });
   await page.locator('[data-panel="collection"]').click();
   assert.ok(await page.locator('#book-list .treasure-sprite').count()>0);
   await page.locator('[data-book-detail="B001"]').click();
   await page.locator('#book-detail img').evaluate(img=>img.decode());
   assert.equal(await page.locator('#book-detail .treasure-visual').evaluate(e=>e.getBoundingClientRect().width),64);
   await page.locator('#book-field').selectOption('R');
   await page.locator('[data-book-detail="R009"]').click();assert.equal(await page.locator('#book-detail .treasure-sprite').count(),1);
   await page.locator('#book-field').selectOption('G');
   await page.locator('[data-book-detail="G001"]').click();assert.equal(await page.locator('#book-detail .treasure-sprite').count(),1);
   if(channel==='chrome'&&width===390)await page.screenshot({path:output+'/treasure-sprites-book.png'});
   await page.locator('#close').click();
   await page.evaluate(async()=>{
    const {createState}=await import('/src/engine.ts'),s=createState(733);
    s.explorationAreas[0].items=['B001','R004','G003','B008'].map((id,i)=>({uid:'sprite-wash-'+i,id,x:40+i*60,y:180,depth:80,initialQuality:.9,quality:.9,qualityFinalized:true,state:'stored',tool:'hand'}));
    Object.assign(window.__finders.getState(),s);window.__finders.refresh();
   });
   const washes=[];
   for(const [i,id] of ['B001','R004','G003','B008'].entries()){
    if(i===0)await page.locator('#wash').click();
    const visual=page.locator('.wash-card .treasure-visual');
    assert.equal(await visual.getAttribute('data-treasure-id'),id);
    if(i<3)assert.equal(await visual.locator('.treasure-sprite').count(),1);
    else assert.equal(await visual.locator('svg').count(),1);
    const artBefore=await visual.innerHTML();
    assert.equal(await page.locator('.dirt-layer').evaluate(e=>+getComputedStyle(e).opacity),1);
    const frame=await page.locator('.wash-display').boundingBox();
    if(i===0){await page.locator('#clean').click();await page.locator('#next-find').waitFor({state:'visible'});}
    else await page.locator('#skip-clean').click();
    assert.equal(await visual.innerHTML(),artBefore,'washing reuses the same sprite');
    assert.equal(await page.locator('.dirt-layer').evaluate(e=>+getComputedStyle(e).opacity),0);
    assert.deepEqual(await page.locator('.wash-display').boundingBox(),frame);
    const fn=await page.evaluate(()=>window.__finders.getState().currentFN);
    await page.locator('#clean').dispatchEvent('click');assert.equal(await page.evaluate(()=>window.__finders.getState().currentFN),fn);
    washes.push({id,fn,art:i<3?'sprite':'SVG'});
    if(i===2&&channel==='chrome'&&width===390)await page.screenshot({path:output+'/treasure-sprites-washed.png'});
    if(i<3)await page.locator('#next-find').click();
   }
   await page.locator('#skip-clean').click();
   await page.locator('[data-panel="collection"]').click();
   assert.ok(await page.locator('.treasure-unfound').count()>0);assert.equal(await page.locator('.treasure-unfound[data-rarity]').count(),0);
   await page.locator('#close').click();
   assert.ok(await page.evaluate(()=>window.__finders.save()));await page.reload();await page.locator('#start').click();
   assert.equal(await page.evaluate(()=>Object.keys(window.__finders.getState().discoveredTreasures).length),4);
   assert.deepEqual(errors,[]);results.push({channel,width,atlas,washes,collection:true,details:true,unknownSilhouette:true,saveReload:true,errors});
   await context.close();
  }
  // Both transport failures and wrong-sized replacement images must fall back.
  for(const failure of ['network','dimensions']){
   const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const tiny=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1;return c.toDataURL('image/png').split(',')[1];});
   await page.route('**/beach_daily_sheet.png*',route=>route.request().resourceType()!=='image'?route.continue():failure==='network'?route.abort():route.fulfill({contentType:'image/png',body:Buffer.from(tiny,'base64')}));
   await page.goto(base);await page.locator('#start').click();
   await page.evaluate(async()=>{
    const {treasureShape}=await import('/src/reveal.ts');
    const stage=document.createElement('div');stage.id='failure-stage';stage.innerHTML=treasureShape('B001')+treasureShape('B002')+treasureShape('R001');document.body.append(stage);
   });
   await page.waitForFunction(()=>document.querySelectorAll('#failure-stage svg').length===2);
   assert.equal(await page.locator('#failure-stage .treasure-sprite').count(),1);
   assert.ok(await page.evaluate(async()=>{const {treasureShape}=await import('/src/reveal.ts');return treasureShape('B004').includes('<svg');}));
   await page.evaluate(async()=>{const {spawn}=await import('/src/dev-actions.ts');spawn(window.__finders.getState(),'B001',{state:'stored'});window.__finders.refresh();});
   await page.locator('#wash').click();assert.equal(await page.locator('.wash-card svg').count(),1);await page.locator('#skip-clean').click();
   assert.ok(await page.evaluate(()=>window.__finders.getState().currentFN>0));assert.ok(await page.evaluate(()=>window.__finders.save()));assert.deepEqual(errors,[]);
   results.push({channel,failure,allAffectedFallback:true,futureFallback:true,otherSheetUnaffected:true,washRewardSave:true,errors});await context.close();
  }
 }finally{await browser.close();}
}
writeFileSync(output+'/treasure-sprite-browser-results.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({cases:results.length,pass:true}));
