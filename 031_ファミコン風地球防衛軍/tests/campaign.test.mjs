import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,MISSIONS,WEAPONS,PLAYER_CLASSES,sanitizeSave,recordMissionClear} from '../js/data.js';
import {campaignProgress,missionRecord,CampaignCommand} from '../js/campaign.js';
const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03','M04','M05'],unlocked:WEAPONS.map(w=>w.id)});
const normal=(id='M01',classId='RANGER')=>{const s=seed();s.selectedClass=classId;const r=runtime(s,{recordDraw:false});r.run(`startMission('${id}')`);return r};
const stats=r=>r.json('save.campaignStats');

test('legacy records retain progress/weapons/score/time without assigning class or weapon history',()=>{
 const old={version:1,cleared:['M01','M02','M03','M04','M05','M06'],unlocked:['L-03','R-04'],highScore:1234,bestTime:123,missionStats:{M06:{highScore:900,bestTime:90,kills:45}}},s=sanitizeSave(old);
 assert.equal(s.campaignStats.legacyUnrecorded,true);assert.deepEqual(s.campaignStats.classes,{});assert.deepEqual(s.campaignStats.weapons,{});assert.equal(s.missionStats.M06.kills,45);assert.equal(s.highScore,1234);assert.ok(s.unlocked.includes('R-04'));assert.equal(missionRecord(MISSIONS[5],s).reward,'過去分未記録');assert.equal(missionRecord(MISSIONS[5],s).score,'900');assert.equal(campaignProgress(s).cleared,6);assert.equal(campaignProgress(s).percent,86);assert.equal(campaignProgress(s).total,7);
});
test('progress denominator and weapon/class data follow masters, not hardcoded six or twenty',()=>{
 const s=sanitizeSave(seed()),p=campaignProgress(s,[...MISSIONS.map(m=>m.id==='M07'?{...m,implemented:true}:m),{id:'M08',implemented:false}]);assert.equal(p.total,7);assert.equal(p.cleared,5);assert.equal(p.next.id,'M06');assert.equal(campaignProgress(s,[]).percent,0);
});

