import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES} from '../js/data.js';
import {LAB_CHECKPOINTS,findCheckpoint,validationClass} from '../js/mission-lab.js';
import {RunProfiler,LiveProfiler} from '../js/profiler.js';

const lab=()=>{const r=runtime(structuredClone(DEFAULT_SAVE),{debug:true,recordDraw:false});r.click('test-lab');return r};
const start=(r,mission='M01',area=0,route='LOWER')=>{if(r.run('state')==='play')r.click('lab-open');r.change('labStageMission',mission);r.change('labStageArea',String(area));r.change('labStageRoute',route);r.click('lab-stage-start')};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('13 explicit checkpoints contain restore metadata; missing checkpoints fail safely',()=>{
  assert.equal(LAB_CHECKPOINTS.length,13);assert.equal(new Set(LAB_CHECKPOINTS.map(c=>c.id)).size,13);
  for(const c of LAB_CHECKPOINTS)for(const key of ['missionId','areaId','x','y','route','safety','progression','enemies','midboss','boss','nests','camera','events'])assert.ok(key in c,key);
  assert.equal(findCheckpoint('M02',2,'UPPER').y,40);assert.equal(findCheckpoint('M02',2,'LOWER').y,116);
  assert.equal(findCheckpoint('M03',0),undefined);
});

for(const cp of LAB_CHECKPOINTS.filter(c=>c.boss.state!=='active'))test(`${cp.id}: safe start and deterministic restart clear all residual combat state`,()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);start(r,cp.missionId,cp.areaIndex,cp.route);
  assert.equal(r.run('state'),'play');assert.equal(r.run('game.lab.run.checkpoint.id'),cp.id);
  assert.deepEqual(r.json('[game.player.x,game.player.y,game.area,game.time]'),[cp.x,cp.y,cp.areaIndex,0]);
  assert.equal(r.run('game.platforms.some(b=>b.active!==false&&game.player.x+7>b.x&&game.player.x-7<b.x+b.w&&game.player.y+32>b.y&&game.player.y<b.y+(b.h??8))'),false);
  const count=r.run('game.liveEnemies');
  r.run("game.shots.push({});game.enemyShots.push({});game.effects.push({});game.arsenal.jobs.push({});game.arsenal.installations.push({kind:'mine'});game.impact.particles.push({});spawnEnemy('crawler',game.player.x+150);scheduleMission(()=>{game.score=99999},500)");
  r.click('lab-open');r.click('lab-stage-start');r.flush();
  assert.equal(r.run('game.liveEnemies'),count);assert.equal(r.run('game.shots.length+game.enemyShots.length+game.effects.length+game.arsenal.jobs.length+game.arsenal.installations.length+game.impact.particles.length'),0);
  assert.equal(r.run('game.score'),0);assert.equal(r.rafCount(),1);assert.equal(r.storage.get(SAVE_KEY),saved);
  assert.equal(r.run('labRunHistory.at(-1).outcome'),'ABORTED');
});

test('checkpoint restores midboss and past encounters, nest and barrier state, not only player X',()=>{
  const r=lab();start(r,'M01',2);r.run('game.player.x=2010;update(1/60)');assert.equal(r.run('game.midbossAlive'),true);
  start(r,'M01',3);r.run('update(1/60)');assert.equal(r.run('game.midbossAlive'),false);assert.equal(r.run('game.director.midbossSpawned'),true);
  assert.equal(r.run('game.director.entries.filter(e=>e.definition.x<2900).every(e=>e.done)'),true);
  start(r,'M02',3);assert.equal(r.run("game.enemies.some(e=>e.x<3268)"),false);assert.equal(r.run("game.enemies.filter(e=>e.type==='nest').length"),2);
  assert.equal(r.run("game.platforms.find(e=>e.kind==='barrier'&&e.x<3000).active"),false);
});

test('stage density is deferred until checkpoint start; limits remain 30 / 50 / 100',()=>{
  const r=lab();start(r);r.click('lab-open');r.change('labStageDensity','LIGHT');assert.equal(r.run('game.enemyLimit'),50);r.click('lab-stage-start');assert.equal(r.run('game.enemyLimit'),30);
  for(const [mode,limit] of [['STANDARD',50],['MASSIVE',100]]){r.click('lab-open');r.change('labStageDensity',mode);r.click('lab-stage-start');assert.equal(r.run('game.enemyLimit'),limit)}
});

