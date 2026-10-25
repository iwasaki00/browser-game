import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {WORLD,DEFAULT_SAVE,PLAYER_CLASSES,WEAPONS,SAVE_KEY,sanitizeSave,canPlayMission} from '../js/data.js';
import {M02,NEST,ABYSS,createM02Geometry,weakCore,queenDamage,updateQueen} from '../js/mission02.js';
import {applyPlayerClass,moveClassPlayer} from '../js/player.js';
import {terrainContact} from '../js/weapons.js';

const seed=(extra={})=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01'],unlockedMissions:['M01','M02'],...extra});
const mission=(extra={})=>{const r=runtime(seed(extra));r.run("startMission('M02')");return r};
const overlap=(p,b)=>p.x+7>b.x+.001&&p.x-7<b.x+b.w-.001&&p.y+32>b.y+.001&&p.y<b.y+(b.h??8)-.001;

test('old M01 clear unlocks real M02, death/retry/title/reload retain it; M03 stays unavailable',()=>{
  const r=runtime({version:1,cleared:['M01'],unlocked:['A-01','S-02','R-04'],equipped:['A-01','R-04']});
  assert.equal(r.run("canPlayMission('M02',save)"),true);r.click('select-mission','M02');assert.equal(r.run('state'),'equip');r.click('deploy');
  assert.equal(r.run('game.world.width'),5600);r.run('game.player.hp=0;update(1/60)');r.flush();assert.equal(r.run('state'),'gameover');
  r.click('retry');assert.equal(r.run('game.missionId'),'M02');r.click('title');r.click('confirm-title');
  const reloaded=runtime(JSON.parse(r.storage.get(SAVE_KEY)));assert.equal(reloaded.run("canPlayMission('M02',save)"),true);assert.equal(reloaded.run("startMission('M03')"),false);
});

for(const id of Object.keys(PLAYER_CLASSES))test(`${id}: full start-to-arena geometry route with actual movement and no overlaps`,()=>{
  const p={x:64,y:116,face:1,onGround:true,anim:0};applyPlayerClass(p,id);p.world=M02.world;
  const geometry=[...createM02Geometry(),...M02.barriers.map(b=>({...b,x:b.x-b.w/2,solid:true}))];let enteredBranch=false,merged=false,maxHeight=0;
  for(let frame=0;frame<15000&&p.x<4785;frame++){
    const up=id==='WING'&&geometry.some(b=>b.y>=90&&p.x+35>b.x&&p.x<b.x+b.w+24);
    moveClassPlayer(p,{right:true,jump:id!=='WING',up},geometry,1/60);
    for(const b of geometry)assert.equal(overlap(p,b),false,`${id} overlaps ${JSON.stringify(b)} at ${p.x},${p.y}`);
    if(p.x>2160&&p.x<3160)enteredBranch=true;if(p.x>=3300)merged=true;maxHeight=Math.max(maxHeight,116-p.y);
  }
  assert.ok(p.x>=4785,`${id} stuck at ${p.x},${p.y}`);assert.ok(enteredBranch&&merged);assert.equal(p.hp,PLAYER_CLASSES[id].hp);
});

test('both branch paths and return travel are reachable, not only a theoretical jump-height comparison',()=>{
  const geometry=createM02Geometry(),p={x:1940,y:116,face:1,onGround:true};applyPlayerClass(p,'GUARDIAN');p.world=M02.world;let usedUpper=false;
  for(let n=0;n<1800&&p.x<3300;n++){moveClassPlayer(p,{right:true,jump:true},geometry,1/60);if(p.x>2200&&p.x<3100&&p.y<=40.001)usedUpper=true}
  assert.ok(usedUpper);assert.ok(p.x>=3300);
  p.x=3200;p.y=116;p.vy=0;p.onGround=true;
  for(let n=0;n<1400&&p.x>2100;n++)moveClassPlayer(p,{left:true},geometry,1/60);
  assert.ok(p.x<2160,'lower route permits retreat');
});

test('WING ascends into real ceiling, hovers at 8 EN/s, and cannot fly through pipes or world bounds',()=>{
  const p={x:1100,y:116,face:1,onGround:true};applyPlayerClass(p,'WING');p.world=M02.world;const geometry=createM02Geometry();
  for(let i=0;i<60;i++)moveClassPlayer(p,{up:true},geometry,1/60);
  assert.equal(p.y,44);assert.ok(Math.abs(p.energy-80)<1e-7);
  for(let i=0;i<60;i++)moveClassPlayer(p,{hover:true},geometry,1/60);
  assert.ok(Math.abs(p.energy-72)<1e-7);p.x=5570;
  for(let i=0;i<60;i++)moveClassPlayer(p,{right:true,up:true},geometry,1/60);
  assert.equal(p.x,5575);assert.ok(p.y>=0);
});

