"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    hidden: id.endsWith("Overlay"), disabled: false, value: "", dataset: {}, style: {}, textContent: "",
    listeners: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }, removeEventListener() {},
    setAttribute() {}, querySelector() { return element(id + "-label"); }, focus() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 440 }; }
  });
  return elements.get(id);
}
const local = new Map();
let failWrites = false, confirmAnswer = true, confirmations = 0, audioUnlock = () => Promise.resolve(false);
const document = {
  hidden: false, listeners: {},
  getElementById: element, querySelector: element, querySelectorAll: () => [],
  createElement: () => element("style"), head: { appendChild() {} },
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
};
const context = vm.createContext({
  console, performance, URLSearchParams, document, location: { search: "" }, Matter: require("../vendor/matter.min.js"),
  setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  addEventListener() {}, confirm() { confirmations++; return confirmAnswer; },
  localStorage: { getItem: key => local.get(key) || null, setItem(key, value) { if (failWrites) throw Error("quota"); local.set(key, value); } }
});
context.window = context;
for (const file of ["config", "stages", "parts", "physics", "history", "game", "stages-full", "parts-advanced", "game-advanced", "storage", "input"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", file + ".js"), "utf8"), context);
}
const P = context.PythagoraLab;
const game = new P.Game();
game.loadStage(P.createFreeStage());
const ramp = game.addPart("ramp");
const edited = JSON.stringify(game.serializeDesign());
const baseline = [game.physics.bodyCount, game.physics.constraintCount];
for (let i = 0; i < 12; i++) {
  assert(game.startExperiment());
  game.update(100);
  assert.equal(JSON.stringify(game.exportWork("test").parts), edited);
  assert(game.reset());
  assert.equal(JSON.stringify(game.serializeDesign()), edited);
  assert.deepEqual([game.physics.bodyCount, game.physics.constraintCount], baseline);
}
// Stopping twice must not resurrect an obsolete experiment snapshot.
game.deleteSelected();
game.selectPart(game.designParts.find(p => p.id === ramp.id));
game.rotateSelected(1);
const rotated = JSON.stringify(game.serializeDesign());
assert.equal(game.stopExperiment(), false);
assert.equal(JSON.stringify(game.serializeDesign()), rotated);
game.reset();
assert(game.undo());
assert.equal(JSON.stringify(game.serializeDesign()), rotated);
assert(game.redo());
assert.equal(game.designParts.length, 2);
// Drag -> second finger rolls back; unrelated pointerup cannot finish a drag.
const canvas = element("canvas");
const renderer = { scale: 1, baseScale: 1, cssWidth: 760, cssHeight: 440, camera: {x:380,y:220,zoom:1},
  screenToWorld: (x,y) => ({x,y}), setCamera(next) { this.camera = next; } };
const input = new P.InputController(canvas, renderer, game);
const event = (pointerId, x=100, y=100) => ({ pointerId, clientX:x, clientY:y, pointerType:"touch", preventDefault() {} });
const selected = game.designParts[0];
game.partAt = () => selected;
const initial = JSON.stringify(game.serializeDesign());
input.onPointerDown(event(1)); input.onPointerMove(event(1,140,140));
input.onPointerUp(event(99)); assert(input.drag);
input.onPointerDown(event(2,200,200));
assert.equal(input.drag, null); assert.equal(JSON.stringify(game.serializeDesign()), initial);
input.onPointerMove(event(2,250,250)); assert(renderer.camera.zoom > 1);
input.onPointerDown(event(3,300,300)); input.onPointerUp(event(1)); assert(input.pinch);
input.onPointerCancel(event(2)); input.onPointerCancel(event(3));
assert.equal(input.pointers.size,0); assert.equal(input.pinch,null);
input.onPointerDown(event(4)); input.onPointerMove(event(4,180,180));
canvas.listeners.lostpointercapture[0](event(4));
assert.equal(input.pointers.size,0); assert.equal(input.drag,null);
input.cancelAll();
// Persistent failure leaves both persisted and in-memory works intact.
const storage = new P.StorageManager();
const record = storage.saveWork(game.exportWork("old"));
const stored = JSON.stringify(storage.listWorks());
failWrites = true;
assert.throws(() => storage.saveWork({...record,name:"new"}));
assert.equal(JSON.stringify(storage.listWorks()), stored);
failWrites = false;
for (let i=1;i<24;i++) storage.saveWork({...record,id:"work-"+i});
assert.throws(() => storage.saveWork({...record,id:"overflow"}));
assert.equal(storage.listWorks().length,24);
assert.equal(storage.listWorks().find(w=>w.id===record.id).name,"old");
// Boot the application with small UI/audio adapters to exercise asynchronous lifecycle logic.
class UI {
  constructor(storage) { this.storage=storage; this.elements=new Proxy({}, {get:(_,id)=>element(id)}); }
  update(state) { element("startButton").disabled=state.mode!=="edit"; }
  showGame() { element("gameScreen").hidden=false; }
  showHome() { element("gameScreen").hidden=true; }
  setHint(message) { this.hint=message; } toast(message) { this.message=message; }
  renderHome() {} renderSavedWorks() {} bumpChain() {}
  openOverlay(id) { element(id).hidden=false; } closeOverlay(id) { element(id).hidden=true; }
}
P.UI=UI;
P.Renderer=class { constructor(canvas) { this.canvas=canvas; } setOptions() {} setStage() {} resize() {} };
P.AudioManager=class { setEnabled() {} unlock() { return audioUnlock(); } play() {} suspend() { this.suspended=true; } };
vm.runInContext(fs.readFileSync(path.join(root,"js/app-final.js"),"utf8"),context);
P.startApplication();
const app=context.__PYTHAGORA_TEST__;
const fire=(id,type="click",event={}) => { for(const fn of element(id).listeners[type]||[]) fn(event); };
const flush=async()=>{ for(let i=0;i<8;i++) await Promise.resolve(); };
(async()=>{
  let resolve;
  audioUnlock=()=>new Promise(r=>{resolve=r;});
  app.openFree();
  fire("startButton"); fire("startButton");
  assert(element("startButton").disabled);
  app.game.emitChange(); assert(element("startButton").disabled);
  fire("homeButton"); resolve(true); await flush();
  assert.equal(app.game.mode,"edit"); assert(element("gameScreen").hidden);
  app.openFree(); fire("startButton");
  app.openStage("stage-2"); resolve(true); await flush();
  assert.equal(app.game.mode,"edit"); assert.equal(app.game.stage.id,"stage-2");
  audioUnlock=()=>Promise.reject(Error("audio unavailable"));
  fire("startButton"); await flush(); assert.equal(app.game.mode,"running");
  document.hidden=true; document.listeners.visibilitychange[0]();
  assert.equal(app.game.mode,"edit");
  document.hidden=false; document.listeners.visibilitychange[0]();
  assert.match(app.ui.hint,/停止/); assert.equal(app.game.accumulator,0);
  app.openFree(); app.game.addPart("ramp");
  const unsaved=JSON.stringify(app.game.serializeDesign());
  confirmAnswer=false; fire("homeButton");
  assert.equal(JSON.stringify(app.game.serializeDesign()),unsaved); assert(!element("gameScreen").hidden);
  fire("resetButton"); assert.equal(JSON.stringify(app.game.serializeDesign()),unsaved);
  confirmAnswer=true;
  // Use an existing work so the full save capacity does not affect the app save test.
  app.openFree(record); app.game.addPart("ramp");
  fire("saveForm","submit",{preventDefault(){}});
  const afterSave=confirmations; fire("homeButton"); assert.equal(confirmations,afterSave);
  app.openFree(app.storage.listWorks().find(w=>w.id===record.id)); app.game.addPart("box");
  confirmAnswer=false; fire("homeButton"); assert.equal(confirmations,afterSave+1);
  failWrites=true; fire("saveForm","submit",{preventDefault(){}}); assert.match(app.ui.message,/保存できません/);
  fire("homeButton"); assert.equal(confirmations,afterSave+2);
  failWrites=false; audioUnlock=()=>Promise.resolve(false);
  fire("startButton"); await flush(); assert.equal(app.game.mode,"running");
  const count=confirmations; fire("resetButton"); assert.equal(confirmations,count); assert.equal(app.game.mode,"edit");
  // A stalled audio resume must time out, and late completion cannot start twice.
  let lateResolve;
  audioUnlock=()=>new Promise(resolve=>{lateResolve=resolve;});
  app.openStage("stage-2"); fire("startButton");
  await new Promise(resolve=>setTimeout(resolve,1550));
  assert.equal(app.game.mode,"running");
  app.game.update(50); const elapsed=app.game.elapsed;
  lateResolve(true); await flush(); assert.equal(app.game.elapsed,elapsed);
  fire("stopButton");
  // Hiding during audio initialization invalidates the request even after returning.
  app.openStage("stage-2"); fire("startButton");
  document.hidden=true; document.listeners.visibilitychange[0]();
  document.hidden=false; document.listeners.visibilitychange[0]();
  lateResolve(true); await flush(); assert.equal(app.game.mode,"edit");
  console.log("PASS: reset/history, physical cleanup, export, pointer cancellation/pinch, safe storage, start lifecycle, dirty checks, visibility");
})().catch(error=>{console.error(error);process.exitCode=1;});
