// Focused desktop Chromium checks; Safari's gesture policy still needs a device.
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const injection = `
window.test = {audio, sequencer, replay, game, input, recorder, renderer, ui,
 beginGame, startSession, restartGame, startReplay, stopReplay, setBpm,
 openSettings, closeSettings, toggleListenMode, setDebugPaused, applySettings,
 get state(){return latestState}, get pending(){return backgroundResume},
 get handler(){return resumePointerHandler}, get listen(){return listenMode},
 get settings(){return settings}, get settingsOpen(){return settingsOpen},
 get replayMode(){return replayMode},
 hide(){Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))},
 show(){Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))},
 tap(){document.dispatchEvent(new PointerEvent('pointerdown',{pointerId:100}))}
};`;
let chrome, ws, profile;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    let data = await fs.readFile(file);
    if (file.endsWith(path.join('js', 'main.js'))) data = Buffer.from(data.toString() + injection);
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
let serial = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
  if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function check(name, expression) {
  const result = await evaluate(expression);
  if (!result) console.log('STATE', await evaluate(`({status:test.state.status, audio:test.audio.context.state, running:test.sequencer.isRunning, pending:test.pending,handler:Boolean(test.handler),toast:document.getElementById('toast').textContent})`));
  assert.equal(result, true, name);
  console.log('PASS', name);
}
async function settleResume() {
  for(let n=0;n<40 && await evaluate('Boolean(test.pending)');n++) await sleep(25);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'beat-stack-test-'));
  chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9334',
    '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, 'about:blank',
  ], {stdio:'ignore', windowsHide:true});
  let pages;
  for (let i=0;i<100;i++) {
    try { pages = await (await fetch('http://127.0.0.1:9334/json')).json(); break; } catch { await sleep(100); }
  }
  assert.ok(pages, 'Chrome debugger started');
  ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open', resolve, {once:true}));
  ws.addEventListener('message', e=>{
    const r=JSON.parse(e.data), p=pending.get(r.id);
    if(p){ pending.delete(r.id); r.error?p.reject(Error(r.error.message)):p.resolve(r.result); }
  });
  await send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/`});
  for(let i=0;i<100 && !await evaluate('Boolean(window.test)');i++) await sleep(50);
  await evaluate('test.startSession()');
  await check('audio loaded; game starts', 'test.audio.loadedCount === test.audio.totalCount && test.state.status === "running"');
  await check('menu link removed; zoom permitted', '!document.querySelector(".back-link") && !document.querySelector("meta[name=viewport]").content.includes("maximum-scale")');
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390],[1280,900]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await sleep(80);
    const layout = await evaluate(`(() => {
      const rect=id=>document.getElementById(id).getBoundingClientRect();
      const b=rect('boardStage'), c=rect('controls');
      return {board:[b.width,b.height], controls:[c.top,c.bottom], width:document.documentElement.scrollWidth,
        valid: (${width}>1000 || (c.bottom<=innerHeight+1 && b.bottom<=innerHeight+1)) && (b.bottom<=c.top+1 || b.right<=c.left+1),
        buttons:[...document.querySelectorAll('.control')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.height>=42})};
    })()`);
    assert.ok(layout.valid && layout.buttons && layout.width<=width, JSON.stringify({width,height,layout}));
    console.log('PASS layout', width,height,JSON.stringify(layout));
    if (process.env.SNAPSHOT_DIR && [320,390,844].includes(width)) {
      const shot = await send('Page.captureScreenshot', {format:'png'});
      await fs.mkdir(process.env.SNAPSHOT_DIR, {recursive:true});
      await fs.writeFile(path.join(process.env.SNAPSHOT_DIR, `${width}x${height}.png`), Buffer.from(shot.data,'base64'));
    }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.documentElement.style.cssText='--safe-top:47px;--safe-bottom:34px;--safe-left:0px;--safe-right:0px'`);
  await sleep(60);
  await check('safe area fits compact portrait', `(() => {const c=document.getElementById('controls').getBoundingClientRect(),b=document.getElementById('boardStage').getBoundingClientRect();return c.bottom<=568-34+1&&b.bottom<=c.top})()`);
  await evaluate(`document.documentElement.style.cssText=''`);
  await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.documentElement.style.cssText='--safe-left:44px;--safe-right:44px;--safe-bottom:21px'`);
  await sleep(60);
  await check('safe area fits landscape', `(() => {const c=document.getElementById('controls').getBoundingClientRect(),b=document.getElementById('boardStage').getBoundingClientRect();return c.right<=800&&c.bottom<=369&&b.left>=44&&b.bottom<=369})()`);
  await evaluate(`document.documentElement.style.cssText=''`);
  await check('PC keyboard mappings remain active', `(() => {const old=test.input.actions,calls=[];test.input.setActions({onAction:a=>calls.push(a)});for(const code of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyZ','KeyX'])window.dispatchEvent(new KeyboardEvent('keydown',{code,cancelable:true}));test.input.setActions(old);return calls.join(',')==='left,right,rotate-cw,rotate-ccw,drop,rotate-ccw,rotate-cw'})()`);
  await check('live BPM and settings stay synchronized', `(() => {const e=document.getElementById('liveBpm');e.value='140';e.dispatchEvent(new Event('change'));return test.sequencer.bpm===140&&document.getElementById('settingsBpm').value==='140'&&document.getElementById('bpmValue').textContent==='140'})()`);
  await sleep(350);
  await check('sequencer advances after BPM change', 'test.sequencer.isRunning && test.sequencer.currentStep >= 0');
  await check('input ignores second finger and keeps swipes/double tap', `(() => {
    const i=test.input, old=i.actions, calls=[];i.setActions({onAction:a=>calls.push(a)});
    const e=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,pointerType:'touch',preventDefault(){}});
    i._handleGestureStart(e(1,100,100));i._handleGestureStart(e(2,200,200));i._handleGestureEnd(e(2,250,200));
    const tracked=i._gesture.pointerId===1;i._handleGestureEnd(e(1,140,100));
    i._handleGestureStart(e(1,100,100));i._handleGestureEnd(e(1,100,50));
    i._handleGestureStart(e(1,100,100));i._handleGestureEnd(e(1,100,150));
    for(let n=0;n<2;n++){i._handleGestureStart(e(1,100,100));i._handleGestureEnd(e(1,100,100));}
    const result=tracked&&calls.join(',')==='right,rotate-cw,rotate-ccw,drop';i.setActions(old);return result;
  })()`);
  await check('cancel/lost capture reset gesture and tap history', `(() => {
    const i=test.input,e={pointerId:3,clientX:10,clientY:10,preventDefault(){}};
    i._lastTap={time:performance.now(),x:10,y:10};i._handleGestureStart(e);
    document.getElementById('boardStage').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:3}));
    return i._gesture===null&&i._lastTap===null;
  })()`);
  await check('long press repeat stops on cancellation', `(async()=>{
    const i=test.input,old=i.actions;let moves=0;i.setActions({left:()=>moves++});
    const b=document.querySelector('[data-action=left]');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:20}));
    await new Promise(r=>setTimeout(r,450));b.dispatchEvent(new PointerEvent('pointercancel',{pointerId:20}));
    const count=moves;await new Promise(r=>setTimeout(r,150));i.setActions(old);return count>=3&&moves===count&&i._repeatTimers.size===0;
  })()`);
  for(let n=0;n<3;n++) {
    await evaluate('test.hide();test.show()');await sleep(60);
    await check('background waits for gesture '+n, 'test.state.status==="paused"&&!test.sequencer.isRunning&&Boolean(test.handler)&&Boolean(test.pending)');
    await evaluate('test.tap()');await settleResume();
    await check('background resumes once '+n, 'test.state.status==="running"&&test.sequencer.isRunning&&!test.handler&&!test.pending');
  }
  await evaluate('test.hide();test.show();test.hide();test.show()');await sleep(60);
  await evaluate('test.tap()');await settleResume();
  await check('repeat hide before gesture preserves running intent', 'test.state.status==="running"&&test.sequencer.isRunning&&!test.handler');
  await evaluate('test.toggleListenMode();test.hide();test.show()');await sleep(60);
  await evaluate('test.tap()');await settleResume();
  await check('intentional listen pause preserved', 'test.listen&&test.state.status==="paused"&&test.sequencer.isRunning');
  await evaluate('test.toggleListenMode()');
  await evaluate('test.openSettings();test.hide();test.show()');await sleep(60);
  await evaluate('test.tap()');await settleResume();
  await check('settings keeps game paused after resume', 'test.settingsOpen&&test.state.status==="paused"&&test.sequencer.isRunning');
  await evaluate('test.closeSettings(false)');
  await check('closing settings restores play', 'test.state.status==="running"');
  await evaluate('test.hide();test.show()');await sleep(60);
  await evaluate('window.originalUnlock=test.audio.unlock.bind(test.audio);test.audio.unlock=async()=>false;test.tap()');await sleep(30);
  await check('failed unlock keeps retry listener and guidance', 'Boolean(test.handler)&&!test.sequencer.isRunning&&document.getElementById("toast").textContent.includes("もう一度")');
  await evaluate('test.audio.unlock=window.originalUnlock;test.tap()');await settleResume();
  await check('unlock retry succeeds', '!test.handler&&test.sequencer.isRunning');
  await evaluate('test.hide();test.show()');await sleep(60);
  await evaluate('test.audio.unlock=()=>new Promise(r=>window.resolveOld=r);test.tap();test.beginGame();test.setDebugPaused(true);window.resolveOld(true)');await sleep(40);
  await check('stale async unlock cannot change restarted game', '!test.sequencer.isRunning&&test.state.status==="paused"&&!test.handler');
  await evaluate('test.audio.unlock=window.originalUnlock;test.beginGame();test.openSettings();test.applySettings({...test.settings,bpm:160});test.closeSettings(false)');
  await check('settings and BPM preserve playback', 'test.state.status==="running"&&test.sequencer.bpm===160&&test.sequencer.isRunning');
  await sleep(500);
  await evaluate('test.game.debugForceGameOver()');await sleep(420);
  await evaluate('test.startReplay()');await sleep(70);
  await check('game over replay starts', 'test.replay.running&&test.replayMode&&!test.sequencer.isRunning');
  await evaluate('test.hide();test.show()');await sleep(60);
  await evaluate('test.tap()');await settleResume();
  await check('interrupted replay returns to results without restarting music', '!test.replay.running&&!test.replayMode&&!test.sequencer.isRunning&&!document.getElementById("gameOverOverlay").hidden');
  await evaluate('test.restartGame()');
  await check('retry starts cleanly', 'test.state.status==="running"&&test.sequencer.isRunning&&!test.replay.running&&!test.handler');
  await check('stopAll cancels active and scheduled sources', '(() => {test.audio.playPiece("I",test.audio.currentTime+10);test.audio.stopAll();return test.audio._activeSources.size===0})()');
  console.log('All focused checks passed. iPhone Safari hardware not tested.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  try { if(ws?.readyState===1) await send('Browser.close'); } catch {}
  ws?.close();chrome?.kill();server.close();
  if (profile) await fs.rm(profile, {recursive:true,force:true,maxRetries:10,retryDelay:100}).catch(()=>{});
});
