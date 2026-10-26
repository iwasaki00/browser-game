import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS,MISSIONS,sanitizeSave,canPlayMission,missionStatus} from '../js/data.js';
import {SKY} from '../js/mission04.js';
import {SKY_FILES,loadSkyArt} from '../js/sky-art.js';
const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03'],unlocked:WEAPONS.map(w=>w.id)});
const lab=()=>{const r=runtime(seed(),{debug:true,recordDraw:false});r.click('test-lab');return r};
const start=(r,area=0,mode='C',id='RANGER')=>{r.change('labPreset',id);r.change('labStageMission','M04');r.change('labStageArea',String(area));r.change('labValidation',mode);r.click('lab-stage-start')};
const route="const p=game.player;input.right=true;input.left=false;const obstacle=game.platforms.some(b=>!['roof','arena','recovery'].includes(b.kind)&&p.x+30>=b.x&&p.x-7<b.x+b.w);const step=game.platforms.some(b=>b.kind==='roof'&&b.x>2900&&p.x+30>=b.x&&p.x<b.x&&p.y+32>b.y);input.jump=p.onGround&&(obstacle||step);input.up=p.classId==='WING'&&(obstacle||step);input.hover=false;input.special=false;";

test('legacy M03 clear unlocks M04; M05 unavailable; death/retry retains progression',()=>{
  const old=sanitizeSave({version:1,cleared:['M01','M02','M03'],unlocked:['R-04'],equipped:['A-01','R-04']});
  assert.ok(canPlayMission('M04',old));assert.equal(missionStatus(MISSIONS[4],old),'COMING SOON');assert.equal(canPlayMission('M05',old),false);
  const r=runtime(old),saved=r.storage.get(SAVE_KEY);r.run("startMission('M04');game.player.hp=0;update(1/60)");r.flush();r.click('retry');assert.equal(r.run('game.missionId'),'M04');assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of Object.keys(PLAYER_CLASSES))test('M04 '+id+': real movement reaches all areas without warp',t=>{
  const r=lab();start(r,0,'A',id);r.run("for(let i=0;i<18000&&state==='play';i++){"+route+"update(1/60)}");
  const report=r.json('game.lab.run.snapshot(game)');assert.equal(report.outcome,'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,diagnostics:game.lab.run.warnings})')));assert.deepEqual(report.areaArrivals.map(a=>a.areaIndex),[0,1,2,3,4]);assert.equal(r.run('game.sky.rescues'),0);assert.ok(!report.diagnostics.some(d=>d.code==='TERRAIN_INTRUSION'),JSON.stringify(report.diagnostics));t.diagnostic(id+' A '+report.elapsed.toFixed(2)+'s; not normal combat clear');
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+': platform carries through reversal; jump detaches; installation follows',()=>{
  const r=lab();start(r,2,'A',id);r.run("const deck=game.platforms.find(b=>b.moving);game.time=0;deck.x=deck.baseX;Object.assign(game.player,{x:deck.x+50,y:deck.y-32,onGround:true});game.arsenal.installations.push({ownerId:game.arsenal.ownerId,type:'mine',x:deck.x+20,y:deck.y,life:20,weapon:weapon('M-18')});const offset=game.player.x-deck.x;for(let i=0;i<420;i++)update(1/60)");
  assert.ok(Math.abs(r.run('game.player.x-deck.x-offset'))<.01);assert.equal(r.run('game.player.y'),92);assert.ok(Math.abs(r.run('game.arsenal.installations[0].x-deck.x-20'))<.01);
  r.run("input.jump=true;input.up=true;update(1/60)");assert.equal(r.run('game.player.onGround'),false);assert.ok(r.run('game.player.y')<92);
});
test('collision and rescue retain GUARDIAN stats and WING hover EN',()=>{
  const r=lab();start(r,0,'B','GUARDIAN');r.run("game.player.x=595;input.right=true;for(let i=0;i<30;i++)update(1/60)");assert.ok(r.run('game.player.x')<=597.001);
  r.run('input.right=false;game.player.invuln=0;game.player.x=100;game.player.y=220;game.player.onGround=false;update(1/60)');assert.equal(r.run('game.sky.rescues'),1);assert.equal(r.run('game.player.hp'),191);assert.equal(r.run('game.player.maxHp'),200);
  r.run("applyPlayerClass(game.player,'WING');game.player.y=40;game.player.onGround=false;input.hover=true;for(let i=0;i<60;i++)update(1/60)");assert.ok(Math.abs(r.run('game.player.energy')-92)<1e-5);
});
test('E10 warned dash and E12 locked artillery; E11 single-stack shield immediately clears on death',()=>{
  const r=lab();start(r);r.run("clearLabEnemies();game.player.x=1000;const e=spawnEnemy('interceptor',1150,50);e.diveCd=0;updateEnemies(1/60)");assert.ok(r.run('e.warningLeft>0'));r.run('const target=e.warnX;game.player.x=800;for(let i=0;i<44;i++)updateEnemies(1/60)');assert.equal(r.run('e.warnX'),r.run('target'));assert.ok(r.run('e.diveTimer>0'));
  r.run("clearLabEnemies();game.player.x=1000;const gun=spawnEnemy('heavygunner',1250);gun.shotCd=0;updateEnemies(1/60);const wx=gun.warnX,wy=gun.warnY;game.player.x=900;for(let i=0;i<83;i++)updateEnemies(1/60)");assert.ok(r.run('game.enemyShots.length')>0);assert.ok(r.run('Math.abs((wy-gun.y-12)/(wx-gun.x)-game.enemyShots[0].vy/game.enemyShots[0].vx)')<1e-8);
  r.run("clearLabEnemies();const victim=spawnEnemy('heavygunner',1200),d1=spawnEnemy('shielddrone',1210,70),d2=spawnEnemy('shielddrone',1220,70);damageEnemy(victim,10,{type:'bullet'})");assert.equal(r.run('victim.hp'),213);r.run("damageEnemy(d1,999);damageEnemy(d2,999);damageEnemy(victim,10)");assert.equal(r.run('victim.hp'),203);
});
for(const phase of [1,2,3])test('B04 Phase '+phase+': repeated start resets all transient state and population counts',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labSkyPhase',String(phase));
  for(let i=0;i<3;i++){r.click('lab-boss-4');assert.equal(r.run('game.enemies[0].skyPhase'),phase);assert.equal(r.run('game.enemies[0].hp'),3200);assert.equal(r.run('game.liveEnemies'),1);assert.equal(r.run('game.liveMobs'),0);assert.equal(r.run('game.sky.parts.filter(e=>!e.dead).length'),phase===1?4:phase===2?2:0);assert.equal(r.run('game.enemyShots.length+game.shots.length+game.effects.length+game.arsenal.jobs.length'),0);assert.equal(r.run('game.battleCamera.mode'),'boss');r.run("game.enemyShots.push({});game.sky.hazards.push({});game.arsenal.jobs.push({})");r.click('lab-open')}
  assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('B04 phase gates, armor feedback, no device drops or kill count and one final defeat',()=>{
  const r=lab();r.click('lab-boss-4');r.run("const boss=game.enemies[0];const score=game.score;damageEnemy(boss,999,{type:'bullet'});const generator=game.sky.parts.find(p=>p.partKind==='generator');damageEnemy(generator,999)");
  assert.equal(r.run('boss.hp'),3200);assert.equal(r.run('generator.hp'),220);assert.equal(r.run('game.score'),r.run('score'));assert.ok(r.run('game.effects.length')>0);
  r.run("for(const p of game.sky.parts)if(p.partKind==='turret')damageEnemy(p,999);updateEnemies(1/60)");assert.equal(r.run('boss.skyPhase'),2);
  r.run("damageEnemy(boss,999);for(const p of game.sky.parts)if(p.partKind==='generator')damageEnemy(p,999);updateEnemies(1/60)");assert.equal(r.run('boss.skyPhase'),3);assert.equal(r.run('game.kills'),0);assert.equal(r.run('game.items.length'),0);assert.equal(r.run('game.liveEnemies'),1);
  r.run("damageEnemy(boss,10);damageEnemy(boss,9999,{type:'rocket'});damageEnemy(boss,9999)");r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.run('game.kills'),1);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' '+wid+': actual shots hit turrets, both generators and exposed core from land',()=>{
  const r=lab();r.change('labPreset',id);r.change('labWeapon1',wid);r.click('lab-boss-4');
  r.run("const boss=game.enemies[0];for(const phase of [1,2,3]){resetSkyBossPhase(game,boss,phase);const targets=phase===3?[boss]:game.sky.parts.filter(p=>!p.dead&&p.partKind===(phase===1?'turret':'generator'));for(const target of targets){game.player.x=target.x-75;game.player.y=116;game.player.shotCd=game.player.switchCd=0;const old=target.hp;const dx=target.x-game.player.x-18,dy=target.y+target.h/2-game.player.y-13,len=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;game.grid.rebuild(game.enemies);shoot();for(let i=0;i<40;i++)updateShots(1/60);if(!(target.hp<old))throw Error('miss '+phase+' '+target.x)}}");
});
test('warning rectangles match active attacks; GUARDIAN exit time plus reaction is sufficient',()=>{
  const r=lab();r.click('lab-boss-4');for(const phase of [1,2,3]){r.run("resetSkyBossPhase(game,game.enemies[0],"+phase+");game.player.x=6650;var b=game.enemies[0];b.actionWait=0;updateEnemies(1/60);var zones=JSON.stringify(b.attackPlan.zones);var width=b.attackPlan.zones[0].w;for(let i=0;i<76;i++)updateEnemies(1/60)");assert.equal(r.run('JSON.stringify(game.sky.hazards.map(({x,y,w,h})=>({x,y,w,h})))'),r.run('zones'));assert.ok((r.run('width')/2+7)/65+.25<SKY.warning);}
});
test('30/50/100 caps and LAB200; mass explosion/death effects bounded',()=>{
  const r=lab();for(const [mode,cap] of [['LIGHT',30],['STANDARD',50],['MASSIVE',100]]){r.change('labStageDensity',mode);start(r,1);r.run('for(let i=0;i<900;i++)update(1/60)');assert.ok(r.run('game.liveEnemies')<=cap);r.click('lab-open')}
  r.change('labEnemy','interceptor');r.change('labCount','200');r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),200);
  r.run("for(const e of game.enemies){e.x=1300;e.y=100}game.grid.rebuild(game.enemies);explode({x:1300,y:112,radius:42,damage:999,type:'rocket'});const score=game.score;explode({x:1300,y:112,radius:42,damage:999,type:'rocket'})");assert.equal(r.run('game.kills'),200);assert.equal(r.run('game.score'),r.run('score'));assert.ok(r.run('game.impact.particles.length')<=48);
});
test('normal M04 clear saves rewards once; LAB collapse never saves',()=>{
  const r=runtime(seed());r.run("startMission('M04');game.player.x=6090;startBoss();resetSkyBossPhase(game,game.enemies[0],3);game.time=180;damageEnemy(game.enemies[0],9999,{type:'rocket'})");r.flush();r.flush();assert.equal(r.run('state'),'result');assert.ok(r.run("save.clearedMissions.includes('M04')"));assert.ok(r.run("save.unlockedMissions.includes('M05')"));assert.equal(r.run('save.missionStats.M04.bestTime'),180);assert.equal(r.run('game.crates'),1);const saved=r.storage.get(SAVE_KEY);r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),saved);
  const l=lab(),before=l.storage.get(SAVE_KEY);l.click('lab-sky-collapse');l.flush();assert.equal(l.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(l.storage.get(SAVE_KEY),before);
});
test('new art dimensions/fallback, five tabs, read-only rendering',async()=>{
  const catalog=JSON.parse(readFileSync(new URL('../assets/sky-01/catalog.json',import.meta.url)));assert.equal(catalog.assets.length,19);
  for(const [k,[p,w,h]] of Object.entries(SKY_FILES))assert.deepEqual(catalog.assets.find(a=>a.path===p)?.size,[w,h],k);
  assert.ok(Object.values(await loadSkyArt(async()=>{throw Error('missing')})).every(v=>v===null));
  const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='old:'+k);startMission('M04');const s=JSON.stringify(game);draw()");assert.equal(r.run('JSON.stringify(game)'),r.run('s'));assert.ok(r.drawCalls.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.match(html,/labSkyPhase/);assert.match(html,/lab-sky-platforms/);
});

