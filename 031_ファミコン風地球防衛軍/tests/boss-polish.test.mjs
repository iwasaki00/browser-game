import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS} from '../js/data.js';
import {B03_COMBAT,coastalAttackPlan,coastalPhase,resetCoastalBossPhase,createM03Geometry,M03} from '../js/mission03.js';
import {applyPlayerClass,moveClassPlayer} from '../js/player.js';
import {RunProfiler,LiveProfiler,FrameProfiler} from '../js/profiler.js';
import {drawCoastalWarnings} from '../js/coastal-art.js';

const lab=()=>{const r=runtime(DEFAULT_SAVE,{debug:true,recordDraw:false});r.click('test-lab');return r};
for(const phase of [1,2,3])test(`B03 Phase ${phase}: explicit start resets attacks / summons / timers / camera, saves untouched`,()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset','GUARDIAN');r.change('labWeapon1','R-10');
  r.change('labBossPhase',String(phase));assert.equal(r.run('game.missionId'),'M01');assert.equal(r.run('game.bossStarted'),false);
  for(let i=0;i<3;i++){
    r.click('lab-boss-3');assert.equal(r.run('game.enemies.length'),1);assert.equal(r.run('game.enemies[0].hp'),B03_COMBAT.phaseHp[phase-1]);
    assert.equal(r.run('game.enemies[0].coastPhase'),phase);assert.equal(r.run('game.enemies[0].timer'),0);assert.equal(r.run('game.enemies[0].warningLeft'),0);assert.equal(r.run('game.enemies[0].attackPlan'),null);
    assert.equal(r.run('game.enemies[0].actionWait'),1.5);assert.equal(r.run('game.battleCamera.mode'),'boss');assert.equal(r.run('game.bossStarted'),true);
    assert.equal(r.run('game.lab.run.snapshot(game).bossStartPhase'),phase);assert.equal(r.run('coastalWeakCore(game.enemies[0]).open'),true);
    assert.deepEqual(r.json('[game.player.hp,game.lab.preset,...game.lab.equipped]'),[200,'GUARDIAN','R-10','S-02']);
    assert.deepEqual(r.json('[game.coast.hazards.length,game.enemyShots.length,game.shots.length,game.effects.length,game.arsenal.installations.length,game.coast.formations.size]'),[0,0,0,0,0,0]);
    r.run("game.enemyShots.push({life:5});game.effects.push({life:5});game.coast.hazards.push({life:1});spawnEnemy('shorecrab',5800);game.enemies[0].timer=20");r.click('lab-open');
  }
  assert.equal(r.storage.get(SAVE_KEY),saved);r.click('lab-exit');assert.equal(r.run('state'),'title');assert.equal(r.storage.get(SAVE_KEY),saved);
});

test('locked attack plan survives Phase crossing; exact telegraph bounds become damage bounds, no retargeting',()=>{
  const r=lab();r.click('lab-boss-3');r.run('game.enemies[0].actionWait=0;updateEnemies(1/60)');const plan=r.json('game.enemies[0].attackPlan');
  const rects=[];drawCoastalWarnings({save(){},restore(){},fillRect(){},strokeRect(...v){rects.push(v)},beginPath(){},moveTo(){},lineTo(){},stroke(){}},{enemies:[r.json('game.enemies[0]')]});
  assert.deepEqual(rects[0],[plan.zones[0].x-21,120,42,28]);
  r.run('game.enemies[0].hp=800;game.player.x+=100;for(let i=0;i<76;i++)updateEnemies(1/60)');
  assert.equal(r.run('game.enemies[0].coastPhase'),3);assert.equal(r.run('game.coast.hazards.length'),1);
  assert.equal(r.run('game.coast.hazards[0].x'),plan.zones[0].x);assert.equal(r.run('game.coast.hazards[0].w'),42);
  r.run('game.enemies[0].actionIndex=1;game.enemies[0].actionWait=0;updateEnemies(1/60)');const target=r.json('game.enemies[0].attackPlan.targets[0]');
  r.run('game.player.x=6300;for(let i=0;i<76;i++)updateEnemies(1/60)');const shot=r.json('game.enemyShots[0]');
  const a=Math.atan2(target.y-shot.y,target.x-shot.x);assert.ok(Math.abs(Math.atan2(shot.vy,shot.vx)-a)<1e-9);
});

