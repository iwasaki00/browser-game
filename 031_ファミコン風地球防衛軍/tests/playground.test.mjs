import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runtime} from "./helpers/runtime.mjs";
import {WEAPONS,WORLD,SAVE_KEY} from "../js/data.js";
import {LiveProfiler} from "../js/profiler.js";
import {moveFlightPlayer,landLabPlayer} from "../js/playground.js";

const lab=()=>{const r=runtime(null,{debug:true});r.click("test-lab");return r};

test("TEST LAB requires debug=1, starts isolated with paused panel and 20 weapon options",()=>{
  const plain=runtime();plain.click("test-lab");assert.equal(plain.run("game"),null);
  const r=lab();assert.equal(r.get("testLabButton").hidden,false);r.click("lab-weapons",undefined,undefined,"0");assert.equal(r.get("labWeaponList").children.length,20);r.key("keydown","Escape");
  assert.equal(r.run("state"),"lab");assert.equal(r.run("game.lab.invincible"),true);
  r.run("update(1)");assert.equal(r.run("game.time"),0);assert.equal(r.run("game.director.stopped"),true);
  r.click("lab-close");r.run("game.player.x=4400;update(1/60)");assert.equal(r.run("game.bossStarted"),false);
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");assert.match(html,/id="testLabButton"[^>]*hidden/);
});

test("all eight weapons fire original weapon records and both lab slots are independent of save",()=>{
  const r=lab(),equipped=r.json("save.equipped");
  for(const w of WEAPONS.filter(w=>!w.expanded)){
    r.change("labWeapon1",w.id);r.change("labSlot","0");r.click("lab-close");
    r.run("game.shots.length=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()");
    assert.equal(r.run("game.shots[0].weapon===WEAPONS.find(w=>w.id===activeEquipment()[0])"),true);
    assert.equal(r.run("game.shots[0].damage"),w.damage);assert.equal(r.run("game.player.shotCd"),w.interval);
    assert.equal(r.run("game.shots[0].weapon.speed"),w.speed);r.click("lab-open");
  }
  r.change("labWeapon2","R-04");r.change("labSlot","1");r.click("lab-close");r.run("shoot()");
  assert.equal(r.run("game.shots.at(-1).type"),"rocket");assert.deepEqual(r.json("save.equipped"),equipped);
});

test("invulnerability preserves hit detection but blocks HP loss and knockback, OFF restores damage",()=>{
  const r=lab();r.click("lab-close");
  r.run("game.enemyShots.push({x:game.player.x,y:game.player.y+16,vx:0,vy:0,life:1,w:5,h:5,damage:20});updateEnemyShots(0)");
  assert.equal(r.run("game.enemyShots.length"),0);assert.equal(r.run("game.player.hp"),100);assert.equal(r.run("game.player.vy"),0);
  r.click("lab-open");r.change("labInvincible",null,false);r.click("lab-close");r.run("hurtPlayer(20,900)");
  assert.equal(r.run("game.player.hp"),80);assert.equal(r.run("game.player.vy"),-90);
  r.run("game.player.invuln=0;hurtPlayer(999,900);update(1/60)");r.flush();assert.equal(r.run("state"),"gameover");
  r.click("retry");assert.equal(r.run("state"),"lab");assert.equal(r.run("game.lab.invincible"),true);
});

for(const [preset,speed,jump] of [["STANDARD",95,220],["SPEED",180,220],["HEAVY",65,176]]){
  test(`${preset} has specified speed and jump without changing normal player`,()=>{
    const r=lab();r.change("labPreset",preset);r.click("lab-close");r.run("input.right=true;update(1/60)");
    assert.ok(Math.abs(r.run("game.player.x")-1000-speed/60)<1e-8);
    r.run("input.jump=true;update(1/60)");assert.ok(Math.abs(r.run("game.player.vy")-(-jump+WORLD.gravity/60))<1e-8);
    r.click("lab-open");r.click("lab-exit");r.run("startMission();input.right=true;update(1/60)");assert.equal(r.run("game.player.vx"),95);
  });
}