test('all implemented mission records (including six legacy) survive statistics and normal result rewards',()=>{
 const s=seed();s.clearedMissions=MISSIONS.filter(m=>m.implemented).map(m=>m.id);s.missionStats=Object.fromEntries(s.clearedMissions.map((id,i)=>[id,{highScore:9000+i,bestTime:40+i,kills:i+10}]));delete s.campaignStats;
 const restored=sanitizeSave(s);for(const [i,m] of MISSIONS.filter(m=>m.implemented).entries()){assert.equal(missionRecord(m,restored).score,String(9000+i));assert.equal(missionRecord(m,restored).time,`0:${40+i}`);if(['M05','M06','M07'].includes(m.id))assert.equal(restored.missionStats[m.id].kills,i+10)}
 for(const m of MISSIONS.filter(m=>m.implemented)){const r=runtime(s,{recordDraw:false});r.run(`startMission('${m.id}');game.time=100;game.score=500;completeMission()`);r.flush();assert.equal(stats(r).classes.RANGER.clears,1);assert.equal(r.run('state'),'result');const saved=sanitizeSave(JSON.parse(r.storage.get(SAVE_KEY)));assert.equal(saved.missionStats[m.id].highScore,s.missionStats[m.id].highScore);assert.equal(saved.missionStats[m.id].bestTime,s.missionStats[m.id].bestTime);assert.equal(saved.unlocked.length,20);assert.equal(saved.clearedMissions.length,7)}
});
test('missing, zero, legacy and new mission rewards are distinguished',()=>{
 const s=sanitizeSave({version:2,clearedMissions:['M02']});assert.equal(missionRecord(MISSIONS[1],s).score,'記録なし');assert.equal(missionRecord(MISSIONS[1],s).time,'記録なし');assert.equal(missionRecord(MISSIONS[0],s).reward,'未取得');assert.equal(s.campaignStats.classes.RANGER,undefined);
 const r=normal();r.run('game.time=30;game.score=1500;completeMission()');assert.equal(stats(r).classes.RANGER.sorties,1);assert.equal(stats(r).classes.RANGER.clears,1); // seed already cleared M01: no invented old first reward
 assert.equal(stats(r).firstRewards.M01,undefined);const fresh=runtime();fresh.run("startMission('M01');game.time=30;game.score=1500;completeMission()");assert.equal(stats(fresh).firstRewards.M01,true);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' sortie once, pause/render do not count, retry is new sortie',()=>{
 const r=normal('M01',id);r.run("pause('QA');resume();pause('QA');resume();renderMissionList();draw()");assert.equal(stats(r).classes[id].sorties,1);r.click('retry');assert.equal(stats(r).classes[id].sorties,2);assert.equal(stats(r).classes[id].gameOvers,0);assert.equal(stats(r).weapons['A-01'].equipped,2);
});
test('clear/gameover are once-only and class mission record survives sanitizer replacing save',()=>{
 const r=normal();r.run('game.time=42;game.score=5000;completeMission();completeMission()');let s=stats(r);assert.equal(s.classes.RANGER.clears,1);assert.equal(s.classes.RANGER.missions.M01.bestTime,42);assert.equal(s.classes.RANGER.missions.M01.highScore,5000);assert.equal(sanitizeSave(JSON.parse(r.storage.get(SAVE_KEY))).campaignStats.classes.RANGER.clears,1);
 r.click('retry');r.run('game.player.hp=0;update(1/60);update(1/60)');r.flush();assert.equal(stats(r).classes.RANGER.gameOvers,1);assert.equal(stats(r).classes.RANGER.clears,1);assert.equal(stats(r).classes.RANGER.sorties,2);
});
test('class kills count real E/B enemies exactly once, not nodes, nests, shell or boss parts',()=>{
 const r=normal('M06');r.run("var e=spawnEnemy('pulseworm',400);damageEnemy(e,999,{weaponId:'A-01'});damageEnemy(e,999,{weaponId:'A-01'});damageEnemy(game.living.shell,999,{weaponId:'A-01'});damageEnemy(game.living.nodes[0],999,{weaponId:'A-01'})");assert.equal(stats(r).classes.RANGER.kills,1);assert.equal(stats(r).weapons['A-01'].hits,2);r.run("game.player.x=7080;startBoss();resetLivingBoss(game,game.enemies[0],'OPEN');damageEnemy(game.enemies[0],9999,{weaponId:'A-01'})");assert.equal(stats(r).classes.RANGER.kills,2);r.flush();r.flush();assert.equal(stats(r).classes.RANGER.clears,1);
});
test('time counts visible focused live fixed updates including hit-stop, not pause/hidden/dead/collapse',()=>{
 const r=normal();r.run("for(let i=0;i<60;i++)update(1/60);pause('QA');for(let i=0;i<60;i++)update(1/60);resume();document.hidden=true;for(let i=0;i<60;i++)update(1/60);document.hidden=false;game.impact.stop=.1;for(let i=0;i<6;i++)update(1/60)");assert.ok(Math.abs(stats(r).classes.RANGER.playSeconds-1.1)<1e-8);
 r.run('document.hasFocus=()=>false;for(let i=0;i<60;i++)update(1/60)');assert.ok(Math.abs(stats(r).classes.RANGER.playSeconds-1.1)<1e-8);r.run('document.hasFocus=()=>true;game.player.hp=0;update(1/60);var t=save.campaignStats.classes.RANGER.playSeconds;for(let i=0;i<60;i++)update(1/60)');assert.equal(stats(r).classes.RANGER.playSeconds,r.run('t'));
});
test('one accepted action is one use for pellets, homing, split, storm, meteor; rejected capacity is zero',()=>{
 const r=normal();for(const id of ['A-01','S-02','H-08','R-10','G-14','T-16','M-20']){r.run(`save.equipped[0]='${id}';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;shoot()`);assert.equal(stats(r).weapons[id].uses,1)}
 r.run("save.equipped[0]='M-18';game.player.shotCd=0;shoot();game.player.shotCd=0;shoot();game.player.shotCd=0;shoot();game.player.shotCd=0;shoot()");assert.equal(stats(r).weapons['M-18'].uses,3);assert.equal(stats(r).weapons['M-18'].placements,3);r.run('useRemoteMines();useRemoteMines()');assert.equal(stats(r).weapons['M-18'].detonations,1);assert.equal(stats(r).weapons['M-18'].minesDetonated,3);
});
test('actual rocket area hits, thunder chain, storm and turret preserve explicit attribution; environment never claims assault hits',()=>{
 const r=normal();r.run("var e=spawnEnemy('beetle',500);game.grid.rebuild(game.enemies);explode({weapon:weapon('R-04'),type:'rocket',x:500,y:e.y+10,radius:45,damage:10});damageEnemy(e,7,{type:'bullet'})");assert.equal(stats(r).weapons['R-04'].hits,1);assert.equal(stats(r).weapons['A-01'].hits,0);
 r.run("clearArsenal(game);game.enemies.length=0;game.liveEnemies=game.liveMobs=0;spawnEnemy('beetle',120);spawnEnemy('beetle',160);save.equipped[0]='T-06';game.player.shotCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;game.grid.rebuild(game.enemies);shoot();for(let i=0;i<30;i++)updateShots(1/60)");assert.ok(stats(r).weapons['T-06'].hits>=2);
 r.run("clearArsenal(game);save.equipped[0]='T-16';game.player.shotCd=0;input.aimMode='mouse';input.aimX=100;input.aimY=125;shoot();for(let i=0;i<100;i++){game.grid.rebuild(game.enemies);updateExpanded(game,1/60,weaponAPI)}");assert.equal(stats(r).weapons['T-16'].uses,1);assert.ok(stats(r).weapons['T-16'].hits>0);
});
test('pagehide/pause/repeated flush store snapshots, not repeated session totals; no per-shot writes',()=>{
 const r=normal();let before=r.storage.get(SAVE_KEY);r.run('input.fire=true;for(let i=0;i<120;i++)update(1/60)');assert.equal(r.storage.get(SAVE_KEY),before);r.event('pagehide');const s=r.storage.get(SAVE_KEY);assert.notEqual(s,before);r.event('pagehide');r.run('flushCampaign();flushCampaign()');assert.equal(r.storage.get(SAVE_KEY),s);const restored=sanitizeSave(JSON.parse(s));assert.equal(restored.campaignStats.classes.RANGER.sorties,1);assert.ok(Math.abs(restored.campaignStats.classes.RANGER.playSeconds-2)<1e-8);
});

test('turret autonomous hits are attributed without counting autonomous shots as new placements',()=>{
 const r=normal();r.run("save.equipped[0]='D-19';game.player.shotCd=0;shoot();var e=spawnEnemy('beetle',150);for(let i=0;i<120;i++){game.grid.rebuild(game.enemies);updateExpanded(game,1/60,weaponAPI)}");const w=stats(r).weapons['D-19'];assert.equal(w.uses,1);assert.equal(w.placements,1);assert.ok(w.hits>0);
});

test('save failure keeps the dirty snapshot for retry and exposes a readable warning',()=>{
 const r=normal(),before=r.storage.get(SAVE_KEY);r.run("localStorage.setItem=()=>{throw Error('quota')};input.fire=true;update(1/60);pause('QA');show('mission')");assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(r.run('game.campaignRun.dirty'),true);assert.match(r.get('campaignSaveStatus').textContent,/保存できません/);r.run("localStorage.setItem=(k,v)=>{globalSaved=v};flushCampaign()");assert.equal(r.run('game.campaignRun.dirty'),false);assert.equal(r.run('campaignSaveError'),'');assert.equal(JSON.parse(r.run('globalSaved')).campaignStats.classes.RANGER.sorties,1);
});
test('every LAB route and normal QA preset leave normal stats and save byte-identical',()=>{
 const r=runtime(seed(),{debug:true,recordDraw:false}),before=r.storage.get(SAVE_KEY);r.click('test-lab');r.change('labPreset','WING');r.change('labWeapon1','R-04');r.click('lab-test');r.run("var e=spawnEnemy('crawler',120);damageEnemy(e,999,{weaponId:'R-04'});for(let i=0;i<60;i++)update(1/60)");r.click('lab-open');r.get('labUIPreset').value='gameplay';r.click('lab-preset-apply');r.change('labStageMission','M06');r.click('lab-stage-start');r.click('lab-open');r.change('labLivingState','OPEN');r.click('lab-boss-6');r.run("damageEnemy(game.enemies[0],99999,{weaponId:'A-01'})");r.flush();r.run('flushCampaign()');r.event('pagehide');assert.equal(r.storage.get(SAVE_KEY),before);assert.deepEqual(stats(r),sanitizeSave(seed()).campaignStats);
});
test('malformed counters and IDs are bounded, finite and prototype safe',()=>{
 const s=sanitizeSave({...seed(),campaignStats:{schemaVersion:1,legacyUnrecorded:true,classes:{RANGER:{sorties:3,clears:99,gameOvers:99,kills:-2,playSeconds:Infinity,missions:{M01:{highScore:NaN,bestTime:-1},UNKNOWN:{}}},INJECT:{}},weapons:{'A-01':{equipped:-1,uses:Infinity,hits:2.9},WRONG:{}},firstRewards:{M06:true,WRONG:true}}});assert.equal(s.campaignStats.classes.RANGER.clears,3);assert.equal(s.campaignStats.classes.RANGER.gameOvers,0);assert.equal(s.campaignStats.classes.RANGER.playSeconds,0);assert.equal(s.campaignStats.weapons['A-01'].hits,2);assert.equal(s.campaignStats.weapons.WRONG,undefined);assert.equal(s.campaignStats.firstRewards.WRONG,undefined);assert.ok(JSON.stringify(s).length<12000);assert.deepEqual(recordMissionClear(s,'M06').campaignStats,s.campaignStats);
});
test('four panels render real data, locks retain backend guard, all20 weapons browse and preview stops',()=>{
 const r=runtime(null,{recordDraw:true});r.click('start');assert.match(r.get('campaignProgress').textContent,/0\/7/);assert.equal(r.get('missionList').children.length,MISSIONS.length);r.click('select-mission','M06');assert.equal(r.run('state'),'mission');r.run("campaign.tab='classes';renderMissionList()");assert.equal(r.get('campaignClassList').children.length,4);assert.match(r.get('campaignClassList').children[0].innerHTML,/未記録/);r.run("campaign.tab='weapons';renderMissionList()");assert.equal(r.get('campaignWeaponList').children.length,20);r.input('campaignWeaponSearch','M-20');assert.equal(r.get('campaignWeaponList').children.length,1);assert.match(r.get('campaignWeaponList').children[0].innerHTML,/メテオ/);
 r.run("campaign.tab='missions';campaign.selected='M06';renderMissionList();var n=campaign.previewFrames;campaign.preview(100,true,{});campaign.preview(200,true,{});campaign.preview(300,false,{})");assert.equal(r.run('campaign.previewFrames-n'),1);assert.equal(r.get('campaignPreview').dataset.fallback,'true');r.run("campaign.animation=false;campaign.lastPreview=-Infinity;campaign.preview(400,true,{M06:{background:{width:640,height:360}}});n=campaign.previewFrames;campaign.preview(500,true,{M06:{background:campaign.previewImage}})");assert.equal(r.run('campaign.previewFrames'),r.run('n'));
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),section=html.slice(html.indexOf('id="screenMission"'),html.indexOf('id="screenEquip"'));assert.equal((section.match(/role="tab"/g)||[]).length,4);assert.equal((html.match(/id="labTab-/g)||[]).length,5);
});
