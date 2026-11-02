import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {deploy} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,sanitizeSave} from '../js/data.js';

const seed=()=>sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03'],unlocked:['A-01','S-02','T-16','M-20']});
const isolatedKey=SAVE_KEY+'-debug2';
function sortie(classId,debug2=false){
 const normal=seed(),r=runtime(normal,{recordDraw:false,search:debug2?'?debug=2':'',...(debug2?{storageEntries:[[isolatedKey,JSON.stringify(seed())]]}:{})});
 const normalRaw=r.storage.get(SAVE_KEY);deploy(r,'M04',classId,['T-16','M-20']);
 // Reproduction fixture: formal sortie, then place in the existing Phase 3
 // arena with HP1. All shots, damage, death, save and transition remain genuine.
 r.run("game.player.x=6580;startBoss();var b=game.enemies.find(e=>e.type==='fortress');resetSkyBossPhase(game,b,3);b.hp=1;game.player.weaponSlot=1;var target=worldToScreen({x:b.x,y:b.y+b.h/2},game.camera,view.zoom);input.aimMode='mouse';input.aimX=target.x;input.aimY=target.y;shoot();game.player.weaponSlot=0;var maxConcurrentShots=0;");
 return {r,normalRaw,key:debug2?isolatedKey:SAVE_KEY};
}
function finishWithFrames(r){
 r.run("for(let n=1;n<=300&&state==='play'&&!game.clear&&!b.dead;n++){maxConcurrentShots=Math.max(maxConcurrentShots,game.shots.length);animationFrame(n*1000/60)}");
 // Ordinary LAB checkpoints intentionally do not create a normal result trace;
 // frameFault below still checks the real exception boundary in those cases.
 const errors=r.json("(resultFlow?.events??[]).filter(e=>e.stage==='frame-error').map(e=>e.detail)");
 assert.deepEqual(errors,[]);assert.equal(r.run('frameFault'),false);assert.equal(r.run('b.dead'),true);assert.equal(r.run('b.hp'),-34);assert.ok(r.run('maxConcurrentShots')>=2);
}
for(const debug2 of [false,true])for(const classId of Object.keys(PLAYER_CLASSES))test((debug2?'debug2 ':'normal ')+classId+' M20 multi-shot boss kill never reads a removed projectile; result -> M05 works',()=>{
 const {r,normalRaw,key}=sortie(classId,debug2);finishWithFrames(r);
 assert.equal(r.run('game.clear'),true);assert.equal(r.run('game.bossDefeat.finished'),false);assert.ok(r.json('resultFlow.events').some(e=>e.stage==='boss-low-hit'&&e.detail.includes('weapon=M-20')));
 const saved=r.storage.get(key),stats=r.json('save.campaignStats'),rewards=r.json('game.weaponRewards');assert.ok(JSON.parse(saved).clearedMissions.includes('M04'));assert.ok(JSON.parse(saved).unlockedMissions.includes('M05'));
 // Let the actual collapse update run, then finish its existing timer. No
 // error injection, forced result, direct clear or forced unlock is used.
 r.run('for(let n=0;n<60;n++)animationFrame(last+1000/60)');assert.ok(r.run('game.bossDefeat.elapsed')>.5);assert.equal(r.run('frameFault'),false);r.flush();r.flush();assert.equal(r.run('state'),'result');assert.equal(r.run('game.bossDefeat.finished'),true);
 r.click('boss-defeat-skip');r.flush();r.run('completeMission()');assert.deepEqual(r.json('save.campaignStats'),stats);assert.deepEqual(r.json('game.weaponRewards'),rewards);
 r.click('mission-select');r.click('mission-select');assert.equal(r.run('state'),'mission');r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('state'),'play');assert.equal(r.run('game.missionId'),'M05');
 r.pointer('right','pointerdown',{pointerId:71});r.pointer('aimPad','pointerdown',{pointerId:72});r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;for(let n=0;n<60;n++)animationFrame(last+1000/60)");assert.ok(r.run('game.time')>.8);assert.ok(r.run('game.player.x')>100);assert.ok(r.run('game.arsenal.jobs.length+game.shots.length')>0);assert.equal(r.run('frameFault'),false);
 const q=runtime(debug2?seed():JSON.parse(r.storage.get(key)),{recordDraw:false,search:debug2?'?debug=2':'',...(debug2?{storageEntries:[[key,r.storage.get(key)]]}:{})});assert.equal(q.run("canPlayMission('M05',save)"),true);assert.ok(q.json('save.clearedMissions').includes('M04'));
 if(debug2){assert.equal(r.storage.get(SAVE_KEY),normalRaw);assert.ok(r.writes.every(w=>w.key===key))}
});
for(const classId of ['RANGER','WING'])test('LAB '+classId+' M20 boss death truncates shots safely even before a mission clear flag; no save',()=>{
 const r=runtime(seed(),{debug:true,recordDraw:false}),raw=r.storage.get(SAVE_KEY),writes=r.writes.length;r.click('test-lab');r.change('labPreset',classId);r.change('labWeapon1','M-20');r.change('labSkyPhase','3');r.click('lab-boss-4');
 r.run("var b=game.enemies.find(e=>e.type==='fortress');b.hp=1;game.player.x=b.x-70;var target=worldToScreen({x:b.x,y:b.y+b.h/2},game.camera,view.zoom);input.aimMode='mouse';input.aimX=target.x;input.aimY=target.y;shoot();var maxConcurrentShots=0");finishWithFrames(r);assert.equal(r.run('game.clear'),false);r.flush();r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.storage.get(SAVE_KEY),raw);assert.equal(r.writes.length,writes);
});
test('damage callback may truncate the shot list without a clear flag; iteration stops at current length',()=>{
 const r=runtime(null,{debug:true,recordDraw:false});r.click('test-lab');r.change('labWeapon1','P-12');r.click('lab-close');
 r.run("game.platforms=[];spawnEnemy('crawler',1030);input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();game.player.shotCd=0;shoot();game.grid.rebuild(game.enemies);var hits=0;updateExpanded(game,1/60,{...weaponAPI,damage:()=>{hits++;game.shots.length=0}})");assert.equal(r.run('hits'),1);assert.equal(r.run('game.shots.length'),0);assert.equal(r.run('game.clear'),false);
});
test('damage callback appending shots does not extend the captured per-frame processing bound',()=>{
 const r=runtime(null,{debug:true,recordDraw:false});r.click('test-lab');r.change('labWeapon1','P-12');r.click('lab-close');
 r.run("game.platforms=[];spawnEnemy('crawler',1030);input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();game.grid.rebuild(game.enemies);var hits=0;updateExpanded(game,1/60,{...weaponAPI,damage:(e,d,s)=>{hits++;game.shots.push({...s,rehit:{},age:0})}})");assert.equal(r.run('hits'),1);assert.equal(r.run('game.shots.length'),2);assert.equal(r.run('game.shots[1].age'),0);assert.ok(r.run('game.shots[0].age')>0);
});
