import test from "node:test";
import assert from "node:assert/strict";
import {runtime} from "./helpers/runtime.mjs";
import {DESTRUCTION_LEVELS,DEFAULT_SAVE,WEAPONS,SAVE_KEY,sanitizeSave} from "../js/data.js";
import {IMPACT,REACTIONS} from "../js/impact.js";

function lab(level=1,count=200){const r=runtime(null,{debug:true});r.click("test-lab");r.change("labDestruction",String(level));r.change("labCount",String(count));r.click("lab-spawn");r.click("lab-close");return r}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test("LEVEL 1 retains 0.1.6 reaction constants and exact death velocity, spin, life and no trail/bounce",()=>{
  const r=lab(1,1);r.run("damageEnemy(game.enemies[0],999,{type:'rocket',vx:100,vy:0})");
  near(r.run("game.enemies[0].deathVx"),210);near(r.run("game.enemies[0].deathVy"),-175);
  near(r.run("game.enemies[0].deathSpin"),10);near(r.run("game.enemies[0].death"),.48);
  assert.equal(r.run("game.enemies[0].deathTrail"),null);assert.equal(DESTRUCTION_LEVELS[1].bounce,false);
  r.run("impactShake(game)");assert.equal(r.run("game.shake"),4);
});

for(const level of [2,3])test(`LEVEL ${level} multiplies horizontal/vertical velocity, rotation and life of all eight weapons`,()=>{
  const p=DESTRUCTION_LEVELS[level];
  for(const w of WEAPONS.filter(w=>!w.expanded)){const base=lab(1,1),strong=lab(level,1),source=`{type:'${w.type}',vx:100,vy:-25,originX:1200}`;
    base.run(`damageEnemy(game.enemies[0],999,${source})`);strong.run(`damageEnemy(game.enemies[0],999,${source})`);
    for(const [field,mult] of [["deathVx",p.speed],["deathVy",p.speed],["deathSpin",p.spin],["death",p.life]])near(strong.run(`game.enemies[0].${field}`),base.run(`game.enemies[0].${field}`)*mult);
    assert.equal(strong.run("game.enemies[0].deathType"),w.type);near(strong.run("game.enemies[0].deathDelay"),REACTIONS[w.type].delay||0);
  }
});

test("L2/L3 bounce only once and expire; world-edge deaths are safely discarded",()=>{
  for(const level of [2,3]){const r=lab(level,1);
    r.run("const e=game.enemies[0];damageEnemy(e,999,{type:'bullet',vx:100});e.y=WORLD.ground-e.h-1;e.deathVy=100;updateEnemies(.02)");
    assert.equal(r.run("e.deathBounces"),1);assert.ok(r.run("e.deathVy")<0);
    r.run("e.y=WORLD.ground-e.h-1;e.deathVy=100;updateEnemies(.02)");assert.equal(r.run("e.deathBounces"),1);assert.equal(r.run("e.deathGround"),true);
    r.run("updateEnemies(.2)");assert.equal(r.run("game.impact.corpses"),0);
  }
  const r=lab(3,1);r.run("const e=game.enemies[0];damageEnemy(e,999,{type:'rocket',vx:100});e.x=WORLD.width-1;updateEnemies(.02)");
  assert.equal(r.run("game.enemies.length"),0);assert.equal(r.run("game.impact.corpses"),0);assert.equal(r.run("e.deathTrail"),null);
  for(const level of [2,3]){const actual=lab(level,1);actual.run("const e=game.enemies[0];damageEnemy(e,999,{type:'bullet',vx:100});for(let i=0;i<23;i++)updateEnemies(1/60)");assert.equal(actual.run("e.deathBounces"),1)}
});

