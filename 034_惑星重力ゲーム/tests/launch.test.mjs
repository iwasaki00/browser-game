import test from 'node:test';
import assert from 'node:assert/strict';
import { slingshotLaunch, velocityFromAngleSpeed, classifyDragTarget, loadLaunchMode, saveLaunchMode } from '../js/launch.js';
import { createSimulation, stepSimulation } from '../js/physics.js';
import { getStage } from '../js/stages.js';

test('精密方式とスリング方式の同一ベクトルは同じ軌道になる', () => {
  const shot = slingshotLaunch({x:0,y:0}, {x:-60,y:60});
  const vector = velocityFromAngleSpeed(shot.angleDeg, shot.speed);
  assert.ok(Math.abs(vector.x-shot.velocity.x)<1e-10);
  assert.ok(Math.abs(vector.y-shot.velocity.y)<1e-10);
  let a = createSimulation(getStage(), {velocity:shot.velocity});
  let b = createSimulation(getStage(), {angleDeg:shot.angleDeg,speed:shot.speed});
  for(let i=0;i<40;i++) { a=stepSimulation(a,1/120); b=stepSimulation(b,1/120); }
  assert.ok(Math.hypot(a.rocket.position.x-b.rocket.position.x,a.rocket.position.y-b.rocket.position.y)<1e-9);
});
test('引いた方向の反対に発射し、距離で速度が増加する', () => {
  const a=slingshotLaunch({x:0,y:0},{x:-25,y:25});
  const b=slingshotLaunch({x:0,y:0},{x:-60,y:60});
  assert.ok(a.velocity.x>0 && a.velocity.y<0);
  assert.ok(b.speed>a.speed);
});
test('キャンセル境界、最小・最大速度を守る', () => {
  assert.equal(slingshotLaunch({x:0,y:0},{x:14,y:0}).cancelled,true);
  const min=slingshotLaunch({x:0,y:0},{x:14.001,y:0});
  assert.ok(min.speed>=120 && min.speed<121);
  assert.equal(slingshotLaunch({x:0,y:0},{x:9999,y:0}).speed,220);
});
test('惑星とロケットの入力を分離し、重なった場合はロケット優先', () => {
  const planets=[{id:'a',x:100,y:100,radius:38}];
  assert.deepEqual(classifyDragTarget({x:100,y:100},{x:48,y:430},planets,'slingshot'),{type:'planet',id:'a'});
  assert.deepEqual(classifyDragTarget({x:48,y:430},{x:48,y:430},planets,'slingshot'),{type:'rocket'});
  assert.equal(classifyDragTarget({x:48,y:430},{x:48,y:430},planets,'precision'),null);
});
test('モードを保存復元し、ストレージ例外でもプレイを妨げない', () => {
  const values=new Map(); const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  saveLaunchMode(storage,'slingshot'); assert.equal(loadLaunchMode(storage),'slingshot');
  const broken={getItem(){throw Error();},setItem(){throw Error();}};
  assert.equal(loadLaunchMode(broken),'precision');
  assert.equal(saveLaunchMode(broken,'slingshot'),'slingshot');
});

test('入力イベント: 精密発射、リセット、キャンセル、マルチタッチ、再発射', async () => {
  class Target {
    constructor(){this.listeners={};this.hidden=false;this.disabled=false;this.value='';this.dataset={};this.classList={toggle(){}};this.captures=new Set();}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    emit(type,props={}){const e={type,pointerId:1,button:0,clientX:48,clientY:430,preventDefault(){},...props};for(const fn of this.listeners[type]??[])fn(e);}
    setAttribute(k,v){this[k]=v;}
    getBoundingClientRect(){return {width:375,height:500,left:0,top:0};}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
  }
  const elements=new Map(); const el=s=>{if(!elements.has(s))elements.set(s,new Target());return elements.get(s);};
  const buttons=['precision','slingshot'].map(mode=>{const b=new Target();b.dataset.launchMode=mode;return b;});
  globalThis.document=new Target();document.querySelector=el;document.querySelectorAll=()=>buttons;
  globalThis.window=new Target();window.devicePixelRatio=1;
  globalThis.ResizeObserver=class {observe(){}};
  globalThis.requestAnimationFrame=()=>{};
  el('#gameCanvas').getContext=()=>({});
  el('#angleInput').value='-55';el('#speedInput').value='170';
  await import('../js/game.js?input-test');
  const canvas=el('#gameCanvas'), launch=el('#launchButton');
  assert.equal(el('#previewToggle')['aria-pressed'],'true');
  el('#previewToggle').emit('click');assert.equal(el('#previewToggle')['aria-pressed'],'false');
  el('#resetButton').emit('click');assert.equal(el('#previewToggle')['aria-pressed'],'false');
  el('#previewToggle').emit('click');assert.equal(el('#previewToggle')['aria-pressed'],'true');
  el('#addPlanet').emit('click');el('#addPlanet').emit('click');
  assert.equal(el('#addPlanet').disabled,true);
  assert.match(el('#planetSelection').textContent,/3 \/ 3/);
  el('#deletePlanet').emit('click');assert.equal(el('#addPlanet').disabled,false);
  el('#planetType').value='asteroid';el('#planetSize').value='small';el('#planetType').emit('change');
  assert.match(el('#planetSelection').textContent,/M 1260/);
  launch.emit('click');assert.equal(launch.disabled,true);
  assert.equal(el('#addPlanet').disabled,true);
  el('#resetButton').emit('click');assert.equal(launch.disabled,false);
  assert.match(el('#planetSelection').textContent,/1 \/ 2/);
  el('#gameMode').value='live';el('#gameMode').emit('change');
  assert.match(el('#gameModeHelp').textContent,/重力操作/);
  buttons[1].emit('click');assert.equal(launch.hidden,true);
  const down=(x,y,id=1)=>{const e={clientX:x,clientY:y,pointerId:id};window.emit('pointerdown',e);canvas.emit('pointerdown',e);};
  const up=(x,y,id=1)=>{const e={clientX:x,clientY:y,pointerId:id};canvas.emit('pointerup',e);window.emit('pointerup',e);};
  down(48,430);up(48,430);assert.equal(launch.disabled,false);
  down(48,430);canvas.emit('pointercancel');window.emit('pointercancel');assert.equal(launch.disabled,false);
  down(48,430);down(60,440,2);up(0,490);up(60,440,2);assert.equal(launch.disabled,false);
  down(196,282);up(200,280);assert.equal(launch.disabled,false);
  down(48,430);up(0,490);assert.equal(launch.disabled,true);
  assert.equal(el('#gameMode').disabled,true);
  assert.equal(el('#planetType').disabled,true);
  el('#resetButton').emit('click');down(48,430);up(0,490);assert.equal(launch.disabled,true);
});
