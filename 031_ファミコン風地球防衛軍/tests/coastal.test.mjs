import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS,sanitizeSave,canPlayMission,missionStatus,MISSIONS} from '../js/data.js';
import {M03,COAST,coastalWeakCore,coastalDamage} from '../js/mission03.js';
import {COAST_FILES,loadCoastalArt} from '../js/coastal-art.js';

const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02'],unlockedMissions:['M01','M02'],unlocked:WEAPONS.map(w=>w.id)});
const lab=()=>{const r=runtime(seed(),{debug:true,recordDraw:false});r.click('test-lab');return r};
const start=(r,area=0,qa='C',id='RANGER')=>{r.change('labPreset',id);r.change('labStageMission','M03');r.change('labStageArea',String(area));r.change('labValidation',qa);r.click('lab-stage-start');};
const route=`const p=game.player;input.right=true;input.left=false;
  const obstacle=game.platforms.some(b=>!['quay'].includes(b.kind)&&p.x+27>=b.x&&p.x-7<b.x+b.w);
  const gap=M03.gaps.some(b=>p.x>=b.x-20&&p.x<b.x+b.w+7);
  input.jump=p.onGround&&(obstacle||gap);input.up=p.classId==='WING'&&(obstacle||gap);input.hover=false;input.special=false;`;

test('old M02 clears unlock real M03; GAME OVER/retry keeps progress and M04 remains locked until M03 clears',()=>{
  const old=sanitizeSave({version:1,cleared:['M01','M02'],unlocked:['R-04'],equipped:['A-01','R-04']});assert.ok(canPlayMission('M03',old));assert.equal(missionStatus(MISSIONS[3],old),'LOCKED');assert.equal(canPlayMission('M04',old),false);
  const r=runtime(old),saved=r.storage.get(SAVE_KEY);r.run("startMission('M03');game.player.hp=0;update(1/60)");r.flush();r.click('retry');assert.equal(r.run('game.missionId'),'M03');assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run("startMission('M04')"),false);
});

for(const id of Object.keys(PLAYER_CLASSES))test(`M03 ${id}: A real movement reaches all five areas without a warp or water rescue`,t=>{
  const r=lab();start(r,0,'A',id);r.run(`for(let i=0;i<18000&&state==='play';i++){${route}update(1/60)}`);
  const result=r.json('game.lab.run.snapshot(game)');assert.equal(result.outcome,'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,rescues:game.coast.rescues,warnings:game.lab.run.warnings})')));
  assert.deepEqual(result.areaArrivals.map(a=>a.areaIndex),[0,1,2,3,4]);assert.equal(r.run('game.coast.rescues'),0);assert.equal(result.damageTaken,0);assert.equal(result.normalClearCertified,false);assert.ok(!result.diagnostics.some(x=>x.code==='TERRAIN_INTRUSION'),JSON.stringify(result.diagnostics));
  t.diagnostic(`${id}: A only ${result.elapsed.toFixed(2)}s; no normal-play certification`);
});

test('M03 containers stop horizontal movement, sea drop recovers safely and WING EN rules remain unchanged',()=>{
  const r=runtime(seed());r.run("startMission('M03');game.player.x=1252;input.right=true;for(let i=0;i<60;i++)update(1/60)");assert.ok(r.run('game.player.x')<=1253.01);
  r.run('game.coast.safeX=4030;game.coast.safeY=116;game.player.x=4070;game.player.y=170;game.player.onGround=false;input.right=false;update(1/60)');assert.equal(r.run('game.player.x'),4030);assert.equal(r.run('game.player.hp'),88);assert.ok(r.run('game.player.y')<=116);assert.equal(r.run('game.coast.rescues'),1);
  r.run('game.player.x=4055;game.player.y=116;game.player.onGround=true;recoverCoastalPlayer(game,1/60,hurtPlayer,pushEffect)');assert.equal(r.run('game.coast.safeX'),4030,'do not save a one-pixel ledge as the rescue anchor');
  r.run("applyPlayerClass(game.player,'WING');game.player.x=3000;game.player.y=50;game.player.onGround=false;input.hover=true;for(let i=0;i<60;i++)update(1/60)");assert.ok(Math.abs(r.run('game.player.energy')-92)<.0001);
});

