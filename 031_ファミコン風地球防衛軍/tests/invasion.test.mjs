import test from "node:test";
import assert from "node:assert/strict";
import {DENSITY_MODES,INVASION,ENEMY_TYPES,M01_ENCOUNTERS,sanitizeSave} from "../js/data.js";
import {SpatialGrid,SpawnDirector,AttackDirector} from "../js/invasion.js";
import {runtime} from "./helpers/runtime.mjs";
import {FrameProfiler} from "../js/profiler.js";

for(const [mode,{limit}] of Object.entries(DENSITY_MODES)){
  test(`${mode}: exact ${limit} live-enemy cap, area-4 WAVE/SWARM and bounded camera`,()=>{
    const r=runtime();r.density(mode);r.run("startMission();game.player.invuln=999;game.player.x=1981;update(1/60);damageEnemy(game.enemies.find(e=>e.type==='beetle'),9999);game.player.x=3150");
    r.run("for(let i=0;i<360;i++)update(1/60)");
    assert.equal(r.run("game.liveEnemies"),limit);assert.equal(r.run("game.enemyLimit"),limit);
    assert.equal(r.run("spawnEnemy('crawler',4000)"),null);
    assert.ok(r.run("game.director.entries.find(e=>e.definition.id==='a4-wave').spawned")>0);
    assert.ok(r.run("game.director.entries.find(e=>e.definition.id==='a4-swarm').spawned")>0);
    assert.ok(r.run("view.zoom")>=.35&&r.run("view.zoom")<=.85);
  });
}

test("density persists, legacy saves default to STANDARD and changes only affect next start",()=>{
  assert.equal(sanitizeSave({version:1,cleared:["M01"]}).settings.enemyDensity,"STANDARD");
  assert.equal(sanitizeSave({version:2,settings:{enemyDensity:"BAD"}}).settings.enemyDensity,"STANDARD");
  const r=runtime({version:1,cleared:["M01"],unlocked:["A-01","S-02","L-03"]});r.run("startMission()");r.density("MASSIVE");
  assert.equal(r.run("game.enemyLimit"),50);assert.equal(r.run("game.density"),"STANDARD");
  const restored=runtime(JSON.parse(r.storage.get("pixel-defense-front-save-v1")));restored.run("startMission()");
  assert.equal(restored.run("game.enemyLimit"),100);assert.deepEqual(restored.json("save.clearedMissions"),["M01"]);assert.ok(restored.json("save.unlocked").includes("L-03"));
  r.run("startMission()");assert.equal(r.run("game.enemyLimit"),100);
});

test("director reserves midboss space, preserves the gate and suppresses escorts",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.player.invuln=999;game.player.x=1100;for(let i=0;i<600;i++)update(1/60)");
  assert.ok(r.run("game.liveEnemies")<=99);
  r.run("game.player.x=1981;update(1/60)");assert.equal(r.run("game.midbossAlive"),true);assert.equal(r.run("game.director.midbossSpawned"),true);
  const count=r.run("game.liveEnemies");r.run("game.player.x=2200;update(1/60)");assert.equal(r.run("game.player.x"),2150);assert.ok(r.run("game.liveEnemies")<=count);
  r.run("damageEnemy(game.enemies.find(e=>e.type==='beetle'),9999);game.player.x=2200;update(1/60)");assert.equal(r.run("game.midbossAlive"),false);assert.equal(r.run("game.player.x"),2200);
});

test("crowd separation and speed/animation variation spread ground mobs without vertical drift",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.director.stopped=true;game.player.x=2000;for(let i=0;i<100;i++)spawnEnemy('crawler',2400);for(let i=0;i<120;i++)updateEnemies(1/60)");
  const xs=r.json("game.enemies.map(e=>e.x)");assert.ok(Math.max(...xs)-Math.min(...xs)>20);
  assert.equal(r.run("game.enemies.every(e=>e.y===WORLD.ground-e.h)"),true);
  assert.ok(r.run("new Set(game.enemies.map(e=>e.speedScale)).size")>90);
  assert.equal(r.run("game.enemies.every(e=>e.speedScale>=.9&&e.speedScale<=1.1)"),true);
  const before=r.run("game.enemies[0].x");r.run("updateEnemies(1/60)");assert.ok(Math.abs(r.run("game.enemies[0].x")-before)<1.2);
});

test("spatial grid never omits potential hits at cell boundaries",()=>{
  const grid=new SpatialGrid(),enemies=[];
  for(let i=0;i<100;i++)enemies.push({x:32+i*47,y:i%3*60,h:20,w:28,dead:false});
  enemies.push({x:63.9,y:63.9,h:58,w:88,dead:false});grid.rebuild(enemies);const scratch=[];
  for(let x=0;x<4800;x+=37){grid.query(x-48,0,x+48,150,scratch);for(const e of enemies)if(Math.abs(e.x-x)<17.5&&e.y+e.h>0&&e.y<150)assert.ok(scratch.includes(e))}
});

test("mass explosion kills each enemy once, caps effects, reclaims slots and keeps camera-independent hits",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.director.stopped=true;for(let i=0;i<100;i++)spawnEnemy('crawler',1000+(i%10)*2);game.grid.rebuild(game.enemies);explode({x:1010,y:138,radius:42,damage:45})");
  assert.equal(r.run("game.kills"),100);assert.equal(r.run("game.liveEnemies"),0);assert.ok(r.run("game.effects.length")<=INVASION.maxEffects);
  r.run("explode({x:1010,y:138,radius:42,damage:45});updateEnemies(.5)");assert.equal(r.run("game.kills"),100);assert.equal(r.run("game.enemies.length"),0);
  assert.ok(r.run("spawnEnemy('crawler',1000)")!==null);
  r.run("game.grid.rebuild(game.enemies);game.shots.push({x:1000,y:138,vx:0,vy:0,w:7,h:4,life:1,type:'bullet',damage:8,pierce:0,radius:0,rehit:{},weapon:WEAPONS[0]});updateShots(0)");
  assert.equal(r.run("game.enemies[0].hp"),16);assert.equal(r.run("game.camera"),0);
});

