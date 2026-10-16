const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({headless:true, ...(type === chromium && process.env.CHROMIUM_EXE ? {executablePath:process.env.CHROMIUM_EXE} : {}), ...(type === webkit && process.env.WEBKIT_EXE ? {executablePath:process.env.WEBKIT_EXE} : {})});
    try {
      const page = await browser.newPage({hasTouch:true});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      // Freeze only the animation loop so tests can inspect pending input and timers deterministically.
      await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
      for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390],[1280,800]]) {
        await page.setViewportSize({width,height}); await page.goto(url);
        const layout = await page.evaluate(() => {
          const rect=el=>{ const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
          return {overflow:document.documentElement.scrollWidth>innerWidth, canvas:rect(els.stick.ownerDocument.getElementById('gameCanvas')), buttons:[els.stick,els.bombButton,els.dashButton,els.spButton].map(rect), hud:rect(document.querySelector('.hud')), panel:rect(document.querySelector('.title-panel'))};
        });
        assert.equal(layout.overflow,false);
        assert.ok(Math.abs(layout.canvas.w/layout.canvas.h-4/3)<0.01);
        for (const r of [...layout.buttons,layout.canvas,layout.hud,layout.panel]) assert.ok(r.x>=0 && r.y>=0 && r.right<=width+1 && r.bottom<=height+1,JSON.stringify({width,height,r}));
        for (const r of layout.buttons) assert.ok(r.w>=44 && r.h>=44);
        for (const r of layout.buttons) assert.ok(r.right<=layout.canvas.x+1 || r.x>=layout.canvas.right-1 || r.bottom<=layout.canvas.y+1 || r.y>=layout.canvas.bottom-1,'arena overlaps controls');
        await page.locator('#startButton').click();
        assert.equal(await page.evaluate(()=>state.mode),'play');
        await page.evaluate(()=>clearStage());
        await page.locator('.upgrade-card').first().click();
        assert.equal(await page.evaluate(()=>state.stage),2);
        await page.evaluate(()=>endGame());
        await page.locator('#retryButton').click();
        assert.equal(await page.evaluate(()=>state.stage),1);
        await page.evaluate(()=>endGame());
        await page.locator('#titleButton').click();
        assert.equal(await page.evaluate(()=>state.mode),'title');
        console.log(type.name(),`${width}x${height}: layout, Start, upgrade, Retry, Title PASS`);
      }
      if (type === chromium) {
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>startGame());
        const cdp=await page.context().newCDPSession(page);
        const stick=await page.locator('#stick').boundingBox();
        const bomb=await page.locator('#bombButton').boundingBox();
        const a={id:1,x:stick.x+stick.width/2+30,y:stick.y+stick.height/2};
        const b={id:2,x:bomb.x+bomb.width/2,y:bomb.y+bomb.height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
        assert.deepEqual(await page.evaluate(()=>[input.right,input.bomb]),[true,true]);
        await page.evaluate(()=>{input.bomb=false;});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[b]});
        assert.deepEqual(await page.evaluate(()=>[input.right,input.bomb]),[true,false]);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.evaluate(()=>input.right),false);
        await cdp.detach();
        console.log('chromium native touch stream: simultaneous movement/Bomb and independent release PASS');
      }
      await page.evaluate(() => {
        startGame();
        window.firePointer = (el,type,id,x=0,y=0) => el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
        const r=els.stick.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2;
        firePointer(els.stick,'pointerdown',11,x+30,y);
        firePointer(els.stick,'pointerdown',22,x-30,y);
        firePointer(els.stick,'pointerup',22);
        if(stickPointer!==11 || !input.right || input.left) throw Error('second finger stole stick');
        for (const [button,action] of [[els.bombButton,'bomb'],[els.dashButton,'dash'],[els.spButton,'sp']]) {
          button.disabled=false;
          firePointer(button,'pointerdown',33);
          if(!input[action] || !input.right) throw Error('simultaneous input failed');
          input[action]=false; // Simulate consumption on the next frame.
          firePointer(button,'pointerup',33);
          button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
          if(input[action] || button.classList.contains('pressed')) throw Error('duplicate click');
          firePointer(button,'pointerdown',34);
          firePointer(button,'lostpointercapture',34);
          if(input[action]) throw Error('capture loss left action');
          firePointer(button,'pointerdown',35);
          firePointer(button,'pointercancel',35);
          if(input[action]) throw Error('cancel left action');
        }
        firePointer(els.stick,'lostpointercapture',11);
        if(input.right || stickPointer!==null) throw Error('stick capture loss');
        for(const type of ['pointerup','pointercancel']) {
          firePointer(els.stick,'pointerdown',44,x,y-30);
          firePointer(els.stick,type,44);
          if(input.up || stickPointer!==null || els.knob.style.transform!=='translate(0px, 0px)') throw Error('stick reset failed');
        }
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD'}));
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));
        window.dispatchEvent(new Event('blur'));
        if(input.right || input.bomb || heldKeys.size || actionPointers.size) throw Error('blur left input');
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',repeat:true}));
        if(input.right) throw Error('repeat restored stale key');
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA'}));
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
        if(input.left) throw Error('hidden left input');
        delete document.hidden;
      });
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(()=>input.bomb),true);
      await page.evaluate(()=>{input.bomb=false;});
      await page.locator('#bombButton').click();
      assert.equal(await page.evaluate(()=>input.bomb),true);
      await page.evaluate(()=>{input.bomb=false;});
      // Advance a frame between mouse down and up to detect a second queued click.
      const box=await page.locator('#bombButton').boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down();
      await page.evaluate(()=>{input.bomb=false;}); await page.mouse.up();
      assert.equal(await page.evaluate(()=>input.bomb),false);
      const chainResult=await page.evaluate(async()=>{
        const wait=ms=>new Promise(r=>setTimeout(r,ms));
        const setup=()=>{
          startGame(); state.player.shield=100;
          state.map=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x===0||y===0||x===COLS-1||y===ROWS-1?TILE_SOLID:TILE_EMPTY));
          const a={x:3,y:3,blast:2},b={x:4,y:3,blast:2}; state.bombs=[a,b]; explodeBomb(a); return b;
        };
        let b=setup(); const scheduled=chainTimers.size; await wait(15); if(b.exploded) throw Error('chain too early');
        await wait(70); if(!b.exploded || chainTimers.size) throw Error('normal chain failed');
        for(const transition of [clearStage,endGame,startGame,showTitle,generateStage]) {
          b=setup(); transition(); const generation=stageGeneration;
          await wait(70); if(b.exploded || chainTimers.size || generation!==stageGeneration) throw Error('stale chain');
        }
        return scheduled;
      });
      assert.ok(chainResult>0);
      await page.evaluate(()=>{startGame();state.score=4321;state.stage=7;saveRecords();});
      await page.reload();
      assert.deepEqual(await page.evaluate(()=>[state.bestScore,state.bestStage]),[4321,7]);
      await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('Quota exceeded');};startGame();state.score=9000;endGame();});
      assert.equal(await page.evaluate(()=>state.bestScore),9000);
      await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}});});
      await page.reload(); await page.locator('[data-sp="freeze"]').click(); await page.locator('#startButton').click();
      await page.evaluate(()=>{state.score=123;clearStage();}); await page.locator('.upgrade-card').first().click();
      await page.evaluate(()=>endGame()); await page.locator('#retryButton').click();
      assert.equal(await page.evaluate(()=>state.mode),'play');
      if(process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
        await page.setViewportSize({width:320,height:568});
        await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,type.name()+'-320.png')});
        await page.evaluate(()=>showTitle());
        await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,type.name()+'-title.png')});
      }
      const live=await browser.newPage({viewport:{width:390,height:844}});
      live.on('pageerror',e=>errors.push(e.message));
      await live.goto(url); await live.locator('#startButton').click();
      const before=await live.evaluate(()=>state.player.x);
      await live.keyboard.down('KeyD'); await live.waitForTimeout(160); await live.keyboard.up('KeyD');
      assert.ok(await live.evaluate(()=>state.player.x)>before);
      await live.keyboard.press('Space'); await live.waitForTimeout(80);
      assert.equal(await live.evaluate(()=>state.bombs.length),1);
      await live.close();
      assert.deepEqual(errors,[]);
      console.log(type.name(),'multitouch, pointer reset, duplicate prevention, keyboard, blur/visibility, 40ms chain/transitions, records, blocked storage PASS');
    } finally { await browser.close(); }
  }
})().catch(e=>{ console.error(e);process.exitCode=1; }).finally(()=>server.close());