test("200 deaths preserve radial direction and bounded trails, particles, effects, lifetime and scores",()=>{
  for(const level of [1,2,3]){const r=lab(level);
    r.run("for(let i=0;i<200;i++)game.enemies[i].x=1240+(i%2?8:-8);game.grid.rebuild(game.enemies);explode({x:1240,y:138,type:'grenade',radius:42,damage:55});updateEnemies(.05);images.enemies='mobs';drawEnemies(game)");
    assert.equal(r.run("game.kills"),200);assert.equal(r.run("game.liveEnemies"),0);assert.equal(r.run("game.impact.corpses"),200);
    assert.ok(r.run("game.enemies[0].deathVx")<0);assert.ok(r.run("game.enemies[1].deathVx")>0);
    assert.ok(r.run("game.impact.particles.length")<=IMPACT.reducedParticles);
    assert.ok(r.drawCalls.filter(c=>c[0]==="drawImage"&&c[1]==="mobs").length<=16+IMPACT.maxTrailDraws);
    assert.ok(r.run("game.enemies.every(e=>!e.deathTrail||e.deathTrail.length===IMPACT.trailSlots*4)"));
    const score=r.run("game.score");r.run("for(const e of game.enemies)damageEnemy(e,999)");assert.equal(r.run("game.score"),score);
    r.run("for(let i=0;i<90;i++)update(1/60)");assert.equal(r.run("game.impact.corpses"),0);assert.equal(r.run("game.impact.particles.length"),0);
  }
});

test("L2/L3 trails differ and existing deaths and explosions retain creation level after live switch",()=>{
  const r=lab(2,10);r.run("damageEnemy(game.enemies[0],999,{type:'laser',vx:100});updateEnemies(.08);pushEffect({kind:'explosion',x:1240,y:138,r:34,life:.45,max:.45})");
  const old=r.json("[game.enemies[0].deathVx,game.enemies[0].deathSpin,game.enemies[0].deathMax]");
  r.click("lab-open");r.change("labDestruction","3");r.click("lab-close");r.run("damageEnemy(game.enemies[1],999,{type:'laser',vx:100})");
  assert.equal(r.run("game.enemies[0].deathLevel"),2);assert.equal(r.run("game.enemies[1].deathLevel"),3);
  assert.deepEqual(r.json("[game.enemies[0].deathVx,game.enemies[0].deathSpin,game.enemies[0].deathMax]"),old);
  assert.equal(r.run("game.effects.find(f=>f.kind==='explosion').visualScale"),1.4);
  assert.ok(DESTRUCTION_LEVELS[3].trails>DESTRUCTION_LEVELS[2].trails);assert.ok(DESTRUCTION_LEVELS[3].trailAlpha>DESTRUCTION_LEVELS[2].trailAlpha);
  assert.match(r.get("labLevelBadge").textContent,/LEVEL 3/);
});

test("explosion art scales 1/1.4/1.8 but damage radius, victims and exact HP do not change",()=>{
  let expected;
  for(const level of [1,2,3]){const r=lab(level,10);r.run("game.enemies[0].x=1240;game.enemies[1].x=1400;game.grid.rebuild(game.enemies);explode({x:1240,y:138,radius:34,damage:45,type:'rocket'});drawEffects(game)");
    const hp=r.json("game.enemies.map(e=>e.hp)");if(expected)assert.deepEqual(hp,expected);else expected=hp;
    const f=r.json("game.effects.find(f=>f.kind==='explosion')");assert.equal(f.r,34);assert.equal(f.visualScale,DESTRUCTION_LEVELS[level].explosion);
    const draw=r.drawCalls.find(c=>c[0]==="drawImage"&&c[4]===32&&c[5]===32);assert.ok(draw);near(draw.at(-1),34*2.6*DESTRUCTION_LEVELS[level].explosion);
    assert.equal(r.run("game.enemies[1].hp"),24);
  }
});

test("fragment emission approximately multiplies with deterministic count rounding and fixed caps",()=>{
  const counts=[];
  for(const level of [1,2,3]){const r=lab(level,100);r.run("let emitted=0;for(const e of game.enemies){game.impact.particles.length=0;damageEnemy(e,999,{type:'flame',vx:100});emitted+=game.impact.particles.length}");counts.push(r.run("emitted"))}
  near(counts[1]/counts[0],1.5);near(counts[2]/counts[0],2.5);
  const r=lab(3);r.run("for(const e of game.enemies)damageEnemy(e,999,{type:'flame',vx:100})");assert.ok(r.run("game.impact.particles.length")<=48);
});

