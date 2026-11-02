import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {deploy,drive} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,sanitizeSave,SAVE_KEY} from '../js/data.js';
import {historical} from './helpers/movement-comparison.mjs';
import {PLAYER_CLASSES} from '../js/data.js';
import {LAB_BOSS_APPROACHES} from '../js/mission-lab.js';
import {SKY_ACTORS,drawSkyEnemy} from '../js/sky-art.js';
import {FORTRESS_DEFEAT} from '../js/boss-defeat.js';

const seed=()=>sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03'],selectedClass:'WING'});
test('C1 reproduction: one draw exception can stop RAF while formal M05 HTML deployment still succeeds',()=>{
 const r=runtime(seed(),{recordDraw:false,sourceText:historical('7c36f7f','js/game.js')});deploy(r,'M04','WING');
 r.run("game.player.x=6220;startBoss();resetSkyBossPhase(game,game.enemies[0],3);damageEnemy(game.enemies[0],99999)");r.flush();r.flush();assert.equal(r.run('state'),'result');
 r.run("var originalDraw=draw;draw=()=>{throw Error('injected-render-fault')}");const count=r.rafCount();assert.throws(()=>r.run('loop(1000)'),/injected-render-fault/);assert.equal(r.rafCount(),count);
 // Reproduces the mechanism, NOT the actual Safari triggering exception.
 r.click('mission-select');r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');assert.equal(r.run('state'),'play');assert.equal(r.run('game.time'),0);assert.equal(r.rafCount(),count);
 r.run('draw=originalDraw');
});
test('C1 reproduction: B04 generic corpse expires before its existing collapse/results timer',()=>{
 const r=runtime(seed(),{recordDraw:false,sourceText:historical('7c36f7f','js/game.js')});deploy(r,'M04','WING');
 r.run("game.player.x=6220;startBoss();var b=game.enemies[0];resetSkyBossPhase(game,b,3);damageEnemy(b,99999,{type:'bullet'});var lifetime=b.death;for(let i=0;i<45;i++)update(1/60)");
 assert.ok(r.run('lifetime')<1.6);assert.equal(r.run('game.enemies.includes(b)'),false);assert.equal(r.run('state'),'play');
});

for(const cp of LAB_BOSS_APPROACHES)for(const classId of Object.keys(PLAYER_CLASSES))test(cp.missionId+' '+classId+' pre-boss safe checkpoint, walking trigger, full mandatory parts and LAB isolation',()=>{
 const archive=new Map([['pdf-result-transition-v1','normal-sentinel']]);let diagnosticWrites=0;
 const r=runtime(null,{debug:true,recordDraw:false,modules:{sessionStorage:{getItem:k=>archive.get(k),setItem:(k,v)=>{diagnosticWrites++;archive.set(k,v)}}}});
 const before=r.storage.get(SAVE_KEY),writes=r.writes.length;r.click('test-lab');r.change('labPreset',classId);r.change('labStageMission',cp.missionId);r.change('labStageDensity','LIGHT');r.change('labWeapon1','R-04');r.change('labValidation','B');r.click('lab-preboss-start');
 assert.equal(r.run('state'),'play');assert.equal(r.run('game.bossStarted'),false);assert.equal(r.run('game.player.x'),cp.x);assert.equal(r.run('game.player.hp'),PLAYER_CLASSES[classId].hp);assert.equal(r.run('game.enemyLimit'),30);assert.equal(r.run('game.lab.invincible'),false);assert.equal(r.run('activeEquipment()[0]'),'R-04');
 r.run("var penetrating=game.platforms.some(b=>b.active!==false&&b.solid&&game.player.x+7>b.x&&game.player.x-7<b.x+b.w&&game.player.y+32>b.y+.01&&game.player.y<b.y+(b.h??8)-.01);input.right=true;for(let i=0;i<120&&!game.bossStarted;i++)update(1/60)");
 assert.equal(r.run('penetrating'),false);assert.equal(r.run('game.bossStarted'),true);assert.equal(r.run('game.enemies.find(e=>isBoss(e)).hp===game.enemies.find(e=>isBoss(e)).maxHp'),true);
 if(cp.missionId==='M04')assert.equal(r.run('game.sky.parts.filter(e=>!e.dead).length'),4);
 if(cp.missionId==='M08'){assert.equal(r.run('game.enemies.find(e=>isBoss(e)).form'),1);assert.equal(r.run('game.finalDefense.devices.filter(e=>!e.dead).length'),2)}
 r.click('lab-open');r.click('lab-reset');assert.equal(r.run('game.bossStarted'),false);assert.equal(r.run('game.player.x'),cp.x);assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(r.writes.length,writes);assert.equal(diagnosticWrites,0);assert.equal(archive.get('pdf-result-transition-v1'),'normal-sentinel');
});

