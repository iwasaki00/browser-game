import test from "node:test";
import assert from "node:assert/strict";
import {runtime} from "./helpers/runtime.mjs";
import {IMPACT,REACTIONS,advanceImpact,createImpactState,requestHitStop,impactShake} from "../js/impact.js";
import {DENSITY_MODES,WEAPONS,INVASION,SAVE_KEY} from "../js/data.js";

function lab(count=200,placement="dense"){
  const r=runtime(null,{debug:true});r.click("test-lab");r.change("labCount",String(count));r.change("labPlacement",placement);r.click("lab-spawn");r.click("lab-close");return r;
}

test("death retains a moving rotating body with gravity, ground fade and no further collision or score",()=>{
  const r=lab(1);r.run("const e=game.enemies[0];damageEnemy(e,999,{type:'bullet',vx:310,vy:0})");
  assert.equal(r.run("game.enemies.length"),1);assert.equal(r.run("game.liveEnemies"),0);assert.ok(r.run("e.death")>0);
  const start=r.json("[e.x,e.y]"),score=r.run("game.score");r.run("damageEnemy(e,999);updateEnemies(.08)");
  assert.ok(r.run("e.x")>start[0]);assert.ok(r.run("e.y")<start[1]);assert.notEqual(r.run("e.deathAngle"),0);assert.equal(r.run("game.score"),score);
  r.run("e.y=WORLD.ground-e.h-1;e.deathVy=60;updateEnemies(.05)");assert.equal(r.run("e.deathGround"),true);assert.ok(r.run("e.death")<=IMPACT.groundFade);
  r.run("updateEnemies(.2)");assert.equal(r.run("game.enemies.length"),0);assert.equal(r.run("game.impact.corpses"),0);
});

test("eight weapon profiles differ; close shotgun is stronger, homing follows arrival, thunder delays",()=>{
  const speeds={};
  for(const w of WEAPONS){const r=lab(1);r.run(`damageEnemy(game.enemies[0],999,{type:'${w.type}',vx:100,vy:0,originX:1200})`);
    speeds[w.type]=r.run("game.enemies[0].deathVx");assert.equal(r.run("game.effects[0].kind"),"hit");assert.equal(r.run("game.effects[0].type"),w.type);
  }
  assert.ok(speeds.rocket>speeds.bullet*2);assert.ok(speeds.grenade>speeds.rocket);assert.ok(speeds.flame<speeds.bullet);
  assert.ok(REACTIONS.flame.life<REACTIONS.bullet.life);
  const r=lab(10);r.run("const near=game.enemies[0],far=game.enemies[1];damageEnemy(near,999,{type:'spread',vx:100,originX:near.x-5});damageEnemy(far,999,{type:'spread',vx:100,originX:far.x-145})");
  assert.ok(r.run("near.deathVx")>r.run("far.deathVx")*1.5);
  r.run("const h=game.enemies[2];damageEnemy(h,999,{type:'homing',vx:-100,vy:-20})");assert.ok(r.run("h.deathVx")<0);
  r.run("const t=game.enemies[3];damageEnemy(t,999,{type:'thunder',vx:100});const tx=t.x;updateEnemies(.03)");assert.equal(r.run("t.x"),r.run("tx"));
  r.run("updateEnemies(.04);updateEnemies(.02)");assert.ok(r.run("t.x")>r.run("tx"));
});

for(const placement of ["dense","spread"]){
  test(`LAB 200 ${placement} works for all normal species, does not extend normal density or contaminate save`,()=>{
    const r=lab(200,placement),save=r.storage.get(SAVE_KEY);
    for(const type of ["crawler","spider","needle"]){r.click("lab-open");r.change("labEnemy",type);r.click("lab-spawn");r.click("lab-close");
      assert.equal(r.run("game.liveEnemies"),200);assert.equal(r.run("spawnEnemy('crawler',2000)"),null);
      r.run("for(let i=0;i<60;i++)update(1/60)");assert.equal(r.run("game.liveEnemies"),200);assert.ok(r.run("view.zoom")>=.35&&r.run("view.zoom")<=.85);
    }
    r.click("lab-open");r.change("labEnemy","boss");r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),1);
    r.click("lab-clear");assert.equal(r.run("game.impact.particles.length+game.impact.corpses"),0);r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),save);
    assert.deepEqual(Object.values(DENSITY_MODES).map(d=>d.limit),[30,50,100]);r.run("startMission()");assert.equal(r.run("game.enemyLimit"),50);
  });
}

