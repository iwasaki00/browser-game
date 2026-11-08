// Real activation -> filechooser tests, distinct from setInputFiles injection.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const zlib=require('node:zlib');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'../../036_お宝回収屋/node_modules/playwright');
const app=path.resolve(__dirname,'..'),root=path.resolve(app,process.env.QA_APP_ROOT||'.');
const baseline=process.env.PICKER_BASELINE==='1',engine=process.env.PICKER_ENGINE||'chrome';
const mount='/browser-game/037_ちょっとカクレロン/';
const directory=path.join(app,'docs/qa-v072',baseline?'baseline':(process.env.QA_APP_ROOT?'artifact':'source'));
fs.mkdirSync(directory,{recursive:true});
const results=[];
function pngFixture(){
  const chunk=(type,data)=>{
    const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);
    let crc=0xffffffff;for(const byte of Buffer.concat([name,data])){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(800);header.writeUInt32BE(500,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(500*(800*4+1));
  for(let y=0;y<500;y++)for(let x=0;x<800;x++)Buffer.from(x<260?[114,155,176,255]:[75,120,80,255]).copy(rows,y*3201+1+x*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const fixture={name:'synthetic.png',mimeType:'image/png',buffer:pngFixture()};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(mount)){res.writeHead(404).end();return;}
  let file=root;
  for(const part of (pathname.slice(mount.length)||'index.html').split('/')){
    if(!part||part==='.'||part==='..'||!fs.existsSync(file)||!fs.statSync(file).isDirectory()||!fs.readdirSync(file).includes(part)){res.writeHead(404).end();return;}
    file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink()){res.writeHead(404).end();return;}
  }
  const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'}[path.extname(file)];
  fs.readFile(file,(error,bytes)=>{res.writeHead(error?404:200,{'Content-Type':type||'application/octet-stream'});res.end(error?'':bytes);});
});
async function check(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});}catch(error){results.push({name,status:'FAIL',error:error.stack});console.error(error.stack);}console.log(`${results.at(-1).status}: ${name}`);}
async function tabTo(page,id){
  for(let n=0;n<40;n++){
    await page.keyboard.press('Tab');
    if(await page.locator(id).evaluate(el=>document.activeElement===el))return;
  }
  throw new Error(`${id} cannot be reached with Tab`);
}
async function activate(page,id,method='click'){
  const target=page.locator(id);
  const visible=await target.evaluate(el=>{const b=el.getBoundingClientRect(),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!top&&el.contains(top);});
  assert.equal(visible,true,`${id} is covered`);
  const event=page.waitForEvent('filechooser',{timeout:5000});
  if(method==='tap')await target.tap();else if(method==='keyboard'){await tabTo(page,id);await page.keyboard.press('Enter');}else await target.click();
  const chooser=await event;assert.equal(await chooser.element().getAttribute('id'),'image-input');return chooser;
}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#canvas').hidden&&!document.querySelector('#status').textContent);}
async function snapshot(page){
  await page.locator('#open-preview').click();await page.waitForFunction(()=>!document.querySelector('#preview-image').hidden&&document.querySelector('#preview-image').complete);
  const pixels=await page.evaluate(()=>{const img=document.querySelector('#preview-image'),c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);let hash=2166136261;for(const v of x.getImageData(0,0,c.width,c.height).data)hash=Math.imul(hash^v,16777619)>>>0;return {width:c.width,height:c.height,hash};});
  await page.locator('#back-to-edit').click();return pixels;
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser,unavailable;
  try{
    try{browser=engine==='webkit'?await webkit.launch({headless:true,timeout:15000,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})}):await chromium.launch({headless:true,channel:'chrome',timeout:15000});}
    catch(error){unavailable=error.message;results.push({name:'WebKit availability',status:'SKIP',reason:unavailable});return;}
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],responses=[];
    page.setDefaultTimeout(8000);page.setDefaultNavigationTimeout(15000);
    page.on('pageerror',error=>errors.push(error.message));page.on('response',r=>{if(r.status()>=400)responses.push(r.status());});
    const base=`http://127.0.0.1:${server.address().port}${encodeURI(mount)}`;
    await page.goto(base);
    await check('visible initial control opens filechooser and selection renders the photo',async()=>{
      const markup=await page.locator('#image-input').evaluate(el=>({hidden:el.hidden,display:getComputedStyle(el).display,found:el instanceof HTMLInputElement}));
      const chooser=await activate(page,'#choose-image');await chooser.setFiles(fixture);await ready(page);
      return markup;
    });
    await check('change-image opens chooser; same-file reselection fires change and resets edited size',async()=>{
      let chooser=await activate(page,'#change-image');await chooser.setFiles(fixture);await ready(page);
      await page.locator('#larger').click();assert.equal(await page.locator('#size-value').textContent(),'20%');
      chooser=await activate(page,'#change-image');await chooser.setFiles(fixture);await ready(page);
      assert.equal(await page.locator('#size-value').textContent(),'18%');assert.equal(await page.locator('#image-input').inputValue(),'');
    });
    if(!baseline){
      await check('a native selection made while the game script is delayed is processed after startup',async()=>{
        const early=await context.newPage();let release;const gate=new Promise(resolve=>release=resolve);
        early.on('pageerror',error=>errors.push(error.message));
        await early.route(/\/app(?:\.[a-f0-9]+)?\.js(?:\?|$)/,async route=>{await gate;await route.continue();});
        try{
          await early.goto(base,{waitUntil:'commit'});await early.locator('#choose-image').waitFor();
          const chooser=await activate(early,'#choose-image');await chooser.setFiles(fixture);
          assert.notEqual(await early.evaluate(()=>document.documentElement.dataset.appReady),'true');
          release();await ready(early);assert.equal(await early.locator('#startup-status').isHidden(),true);
        }finally{release();await early.close();}
      });
      await check('keyboard Enter and Space and touch activate the native label association',async()=>{
        await page.goto(base);
        let chooser=await activate(page,'#choose-image','keyboard');await chooser.setFiles(fixture);await ready(page);
        await tabTo(page,'#change-image');const event=page.waitForEvent('filechooser',{timeout:5000});await page.keyboard.press('Space');chooser=await event;await chooser.setFiles(fixture);await ready(page);
        await page.goto(base);chooser=await activate(page,'#choose-image','tap');await chooser.setFiles(fixture);await ready(page);
        assert.equal(await page.locator('#image-input').evaluate(el=>!el.hidden&&getComputedStyle(el).display!=='none'),true);
      });
      await check('empty chooser response and cancel event preserve existing painted pixels and history',async()=>{
        await page.locator('[data-mode="pick"]').click();const b=await page.locator('#canvas').boundingBox();await page.mouse.click(b.x+b.width*.15,b.y+b.height/2);
        await page.locator('[data-mode="paint"]').click();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
        assert.equal(await page.locator('#undo').isEnabled(),true);const before=await snapshot(page);
        const chooser=await activate(page,'#change-image');await chooser.setFiles([]);
        await page.locator('#image-input').dispatchEvent('cancel');
        assert.equal(await page.locator('#undo').isEnabled(),true);assert.deepEqual(await snapshot(page),before);
        return 'No-file chooser response + DOM cancel; real OS dialog cancel remains an iPhone acceptance check';
      });
      await check('decode failure through the real change control preserves current photo and paint',async()=>{
        const before=await snapshot(page),chooser=await activate(page,'#change-image');
        await chooser.setFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
        await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('この画像は読み込めません'));
        assert.equal(await page.locator('#undo').isEnabled(),true);assert.deepEqual(await snapshot(page),before);
      });
    }
    await check('HTTP startup and assets have no errors; file input and control exist',async()=>{
      assert.deepEqual(errors,[]);assert.deepEqual(responses,[]);assert.equal(await page.locator('#image-input').count(),1);
    });
    if(!baseline){
      await check('script startup failure is distinct from image decode and native label still opens chooser',async()=>{
        const failed=await context.newPage();await failed.route(/\/(?:app|paint)(?:\.[a-f0-9]+)?\.js(?:\?|$)/,route=>route.abort());
        await failed.goto(base);
        await failed.waitForFunction(()=>document.querySelector('#startup-status').textContent.includes('アプリを起動できません'));
        assert.doesNotMatch(await failed.locator('#startup-status').textContent(),/JPEG|PNG|この画像/);
        const chooser=await activate(failed,'#choose-image');await chooser.setFiles([]);await failed.close();
      });
      await page.screenshot({path:path.join(directory,`${engine}-picker.png`),fullPage:true});
    }
    await context.close();
  }finally{
    const report={observedAt:new Date().toISOString(),engine,browser:browser?await browser.version():null,baseline,applicationRoot:path.relative(app,root).split(path.sep).join('/'),results};
    fs.writeFileSync(path.join(directory,`${engine}.json`),JSON.stringify(report,null,2)+'\n');
    // Terminate this test server's keep-alive sockets as well (older Windows
    // WebKit can leave a connection open after closing the browser).
    server.closeAllConnections();
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
    const failed=results.filter(x=>x.status==='FAIL').length;console.log(JSON.stringify({pass:results.filter(x=>x.status==='PASS').length,fail:failed,skip:results.filter(x=>x.status==='SKIP').length}));if(failed||(!browser&&engine!=='webkit'))process.exitCode=1;
  }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