for(const id of Object.keys(PLAYER_CLASSES))test(id+': C QA from mission start, actual starter fire defeats all B04 phases without warp',t=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labWeapon1','A-01');r.change('labWeapon2','S-02');start(r,0,'C',id);r.run('const visited=new Set();input.fire=true');
  for(let batch=0;batch<300&&r.run('game.lab.run.outcome')==='RUNNING';batch++){
    r.run("for(let n=0;n<60&&state==='play';n++){"+route+"visited.add(game.area);const boss=game.enemies.find(e=>e.type==='fortress'&&!e.dead);const target=boss?(boss.skyPhase===3?boss:nearestEnemy(game.sky.parts.filter(e=>!e.dead&&skyTargetOpen(game,e)),p.x,p.y)):nearestEnemy(game.enemies,p.x,p.y,280);if(boss&&target){input.right=target.x-p.x>75;input.left=target.x-p.x<65;input.jump=false;input.up=false;}const point=target?{x:target.x,y:target.y+target.h/2}:{x:p.x+200,y:p.y+13};const dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;update(1/60)}");r.flush();
  }
  const report=r.json('game.lab.run.snapshot(game)');assert.equal(report.outcome,'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,time:game.time,boss:game.enemies.find(e=>isBoss(e))?.hp,parts:game.sky.parts.map(e=>({hp:e.hp,dead:e.dead})),warnings:game.lab.run.warnings})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(report.normalClearCertified,false);t.diagnostic(id+' C '+report.elapsed.toFixed(2)+'s / boss '+report.bossDefeatTime.toFixed(2)+'s / '+report.kills+' kills / not human D');
});

