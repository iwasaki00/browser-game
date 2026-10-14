// Targeted checks. Run with Node 22+ and a local Chrome installation.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'rally-check-'));
  const server = http.createServer(async (req, res) => {
    const file = { '/': 'index.html', '/style.css': 'style.css', '/script.js': 'script.js' }[req.url];
    if (!file) { res.writeHead(404).end(); return; }
    let source = await fs.readFile(path.join(root, file), 'utf8');
    // Expose internals only in the served test copy; production code is untouched.
    if (file === 'script.js') source = source.replace('  resizeCanvas();\n  resetRace(false);',
      '  window.testRace = { state, input, activity, frame, resetRace, finishRace, updateSteering };\n  resizeCanvas();\n  resetRace(false);');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(source);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
    }
    assert(port, 'Chrome started');
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
      if (pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails));
      return reply.result.value;
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.requestAnimationFrame = callback => { window.nextFrame = callback; return 1; };' });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    for (let i = 0; i < 100 && !await evaluate('!!window.testRace'); i++) await delay(50);
    await send('Page.bringToFront');
    await evaluate("window.dispatchEvent(new Event('focus'))");
    const sizes = [[320,568], [375,667], [390,844], [430,932], [844,390]];
    for (const [width, height] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      await evaluate('testRace.resetRace(false)');
      await delay(220); // Let the overlay's existing opacity transition finish.
      const geometry = await evaluate(`(() => {
        const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
        const panel = document.querySelector('#startOverlay .panel');
        panel.scrollTop = panel.scrollHeight;
        return { panel:rect(panel), scroll:panel.scrollTop, overflow:panel.scrollHeight-panel.clientHeight,
          start:rect(document.getElementById('startButton')), controls:['wheelControl','turboButton','jumpButton'].map(id=>rect(document.getElementById(id))),
          meters:[...document.querySelectorAll('.meter strong')].map(e=>({width:e.clientWidth,content:e.scrollWidth})),
          cards:document.querySelectorAll('.course-card').length };
      })()`);
      assert(geometry.panel.y >= 0 && geometry.panel.bottom <= height, `panel contained ${width}`);
      assert(geometry.start.bottom <= geometry.panel.bottom, `START reachable ${width}`);
      assert.equal(geometry.cards, 4);
      if (geometry.overflow > 0) assert(geometry.scroll > 0, 'panel can scroll');
      for (const meter of geometry.meters) assert(meter.content <= meter.width, `HUD text fits ${width}`);
      for (const rect of geometry.controls) assert(rect.x >= 0 && rect.y >= 0 && rect.right <= width && rect.bottom <= height, `control contained ${width}`);
      for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
        const a=geometry.controls[i], b=geometry.controls[j];
        assert(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `controls separated ${width}`);
      }
      if (process.env.RALLY_SCREENSHOTS) {
        await fs.mkdir(process.env.RALLY_SCREENSHOTS, { recursive:true });
        const screenshot = await send('Page.captureScreenshot', { format:'png' });
        await fs.writeFile(path.join(process.env.RALLY_SCREENSHOTS, `${width}x${height}.png`), Buffer.from(screenshot.data,'base64'));
      }
      if (geometry.overflow > 0) {
        await evaluate('document.querySelector("#startOverlay .panel").scrollTop=0');
        const x=geometry.panel.x+geometry.panel.width/2, y=geometry.panel.y+geometry.panel.height-35;
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
        for (let distance=20;distance<=140;distance+=20) {
          await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance,id:1}]});
          await delay(25);
        }
        await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await delay(100);
        assert(await evaluate('document.querySelector("#startOverlay .panel").scrollTop')>0, 'overlay touch gesture scrolls');
      }
      await evaluate('testRace.resetRace(true); testRace.state.elapsed=65.432; testRace.finishRace()');
      await delay(220);
      const result = await evaluate(`(() => { const p=document.querySelector('#resultOverlay .panel'); p.scrollTop=p.scrollHeight; const r=p.getBoundingClientRect(); return {y:r.y,bottom:r.bottom,retry:document.getElementById('retryButton').getBoundingClientRect().bottom}; })()`);
      assert(result.y >= 0 && result.bottom <= height && result.retry <= result.bottom, `result fits ${width}`);
      if (process.env.RALLY_SCREENSHOTS && (width === 320 || width === 844)) {
        for (const phase of ['result','playing']) {
          if (phase === 'playing') await evaluate('testRace.resetRace(true); testRace.frame(1000)');
          const screenshot = await send('Page.captureScreenshot', { format:'png' });
          await fs.writeFile(path.join(process.env.RALLY_SCREENSHOTS, `${width}x${height}-${phase}.png`), Buffer.from(screenshot.data,'base64'));
        }
      }
      console.log(`PASS layout ${width}x${height} (panel scroll ${geometry.scroll}px)`);
    }
    await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true });
    await evaluate('testRace.resetRace(true)');
    const centers = await evaluate(`['wheelControl','turboButton','jumpButton'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})`);
    const touch = async (type, points) => send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({...p, id:i+1, radiusX:4, radiusY:4, force:1})) });
    await touch('touchStart', [centers[0]]);
    const firstId = await evaluate('testRace.input.pointerId');
    assert.notEqual(firstId, null);
    const moved = {...centers[0], x:centers[0].x+36};
    await touch('touchMove', [moved]);
    assert.equal(await evaluate('testRace.state.steerInput'), .5);
    await evaluate(`document.getElementById('wheelControl').dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,clientX:0,button:0,bubbles:true})); document.getElementById('wheelControl').dispatchEvent(new PointerEvent('pointerup',{pointerId:99,bubbles:true}));`);
    assert.equal(await evaluate('testRace.input.pointerId'), firstId);
    await touch('touchStart', [moved, centers[1], centers[2]]);
    const multi = await evaluate('({id:testRace.input.pointerId,turbos:testRace.state.turbos,jump:testRace.state.jumpTime})');
    assert.equal(multi.id, firstId); assert.equal(multi.turbos,2); assert(multi.jump > 0);
    await touch('touchEnd', []);
    assert.equal(await evaluate('testRace.input.pointerId'),null);
    assert.equal(await evaluate('testRace.state.steerInput'),.5, 'normal release retains gradual return');
    await evaluate('testRace.updateSteering(.1)');
    assert(Math.abs(await evaluate('testRace.state.steerInput')-.22) < 1e-8);
    await evaluate('testRace.updateSteering(1)');
    assert.equal(await evaluate('testRace.state.steerInput'),0);
    console.log('PASS multi-touch, second finger ignored, normal return');
    for (const eventType of ['pointercancel','lostpointercapture','reset']) {
      await touch('touchStart',[centers[0]]); await touch('touchMove',[moved]);
      const capturedId = await evaluate('testRace.input.pointerId');
      await evaluate(eventType === 'reset' ? 'testRace.resetRace(true)' : `document.getElementById('wheelControl').dispatchEvent(new PointerEvent('${eventType}',{pointerId:testRace.input.pointerId,bubbles:true}))`);
      assert.deepEqual(await evaluate(`({id:testRace.input.pointerId,drag:testRace.input.dragging,steer:testRace.state.steerInput,angle:document.getElementById('steeringWheel').style.getPropertyValue('--wheel-angle'),capture:document.getElementById('wheelControl').hasPointerCapture(${capturedId})})`), {id:null,drag:false,steer:0,angle:'0deg',capture:false});
      await touch('touchEnd',[]);
    }
    console.log('PASS cancel, lost capture, restart reset');
    for (const mode of ['blur','visibility']) {
      await evaluate(`testRace.resetRace(true); testRace.frame(1000); testRace.frame(1016); window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'})); ${mode === 'blur' ? "window.dispatchEvent(new Event('blur'));" : "Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));"}`);
      const before = await evaluate('({y:testRace.state.y,time:testRace.state.elapsed})');
      await evaluate('testRace.frame(500000)');
      assert.deepEqual(await evaluate('({y:testRace.state.y,time:testRace.state.elapsed})'),before);
      assert.equal(await evaluate('testRace.input.keyRight'),false);
      await evaluate(mode === 'blur' ? "window.dispatchEvent(new Event('focus'))" : "Object.defineProperty(document,'hidden',{configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); ");
      await evaluate('testRace.frame(900000)');
      assert.deepEqual(await evaluate('({y:testRace.state.y,time:testRace.state.elapsed})'),before);
      await evaluate('testRace.frame(900016)');
      assert(Math.abs(await evaluate('testRace.state.elapsed') - before.time - .016) < 1e-8);
    }
    console.log('PASS blur/visibility pause and resume clock');
    await evaluate("testRace.resetRace(true); window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft'})); testRace.updateSteering(.1)");
    assert(await evaluate('testRace.state.steerInput') < 0);
    await evaluate("window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft'})); window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'})); testRace.updateSteering(1); window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight'})); window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'})); window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft'}));");
    assert.deepEqual(await evaluate('({steer:testRace.state.steerInput,turbos:testRace.state.turbos,jump:testRace.state.jumpTime>0})'),{steer:1,turbos:2,jump:true});
    for (const course of ['forest','drift','rocky','marsh']) {
      await evaluate(`testRace.resetRace(false); document.querySelector('[data-course="${course}"]').click()`);
      assert.equal(await evaluate('testRace.state.selectedCourse'),course);
      await evaluate("document.getElementById('startButton').click(); testRace.state.elapsed=61.234; testRace.finishRace()");
      assert.equal(await evaluate(`localStorage.getItem('rallyRushBestTime:${course}')`),'61.234');
      await evaluate('testRace.resetRace(true); testRace.state.elapsed=70; testRace.finishRace()');
      assert.equal(await evaluate(`localStorage.getItem('rallyRushBestTime:${course}')`),'61.234');
    }
    assert.equal(await evaluate('document.querySelectorAll(".back,.menu-link").length'),0);
    assert(!await evaluate('document.querySelector("meta[name=viewport]").content.includes("user-scalable")'));
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".overlay")).touchAction'),'pan-y pinch-zoom');
    assert.equal(await evaluate('getComputedStyle(document.getElementById("wheelControl")).touchAction'),'none');
    assert.deepEqual(errors,[]);
    console.log('PASS keyboard, four courses, time format/storage, overlay touch policy, no browser errors');
  } finally {
    if (socket) socket.close();
    chrome.kill();
    server.close();
    await delay(500);
    // Only the freshly created, uniquely named temporary browser profile is removed.
    await fs.rm(profile, {recursive:true, force:true, maxRetries:10, retryDelay:200});
  }
})().catch(error => { console.error(error); process.exitCode=1; });
