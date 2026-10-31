import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS,MISSIONS,sanitizeSave,canPlayMission,missionStatus} from '../js/data.js';
import {M05,MOBILE} from '../js/mission05.js';
import {MOBILE_FILES,loadMobileArt} from '../js/mobile-art.js';
const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03','M04']});
const lab=()=>{const r=runtime(seed(),{debug:true,recordDraw:false});r.click('test-lab');r.change('labStageMission','M05');return r};
function start(r,area=0,mode='C',id='RANGER'){if(r.run('state')==='play')r.click('lab-open');r.change('labPreset',id);r.change('labValidation',mode);r.change('labStageArea',String(area));r.click('lab-stage-start')}
const route=`const p=game.player;input.right=true;input.left=false;input.jump=false;input.up=false;input.hover=false;input.special=false;
const obstacle=game.platforms.some(b=>b.active!==false&&!b.gate&&!['wilderness','ceiling'].includes(b.kind)&&p.x+30>=b.x&&p.x-7<b.x+b.w&&p.y+32>b.y+.5);
input.jump=p.onGround&&obstacle;input.up=p.classId==='WING'&&obstacle;
const b=game.enemies.find(e=>e.type==='reactor'&&!e.dead),devices=game.mobile.devices.filter(e=>!e.dead);
const target=b?(b.shielded?nearestEnemy(devices,p.x,p.y):b):nearestEnemy(devices.filter(e=>e.x>=p.x-90),p.x,p.y,470)??nearestEnemy(game.enemies.filter(e=>!e.fixedDevice),p.x,p.y,200);
if(target&&(target.fixedDevice||b)){input.right=target.x-p.x>75;input.left=target.x-p.x<65;if(b){input.jump=false;input.up=false}}
const point=target?{x:target.x,y:target.y+target.h/2}:{x:p.x+200,y:p.y+13},dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;
input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;input.fire=true;`;

