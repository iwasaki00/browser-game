import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS,MISSIONS,sanitizeSave,canPlayMission,missionStatus} from '../js/data.js';
import {M07,MOTHERSHIP} from '../js/mission07.js';
import {MOTHERSHIP_FILES,loadMothershipArt} from '../js/mothership-art.js';
const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03','M04','M05','M06']});
const lab=()=>{const r=runtime(seed(),{debug:true,recordDraw:false});r.click('test-lab');r.change('labStageMission','M07');return r};
function start(r,area=0,mode='C',id='RANGER'){if(r.run('state')==='play')r.click('lab-open');r.change('labPreset',id);r.change('labValidation',mode);r.change('labStageArea',String(area));r.click('lab-stage-start')}
// Inputs only after start: no HP/coordinate/gate/energy/cooldown writes.
export const mothershipRoute=`const p=game.player;input.right=true;input.left=false;input.jump=false;input.up=false;input.hover=false;input.special=false;
const obstacle=game.platforms.some(b=>b.active!==false&&b.kind==='container'&&p.x+35>=b.x&&p.x-7<b.x+b.w&&p.y+32>b.y+.5);
input.jump=p.onGround&&obstacle;input.up=p.classId==='WING'&&obstacle;
const b=game.enemies.find(e=>e.type==='commandcore'&&!e.dead),m=game.mothership;
let target=null;
if(b){target=b.shielded?nearestEnemy(m.devices.filter(n=>!n.dead),p.x,p.y):b;if(target){const desired=target.x-70;input.right=p.x<desired-3;input.left=p.x>desired+3;input.jump=input.up=false}}
else {for(const n of m.devices){if(n.dead||n.partKind==='fusion'&&game.time<m.fusionUntil-2)continue;
if(n.partKind==='entry'&&p.x<1260||n.partKind==='fusion'&&p.x>4300&&p.x<4724||['shield','reinforcement','turret'].includes(n.partKind)&&p.x>5300){if(Math.abs(n.x-p.x)<260){target=n;break}}}
if(target){input.right=p.x<target.x-65;input.left=p.x>target.x-60;input.jump=input.up=false}else target=nearestEnemy(game.enemies.filter(e=>!e.fixedDevice),p.x,p.y,170);}
const point=target?{x:target.x,y:target.y+target.h/2}:{x:p.x+200,y:p.y+13},dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;
input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;input.fire=true;`;

