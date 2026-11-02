import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
import {deploy,drive} from '../../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,MISSIONS,sanitizeSave} from '../../js/data.js';
export const missionIds=MISSIONS.filter(m=>m.implemented).map(m=>m.id);
export function transitionCase(id,debug2=false,sourceText=null){
 const seed=sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:missionIds.slice(0,missionIds.indexOf(id))}),normal=JSON.stringify(seed),key=SAVE_KEY+(debug2?'-debug2':'');
 const r=runtime(seed,{recordDraw:false,randomSeed:11001008,search:debug2?'?debug=2':'',...(sourceText?{sourceText}:{}),...(debug2?{storageEntries:[[key,normal]]}:{})});const baseline=r.storage.get(SAVE_KEY);deploy(r,id);
 // Delay only the VM timer adapter so the real death-animation update can be
 // observed before executing the already scheduled presentation callbacks.
 const flush=r.flush;r.flush=()=>{};const out=drive(r,id,{assist:!debug2});r.flush=flush;
 assert.equal(r.run('game.player.dead'),false);assert.equal(r.run('game.bossStarted'),true);assert.equal(r.run('game.enemies.some(e=>isBoss(e)&&!e.dead)'),false);
 r.run('for(let n=0;n<60;n++)animationFrame(last+1000/60)');assert.equal(r.run('frameFault'),false);r.flush();r.flush();
 const ending=r.run('state')==='ending';if(ending)r.click('ending-skip');assert.equal(r.run('state'),'result');assert.ok(JSON.parse(r.storage.get(key)).clearedMissions.includes(id));
 r.click('mission-select');assert.equal(r.run('state'),'mission');const next=missionIds[missionIds.indexOf(id)+1]??'M01';r.click('select-mission',next);r.click('deploy');assert.equal(r.run('game.missionId'),next);
 r.pointer('right','pointerdown',{pointerId:11});r.pointer('aimPad','pointerdown',{pointerId:12});r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;for(let n=0;n<60;n++)animationFrame(last+1000/60)");assert.ok(r.run('game.time')>.8);assert.ok(r.run('game.player.x')>100);assert.ok(r.run('game.shots.length')>0);assert.equal(r.run('frameFault'),false);
 if(debug2)assert.equal(r.storage.get(SAVE_KEY),baseline);
 return {mission:id,mode:debug2?'URL_INVINCIBLE':'ASSISTED',classId:'RANGER',weapons:['A-01','S-02'],method:'formal sortie X64 / real movement and shooting; no checkpoint warp or HP edits',status:'PASS',defeat:true,deathUpdateFrames:60,result:true,ending,next,updateSeconds:r.run('game.time'),movedTo:r.run('game.player.x'),fired:true,frameFault:false,saved:true,normalSaveUnchanged:debug2?true:null,gameSeconds:out.seconds};
}