for(const id of Object.keys(PLAYER_CLASSES))test(`${id}: actual movement evades all three tentacle patterns at both arena edges after 0.25s reaction`,t=>{
  let worst=0;
  for(const phase of [1,2,3])for(const x of [5480,5500,5900,6330,6350]){
    const boss={x:6060,y:48,hp:B03_COMBAT.phaseHp[phase-1],actionIndex:0};const plan=coastalAttackPlan({player:{x,y:116}},boss);
    const danger=q=>plan.zones.some(z=>Math.abs(q-z.x)<z.w/2+7+2); // include 2px safety margin
    let safe=x;
    if(danger(safe)){let best=Infinity;for(let q=5480;q<=6350;q++){if(!danger(q)&&Math.abs(q-x)<best){best=Math.abs(q-x);safe=q}}}
    const p={x,y:116,face:1,world:M03.world,onGround:true};applyPlayerClass(p,id);let reached=0;
    for(let f=0;f<Math.ceil((B03_COMBAT.warning+.24)*60);f++){
      const elapsed=f/60,move=elapsed>=.25&&danger(p.x);
      moveClassPlayer(p,{left:move&&safe<p.x,right:move&&safe>p.x},createM03Geometry(),1/60);
      if(!danger(p.x)&&!reached)reached=(f+1)/60;
      if(elapsed>=B03_COMBAT.warning)assert.equal(plan.zones.some(z=>Math.abs(p.x-z.x)<28),false,`${id} P${phase} x${x} -> ${p.x} safe${safe}`);
    }
    worst=Math.max(worst,reached);assert.ok(!danger(x)||reached>0&&reached<B03_COMBAT.warning);
  }
  t.diagnostic(`horizontal QA only; worst safe arrival ${worst.toFixed(3)}s < ${B03_COMBAT.warning}s; no damage immunity used`);
});

for(const id of Object.keys(PLAYER_CLASSES))test(`${id}: wave can be jumped/flown over after reaction, with actual movement`,()=>{
  const p={x:5900,y:116,face:1,world:M03.world,onGround:true};applyPlayerClass(p,id);
  for(let f=0;f<75;f++)moveClassPlayer(p,{jump:id!=='WING'&&f>=60,up:id==='WING'&&f>=60},createM03Geometry(),1/60);
  assert.ok(p.y+32<136,`${id} clears 136px top of the wave`);
});

test('Phase 3 wave waits for old boss projectiles and gets an exclusive full-lifetime recovery',()=>{
  const r=lab();r.change('labBossPhase','3');r.click('lab-boss-3');r.run("game.player.x=5900;game.enemies[0].actionIndex=2;game.enemies[0].actionWait=0;game.enemyShots.push({coastalBoss:true,life:3});updateEnemies(1/60)");
  assert.equal(r.run('game.enemies[0].warningLeft'),0);r.run('game.enemyShots.length=0;game.enemies[0].actionWait=0;updateEnemies(1/60)');
  assert.equal(r.run('game.enemies[0].attackPlan.zones[0].y'),136);r.run('for(let i=0;i<76;i++)updateEnemies(1/60)');
  assert.equal(r.run("game.enemyShots.filter(s=>s.kind==='wave').length"),2);assert.ok(r.run('game.enemies[0].actionWait')>=5.2);
  r.run('for(let i=0;i<300;i++)updateEnemies(1/60)');assert.equal(r.run('game.enemies[0].warningLeft'),0);
});