test('old M04 clear unlocks implemented M05; M06 remains locked without M05 clear; retry keeps save',()=>{
  const old=sanitizeSave({version:1,cleared:['M01','M02','M03','M04'],unlocked:['R-04'],equipped:['A-01','R-04']});
  assert.ok(canPlayMission('M05',old));assert.equal(missionStatus(MISSIONS[5],old),'LOCKED');assert.equal(canPlayMission('M06',old),false);
  const r=runtime(old);r.run("startMission('M05');game.player.hp=0;update(1/60)");r.flush();const saved=r.storage.get(SAVE_KEY);r.click('retry');assert.equal(r.run('game.missionId'),'M05');assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' A: real movement/mandatory-device shooting boards base and reaches all areas without warp',t=>{
  const r=lab();start(r,0,'A',id);r.run('var visited=new Set();var boarded=false;var peak=0');
  r.run("for(let i=0;i<24000&&state==='play';i++){"+route+"visited.add(game.area);update(1/60);if(p.x>1400&&p.x<2900&&p.onGround&&p.y<110)boarded=true;peak=Math.max(peak,p.x)}");
  assert.equal(r.run('game.lab.run.outcome'),'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,parts:game.mobile.devices.map(e=>({kind:e.partKind,hp:e.hp})),warnings:game.lab.run.warnings})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.run('boarded'),true);assert.equal(r.run('game.mobile.driveOff'),true);assert.equal(r.run('game.mobile.controlOff'),true);assert.ok(!r.json('game.lab.run.warnings').some(e=>e.code==='TERRAIN_INTRUSION'));t.diagnostic(id+' A '+r.run('game.time').toFixed(2)+'s, no combat-clear claim');
});
for(const axis of ['x','y'])for(const id of Object.keys(PLAYER_CLASSES))test(id+' '+axis+' platform: real carry, turnaround, jump and installation support',()=>{
  const r=lab();start(r,axis==='y'?1:2,'A',id);r.run("var deck=game.platforms.find(b=>b.axis==='"+axis+"');game.time=0;deck.x=deck.baseX;deck.y=deck.baseY;Object.assign(game.player,{x:deck.x+45,y:deck.y-32,onGround:true});game.arsenal.installations.push({ownerId:game.arsenal.ownerId,type:'mine',x:deck.x+20,y:deck.y,life:20,weapon:weapon('M-18')});for(let i=0;i<360;i++)update(1/60)");
  assert.ok(Math.abs(r.run('game.player.y+32-deck.y'))<.1);assert.ok(Math.abs(r.run('game.arsenal.installations[0].y-deck.y'))<.1);assert.ok(Math.abs(r.run('game.arsenal.installations[0].x-deck.x-20'))<.1);
  r.run('input.jump=true;input.up=true;update(1/60)');assert.equal(r.run('game.player.onGround'),false);assert.ok(r.run('game.player.y+32<deck.y'));
});
test('independent turrets stop fire, hatch opens only after both; drive changes only M05 travel/reinforcement clock',()=>{
  const r=lab();start(r,1);r.run("var turrets=game.mobile.devices.filter(e=>e.partKind==='turret');damageEnemy(turrets[0],999);var hatch=game.platforms.find(e=>e.gate==='turrets')");assert.equal(r.run('hatch.active'),true);r.run('damageEnemy(turrets[1],999)');assert.equal(r.run('hatch.active'),false);
  r.run("var before=game.mobile.travel,x=game.player.x,v=game.player.world.gravity;damageEnemy(game.mobile.devices.find(e=>e.partKind==='drive'),999);updateMobileState(game,1,hurtPlayer,pushEffect)");assert.equal(r.run('game.mobile.speed'),.35);assert.ok(Math.abs(r.run('game.mobile.travel-before')-45*.35)<1e-8);assert.equal(r.run('game.player.x'),r.run('x'));assert.equal(r.run('game.player.world.gravity'),r.run('v'));assert.equal(r.run('game.kills'),0);
});
test('E13 locks warned charge, then recovery; E15 warned bounded three-shot burst',()=>{
  const r=lab();start(r);r.run("clearLabEnemies();game.player.x=1000;var roller=spawnEnemy('assaultroller',1140);roller.diveCd=0;updateEnemies(1/60)");assert.ok(r.run('roller.warningLeft>0'));r.run('var wx=roller.warnX;game.player.x=800;for(let i=0;i<75;i++){game.time+=1/60;updateEnemies(1/60)}');assert.equal(r.run('roller.warnX'),r.run('wx'));assert.ok(r.run('roller.recoverLeft>0'));
  r.run("clearLabEnemies();game.player.x=1000;var walker=spawnEnemy('sentrywalker',1250);walker.shotCd=0;updateEnemies(1/60);for(let i=0;i<130;i++){game.time+=1/60;updateEnemies(1/60)}");assert.equal(r.run('game.enemyShots.length'),3);assert.ok(r.run('walker.shotCd>0'));
});
test('E14 heal has amount/time/global budgets; never revives dead enemies or repairs fixed/core parts',()=>{
  const r=lab();r.click('lab-boss-5');r.run("var boss=game.enemies[0],left=game.mobile.devices[0];left.hp=100;boss.hp=3500;spawnEnemy('repairdrone',boss.x,80);var victim=spawnEnemy('assaultroller',7140);victim.hp=10;var dead=spawnEnemy('assaultroller',7150);damageEnemy(dead,999);for(let i=0;i<10;i++)spawnEnemy('repairdrone',7150+i,70);game.grid.rebuild(game.enemies);updateMobileRepairs(game,.25)");
  assert.equal(r.run('victim.hp'),18);assert.equal(r.run('left.hp'),100);assert.equal(r.run('boss.hp'),3500);assert.equal(r.run('dead.dead'),true);assert.ok(r.run('game.mobile.repairs.length')<=MOBILE.repairLinks);
  r.run('for(let i=0;i<7;i++){game.time+=.25;updateMobileRepairs(game,.25)}');assert.equal(r.run('victim.hp'),18);r.run('game.time=4;updateMobileRepairs(game,.25)');assert.ok(r.run('victim.hp')<=26);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' B05 B: real movement avoids locked artillery after reaction, without immunity',()=>{
  const r=lab();r.change('labPreset',id);r.change('labValidation','B');r.click('lab-boss-5');r.run("game.player.x=7480;var hp=game.player.hp,b=game.enemies[0];b.actionWait=0;for(let i=0;i<125;i++){input.left=i>=15;update(1/60)}");assert.equal(r.run('game.player.hp'),r.run('hp'));assert.equal(r.run('game.lab.invincible'),false);
});
test('E13 warning/charge reservations share existing concurrent-attack budget',()=>{
  const r=lab();start(r);r.click('lab-open');r.change('labEnemy','assaultroller');r.change('labCount','200');r.click('lab-spawn');r.run("game.player.x=1200;for(const e of game.enemies){e.x=1280;e.y=124}var peak=0;for(let i=0;i<150;i++){game.time+=1/60;updateEnemies(1/60);peak=Math.max(peak,game.enemies.filter(e=>!e.dead&&(e.warningLeft>0||e.dashLeft>0)).length)}");assert.ok(r.run('peak')<=r.run('INVASION.simultaneousDives'));assert.equal(r.run('game.liveEnemies'),200);
});
for(const order of [['left','right'],['right','left']])test('B05 '+order.join(' -> ')+': independent suppression, shield, idempotent state and final clear',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.click('lab-boss-5');r.run("var boss=game.enemies[0];damageEnemy(boss,999);var score=game.score");assert.equal(r.run('boss.hp'),3600);assert.ok(r.run('boss.shieldedUntil>0'));
  for(const kind of order){r.run("var part=game.mobile.devices.find(e=>e.partKind==='"+kind+"');damageEnemy(part,999);var events=game.mobile.events.length;damageEnemy(part,999)");assert.equal(r.run('game.mobile.events.length'),r.run('events'));assert.equal(r.run('boss.'+kind+'Destroyed'),true);if(kind===order[0])assert.equal(r.run('boss.shielded'),true)}
  assert.equal(r.run('boss.shielded'),false);assert.equal(r.run('boss.mobilePhase'),3);assert.equal(r.run('game.kills'),0);r.run('damageEnemy(boss,9999);damageEnemy(boss,9999)');r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const state of ['FULL','LEFT','RIGHT','OPEN'])test('B05 restart '+state+' resets devices, shots, summons, jobs, timing and camera without save',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labMobileState',state);
  for(let i=0;i<2;i++){r.click('lab-boss-5');assert.equal(r.run('game.enemies[0].hp'),3600);assert.equal(r.run('game.mobile.devices.length'),2);assert.equal(r.run('game.mobile.devices.filter(e=>!e.dead).length'),state==='FULL'?2:state==='OPEN'?0:1);assert.equal(r.run('game.liveEnemies'),1);assert.equal(r.run('game.liveMobs'),0);assert.equal(r.run('game.mobile.hazards.length+game.enemyShots.length+game.shots.length+game.arsenal.jobs.length'),0);assert.equal(r.run('game.battleCamera.mode'),'boss');r.run('game.mobile.hazards.push({});game.enemyShots.push({});game.arsenal.jobs.push({})');r.click('lab-open')}
  assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' '+wid+' actual starter fire destroys both boss controls and reactor',t=>{
  const r=lab();r.change('labPreset',id);r.change('labWeapon1',wid);r.click('lab-boss-5');
  for(let batch=0;batch<300&&r.run('state')!=='lab';batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+route+"update(1/60)}");r.flush()}
  assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,parts:game.mobile.devices.map(e=>e.hp)})')));t.diagnostic(id+' '+wid+' C boss '+r.run('game.time').toFixed(2)+'s, not human clear');
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' C full M05 actual starter fire from spawn to boss defeat, no post-start warp',t=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);start(r,0,'C',id);r.run('var visited=new Set()');
  for(let batch=0;batch<400&&r.run("game.lab.run.outcome==='RUNNING'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+route+"visited.add(game.area);update(1/60)}");r.flush()}
  assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,time:game.time,parts:game.mobile.devices.map(e=>({kind:e.partKind,hp:e.hp}))})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.storage.get(SAVE_KEY),saved);t.diagnostic(id+' C full '+r.run('game.time').toFixed(2)+'s, not normal human clear');
});
test('normal engine M05 reward/save is once-only, includes kills, legacy data retained; LAB has no reward',()=>{
  const r=runtime(seed());r.run("startMission('M05');game.player.x=6880;startBoss();resetMobileBoss(game,game.enemies[0],'OPEN');game.time=180;game.kills=15;damageEnemy(game.enemies[0],9999)");r.flush();r.flush();assert.equal(r.run('state'),'result');const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(saved.clearedMissions.includes('M05'));assert.ok(saved.unlockedMissions.includes('M06'));assert.equal(saved.missionStats.M05.kills,16);assert.equal(saved.missionStats.M05.bestTime,180);assert.equal(canPlayMission('M06',saved),true);r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),JSON.stringify(saved));assert.equal(sanitizeSave(saved).missionStats.M05.kills,16);
  const l=lab(),before=l.storage.get(SAVE_KEY);l.click('lab-mobile-collapse');l.flush();assert.equal(l.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(l.storage.get(SAVE_KEY),before);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' '+wid+' actual shots destroy all pre-boss mandatory devices from standing land',()=>{
  const r=lab();start(r,0,'C',id);r.change('labWeapon1',wid);
  r.run("game.lab.equipped[0]='"+wid+"';for(const t of game.mobile.devices){game.player.x=t.x-75;game.player.y=t.y;game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;for(let i=0;i<1000&&!t.dead;i++){const dx=t.x-game.player.x-18,dy=t.y+t.h/2-game.player.y-13,len=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;game.player.shotCd=Math.max(0,game.player.shotCd-1/60);game.grid.rebuild(game.enemies);shoot();updateShots(1/60)}if(!t.dead)throw Error('mandatory part '+t.partKind)}");
  assert.equal(r.run('game.mobile.devices.every(e=>e.dead)'),true);assert.equal(r.run('game.platforms.some(p=>p.gate&&p.active)'),false);
});
test('normal M05 engine through-QA uses actual movement/shooting and saves rewards once (immunity aid, not D)',t=>{
  const r=runtime(seed(),{recordDraw:false});r.run("startMission('M05');game.player.invuln=999;var visited=new Set()");
  for(let batch=0;batch<400&&r.run("state!=='result'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+route+"visited.add(game.area);update(1/60)}");r.flush();r.flush()}
  assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions.includes('M05'));t.diagnostic('normal engine + immunity aid '+r.run('game.time').toFixed(2)+'s / not human normal clear');
});
test('M05 free terrain has no orphan locked gates and lift side contact never teleports through top',()=>{
  const r=lab();r.change('labTerrain','M05');r.click('lab-terrain-apply');assert.equal(r.run('game.mobile.devices.length'),0);assert.equal(r.run('game.platforms.some(p=>p.gate&&p.active)'),false);
  start(r,1,'A');r.run("var deck=game.platforms.find(b=>b.axis==='y');game.time=1;deck.y=100;Object.assign(game.player,{x:deck.x+40,y:92,onGround:true});advanceMobilePlatforms(game,1/60)");assert.ok(r.run('game.player.y')>=92);assert.ok(r.run('game.player.x+7<=deck.x||game.player.x-7>=deck.x+deck.w'));
});
for(const [mode,cap] of [['LIGHT',30],['STANDARD',50],['MASSIVE',100]])test('M05 '+mode+' population cap '+cap+' excludes mandatory devices',()=>{
  const r=lab();r.change('labStageDensity',mode);start(r);r.run("for(let i=0;i<150;i++)spawnEnemy('assaultroller',800+i)");assert.equal(r.run('game.liveEnemies'),cap);assert.equal(r.run('game.mobile.devices.filter(e=>!e.dead).length'),4);assert.equal(r.run('game.enemies.filter(e=>!e.dead&&!e.fixedDevice).length'),cap);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' uses all20 weapons with unchanged class stats on M05, including air fire and installations',()=>{
  const r=lab();start(r,4,'C',id);
  for(const w of WEAPONS){r.run("game.lab.equipped[0]='"+w.id+"';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=-.1;shoot();for(let i=0;i<12;i++){updateShots(1/60);updateExpanded(game,1/60,weaponAPI)}clearArsenal(game);game.shots.length=0");assert.ok(r.run('game.enemyShots.length')<=48);assert.equal(r.run('game.player.maxHp'),PLAYER_CLASSES[id].hp)}
  if(id==='WING'){r.run('game.player.y=60;game.player.onGround=false;input.hover=true;for(let i=0;i<60;i++)moveClassPlayer(game.player,input,game.platforms,1/60)');assert.ok(Math.abs(r.run('game.player.energy')-92)<1e-6)}
});
for(const count of [30,50,100,200])test(count+' enemies: density, repair/FX/shot bounds and all20 weapons remain valid',()=>{
  const r=lab();start(r);r.click('lab-open');r.change('labEnemy','assaultroller');r.change('labCount',String(count));r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),count);
  for(const w of WEAPONS){r.run("game.lab.equipped[0]='"+w.id+"';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=-.1;shoot();for(let i=0;i<20;i++)updateShots(1/60);clearArsenal(game)");assert.ok(r.run('game.shots.every(s=>Number.isFinite(s.x+s.y))'),w.id)}
  r.run("for(const e of game.enemies){e.x=1300;e.y=124}game.grid.rebuild(game.enemies);explode({x:1300,y:136,radius:48,damage:999,type:'rocket'})");assert.equal(r.run('game.kills'),count);assert.ok(r.run('game.effects.length')<=80);assert.ok(r.run('game.impact.particles.length')<=96);
});
test('new image dimensions, per-resource fallback, read-only renderer and five tabs',async()=>{
  const catalog=JSON.parse(readFileSync(new URL('../assets/mobile-fortress-01/catalog.json',import.meta.url)));for(const [key,[path,w,h]] of Object.entries(MOBILE_FILES))assert.deepEqual(catalog.assets.find(a=>a.path===path)?.size,[w,h],key);
  assert.ok(Object.values(await loadMobileArt(async()=>{throw Error('missing')})).every(v=>v===null));const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='old:'+k);startMission('M05');var before=JSON.stringify(game);draw()");assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.ok(r.drawCalls.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="labTab-/g)||[]).length,5);assert.match(html,/labMobileState/);
});