test('legacy M06 save unlocks M07, M08 disabled, seven campaign denominator and fixed thirty achievements',()=>{
 const s=sanitizeSave({...seed(),selectedClass:'GUARDIAN',unlocked:['A-01','S-02','R-04'],missionStats:{M06:{highScore:777,bestTime:300,kills:12}}});
 assert.ok(canPlayMission('M07',s));assert.equal(missionStatus(MISSIONS.find(m=>m.id==='M08'),s),'COMING SOON');assert.equal(s.missionStats.M06.kills,12);
 const r=runtime(s);r.run("startMission('M07');update(1/60)");assert.equal(r.run('game.mothership.devices.length'),5);assert.equal(r.run("startMission('M08')"),false);
 r.run('game.player.hp=0;update(1/60)');r.flush();r.click('retry');assert.equal(r.run('game.missionId'),'M07');assert.equal(r.run("canPlayMission('M07',save)"),true);assert.deepEqual(r.json('save.clearedMissions'),s.clearedMissions);
 assert.equal(MISSIONS.filter(m=>m.implemented).length,7);
 const master=readFileSync(new URL('../js/achievement-master.js',import.meta.url),'utf8');assert.match(master,/M01.*M02.*M03.*M04.*M05.*M06/);assert.doesNotMatch(master,/M07/);
});
for(let area=0;area<5;area++)test('M07 AREA '+(area+1)+' restore twice, no stale encounters or saves',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);for(let n=0;n<2;n++){start(r,area);assert.equal(r.run('game.area'),area);assert.equal(r.run('game.missionId'),'M07');assert.equal(r.run('game.mothership.devices.length'),5);assert.equal(r.run('game.shots.length+game.enemyShots.length+game.arsenal.jobs.length'),0);assert.equal(r.run('game.mothership.entryOpen'),area>0);assert.equal(r.run('game.mothership.networkOpen'),area>3)}assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' A inputs + real movement/shooting reaches all five areas without warp',t=>{
 const r=lab();start(r,0,'A',id);r.run('var visited=new Set()');r.run("for(let i=0;i<45000&&state==='play';i++){"+mothershipRoute+"visited.add(game.area);update(1/60)}");
 assert.equal(r.run('game.lab.run.outcome'),'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,time:game.time,devices:game.mothership.devices.map(e=>[e.partKind,e.hp]),fusion:game.mothership.fusionUntil})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.ok(!r.json('game.lab.run.warnings').some(w=>w.code==='TERRAIN_INTRUSION'));t.diagnostic(id+' A '+r.run('game.time').toFixed(2)+'s / not combat clear');
});
test('fusion is repeatable, expiry does not enclose player, no death/score credit',()=>{
 const r=lab();start(r,2,'A');r.run("var node=game.mothership.devices.find(e=>e.partKind==='fusion'),gate=game.platforms.find(p=>p.gate==='fusion');damageEnemy(node,999);var before=game.score");assert.equal(r.run('gate.active'),false);assert.equal(r.run('node.dead'),false);assert.equal(r.run('node.hp'),1);r.run('game.time+=7;syncMothershipGates(game)');assert.equal(r.run('gate.active'),true);r.run('damageEnemy(node,999)');assert.equal(r.run('gate.active'),false);r.run('game.player.x=4710;game.time+=7;syncMothershipGates(game)');assert.equal(r.run('gate.active'),false);assert.equal(r.run('game.score'),r.run('before'));
});
test('network three independent controls open entry in all six orders',()=>{
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){const r=lab();start(r,3);for(const i of order)r.run(`damageEnemy(game.mothership.devices[${i+2}],999)`);assert.equal(r.run('game.mothership.networkOpen'),true);assert.equal(r.run("game.platforms.find(p=>p.gate==='network').active"),false);assert.equal(r.run('game.kills'),0)}
});
for(const phase of [1,2,3])test('B07 Phase '+phase+' repeated coherent restart and no normal save',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labMothershipPhase',String(phase));for(let n=0;n<2;n++){r.click('lab-boss-7');assert.equal(r.run('game.mothership.devices.length'),3);assert.equal(r.run('game.enemies.length'),4);assert.equal(r.run('game.liveEnemies'),1);assert.equal(r.run('game.shots.length+game.enemyShots.length+game.arsenal.jobs.length+game.mothership.hazards.length'),0);assert.equal(r.run('game.enemies[0].hpPhase'),phase);assert.equal(r.run('game.enemies[0].shielded'),phase===1);assert.equal(r.run('game.enemies[0].hp'),phase===3?1260:4200);assert.equal(r.run('game.battleCamera.mode'),'boss');r.click('lab-open')}assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('all boss device masks, core shield, six free orders, phase30 and serialized warnings match hits',()=>{
 const r=lab();for(let mask=0;mask<8;mask++){r.change('labMothershipMask',String(mask));r.click('lab-boss-7');assert.equal(r.run('game.enemies[0].shielded'),mask!==7);assert.equal(r.run('game.mothership.devices.filter(d=>d.dead).length'),mask.toString(2).replaceAll('0','').length);r.click('lab-open')}
 for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){r.change('labMothershipMask','0');r.click('lab-boss-7');r.run('var b=game.enemies[0];damageEnemy(b,999)');assert.equal(r.run('b.hp'),4200);for(const i of order)r.run(`damageEnemy(game.mothership.devices[${i}],999)`);assert.equal(r.run('b.shielded'),false);r.run('damageEnemy(b,2940);updateMothershipEnemy(game,b,1/60,spawnEnemy,pushEffect)');assert.equal(r.run('b.hpPhase'),3);r.run('b.actionWait=0;updateMothershipEnemy(game,b,1/60,spawnEnemy,pushEffect);var z=JSON.stringify(b.attackPlan.zones[0]);updateMothershipEnemy(game,b,1.4,spawnEnemy,pushEffect)');assert.equal(r.run('JSON.stringify((({x,y,w,h})=>({x,y,w,h}))(game.mothership.hazards[0]))'),r.run('z'));assert.ok(r.run('b.actionWait')>0);r.click('lab-open')}
 assert.ok((96/2+7)/65+.25<MOTHERSHIP.warning);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(`${id} ${wid} real shot destroys all three boss devices and core`,()=>{
 const r=lab();r.change('labPreset',id);r.change('labWeapon1',wid);r.click('lab-boss-7');r.run(`for(let i=0;i<22000&&!game.enemies.find(e=>e.type==='commandcore').dead;i++){${mothershipRoute}update(1/60)}`);assert.equal(r.run("game.enemies.find(e=>e.type==='commandcore')?.dead"),true,JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,devices:game.mothership.devices.map(e=>e.hp)})')));r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.run('game.lab.run.normalProgressSaved'),undefined);
});
test('mixed squads share caps and existing shield/repair/command effects remain single-layer',()=>{
 const r=lab();start(r,1);r.run("game.director.stopped=true;game.enemyLimit=30;for(const key of ['A','B','C','D'])spawnMixedSquad(game,key,spawnEnemy);for(let i=0;i<100;i++)spawnMixedSquad(game,'B',spawnEnemy);game.grid.rebuild(game.enemies);var target=game.enemies.find(e=>e.type==='assaulttitan'),shield=game.enemies.find(e=>e.type==='shielddrone'),repair=game.enemies.find(e=>e.type==='repairdrone'),cmd=game.enemies.find(e=>e.type==='commanddrone');target.x=2000;target.y=100;shield.x=2010;shield.y=70;repair.x=2020;repair.y=70;cmd.x=2030;cmd.y=60;target.hp=200;game.enemies=[target,shield,repair,cmd];game.player.x=1900;game.grid.rebuild(game.enemies);var scaled=mothershipDamage(game,target,100);updateMothershipState(game,.3,hurtPlayer,pushEffect,spawnEnemy)");assert.equal(r.run('game.liveEnemies'),30);assert.equal(r.run('scaled'),70);assert.ok(r.run('target.hp')>200);assert.equal(r.run('target.linkedCommander'),r.run('cmd.uid'));assert.ok(r.run('game.mothership.links.length')<=12);r.run('damageEnemy(cmd,999);updateMothershipState(game,.01,hurtPlayer,pushEffect,spawnEnemy)');assert.equal(r.run('target.linkedCommander'),undefined);r.run('damageEnemy(shield,999)');assert.equal(r.run('mothershipDamage(game,target,100)'),100);
});
test('phase destination safe, warning immunity, recovery vulnerable; titan charge respects wall and shared budget',()=>{
 const r=lab();start(r,2);r.run("game.director.stopped=true;var e=spawnEnemy('phasestalker',3600),p=game.player;game.camera=3300;game.battleCamera.zoom=.5;e.phaseTimer=0;updateMothershipEnemy(game,e,.01,spawnEnemy,pushEffect);var dest={x:e.targetX,y:e.targetY};damageEnemy(e,100)");assert.equal(r.run('e.phaseState'),'SHIFT');assert.equal(r.run('e.hp'),125);assert.ok(r.run('Math.abs(dest.x-p.x)')>=100);r.run('updateMothershipEnemy(game,e,1,spawnEnemy,pushEffect);damageEnemy(e,10)');assert.equal(r.run('e.phaseState'),'RECOVERY');assert.equal(r.run('e.hp'),115);
 r.run("var t=spawnEnemy('assaulttitan',4620);t.y=100;t.dashLeft=.4;t.vx=140;for(let i=0;i<30;i++)updateMothershipEnemy(game,t,1/60,spawnEnemy,pushEffect)");assert.ok(r.run('t.x+t.w/2<=4700'));
});
test('normal M07 result/rewards/stats save before skippable teaser; retry stays unlocked, LAB clear never rewards',()=>{
 const r=runtime(seed());r.run("startMission('M07');game.player.x=7800;startBoss();for(const d of game.mothership.devices)damageEnemy(d,999);damageEnemy(game.enemies[0],9999)");r.flush();r.flush();const s=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(s.clearedMissions.includes('M07'));assert.ok(s.missionStats.M07.highScore>0);assert.ok(s.campaignStats.classes.RANGER.missions.M07);assert.ok(s.campaignStats.firstRewards.M07);assert.equal(r.get('mothershipStory').hidden,false);r.click('mothership-story-skip');assert.equal(r.get('mothershipStory').hidden,true);assert.equal(r.run('state'),'result');assert.equal(r.run("canPlayMission('M08',save)"),false);
 const q=lab(),saved=q.storage.get(SAVE_KEY);q.click('lab-mothership-collapse');q.flush();assert.equal(q.storage.get(SAVE_KEY),saved);assert.equal(q.run('game.lab.run.outcome'),'BOSS_DEFEATED');
});
test('minimal M01-M06 start/boss protection, M07 all twenty weapons and draw fallback/load',async()=>{
 const r=runtime(seed(),{debug:true});r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='old:'+k)");for(const id of ['M01','M02','M03','M04','M05','M06']){r.run(`startMission('${id}');update(1/60);startBoss();draw()`);assert.equal(r.run('game.missionId'),id)}r.click('test-lab');r.change('labStageMission','M07');start(r,4);for(const w of WEAPONS)r.run(`game.lab.equipped[0]='${w.id}';game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();for(let i=0;i<20;i++){updateShots(1/60);updateExpanded(game,1/60,weaponAPI)}clearArsenal(game);game.shots.length=0`);
 r.run('draw()');assert.ok(r.drawCalls.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));assert.ok(Object.values(await loadMothershipArt(async()=>{throw Error('missing')})).every(v=>v===null));
 const catalog=JSON.parse(readFileSync(new URL('../assets/mothership-01/catalog.json',import.meta.url)));for(const [key,[path,w,h]] of Object.entries(MOTHERSHIP_FILES))assert.deepEqual(catalog.assets.find(a=>a.path===path)?.size,[w,h],key);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="labTab-/g)||[]).length,5);assert.equal((html.match(/id="campaignTab-/g)||[]).length,4);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' C complete M07 through-QA, no post-start warp or damage aid beyond LAB immunity',t=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);start(r,0,'C',id);r.run('var visited=new Set()');
 for(let batch=0;batch<450&&r.run("state==='play'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+mothershipRoute+"visited.add(game.area);update(1/60)}");r.flush();r.flush()}
 assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,time:game.time,enemies:game.liveEnemies,hp:game.enemies.find(e=>e.type===\'commandcore\')?.hp})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.storage.get(SAVE_KEY),saved);assert.ok(!r.json('game.lab.run.warnings').some(w=>w.code==='TERRAIN_INTRUSION'));t.diagnostic(id+' C '+r.run('game.time').toFixed(2)+'s / invincible QA, not D');
});
test('normal engine through-QA and persisted result, with explicit immunity aid; not human normal clear',t=>{
 const r=runtime(seed(),{recordDraw:false});r.run("startMission('M07');game.player.invuln=2000;var visited=new Set()");
 for(let batch=0;batch<450&&r.run("state!=='result'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+mothershipRoute+"visited.add(game.area);update(1/60)}");r.flush();r.flush()}
 assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);const s=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(s.clearedMissions.includes('M07'));assert.ok(s.missionStats.M07.kills>0);assert.ok(s.missionStats.M07.bestTime>0);assert.ok(s.campaignStats.classes.RANGER.missions.M07);const saved=r.storage.get(SAVE_KEY);r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),saved);t.diagnostic('normal engine + immunity '+r.run('game.time').toFixed(2)+'s / not D');
});
for(const [density,cap] of [['LIGHT',30],['STANDARD',50],['MASSIVE',100]])test('M07 '+density+' mixed shared cap, even when progress events still pending',()=>{
 const r=runtime({...seed(),settings:{...DEFAULT_SAVE.settings,enemyDensity:density}},{recordDraw:false});r.run("startMission('M07');game.player.x=2000;for(let i=0;i<200;i++)spawnMixedSquad(game,'B',spawnEnemy);for(let i=0;i<120;i++)update(1/60)");assert.ok(r.run('game.liveEnemies')<=cap);assert.equal(r.run('game.enemyLimit'),cap);r.run("for(const d of game.mothership.devices)if(d.partKind!=='fusion')damageEnemy(d,999)");assert.equal(r.run('game.mothership.networkOpen'),true);
});
test('LAB 200 new enemies, bounded effects/command queries; enemy clear leaves no orphan gate',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labEnemy','assaulttitan');r.change('labCount','200');r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),200);r.click('lab-close');r.run('for(let i=0;i<180;i++)update(1/60)');assert.ok(r.run('game.mothership.hazards.length')<=MOTHERSHIP.hazardLimit);r.click('lab-open');r.click('lab-clear');r.click('lab-close');r.run('for(let i=0;i<60;i++)update(1/60)');assert.ok(r.run('game.platforms.filter(p=>p.gate).every(p=>!p.active)'));assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('M07 spawn clearance for large bodies near obstacles, teleport safe destination recheck and no attack during recovery',()=>{
 const r=lab();start(r,2);r.run("game.director.stopped=true;var embedded=0;for(const x of [3650,3670,3680,3720,3740,4670,4700,4730]){const e=spawnEnemy('assaulttitan',x);if(e&&game.platforms.some(b=>b.active!==false&&e.x+e.w/2>b.x+.01&&e.x-e.w/2<b.x+b.w-.01&&e.y+e.h>b.y+.01&&e.y<b.y+b.h-.01))embedded++}");assert.equal(r.run('embedded'),0);
 r.run("var e=spawnEnemy('phasestalker',3600);game.camera=3300;game.battleCamera.zoom=.5;e.phaseTimer=0;updateMothershipEnemy(game,e,.01,spawnEnemy,pushEffect);var old=e.x;game.player.x=e.targetX;updateMothershipEnemy(game,e,1,spawnEnemy,pushEffect)");assert.equal(r.run('e.x'),r.run('old'));assert.equal(r.run('e.phaseState'),'RECOVERY');
});
test('shield device stops its projected support independently, no stack with E11; command loss and device kills never duplicate scoring',()=>{
 const r=lab();r.click('lab-boss-7');r.run("var b=game.enemies[0],e=spawnEnemy('phasestalker',8140);var first=mothershipDamage(game,e,100);var shield=game.mothership.devices.find(d=>d.partKind==='shield');damageEnemy(shield,999);var kills=game.kills,score=game.score;damageEnemy(shield,999)");assert.equal(r.run('first'),70);assert.equal(r.run('mothershipDamage(game,e,100)'),100);assert.equal(r.run('b.shielded'),true);assert.equal(r.run('game.kills'),r.run('kills'));assert.equal(r.run('game.score'),r.run('score'));
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' all twenty weapon paths operate on M07 terrain with class/energy data unchanged',()=>{
 const r=lab();start(r,4,'C',id);for(const w of WEAPONS)r.run(`game.lab.equipped[0]='${w.id}';game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=-.1;shoot();for(let i=0;i<30;i++){updateShots(1/60);updateExpanded(game,1/60,weaponAPI)}clearArsenal(game);game.shots.length=0`);assert.equal(r.run('game.player.maxHp'),PLAYER_CLASSES[id].hp);if(id==='WING')assert.equal(PLAYER_CLASSES.WING.hoverDrain,8);
});
test('legacy tracked PNG hashes, old mission AI/geometry, player, achievement master and Arcade index remain byte-identical to HEAD',t=>{
 const root=new URL('../',import.meta.url);const entries=execFileSync('git',['ls-files','-s','assets'],{cwd:root,encoding:'utf8'}).trim().split('\n');let count=0;
 for(const row of entries){const m=row.match(/^\d+ ([0-9a-f]+) \d\t(.+\.png)$/);if(!m)continue;const bytes=readFileSync(new URL(m[2],root)),hash=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');assert.equal(hash,m[1],m[2]);count++}assert.ok(count>100);t.diagnostic(count+' legacy PNG hashes unchanged');
 execFileSync('git',['diff','--exit-code','HEAD','--','js/mission03.js','js/mission04.js','js/mission05.js','js/mission06.js','js/player.js','js/achievement-master.js','../index.html'],{cwd:root});
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' B07 actual movement dodges after .25s reaction, including widest Phase3 wave',()=>{
 const r=lab();r.change('labPreset',id);r.change('labValidation','B');r.change('labMothershipPhase','3');r.click('lab-boss-7');r.run('var boss=game.enemies[0];boss.actionIndex=2;boss.actionWait=0;updateMothershipEnemy(game,boss,1/60,spawnEnemy,pushEffect);var hp=game.player.hp;for(let i=0;i<100;i++){input.right=i>=15;update(1/60)}');assert.equal(r.run('game.player.hp'),r.run('hp'));assert.ok(r.run('game.player.x')>7800+55);
});
