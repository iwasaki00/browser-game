// Targeted layout checks. Requires Node 22+ and a local Chrome/Edge installation.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browserPath = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => require('node:fs').existsSync(p));
  assert.ok(browserPath, 'Set BROWSER_PATH to a Chrome/Edge executable');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'two-player-mobile-'));
  const server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { const data = await fs.readFile(file); res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream'); res.end(data); } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--in-process-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  const deadline = setTimeout(() => { console.error('browser test timeout'); browser.kill(); server.closeAllConnections(); process.exit(1); }, 25000);
  try {
    let port;
    for (let i = 0; i < 100; i++) { try { port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {} await sleep(100); }
    assert.ok(port, 'Browser debugging endpoint did not start');
    const targets = await fetch('http://127.0.0.1:' + port + '/json/list', {signal:AbortSignal.timeout(5000)}).then(r => r.json());
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

    let id = 0; const pending = new Map(), errors = [];
    ws.onmessage = ({data}) => { const message = JSON.parse(data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); if (message.id) { const entry = pending.get(message.id); if (entry) { pending.delete(message.id); message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result); } } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timeout = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 5000); pending.set(key, {resolve: value => {clearTimeout(timeout);resolve(value);}, reject: error => {clearTimeout(timeout);reject(error);}}); ws.send(JSON.stringify({ id:key, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}); assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value; };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', {source: 'Object.defineProperty(window,"GameManager",{configurable:true,set(Base){Object.defineProperty(window,"GameManager",{value:class extends Base{constructor(...args){super(...args);window.__manager=this;}}});}});'});
    await send('Page.navigate', {url: 'http://127.0.0.1:' + server.address().port + '/'});
    for (let i = 0; i < 100; i++) { if (await evaluate('!!window.__manager')) break; await sleep(50); }
    assert.ok(await evaluate('!!window.__manager'));
    const check = async (width, height, game) => {
      await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor:1, mobile:true});
      await evaluate('window.__manager.launch(' + JSON.stringify(game) + ')'); await sleep(100);
      const layout = await evaluate(`(() => {
        const rect = e => { const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}; };
        const zones=[...document.querySelectorAll('.control-zone')].map(rect);
        const buttons=[...document.querySelectorAll('.joint-grid button')].filter(e=>e.getBoundingClientRect().height).map(rect);
        return {zones,buttons,arena:rect(document.querySelector('.arena')),overflow:document.documentElement.scrollWidth>innerWidth};
      })()`);
      assert.equal(layout.overflow, false, width+'x'+height+' overflow');
      assert.ok(Math.abs(layout.zones[0].h-layout.zones[1].h)<1);
      assert.ok(layout.arena.h>80, 'arena too small: '+JSON.stringify(layout));
      assert.ok(layout.zones[0].b<=layout.arena.y+1 && layout.arena.b<=layout.zones[1].y+1);
      for (const b of layout.buttons) assert.ok(b.x>=0 && b.r<=width && b.y>=0 && b.b<=height && b.h>=44, 'joint button clipped: '+JSON.stringify(b));
      await evaluate('window.__manager.currentGame.stop();window.__manager.showResult(0,"引き分け");'); await sleep(450);
      const result = await evaluate(`(() => { const panel=document.querySelector('.result-panel');const cards=[...panel.querySelectorAll('.result-card')]; const buttons=[...panel.querySelectorAll('button')]; return {visible:!panel.hidden, titles:cards.map(c=>c.querySelector('h2').textContent), bad:[...cards,...buttons].filter(e=>{const r=e.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5;}).map(e=>e.outerHTML)}; })()`);
      assert.equal(result.visible,true); assert.deepEqual(result.titles,['DRAW!','DRAW!']);assert.deepEqual(result.bad,[], width+'x'+height+' result clipped');
      await evaluate('window.__manager.replay();window.__manager.replay();window.__manager.showMenu();'); await sleep(50);
      assert.equal(await evaluate('document.querySelector("#resultPanel").hidden'),true);
      console.log(width+'x'+height+' '+game+': layout, dual result, replay/menu passed');
    };
    for (const [w,h] of [[320,568],[375,667],[390,844],[430,932],[844,390]]) await check(w,h,'boxing');
    await check(320,568,'sumo'); await check(390,844,'hockey');
    await send('Emulation.setTouchEmulationEnabled', {enabled:true, maxTouchPoints:5});
    await evaluate('window.__manager.launch("boxing")'); await sleep(100);
    await evaluate('window.__manager.clearCountdown(); window.__manager.currentGame.start()');
    const points = await evaluate(`[document.querySelector('[data-player="0"][data-joint="arm1Shoulder"]'),document.querySelector('[data-player="1"][data-joint="arm2Elbow"]')].map((e,i)=>{const r=e.getBoundingClientRect();return {id:i+1,x:r.x+r.width/2,y:r.y+r.height/2};})`);
    const held = () => evaluate('[window.__manager.currentGame.players[0].joints.arm1Shoulder.holding,window.__manager.currentGame.players[1].joints.arm2Elbow.holding]');
    await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:points});
    assert.deepEqual(await held(),[true,true]);
    await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[points[0]]});
    assert.deepEqual(await held(),[false,true], 'P1 release must leave P2 holding');
    await send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]});
    assert.deepEqual(await held(),[false,false]);
    await send('Input.dispatchKeyEvent', {type:'rawKeyDown',code:'KeyQ',key:'q',windowsVirtualKeyCode:81});
    assert.deepEqual(await held(),[true,false]);
    await send('Input.dispatchKeyEvent', {type:'keyUp',code:'KeyQ',key:'q',windowsVirtualKeyCode:81});
    assert.deepEqual(await held(),[false,false]);
    await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:points});
    await evaluate('window.dispatchEvent(new Event("blur"))');
    assert.deepEqual(await held(),[false,false]);
    assert.equal(await evaluate('window.__manager.currentGame.inputPointers.size'),0);
    await send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]});
    await evaluate('window.__manager.showMenu()');
    assert.equal(await evaluate('document.querySelector("#menuScreen").dispatchEvent(new Event("gesturestart",{bubbles:true,cancelable:true}))'),true);
    console.log('Browser touch: simultaneous joints, independent release, cancel, blur, PC keys and menu gestures passed');
    assert.deepEqual(errors,[],'browser runtime errors');
    console.log('targeted mobile browser smoke tests passed (Chromium emulation, not iPhone hardware)');
  } finally {
    clearTimeout(deadline); if(ws) ws.close(); browser.kill(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await sleep(500);
    // Only remove the uniquely created test profile under the OS temp directory.
    if (path.dirname(profile) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('two-player-mobile-')) await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