test('pre-boss explicit start and retry retain full M04 parts, invincible ON, all20 equipment; no automatic rewards',()=>{
 const r=runtime(null,{debug:true,recordDraw:false});r.click('test-lab');r.change('labPreset','WING');r.change('labStageMission','M04');r.change('labWeapon1','M-20');r.change('labValidation','C');const before=r.storage.get(SAVE_KEY),writes=r.writes.length;
 r.click('lab-preboss-start');r.click('lab-open');r.click('lab-approach-battle');assert.equal(r.run('game.bossStarted'),true);assert.equal(r.run('game.lab.invincible'),true);assert.equal(r.run('game.sky.parts.every(e=>!e.dead&&e.hp===e.maxHp)'),true);assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(r.writes.length,writes);
});

function formalBoss(r,id){deploy(r,'M04',id);r.run("game.player.x=6164;game.player.y=116;game.director.stopped=true;game.player.invuln=3600");const out=drive(r,'M04',{assist:true});assert.equal(out.bossDefeated,true);assert.equal(r.run('state'),'result');assert.ok(out.parts.every(e=>e.dead));return out}
for(const classId of ['WING','RANGER','GUARDIAN'])test(classId+' isolated formal M04 full devices/core -> M05 real RAF movement/fire, duplicate tap and repeat sortie',()=>{
 const r=runtime(seed(),{recordDraw:false,randomSeed:11001008});
 for(let attempt=0;attempt<2;attempt++){
  formalBoss(r,classId);const committed=r.json('save.campaignStats.firstRewards'),clears=r.run(`save.campaignStats.classes.${classId}.clears`);r.click('boss-defeat-skip');r.run('completeMission()');assert.equal(r.run(`save.campaignStats.classes.${classId}.clears`),clears);assert.deepEqual(r.json('save.campaignStats.firstRewards'),committed);
  if(classId==='WING'&&attempt===0){r.run("var savedDraw=draw;draw=()=>{throw Error('result-render-fixture')};animationFrame(last+1000);draw=savedDraw");assert.equal(r.run('state'),'result');assert.equal(r.run('frameFault'),true)}
  r.click('mission-select');r.click('select-mission','M05');r.click('deploy');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');assert.equal(r.run('state'),'play');assert.equal(r.run('game.clear'),false);assert.equal(r.run('frameFault'),false);assert.equal(r.run('game.bossDefeat'),undefined);
  const x=r.run('game.player.x'),time=r.run('game.time');r.pointer('right','pointerdown',{pointerId:71});r.pointer('aimPad','pointerdown',{pointerId:72});r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;var nextStart=last+1000;for(let i=1;i<=60;i++)animationFrame(nextStart+i*1000/60)");assert.ok(r.run('game.time')>time+.8,JSON.stringify(r.json('({state,time:game.time,events:resultFlow.events.filter(e=>e.stage.includes("error"))})')));assert.ok(r.run('game.player.x')>x+PLAYER_CLASSES[classId].speed*.8);assert.ok(r.run('game.shots.length')>0);assert.ok(r.json('resultFlow.events').some(e=>e.stage==='frame-ready'));assert.ok(r.json('resultFlow.events').some(e=>e.stage==='sortie-rejected'&&e.detail==='not-equipment-screen'));
  r.click('mission-select');assert.equal(r.run('state'),'mission');const q=runtime(JSON.parse(r.storage.get(SAVE_KEY)),{recordDraw:false});assert.equal(q.run("canPlayMission('M05',save)"),true);
 }
});

test('render exception preserves RAF, reports/pause, and next formal sortie resets broken Canvas state',()=>{
 const r=runtime(seed(),{recordDraw:false});deploy(r,'M04','WING');r.run("var originalDraw=draw;draw=()=>{throw Error('draw-fault-fixture')}");const count=r.rafCount();assert.doesNotThrow(()=>r.run('animationFrame(1000)'));assert.equal(r.rafCount(),count+1);assert.equal(r.run('state'),'pause');assert.equal(r.run('frameFault'),true);assert.match(r.get('frameErrorStatus').textContent,/エラー/);assert.ok(r.json('resultFlow.events').some(e=>e.stage==='frame-error'));
 r.run('draw=originalDraw');r.click('resume');r.pointer('right','pointerdown');r.run('for(let i=1;i<=60;i++)animationFrame(1000+i*1000/60)');assert.ok(r.run('game.player.x')>160);assert.equal(r.run('frameFault'),false);
});

