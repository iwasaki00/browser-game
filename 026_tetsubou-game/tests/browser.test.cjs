'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {webkit,chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.tmp-chrome-test','026');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/026_tetsubou-game/`;
 for(const [name,engine,viewport,mobile] of [['iphone-landscape',webkit,{width:844,height:390},true],['iphone-small',webkit,{width:667,height:375},true],['iphone-portrait',webkit,{width:390,height:844},true],['desktop',chromium,{width:1280,height:800},false]]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
   await page.addInitScript(()=>{
    Object.defineProperty(window,'BarPhysics',{configurable:true,set(api){
     Object.defineProperty(window,'BarPhysics',{value:api,writable:true,configurable:true});
     const step=api.step;let peak=0,last=-1;
     api.step=function(s,dt){
      window.__testState=s;
      if(window.__testDrive){
       const g=api.geometry(s.pump),a=api.wrap(s.angle-Math.atan2(g.com.x,g.com.y)),toward=a*s.omega<0;
       let held=s.held;
       if(!held&&toward&&Math.abs(a)<Math.max(.1,s.amplitude*.4)&&s.elapsed-last>.25){held=true;peak=0;last=s.elapsed;}
       peak=Math.max(peak,Math.abs(s.omega));
       if(held&&!toward&&Math.abs(s.omega)<peak*.3&&s.elapsed-last>.25){held=false;last=s.elapsed;}
       if(held!==s.held)window.dispatchEvent(new KeyboardEvent(held?'keydown':'keyup',{code:'Space',bubbles:true}));
      }
      return step(s,dt);
     };
    }});
   });
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   await page.goto(url);await page.waitForTimeout(350);
   for(const id of ['pump','release','debug','difficulty','rankingOpen']){
    const box=await page.locator('#'+id).boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${name}: ${id} out of viewport`);assert(box.height>=44);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(mobile){
    const visualScale=await page.evaluate(()=>visualViewport.scale);
    await page.locator('#pump').tap();await page.locator('#pump').tap();
    assert.equal(await page.evaluate(()=>visualViewport.scale),visualScale);
    assert.equal(await page.evaluate(()=>getSelection().toString()),'');
    assert.equal(await page.locator('#pump').evaluate(el=>getComputedStyle(el).touchAction),'none');
   }
   await page.screenshot({path:path.join(out,name+'.png')});
   await page.locator('#pump').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',button:0});
   await page.waitForTimeout(180);assert.equal(await page.locator('#pump').getAttribute('aria-pressed'),'true');
   await page.screenshot({path:path.join(out,name+'-pump.png')});
   await page.locator('#pump').dispatchEvent('pointercancel',{pointerId:1,pointerType:'touch'});assert.equal(await page.locator('#pump').getAttribute('aria-pressed'),'false');
   if(mobile)await page.locator('#release').tap();else await page.keyboard.press('x');
   await page.locator('#result').waitFor({state:'visible'});
   const retryBox=await page.locator('#retry').boundingBox(),resultBox=await page.locator('#result').boundingBox();
   assert(retryBox.y+retryBox.height<=resultBox.y+resultBox.height+1,'Retry must be visible without scrolling');
   assert.equal(await page.locator('.points').isVisible(),true);
   await page.screenshot({path:path.join(out,name+'-result.png')});

   assert((await page.locator('#scoreBreakdown').textContent()).includes('EASY ×0.7'));
   assert((await page.locator('#recordNotice').textContent()).includes('NEW RECORD!'));
   await page.locator('#rankingOpen').click();
   assert.equal(await page.locator('#rankingList li').count(),1);
   assert((await page.locator('#personalBest').textContent()).includes('自己ベスト'));
   await page.screenshot({path:path.join(out,name+'-ranking.png')});
   await page.locator('#rankNormal').click();assert.equal(await page.locator('#rankingList li').count(),0);
   await page.locator('#rankEasy').click();assert.equal(await page.locator('#rankingList li').count(),1);
   await page.locator('#rankingClose').click();
   await page.locator('#difficulty').selectOption('normal');
   assert.equal(await page.locator('#guideLegend').isVisible(),false);
   await page.locator('#release').click();
   if(await page.locator('#release').isEnabled())await page.locator('#release').dispatchEvent('pointerdown',{pointerId:20,pointerType:'touch',button:0});
   await page.locator('#result').waitFor({state:'visible'});
   assert((await page.locator('#scoreBreakdown').textContent()).includes('NORMAL ×1.0'));
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.BarRanking.KEY)).entries);
   assert.equal(saved.length,2);for(const r of saved)for(const field of ['score','mode','airRotationCount','landingRank','playedAt'])assert(field in r);
   await page.locator('#retry').click();assert.equal(await page.locator('#result').isVisible(),false);assert.equal(await page.locator('#release').isEnabled(),true);

   await page.locator('#rankingOpen').click();
   const elapsed=await page.evaluate(()=>window.__testState.elapsed);
   await page.locator('#pump').dispatchEvent('pointerdown',{pointerId:30,pointerType:'touch'});
   await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__testState.elapsed),elapsed);
   assert.equal(await page.locator('#pump').getAttribute('aria-pressed'),'false');
   await page.locator('#rankingClose').click();
   await page.locator('#debug').click();assert.equal(await page.locator('#telemetry').isVisible(),true);
   await page.waitForFunction(()=>document.getElementById('telemetry').textContent.includes('腕長'));
   for(const label of ['足角度','足目標','振り子角度','角速度','現在の振れ幅','こぐ','重心','腕長'])assert((await page.locator('#telemetry').textContent()).includes(label));
   if(name==='iphone-landscape'){
    await page.locator('#debug').click();
    await page.evaluate(()=>{
     window.__testDrive=true;window.__clipped=0;window.__boundsSamples=0;
     function observe(){
      const s=window.__testState,c=document.getElementById('canvas');
      if(s&&s.phase==='swing'){
       const p=window.BarPhysics.pose(s),m=c.getContext('2d').getTransform();
       const size=c.getBoundingClientRect(),ratio=c.width/size.width;
       for(const key of ['head','hip','foot','hand']){
        const x=(m.a*p[key].x+m.c*p[key].y+m.e)/ratio,y=(m.b*p[key].x+m.d*p[key].y+m.f)/ratio;
        if(x< -12||x>size.width+12||y< -12||y>size.height+12)window.__clipped++;
       }
       window.__boundsSamples++;
      }
      if(!s||s.giants<1)requestAnimationFrame(observe);
     }requestAnimationFrame(observe);
    });
    await page.waitForFunction(()=>window.__testState.giants>=1,{},{timeout:15000});
    await page.screenshot({path:path.join(out,name+'-giant.png')});
    const fit=await page.evaluate(()=>({clipped:window.__clipped,samples:window.__boundsSamples}));
    assert.equal(fit.clipped,0,'Giant rotation stays inside viewport');
    assert(fit.samples>60);console.log('Full giant rotation: no offscreen character frames');
   }

   await page.reload();await page.locator('#rankingOpen').click();
   assert.equal(await page.locator('#rankingList li').count(),1);
   await page.locator('#rankNormal').click();assert.equal(await page.locator('#rankingList li').count(),1);
   await page.locator('#rankingClose').click();
   assert.equal(await page.locator('#rankingOpen').textContent(),'ランキング');
   assert.deepEqual(errors,[]);console.log(`${name}: layout, assets, touch cancellation, release, result, retry, debug OK`);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
