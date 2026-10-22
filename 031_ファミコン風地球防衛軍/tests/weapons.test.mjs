import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import {runtime} from "./helpers/runtime.mjs";
import {WEAPONS,WEAPON_BY_ID,WEAPON_CATEGORIES,DEFAULT_SAVE,PLAYER_CLASSES,SAVE_KEY,sanitizeSave,pickReward} from "../js/data.js";
import {WEAPON_LIMITS} from "../js/weapons.js";

function lab(id="B-09",count=0){
  const r=runtime(null,{debug:true,recordDraw:false});r.click("test-lab");r.change("labWeapon1",id);
  if(count){r.change("labCount",String(count));r.click("lab-spawn")}
  r.click("lab-close");r.run("game.areaTimer=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0");return r;
}
function steps(r,n,dt=1/60){r.run(`for(let i=0;i<${n};i++){game.time+=${dt};game.grid.rebuild(game.enemies);updateExpanded(game,${dt},weaponAPI)}`)}

test("20 records share metadata, six categories, unique stable IDs/assets and old balance",()=>{
  assert.equal(WEAPONS.length,20);assert.equal(WEAPON_BY_ID.size,20);assert.equal(Object.keys(WEAPON_CATEGORIES).length,6);
  for(const w of WEAPONS){assert.ok(w.category in WEAPON_CATEGORIES);assert.ok(w.life>0);assert.equal(w.assetId,w.id);assert.ok(Number.isInteger(w.assetIndex));assert.equal(typeof w.effectType,"string")}
  assert.deepEqual(WEAPONS.slice(0,8).map(w=>[w.id,w.damage,w.interval,w.speed,w.range]),[
    ["A-01",8,.12,310,340],["S-02",5,.65,260,150],["L-03",5,.08,620,250],["R-04",45,1.1,150,360],
    ["F-05",3,.07,105,92],["T-06",16,.5,400,180],["G-07",55,.9,145,280],["H-08",20,.8,135,400]]);
});

for(const w of WEAPONS.filter(w=>w.expanded)){
  test(`${w.id} fires its distinct projectile, installation or scheduled attack and expires`,()=>{
    const r=lab(w.id);r.run("shoot()");assert.equal(r.run("game.player.shotCd"),w.interval);
    assert.ok(r.run("game.shots.length+game.arsenal.jobs.length+game.arsenal.installations.length")>0);
    steps(r,1320);assert.equal(r.run("game.shots.length+game.arsenal.jobs.length+game.arsenal.installations.length"),0);
    assert.ok(r.run("game.arsenal.stats.blasts")<20);
  });
}

test("B-09 terrain reflection is limited to three, enemy hit does not become a reflection",()=>{
  const r=lab();r.run("shoot();const s=game.shots[0];s.x=100;s.y=140;s.vx=0;s.vy=300;game.platforms=[]");let max=0;
  for(let i=0;i<150;i++){steps(r,1);max=Math.max(max,r.run("s.bounces"))}
  assert.equal(max,3);assert.equal(r.run("s.dead"),true);assert.equal(r.run("game.shots.length"),0);
  const e=lab();e.run("spawnEnemy('crawler',1030);shoot();game.grid.rebuild(game.enemies)");steps(e,10);
  assert.equal(e.run("game.enemies[0].hp"),11);assert.equal(e.run("game.shots.length"),0);
});

for(const id of ["R-10","G-14"]){test(`${id} has exactly one split generation and independent child explosions`,()=>{
  const r=lab(id);r.run("shoot()");steps(r,25);
  assert.ok(r.run("game.shots.every(s=>s.generation<=1)"));steps(r,240);
  const children=WEAPON_BY_ID.get(id).children;assert.equal(r.run("game.arsenal.stats.splits"),1);assert.equal(r.run("game.arsenal.nextId"),children+2);
  assert.equal(r.run("game.arsenal.stats.blasts"),children);assert.equal(r.run("game.shots.length"),0);
})}

test("X-11 kills trigger a bounded iterative chain, no dead target is scored twice",()=>{
  const r=lab("X-11",200);r.run("for(let i=0;i<200;i++){game.enemies[i].x=1035+(i%6)*10;game.enemies[i].y=128}game.grid.rebuild(game.enemies);shoot()");
  steps(r,240);assert.ok(r.run("game.kills")>1);assert.ok(r.run("game.arsenal.stats.blasts")>1);assert.ok(r.run("game.arsenal.stats.blasts")<=6);
  assert.ok(r.run("game.arsenal.stats.maxDepth")<=6);assert.equal(r.run("game.arsenal.jobs.length"),0);
  const score=r.run("game.score");r.run("for(const e of game.enemies)if(e.dead)damageEnemy(e,999)");assert.equal(r.run("game.score"),score);
});

