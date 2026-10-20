import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import * as data from "../js/data.js";
import * as camera from "../js/camera.js";

// Run the actual game module against a small DOM/clock adapter; no production test stages.
const source=readFileSync(new URL("../js/game.js",import.meta.url),"utf8").replace(/^import .*;\r?\n/gm,"");
function runtime(seed=null){
  const elements=new Map(),timers=new Map(),listeners=new Map(),drawCalls=[];
  let nextTimer=0,rafCount=0;
  const context=new Proxy({},{get:(_,name)=>(...args)=>drawCalls.push([name,...args]),set:(target,name,value)=>{target[name]=value;return true}});
  class Element {
    constructor(id=""){this.id=id;this.dataset={};this.style={setProperty(){}};this.children=[];this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
    setAttribute(){} focus(){} setPointerCapture(){} append(e){this.children.push(e)} replaceChildren(){this.children=[]}
    getContext(){return context}
    getBoundingClientRect(){return {left:0,top:0,width:320,height:180}}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
  const screens=["Title","Mission","Equip","Howto","Pause","Gameover","Result","Confirm"].map(n=>get(`screen${n}`));
  const document={documentElement:get("html"),body:get("body"),hidden:false,querySelector:selector=>get(selector.replace(/^#/,"")),querySelectorAll:selector=>selector===".screen"?screens:[],createElement:()=>new Element(),addEventListener:(name,fn)=>{(listeners.get(name)||listeners.set(name,[]).get(name)).push(fn)}};
  const storage=new Map();if(seed)storage.set(data.SAVE_KEY,JSON.stringify(seed));
  const sandbox={...data,...camera,document,navigator:{maxTouchPoints:0},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{search:""},URLSearchParams,Image:class{},requestAnimationFrame:()=>++rafCount,setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimeout:id=>timers.delete(id)};
  sandbox.window={innerHeight:720,addEventListener:(name,fn)=>{(listeners.get(`window:${name}`)||listeners.set(`window:${name}`,[]).get(`window:${name}`)).push(fn)}};
  const scope=vm.createContext(sandbox);vm.runInContext(source,scope);vm.runInContext("save.settings.sound=false",scope);
  const run=code=>vm.runInContext(code,scope),json=code=>JSON.parse(run(`JSON.stringify(${code})`));
  return {run,json,storage,timers,drawCalls,get,rafCount:()=>rafCount,click(action,mission){const target={dataset:{action,mission},closest(){return this}};for(const fn of listeners.get("click")||[])fn({target})},flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn())}};
}

test("TITLE confirms, cancellation continues, acceptance discards only session and timers",()=>{
  const r=runtime({version:1,cleared:["M01"],unlocked:["A-01","S-02","L-03"]});
  r.run("startMission();update(1/60)");const before=r.json("game.time");
  r.click("title");assert.equal(r.run("state"),"confirm");
  r.run("update(1/60)");assert.equal(r.json("game.time"),before);
  r.click("cancel-title");assert.equal(r.run("state"),"play");r.run("update(1/60)");assert.ok(r.json("game.time")>before);
  r.run("scheduleMission(()=>completeMission(),900)");assert.equal(r.timers.size,1);
  r.click("title");r.click("confirm-title");assert.equal(r.run("state"),"title");assert.equal(r.run("game"),null);assert.equal(r.timers.size,0);
  assert.deepEqual(r.json("save.clearedMissions"),["M01"]);assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);assert.ok(r.json("save.unlocked").includes("L-03"));
  for(let i=0;i<4;i++){r.run("startMission()");r.click("title");r.click("confirm-title")}
  assert.equal(r.rafCount(),1);
});

test("clear, game over, retry, selection and reload keep progression; M02 never starts",()=>{
  const r=runtime();r.run("startMission();game.time=100;completeMission()");r.flush();assert.equal(r.run("state"),"result");
  assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);
  r.click("mission-select");assert.equal(r.run("state"),"mission");
  const list=r.get("missionList").children;assert.equal(list[0].dataset.status,"CLEAR");assert.equal(list[1].dataset.status,"COMING SOON");assert.equal(list[1].disabled,true);
  r.click("select-mission","M02");assert.equal(r.run("state"),"mission");assert.equal(r.run('startMission("M02")'),false);assert.equal(r.run("game"),null);
  r.click("select-mission","M01");r.click("deploy");r.run("game.player.hp=0;update(1/60)");r.flush();assert.equal(r.run("state"),"gameover");
  r.click("retry");assert.equal(r.run("state"),"play");assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);
  r.run("game.player.hp=0;update(1/60)");r.flush();r.click("mission-select");assert.equal(r.run("state"),"mission");
  const saved=JSON.parse(r.storage.get(data.SAVE_KEY)),reloaded=runtime(saved);
  assert.deepEqual(reloaded.json("save.clearedMissions"),["M01"]);assert.deepEqual(reloaded.json("save.unlockedMissions"),["M01","M02"]);assert.ok(reloaded.json("save.unlocked").includes("L-03"));
});