for(const mode of ['LIGHT','STANDARD','MASSIVE'])test(`${mode}: sea waves / ray formations share density cap and never pile up spawn backlog`,()=>{
  const r=lab();r.change('labStageDensity',mode);start(r,2);r.run("game.player.x=2500;for(let n=0;n<600;n++)update(1/60)");
  assert.ok(r.run('game.liveEnemies<=game.enemyLimit'));assert.ok(r.run("game.enemies.some(e=>e.type==='skyray')"));assert.ok(r.run('game.coast.formations.size>0'));assert.ok(r.run('game.coast.formations.size')<=r.run('game.liveEnemies'));
  assert.ok(r.run('game.enemies.every(e=>Number.isFinite(e.x+e.y))'));
});

test('sea landing, all three formations, artillery warning and diving heights are active behaviours',()=>{
  const r=lab();start(r,0);r.run("game.director.stopped=true;const crab=spawnEnemy('shorecrab',game.player.x+220);const before=crab.landingLeft;update(1/60)");assert.ok(r.run('crab.landingLeft<before'));assert.ok(r.run("game.effects.some(e=>e.kind==='coastSplash')"));
  for(const shape of ['LINE','V','STEP']){r.run(`clearLabEnemies();for(let i=0;i<6;i++){const e=spawnEnemy('skyray',1300+i*30,40);e.formationId='${shape}';e.formationOrder=i;e.formationPattern='${shape}'}game.player.x=1200;for(let i=0;i<180;i++)update(1/60)`);assert.ok(r.run('new Set(game.enemies.map(e=>Math.round(e.y))).size>1'));}
  r.run("clearLabEnemies();game.player.x=1000;game.battleCamera.x=900;game.camera=900;const gun=spawnEnemy('siegebeetle',1250);gun.shotCd=0;updateEnemies(1/60)");assert.ok(r.run('gun.warningLeft>0'));assert.equal(r.run('game.enemyShots.length'),0);
  r.run('for(let i=0;i<70;i++)updateEnemies(1/60)');assert.ok(r.run("game.enemyShots.some(s=>s.kind==='artillery')"));
});

test('AA has separate ownership/limit, idle state, flying priority, bounded shots and can be disabled/destroyed',()=>{
  const r=lab();start(r,2);r.run("clearLabEnemies();game.player.x=2700;spawnEnemy('shorecrab',2750);updateCoastalDevices(game,1,damageEnemy,hurtPlayer,pushEffect)");assert.equal(r.run('game.coast.aaShots.length'),0);
  r.run("const ray=spawnEnemy('skyray',2800,48);for(let i=0;i<100;i++){updateCoastalDevices(game,1/60,damageEnemy,hurtPlayer,pushEffect)}");assert.ok(r.run('ray.hp<45'));assert.equal(r.run('game.arsenal.installations.length'),0);assert.ok(r.run('game.coast.aaShots.length')<=COAST.turretShotLimit);
  r.run('game.coast.turretsEnabled=false;game.coast.aaShots.length=0;updateCoastalDevices(game,5,damageEnemy,hurtPlayer,pushEffect)');assert.equal(r.run('game.coast.aaShots.length'),0);
});

test('B03 has three phases, longer exposed core, warnings, bounded summons/projectiles and boss framing',()=>{
  const r=lab();r.click('lab-boss-3');assert.equal(r.run("game.enemies[0].type"),'leviathan');assert.equal(r.run('game.enemies[0].hp'),3000);assert.equal(r.run('game.battleCamera.mode'),'boss');
  for(const [hp,phase] of [[3000,1],[1900,2],[800,3]]){r.run(`var coastBoss=game.enemies.find(e=>e.type==='leviathan');coastBoss.hp=${hp};coastBoss.actionWait=0;coastBoss.warningLeft=0;updateEnemies(1/60)`);assert.equal(r.run('coastBoss.coastPhase'),phase);assert.ok(r.run('coastBoss.warningLeft>0'));r.run('for(let i=0;i<60;i++)updateEnemies(1/60)');assert.ok(r.run('game.enemyShots.length')<=COAST.shotLimit);}
  const e={x:6060,y:48,hp:3000,timer:2.5};assert.equal(coastalWeakCore(e).open,false);e.hp=800;assert.equal(coastalWeakCore(e).open,true);assert.equal(coastalDamage(e,10,{x:6060,y:106}),15);assert.equal(coastalDamage(e,10,{x:0,y:0}),10);
  for(const id of Object.keys(PLAYER_CLASSES)){r.run(`applyPlayerClass(game.player,'${id}');game.player.x=5900;game.player.y=116;game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;game.lab.equipped[0]='L-03';coastBoss.hp=3000;coastBoss.timer=0;game.shots.length=0;const target=coastalWeakCore(coastBoss),dx=target.x-game.player.x-18,dy=target.y-game.player.y-13,len=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;game.grid.rebuild(game.enemies);shoot();for(let i=0;i<40;i++)updateShots(1/60)` .replace('const target=','var target='));assert.equal(r.run('coastBoss.hp'),2992.5,`${id} must hit the exposed core from land`);}
});

