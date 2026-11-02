import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {deploy} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,sanitizeSave} from '../js/data.js';

function lowCore(classId='WING',weapon='A-01',mode='released'){
 const saved=sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03'],selectedClass:classId});
 const diagnostics=new Map(),sessionStorage={getItem:k=>diagnostics.get(k)||null,setItem:(k,v)=>diagnostics.set(k,v)};
 const r=runtime(saved,{recordDraw:false,randomSeed:11001008,modules:{sessionStorage}});r.diagnostics=diagnostics;deploy(r,'M04',classId,[weapon,weapon==='A-01'?'S-02':'A-01']);
 // Reproduction fixture, not a full run: formal sortie -> boss arena, Phase 3,
 // remaining HP 4. Damage, movement, shots, boss AI and death remain genuine.
 r.run("game.player.x=6580;startBoss();var b=game.enemies.find(e=>e.type==='fortress');resetSkyBossPhase(game,b,3);b.hp=4;game.player.invuln=0");
 if(mode==='flight-fire'){r.pointer('up','pointerdown',{pointerId:51});r.pointer('hover','pointerdown',{pointerId:52});r.pointer('right','pointerdown',{pointerId:54})}if(mode!=='released')r.pointer('aimPad','pointerdown',{pointerId:53});if(mode==='cancel')r.pointer('aimPad','pointercancel',{pointerId:53});
 r.run("input.aimMode='touch';input.fire=true;var firedFrames=0;while(!b.dead&&firedFrames<120){const p=game.player,dx=b.x-p.x-18,dy=b.y+b.h/2-p.y-13,len=Math.hypot(dx,dy)||1;input.touchDx=dx/len;input.touchDy=dy/len;update(1/60);firedFrames++}");
 assert.equal(r.run('b.dead'),true);assert.ok(r.run('b.hp')<=0);assert.ok(r.run('game.player.hp>0'));return r;
}
function result(r){r.flush();r.flush();assert.equal(r.run('state'),'result')}
for(const id of ['RANGER','SCOUT','GUARDIAN','WING'])for(const w of ['A-01','S-02'])test(id+' '+w+' real HP4 kill, normal damage ON, result -> command -> M05 -> reload',t=>{
 const r=lowCore(id,w);t.diagnostic(JSON.stringify(r.json('({frames:firedFrames,bossHp:b.hp,playerHp:game.player.hp,invulnAfterKill:game.player.invuln})')));
 result(r);assert.match(r.get('resultUnlock').textContent,/M05/);const stored=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(stored.clearedMissions.includes('M04'));assert.ok(stored.unlockedMissions.includes('M05'));assert.equal(stored.campaignStats.classes[id].clears,1);
 const before=r.json('save');r.run('completeMission()');assert.deepEqual(r.json('save'),before);r.click('mission-select');r.click('mission-select');assert.equal(r.run('state'),'mission');assert.deepEqual(r.json('save.campaignStats.firstRewards'),before.campaignStats.firstRewards);
 r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');assert.equal(r.run('state'),'play');
 const q=runtime(stored,{recordDraw:false});assert.equal(q.run("canPlayMission('M05',save)"),true);assert.ok(q.json('save.clearedMissions').includes('M04'));
});
for(const mode of ['flight-fire','fire','released','cancel'])test('WING held '+mode+' after HP4 kill clears pointer ownership on result',()=>{
 const r=lowCore('WING','A-01',mode);if(mode==='released')r.run('resetInput()');
 result(r);assert.deepEqual(r.json('[input.up,input.hover,input.fire,touchPointers.size,aimPointer]'),[false,false,false,0,null]);r.click('mission-select');assert.equal(r.run('state'),'mission');
});