for(const id of Object.keys(PLAYER_CLASSES))test(`${id}: real projectile collision allows a no-hit escape from each fan (B, no immunity)`,()=>{
  for(const phase of [1,2,3]){
    const r=lab();r.change('labPreset',id);r.change('labValidation','B');r.change('labBossPhase',String(phase));r.click('lab-boss-3');
    r.run(`game.player.x=5950;game.enemies[0].actionWait=0;game.enemies[0].actionIndex=1;var shotAt=null;
      for(let f=0;f<450;f++){var p=game.player,b=game.enemies[0];if(game.enemyShots.length){b.actionWait=100;shotAt??=f}
        input.left=p.classId!=='WING'&&f>=15&&f<300;
        input.jump=p.classId!=='WING'&&p.onGround&&f===shotAt;
        input.up=p.classId==='WING'&&shotAt!==null&&f>=shotAt+18&&f<shotAt+48;
        input.hover=p.classId==='WING'&&!input.up&&!p.onGround&&shotAt!==null;update(1/60);
      }`);
    assert.equal(r.run('game.lab.run.damageTaken'),0,`${id} phase${phase}`);assert.equal(r.run('game.player.hp'),PLAYER_CLASSES[id].hp);assert.equal(r.run('game.lab.invincible'),false);
  }
});

for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(`${id} / ${wid}: starter shots hit E07/E08/E09 and B03 core using real ballistics`,()=>{
  const r=lab();r.change('labPreset',id);r.click('lab-boss-3');
  for(const type of ['shorecrab','skyray','siegebeetle','leviathan']){
    r.run(`clearLabEnemies();var target=spawnEnemy('${type}',6060,${type==='skyray'||type==='leviathan'?48:type==='siegebeetle'?108:124});target.landingLeft=0;game.player.x=5950;game.player.y=116;game.player.onGround=true;game.lab.equipped[0]='${wid}';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;var point=target.type==='leviathan'?coastalWeakCore(target):{x:target.x,y:target.y+target.h/2};var dx=point.x-game.player.x-18,dy=point.y-game.player.y-13,l=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/l;input.touchDy=dy/l;game.grid.rebuild(game.enemies);shoot();for(let i=0;i<35;i++)updateShots(1/60)`);
    assert.ok(r.run('target.hp<target.maxHp'),`${id} ${wid} ${type} actual hit`);
  }
});

test('50 skyrays: unique V offsets, staggered dive warnings, shared cap, alive count / HP unchanged',()=>{
  const r=lab();r.change('labEnemy','skyray');r.change('labCount','50');r.click('lab-spawn');r.click('lab-close');
  r.run('for(let n=0;n<180;n++)update(1/60)');assert.equal(r.run('game.liveEnemies'),50);
  assert.equal(r.run('game.enemies.every(e=>e.hp===45)'),true);assert.equal(r.run('new Set(game.enemies.slice(0,6).map(e=>Math.round(e.x)+","+Math.round(e.y))).size'),6);
  r.run('var warned=0,maxDives=0;for(let f=0;f<600;f++){update(1/60);warned+=game.enemies.filter(e=>e.diveWarningLeft>0).length;maxDives=Math.max(maxDives,game.enemies.filter(e=>e.diveWarningLeft>0||e.diveTimer>0).length)}');
  assert.ok(r.run('warned>0'));assert.ok(r.run('maxDives')<=3);assert.ok(r.run('game.liveEnemies')<=200);
});

test('non-attacking formations keep clearance above grounded players; no enemy array reordering',()=>{
  const r=lab();r.change('labEnemy','skyray');r.change('labCount','50');r.click('lab-spawn');r.click('lab-close');
  r.run("var order=game.enemies.map(e=>e.uid).join(',');game.attacks.dive=()=>false;for(let i=0;i<300;i++)update(1/60)");
  assert.equal(r.run('game.enemies.every(e=>e.y+e.h<=116)'),true);assert.equal(r.run("game.enemies.map(e=>e.uid).join(',')"),r.run('order'));
});