for(const mode of ['LIGHT','STANDARD','MASSIVE'])test(`${mode}: WAVE, SWARM and nest spawns respect shared density cap and per-nest cap`,()=>{
  const r=mission({settings:{...DEFAULT_SAVE.settings,enemyDensity:mode}});
  r.run("game.player.x=1400;game.player.invuln=999;input.fire=false;for(let n=0;n<1200;n++)update(1/60)");
  const limit={LIGHT:30,STANDARD:50,MASSIVE:100}[mode];assert.ok(r.run('game.liveEnemies')<=limit);
  assert.ok(r.run('game.director.spawned')>0);assert.ok(r.run("game.enemies.some(e=>e.nestId)"));
  assert.ok(r.run('game.enemies.filter(e=>!e.dead&&e.nestId===game.enemies.find(e=>e.type===\'nest\').uid).length')<=NEST.ownedLimit);
  assert.ok(r.run('game.director.entries.some(e=>e.active&&e.definition.pattern===\'SWARM\')'));
  r.run("const nest=game.enemies.find(e=>e.type==='nest'&&Math.abs(e.x-game.player.x)<600);damageEnemy(nest,9999);game.director.stopped=true;const before=game.nextEnemyId;for(let n=0;n<400;n++)update(1/60)");
  assert.equal(r.run('game.nextEnemyId'),r.run('before'));assert.ok(r.run("game.effects.length<=INVASION.maxEffects"));
});

test('destroying nest is visual only (no collateral damage), score/death is applied once',()=>{
  const r=mission();r.run("const n=game.enemies.find(e=>e.type==='nest');const w=spawnEnemy('worm',n.x+60);game.grid.rebuild(game.enemies);damageEnemy(n,999,{type:'rocket',vx:1,vy:0});const score=game.score;damageEnemy(n,999)");
  assert.equal(r.run('w.hp'),32);assert.equal(r.run('game.score'),r.run('score'));assert.ok(r.run("game.effects.some(e=>e.kind==='nestBreak')"));
});

test('starter assault and shotgun can destroy both barriers and release physical geometry',()=>{
  for(const id of ['A-01','S-02']){
    const r=mission({equipped:[id,id]});r.run("game.director.stopped=true;game.player.x=2450;game.player.y=116;input.aimMode='touch';input.touchDx=1;input.touchDy=0;input.fire=true;game.player.invuln=999;for(let n=0;n<240;n++)update(1/60)");
    assert.ok(r.run("game.enemies.every(e=>e.type!=='barrier'||e.x>3000||e.dead)"),id);
    assert.equal(r.run("game.platforms.find(p=>p.kind==='barrier').active"),false);
  }
});

test('E05 stops at terrain, E06 is ceiling attached and emits 12-damage throttled acid',()=>{
  const r=mission();r.run("game.enemies.length=0;game.liveEnemies=game.liveMobs=0;game.director.stopped=true;game.player.x=1300;const w=spawnEnemy('worm',1180);const e=spawnEnemy('spitter',1350);for(let n=0;n<180;n++){game.time+=1/60;updateEnemies(1/60)}");
  assert.ok(r.run('w.x+w.w/2')<=1220);assert.equal(r.run('e.y'),44);assert.ok(r.run("game.enemyShots.some(s=>s.kind==='acid'&&s.damage===12)"));
});

test('B02 all four attack patterns, low HP charge, weak core and boss camera are independent from B01',()=>{
  const r=mission();r.run("game.player.x=4800;startBoss();const q=game.enemies[0]");
  assert.equal(r.run('q.hp'),2400);assert.equal(r.run('q.w'),120);
  r.run('q.actionWait=0;updateQueen(game,q,.01,enemyFire,spawnEnemy,pushEffect)');assert.ok(r.run("game.enemyShots.some(s=>s.kind==='acid')"));
  r.run('q.actionWait=0;updateQueen(game,q,.01,enemyFire,spawnEnemy,pushEffect)');assert.ok(r.run('game.liveMobs')>0);
  r.run('q.actionWait=0;updateQueen(game,q,.01,enemyFire,spawnEnemy,pushEffect)');assert.equal(r.run("game.enemyShots.filter(s=>s.kind==='wave').length"),2);
  r.run('q.hp=1200;q.actionIndex=3;q.actionWait=0;updateQueen(game,q,.01,enemyFire,spawnEnemy,pushEffect)');assert.equal(r.run('q.phase'),'charge');
  r.run('updateBattleCamera(game.battleCamera,game.player,game.enemies,game,1)');assert.equal(r.run('game.battleCamera.mode'),'boss');assert.ok(r.run('view.zoom')>=.35);
  const q={type:'queen',x:100,y:52,h:96,timer:0,phase:'move'},core=weakCore(q);
  assert.equal(queenDamage(q,10,{x:core.x,y:core.y}),15);assert.equal(queenDamage(q,10,{x:100,y:55}),10);q.timer=3;assert.equal(queenDamage(q,10,{x:core.x,y:core.y}),10);
});

