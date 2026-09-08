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
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   await page.goto(url);await page.waitForTimeout(350);
   for(const id of ['tuck','release','debug']){
    const box=await page.locator('#'+id).boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${name}: ${id} out of viewport`);assert(box.height>=44);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,name+'.png')});
   await page.locator('#tuck').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',button:0});
   await page.waitForTimeout(180);assert.equal(await page.locator('#tuck').getAttribute('aria-pressed'),'true');
   await page.locator('#tuck').dispatchEvent('pointercancel',{pointerId:1,pointerType:'touch'});assert.equal(await page.locator('#tuck').getAttribute('aria-pressed'),'false');
   if(mobile)await page.locator('#release').tap();else await page.keyboard.press('x');
   await page.locator('#result').waitFor({state:'visible'});
   await page.screenshot({path:path.join(out,name+'-result.png')});
   await page.locator('#retry').click();assert.equal(await page.locator('#result').isVisible(),false);assert.equal(await page.locator('#release').isEnabled(),true);
   await page.locator('#debug').click();assert.equal(await page.locator('#telemetry').isVisible(),true);
   assert.deepEqual(errors,[]);console.log(`${name}: layout, assets, touch cancellation, release, result, retry, debug OK`);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