test('HP4 diagnosis records real damage, lifecycle timers, persisted unlock and active command without normal-save contamination',async()=>{
 const r=lowCore('WING','A-01','flight-fire');result(r);r.click('mission-select');
 const events=r.json('resultFlow.events'),stages=events.map(e=>e.stage);for(const stage of ['boss-low-hit','boss-defeated','boss-completion-scheduled','boss-completion-fired','clear-confirmed','progress-updated','store-ok','result-presentation-fired','result-screen','command-active'])assert.ok(stages.includes(stage),stage);
 const hit=events.find(e=>e.stage==='boss-low-hit');assert.equal(hit.snapshot.boss.hp,-4);assert.equal(hit.snapshot.input.up,true);assert.equal(hit.snapshot.input.fire,true);
 const saved=r.storage.get(SAVE_KEY),writes=r.writes.length;await r.run('copyResultDiagnostics()');assert.match(r.get('commandFlowStatus').textContent,/自動コピー不可/);assert.equal(r.get('commandFlowOutput').hidden,false);assert.match(r.get('commandFlowOutput').value,/command-active/);assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.writes.length,writes);assert.ok(r.diagnostics.has('pdf-result-transition-v1'));assert.equal(JSON.parse(saved).resultFlow,undefined);
 const q=runtime(JSON.parse(saved),{recordDraw:false,modules:{sessionStorage:{getItem:k=>r.diagnostics.get(k)}}});assert.equal(q.run('resultFlow'),null);await q.run('copyResultDiagnostics()');assert.match(q.get('pauseFlowOutput').value,/boss-low-hit/);
});
test('diagnostic storage/DOM failures cannot prevent clear; callback errors stay visible and are not swallowed',()=>{
 const r=lowCore();r.run("sessionStorage.setItem=()=>{throw Error('quota')};var query=document.querySelector;document.querySelector=s=>s.endsWith('FlowLog')?null:query(s)");assert.doesNotThrow(()=>result(r));assert.equal(r.run('resultFlow.storage'),'UNAVAILABLE');r.click('mission-select');assert.equal(r.run('state'),'mission');
 r.run("scheduleMission(()=>{throw Error('callback-fixture')},10,'fixture')");assert.throws(()=>r.flush(),/callback-fixture/);assert.ok(r.json('resultFlow.events').some(e=>e.stage==='fixture-error'));r.run("windowResultError({reason:{message:'promise-fixture'}});for(let i=0;i<80;i++)traceResult('bounded')");assert.equal(r.run('resultFlow.events.length'),64);
});
test('low living HP does not force victory; pause export and JS-error capture work before defeat',async()=>{
 const r=runtime(sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03']}),{recordDraw:false});deploy(r,'M04','WING');
 r.run("game.player.x=6580;startBoss();var b=game.enemies[0];resetSkyBossPhase(game,b,3);b.hp=4;input.fire=false;for(let i=0;i<30;i++)update(1/60);loop(1000);windowResultError({message:'before-defeat-fixture'})");assert.equal(r.run('b.hp'),4);assert.equal(r.run('game.clear'),false);assert.equal(r.run("canPlayMission('M05',save)"),false);assert.ok(r.json('resultFlow.events').some(e=>e.stage==='battle-heartbeat'));r.run('pause()');await r.run('copyResultDiagnostics()');assert.match(r.get('pauseFlowOutput').value,/before-defeat-fixture/);
});
test('LAB boss operations neither overwrite the normal diagnostic archive nor normal save',()=>{
 const archive=new Map([['pdf-result-transition-v1','sentinel']]);let diagWrites=0;
 const r=runtime(null,{debug:true,recordDraw:false,modules:{sessionStorage:{getItem:k=>archive.get(k),setItem:(k,v)=>{diagWrites++;archive.set(k,v)}}}});const saved=r.storage.get(SAVE_KEY),writes=r.writes.length;r.click('test-lab');r.change('labPreset','WING');r.change('labSkyPhase','3');r.click('lab-boss-4');r.run('damageEnemy(game.enemies[0],99999)');r.flush();r.flush();assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED');assert.equal(diagWrites,0);assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.writes.length,writes);assert.equal(archive.get('pdf-result-transition-v1'),'sentinel');
});