test("stale completion cannot clear a new mission after title and restart",()=>{
  const r=runtime();r.run("startMission();scheduleMission(completeMission,900)");const stale=[...r.timers.values()][0];
  r.click("title");r.click("confirm-title");r.run("startMission()");stale();
  assert.equal(r.run("game.clear"),false);assert.deepEqual(r.json("save.clearedMissions"),[]);
});

test("a delayed mission transition cannot dismiss the TITLE confirmation",()=>{
  const r=runtime();r.run("startMission();scheduleMission(completeMission,900)");r.click("title");r.flush();
  assert.equal(r.run("state"),"confirm");assert.equal(r.run("game.clear"),false);
  r.click("cancel-title");assert.equal(r.run("game.clear"),true);r.flush();assert.equal(r.run("state"),"result");
  r.run("startMission();scheduleMission(completeMission,900)");r.click("title");r.flush();r.click("confirm-title");r.run("startMission()");
  assert.equal(r.run("game.clear"),false);assert.equal(r.run("deferredMissionCallbacks.length"),0);
});

test("actual shot direction follows the camera transform; world collision dimensions stay fixed",()=>{
  const r=runtime();r.run("startMission();game.player.x=900;game.camera=followCamera(900,view.zoom);const target=worldToScreen({x:1000,y:129},game.camera,view.zoom);input.aimX=target.x;input.aimY=target.y;shoot()");
  const shot=r.json("game.shots[0]");assert.ok(shot.vx>0);assert.ok(Math.abs(shot.vy)<1e-8);assert.equal(Math.hypot(shot.vx,shot.vy),310);
  assert.deepEqual(r.json("({w:game.player.w,h:game.player.h})"),{w:14,h:27});
  r.run('game.enemies=[];const enemy=spawnEnemy("crawler",game.player.x,game.player.y);updateEnemies(0)');assert.equal(r.run("game.player.hp"),90);
  r.run("input.right=true;const oldX=game.player.x;update(1/60);globalThis.moved=game.player.x-oldX");assert.ok(Math.abs(r.run("moved")-95/60)<1e-8);
  r.run("input.aimMode='touch';input.touchDx=-1;input.touchDy=0;game.player.shotCd=0;shoot()");assert.ok(r.run("game.shots.at(-1).vx")<0);assert.equal(r.run("game.shots.at(-1).vy"),0);
});

test("render fills background and ground past both camera edges; HUD is outside world scale",()=>{
  const r=runtime();r.run("startMission();assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]=k)");
  for(const x of [8,4775]){
    r.drawCalls.length=0;r.run(`game.player.x=${x};game.camera=followCamera(${x},view.zoom);draw()`);
    const calls=r.drawCalls,scaleIndex=calls.findIndex(c=>c[0]==="scale"&&c[1]===.7),lastRestore=calls.findLastIndex(c=>c[0]==="restore");
    assert.ok(scaleIndex>=0);assert.ok(calls.some((c,i)=>c[0]==="drawImage"&&c[1]==="bg"&&i>scaleIndex&&i<lastRestore));
    assert.ok(calls.some((c,i)=>c[0]==="fillText"&&String(c[1]).startsWith("HP")&&i>lastRestore));
    const bounds=r.json("viewBounds(game.camera,view.zoom)"),fill=calls.find(c=>c[0]==="fillRect"&&c[2]===data.WORLD.ground);
    assert.ok(fill[1]<=bounds.left);assert.ok(fill[1]+fill[3]>=bounds.right);
    const bg=calls.filter(c=>c[0]==="drawImage"&&c[1]==="bg");assert.ok(bg[0][2]<=bounds.left);assert.ok(bg.at(-1)[2]+320>=bounds.right);
  }
});