test("normal settings persist and migrate legacy/corrupt saves without losing progress or weapons",()=>{
  const seed={...DEFAULT_SAVE,version:1,cleared:["M01"],unlocked:["A-01","S-02","L-03"],highScore:543,bestTime:99,settings:{sound:false,shake:false}};
  const r=runtime(seed),before=r.json("save");assert.equal(before.settings.destructionLevel,1);
  r.click("settings");r.change("destructionSelect","3");r.change("shakeToggle",null,false);r.click("settings-close");
  const restored=runtime(JSON.parse(r.storage.get(SAVE_KEY)));assert.equal(restored.run("save.settings.destructionLevel"),3);assert.equal(restored.run("save.settings.shake"),false);
  assert.deepEqual(restored.json("save.unlocked"),before.unlocked);assert.deepEqual(restored.json("save.clearedMissions"),before.clearedMissions);assert.equal(restored.run("save.highScore"),543);assert.equal(restored.run("save.bestTime"),99);
  for(const bad of [0,4,"EXTREME",null,{},[2],true])assert.equal(sanitizeSave({version:2,settings:{destructionLevel:bad}}).settings.destructionLevel,1);
  r.run("startMission();pause()");r.click("settings");const x=r.run("game.player.x");r.key("keydown","d");r.run("update(1)");assert.equal(r.run("game.player.x"),x);r.key("keydown","Escape");assert.equal(r.run("state"),"pause");
});

test("LAB settings stay temporary, shake OFF suppresses rendering and BENCH keeps selected level",()=>{
  const r=lab(3,1),saved=r.storage.get(SAVE_KEY);r.click("lab-open");r.change("labShake",null,false);r.click("lab-close");
  r.run("assetsReady=true;impactShake(game);game.shake=6.4;draw()");assert.equal(r.run("activeSettings().shake"),false);
  const translate=r.drawCalls.find(c=>c[0]==="translate");near(translate[1],r.run("worldToScreen({x:0,y:0},game.camera,view.zoom).x"));
  r.click("lab-open");r.run("startBenchmark('LAB200')");assert.equal(r.run("game.lab.settings.destructionLevel"),3);assert.equal(r.run("game.lab.settings.shake"),false);
  assert.equal(r.run("game.liveEnemies"),200);r.click("lab-open");r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),saved);
});

test("shake level multipliers respect hard amplitude/duration limits, OFF and unchanged hit-stop",()=>{
  for(const level of [1,2,3]){const r=lab(level,1);r.run("impactShake(game)");near(r.run("game.shake"),4*DESTRUCTION_LEVELS[level].shake);assert.ok(r.run("game.shake")<=6.4);
    r.run("damageEnemy(game.enemies[0],999,{type:'rocket',vx:100})");near(r.run("game.impact.stop"),IMPACT.stopDuration);
    r.run("for(let i=0;i<20;i++)update(1/60)");assert.equal(r.run("game.shake"),0);
    r.click("lab-open");r.change("labShake",null,false);r.click("lab-close");r.run("impactShake(game)");assert.equal(r.run("game.shake"),0);
  }
});

test("render-only shake is removed from mouse aim conversion, does not change world positions, and HUD stays unshifted",()=>{
  const r=lab(3,1);r.run("const px=game.player.x,py=game.player.y;view.renderOffset=3;const target={x:px+130,y:py-10};const screen=worldToScreen(target,game.camera,view.zoom);input.aimMode='mouse';input.aimX=screen.x+3;input.aimY=screen.y+3;shoot()");
  const dx=r.run("target.x-game.shots[0].x"),dy=r.run("target.y-game.shots[0].y"),length=Math.hypot(dx,dy);
  near(r.run("game.shots[0].vx/WEAPONS[0].speed"),dx/length);near(r.run("game.shots[0].vy/WEAPONS[0].speed"),dy/length);
  assert.equal(r.run("game.player.x"),r.run("px"));assert.equal(r.run("game.player.y"),r.run("py"));
  r.run("assetsReady=true;draw()");const restore=r.drawCalls.findIndex(c=>c[0]==="restore"),hud=r.drawCalls.findLastIndex(c=>c[0]==="fillText"&&String(c[1]).startsWith('HP '));assert.ok(hud>restore);
});
