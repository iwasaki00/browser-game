"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9342;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "qwop-phase1c-"));
const output = path.join(os.tmpdir(), "qwop-mobile-browser-test");
const root = path.resolve(__dirname, "../..");
const server = http.createServer((request, response) => {
  let file = path.resolve(root, "." + decodeURIComponent(request.url.split("?")[0]));
  if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
  response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(response);
});
fs.mkdirSync(output, { recursive: true });
let browser;
let socket;
let nextId = 1;
const pending = new Map();
const errors = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function retry(task, attempts = 60) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try { return await task(); } catch (error) { lastError = error; await wait(100); }
  }
  throw lastError;
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result.result.value;
}

async function screenshot(name) {
  const response = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(path.join(output, name), Buffer.from(response.result.data, "base64"));
}

(async () => {
  assert(fs.existsSync(chrome), "Chrome is required");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const gameUrl = `http://127.0.0.1:${server.address().port}/029_qwop-runner/?raceTest=1`;
  browser = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-default-apps",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    gameUrl
  ], { stdio: "ignore" });
  const target = await retry(async () => {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    const page = pages.find(item => item.type === "page" && item.url.includes("029_qwop-runner"));
    if (!page) throw new Error("page not ready");
    return page;
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await retry(async () => {
    if (!await evaluate("document.readyState === 'complete' && Boolean(window.QWOPTraining)")) throw new Error("scripts not ready");
    return true;
  });


  const state = () => evaluate("window.__QWOP_RACE_TEST__.snapshot()");
  const reset = () => evaluate("window.__QWOP_RACE_TEST__.retry()");
  // Synthetic pointers intentionally exercise capture failure and the window fallback.
  await evaluate(`window.key = (type, key) => document.dispatchEvent(new KeyboardEvent(type, { key, bubbles:true }));
    window.ptr = (type, id, key='q') => document.querySelector('.controls [data-key="'+key+'"]').dispatchEvent(new PointerEvent(type, { pointerId:id, button:0, bubbles:true, cancelable:true }));
    window.pressed = key => document.querySelector('.controls [data-key="'+key+'"]').getAttribute('aria-pressed') === 'true';`);
  assert.deepEqual(await evaluate(`(() => {
    ptr('pointerdown', 11); key('keydown','q'); key('keyup','q'); const touchSurvives=pressed('q');
    ptr('pointerdown',12); ptr('pointerup',11); const secondSurvives=pressed('q');
    key('keydown','q'); ptr('pointercancel',12); const keyboardSurvives=pressed('q');
    key('keyup','q'); const allOff=!pressed('q');
    ['q','w','o','p'].forEach((k,i)=>ptr('pointerdown',20+i,k));
    const four=['q','w','o','p'].every(pressed);
    ['q','w','o','p'].forEach((k,i)=>ptr('lostpointercapture',20+i,k));
    return {touchSurvives,secondSurvives,keyboardSurvives,allOff,four,cleared:['q','w','o','p'].every(k=>!pressed(k))};
  })()`), {touchSurvives:true,secondSurvives:true,keyboardSurvives:true,allOff:true,four:true,cleared:true});
  await send('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:5});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await wait(60);
  const touches=await evaluate(`['q','w','o','p'].map((key,id)=>{const r=document.querySelector('.controls [data-key="'+key+'"]').getBoundingClientRect();return {id,x:r.x+r.width/2,y:r.y+r.height/2}})`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});
  assert.equal(await evaluate("['q','w','o','p'].every(pressed)"),true,'real touch pointer capture');
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await evaluate("['q','w','o','p'].every(k=>!pressed(k))"),true);
  await evaluate("key('keydown','q'); window.dispatchEvent(new Event('blur'))");
  const paused = await state();
  assert.equal(paused.paused,true); assert.equal(paused.recordValid,false);
  assert.equal(await evaluate("pressed('q')"),false);
  const motion=await evaluate("window.__QWOP_RACE_TEST__.motionSnapshot()");
  await wait(180);
  assert.deepEqual(await evaluate("window.__QWOP_RACE_TEST__.motionSnapshot()"),motion,'physics freezes while paused');
  assert.deepEqual(await state(),paused,'pause freezes time and distance');
  await evaluate("window.dispatchEvent(new Event('focus'))");
  assert.equal((await state()).paused,true,'focus cannot resume');
  await evaluate("document.querySelector('#resumeButton').click()");
  await wait(80);
  const resumed=await state();
  assert.equal(resumed.paused,false); assert(resumed.elapsedMs > paused.elapsedMs);
  assert(resumed.elapsedMs - paused.elapsedMs < 150,'no catch-up');
  await evaluate("window.__QWOP_RACE_TEST__.ready(); window.__QWOP_RACE_TEST__.beginCountdown(); window.dispatchEvent(new Event('pagehide'))");
  assert.equal((await state()).state,'COUNTDOWN');
  await wait(100); assert.equal((await state()).state,'COUNTDOWN');
  assert.equal((await state()).recordValid,true);
  await evaluate("document.querySelector('#resumeButton').click()"); await wait(100);
  assert.equal((await state()).state,'RUNNING');
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'))");
  assert.equal((await state()).paused,true);
  await evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))");
  assert.equal((await state()).paused,true);
  await evaluate("key('keydown','Enter')");
  assert.equal((await state()).paused,false);
  await reset();
  await evaluate("document.querySelector('#trainingButton').click(); key('keydown','q'); key('keydown','o')");
  await wait(260);
  assert.equal(await evaluate("document.querySelector('#trainingHistory').textContent.includes('GOOD')"),true);
  assert.equal((await state()).recordValid,true,'manual TRAINING stays valid');
  await evaluate("key('keyup','q'); key('keyup','o'); document.querySelector('#watchDemo').click(); window.dispatchEvent(new Event('blur'))");
  const demoTiming=await evaluate("document.querySelector('#timingProgress').style.width");
  await wait(150); assert.equal(await evaluate("document.querySelector('#timingProgress').style.width"),demoTiming);
  assert.equal(await evaluate("['q','w','o','p'].every(k=>!pressed(k))"),true);
  await evaluate("document.querySelector('#resumeButton').click(); key('keydown','p'); key('keyup','q')");
  assert.equal(await evaluate("pressed('p')"),false,'manual input excluded from demo');
  await retry(async () => {
    if (await evaluate("document.querySelector('#watchDemo').disabled")) throw new Error('demo not finished');
  },50);
  assert.equal(await evaluate("['q','w','o','p'].every(k=>!pressed(k))"),true,'demo ends with no held input');
  assert.equal((await state()).recordValid,false,'demo cannot restore VALID');
  await reset();
  await evaluate("window.__QWOP_RACE_TEST__.forceDistance(100)");
  const goalMotion=await evaluate("window.__QWOP_RACE_TEST__.motionSnapshot()");
  const goal=await state(); await wait(80); assert.deepEqual(await state(),goal);
  assert.deepEqual(await evaluate("window.__QWOP_RACE_TEST__.motionSnapshot()"),goalMotion);
  for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await evaluate("window.__QWOP_RACE_TEST__.ready()"); await wait(80);
    const check = async selectors => {
      const boxes=await evaluate(`(${JSON.stringify(selectors)}).map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,x:r.x,y:r.y,right:r.right,bottom:r.bottom}})`);
      for(const box of boxes) assert(box.x>=0 && box.y>=0 && box.right<=width+1 && box.bottom<=height+1,`${width}x${height} ${JSON.stringify(box)}`);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
    };
    await check(['.race-hud','#debugButton','#retryButton','#difficultyBadge','#startRaceButton',...['q','w','o','p'].map(k=>`.controls [data-key="${k}"]`)]);
    await reset(); await evaluate("window.__QWOP_RACE_TEST__.forceDistance(100)");
    await check(['#raceResult','#runAgainButton']);
    await screenshot(`mobile-${width}x${height}-goal.png`);
    await reset(); await evaluate("window.__QWOP_RACE_TEST__.triggerGameOver(10)");
    await check(['#raceResult','#runAgainButton']);
  }
  assert.deepEqual(errors,[]);
  console.log('Mobile browser tests passed: mixed input, four pointers, capture fallback, pause/resume, countdown, demo, terminal states, five viewports');
})().catch(error => { console.error(error); process.exitCode=1; }).finally(() => {
  try { socket?.close(); } catch {}
  try { browser?.kill(); } catch {}
  server.close();
});
