import vm from "node:vm";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import * as data from "../../js/data.js";
import * as camera from "../../js/camera.js";
import * as invasion from "../../js/invasion.js";
import {FrameProfiler,LiveProfiler} from "../../js/profiler.js";
import * as playground from "../../js/playground.js";
import * as impact from "../../js/impact.js";

const source=readFileSync(new URL("../../js/game.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"");
export function runtime(seed=null,{recordDraw=true,debug=false}={}){
  const elements=new Map(),timers=new Map(),listeners=new Map(),drawCalls=[];
  let nextTimer=0,rafCount=0;
  const context=new Proxy({},{get:(target,name)=>name in target?target[name]:(...args)=>{if(recordDraw)drawCalls.push([name,...args])},set:(target,name,value)=>{target[name]=value;return true}});
  class Element {
    constructor(id=""){this.id=id;this.dataset={};this.style={setProperty(){}};this.children=[];this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
    setAttribute(){} focus(){} setPointerCapture(){} append(e){this.children.push(e)} replaceChildren(){this.children=[]}
    getContext(){return context}
    getBoundingClientRect(){return {left:0,top:0,width:320,height:180}}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const touchButtons=["left","right","jump","switch","up","down"].map(key=>{const e=get(key);e.dataset.touch=key;return e});
  const screens=["Title","Mission","Equip","Howto","Pause","Gameover","Result","Confirm","Lab"].map(n=>get(`screen${n}`));
  const document={documentElement:get("html"),body:get("body"),hidden:false,querySelector:selector=>get(selector.replace(/^#/,"")),querySelectorAll:selector=>selector===".screen"?screens:selector==="#touchControls [data-touch]"?touchButtons:[],createElement:()=>new Element(),addEventListener:(name,fn)=>{(listeners.get(name)||listeners.set(name,[]).get(name)).push(fn)}};
  const storage=new Map();if(seed)storage.set(data.SAVE_KEY,JSON.stringify(seed));
  let randomSeed=12345;const math=Object.create(Math);math.random=()=>((randomSeed=(randomSeed*1664525+1013904223)>>>0)/4294967296);
  const sandbox={...data,...camera,...invasion,...playground,...impact,FrameProfiler,LiveProfiler,Math:math,performance,document,navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{search:debug?"?debug=1":""},URLSearchParams,Image:class{},requestAnimationFrame:()=>++rafCount,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id)};
  sandbox.window={innerHeight:720,addEventListener:(name,fn)=>{(listeners.get(`window:${name}`)||listeners.set(`window:${name}`,[]).get(`window:${name}`)).push(fn)}};
  const scope=vm.createContext(sandbox);vm.runInContext(source,scope);vm.runInContext("save.settings.sound=false",scope);
  const run=code=>vm.runInContext(code,scope),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
  return {run,json,storage,timers,drawCalls,get,rafCount:()=>rafCount,
    click(action,mission){const target={dataset:{action,mission},closest(){return this}};for(const fn of listeners.get("click")||[])fn({target})},
    density(value){for(const fn of listeners.get("change")||[])fn({target:{id:"densitySelect",value}})},
    change(id,value,checked){for(const fn of listeners.get("change")||[])fn({target:{id,value,checked}})},
    key(event,key){for(const fn of listeners.get(`window:${event}`)||[])fn({key,preventDefault(){}})},
    pointer(id,event,values={}){for(const fn of get(id).listeners[event]||[])fn({preventDefault(){},pointerId:1,clientX:160,clientY:90,buttons:1,...values})},
    flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}};
}
