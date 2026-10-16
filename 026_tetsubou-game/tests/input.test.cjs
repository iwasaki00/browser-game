'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'..'),listeners=new Map(),elements=new Map();
function target(name){
  const handlers={};const obj={hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},tagName:'DIV',attributes:{},
    addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
    emit(type,props={}){for(const fn of handlers[type]||[])fn({preventDefault(){},...props});},
    replaceChildren(){},append(){},setAttribute(key,value){this.attributes[key]=value;},blur(){},getBoundingClientRect(){return{width:844,height:230};}};
  listeners.set(name,obj);return obj;
}
for(const id of ['canvas','pump','release','retry','debug','debugControls','debugSimulation','debugSimulationStatus','telemetry','result','badge','score','flips','height','cue','grade','finalScore','summary','reason','difficulty','rankingOpen','rankingClose','rankingDialog','rankEasy','rankNormal','rankingList','personalBest','storageStatus','guideLegend','timingFeedback','scoreBreakdown','recordNotice'])elements.set(id,target(id));
const ctx=new Proxy({},{get(o,k){return o[k]??(()=>{});},set(o,k,v){o[k]=v;return true;}});
elements.get('canvas').getContext=()=>ctx;
const win=target('window'),doc=target('document');doc.getElementById=id=>elements.get(id);doc.hidden=false;doc.activeElement={tagName:'BODY'};
let callback,now=0;
const env={window:win,document:doc,performance:{now:()=>now},Image:class{complete=true;naturalWidth=340;},requestAnimationFrame:fn=>callback=fn,console};
vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(base,'ranking.js'),'utf8'),env);vm.runInContext(fs.readFileSync(path.join(base,'physics.js'),'utf8'),env);let currentState,stepCalls=0,releaseCalls=0,saveCalls=0;
const physics=win.BarPhysics,step=physics.step,releasePhysics=physics.release,createRanking=win.BarRanking.create;
physics.step=(s,dt)=>{currentState=s;stepCalls++;return step(s,dt);};
physics.release=s=>{releaseCalls++;return releasePhysics(s);};
win.BarRanking.create=storage=>{const store=createRanking(storage),add=store.add;store.add=r=>{saveCalls++;return add(r);};return store;};
const dialog=elements.get('rankingDialog');dialog.open=false;
dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.emit('close');};
let confirms=0,confirmResult=true;win.confirm=()=>{confirms++;return confirmResult;};
vm.runInContext(fs.readFileSync(path.join(base,'game.js'),'utf8'),env);
function frame(){now+=16.666;callback(now);}
const pump=elements.get('pump'),release=elements.get('release');
function pressed(value){assert.equal(pump.attributes['aria-pressed'],String(value));}
for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});pressed(true);pump.emit(event,{pointerId:1});pressed(false);}
for(const event of ['touchend','touchcancel']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});win.emit(event,{touches:[]});pressed(false);}
for(const event of ['blur','pagehide','resize']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});win.emit(event);pressed(false);win.emit('focus');}
win.emit('keydown',{code:'Space'});win.emit('keydown',{code:'KeyZ'});pressed(true);win.emit('keyup',{code:'Space'});pressed(true);win.emit('keyup',{code:'KeyZ'});pressed(false);
// A touch ending on pump must not cancel another finger or a keyboard hold.
pump.emit('pointerdown',{pointerId:11,pointerType:'touch'});
pump.emit('pointerdown',{pointerId:12,pointerType:'touch'});
pump.emit('touchend',{touches:[{}]});win.emit('touchend',{touches:[{}]});pressed(true);
pump.emit('pointerup',{pointerId:11});pressed(true);
win.emit('keydown',{code:'Space'});pump.emit('lostpointercapture',{pointerId:12});pressed(true);
win.emit('keyup',{code:'Space'});pressed(false);
pump.emit('pointerdown',{pointerId:13,pointerType:'touch'});pump.emit('pointerdown',{pointerId:14,pointerType:'touch'});
pump.emit('pointercancel',{pointerId:13});win.emit('touchcancel',{touches:[{}]});pressed(true);
win.emit('pointerup',{pointerId:14});pressed(false);
// Canceling a difficulty change preserves the same physical state and mode.
frame();frame();const beforeChange=currentState;confirmResult=false;
elements.get('difficulty').value='normal';elements.get('difficulty').emit('change');
assert.equal(confirms,1);assert.equal(elements.get('difficulty').value,'easy');frame();assert.equal(currentState,beforeChange);
// Rankings block physics and every gameplay path; interruption survives dialog close.
elements.get('rankingOpen').emit('click');const beforeRank=stepCalls;
win.emit('keydown',{code:'KeyR'});win.emit('keydown',{code:'KeyX'});
elements.get('debugSimulation').emit('click');pump.emit('pointerdown',{pointerId:90,pointerType:'touch'});pressed(false);
frame();frame();assert.equal(stepCalls,beforeRank);dialog.close();frame();frame();assert(stepCalls>beforeRank);
elements.get('rankingOpen').emit('click');win.emit('blur');dialog.close();const suspended=stepCalls;
now+=600000;frame();frame();assert.equal(stepCalls,suspended);win.emit('focus');frame();assert.equal(stepCalls,suspended);frame();assert(stepCalls>suspended);pressed(false);
elements.get('rankingOpen').emit('click');doc.hidden=true;doc.emit('visibilitychange');dialog.close();
const hiddenSteps=stepCalls;frame();assert.equal(stepCalls,hiddenSteps);doc.hidden=false;doc.emit('visibilitychange');frame();assert.equal(stepCalls,hiddenSteps);frame();assert(stepCalls>hiddenSteps);
// Accepted changes and fresh starts do not introduce extra confirmation.
confirmResult=true;elements.get('difficulty').value='normal';elements.get('difficulty').emit('change');assert.equal(confirms,2);
elements.get('difficulty').value='easy';elements.get('difficulty').emit('change');assert.equal(confirms,2);
pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});release.emit('pointerdown',{pointerId:2,pointerType:'touch'});assert(release.disabled);pressed(true);const released=releaseCalls;release.emit('pointerdown',{pointerId:3});release.emit('click',{detail:0});assert.equal(releaseCalls,released);
win.emit('pointerup',{pointerId:2});pressed(true);win.emit('pointerup',{pointerId:1});pressed(false);
for(let i=0;i<300;i++)frame();assert.equal(elements.get('result').hidden,false);assert(elements.get('grade').textContent.startsWith('CRASH'));
assert.equal(saveCalls,1);for(let i=0;i<20;i++)frame();assert.equal(saveCalls,1);
elements.get('retry').emit('click');assert.equal(release.disabled,false);assert.equal(elements.get('result').hidden,true);pressed(false);
elements.get('debug').emit('click');frame();assert.equal(elements.get('telemetry').hidden,false);assert(elements.get('telemetry').textContent.includes('rad/s'));
elements.get('debugSimulation').emit('click');assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'true');assert.equal(elements.get('telemetry').hidden,true);
let sawAutoPress=false,sawAutoRelease=false;for(let i=0;i<720;i++){frame();const down=pump.attributes['aria-pressed']==='true';if(down)sawAutoPress=true;if(sawAutoPress&&!down)sawAutoRelease=true;}
assert(sawAutoPress,'Simulation visibly presses the pump button');assert(sawAutoRelease,'Simulation visibly releases the pump button');assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'true');
elements.get('debugSimulation').emit('click');assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'false');assert.equal(elements.get('telemetry').hidden,false);pressed(false);
elements.get('debugSimulation').emit('click');assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'true');doc.hidden=true;doc.emit('visibilitychange');pressed(false);assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'false');assert.equal(elements.get('debugSimulationStatus').textContent,'中断しました');frame();doc.hidden=false;doc.emit('visibilitychange');frame();
assert.equal(elements.get('debugSimulation').attributes['aria-pressed'],'false');
// Every local dependency is included; no network or build step is needed.
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert(fs.existsSync(path.resolve(base,match[1])),match[1]);
for(const name of ['body','arm','leg']){const png=fs.readFileSync(path.join(base,'assets',name+'.png'));assert.equal(png.readUInt32BE(0),0x89504e47);assert.equal(png[25],6,'RGBA PNG required');}
console.log('Input cancellation, multitouch, keyboard, results, restart, DEBUG, render smoke, and asset checks passed.');