test("P-12 hits at most eight unique enemies and never repeats a target",()=>{
  const r=lab("P-12");r.run("for(let i=0;i<10;i++)spawnEnemy('crawler',1050+i*18);shoot()");steps(r,90);
  assert.equal(r.run("game.enemies.filter(e=>e.hp===2).length"),8);assert.equal(r.run("game.enemies.filter(e=>e.hp===24).length"),2);
});

test("P-13 applies one AoE damage per target and all destruction levels preserve radius and radial direction",()=>{
  for(const level of [1,2,3]){const r=lab("P-13");r.run(`game.lab.settings.destructionLevel=${level};const a=spawnEnemy('crawler',1040),b=spawnEnemy('crawler',1048),c=spawnEnemy('crawler',1150);shoot()`);steps(r,40);
    assert.equal(r.run("a.hp"),-41);assert.equal(r.run("b.hp"),-41);assert.equal(r.run("c.hp"),24);
    assert.ok(r.run("a.deathVx")>0);assert.equal(r.run("a.deathLevel"),level);assert.equal(r.run("game.arsenal.stats.blasts"),1);
  }
});

test("F-15 per-particle rehit cooldown holds even with stationary overlapping targets",()=>{
  const r=lab("F-15");r.run("const e=spawnEnemy('crawler',1020);e.hp=100;shoot();game.shots.length=1;const s=game.shots[0];s.vx=s.vy=0;s.x=e.x;s.y=138;game.grid.rebuild(game.enemies)");
  steps(r,1,.01);assert.equal(r.run("e.hp"),96);steps(r,1,.10);assert.equal(r.run("e.hp"),96);steps(r,1,.10);assert.equal(r.run("e.hp"),92);
});

test("T-16 performs eight timed strikes and limits each enemy to two selections",()=>{
  const r=lab("T-16");r.run("for(let i=0;i<4;i++){const e=spawnEnemy('crawler',1210+i*10);e.hp=100}shoot()");steps(r,180);
  assert.equal(r.run("game.arsenal.stats.strikes"),8);assert.equal(r.run("game.enemies.every(e=>e.hp===64)"),true);assert.equal(r.run("game.arsenal.jobs.length"),0);
});

test("S-17 actual hit coordinates follow opposite-phase sine trajectories",()=>{
  const r=lab("S-17");r.run("shoot();game.platforms=[]");steps(r,6);
  const points=r.json("game.shots.map(s=>[s.x,s.y])");assert.equal(points.length,2);assert.ok(Math.abs(points[0][1]-points[1][1])>10);
  r.run("const s=game.shots[0],e=spawnEnemy('needle',s.x+4,s.y-1);e.w=e.h=2;game.grid.rebuild(game.enemies)");steps(r,1);assert.equal(r.run("e.hp"),9);
});

test("M-18 has three owned terrain installations, remote PC/touch detonation and lifetime cleanup",()=>{
  const r=lab("M-18");r.run("for(let i=0;i<5;i++){game.player.shotCd=0;shoot()}");assert.equal(r.run("mineCount(game)"),3);
  r.run("const e=spawnEnemy('crawler',1014);game.grid.rebuild(game.enemies)");r.key("keydown","v");assert.equal(r.run("mineCount(game)"),0);assert.equal(r.run("game.kills"),1);
  r.run("game.player.shotCd=0;shoot()");r.pointer("switch","pointerdown");assert.equal(r.timers.size,1);r.flush();assert.equal(r.run("mineCount(game)"),0);assert.equal(r.run("game.player.weaponSlot"),0);r.pointer("switch","pointerup");
  r.run("game.player.shotCd=0;shoot()");r.pointer("switch","pointerdown");r.pointer("switch","pointerup");assert.equal(r.run("game.player.weaponSlot"),1);assert.equal(r.run("mineCount(game)"),1);
  steps(r,1260);assert.equal(r.run("mineCount(game)"),0);
});

test("D-19 maximum two grounded turrets attack nearby enemies but stop far away and expire",()=>{
  const r=lab("D-19");r.run("game.player.x=550;game.player.y=88;for(let i=0;i<3;i++){game.player.shotCd=0;shoot()}");
  assert.equal(r.run("game.arsenal.installations.length"),2);assert.equal(r.run("game.arsenal.installations.every(i=>i.y===120)"),true);
  r.run("const e=spawnEnemy('needle',700,100);e.hp=1000");steps(r,180);assert.ok(r.run("e.hp")<1000);
  r.run("game.player.x=3000;game.shots.length=0");steps(r,60);assert.equal(r.run("game.shots.length"),0);
  steps(r,1000);assert.equal(r.run("game.arsenal.installations.length"),0);
});

test("M-20 creates exactly six delayed meteors, clamps aim and explodes on platform roofs",()=>{
  const r=lab("M-20");r.run("game.player.x=400;input.touchDx=1;shoot()");steps(r,180);
  assert.equal(r.run("game.arsenal.nextId"),7);assert.equal(r.run("game.arsenal.stats.blasts"),6);assert.equal(r.run("game.shots.length+game.arsenal.jobs.length"),0);
  assert.ok(r.run("game.effects.some(f=>(f.kind==='explosion'||f.kind==='weaponBurst')&&f.y===116)"));
  const edge=lab("M-20");edge.run("game.player.x=4790;shoot()");steps(edge,50);
  assert.equal(edge.run("game.shots.every(s=>s.x>=0&&s.x<=WORLD.width)"),true);
});