test("flight ascends, descends, hovers, fires, uses touch UP/DOWN and safely lands on switch",()=>{
  const r=lab();r.change("labPreset","FLIGHT");r.click("lab-close");
  r.key("keydown","w");r.run("update(.1)");assert.equal(r.run("game.player.y"),WORLD.ground-43);
  r.key("keyup","w");const y=r.run("game.player.y");r.run("update(.1)");assert.equal(r.run("game.player.y"),y);
  r.pointer("down","pointerdown");r.run("update(.05)");assert.equal(r.run("game.player.y"),y+5.5);r.pointer("down","pointerup");
  r.pointer("up","pointerdown");r.run("input.fire=true;update(.05)");assert.ok(r.run("game.shots.length")>0);r.pointer("up","pointerup");
  r.click("lab-open");r.change("labPreset","STANDARD");assert.equal(r.run("game.player.y"),WORLD.ground-32);assert.equal(r.run("game.player.onGround"),true);
});

test("flight has swept platform collision on all faces and respects world bounds",()=>{
  const platforms=[{x:100,y:70,w:80}];
  const p={x:130,y:20,vx:0,vy:0};moveFlightPlayer(p,{down:true},platforms,1);assert.equal(p.y,38);
  p.y=100;moveFlightPlayer(p,{up:true},platforms,1);assert.equal(p.y,78);
  p.x=80;p.y=60;moveFlightPlayer(p,{right:true},platforms,1);assert.equal(p.x,93);
  p.x=200;moveFlightPlayer(p,{left:true},platforms,1);assert.equal(p.x,187);
  p.x=8;p.y=0;moveFlightPlayer(p,{up:true,left:true},[],1);assert.equal(p.y,0);assert.equal(p.x,8);
  moveFlightPlayer(p,{down:true,right:true},[],100);assert.equal(p.x,WORLD.width-25);assert.equal(p.y,WORLD.ground-32);
  p.x=130;p.y=10;landLabPlayer(p,platforms);assert.equal(p.y,38);assert.equal(p.onGround,true);
});

test("panel blocks keyboard, pointer and update; closing resets input",()=>{
  const r=lab();r.key("keydown","d");r.pointer("left","pointerdown");r.pointer("game","pointerdown",{pointerType:"mouse"});
  r.run("update(1)");assert.equal(r.run("game.player.x"),1000);assert.equal(r.run("input.fire||input.left||input.right"),false);
  r.click("lab-close");r.pointer("left","pointerdown");r.click("lab-open");assert.equal(r.run("input.left"),false);
  r.key("keydown","Escape");assert.equal(r.run("state"),"play");r.key("keydown","F2");assert.equal(r.run("state"),"lab");
});

test("normal enemy counts 1–100, deterministic repositions, safe distance, flight height and single leaders",()=>{
  const r=lab();
  for(const type of ["crawler","spider","needle"]){
    r.change("labEnemy",type);
    for(const count of [1,10,30,50,100]){
      r.change("labCount",String(count));r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),count);
      assert.equal(r.run("game.enemies.every(e=>Math.abs(e.x-game.player.x)>=180)"),true);
      if(type==="crawler")assert.equal(r.run("game.enemies.every(e=>e.y+e.h===WORLD.ground)"),true);
      if(type==="needle")assert.equal(r.run("game.enemies.every(e=>e.y>=12&&e.y+e.h<WORLD.ground)"),true);
    }
  }
  const initial=r.json("game.enemies.map(e=>[e.x,e.y,e.anim,e.shotCd])");r.run("game.player.x=4700");r.click("lab-spawn");
  assert.deepEqual(r.json("game.enemies.map(e=>[e.x,e.y,e.anim,e.shotCd])"),initial);
  r.change("labPlacement","spread");r.click("lab-spawn");assert.ok(r.run("game.enemies.at(-1).x-game.enemies[0].x")>700);
  for(const type of ["beetle","boss"]){r.change("labEnemy",type);r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),1);assert.equal(r.get("labCount").disabled,true)}
  r.click("lab-clear");assert.equal(r.run("game.liveEnemies+game.enemyShots.length+game.effects.length"),0);
  assert.equal(r.run("game.bossStarted||game.midbossAlive"),false);
});

for(const id of ["R-04","G-07"]){
  test(`${id}: repeatable dense formation receives original multi-target explosion damage`,()=>{
    const r=lab();r.change("labEnemy","crawler");r.change("labCount","100");r.click("lab-spawn");r.click("lab-close");
    const w=WEAPONS.find(w=>w.id===id);
    r.run(`game.grid.rebuild(game.enemies);explode({x:game.enemies[40].x,y:game.enemies[40].y+game.enemies[40].h/2,radius:${w.radius},damage:${w.damage}})`);
    assert.ok(r.run("game.kills")>1);assert.ok(r.run("game.effects.some(e=>e.kind==='explosion')"));
    r.click("lab-open");r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),100);assert.equal(r.run("game.kills"),0);
  });
}