test('normal engine: no-warp start -> actual A01 combat -> all boss phases -> saved rewards (immunity QA aid, not D)',t=>{
  const old=seed();old.unlocked=['A-01','S-02'];const r=runtime(old,{recordDraw:false});r.run("startMission('M04');game.player.invuln=999;const visited=new Set();input.fire=true");
  for(let batch=0;batch<300&&r.run('state')!=='result';batch++){
    r.run("for(let n=0;n<60&&state==='play';n++){"+route+"visited.add(game.area);const boss=game.enemies.find(e=>e.type==='fortress'&&!e.dead);const target=boss?(boss.skyPhase===3?boss:nearestEnemy(game.sky.parts.filter(e=>!e.dead&&skyTargetOpen(game,e)),p.x,p.y)):nearestEnemy(game.enemies,p.x,p.y,280);if(boss&&target){input.right=target.x-p.x>75;input.left=target.x-p.x<65;input.jump=false;input.up=false}const point=target?{x:target.x,y:target.y+target.h/2}:{x:p.x+200,y:p.y+13},dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;update(1/60)}");r.flush();r.flush();
  }
  assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(saved.clearedMissions.includes('M04'));assert.ok(saved.unlocked.length>2);assert.ok(saved.missionStats.M04.bestTime>0);assert.equal(canPlayMission('M05',saved),false);t.diagnostic('normal engine + immunity aid '+r.run('game.time').toFixed(2)+'s; not human normal clear');
});
test('all20 weapons execute against M04 geometry and devices; 200 enemies plus devices stay separately counted',()=>{
  const r=lab();r.click('lab-boss-4');r.run("const boss=game.enemies[0]");
  for(const w of WEAPONS){r.run("resetSkyBossPhase(game,boss,3);game.player.x=6550;game.player.y=116;game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;game.lab.equipped[0]='"+w.id+"';input.aimMode='touch';input.touchDx=1;input.touchDy=-.2;shoot();for(let i=0;i<90;i++)update(1/60)");assert.ok(r.run('game.shots.every(s=>Number.isFinite(s.x+s.y))'),w.id);assert.ok(r.run('game.arsenal.jobs.length')<=128);r.run('clearArsenal(game);game.shots.length=0')}
  r.run("resetSkyBossPhase(game,boss,1);game.enemyLimit=200;game.bossStarted=false;for(let i=0;i<220;i++)spawnEnemy('interceptor',6100+i*2,50)");assert.equal(r.run('game.liveEnemies'),200);assert.equal(r.run('game.sky.parts.filter(e=>!e.dead).length'),4);assert.equal(r.run('game.enemies.filter(e=>!e.dead&&!e.fixedDevice).length'),200);
});
test('SCOUT dash cannot tunnel through M04 defense blocks; genuine placement rides moving floor',()=>{
  const r=lab();start(r,0,'A','SCOUT');r.run("game.player.x=570;input.right=true;input.special=true;for(let i=0;i<20;i++)update(1/60)");assert.ok(r.run('game.player.x')<=597);
  r.click('lab-open');start(r,2);r.run("const deck=game.platforms.find(p=>p.moving);game.player.x=deck.x+35;game.player.y=deck.y-32;game.player.onGround=true;game.lab.equipped[0]='D-19';game.player.weaponSlot=0;game.player.shotCd=0;shoot();const at=game.arsenal.installations[0].x-deck.x;for(let i=0;i<120;i++)update(1/60)");assert.ok(Math.abs(r.run('game.arsenal.installations[0].x-deck.x-at'))<1e-6);
});
