import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {deploy,drive} from '../tools/campaign-integration.mjs';
import {DEFAULT_SAVE,SAVE_KEY,MISSIONS,PLAYER_CLASSES,sanitizeSave} from '../js/data.js';

const debugKey=SAVE_KEY+'-debug2';
const normalSeed=()=>sanitizeSave({...structuredClone(DEFAULT_SAVE),selectedClass:'SCOUT',clearedMissions:['M01','M02'],unlocked:['A-01','S-02','R-04'],highScore:12345});
function boot(seed=null,extra={}){return runtime(normalSeed(),{search:'?debug=2',recordDraw:false,...(seed?{storageEntries:[[debugKey,JSON.stringify(seed)]]}:{}),...extra})}
function isolated(r){assert.equal(r.storage.get(SAVE_KEY),JSON.stringify(normalSeed()));assert.ok(r.writes.length>0);assert.ok(r.writes.every(w=>w.key===debugKey))}

for(const search of ['', '?debug=0','?debug=1','?debug=20','?debug=02','?debug=true','?debug=2abc','?debug=','?other=2','?DEBUG=2','?debug=2%20','?debug=%202','?debug=1&debug=2'])test('strict query: '+(search||'normal URL')+' does not grant URL invincibility',()=>{
 const r=runtime(null,{search,recordDraw:false});deploy(r,'M01');const hp=r.run('game.player.hp');r.run('hurtPlayer(20,0)');assert.ok(r.run('game.player.hp')<hp);assert.equal(r.run('URL_INVINCIBLE'),false);assert.equal(r.get('urlInvincibleBadge').hidden,true);assert.equal(r.get('debug2Setup').hidden,true);assert.equal(r.storage.has(debugKey),false);
 const before=r.json('save.unlockedMissions');r.click('debug2-unlock');assert.deepEqual(r.json('save.unlockedMissions'),before);
});
test('URLSearchParams accepts exact decoded value with unrelated params; reload derives mode anew',()=>{
 for(const search of ['?debug=2','?x=1&debug=2','?debug=%32']){const r=boot(null,{search});assert.equal(r.run('URL_INVINCIBLE'),true);assert.equal(r.run('DEBUG'),false);assert.equal(r.get('urlInvincibleBadge').hidden,false);assert.notEqual(r.get('testLabButton').hidden,false);deploy(r,'M01');assert.equal(r.run('canvas.width'),320);assert.equal(r.run('window.__PDF_GAME__'),undefined);isolated(r)}
});
for(const classId of Object.keys(PLAYER_CLASSES))test(classId+' debug2 blocks damage at application but retains hit effects, hit cooldown and ordinary enemy damage',()=>{
 const r=boot();deploy(r,'M01',classId);const hp=r.run('game.player.hp');assert.equal(hp,PLAYER_CLASSES[classId].hp);
 r.run('hurtPlayer(99999,0)');assert.equal(r.run('game.player.hp'),hp);assert.equal(r.run('game.player.invuln'),1);assert.equal(r.run('game.player.hitPose'),.16);assert.ok(r.run('game.player.vy')<0);assert.equal(r.run('game.shake'),4);
 r.run('var e=spawnEnemy("crawler",180);var enemyHp=e.hp;damageEnemy(e,8,{weapon:WEAPON_BY_ID["A-01"],type:"bullet",vx:1,vy:0});');assert.equal(r.run('enemyHp-e.hp'),8);
 // Invincibility must not restore HP every frame, nor freeze AI/projectiles.
 r.run('game.player.hp=33;var age=e.anim;update(1/60)');assert.equal(r.run('game.player.hp'),33);assert.ok(r.run('e.anim')>r.run('age'));assert.equal(r.run('game.player.dead'),false);
 r.click('pause-game');assert.equal(r.run('state'),'pause');r.click('resume');r.run('game.player.invuln=0;hurtPlayer(99999,0)');assert.equal(r.run('game.player.hp'),33);
 r.click('retry');assert.equal(r.run('state'),'play');r.run('hurtPlayer(99999,0)');assert.equal(r.run('game.player.hp'),hp);isolated(r);
});
test('debug2 uses independent defaults, explicit unlock preparation preserves clears/rewards and normal storage',()=>{
 const r=boot();assert.deepEqual(r.json('save.clearedMissions'),[]);assert.deepEqual(r.json('save.unlockedMissions'),['M01']);assert.equal(r.run('save.selectedClass'),'RANGER');const before=r.json('save');r.click('debug2-unlock');assert.match(r.get('debug2SetupStatus').textContent,/解放しました/);
 const after=r.json('save');assert.deepEqual(after.unlockedMissions,MISSIONS.filter(m=>m.implemented).map(m=>m.id));delete before.unlockedMissions;delete after.unlockedMissions;assert.deepEqual(after,before);r.click('debug2-unlock');isolated(r);
 deploy(r,'M04','WING');r.run('hurtPlayer(99999,0)');assert.equal(r.run('game.player.hp'),65);r.click('quit');r.click('confirm-title');
 const saved=r.storage.get(debugKey),q=boot(JSON.parse(saved));assert.equal(q.run('save.selectedClass'),'WING');assert.equal(q.run("canPlayMission('M04',save)"),true);isolated(q);
 const normal=runtime(normalSeed(),{recordDraw:false,storageEntries:[[debugKey,saved]]});assert.deepEqual(normal.json('save.clearedMissions'),['M01','M02']);assert.equal(normal.run('save.selectedClass'),'SCOUT');assert.equal(normal.run('save.highScore'),12345);assert.equal(normal.run("canPlayMission('M04',save)"),false);assert.equal(normal.run('URL_INVINCIBLE'),false);assert.equal(normal.storage.get(debugKey),saved);
});
test('dedicated storage failure is reported and never falls back to writing the normal key',()=>{
 const r=boot();r.run("localStorage.setItem=()=>{throw Error('quota fixture')}");r.click('debug2-unlock');assert.match(r.get('debug2SetupStatus').textContent,/未保存/);assert.match(r.run('campaignSaveError'),/未保存/);assert.equal(r.run("canPlayMission('M04',save)"),true);isolated(r);
});
test('debug1 TEST LAB keeps its existing opt-in invincibility and write isolation',()=>{
 const r=runtime(normalSeed(),{debug:true,recordDraw:false});assert.equal(r.run('DEBUG'),true);assert.equal(r.get('testLabButton').hidden,false);assert.equal(r.run('URL_INVINCIBLE'),false);const raw=r.storage.get(SAVE_KEY),writes=r.writes.length;
 r.click('test-lab');assert.equal(r.run('game.lab.invincible'),true);r.run('hurtPlayer(999,0)');assert.equal(r.run('game.player.hp'),r.run('game.player.maxHp'));
 r.change('labInvincible',null,false);assert.equal(r.run('game.lab.invincible'),false);r.run('game.player.invuln=0;hurtPlayer(10,0)');assert.ok(r.run('game.player.hp')<r.run('game.player.maxHp'));assert.equal(r.storage.get(SAVE_KEY),raw);assert.equal(r.writes.length,writes);assert.equal(r.storage.has(debugKey),false);
});
test('debug2 fall rescue uses existing M03-M08 safety without HP loss, clear or progress bypass',()=>{
 const r=boot();r.click('debug2-unlock');for(const id of ['M03','M04','M05','M06','M07','M08']){deploy(r,id,'WING');r.run('game.player.y=230;game.player.onGround=false;game.player.invuln=0');
  r.run(({M03:'recoverCoastalPlayer(game,1/60,hurtPlayer,pushEffect)',M04:'recoverSkyPlayer(game,1/60,hurtPlayer,pushEffect)',M05:'recoverMobilePlayer(game,1/60,hurtPlayer,pushEffect)',M06:'recoverLivingPlayer(game,1/60,hurtPlayer,pushEffect)',M07:'recoverMothershipPlayer(game,1/60,hurtPlayer,pushEffect)',M08:'recoverFinalPlayer(game)'})[id]);
  assert.ok(r.run('game.player.y')<150,id);assert.equal(r.run('game.player.hp'),65);assert.equal(r.run('game.player.dead'),false);assert.equal(r.run('game.clear'),false);assert.deepEqual(r.json('save.clearedMissions'),[]);r.click('quit');r.click('confirm-title');}isolated(r);
});
for(const classId of Object.keys(PLAYER_CLASSES))test('debug2 '+classId+' M04 full boss parts, result, persisted M05 and next sortie',t=>{
 const seed=sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03']});const r=boot(seed);deploy(r,'M04',classId);
 // Arena fixture only; no boss HP edits or direct damage/clear. All phases,
 // mandatory parts, ordinary AI and player shots execute in the real engine.
 r.run('game.player.x=6220;startBoss()');const out=drive(r,'M04');t.diagnostic(JSON.stringify(out));assert.equal(out.bossDefeated,true);assert.equal(r.run('state'),'result');assert.equal(r.run('game.player.hp'),PLAYER_CLASSES[classId].hp);assert.ok(out.parts.every(e=>e.dead));
 const snapshot=r.json('save');assert.ok(snapshot.clearedMissions.includes('M04'));assert.ok(snapshot.unlockedMissions.includes('M05'));r.run('completeMission()');r.click('boss-defeat-skip');r.flush();assert.deepEqual(r.json('save'),snapshot);
 r.click('mission-select');assert.equal(r.run('state'),'mission');r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');assert.equal(r.run('state'),'play');const x=r.run('game.player.x');r.pointer('right','pointerdown',{pointerId:71});r.pointer('aimPad','pointerdown',{pointerId:72});r.run('input.touchDx=1;input.touchDy=0;input.aimMode="touch";for(let i=1;i<=60;i++)animationFrame(1000+i*1000/60)');assert.ok(r.run('game.time')>.8);assert.ok(r.run('game.player.x')>x);assert.ok(r.run('game.shots.length')>0);r.run('game.player.invuln=0;hurtPlayer(9999,0)');assert.equal(r.run('game.player.hp'),PLAYER_CLASSES[classId].hp);isolated(r);
 const q=boot(JSON.parse(r.storage.get(debugKey)));assert.ok(q.json('save.clearedMissions').includes('M04'));assert.equal(q.run("canPlayMission('M05',save)"),true);isolated(q);
});
test('WING holding FLY/HOLD/FIRE on a real HP4 kill resets pointers on result, trace is separate',()=>{
 const archive=new Map([['pdf-result-transition-v1','normal diagnostic sentinel']]);const r=boot(sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03']}),{modules:{sessionStorage:{getItem:k=>archive.get(k),setItem:(k,v)=>archive.set(k,v)}}});deploy(r,'M04','WING');
 r.run('game.player.x=6580;startBoss();var b=game.enemies[0];resetSkyBossPhase(game,b,3);b.hp=4');r.pointer('up','pointerdown',{pointerId:11});r.pointer('hover','pointerdown',{pointerId:12});r.pointer('aimPad','pointerdown',{pointerId:13});r.run('input.fire=true;input.aimMode="touch";for(let i=0;i<120&&!b.dead;i++){const dx=b.x-game.player.x-18,dy=b.y+b.h/2-game.player.y-13,d=Math.hypot(dx,dy);input.touchDx=dx/d;input.touchDy=dy/d;update(1/60)}');assert.equal(r.run('b.dead'),true);r.flush();r.flush();assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[input.up,input.hover,input.fire,touchPointers.size,aimPointer]'),[false,false,false,0,null]);assert.equal(archive.get('pdf-result-transition-v1'),'normal diagnostic sentinel');assert.ok(archive.has('pdf-result-transition-debug2-v1'));assert.equal(r.run('resultFlow.saveScope'),'DEBUG2');isolated(r);
});
test('WING M04 formal sortie from start (no warp) clears all parts and continues to playable M05',t=>{
 const r=boot(sanitizeSave({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03']}));deploy(r,'M04','WING');const out=drive(r,'M04');t.diagnostic(JSON.stringify(out));assert.equal(out.bossDefeated,true);assert.deepEqual(out.areas,[0,1,2,3,4]);assert.equal(out.hp,65);assert.ok(out.parts.every(e=>e.dead));assert.equal(r.run('state'),'result');r.click('mission-select');r.click('select-mission','M05');r.click('deploy');assert.equal(r.run('game.missionId'),'M05');r.run('input.right=true;input.fire=true;input.aimMode="touch";input.touchDx=1;input.touchDy=0;for(let i=0;i<60;i++)update(1/60)');assert.ok(r.run('game.player.x')>100);assert.ok(r.run('game.shots.length')>0);assert.equal(r.run('game.player.hp'),65);isolated(r);
});
test('ordinary enemy projectile still collides/consumes itself and reacts visually in debug2',()=>{
 const r=boot();deploy(r,'M01','WING');r.run('const p=game.player;game.enemyShots.push({x:p.x,y:p.y+16,vx:0,vy:0,life:2,w:4,h:4,damage:99});updateEnemyShots(1/60)');assert.equal(r.run('game.player.hp'),65);assert.equal(r.run('game.enemyShots.length'),0);assert.equal(r.run('game.player.hitPose'),.16);assert.equal(r.run('game.player.invuln'),1);isolated(r);
});
test('debug2 new isolated profile clears/reloads all eight missions with real input/shots and no invuln assignment',t=>{
 let r=boot();for(const id of MISSIONS.filter(m=>m.implemented).map(m=>m.id)){deploy(r,id);assert.equal(r.run('game.player.invuln'),0);const out=drive(r,id);t.diagnostic(JSON.stringify({mission:id,...out}));assert.equal(out.bossDefeated,true,id);if(r.run('state')==='ending')r.click('ending-skip');assert.equal(r.run('state'),'result');assert.equal(r.run('game.player.hp'),100);r.click('mission-select');assert.equal(r.run('state'),'mission');isolated(r);r=boot(JSON.parse(r.storage.get(debugKey)));assert.ok(r.json('save.clearedMissions').includes(id));}
 assert.equal(r.run('save.campaignComplete&&save.firstEndingReached&&save.campaignRewardClaimed'),true);assert.equal(r.run('save.clearedMissions.length'),8);isolated(r);
});
test('debug2 UI is hidden by default and badge is non-interactive; no new LAB/campaign tabs',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.match(html,/id="urlInvincibleBadge"[^>]*hidden>DEBUG 2 \/ INVINCIBLE/);assert.match(html,/id="debug2Setup"[^>]*hidden/);assert.match(css,/\.url-invincible-badge \{[^}]*pointer-events: none/);
});