test("every class equips/fires all 20 with current positions; Wing hover remains 8/s",()=>{
  for(const id of Object.keys(PLAYER_CLASSES))for(const w of WEAPONS){const r=lab(w.id);r.click("lab-open");r.change("labPreset",id);r.click("lab-close");
    r.run("game.player.x=1500;game.player.y=40;game.player.onGround=false;input.hover=true;input.fire=true;update(.1)");
    assert.equal(r.run("game.player.classId"),id);assert.ok(r.run("game.shots.length+game.arsenal.installations.length+game.arsenal.jobs.length")>0,`${id} ${w.id}`);
    if(id==="WING")assert.ok(Math.abs(r.run("game.player.energy")-99.2)<1e-8);
  }
});

test("locked normal weapons stay disabled, category filtering and explicit slots do not unlock them",()=>{
  const r=runtime();r.click("select-mission","M01");assert.equal(r.get("weaponGrid").children.length,20);
  assert.equal(r.get("weaponGrid").children.filter(b=>b.disabled).length,18);
  r.change("weaponFilter","support");assert.equal(r.get("weaponGrid").children.length,2);assert.equal(r.get("weaponGrid").children.every(b=>b.disabled),true);
  r.run("selected=['M-20','D-19']");r.click("deploy");assert.equal(r.run("state"),"equip");assert.equal(r.run("game"),null);
});

test("legacy saves preserve all old weapons; boxes choose unowned weapons, first clear gives L-03, full set is safe",()=>{
  const old=WEAPONS.slice(0,8).map(w=>w.id),s=sanitizeSave({...DEFAULT_SAVE,version:1,unlocked:old,equipped:["G-07","H-08"]});
  assert.deepEqual(s.unlocked,old);assert.deepEqual(s.equipped,["G-07","H-08"]);assert.ok(WEAPON_BY_ID.get(pickReward(old,()=>0)).expanded);
  const r=runtime();r.run("startMission();completeMission()");assert.equal(r.run("save.unlocked.includes('L-03')"),true);
  const full=runtime({...DEFAULT_SAVE,unlocked:WEAPONS.map(w=>w.id)});full.run("startMission();gCrate()");assert.equal(full.run("save.unlocked.length"),20);assert.equal(full.run("game.score"),500);
  const missing=runtime({...DEFAULT_SAVE,unlocked:WEAPONS.filter(w=>w.id!=="M-20").map(w=>w.id)});missing.run("startMission();gCrate()");assert.equal(missing.run("save.unlocked.includes('M-20')"),true);
  assert.equal(JSON.parse(missing.storage.get(SAVE_KEY)).unlocked.length,20);
});

test("LAB support/chain/weapon rewards stay isolated and reset removes all owned transient state",()=>{
  const r=lab("D-19",200),saved=r.storage.get(SAVE_KEY);r.run("shoot();gCrate();completeMission()");r.click("lab-open");r.click("lab-spawn");
  assert.equal(r.run("game.arsenal.jobs.length+game.arsenal.installations.length+game.shots.length"),0);
  r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),saved);
});

for(const id of ["P-13","X-11","G-14","R-10","T-16","M-20"]){test(`200 enemies: ${id} damage, queues, explosions and cleanup stay bounded`,()=>{
  const r=lab(id,200);r.run("for(let i=0;i<200;i++)game.enemies[i].x=1040+(i%12)*8;game.grid.rebuild(game.enemies);input.aimMode='mouse';const aim=worldToScreen({x:1090,y:138},game.camera,view.zoom);input.aimX=aim.x;input.aimY=aim.y;shoot()");
  const start=performance.now();steps(r,300);const cpu=performance.now()-start;
  assert.ok(r.run("game.enemies.some(e=>e.hp<e.maxHp)"),`${id} failed to damage dense enemies`);assert.ok(r.run("game.kills")<=200);
  assert.ok(r.run("game.shots.length")<=WEAPON_LIMITS.shots);assert.equal(r.run("game.arsenal.jobs.length"),0);
  assert.ok(r.run("game.effects.length")<=80);assert.ok(cpu<10000);
})}

test("expanded PNG atlases have expected dimensions and the catalogue has scroll/filter/slots",()=>{
  for(const [file,width,height] of [["sprites/weapons/weapon_icons.png",640,32],["sprites/weapons/projectiles.png",320,16],["sprites/weapons/equipped.png",320,16],["effects/weapon_fx.png",256,384]]){
    const png=readFileSync(new URL(`../assets/${file}`,import.meta.url));assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
  }
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");assert.match(html,/id="weaponFilter"/);assert.match(html,/id="equipSlot2"/);
});