test("fixed camera clamps zoom and follows without affecting AUTO in normal play; overlay toggles",()=>{
  const r=lab();r.change("labCamera","FIXED");r.change("labZoom",".35");r.click("lab-close");r.run("update(1/60)");assert.equal(r.run("view.zoom"),.35);
  r.click("lab-open");r.change("labZoom","9");assert.equal(r.run("view.zoom"),.85);r.change("labFps",null,false);r.click("lab-close");assert.equal(r.get("labPerformance").hidden,true);
  r.click("lab-open");r.change("labCamera","AUTO");r.change("labFps",null,true);r.click("lab-close");assert.equal(r.get("labPerformance").hidden,false);
  r.run("for(let i=0;i<180;i++)update(1/60)");assert.ok(Math.abs(r.run("view.zoom")-.5)<.01);
});

test("LiveProfiler separates RAF/CPU, updates at 0.5s and excludes hidden/pause/extreme gaps",()=>{
  const p=new LiveProfiler();p.record(0,2,3);
  for(let i=1;i<=60;i++)p.record(i*1000/60,2,3);
  assert.ok(Math.abs(p.result.fps-60)<.001);assert.equal(p.result.updateMs,2);assert.equal(p.result.drawMs,3);
  const count=p.count;const interrupted=p.record(3000,100,100);assert.equal(p.count,0);assert.equal(p.excluded,1);assert.equal(interrupted.interrupted,true);assert.equal(p.result,null);
  p.record(3010,2,3,false);p.record(9000,2,3);assert.equal(p.count,0);
  p.record(9020,4,5);assert.equal(p.count,0);assert.equal(p.status,'WARMUP');
  for(let i=1;i<=600;i++)p.record(9020+i*20,4,5);assert.equal(p.count,240);assert.equal(p.frames.length,240);
});

test("legacy benchmark is lab-isolated and cannot leave a smaller cap on manual 100-enemy tests",()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("startBenchmark('LIGHT')");
  assert.equal(r.run("game.enemyLimit"),30);assert.equal(r.run("!!game.lab"),true);assert.equal(r.run("profiler.running"),true);
  r.click("lab-open");r.change("labCount","100");r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),100);
  assert.equal(r.run("profiler.running"),false);r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),saved);
});

test("reposition cancels a pending lab death transition and restores a playable test",()=>{
  const r=lab();r.change("labInvincible",null,false);r.click("lab-close");r.run("hurtPlayer(999,900);update(1/60)");
  assert.equal(r.timers.size,1);r.click("lab-open");r.click("lab-spawn");r.flush();
  assert.equal(r.run("state"),"lab");assert.equal(r.run("game.player.hp"),100);assert.equal(r.run("game.player.dead"),false);
  r.click("lab-close");r.run("update(1/60)");assert.equal(r.run("state"),"play");
});

test("LAB cannot mutate normal save through weapons, kills, crates, boss defeat, reset, retry, sound or exit",()=>{
  const r=lab(),serialized=r.storage.get(SAVE_KEY),before=r.json("save");
  r.change("labWeapon1","H-08");r.change("labEnemy","boss");r.click("lab-spawn");r.click("lab-close");
  r.run("gCrate();damageEnemy(game.enemies[0],99999);completeMission();storeSave()");r.flush();assert.equal(r.run("game.clear"),false);
  r.pointer("soundToggle","click",{currentTarget:r.get("soundToggle")});
  r.click("lab-open");r.click("lab-reset");r.click("lab-exit");assert.equal(r.run("state"),"title");
  assert.deepEqual(r.json("save"),before);assert.equal(r.storage.get(SAVE_KEY),serialized);
  r.run("startMission()");assert.equal(r.run("game.lab"),undefined);assert.deepEqual(r.json("activeEquipment()"),before.equipped);
  r.run("completeMission()");assert.notEqual(r.storage.get(SAVE_KEY),serialized);assert.equal(r.run("save.clearedMissions.includes('M01')"),true);
});