for(const mission of ['M01','M02'])test(`${mission}: direct boss full reset, correct camera, result without normal reward`,()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset','GUARDIAN');r.change('labWeapon1','R-10');r.change('labWeapon2','M-20');r.change('labCamera','FIXED');r.click(mission==='M01'?'lab-boss-1':'lab-boss-2');
  assert.equal(r.run('game.lab.cameraMode'),'AUTO');
  assert.equal(r.run('game.bossStarted'),true);assert.equal(r.run('game.battleCamera.mode'),'boss');assert.equal(r.run('game.lab.invincible'),true);
  assert.deepEqual(r.json('[game.player.hp,...game.lab.equipped]'),[200,'R-10','M-20']);
  assert.equal(r.run('game.enemies.length'),1);assert.equal(r.run('game.enemies[0].hp'),r.run('game.enemies[0].maxHp'));
  r.run("game.time=12;damageEnemy(game.enemies[0],99999,{type:'rocket',weaponId:'R-10',vx:1,vy:0})");r.flush();r.flush();
  assert.equal(r.run('state'),'lab');assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.run('game.lab.run.snapshot(game).bossDefeatTime'),12);
  assert.equal(r.run('game.lab.run.snapshot(game).normalClearCertified'),false);assert.equal(r.storage.get(SAVE_KEY),saved);
  r.click('lab-reset');assert.equal(r.run('game.enemies[0].hp'),r.run('game.enemies[0].maxHp'));assert.equal(r.run('game.time'),0);
});

test('validation labels enforce invincibility, formal class and unlocked weapons; configuration changes demote D',()=>{
  const fake={invincible:false,preset:'RANGER',equipped:['A-01','S-02']};
  assert.equal(validationClass('D',fake,DEFAULT_SAVE),'D');assert.throws(()=>validationClass('D',{...fake,preset:'STANDARD'},DEFAULT_SAVE));
  assert.throws(()=>validationClass('D',{...fake,invincible:true},DEFAULT_SAVE));assert.throws(()=>validationClass('D',{...fake,equipped:['M-20','A-01']},DEFAULT_SAVE));
  assert.equal(validationClass('B',{...fake,invincible:true},DEFAULT_SAVE),'C');assert.equal(validationClass('C',fake,DEFAULT_SAVE),'B');
  const r=lab();r.change('labPreset','RANGER');r.change('labValidation','D');start(r);assert.equal(r.run('game.lab.run.mode'),'D');
  r.click('lab-open');r.change('labWeapon1','M-20');assert.equal(r.run('game.lab.run.mode'),'B');assert.equal(r.run('game.lab.run.changes.length'),1);
  r.change('labInvincible','',true);assert.equal(r.run('game.lab.run.mode'),'C');
});

for(const mission of ['M01','M02'])for(const id of Object.keys(PLAYER_CLASSES))test(`${mission} ${id}: A terrain from spawn to boss entrance, actual movement, no QA warp`,t=>{
  const r=lab();r.change('labPreset',id);r.change('labValidation','A');start(r,mission);
  r.run(`input.right=true;input.fire=true;
    for(let frame=0;frame<15000&&state==='play';frame++){
      const p=game.player;
      input.jump=p.onGround&&p.y===116&&game.platforms.some(b=>b.active!==false&&b.y>=90&&p.x>=b.x-23&&p.x<=b.x+b.w+7);
      input.up=p.classId==='WING'&&game.platforms.some(b=>b.active!==false&&b.y>=90&&p.x+35>b.x&&p.x<b.x+b.w+24);
      input.special=p.classId==='SCOUT';update(1/60);
    }`);
  const result=r.json('game.lab.run.snapshot(game)');
  assert.equal(result.outcome,'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,time:game.time,diagnostics:game.lab.run.warnings})')));
  assert.equal(result.coverage,'FROM_MISSION_START');assert.deepEqual(result.areaArrivals.map(a=>a.areaIndex),[0,1,2,3,4]);
  assert.equal(result.damageTaken,0);assert.equal(result.normalClearCertified,false);assert.equal(result.remainingHp,PLAYER_CLASSES[id].hp);
  assert.equal(result.diagnostics.some(d=>d.code==='TERRAIN_INTRUSION'),false,JSON.stringify(result.diagnostics));
  t.diagnostic(`A only / ${result.elapsed.toFixed(2)}s / arrival x ${r.run('game.player.x').toFixed(1)} / no normal-clear claim`);
});

test('A ignores attacks but keeps terrain and breakable obstacles; idle is not a suspected stall',()=>{
  const r=lab();r.change('labValidation','A');start(r,'M02',2);
  r.run("hurtPlayer(20,0);input.right=false;input.fire=false;for(let n=0;n<360;n++)update(1/60)");
  assert.equal(r.run('game.lab.run.damageTaken'),0);assert.equal(r.run('game.enemyShots.length'),0);assert.equal(r.run('game.lab.run.warnings.length'),0);
  assert.ok(r.run("game.enemies.some(e=>e.type==='barrier'&&!e.dead)"));
});

