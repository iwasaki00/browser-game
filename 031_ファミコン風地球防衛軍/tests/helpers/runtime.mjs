import vm from "node:vm";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import * as data from "../../js/data.js";
import * as campaign from "../../js/campaign.js";
import * as campaignStats from "../../js/campaign-stats.js";
import * as camera from "../../js/camera.js";
import * as invasion from "../../js/invasion.js";
import {FrameProfiler,LiveProfiler,RunProfiler} from "../../js/profiler.js";
import * as missionLab from "../../js/mission-lab.js";
import * as playground from "../../js/playground.js";
import * as impact from "../../js/impact.js";
import * as player from "../../js/player.js";
import * as weapons from "../../js/weapons.js";
import * as mission02 from "../../js/mission02.js";
import * as art from "../../js/art-preview.js";
import * as mission06 from "../../js/mission06.js";
import * as livingArt from "../../js/living-art.js";
import * as mission05 from "../../js/mission05.js";
import * as mobileArt from "../../js/mobile-art.js";
import * as mission04 from "../../js/mission04.js";
import * as fortressUI from "../../js/fortress-ui.js";
import * as skyArt from "../../js/sky-art.js";
import * as mission03 from "../../js/mission03.js";
import * as coastalArt from "../../js/coastal-art.js";
import * as combatAudio from "../../js/combat-audio.js";
import * as gameplayUI from "../../js/gameplay-ui.js";
import * as mobilePlaytest from "../../js/mobile-playtest.js";

const source=readFileSync(new URL("../../js/game.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"");
export function runtime(seed=null,{recordDraw=true,debug=false}={}){
  const elements=new Map(),timers=new Map(),listeners=new Map(),drawCalls=[];
  let nextTimer=0,rafCount=0;
  const context=new Proxy({},{get:(target,name)=>name in target?target[name]:(...args)=>{if(recordDraw)drawCalls.push([name,...args])},set:(target,name,value)=>{target[name]=value;return true}});
  class Element {
    constructor(id=""){this.id=id;this.dataset={};this.style={setProperty(){}};this.children=[];this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
    setAttribute(name,value){(this.attributes??={})[name]=value} removeAttribute(name){delete (this.attributes??={})[name]} focus(){document.activeElement=this} setPointerCapture(){} append(e){this.children.push(e)} replaceChildren(){this.children=[]}
    getContext(){return context}
    getBoundingClientRect(){return {left:0,top:0,width:320,height:180}}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const touchButtons=["left","right","jump","switch","up","down","special","hover"].map(key=>{const e=get(key);e.dataset.touch=key;return e});
  const screens=["Title","Mission","Equip","Howto","Pause","Gameover","Result","Confirm","Lab","Settings"].map(n=>get(`screen${n}`));
  const document={documentElement:get("html"),body:get("body"),hidden:false,activeElement:null,querySelector:selector=>get(selector.replace(/^#/,"")),querySelectorAll:selector=>selector===".screen"?screens:selector==="#touchControls [data-touch]"?touchButtons:selector==="#labWeaponPicker button, #labWeaponPicker input"?[get("labWeaponPickerClose"),get("labPickerSlot1"),get("labPickerSlot2"),get("labWeaponSearch"),...get("labWeaponList").children.filter(e=>e.type==="button")]:[],createElement:()=>new Element(),addEventListener:(name,fn)=>{(listeners.get(name)||listeners.set(name,[]).get(name)).push(fn)}};
  const storage=new Map();if(seed)storage.set(data.SAVE_KEY,JSON.stringify(seed));
  let randomSeed=12345;const math=Object.create(Math);math.random=()=>((randomSeed=(randomSeed*1664525+1013904223)>>>0)/4294967296);
  const sandbox={...data,...campaign,...campaignStats,...camera,...invasion,...playground,...impact,...player,...weapons,...mission02,...missionLab,...art,...mission03,...mission06,...livingArt,...mission05,...mobileArt,...mission04,...skyArt,...fortressUI,...coastalArt,...combatAudio,...gameplayUI,...mobilePlaytest,FrameProfiler,LiveProfiler,RunProfiler,Math:math,performance,document,navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{search:debug?"?debug=1":""},URLSearchParams,Image:class{},requestAnimationFrame:()=>++rafCount,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id)};
  sandbox.window={innerHeight:720,addEventListener:(name,fn)=>{(listeners.get(`window:${name}`)||listeners.set(`window:${name}`,[]).get(`window:${name}`)).push(fn)}};
  const scope=vm.createContext(sandbox);vm.runInContext(source,scope);vm.runInContext("save.settings.sound=false",scope);
  const run=code=>vm.runInContext(code,scope),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
  return {run,json,storage,timers,drawCalls,get,rafCount:()=>rafCount,
    click(action,mission,playerClass,slot){const target={dataset:{action,mission,playerClass,slot},closest(){return this}};for(const fn of listeners.get("click")||[])fn({target})},
    density(value){for(const fn of listeners.get("change")||[])fn({target:{id:"densitySelect",value}})},
    change(id,value,checked){for(const fn of listeners.get("change")||[])fn({target:{id,value,checked}})},
    input(id,value){get(id).value=value;for(const fn of get(id).listeners.input||[])fn({target:get(id)});for(const fn of listeners.get('input')||[])fn({target:get(id)})},
    key(event,key){for(const fn of listeners.get(`window:${event}`)||[])fn({key,preventDefault(){}})},
    pointer(id,event,values={}){for(const fn of get(id).listeners[event]||[])fn({preventDefault(){},pointerId:Math.max(0,touchButtons.findIndex(b=>b.id===id))+2,clientX:160,clientY:90,buttons:1,...values})},
    event(name){for(const fn of listeners.get(`window:${name}`)||listeners.get(name)||[])fn({})},
    flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}};
}
