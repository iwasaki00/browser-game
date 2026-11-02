import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {deploy,drive} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,sanitizeSave} from '../js/data.js';

const seed=()=>sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02'],unlocked:['A-01','S-02','L-03','R-04'],highScore:9876,selectedClass:'WING'});
function bossRun(classId='WING',mission='M03',saved=seed()){
 const r=runtime(saved,{recordDraw:false,randomSeed:11001008});deploy(r,mission,classId);
 // A short checkpoint-only test. Full traversal uses drive() separately below.
 r.run(`game.player.x=${mission==='M03'?5500:4150};startBoss();game.player.invuln=3600`);
 r.run("var b=game.enemies.find(e=>isBoss(e));for(let i=0;i<20000&&!b.dead;i++){const p=game.player,point=b.type==='leviathan'?coastalWeakCore(b):{x:b.x,y:b.y+b.h/2};input.right=p.x<b.x-73;input.left=p.x>b.x-67;input.aimMode='touch';const dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;input.touchDx=dx/len;input.touchDy=dy/len;input.fire=true;update(1/60)}");
 assert.equal(r.run('b.dead'),true);return r;
}
function finish(r){r.flush();r.flush();assert.equal(r.run('state'),'result');}
function counts(r){return r.json('({unlocked:save.unlocked,stats:save.campaignStats,achievements:save.achievements,highScore:save.highScore,missionStats:save.missionStats})')}

for(const mode of ['flight','fire','released'])test('M03 WING '+mode+': result releases input/capture before command/M04',()=>{
 const r=bossRun();
 const owned=[];let pointer=40;for(const id of mode==='flight'?['right','up','hover','aimPad']:mode==='fire'?['aimPad']:[]){const el=r.get(id);el.releasePointerCapture=pointerId=>{owned.push([id,pointerId]);r.pointer(id,'lostpointercapture',{pointerId})};r.pointer(id,'pointerdown',{pointerId:pointer++});}
 if(mode==='released')r.run('resetInput()');finish(r);
 assert.deepEqual(r.json('[input.left,input.right,input.up,input.hover,input.fire,touchPointers.size,pressedControls.size,aimPointer,remotePointer]'),[false,false,false,false,false,0,0,null,null]);
 if(mode!=='released')assert.ok(owned.length>0,'capture must be explicitly released before hiding combat UI');
 const before=counts(r);r.click('mission-select');assert.equal(r.run('state'),'mission');assert.equal(r.run('game'),null);assert.equal(r.run("canPlayMission('M04',save)"),true);const events=r.run('resultFlow.events.length');r.click('mission-select');assert.equal(r.run('state'),'mission');assert.equal(r.run('resultFlow.events.length'),events);assert.deepEqual(counts(r),before);
 const q=runtime(JSON.parse(r.storage.get(SAVE_KEY)),{recordDraw:false});assert.equal(q.run("canPlayMission('M04',save)"),true);assert.ok(q.json('save.clearedMissions').includes('M03'));
 r.click('select-mission','M04');assert.equal(r.run('state'),'equip');
});

for(const classId of ['RANGER','SCOUT','GUARDIAN'])test(classId+' M03 result/command/reload and no duplicate first reward',()=>{
 const r=bossRun(classId);finish(r);assert.equal(r.run('game.resultSummary.classId'),classId);const before=counts(r);r.run('completeMission()');assert.deepEqual(counts(r),before);r.click('mission-select');assert.equal(r.run('state'),'mission');assert.deepEqual(counts(r),before);const q=runtime(JSON.parse(r.storage.get(SAVE_KEY)),{recordDraw:false});assert.equal(q.run("save.campaignStats.firstRewards.M03"),true);assert.equal(q.run(`save.campaignStats.classes.${classId}.clears`),1);
});

test('formal WING M03 from x64 uses genuine engine/controller, assisted, then command and M04',()=>{
 const r=runtime(seed(),{recordDraw:false,randomSeed:11001008});deploy(r,'M03','WING');assert.equal(r.run('game.player.x'),64);const out=drive(r,'M03',{assist:true});assert.equal(out.bossDefeated,true);assert.deepEqual(out.areas,[0,1,2,3,4]);assert.equal(r.run('state'),'result');r.click('mission-select');assert.equal(r.run('state'),'mission');assert.equal(r.run("canPlayMission('M04',save)"),true);
});

test('touch cancel/lost capture cannot leak through result',()=>{
 const r=bossRun();r.pointer('up','pointerdown',{pointerId:3});r.pointer('up','pointercancel',{pointerId:3});r.pointer('aimPad','pointerdown',{pointerId:4});r.pointer('aimPad','lostpointercapture',{pointerId:4});finish(r);r.pointer('up','pointerup',{pointerId:3});r.click('mission-select');r.key('keyup','w');assert.equal(r.run('state'),'mission');assert.deepEqual(r.json('[input.up,input.fire,remoteTimer]'),[false,false,null]);
});