test('plasma blast on the large boss shell deals damage once; projectile rays can hit the visible weak core',()=>{
  const r=mission({unlocked:['A-01','S-02','P-13','L-03'],equipped:['P-13','L-03']});
  r.run("game.player.x=5100;startBoss();const q=game.enemies[0];q.timer=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let n=0;n<100&&!game.arsenal.stats.blasts;n++){game.time+=1/60;game.grid.rebuild(game.enemies);updateExpanded(game,1/60,weaponAPI)}");
  assert.equal(r.run('game.arsenal.stats.blasts'),1);assert.equal(r.run('q.hp'),2335);
  r.run('game.player.weaponSlot=1;game.player.shotCd=0;shoot();for(let n=0;n<30;n++){game.grid.rebuild(game.enemies);updateShots(1/60)}');
  assert.equal(r.run('q.hp'),2327.5);
});

test('M02 LAB legacy presets use 5600px bounds and solid ceiling, not M01 movement limits',()=>{
  const r=runtime(seed(),{debug:true});r.click('test-lab');r.change('labTerrain','M02');r.change('labEnemy','queen');r.click('lab-spawn');r.click('lab-close');
  r.run('input.right=true;update(.1)');assert.ok(r.run('game.player.x')>4780);
  r.click('lab-open');r.change('labPreset','FLIGHT');r.click('lab-close');r.run('game.player.x=1100;game.player.y=60;input.right=false;input.up=true;update(.5)');assert.equal(r.run('game.player.y'),44);
});

test('lightning can damage a targeted breakable wall without treating the target itself as cover',()=>{
  const r=mission({unlocked:['A-01','S-02','T-16'],equipped:['T-16','A-01']});
  r.run("game.director.stopped=true;game.player.x=2320;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let n=0;n<180;n++){game.time+=1/60;game.grid.rebuild(game.enemies);updateExpanded(game,1/60,weaponAPI)}");
  assert.equal(r.run("game.enemies.find(e=>e.type==='barrier'&&e.x===2520).hp"),12);
  assert.equal(r.run('game.arsenal.stats.strikes'),8);
});

test('boss death produces staged effects then one saved M02 reward, stats and opens implemented M03',()=>{
  const r=mission();r.run("game.time=360;game.player.x=4800;startBoss();const initial=save.unlocked.length;damageEnemy(game.enemies[0],99999,{type:'rocket',vx:1,vy:0})");
  r.flush();r.flush();assert.equal(r.run('state'),'result');assert.equal(r.run('save.unlocked.length'),r.run('initial+1'));
  const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(saved.clearedMissions.includes('M02'));assert.ok(saved.unlockedMissions.includes('M03'));assert.equal(canPlayMission('M03',saved),true);assert.equal(canPlayMission('M04',saved),false);assert.equal(saved.missionStats.M02.bestTime,360);
  r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),JSON.stringify(saved));
});

test('full arsenal uses score alternative and never loops looking for a missing reward',()=>{
  const r=mission({unlocked:WEAPONS.map(w=>w.id)});r.run('game.time=300;completeMission()');assert.equal(r.run('save.unlocked.length'),20);assert.equal(r.run('game.score'),500);assert.match(r.get('rewardBox').innerHTML,/SCORE \+500/);
});

for(const w of WEAPONS)test(`${w.id} can fire in M02; finite shots/jobs/installations remain bounded`,()=>{
  const r=runtime(seed(),{debug:true});r.click('test-lab');r.change('labTerrain','M02');r.change('labWeapon1',w.id);r.change('labEnemy','worm');r.change('labCount','200');r.click('lab-spawn');r.click('lab-close');
  r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let n=0;n<240;n++)update(1/60)");
  assert.equal(r.run('game.lab.equipped[0]'),w.id);assert.ok(r.run('game.shots.length')<=384);assert.ok(r.run('game.arsenal.jobs.length')<=128);assert.ok(r.run('game.enemies.every(e=>Number.isFinite(e.x+e.y+e.hp))'));
});