test('B04 save is immediate, body stays until staged ending, skipping/timers cannot regrant; drawing/audio fault cannot strand result',()=>{
 const r=runtime(seed(),{recordDraw:false});deploy(r,'M04','WING');r.run("game.player.x=6220;startBoss();var b=game.enemies[0];resetSkyBossPhase(game,b,3);damageEnemy(b,99999,{type:'bullet'});for(let i=0;i<60;i++)update(1/60)");assert.equal(r.run('game.enemies.includes(b)'),true);assert.ok(r.run('game.bossDefeat.elapsed')>.8);assert.equal(r.run('state'),'play');assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions.includes('M04'));assert.ok(r.run('game.bossDefeat.bursts')<=FORTRESS_DEFEAT.maxBursts);
 const before=r.json('save');r.run("draw=()=>{throw Error('collapse-draw-fixture')};animationFrame(1000)");assert.equal(r.run('state'),'pause');r.flush();assert.equal(r.run('state'),'result');assert.deepEqual(r.json('save'),before);r.click('boss-defeat-skip');r.flush();assert.deepEqual(r.json('save'),before);
});

test('B04 sprite crop remains within actual atlas in every phase/hit/death; large white rectangle is not a hit replacement',()=>{
 const calls=[],c={drawImage:(...a)=>calls.push(a)},pack={fortress:{width:2560,height:192}};
 for(const phase of [1,2,3])for(const hp of [3200,4])for(const flash of [0,.055])drawSkyEnemy(c,pack,{type:'fortress',skyPhase:phase,hp,maxHp:3200,hitFlash:flash,anim:1},100,68,false);
 assert.equal(calls.length,12);for(const [image,sx,sy,sw,sh]of calls){assert.ok(sx>=0&&sx+sw<=image.width);assert.equal(sy,0);assert.equal(sh,SKY_ACTORS.fortress[1]*2);assert.ok(sw>0)}
});
test('B04 optional audio failure cannot prevent the already-committed clear or timer/skip result',()=>{
 const r=runtime(seed(),{recordDraw:false});deploy(r,'M04','WING');r.run("game.player.x=6220;startBoss();var b=game.enemies[0];resetSkyBossPhase(game,b,3);save.settings.sound=true;audioBus.play=()=>{throw Error('audio-fixture')}");assert.throws(()=>r.run('damageEnemy(b,99999)'),/audio-fixture/);assert.ok(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions.includes('M04'));r.flush();assert.equal(r.run('state'),'result');
});
test('B04 early skip, late timer and missing optional skip UI never duplicate rewards or strand progression',()=>{
 for(const missing of [false,true]){const r=runtime(seed(),{recordDraw:false});deploy(r,'M04','WING');r.run("game.player.x=6220;startBoss();resetSkyBossPhase(game,game.enemies[0],3)");if(missing)r.run("var originalQuery=document.querySelector;document.querySelector=s=>s==='#bossDefeatSkip'?null:originalQuery(s)");
  r.run('damageEnemy(game.enemies[0],99999)');assert.equal(r.run('state'),'play');const before=r.json('save');r.click('boss-defeat-skip');assert.equal(r.run('state'),'result');r.flush();assert.deepEqual(r.json('save'),before);r.click('mission-select');r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');if(!missing)assert.equal(r.get('bossDefeatSkip').hidden,true);
 }
});
test('page interruption during B04 ending releases held pointers and resumes result/next sortie without replaying rewards',()=>{
 const r=runtime(seed(),{recordDraw:false});deploy(r,'M04','WING');r.run("game.player.x=6220;startBoss();resetSkyBossPhase(game,game.enemies[0],3);damageEnemy(game.enemies[0],99999)");const saved=r.json('save');r.pointer('up','pointerdown',{pointerId:8});r.pointer('aimPad','pointerdown',{pointerId:9});r.run('document.hidden=true');r.event('pagehide');r.event('visibilitychange');r.flush();assert.equal(r.run('state'),'result');r.run('document.hidden=false');r.event('pageshow');assert.deepEqual(r.json('[input.up,input.fire,touchPointers.size,aimPointer]'),[false,false,0,null]);assert.deepEqual(r.json('save'),saved);r.click('mission-select');r.click('select-mission','M05');r.click('deploy');r.run('animationFrame(2000)');assert.equal(r.run('state'),'play');assert.ok(r.run('game.time')>0);
});