test('failed clear save is visible, navigation survives, explicit retry saves once without regranting',()=>{
 const r=bossRun();r.run("var originalStore=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota test')}");const persisted=r.storage.get(SAVE_KEY);finish(r);assert.match(r.get('resultSaveStatus').textContent,/未保存/);assert.equal(r.get('resultSaveRetry').hidden,false);const before=counts(r);r.click('mission-select');assert.equal(r.run('state'),'mission');assert.equal(r.storage.get(SAVE_KEY),persisted);assert.equal(r.get('campaignSaveRetry').hidden,false);r.run('localStorage.setItem=originalStore');r.click('retry-save');assert.equal(r.get('campaignSaveRetry').hidden,true);assert.deepEqual(counts(r),before);assert.equal(JSON.parse(r.storage.get(SAVE_KEY)).campaignStats.classes.WING.clears,1);assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).unlockedMissions.includes('M04'));
});

test('normal result trace is bounded, contains lifecycle errors, never changes normal save schema',()=>{
 const r=bossRun();finish(r);const before=r.storage.get(SAVE_KEY);r.run("for(let i=0;i<80;i++)traceResult('test');windowResultError({message:'render test'})");assert.ok(r.run('resultFlow.events.length')<=64);assert.match(r.get('resultFlowLog').textContent,/render test/);assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(JSON.parse(before).resultFlow,undefined);
});

test('a new press during clear presentation delay is also released on result entry',()=>{
 const r=bossRun();r.flush();assert.equal(r.run('game.clear'),true);assert.equal(r.run('state'),'play');r.pointer('up','pointerdown',{pointerId:11});r.pointer('aimPad','pointerdown',{pointerId:12});assert.equal(r.run('input.up&&input.fire'),true);r.flush();assert.equal(r.run('state'),'result');assert.equal(r.run('input.up||input.fire'),false);
});

test('releasePointerCapture throws or dispatches cancellation synchronously without blocking result',()=>{
 const r=bossRun();r.pointer('up','pointerdown',{pointerId:9});r.get('up').releasePointerCapture=()=>{r.pointer('up','pointercancel',{pointerId:9});throw Error('NotFoundError test')};assert.doesNotThrow(()=>finish(r));r.click('mission-select');assert.equal(r.run('state'),'mission');
});

test('held remote-mine timer is cancelled by clear; late pointerup never switches weapons',()=>{
 const r=bossRun();r.run("save.equipped=['M-18','A-01'];save.unlocked.push('M-18');game.player.shotCd=0;shoot()");assert.equal(r.run('mineCount(game)'),1);r.pointer('switch','pointerdown',{pointerId:15});assert.notEqual(r.run('remoteTimer'),null);finish(r);assert.equal(r.run('remoteTimer'),null);r.pointer('switch','pointerup',{pointerId:15});assert.equal(r.run('game.player.weaponSlot'),0);assert.equal(r.run('mineCount(game)'),0);
});

test('M03 repeat after stored reload is not a new first clear or repeated old achievement',()=>{
 const r=bossRun();finish(r);const saved=JSON.parse(r.storage.get(SAVE_KEY)),q=bossRun('WING','M03',saved);finish(q);assert.equal(q.run('save.campaignStats.classes.WING.clears'),2);assert.deepEqual(q.json('save.campaignStats.firstRewards'),saved.campaignStats.firstRewards);assert.doesNotMatch(q.get('rewardBox').innerHTML,/FIRST CLEAR/);for(const [id,date]of Object.entries(saved.achievements.unlocked))assert.equal(q.run(`save.achievements.unlocked['${id}']`),date);
});

test('LAB completion never writes result progression or diagnostics to a sentinel normal save',()=>{
 const r=runtime(seed(),{debug:true,recordDraw:false}),saved=r.storage.get(SAVE_KEY),writes=r.writes.length;r.click('test-lab');r.change('labPreset','WING');r.click('lab-boss-3');r.run('damageEnemy(game.enemies[0],99999)');r.flush();r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.writes.length,writes);assert.equal(r.run('resultFlow'),null);
});

test('representative M01 result also accepts command navigation',()=>{
 const r=bossRun('RANGER','M01');finish(r);r.click('mission-select');assert.equal(r.run('state'),'mission');assert.ok(r.json('save.clearedMissions').includes('M01'));
});

test('optional result diagnostics missing in a stale HTML shell cannot block save or navigation',()=>{
 const r=bossRun();r.run("var originalQuery=document.querySelector;document.querySelector=s=>['#resultFlowLog','#resultSaveStatus','#resultSaveRetry','#campaignSaveRetry'].includes(s)?null:originalQuery(s)");assert.doesNotThrow(()=>finish(r));r.click('mission-select');assert.equal(r.run('state'),'mission');assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions.includes('M03'));
});