test('reflection normals, ceiling-blocked meteor, installations and M02 last 800px use mission bounds',()=>{
  const p=createM02Geometry();const roof=terrainContact(1100,70,1100,20,p,0,false,M02.world);assert.equal(roof.ny,1);assert.equal(roof.y,44);
  const wall=terrainContact(1600,55,1700,55,p,0,false,M02.world);assert.equal(wall.nx,-1);
  const r=mission({unlocked:WEAPONS.map(w=>w.id),equipped:['M-20','D-19']});
  r.run("game.director.stopped=true;game.player.x=5100;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let n=0;n<150;n++){game.time+=1/60;updateExpanded(game,1/60,weaponAPI)}");
  assert.ok(r.run('game.arsenal.stats.blasts')>0);assert.ok(r.run('game.effects.every(e=>e.kind!==\'explosion\'||e.y<1)'),'meteor hits ceiling, not through it');
  r.run("game.player.weaponSlot=1;game.player.shotCd=0;shoot()");assert.ok(r.run('game.arsenal.installations[0].x')>4800);assert.equal(r.run('game.arsenal.installations[0].y'),148);
});

test('LAB adds new entities and terrain without writing normal save or progression',()=>{
  const r=runtime(seed(),{debug:true}),before=r.storage.get(SAVE_KEY);r.click('test-lab');r.change('labTerrain','M02');
  for(const type of ['worm','spitter','nest','queen']){r.change('labEnemy',type);r.change('labCount','200');r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),['nest','queen'].includes(type)?1:200);r.run('damageEnemy(game.enemies[0],99999)');r.flush()}
  r.click('lab-exit');assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(r.run('state'),'title');
});

test('new assets and frame metadata match runtime dimensions',()=>{
  const metadata=JSON.parse(readFileSync(new URL('../assets/underground.json',import.meta.url),'utf8'));
  assert.equal(metadata.version,'0.2.2');assert.ok(Object.keys(metadata.assets).length>=10);
  for(const name of ['backgrounds/underground.png','sprites/enemies/tunnel_worm.png','sprites/bosses/abyss_queen.png'])assert.ok(readFileSync(new URL('../assets/'+name,import.meta.url)).length>64);
});

test('M02 camera and renderer cover both 5600px world edges at minimum and maximum zoom',()=>{
  const r=mission();r.run('assetsReady=true');
  for(const zoom of [.35,.85])for(const right of [false,true]){
    r.run(`game.player.x=${right?5575:8};game.battleCamera.zoom=game.battleCamera.targetZoom=${zoom};game.battleCamera.x=${right?5600-320/zoom:0};syncCameraView();draw()`);
    assert.ok(r.run('game.camera')>=0);assert.ok(r.run('game.camera+view.width')<=5600+1e-7);
    for(const call of r.drawCalls)for(const value of call.slice(1))if(typeof value==='number')assert.ok(Number.isFinite(value));
    assert.ok(r.drawCalls.some(call=>call[0]==='fillText'&&String(call[1]).startsWith('M02 ')));
    r.drawCalls.length=0;
  }
  assert.equal(WORLD.width,4800,'M01 world remains unchanged');
});

test('complete M02 engine run from x64 through all five areas to boss death and saved result, without warps',t=>{
  const r=mission({unlocked:['A-01','S-02','L-03'],equipped:['L-03','S-02']});
  // Damage immunity is the sole QA aid; physics, director, HP of enemies, weapon
  // tuning, terrain collisions, boss phases and reward/save code remain real.
  r.run("game.player.invuln=999;const visited=new Set();input.fire=true;input.jump=true");
  for(let batch=0;batch<36&&r.run('state')!=='result';batch++){
    r.run(`for(let n=0;n<600&&state==='play';n++){
      visited.add(game.area);const p=game.player,q=game.enemies.find(e=>e.type==='queen'&&!e.dead);
      input.right=q?q.x-p.x>175:true;input.left=q?p.x-q.x>175:false;
      const target=q??game.enemies.filter(e=>!e.dead&&e.active!==false&&Math.abs(e.x-p.x)<300).reduce((best,e)=>!best||Math.abs(e.x-p.x)<Math.abs(best.x-p.x)?e:best,null);
      const point=target?(target.type==='queen'?weakCore(target):{x:target.x,y:target.y+target.h/2}):{x:p.x+200,y:p.y+13};
      const dx=point.x-p.x,dy=point.y-p.y-13,length=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/length;input.touchDy=dy/length;update(1/60);
    }`);r.flush();
  }
  r.flush();assert.equal(r.run('state'),'result',JSON.stringify(r.json('({x:game.player.x,time:game.time,boss:game.bossStarted,hp:game.enemies.find(e=>e.type===\'queen\')?.hp})')));
  assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.ok(r.run("save.clearedMissions.includes('M02')"));
  t.diagnostic(`simulated clear ${r.run('game.time').toFixed(2)}s / ${r.run('game.kills')} kills / saved result`);
});
