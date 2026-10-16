const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };
const tick = () => new Promise(r => setImmediate(r));
async function main() {
  let requests = 0, starts = 0, stopped = 0, frames = 0;
  let permission = deferred();
  const stream = () => ({active:true,getTracks:()=>[{stop(){stopped++;}}]});
  class MediaRecorder {
    static isTypeSupported(){return true;}
    constructor(){this.state='inactive';this.mimeType='audio/mp4';}
    start(){this.state='recording';starts++;}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['voice'])});this.onstop();});}
  }
  const context = {createMediaStreamSource:()=>({connect(){},disconnect(){}}), createAnalyser:()=>({frequencyBinCount:2,getByteTimeDomainData(d){d.fill(128);},disconnect(){}})};
  const env = {window:{MediaRecorder,setTimeout},MediaRecorder,navigator:{mediaDevices:{getUserMedia(){requests++;return permission.promise;}}},DOMException,Blob,performance,setTimeout,clearTimeout,requestAnimationFrame(){return ++frames;},cancelAnimationFrame(){frames=0;}};
  vm.runInNewContext(read('js/RecorderManager.js'),env);
  const recorder = new env.window.RecorderManager({unlock:async()=>context});
  const cancelled = recorder.start(5,()=>{},()=>{});
  recorder.release(); permission.resolve(stream());
  await assert.rejects(cancelled,{name:'AbortError'});
  assert.equal(starts,0); assert.equal(requests,1); assert.ok(stopped);
  permission=deferred(); permission.resolve(stream());
  const recording = recorder.start(5,()=>{},()=>{}); await tick();
  await assert.rejects(recorder.start(5,()=>{},()=>{}));
  recorder.stop(); const blob=await recording;
  assert.equal(starts,1); assert.equal(blob.size,5); assert.equal(recorder.stream,null); assert.equal(recorder.timer,null); assert.equal(frames,0);
  // A late old onstop must not release a new stream.
  const old = recorder.start(5,()=>{},()=>{}); await tick(); recorder.release();
  permission=deferred(); permission.resolve(stream()); const next=recorder.start(5,()=>{},()=>{}); await old; await tick();
  assert.ok(recorder.stream); recorder.stop(); await next;
  const audioEnv={window:{navigator:{}} ,setTimeout,clearTimeout,console};
  vm.runInNewContext(read('js/SoundManager.js'),audioEnv);
  const sound=new audioEnv.window.SoundManager({defaultSettings:{}});
  const resumed=deferred();let resumeCalls=0;
  sound.primeMediaElement=()=>null;sound.primeContext=()=>{};sound.stopMediaUnlock=()=>{};sound.applyVolume=()=>{};
  sound.context={state:'suspended',resume(){resumeCalls++;return resumed.promise;}};
  sound.waitForResume=async()=>{await resumed.promise;sound.context.state='running';};
  const unlock1=sound.unlock(),unlock2=sound.unlock(),unlock3=sound.recover();
  resumed.resolve();await Promise.all([unlock1,unlock2,unlock3]);assert.equal(resumeCalls,1);
  const loopUnlock=deferred();sound.unlock=()=>loopUnlock.promise;
  const loop=sound.startLoop('bgm');sound.stopAllLoops();loopUnlock.resolve();assert.equal(await loop,false);
  const app=read('js/app.js');
  const nodes=new Map(); const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,classList:{remove(){},add(){}},offsetWidth:1});return nodes.get(id);};
  let gameStops=0, loopStops=0;
  const state={gameSession:0,selectedGameId:'shooter',gameEnded:false};
  let wait;
  const scope={state,$,games:{stop(){gameStops++;}},sound:{stopAllLoops(){loopStops++;}},clearTimeout,clearInterval,setTimeout(fn){wait=fn;return 1;},Promise};
  for (const [start,end] of [['  function cancelWait','  function recordingPhase'],['  async function gameCountdown','  function bestScoreFor']]) vm.runInNewContext(app.slice(app.indexOf(start),app.indexOf(end)),scope);
  const countdown=scope.gameCountdown(()=>state.gameSession===0);
  scope.invalidateGame(); wait(); await countdown;
  assert.equal($('#gameCountdown').hidden,true);assert.equal(gameStops,1);assert.equal(loopStops,1);
  let refreshCalls=0;const finishing=deferred();
  Object.assign(scope,{storage:{setState:()=>finishing.promise},library:{refresh(){refreshCalls++;}},gameSounds(){throw Error('Stale result rendered');}});
  state.shooterBest=0;
  vm.runInNewContext(app.slice(app.indexOf('  async function finishGame'),app.indexOf('  function formatTime')),scope);
  const oldFinish=scope.finishGame({score:10},state.gameSession);scope.invalidateGame();finishing.resolve();await oldFinish;assert.equal(refreshCalls,0);
  const gmEnv={window:{}};vm.runInNewContext(read('js/GameManager.js'),gmEnv);
  let endCount=0;
  class Game{constructor(c,s,t,end){this.end=end;}start(){}stop(){}}
  const manager=new gmEnv.window.GameManager({}, {a:{}}).registerGame('a',Game);
  await manager.startGame('a',null,{},()=>endCount++);const oldGame=manager.current;
  manager.stop();oldGame.end({}); assert.equal(endCount,0);
  await manager.startGame('a',null,{},()=>endCount++); manager.current.end({});manager.current.end({});assert.equal(endCount,1);
  const storageEnv={window:{}};vm.runInNewContext(read('js/StorageManager.js'),storageEnv);
  const storage=new storageEnv.window.StorageManager({}); const tx={objectStore(){return {};}}; const req={result:'saved'};
  storage.db={transaction(){return tx;}};
  let saved=false;const save=storage.request('packs','readwrite',()=>req).then(()=>saved=true);
  req.onsuccess?.();await tick();assert.equal(saved,false);tx.oncomplete();await save;assert.equal(saved,true);
  const failed=storage.request('packs','readwrite',()=>req); tx.onabort();await assert.rejects(failed);
  console.log('Lifecycle safety passed: late permission cancellation, duplicate recording, track/meter/timer cleanup, isolated stop callbacks, cancelled countdown, stale/duplicate game results, transaction completion/abort.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