test('normal B03 kill completes result/reward/save exactly once; all collected arsenal safely substitutes score',()=>{
  const r=runtime(seed());r.run("startMission('M03');game.player.x=5500;startBoss();game.time=123;damageEnemy(game.enemies[0],9999,{type:'rocket',radial:true,x:6060,y:106,radius:40})");r.flush();r.flush();
  assert.equal(r.run('state'),'result');assert.ok(r.run("save.clearedMissions.includes('M03')"));assert.ok(r.run("save.unlockedMissions.includes('M04')"));assert.equal(r.run('save.missionStats.M03.bestTime'),123);assert.equal(r.run('game.crates'),1);
  const saved=r.storage.get(SAVE_KEY);r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run('game.crates'),1);assert.match(r.get('rewardBox').innerHTML,/SCORE \+500/);
});

test('M03 C combat QA walks from spawn through all areas and kills B03 with actual laser shots, no checkpoint warp',t=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labWeapon1','L-03');start(r);r.run('const visited=new Set();input.fire=true');
  for(let batch=0;batch<360&&r.run('game.lab.run.outcome')==='RUNNING';batch++){
    r.run(`for(let n=0;n<60&&state==='play';n++){
      ${route}visited.add(game.area);const boss=game.enemies.find(e=>e.type==='leviathan'&&!e.dead);
      if(boss){input.right=boss.x-p.x>170;input.left=p.x-boss.x>170;input.jump=p.onGround;}
      const target=boss??nearestEnemy(game.enemies,p.x,p.y,280);const point=target?(target.type==='leviathan'?coastalWeakCore(target):{x:target.x,y:target.y+target.h/2}):{x:p.x+200,y:p.y+13};
      const dx=point.x-p.x,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;update(1/60);
    }`);r.flush();
  }
  const report=r.json('game.lab.run.snapshot(game)');assert.equal(report.outcome,'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,time:game.time,boss:game.enemies.find(e=>isBoss(e))?.hp,report:game.lab.run.warnings})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(report.normalClearCertified,false);assert.ok(report.weaponDamage['L-03']>3000);
  t.diagnostic(`C only ${report.elapsed.toFixed(2)}s / boss ${report.bossDefeatTime.toFixed(2)}s / kills ${report.kills}; not normal D`);
});

test('all 20 weapons execute on coastal terrain; installations refuse water and old tuning does not change',()=>{
  const r=lab();start(r,0);const before=JSON.stringify(WEAPONS);
  for(const w of WEAPONS){r.run(`game.lab.equipped[0]='${w.id}';game.player.weaponSlot=0;game.player.x=1000;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let i=0;i<60;i++)update(1/60);clearArsenal(game)`);assert.ok(r.run('game.shots.every(s=>Number.isFinite(s.x+s.y))'),w.id)}
  r.run("game.player.x=4056;game.player.face=1;game.player.y=116;game.lab.equipped[0]='D-19';game.player.shotCd=0;shoot()");assert.equal(r.run('game.arsenal.installations.length'),0);assert.equal(JSON.stringify(WEAPONS),before);
});

test('M03 LAB five starts and boss results retain save isolation and clear coastal transient state',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);for(let i=0;i<5;i++){start(r,i);assert.equal(r.run('game.area'),i);assert.equal(r.run('game.missionId'),'M03');assert.equal(r.run('game.coast.hazards.length'),0);r.click('lab-open')}
  r.click('lab-boss-3');r.run("damageEnemy(game.enemies[0],9999,{type:'rocket'})");r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.storage.get(SAVE_KEY),saved);
});