test('intent + blocked movement diagnoses suspected stalls; intrusions and event failures are recorded once',()=>{
  const r=lab();r.change('labPreset','RANGER');r.change('labValidation','B');start(r);r.run(`game.director.stopped=true;game.player.x=513;input.right=true;
    for(let n=0;n<300;n++)update(1/60)`);
  assert.equal(r.run("game.lab.run.warnings.filter(w=>w.code==='OBSTACLE_STALL').length"),1);
  r.run("game.player.x=540;game.player.y=118;game.time+=.3;game.lab.run.tick(game,input,.3)");assert.ok(r.run("game.lab.run.warnings.some(w=>w.code==='TERRAIN_INTRUSION')"));
  r.run("game.player.x=4200;input.right=false;for(let n=0;n<12;n++){game.time+=.3;game.lab.run.tick(game,input,.3)}");assert.ok(r.run("game.lab.run.warnings.some(w=>w.code==='BOSS_EVENT_MISSING')"));
  r.run("game.lab.run.bossDefeatedAt=game.time-4;game.time+=.3;game.lab.run.tick(game,input,.3)");assert.ok(r.run("game.lab.run.warnings.some(w=>w.code==='BOSS_RESULT_MISSING')"));
  assert.equal(r.run("game.lab.run.warnings.every(w=>w.severity==='SUSPECTED')"),true);
});

test('telemetry records actual HP damage per weapon, armor, kills once, arrivals and GAME OVER position',()=>{
  const r=lab();r.change('labPreset','GUARDIAN');r.change('labValidation','B');start(r);
  r.run("hurtPlayer(20,0);const e=spawnEnemy('crawler',400);damageEnemy(e,999,{weaponId:'P-12',type:'drill',vx:1});damageEnemy(e,999,{weaponId:'P-12'});game.player.x=941;update(1/60)");
  assert.equal(r.run('game.lab.run.damageTaken'),15);assert.equal(r.run('game.lab.run.kills'),1);assert.equal(r.run("game.lab.run.weaponDamage['P-12']"),24);
  assert.equal(r.run('game.lab.run.arrivals.at(-1).areaIndex'),1);
  r.run('game.player.invuln=0;hurtPlayer(999,0);update(1/60)');r.flush();assert.equal(r.run('state'),'gameover');assert.equal(r.run('game.lab.run.gameOver.x'),r.run('game.player.x'));
  assert.equal(r.run('game.lab.run.outcome'),'GAME_OVER');assert.equal(r.run('game.lab.run.snapshot(game).remainingHp'),0);
  assert.equal(r.get('labGameoverReport').hidden,false);r.click('lab-open');assert.equal(r.run('state'),'lab');assert.match(r.get('labRunSummary').textContent,/GAME_OVER/);r.click('lab-close');assert.equal(r.run('state'),'gameover');
  r.click('retry');assert.equal(r.run('game.lab.run.checkpoint.areaIndex'),0);assert.equal(r.run('game.player.hp'),200);
});

test('JSON copy, fallback, repeated checkpoint and LAB exit never modify normal data',async()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);start(r,'M02',2,'UPPER');r.click('lab-open');
  r.run('navigator.clipboard={writeText:async text=>{window.copied=text}}');await r.run('copyLabReport()');
  assert.equal(r.run('JSON.parse(window.copied).current.route'),'UPPER');assert.match(r.get('labCopyStatus').textContent,/コピーしました/);
  r.run('navigator.clipboard=null');await r.run('copyLabReport()');assert.match(r.get('labCopyStatus').textContent,/手動コピー/);
  r.click('lab-stage-start');r.click('lab-open');r.click('lab-exit');assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run('state'),'title');
});

