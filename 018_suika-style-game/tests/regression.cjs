const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const server = http.createServer((req,res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/png');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
  for (const [name,type] of [['chromium',chromium],['webkit',webkit]]) {
    const browser = await type.launch({headless:true, executablePath:process.env[name.toUpperCase()+"_EXECUTABLE"] || undefined});
    try {
      const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:2});
      await context.route('**/matter.min.js', r => r.fulfill({path:require.resolve('matter-js/build/matter.min.js'),contentType:'text/javascript'}));
      await context.route('**/js/main.js', r => r.fulfill({body:source.replace('new Game();','window.testGame = new Game(); window.testClasses = { FruitManager, Fruit, StorageManager, ScoreManager };'),contentType:'text/javascript'}));
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(()=>window.testGame?.renderer.width>0);
      for (const [w,h] of [[320,568],[375,667],[390,844],[430,932],[844,390],[1280,900],[240,320]]) {
        await page.setViewportSize({width:w,height:h});
        await page.waitForFunction(()=>testGame.physics.width===testGame.canvas.getBoundingClientRect().width && testGame.physics.height===testGame.canvas.getBoundingClientRect().height);
        const layout=await page.evaluate(()=>{
          const g=testGame,c=g.canvas.getBoundingClientRect(),b=document.getElementById('restartButton').getBoundingClientRect();
          return {canvas:[c.width,c.height],logical:[g.renderer.width,g.renderer.height],bottom:b.bottom,right:b.right,scroll:document.documentElement.scrollWidth,window:innerWidth,top:c.top};
        });
        assert(layout.scroll<=w,JSON.stringify(layout));
        assert(Math.abs(layout.canvas[0]-layout.logical[0])<1 && Math.abs(layout.canvas[1]-layout.logical[1])<1,JSON.stringify(layout));
        if(w!==240) assert(layout.bottom<=h && layout.right<=w,JSON.stringify(layout));
        else { await page.locator('#restartButton').scrollIntoViewIfNeeded(); assert(await page.locator('#restartButton').isVisible()); }
        await page.screenshot({path:path.join(__dirname,`artifacts/${name}-${w}x${h}.png`)});
        console.log(name,'layout',w,h,JSON.stringify(layout));
      }
      await page.setViewportSize({width:390,height:844});
      await page.waitForFunction(()=>testGame.physics.width===testGame.canvas.getBoundingClientRect().width);
      // Deterministic timers, including a stale callback already queued before reset.
      assert.equal(await page.evaluate(()=>{
        const {FruitManager}=testClasses; const g=testGame;
        const fm=new FruitManager(g.physics,g.scoreManager);
        const originalSet=window.setTimeout, originalClear=window.clearTimeout;
        let callbacks=[],cleared=[];
        window.setTimeout=(fn,ms)=>{if(ms!==430)throw Error('delay'); callbacks.push(fn);return callbacks.length;};
        window.clearTimeout=id=>cleared.push(id);
        try {
          fm.drop(100); if(fm.drop(100)!==null)throw Error('duplicate');
          fm.reset(); fm.drop(150); callbacks[0]();
          if(fm.canDrop || !cleared.includes(1))throw Error('stale timer');
          callbacks[1](); if(!fm.canDrop)throw Error('new timer');
          return true;
        } finally { window.setTimeout=originalSet;window.clearTimeout=originalClear;g.restart(); }
      }),true);
      // Tap coordinate and same-frame repeated inputs, including non-primary touch.
      const box=await page.locator('#gameCanvas').boundingBox();
      await page.touchscreen.tap(box.x+100,box.y+100);
      assert.equal(await page.evaluate(()=>testGame.fruitManager.fruits.size),1);
      assert(Math.abs(await page.evaluate(()=>testGame.fruitManager.all()[0].body.position.x)-100)<1);
      await page.touchscreen.tap(box.x+150,box.y+100);
      assert.equal(await page.evaluate(()=>testGame.fruitManager.fruits.size),1);
      await page.evaluate(()=>{testGame.canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:200,button:0,isPrimary:false}));testGame.paused=true;});
      assert.equal(await page.evaluate(()=>testGame.fruitManager.fruits.size),1);
      assert.equal(await page.evaluate(()=>{
        const g=testGame;g.restart();
        for(const options of [{isPrimary:false,button:0},{isPrimary:true,button:2}]) {
          g.canvas.dispatchEvent(new PointerEvent('pointerdown',{...options,clientX:200,clientY:200}));
        }
        return g.fruitManager.fruits.size===0;
      }),true);
      // Real collision/merge and score persistence, same original parameters.
      assert.equal(await page.evaluate(()=>{
        const g=testGame; g.restart(); g.paused=true;
        for(const x of [130,158]){const b=g.physics.addFruitBody(0,x,250);g.fruitManager.fruits.add(new testClasses.Fruit(0,b));}
        g.physics.update(16.67);g.fruitManager.processMerges();
        return g.scoreManager.score===4 && g.fruitManager.all().length===1 && g.fruitManager.all()[0].level===1 && localStorage.getItem('suikaStyleGame:bestScore:v1')==='4';
      }),true);
      const snapshot=await page.evaluate(()=>({score:testGame.scoreManager.score,ids:testGame.fruitManager.all().map(f=>f.body.id),pos:testGame.fruitManager.all().map(f=>({...f.body.position}))}));
      page.once('dialog',d=>d.dismiss()); await page.locator('#restartButton').click();
      assert.deepEqual(await page.evaluate(()=>({score:testGame.scoreManager.score,ids:testGame.fruitManager.all().map(f=>f.body.id),pos:testGame.fruitManager.all().map(f=>({...f.body.position}))})),snapshot);
      page.once('dialog',d=>d.accept()); await page.locator('#restartButton').click();
      assert.equal(await page.evaluate(()=>testGame.scoreManager.score===0 && testGame.scoreManager.bestScore>=4 && Matter.Composite.allBodies(testGame.physics.world).length===3 && testGame.physics.engine.pairs.list.length===0),true);
      // Pause prevents physics, merge processing, and shake cooldown progress.
      assert.equal(await page.evaluate(()=>{
        const g=testGame;g.dropFruit(130);g.startShake();g.togglePause();
        const b=g.fruitManager.all()[0].body, p={...b.position}, cooldown=g.shakeCooldown,score=g.scoreManager.score;
        g.update(0.033);
        return b.position.x===p.x && b.position.y===p.y && cooldown===10 && g.shakeCooldown===cooldown && g.scoreManager.score===score;
      }),true);
      await page.locator('#pauseButton').click();
      assert.equal(await page.evaluate(()=>testGame.paused),false);
      assert.equal(await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));return testGame.paused && testGame.lastTime===0;}),true);
      assert.equal(await page.evaluate(()=>{
        testGame.paused=false;
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
        const ok=testGame.paused && testGame.lastTime===0;
        delete document.hidden;return ok;
      }),true);
      // Dense stack resize: fruit containment, preserved speed, and finite simulation.
      await page.evaluate(()=>{
        const g=testGame;g.restart();g.paused=true;
        for(let i=0;i<12;i++) {
          const level=i%4,r=[15,19,23,27][level];
          const b=g.physics.addFruitBody(level,40+(i%4)*85,g.physics.height-6-r-Math.floor(i/4)*65);
          Matter.Body.setVelocity(b,{x:0.2,y:0.1});g.fruitManager.fruits.add(new testClasses.Fruit(level,b));
        }
      });
      await page.setViewportSize({width:320,height:568});
      await page.waitForFunction(()=>testGame.physics.width===testGame.canvas.getBoundingClientRect().width);
      assert.equal(await page.evaluate(()=>testGame.fruitManager.all().every(f=>{
        const b=f.body,r=f.def.radius;
        return b.position.x>=r-.01 && b.position.x<=testGame.physics.width-r+.01 && b.position.y<=testGame.physics.height-6-r+.01 && Math.abs(b.velocity.x-.2)<1e-9 && Math.abs(b.velocity.y-.1)<1e-9;
      })),true);
      const maxSpeed=await page.evaluate(()=>{
        const g=testGame;
        for(let i=0;i<90;i++) {g.physics.update(16.67);g.fruitManager.processMerges();}
        return Math.max(...g.fruitManager.all().map(f=>f.body.speed));
      });
      assert(Number.isFinite(maxSpeed) && maxSpeed<10,'resize speed '+maxSpeed);
      // A shrinking horizontal row of the largest fruit must stack without overlap.
      assert.equal(await page.evaluate(()=>{
        const g=testGame;g.restart();g.paused=true;g.physics.resize(460,600);
        for(const x of [100,260,420]) {
          const b=g.physics.addFruitBody(10,x,500);g.fruitManager.fruits.add(new testClasses.Fruit(10,b));
        }
        g.physics.resize(302,388);
        const bodies=g.fruitManager.all().map(f=>f.body);
        return bodies.every((a,i)=>bodies.slice(i+1).every(b=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)>=159.5));
      }),true);
      // Game-over replay has no confirmation and clears the world.
      await page.evaluate(()=>{testGame.gameOver=true;testGame.ui.showGameOver(true);});
      let dialogs=0; const countDialog=d=>{dialogs++;d.dismiss();};page.on('dialog',countDialog);
      await page.locator('#overlayRestartButton').click();page.off('dialog',countDialog);
      assert.equal(dialogs,0);assert.equal(await page.evaluate(()=>testGame.fruitManager.fruits.size),0);
      // Mouse hover still controls the preview and the clamped guide.
      const b2=await page.locator('#gameCanvas').boundingBox();await page.mouse.move(b2.x+110,b2.y+100);
      assert(Math.abs(await page.evaluate(()=>testGame.dropX)-110)<1);
      assert.equal(await page.evaluate(()=>{
        const g=testGame;
        return Math.abs(parseFloat(g.ui.elements.dropGuide.style.left)-g.dropX)<.01 && getComputedStyle(g.canvas).touchAction==='none' && getComputedStyle(g.ui.elements.shakeButton).touchAction==='none' && getComputedStyle(g.playArea).webkitUserSelect==='none' && !document.querySelector('meta[name=viewport]').content.includes('user-scalable') && !document.querySelector('.back-link');
      }),true);
      assert.deepEqual(errors,[]);
      // Throw on both storage reads and writes; image loading failure uses circles.
      const blocked=await context.newPage();
      await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
      await blocked.route('**/assets/*.png',r=>r.abort());
      const blockedErrors=[];blocked.on('pageerror',e=>blockedErrors.push(e.message));
      await blocked.goto(url);await blocked.waitForFunction(()=>window.testGame?.renderer.width>0);
      assert.equal(await blocked.evaluate(()=>{testGame.scoreManager.add(4);testGame.dropFruit(120);testGame.draw();return testGame.scoreManager.bestScore===4 && testGame.fruitManager.fruits.size===1 && !testGame.renderer.spriteReady;}),true);
      assert.deepEqual(blockedErrors,[]);
      console.log(name,'PASS: timers, taps, merge, restart, pause, inactive, resize, storage, fallback, mouse');
      await context.close();
    } finally {await browser.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