test('M03 first-clear box prefers missing weapons and persists class/loadout plus monotonic progression',()=>{
  const old={...seed(),unlocked:['A-01','S-02'],equipped:['A-01','S-02'],selectedClass:'GUARDIAN'};const r=runtime(old);r.run("startMission('M03');game.time=210;completeMission()");const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.equal(saved.unlocked.length,3);assert.equal(saved.selectedClass,'GUARDIAN');assert.deepEqual(saved.equipped,old.equipped);assert.ok(saved.clearedMissions.includes('M03'));assert.equal(saved.missionStats.M03.bestTime,210);
});

test('M03 normal engine QA runs spawn -> five areas -> actual shots -> B03 -> saved result (damage immunity aid, not human D)',t=>{
  const r=runtime({...seed(),equipped:['L-03','S-02']},{recordDraw:false});r.run("startMission('M03');game.player.invuln=999;input.fire=true;const visited=new Set()");
  for(let batch=0;batch<240&&r.run('state')!=='result';batch++){
    r.run(`for(let n=0;n<60&&state==='play';n++){
      ${route}visited.add(game.area);const boss=game.enemies.find(e=>e.type==='leviathan'&&!e.dead);if(boss){input.right=boss.x-p.x>170;input.left=p.x-boss.x>170;input.jump=p.onGround}
      const target=boss??nearestEnemy(game.enemies,p.x,p.y,280),point=target?(target.type==='leviathan'?coastalWeakCore(target):{x:target.x,y:target.y+target.h/2}):{x:p.x+200,y:p.y+13};const dx=point.x-p.x,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;update(1/60)
    }`);r.flush();r.flush();
  }
  assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions.includes('M03'));assert.ok(r.run('save.missionStats.M03.bestTime')>0);
  t.diagnostic(`Normal engine with immunity QA aid ${r.run('game.time').toFixed(2)}s / ${r.run('game.kills')} kills / saved result; D not certified`);
});

test('LAB 200 coastal mobs take radial explosions once, with bounded deaths/particles/formation cleanup',()=>{
  const r=lab();r.click('lab-open');r.change('labEnemy','skyray');r.change('labCount','200');r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),200);r.run("for(const e of game.enemies){e.x=1250;e.y=100}game.grid.rebuild(game.enemies);explode({x:1250,y:112,radius:42,damage:100,type:'rocket'});const score=game.score;explode({x:1250,y:112,radius:42,damage:100,type:'rocket'})");assert.equal(r.run('game.kills'),200);assert.equal(r.run('game.score'),r.run('score'));assert.ok(r.run('game.impact.particles.length')<=48);r.run('for(let i=0;i<120;i++)updateEnemies(1/60)');assert.equal(r.run('game.enemies.length'),0);assert.equal(r.run('game.coast.formations.size'),0);
});

test('coastal assets have exact runtime dimensions, load failures remain safe and existing 5-tab UI gains only coastal controls',async()=>{
  const m=JSON.parse(readFileSync(new URL('../assets/coastal-01/manifest.json',import.meta.url)));for(const [key,[path,w,h]] of Object.entries(COAST_FILES)){assert.deepEqual(m.assets[path].size,[w,h],key)}
  const pack=await loadCoastalArt(async()=>{throw Error('404')});assert.ok(Object.values(pack).every(x=>x===null));
  const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='OLD:'+k);coastalArt=Object.fromEntries(Object.keys(COAST_FILES).map(k=>[k,'COAST:'+k]));startMission('M03');spawnEnemy('shorecrab',170);spawnEnemy('skyray',220,50);spawnEnemy('siegebeetle',270);var boss=spawnEnemy('leviathan',500,48);boss.hp=800;const snapshot=JSON.stringify(game);draw()");assert.equal(r.run('JSON.stringify(game)'),r.run('snapshot'));assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='COAST:leviathan'));
  r.run('coastalArt=null;draw()');assert.equal(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==null),false);assert.ok(r.drawCalls.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/lab-boss-3/);assert.match(html,/lab-coast-turrets/);assert.match(html,/E-09/);assert.equal((html.match(/role="tab"/g)||[]).length,5);
});
