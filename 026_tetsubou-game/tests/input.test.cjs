'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'..'),listeners=new Map(),elements=new Map();
function target(name){
  const handlers={};const obj={hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},tagName:'DIV',attributes:{},
    addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
    emit(type,props={}){for(const fn of handlers[type]||[])fn({preventDefault(){},...props});},
    setAttribute(key,value){this.attributes[key]=value;},blur(){},getBoundingClientRect(){return{width:844,height:230};}};
  listeners.set(name,obj);return obj;
}
for(const id of ['canvas','pump','release','retry','debug','telemetry','result','badge','score','flips','height','cue','grade','finalScore','summary','reason','difficulty','rankingOpen','rankingClose','rankingDialog','rankEasy','rankNormal','rankingList','personalBest','storageStatus','guideLegend','timingFeedback','scoreBreakdown','recordNotice'])elements.set(id,target(id));
const ctx=new Proxy({},{get(o,k){return o[k]??(()=>{});},set(o,k,v){o[k]=v;return true;}});
elements.get('canvas').getContext=()=>ctx;
const win=target('window'),doc=target('document');doc.getElementById=id=>elements.get(id);doc.hidden=false;doc.activeElement={tagName:'BODY'};
let callback,now=0;
const env={window:win,document:doc,performance:{now:()=>now},Image:class{complete=true;naturalWidth=340;},requestAnimationFrame:fn=>callback=fn,console};
vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(base,'ranking.js'),'utf8'),env);vm.runInContext(fs.readFileSync(path.join(base,'physics.js'),'utf8'),env);vm.runInContext(fs.readFileSync(path.join(base,'game.js'),'utf8'),env);
function frame(){now+=16.666;callback(now);}
const pump=elements.get('pump'),release=elements.get('release');
function pressed(value){assert.equal(pump.attributes['aria-pressed'],String(value));}
for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});pressed(true);pump.emit(event,{pointerId:1});pressed(false);}
for(const event of ['touchend','touchcancel']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});win.emit(event,{touches:[]});pressed(false);}
for(const event of ['blur','pagehide','resize']){pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});win.emit(event);pressed(false);}
win.emit('keydown',{code:'Space'});win.emit('keydown',{code:'KeyZ'});pressed(true);win.emit('keyup',{code:'Space'});pressed(true);win.emit('keyup',{code:'KeyZ'});pressed(false);
pump.emit('pointerdown',{pointerId:1,pointerType:'touch'});release.emit('pointerdown',{pointerId:2,pointerType:'touch'});assert(release.disabled);pressed(true);
win.emit('pointerup',{pointerId:2});pressed(true);win.emit('pointerup',{pointerId:1});pressed(false);
for(let i=0;i<300;i++)frame();assert.equal(elements.get('result').hidden,false);assert(elements.get('grade').textContent.startsWith('CRASH'));
elements.get('retry').emit('click');assert.equal(release.disabled,false);assert.equal(elements.get('result').hidden,true);pressed(false);
elements.get('debug').emit('click');frame();assert.equal(elements.get('telemetry').hidden,false);assert(elements.get('telemetry').textContent.includes('rad/s'));
win.emit('keydown',{code:'Space'});doc.hidden=true;doc.emit('visibilitychange');pressed(false);frame();doc.hidden=false;doc.emit('visibilitychange');frame();
// Every local dependency is included; no network or build step is needed.
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))assert(fs.existsSync(path.resolve(base,match[1])),match[1]);
for(const name of ['body','arm','leg']){const png=fs.readFileSync(path.join(base,'assets',name+'.png'));assert.equal(png.readUInt32BE(0),0x89504e47);assert.equal(png[25],6,'RGBA PNG required');}
console.log('Input cancellation, multitouch, keyboard, results, restart, DEBUG, render smoke, and asset checks passed.');
