// Uses an existing Playwright installation; never installs packages or browsers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../036_お宝回収屋/node_modules/playwright');
const sourceRoot = path.resolve(__dirname, '..');
const root = path.resolve(sourceRoot, process.env.QA_APP_ROOT || '.');
const artifacts = path.resolve(sourceRoot, process.env.QA_ARTIFACT_DIR || 'docs/qa-v071/source');
const mount = process.env.QA_BASE_PATH || '/';
if (!mount.startsWith('/') || !mount.endsWith('/') || mount.includes('..')) throw new Error('Invalid test mount');
fs.mkdirSync(artifacts, { recursive: true });
const results = [];
const check = async (name, fn) => {
  const start = performance.now();
  try { const detail = await fn(); results.push({ name, status: 'PASS', ms: Math.round(performance.now()-start), detail }); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.stack }); console.error(error.stack); }
  console.log(`${results.at(-1).status}: ${name}`);
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!pathname.startsWith(mount)) { res.writeHead(404).end(); return; }
  const relative = pathname.slice(mount.length) || 'index.html';
  let target = root;
  for (const part of relative.split('/')) {
    if (!part || part === '.' || part === '..' || !fs.existsSync(target) || !fs.statSync(target).isDirectory() || !fs.readdirSync(target).includes(part)) { res.writeHead(404).end(); return; }
    target = path.join(target,part);
    if(fs.lstatSync(target).isSymbolicLink()){res.writeHead(404).end();return;}
  }
  if(!fs.statSync(target).isFile()){res.writeHead(404).end();return;}
  const type = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' }[path.extname(target)] || 'application/octet-stream';
  fs.readFile(target, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type':type }); res.end(error ? '' : bytes); });
});
const fixture = (width=800,height=500) => ({ name:'synthetic.svg', mimeType:'image/svg+xml', buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="#4b7850" d="M0 0h${width}v${height}H0z"/><path fill="#729bb0" d="M0 0h${width/3}v${height}H0z"/></svg>`) });
async function load(page, width=800,height=500) {
  await page.locator('#image-input').setInputFiles(fixture(width,height));
  await page.waitForFunction(() => !document.querySelector('#canvas').hidden && !document.querySelector('#status').textContent);
}
async function preview(page) {
  await page.locator('#open-preview').click();
  await page.waitForFunction(() => !document.querySelector('#preview-image').hidden && document.querySelector('#preview-image').complete);
}
async function imagePixels(page) {
  return page.evaluate(() => {
    const img = document.querySelector('#preview-image'), c = document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let hash=2166136261;for(const byte of pixels)hash=Math.imul(hash^byte,16777619)>>>0;
    return {width:c.width,height:c.height,hash};
  });
}
function inspectPNG(bytes) {
  assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const chunks=[];let offset=8,size;
  while(offset<bytes.length){
    const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+length;
    assert.ok(end<=bytes.length,'truncated PNG');
    let crc=0xffffffff;for(const byte of bytes.subarray(offset+4,offset+8+length)){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    assert.equal((crc^0xffffffff)>>>0,bytes.readUInt32BE(offset+8+length),'PNG CRC');
    if(type==='IHDR')size=[bytes.readUInt32BE(offset+8),bytes.readUInt32BE(offset+12)];
    chunks.push(type);offset=end;
  }
  assert.equal(chunks[0],'IHDR');assert.equal(chunks.at(-1),'IEND');assert.ok(chunks.includes('IDAT'));
  assert.ok(!chunks.some(c=>['eXIf','tEXt','zTXt','iTXt'].includes(c)),'unexpected source/answer metadata');
  return {size,chunks,bytes:bytes.length};
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}${encodeURI(mount)}`;
  let browser;
  try {
    browser = await chromium.launch({ channel:process.env.QA_BROWSER_CHANNEL || 'chrome', headless:true });
    const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce', acceptDownloads:true });
    const page = await context.newPage(), errors=[], network=[];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => { if(response.status()>=400)errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) network.push(req.url()); });
    await page.goto(base);
    await check('release version and nested relative resources load without source-folder fallback',async()=>{
      assert.equal(await page.locator('meta[name="application-version"]').getAttribute('content'),'0.7.1');
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.version),'0.7.1');
      assert.match(await page.locator('.version').textContent(),/v0\.7\.1.*RELEASE PREP/);
      assert.deepEqual(await page.evaluate(()=>[...document.scripts].map(s=>new URL(s.src).pathname).every(p=>p.startsWith(new URL(location.href).pathname))),true);
      if(process.env.QA_APP_ROOT){
        for(const file of ['tests/app.test.cjs','docs/QA_REPORT_v0.7.0.md','README.md','scripts/build-release.cjs','app.js','assets/kakureron.svg']){
          const response=await fetch(new URL(file,base));assert.equal(response.status,404,`${file} leaked or source fallback enabled`);
        }
      }
      return {version:'0.7.1',mount,artifact:!!process.env.QA_APP_ROOT};
    });
    await check('photo aspects, responsive layouts and aspect-following question/answer preview', async () => {
      const measurements=[];
      for (const [width,height] of [[390,844],[375,667],[320,568],[844,390],[1280,900]]) {
        await page.setViewportSize({width,height});
        for (const [iw,ih] of [[800,500],[500,800],[600,600]]) {
          await load(page,iw,ih);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: horizontal overflow`);
          await preview(page);
          await page.locator('#show-answer').click();
          await page.waitForFunction(() => document.querySelector('#preview-title').textContent === '答え画像' && document.querySelector('#preview-image').complete);
          const m=await page.evaluate(() => {
            const img=document.querySelector('#preview-image'),wrap=img.parentElement,a=img.getBoundingClientRect(),b=wrap.getBoundingClientRect();
            return {image:{width:a.width,height:a.height},wrap:{width:b.width,height:b.height},fit:getComputedStyle(img).objectFit};
          });
          assert.ok(Math.abs(m.wrap.width/m.wrap.height-iw/ih)<0.025, `${width}, ${iw}x${ih}: ${JSON.stringify(m)}`);
          assert.equal(m.fit,'contain');
          measurements.push({viewport:[width,height],photo:[iw,ih],...m});
          if(width===390) await page.screenshot({path:path.join(artifacts,`preview-${iw}x${ih}.png`),fullPage:true});
          await page.locator('#back-to-edit').click();
        }
      }
      return measurements;
    });
    await page.setViewportSize({width:390,height:844});
    await page.goto(base);
    await check('180 photo/pose/size/rotation combinations: inverse input, real masks, PNG pixels and answer bounds', async () => {
      const count = await page.evaluate(async () => {
        const P=KakureronPoses,V=KakureronView,E=KakureronExport,B=KakureronPaint;
        const ensure=(ok,msg)=>{if(!ok)throw new Error(msg);};
        const make=()=>document.createElement('canvas');
        const images=await Promise.all(P.list.map(p=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=p.silhouette;})));
        const decode=async blob=>{const b=await createImageBitmap(blob);const c=make();c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);b.close();return c;};
        let count=0;
        for (const [w,h] of [[320,200],[200,320],[256,256]]) for(const [index,pose] of P.list.entries()) {
          const bg=make();bg.width=w;bg.height=h;bg.getContext('2d').fillStyle='#4b7850';bg.getContext('2d').fillRect(0,0,w,h);
          const paint=B.createLayer(make),prepared=paint.prepareMask(images[index],pose),alpha=prepared.pixels;
          paint.applyMask(prepared);
          const raster=P.rasterSize(pose), mask=make();mask.width=raster.width;mask.height=raster.height;
          mask.getContext('2d').drawImage(images[index],0,0,mask.width,mask.height);
          let local=null,best=Infinity;
          for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(alpha[(y*mask.width+x)*4+3]===255){
            const d=(x-mask.width/2)**2+(y-mask.height/2)**2;if(d<best){best=d;local={x:x+.5,y:y+.5};}
          }
          for(const size of [.05,.18,.6])for(const degrees of [0,45,90,-70,180]) {
            const ch={x:.5,y:.5,size,angle:degrees*Math.PI/180,poseId:pose.poseId};
            const cw=size*w, chh=cw*pose.ratio, lx=(local.x/raster.width-.5)*cw,ly=(local.y/raster.height-.5)*chh;
            const world={x:w*.5+lx*Math.cos(ch.angle)-ly*Math.sin(ch.angle),y:h*.5+lx*Math.sin(ch.angle)+ly*Math.cos(ch.angle)};
            for(const viewport of [{width:390,height:420},{width:844,height:210},{width:1000,height:650}])for(const scale of [1,2,4,8]){
              const fit=V.fitRect(bg,viewport,{enabled:scale!==1,scale,center:{x:.45,y:.55}});
              const input={x:fit.x+world.x/w*fit.width,y:fit.y+world.y/h*fit.height};
              const actual=B.screenToLocal(input,ch,fit,pose);
              ensure(Math.abs(actual.x-local.x)<1e-8&&Math.abs(actual.y-local.y)<1e-8,`inverse ${pose.poseId}/${size}/${degrees}/${scale}`);
            }
            paint.reset();paint.begin('paint','#de31bd','large');paint.dab(local);paint.finish();
            const pixels=paint.canvas.getContext('2d').getImageData(0,0,raster.width,raster.height).data;
            for(let i=3;i<pixels.length;i+=4)ensure(!pixels[i]||alpha[i],`mask leak ${pose.poseId}`);
            const scene={background:bg,characterImage:images[index],paintLayer:paint.canvas,character:ch,pose,bounds:paint.bounds()};
            const question=await E.createPNG(make,scene),answer=await E.createPNG(make,scene,true);
            const q=await decode(question.blob),a=await decode(answer.blob);
            ensure(q.width===w&&q.height===h&&a.width===w&&a.height===h,'output dimensions');
            const qpx=q.getContext('2d').getImageData(0,0,w,h).data,apx=a.getContext('2d').getImageData(0,0,w,h).data;
            let redQ=0,redA=0,painted=0;
            for(let i=0;i<qpx.length;i+=4){ensure(qpx[i+3]===255,'unwanted transparent pixel');
              if(qpx[i]>220&&qpx[i+1]<70&&qpx[i+2]<80)redQ++;
              if(apx[i]>220&&apx[i+1]<70&&apx[i+2]<80)redA++;
              if(qpx[i]>130&&qpx[i+2]>120&&qpx[i+1]<100)painted++;
            }
            ensure(!redQ&&redA>0&&painted>0,`PNG layers ${pose.poseId}/${size}/${degrees}`);
            // Independently inspect the rendered alpha extent, allowing subpixel antialiasing.
            const silhouette=make();silhouette.width=w;silhouette.height=h;
            E.drawCharacter(silhouette.getContext('2d'),scene,{x:0,y:0,width:w,height:h});
            const sp=silhouette.getContext('2d').getImageData(0,0,w,h).data,box=E.answerBounds(ch,{x:0,y:0,width:w,height:h},pose,paint.bounds());
            for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(sp[(y*w+x)*4+3]>8)ensure(x+1>=box.x&&x<=box.x+box.width&&y+1>=box.y&&y<=box.y+box.height,'answer excludes silhouette');
            const near=q.getContext('2d').getImageData(Math.max(0,Math.floor(world.x)-1),Math.max(0,Math.floor(world.y)-1),3,3).data;
            ensure(Array.from({length:9},(_,i)=>near[i*4]>130&&near[i*4+2]>120&&near[i*4+1]<100).some(Boolean),'paint output shifted');
            q.width=q.height=a.width=a.height=silhouette.width=silhouette.height=1;count++;
          }
        }
        return count;
      });
      assert.equal(count,180);return {scenes:count,coordinateChecks:count*12,realPNGs:count*2};
    });
    await check('UI mouse, zoom drawing, pose confirmation, downloads, cache and decode failure', async () => {
      await page.setViewportSize({width:1280,height:900});
      await page.goto(base);await load(page);
      await page.locator('#size-slider').click({position:{x:10,y:20}});
      assert.notEqual(await page.locator('#size-value').textContent(),'18%');
      await page.locator('#size-slider').press('End');
      await page.locator('#angle-slider').press('Home');await page.locator('#angle-slider').press('ArrowRight');
      assert.equal(await page.locator('#angle-value').textContent(),'-179°');
      await page.locator('#angle-slider').press('End');
      assert.equal(await page.locator('#angle-value').textContent(),'180°');
      assert.equal(await page.locator('#size-value').textContent(),'60%');
      for(const pose of ['P01','P02','P03','P04']){
        await page.locator('#toggle-poses').click();await page.locator(`[data-pose="${pose}"]`).click();
        if(await page.locator('#change-confirm').isVisible())await page.locator('#confirm-change').click();
        await page.waitForFunction(id=>document.querySelector(`[data-pose="${id}"]`).getAttribute('aria-pressed')==='true',pose);
        await page.locator('[data-mode="pick"]').click();
        const box=await page.locator('#canvas').boundingBox();await page.mouse.click(box.x+box.width*.15,box.y+box.height*.5);
        await page.locator('[data-mode="paint"]').click();await page.locator('#open-zoom').click();
        for(const scale of ['2','4','8']){
          await page.locator(`[data-zoom="${scale}"]`).click();const b=await page.locator('#canvas').boundingBox();
          await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+3,b.y+b.height/2+2);await page.mouse.up();
        }
        await page.locator('#close-zoom').click();assert.equal(await page.locator('#undo').isEnabled(),true);
        await page.locator('#toggle-poses').click();await page.locator(`[data-pose="${pose==='P01'?'P02':'P01'}"]`).click();
        await page.locator('#cancel-change').click();assert.equal(await page.locator(`[data-pose="${pose}"]`).getAttribute('aria-pressed'),'true');
        await preview(page);const before=await imagePixels(page);
        const downloadEvent=page.waitForEvent('download');await page.locator('#save-question').click();const download=await downloadEvent;
        assert.match(download.suggestedFilename(),/^kakureron_question_.*\.png$/);
        await download.saveAs(path.join(artifacts,`${pose}-question.png`));
        await page.locator('#show-answer').click();await page.waitForFunction(()=>document.querySelector('#preview-title').textContent==='答え画像'&&document.querySelector('#preview-image').complete);
        const answerEvent=page.waitForEvent('download');await page.locator('#save-answer').click();await (await answerEvent).saveAs(path.join(artifacts,`${pose}-answer.png`));
        await page.locator('#back-to-edit').click();
        for(let n=0;n<3;n++)await page.locator('#undo').click();
        await preview(page);
        assert.notEqual((await imagePixels(page)).hash,before.hash);await page.locator('#back-to-edit').click();
        await page.locator('#image-input').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
        await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('読み込めません'));
        assert.equal(await page.locator(`[data-pose="${pose}"]`).getAttribute('aria-pressed'),'true');
        await load(page);
      }
      await page.screenshot({path:path.join(artifacts,'desktop-editor.png'),fullPage:true});
      return {poses:4,zooms:[2,4,8],downloads:8};
    });
    await check('photo draw failure preserves previous photo, paint, pose and preview bytes', async()=>{
      await page.setViewportSize({width:390,height:844});
      await page.goto(base);await load(page);
      await page.locator('#toggle-poses').click();await page.locator('[data-pose="P04"]').click();
      await page.locator('[data-mode="pick"]').click();const b=await page.locator('#canvas').boundingBox();
      await page.mouse.click(b.x+b.width*.15,b.y+b.height/2);await page.locator('[data-mode="paint"]').click();
      await page.mouse.click(b.x+b.width/2,b.y+b.height/2);assert.equal(await page.locator('#undo').isEnabled(),true);
      await preview(page);const before=await imagePixels(page);await page.locator('#back-to-edit').click();
      await page.evaluate(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(image instanceof HTMLImageElement&&image.src.startsWith('blob:')){CanvasRenderingContext2D.prototype.drawImage=draw;throw new Error('injected photo allocation/draw failure');}
        return draw.call(this,image,...args);
      };});
      await page.locator('#image-input').setInputFiles(fixture(500,800));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('読み込めません'));
      assert.equal(await page.locator('#undo').isEnabled(),true);
      assert.equal(await page.locator('[data-pose="P04"]').getAttribute('aria-pressed'),'true');
      await preview(page);assert.deepEqual(await imagePixels(page),before);await page.locator('#back-to-edit').click();
    });
    await check('artifact UI eyedropper, copy source, opacity, eraser and mixed Undo/Redo regenerate exact pixels',async()=>{
      await page.goto(base);await load(page);
      const box=await page.locator('#canvas').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
      await page.locator('[data-mode="pick"]').click();await page.mouse.click(box.x+box.width*.15,cy);
      await page.locator('[data-mode="paint"]').click();await page.mouse.click(cx,cy);
      await preview(page);const painted=await imagePixels(page);await page.locator('#back-to-edit').click();
      await page.locator('[data-mode="copy"]').click();await page.locator('#select-copy-source').click();
      await page.mouse.click(box.x+box.width*.8,cy);
      assert.match(await page.locator('#copy-source-state').textContent(),/指定済み/);
      await page.locator('[data-opacity="0.4"]').click();await page.mouse.click(cx,cy);
      await preview(page);const copied=await imagePixels(page);assert.notEqual(copied.hash,painted.hash);await page.locator('#back-to-edit').click();
      await page.locator('[data-mode="erase"]').click();await page.mouse.click(cx,cy);
      await preview(page);const erased=await imagePixels(page);assert.notEqual(erased.hash,copied.hash);await page.locator('#back-to-edit').click();
      await page.locator('#undo').click();await preview(page);assert.deepEqual(await imagePixels(page),copied);await page.locator('#back-to-edit').click();
      await page.locator('#redo').click();await preview(page);assert.deepEqual(await imagePixels(page),erased);await page.locator('#back-to-edit').click();
    });
    await check('eight downloaded PNG files have valid signatures, chunk CRCs and no EXIF/text payload',async()=>{
      return ['P01','P02','P03','P04'].flatMap(pose=>['question','answer'].map(kind=>{
        const file=`${pose}-${kind}.png`,info=inspectPNG(fs.readFileSync(path.join(artifacts,file)));
        assert.deepEqual(info.size,[800,500]);return {file,...info};
      }));
    });
    await check('JPEG EXIF orientation is respected and source metadata is not copied to PNG',async()=>{
      await page.goto(base);
      const jpeg=Buffer.from(await page.evaluate(()=>{
        const c=document.createElement('canvas');c.width=300;c.height=200;const x=c.getContext('2d');
        x.fillStyle='#3050b0';x.fillRect(0,0,150,200);x.fillStyle='#40a050';x.fillRect(150,0,150,200);return c.toDataURL('image/jpeg',.95).split(',')[1];
      }),'base64');
      const exif=Buffer.alloc(32);exif.write('Exif\0\0',0,'binary');exif.write('II',6);exif.writeUInt16LE(42,8);exif.writeUInt32LE(8,10);
      exif.writeUInt16LE(1,14);exif.writeUInt16LE(0x112,16);exif.writeUInt16LE(3,18);exif.writeUInt32LE(1,20);exif.writeUInt16LE(6,24);
      const header=Buffer.from([255,225,0,34]);
      await page.locator('#image-input').setInputFiles({name:'orientation-6.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([jpeg.subarray(0,2),header,exif,jpeg.subarray(2)])});
      await page.waitForFunction(()=>!document.querySelector('#canvas').hidden&&!document.querySelector('#status').textContent);
      await preview(page);assert.match(await page.locator('#output-size').textContent(),/200 × 300/);
      const colors=await page.evaluate(()=>{
        const img=document.querySelector('#preview-image'),c=document.createElement('canvas');c.width=200;c.height=300;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        return [[20,20],[20,280]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));
      });
      assert.ok(colors[0][2]>colors[0][1]&&colors[1][1]>colors[1][2]);
      const event=page.waitForEvent('download');await page.locator('#save-question').click();const file=path.join(artifacts,'oriented-question.png');await(await event).saveAs(file);
      return inspectPNG(fs.readFileSync(file));
    });
    await check('real copy pixels, three opacities, overlap, clipping and 25-stroke history limit',async()=>{
      return page.evaluate(async()=>{
        const make=()=>document.createElement('canvas'),bg=make();bg.width=bg.height=80;
        const ctx=bg.getContext('2d');for(let y=0;y<80;y++)for(let x=0;x<80;x++){ctx.fillStyle=`rgb(${x*3},${y*3},80)`;ctx.fillRect(x,y,1,1);}
        const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
        let cases=0;
        for(const pose of KakureronPoses.list){
          const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=pose.silhouette;});
          const paint=KakureronPaint.createLayer(make),prepared=paint.prepareMask(image,pose),alpha=prepared.pixels;
          const raster=KakureronPoses.rasterSize(pose);paint.applyMask(prepared);
          let point=null,best=Infinity;
          for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)if(alpha[(y*raster.width+x)*4+3]===255){
            const d=(x-raster.width/2)**2+(y-raster.height/2)**2;if(d<best){best=d;point={x:x+.5,y:y+.5};}
          }
          const data=()=>paint.canvas.getContext('2d').getImageData(0,0,raster.width,raster.height).data;
          const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
          for(const opacity of [1,.7,.4])for(const degrees of [0,45,90,-70,180])for(const size of [.05,.18,.6]){
            paint.reset();const character={x:.5,y:.5,size,angle:degrees*Math.PI/180,poseId:pose.poseId};
            paint.beginCopy({background:bg,imageSize:{width:80,height:80},source:{x:40.5,y:30.5},character,pose,brush:'large',opacity});
            paint.dab(point);const once=data();for(let n=0;n<8;n++)paint.dab(point);const repeated=data();
            ensure(equal(once,repeated),'overlap compounds');
            const offset=(Math.floor(point.y)*raster.width+Math.floor(point.x))*4;
            ensure(Math.abs(repeated[offset]-121)<=3&&Math.abs(repeated[offset+1]-91)<=3&&Math.abs(repeated[offset+3]-255*opacity)<=1,'copy source/opacity');
            for(let i=3;i<repeated.length;i+=4)ensure(!repeated[i]||alpha[i],'copy mask leak');
            paint.finish();paint.undo();ensure(!paint.hasPaint(),'copy undo');paint.redo();ensure(equal(data(),repeated),'copy redo');cases++;
          }
          paint.reset();
          for(let n=0;n<30;n++){paint.begin(n%3===0?'erase':'paint',n%2?'#de31bd':'#315ede','medium');paint.dab(point);paint.finish();}
          ensure(paint.history().undo===25,'history limit');const final=data();
          for(let n=0;n<25;n++)paint.undo();for(let n=0;n<25;n++)paint.redo();ensure(equal(data(),final),'history round trip');
          paint.begin('erase','#ffffff','large');paint.dab(point);paint.cancel();ensure(equal(data(),final),'cancel restores pixels');
        }
        return {copyCases:cases,poses:4,strokesPerHistoryRun:30};
      });
    });
    await check('share API contract: prepared PNG, user activation, duplicate lock, cancel, errors and fresh bytes (mocked OS)',async()=>{
      await page.goto(base);await load(page);
      await page.evaluate(()=>{
        window.qaShares=[];
        Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1&&files[0].type==='image/png'});
        Object.defineProperty(navigator,'share',{configurable:true,value:({files})=>{window.qaShares.push({file:files[0],active:navigator.userActivation.isActive});return new Promise((resolve,reject)=>{window.qaShareResolve=resolve;window.qaShareReject=reject;});}});
      });
      await preview(page);await page.locator('#share-question').click();
      assert.equal(await page.locator('#share-question').isDisabled(),true);
      await page.locator('#share-question').evaluate(el=>el.click());
      assert.deepEqual(await page.evaluate(()=>qaShares.map(s=>s.active)),[true]);
      await page.evaluate(()=>qaShareReject(new DOMException('cancel','AbortError')));
      await page.waitForFunction(()=>!document.querySelector('#share-question').disabled);
      assert.equal(await page.locator('#status').textContent(),'');
      await page.locator('#share-question').click();await page.evaluate(()=>qaShareReject(new Error('simulated share error')));
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('共有できません'));
      await page.locator('#back-to-edit').click();await page.locator('#larger').click();await preview(page);await page.locator('#share-question').click();
      assert.equal(await page.evaluate(async()=>{const a=new Uint8Array(await qaShares[0].file.arrayBuffer()),b=new Uint8Array(await qaShares.at(-1).file.arrayBuffer());return a.length!==b.length||a.some((v,i)=>v!==b[i]);}),true);
      await page.evaluate(()=>qaShareResolve());await page.waitForFunction(()=>!document.querySelector('#share-question').disabled);
      await page.locator('#back-to-edit').click();
      await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
      await preview(page);assert.match(await page.locator('#share-note').textContent(),/保存してから共有/);
      await page.locator('#back-to-edit').click();
    });
    await check('repeated image/preview cycles release Object URLs and bound canvas backing stores',async()=>{
      await page.goto(base);
      await page.evaluate(()=>{
        window.qaURLs=new Set();window.qaCanvases=[];
        const create=URL.createObjectURL,revoke=URL.revokeObjectURL,element=document.createElement.bind(document);
        URL.createObjectURL=value=>{const url=create(value);qaURLs.add(url);return url;};
        URL.revokeObjectURL=url=>{qaURLs.delete(url);revoke(url);};
        document.createElement=(tag,...args)=>{const result=element(tag,...args);if(tag==='canvas')qaCanvases.push(result);return result;};
      });
      const samples=[];
      for(let n=0;n<12;n++){
        await load(page,n===0?6000:800,n===0?4000:500);await preview(page);
        if(n===0)assert.match(await page.locator('#output-size').textContent(),/2048 × 1365/);
        await page.locator('#show-answer').click();await page.waitForFunction(()=>document.querySelector('#preview-title').textContent==='答え画像');
        assert.equal(await page.evaluate(()=>qaURLs.size),2);await page.locator('#back-to-edit').click();
        const sample=await page.evaluate(()=>({urls:qaURLs.size,largeCanvases:qaCanvases.filter(c=>c.width>1||c.height>1).length,dimensions:qaCanvases.filter(c=>c.width>1||c.height>1).map(c=>[c.width,c.height])}));
        assert.equal(sample.urls,0);assert.equal(sample.largeCanvases,1);samples.push(sample);
      }
      // Canvas references above are intentionally retained by the probe; this measures explicit release, not GC or iPhone RAM.
      return {cycles:12,samples};
    });
    await check('real RAF pose transitions settle and block editing/export for all 12 pairs',async()=>{
      await page.goto(base);await load(page);await page.emulateMedia({reducedMotion:'no-preference'});
      let transitions=0;
      for(const from of ['P01','P02','P03','P04']){
        await page.locator('#toggle-poses').click();await page.locator(`[data-pose="${from}"]`).click();await page.waitForFunction(()=>!document.querySelector('#toggle-poses').disabled);
        for(const to of ['P01','P02','P03','P04'].filter(p=>p!==from)){
          await page.locator('#toggle-poses').click();await page.locator(`[data-pose="${to}"]`).click();
          await page.waitForFunction(()=>document.querySelector('#editor-controls').getAttribute('aria-busy')==='true');
          assert.equal(await page.locator('#open-preview').isDisabled(),true);
          const blocked=await page.evaluate(()=>{
            document.querySelector('[data-mode="paint"]').click();
            const c=document.querySelector('#canvas'),b=c.getBoundingClientRect();
            for(const type of ['pointerdown','pointerup'])c.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:'mouse',button:0,clientX:b.x+b.width/2,clientY:b.y+b.height/2}));
            return {mode:c.dataset.mode,undo:document.querySelector('#undo').disabled,busy:document.querySelector('#editor-controls').getAttribute('aria-busy')};
          });
          assert.deepEqual(blocked,{mode:'place',undo:true,busy:'true'});
          await page.waitForFunction(()=>!document.querySelector('#toggle-poses').disabled);
          assert.equal(await page.locator(`[data-pose="${to}"]`).getAttribute('aria-pressed'),'true');transitions++;
          await page.locator('#toggle-poses').click();await page.locator(`[data-pose="${from}"]`).click();await page.waitForFunction(()=>!document.querySelector('#toggle-poses').disabled);
        }
      }
      return {transitions,duration:380};
    });
    await check('mobile Chrome emulation: real touch drag, pinch/rotate, zoom and paint',async()=>{
      const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
      try{
        const p=await mobile.newPage();
        p.on('pageerror',e=>errors.push(`mobile: ${e.message}`));
        p.on('request',req=>{if(/^https?:/.test(req.url())&&!req.url().startsWith(base))network.push(req.url());});
        await p.goto(base);await load(p);
        const cdp=await mobile.newCDPSession(p),box=await p.locator('#canvas').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
        const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([px,py,id])=>({x:px,y:py,id,radiusX:3,radiusY:3,force:1}))});
        await touch('touchStart',[[x,y,1]]);await touch('touchMove',[[x+12,y+8,1]]);await touch('touchEnd',[]);
        await touch('touchStart',[[x+5,y+8,1],[x+19,y+8,2]]);await touch('touchMove',[[x-1,y-6,1],[x+25,y+22,2]]);await touch('touchEnd',[]);
        assert.notEqual(await p.locator('#angle-value').textContent(),'0°');assert.notEqual(await p.locator('#size-value').textContent(),'18%');
        await p.locator('[data-mode="pick"]').tap();await p.touchscreen.tap(box.x+box.width*.15,y);
        await p.locator('[data-mode="paint"]').tap();await p.locator('#open-zoom').tap();
        const z=await p.locator('#canvas').boundingBox();await p.touchscreen.tap(z.x+z.width/2,z.y+z.height/2);
        assert.equal(await p.locator('#undo').isEnabled(),true);
        await p.screenshot({path:path.join(artifacts,'mobile-zoom.png'),fullPage:true});
        await p.locator('#close-zoom').tap();await p.screenshot({path:path.join(artifacts,'mobile-editor.png'),fullPage:true});
        return {engine:'Chrome mobile emulation (not iPhone Safari)',viewport:[390,844],dpr:3};
      }finally{await mobile.close();}
    });
    await check('no unexpected network requests, page errors or persistent photo storage',async()=>{
      assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
      assert.deepEqual(await page.evaluate(async()=>({local:localStorage.length,session:sessionStorage.length,databases:(await indexedDB.databases()).length})),{local:0,session:0,databases:0});
    });
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),node:process.version,platform:process.platform,applicationRoot:path.relative(sourceRoot,root).split(path.sep).join('/'),mount,results},null,2)+'\n');
    await context.close();
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
  console.log(JSON.stringify({pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length}));
  if(results.some(r=>r.status==='FAIL')){for(const r of results.filter(r=>r.status==='FAIL'))console.error(r.error);process.exitCode=1;}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