for(const mission of ['M01','M02'])test(`${mission}: C combat QA reaches all areas and boss result without checkpoint warps or normal rewards`,t=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset','RANGER');r.change('labWeapon1','L-03');start(r,mission);
  r.run('const visited=new Set();input.fire=true;input.jump=true');
  for(let batch=0;batch<480&&r.run('game.lab.run.outcome')==='RUNNING';batch++){
    r.run(`for(let n=0;n<60&&state==='play';n++){
      visited.add(game.area);const p=game.player,q=game.enemies.find(e=>isBoss(e)&&!e.dead);
      input.right=q?q.x-p.x>175:true;input.left=q?p.x-q.x>175:false;
      const target=q??game.enemies.filter(e=>!e.dead&&e.active!==false&&Math.abs(e.x-p.x)<300).reduce((best,e)=>!best||Math.abs(e.x-p.x)<Math.abs(best.x-p.x)?e:best,null);
      const point=target?(target.type==='queen'?weakCore(target):{x:target.x,y:target.y+target.h/2}):{x:p.x+200,y:p.y+13};
      const dx=point.x-p.x,dy=point.y-p.y-13,length=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/length;input.touchDy=dy/length;update(1/60);
    }`);r.flush();
  }
  const report=r.json('game.lab.run.snapshot(game)');assert.equal(report.outcome,'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,time:game.time,hp:game.enemies.find(e=>isBoss(e))?.hp,diagnostics:game.lab.run.warnings})')));
  assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(report.validationMode,'C');assert.equal(report.coverage,'FROM_MISSION_START');assert.ok(report.bossDefeatTime>0);assert.ok(report.weaponDamage['L-03']>0);
  assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(report.normalClearCertified,false);
  t.diagnostic(`C only / ${report.elapsed.toFixed(2)}s / boss ${report.bossDefeatTime.toFixed(2)}s / kills ${report.kills} / suspects ${JSON.stringify(report.diagnostics.map(d=>d.code))} / not normal play`);
});

test('spawn-cap event and required nest checks log suspicions without deleting enemies or changing HP',()=>{
  const r=lab();start(r,'M01',2);r.run(`const entry=game.director.entries.find(e=>e.definition.enemy==='beetle');entry.active=true;entry.done=false;game.liveEnemies=game.enemyLimit;
    for(let n=0;n<20;n++){game.time+=.3;game.lab.run.tick(game,input,.3)}`);
  assert.ok(r.run("game.lab.run.warnings.some(w=>w.code==='SPAWN_CAP_EVENT_STALL')"));assert.equal(r.run('game.liveEnemies'),50);
  start(r,'M02',1);r.run(`const nest=game.enemies.find(e=>e.type==='nest');nest.required=true;game.player.x=nest.x-80;input.fire=true;
    for(let n=0;n<25;n++){game.time+=.3;game.lab.run.tick(game,input,.3)}`);
  assert.ok(r.run("game.lab.run.warnings.some(w=>w.code.startsWith('REQUIRED_NEST_UNDAMAGED:'))"));assert.equal(r.run('nest.hp'),250);
});

for(const count of [50,100,200])test(`${count} enemies: bounded profiler keeps RAF / CPU separate and excludes inactive & long gaps`,()=>{
  const p=new RunProfiler();for(let n=0;n<=120;n++)p.record(n*1000/60,1.2,2.3,{enemies:count,shots:40,effects:12});
  p.record(4000,999,999,{enemies:999});p.record(5000,999,999,{},false);p.record(6000,1,1,{},true);p.record(6000+1000/60,1.2,2.3,{enemies:count});
  const s=p.snapshot();near(s.fps,60);near(s.updateCpuMs,1.2);near(s.drawCpuMs,2.3);assert.equal(s.maxEnemies,count);assert.equal(s.excludedInterruptions,1);assert.equal(s.samples,121);assert.equal(s.p95FrameMs,17);assert.equal(p.bins.length,501);
});

test('rolling profiler exposes frame p95 independently from CPU',()=>{const p=new LiveProfiler();for(let n=0;n<=60;n++)p.record(n*1000/60,1,2);near(p.result.fps,60);assert.ok(p.result.p95FrameMs>16&&p.result.p95FrameMs<17);near(p.result.updateMs,1);near(p.result.drawMs,2)});

test('BENCH publishes accepted RAF samples, configuration and bounded comparison history, not raw interrupted FPS',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("startBenchmark('STANDARD');for(let n=0;n<=361;n++)loop(n*1000/60)");
  const b=r.json('labExport().benchmarks.at(-1)');assert.equal(b.limit,50);assert.equal(b.class,'STANDARD');assert.equal(b.validationMode,'C');assert.equal(b.destructionLevel,1);assert.deepEqual(b.weapons,['A-01','S-02']);
  near(b.performance.fps,60);assert.equal(b.performance.maxEnemies,50);assert.equal(b.performance.excludedInterruptions,0);assert.ok(b.performance.samples>=359);assert.equal(r.storage.get(SAVE_KEY),saved);
  const count=r.run('game.lab.benchmarkPerformance.samples');r.run('loop(7000)');assert.equal(r.run('game.lab.benchmarkPerformance.samples'),count,'completed benchmark must stop accumulating samples');
});