test("laser pierce count and damage remain unchanged with 100 overlapping targets",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.director.stopped=true;for(let i=0;i<100;i++)spawnEnemy('crawler',1000);game.grid.rebuild(game.enemies);game.shots.push({x:1000,y:138,vx:0,vy:0,w:7,h:4,life:1,type:'laser',damage:5,pierce:4,radius:0,rehit:{},weapon:WEAPONS[2]});updateShots(0)");
  assert.equal(r.run("game.enemies.filter(e=>e.hp===19).length"),5);assert.equal(r.run("game.enemies.filter(e=>e.hp===24).length"),95);
});

test("death rendering is bounded independently of kills and profiler reports slow frames",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();for(let i=0;i<100;i++){const e=spawnEnemy('crawler',300);damageEnemy(e,999);e.death=.4}images.enemies='mobs';drawEnemies(game)");
  assert.equal(r.run("game.kills"),100);assert.equal(r.drawCalls.filter(c=>c[0]==="drawImage"&&c[1]==="mobs").length,INVASION.maxDeathSprites);
  const profiler=new FrameProfiler();profiler.start(100);for(let i=0;i<=361;i++)profiler.record(i*1000/60+(i>120?100:0),.5,100);
  assert.ok(profiler.result.averageFps<60);assert.ok(profiler.result.low1PercentFps<60);assert.equal(profiler.result.maxEnemies,100);assert.equal(profiler.result.meanCpuMs,.5);
});

test("normal ranged attacks and dives are staggered; boss fire is independent",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.director.stopped=true;game.player.x=1000;for(let i=0;i<50;i++){const e=spawnEnemy('spider',1100+i);e.shotCd=0}updateEnemies(1/60)");
  assert.equal(r.run("game.enemyShots.length"),1);
  r.run("for(let i=0;i<60;i++){game.time+=1/60;updateEnemies(1/60)}");assert.ok(r.run("game.enemyShots.length")<=5);
  r.run("const leader={type:'boss',x:1400,y:90,h:58};enemyBurst(leader,5,130)");assert.ok(r.run("game.enemyShots.filter(s=>!s.normal).length")===5);
  const a=new AttackDirector();a.begin(0,[],[]);assert.equal(a.dive(0),true);assert.equal(a.dive(0),false);assert.equal(a.dive(.4),true);assert.equal(a.dive(.8),false);
});

test("far enemies keep moving without teleporting or disappearing",()=>{
  const r=runtime();r.run("startMission();game.director.stopped=true;game.player.x=2500;spawnEnemy('crawler',100);for(let i=0;i<60;i++)updateEnemies(1/60)");
  assert.equal(r.run("game.liveEnemies"),1);assert.ok(r.run("game.enemies[0].x")>100);assert.ok(r.run("game.enemies[0].x")<170);
});

test("boss summon cap, defeat/reward, GAME OVER and retry preserve density/progress",()=>{
  const r=runtime();r.density("MASSIVE");r.run("startMission();game.player.x=4200;startBoss();const leader=game.enemies[0];for(let i=0;i<100;i++)spawnBossMinion(leader,i)");
  assert.ok(r.run("game.liveMobs")<=INVASION.bossMinions.MASSIVE);assert.ok(r.run("game.liveEnemies")<=100);
  r.run("game.time=100;damageEnemy(leader,9999)");r.flush();r.flush();assert.equal(r.run("state"),"result");assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);assert.ok(r.json("save.unlocked").includes("L-03"));
  r.run("startMission();game.player.hp=0;update(1/60)");r.flush();assert.equal(r.run("state"),"gameover");r.click("retry");assert.equal(r.run("game.enemyLimit"),100);assert.equal(r.run("game.player.hp"),100);assert.ok(r.json("save.clearedMissions").includes("M01"));
});

test("future PINCER, AIR RAID and REINFORCEMENT templates are executable but not M01 waves",()=>{
  assert.equal(M01_ENCOUNTERS.some(e=>["PINCER","AIR_RAID","REINFORCEMENT"].includes(e.pattern)),false);
  for(const pattern of ["PINCER","AIR_RAID","REINFORCEMENT"]){
    const director=new SpawnDirector("STANDARD",[{id:"future",x:0,pattern,enemy:pattern==="AIR_RAID"?"needle":"crawler",count:4}]);
    const g={player:{x:2000,vx:95},battleCamera:{direction:1},liveEnemies:0,liveMobs:0};const spawned=[];
    director.update(1,g,(type,x,y)=>{g.liveEnemies++;g.liveMobs++;const e={type,x,y};spawned.push(e);return e},{left:1800,right:2400});
    assert.ok(spawned.length>0);if(pattern==="PINCER"){assert.ok(spawned.some(e=>e.x<2000));assert.ok(spawned.some(e=>e.x>2000))}
    assert.ok(spawned.every(e=>Math.abs(e.x-2000)>=INVASION.minSpawnDistance));
    if(pattern==="AIR_RAID")assert.ok(spawned.every(e=>e.type==="needle"&&e.y>=35&&e.y<100));
  }
});