for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(`${id} / ${wid}: C direct-boss QA defeats all phases with real starter shots (not human D)`,t=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset',id);r.change('labWeapon1',wid);r.click('lab-boss-3');
  // A reachable land firing position, 110px from core, within both starter ranges.
  r.run('game.player.x=5950;input.fire=true');
  for(let b=0;b<240&&r.run('game.lab.run.outcome')==='RUNNING';b++){
    r.run(`for(let f=0;f<60&&state==='play';f++){const boss=game.enemies.find(e=>e.type==='leviathan'&&!e.dead);if(boss){const core=coastalWeakCore(boss),dx=core.x-game.player.x-18,dy=core.y-game.player.y-13,len=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len}update(1/60)}`);r.flush();
  }
  const result=r.json('game.lab.run.snapshot(game)');assert.equal(result.outcome,'BOSS_DEFEATED');assert.equal(result.validationMode,'C');assert.equal(result.normalClearCertified,false);assert.ok(result.weaponDamage[wid]>=3000);assert.equal(r.storage.get(SAVE_KEY),saved);
  t.diagnostic(`C direct boss / ${result.bossDefeatTime.toFixed(2)}s / ${result.kills} kills; stationary + invincible QA, not D`);
});

test('profilers distinguish warm-up, insufficient, foreground, hidden, long gap and completion; never invent FPS',()=>{
  const p=new RunProfiler();for(let n=0;n<=20;n++)p.record(n*1000/60,1,2);assert.equal(p.snapshot().fps,null);assert.equal(p.status,'WARMUP');
  for(let n=21;n<=90;n++)p.record(n*1000/60,1,2,{enemies:200});assert.equal(p.status,'MEASURING');assert.ok(Math.abs(p.snapshot().fps-60)<1e-6);
  p.record(3000,999,999);assert.equal(p.status,'INTERRUPTED');assert.equal(p.excluded,1);p.record(3010,999,999,{},false,'タブ非表示');assert.equal(p.status,'PAUSED');
  p.record(6000,99,99);p.record(6016,99,99);assert.equal(p.status,'WARMUP');assert.ok(Math.abs(p.snapshot().drawCpuMs-2)<1e-6);assert.equal(p.finish().status,'COMPLETE');
  const bad=new FrameProfiler();bad.start(200);for(let n=0;n<8;n++)bad.record(n*1000,999,200);assert.equal(bad.result.averageFps,null);assert.equal(bad.result.status,'INSUFFICIENT');assert.ok(bad.result.excludedInterruptions>=6);
  const live=new LiveProfiler();for(let n=0;n<=90;n++)live.record(n*1000/60,1,2);assert.ok(live.result.fps>59);live.record(4000,999,999);assert.equal(live.result,null);assert.equal(live.count,0);
});

test('short fragments cannot add up to a valid FPS; hidden reason survives repeated inactive frames',()=>{
  const p=new RunProfiler({warmupMs:0});let ts=0;
  for(let segment=0;segment<4;segment++){p.record(ts,1,2);for(let n=0;n<20;n++){ts+=1000/60;p.record(ts,1,2)}ts+=1000;p.record(ts,999,999)}
  assert.equal(p.samples,0);assert.equal(p.discardedShortSamples,80);assert.equal(p.snapshot().fps,null);assert.equal(p.finish().status,'INSUFFICIENT');assert.equal(p.snapshot().validSegments,0);
  const paused=new RunProfiler();paused.record(0,1,2);paused.pause('タブ非表示');paused.record(1000,9,9,{},false);assert.equal(paused.reason,'タブ非表示');
  const r=lab();r.run('for(let i=0;i<=90;i++)liveProfiler.record(i*1000/60,1,2)');r.click('lab-close');r.run('for(let i=0;i<=90;i++)liveProfiler.record(i*1000/60,1,2)');r.click('lab-open');assert.ok(r.run('liveProfiler.lastValid.fps')>59);assert.match(r.get('labMetrics').textContent,/直近の有効区間/);
});

test('visible but unfocused browser cannot collect foreground samples; reason is exported',()=>{
  const r=lab();r.run("document.hasFocus=()=>false;startBenchmark('STANDARD');for(let n=0;n<=361;n++)loop(n*1000/60)");
  const p=r.json('labExport().benchmarks.at(-1).performance');assert.equal(p.samples,0);assert.equal(p.fps,null);assert.equal(p.status,'INSUFFICIENT');assert.match(p.lastInactiveReason,/フォーカス/);assert.match(r.get('qaResult').textContent,/有効サンプル不足/);
});