for(const id of ["R-04","G-07"]){
  test(`${id}: explosion hits 200 clustered targets with unchanged radius/damage and radial deaths`,()=>{
    const r=lab(),w=WEAPONS.find(w=>w.id===id);
    r.run("for(let i=0;i<200;i++)game.enemies[i].x=1240+(i%2?8:-8);game.enemies[199].x=1400;game.grid.rebuild(game.enemies)");
    r.run(`explode({x:1240,y:138,radius:${w.radius},damage:${w.damage},type:'${w.type}'})`);
    assert.equal(r.run("game.kills"),199);assert.equal(r.run("game.enemies[199].hp"),24);
    assert.ok(r.run("game.enemies[0].deathVx")<0);assert.ok(r.run("game.enemies[1].deathVx")>0);
    assert.equal(r.run("game.enemies[0].hp"),24-w.damage);assert.equal(r.run("game.enemies[0].deathType"),w.type);
    assert.ok(r.run("game.impact.particles.length")<=IMPACT.reducedParticles);assert.equal(r.run("game.impact.corpses"),199);
    r.run("images.enemies='mobs';drawEnemies(game);drawEffects(game)");
    assert.equal(r.drawCalls.filter(c=>c[0]==="drawImage"&&c[1]==="mobs").length,INVASION.maxDeathSprites+1);
    assert.ok(r.drawCalls.filter(c=>c[0]==="fillRect").length>=180); // overflow bodies still leave visible moving fragments
    r.run("for(let i=0;i<90;i++)update(1/60)");assert.equal(r.run("game.impact.corpses"),0);assert.equal(r.run("game.impact.particles.length"),0);
  });
}

test("hit effect reaches Canvas, explosions have flash/ring and visual caps never suppress damage",()=>{
  const r=lab();r.run("damageEnemy(game.enemies[0],1,{type:'laser',vx:620});drawEffects(game)");
  assert.ok(r.drawCalls.some(c=>c[0]==="stroke"));assert.ok(r.drawCalls.some(c=>c[0]==="fillRect"));
  r.run("game.grid.rebuild(game.enemies);for(let i=0;i<50;i++)explode({x:1240,y:138,radius:42,damage:55,type:'grenade'});drawEffects(game)");
  assert.ok(r.run("game.effects.length")<=INVASION.maxEffects);assert.ok(r.run("game.effects.filter(f=>f.kind==='explosion').length")<=IMPACT.reducedExplosions);
  assert.ok(r.run("game.kills")>50);assert.ok(r.drawCalls.some(c=>c[0]==="lineTo"));assert.ok(r.run("game.shake")<=IMPACT.shakeMax);
});

test("hit stop is time bounded, cannot stack, releases movement, and shake expires in real simulation time",()=>{
  const g={impact:createImpactState(),shake:0};let stopped=0;
  for(let i=0;i<600;i++){requestHitStop(g,true);impactShake(g);if(advanceImpact(g,1/60))stopped++;assert.ok(g.shake<=4);g.shake=0}
  assert.ok(stopped<=60); // <= 0.1 s per second including fixed-step rounding
  const r=lab(1);r.run("damageEnemy(game.enemies[0],999,{type:'rocket',vx:100});input.right=true");const x=r.run("game.player.x");
  r.run("update(1/60)");assert.equal(r.run("game.player.x"),x);r.run("for(let i=0;i<20;i++)update(1/60)");assert.ok(r.run("game.player.x")>x);
  r.run("impactShake(game);for(let i=0;i<15;i++)update(1/60)");assert.equal(r.run("game.shake"),0);
});

test("particle pool and corpse limit stay bounded under repeated immediate refills",()=>{
  const r=lab();r.run("for(let pass=0;pass<5;pass++){for(const e of game.enemies)if(!e.dead)damageEnemy(e,999,{type:'rocket',vx:100});for(let i=0;i<200;i++)spawnEnemy('crawler',1240)}");
  assert.ok(r.run("game.impact.corpses")<=IMPACT.maxCorpses);assert.ok(r.run("game.impact.particles.length")<=IMPACT.reducedParticles);
  r.run("updateEnemies(.6);updateEffects(.6)");assert.equal(r.run("game.impact.corpses"),0);assert.equal(r.run("game.impact.particles.length"),0);
  const pooled=r.run("game.impact.free.length");assert.ok(pooled<=IMPACT.maxParticles&&pooled>0);
  r.run("damageEnemy(game.enemies[0],999,{type:'flame',vx:100})");assert.ok(r.run("game.impact.free.length")<pooled);
});

test("visuals do not consume gameplay random values or change save, and BENCH 200 remains lab-only",()=>{
  const a=lab(10),b=lab(10),saved=a.storage.get(SAVE_KEY);
  a.run("damageEnemy(game.enemies[0],999,{type:'flame',vx:100})");b.run("damageEnemy(game.enemies[0],999,{type:'bullet',vx:100})");
  assert.equal(a.run("Math.random()"),b.run("Math.random()"));assert.deepEqual(a.json("game.items"),b.json("game.items"));
  a.click("lab-open");a.run("startBenchmark('LAB200')");assert.equal(a.run("game.enemyLimit"),200);assert.equal(a.run("game.liveEnemies"),200);
  a.run("completeMission();storeSave()");a.click("lab-open");a.click("lab-exit");assert.equal(a.storage.get(SAVE_KEY),saved);
});

test("LAB blast preview uses equipped R/G data only and does not alter save or normal firing",()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.click("lab-open");r.click("lab-blast");assert.equal(r.run("game.kills"),0);
  r.change("labWeapon1","G-07");r.click("lab-blast");assert.equal(r.run("state"),"play");assert.ok(r.run("game.kills")>1);
  assert.equal(r.run("game.effects.find(f=>f.kind==='explosion').r"),42);assert.equal(r.run("game.enemies.find(e=>e.dead).deathType"),"grenade");
  r.click("lab-open");r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),saved);
});
