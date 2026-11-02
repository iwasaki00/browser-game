import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {deploy} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,WEAPONS,sanitizeSave} from '../js/data.js';
const seed=()=>sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03','M04','M05','M06','M07'],unlocked:WEAPONS.map(w=>w.id)});
const boot=debug2=>runtime(seed(),{recordDraw:false,search:debug2?'?debug=2':'',...(debug2?{storageEntries:[[SAVE_KEY+'-debug2',JSON.stringify(seed())]]}:{})});
for(const debug2 of [false,true])for(const form of [1,2])test(`${debug2?'debug2':'normal'} M08 form ${form} transition truncates a live storm/meteor queue safely`,()=>{
 const r=boot(debug2);deploy(r,'M08','WING',['T-16','M-20']);const normal=r.storage.get(SAVE_KEY);
 r.run(`game.player.x=9000;startBoss();var b=game.enemies.find(e=>e.type==='overmind');resetFinalBoss(game,b,${form},3);b.hp=1;fireExpanded(game,weapon('T-16'),game.player,{x:b.x,y:b.y+32},weaponAPI);fireExpanded(game,weapon('M-20'),game.player,{x:b.x,y:b.y+32},weaponAPI);game.grid.rebuild(game.enemies)`);
 assert.equal(r.run('game.arsenal.jobs.length'),2);assert.doesNotThrow(()=>r.run('updateExpanded(game,1/60,weaponAPI)'));assert.ok(r.run('b.transitionLeft')>0);assert.equal(r.run('b.dead'),false);assert.equal(r.run('game.arsenal.jobs.length+game.arsenal.pending.length+game.shots.length'),0);
 r.run('for(let n=0;n<180;n++)animationFrame(last+1000/60)');assert.equal(r.run('frameFault'),false);assert.equal(r.run('b.form'),form+1);assert.ok(r.run('b.hp')>0);if(debug2)assert.equal(r.storage.get(SAVE_KEY),normal);
});
for(const debug2 of [false,true])test(`${debug2?'debug2':'normal'} turret before a detonated mine cannot leave a sparse installation list on M04 clear`,()=>{
 const r=boot(debug2);deploy(r,'M04','WING',['M-18','D-19']);const normal=r.storage.get(SAVE_KEY);
 r.run("game.player.x=6650;startBoss();var b=game.enemies.find(e=>e.type==='fortress');resetSkyBossPhase(game,b,3);b.hp=1;fireExpanded(game,weapon('D-19'),game.player,b,weaponAPI);fireExpanded(game,weapon('M-18'),game.player,b,weaponAPI);game.grid.rebuild(game.enemies);useRemoteMines()");
 assert.equal(r.run('b.dead'),true);assert.equal(r.run('game.clear'),true);assert.equal(r.run('game.arsenal.installations.length'),0);assert.doesNotThrow(()=>r.run('drawExpanded(ctx,game,images,{left:0,right:10000})'));r.flush();r.flush();assert.equal(r.run('state'),'result');r.click('mission-select');r.click('select-mission','M05');r.click('deploy');r.run('input.right=input.fire=true;for(let n=0;n<60;n++)animationFrame(last+1000/60)');assert.equal(r.run('frameFault'),false);assert.ok(r.run('game.player.x')>100);if(debug2)assert.equal(r.storage.get(SAVE_KEY),normal);
});
test('M08 phase reset while detonating mines also clears retained turret prefix without resurrecting holes',()=>{
 const r=boot(false);deploy(r,'M08','RANGER',['M-18','D-19']);r.run("game.player.x=9200;startBoss();var b=game.enemies.find(e=>e.type==='overmind');resetFinalBoss(game,b,1,3);b.hp=1;fireExpanded(game,weapon('D-19'),game.player,b,weaponAPI);fireExpanded(game,weapon('M-18'),game.player,b,weaponAPI);game.grid.rebuild(game.enemies);useRemoteMines()");assert.ok(r.run('b.transitionLeft')>0);assert.equal(r.run('game.arsenal.installations.length'),0);assert.doesNotThrow(()=>r.run('updateExpanded(game,1/60,weaponAPI);drawExpanded(ctx,game,images,{left:0,right:10000})'));
});
test('nonlethal mine detonation retains the original turret and removes mines normally',()=>{
 const r=boot(false);deploy(r,'M04','RANGER',['M-18','D-19']);r.run("game.player.x=6650;startBoss();var b=game.enemies.find(e=>e.type==='fortress');resetSkyBossPhase(game,b,3);fireExpanded(game,weapon('D-19'),game.player,b,weaponAPI);var turret=game.arsenal.installations[0];fireExpanded(game,weapon('M-18'),game.player,b,weaponAPI);game.grid.rebuild(game.enemies);useRemoteMines()");assert.equal(r.run('b.dead'),false);assert.equal(r.run('game.arsenal.installations.length'),1);assert.equal(r.run('game.arsenal.installations[0]===turret'),true);assert.equal(r.run('b.hp'),3130);
});
