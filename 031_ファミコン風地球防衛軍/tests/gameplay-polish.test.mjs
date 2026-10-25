import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,WEAPONS,PLAYER_CLASSES,INVASION} from '../js/data.js';
import {FEEDBACK,IMPACT} from '../js/impact.js';
import {CombatAudio,AUDIO_LIMITS} from '../js/combat-audio.js';
import {B03_COMBAT} from '../js/mission03.js';

const lab=(count=1)=>{const r=runtime(DEFAULT_SAVE,{debug:true});r.click('test-lab');r.change('labCount',String(count));r.click('lab-spawn');r.click('lab-close');return r};
test('real damage classifies HIT / ARMOR / existing weak multiplier / FINISH once, never invents a B01 weak point',()=>{
  const r=lab();r.run("damageEnemy(game.enemies[0],1,{type:'bullet',x:game.enemies[0].x,y:140})");assert.equal(r.run('game.effects[0].category'),'HIT');
  r.run("spawnEnemy('beetle',1800);const armor=game.enemies.at(-1);damageEnemy(armor,8,{type:'bullet'})");assert.equal(r.run('game.effects.at(-1).category'),'ARMOR HIT');assert.equal(r.run('armor.maxHp-armor.hp'),8);
  r.run("spawnEnemy('boss',4400);const b=game.enemies.at(-1);damageEnemy(b,8,{x:b.x,y:b.y+30})");assert.equal(r.run('game.effects.at(-1).category'),'ARMOR HIT');assert.equal(r.run('b.maxHp-b.hp'),8);
  r.click('lab-open');r.click('lab-boss-3');r.run("const e=game.enemies[0],core=coastalWeakCore(e);damageEnemy(e,8,{x:core.x,y:core.y,type:'bullet'})");
  assert.equal(r.run('e.maxHp-e.hp'),12);assert.equal(r.run('game.effects[0].category'),'WEAK POINT');assert.deepEqual(r.json('[game.effects[0].x,game.effects[0].y]'),r.json('[core.x,core.y]'));
  r.run('game.impact.clock+=.1;damageEnemy(e,9999);const score=game.score;damageEnemy(e,9999)');assert.equal(r.run('game.kills'),1);assert.equal(r.run('game.score'),r.run('score'));assert.equal(r.run("game.impact.feedbackCounts.FINISH"),1);
  assert.equal(B03_COMBAT.warning,1.25);assert.equal(B03_COMBAT.waveRecovery,5.25);
});
for(const n of [50,100,200])for(const level of [1,2,3])test(`${n} targets L${level}: bounded hit FX, fragments, shake and exact deaths, no leaked corpses`,()=>{
  const r=lab(n);r.run(`game.lab.settings.destructionLevel=${level};for(const e of game.enemies)damageEnemy(e,9999,{type:'rocket',radial:true,x:game.player.x+150,y:130});sampleCombatResources(game)`);
  assert.equal(r.run('game.kills'),n);assert.equal(r.run('game.liveEnemies'),0);assert.equal(r.run('game.impact.feedbackCounts.FINISH'),n);
  assert.ok(r.run('game.effects.filter(e=>e.kind==="hit").length')<=(n===200?FEEDBACK.reducedStarts:FEEDBACK.maxStarts));assert.ok(r.run('game.effects.length')<=INVASION.maxEffects);
  assert.ok(r.run('game.impact.particles.length')<=(n===200?IMPACT.reducedParticles:IMPACT.maxParticles));assert.ok(r.run('game.shake')<=IMPACT.shakeAbsoluteMax);assert.ok(r.run('game.impact.spent')<=IMPACT.stopBudget);
  r.run('for(let i=0;i<120;i++){advanceImpact(game,1/60);updateEnemies(1/60);updateEffects(1/60)}');assert.equal(r.run('game.impact.corpses'),0);assert.equal(r.run('game.effects.length+game.impact.particles.length'),0);
});
test('repeat hits throttle only feedback, not damage; HUD remains screen-space with both slots, EN and boss HP',()=>{
  const r=lab();r.run("const e=game.enemies[0];e.hp=1000;for(let i=0;i<10;i++)damageEnemy(e,4,{type:'flame'});game.player.classId='WING';game.player.energy=52;assetsReady=true;draw()");assert.equal(r.run('e.hp'),960);assert.equal(r.run('game.effects.filter(f=>f.kind==="hit").length'),1);
  const texts=r.drawCalls.filter(c=>c[0]==='fillText').map(c=>String(c[1]));for(const s of ['WING','EN 52/100','1 A-01','2 S-02'])assert.ok(texts.includes(s),s);
  assert.match(r.run('combatHudText(game,activeEquipment())'),/HP 100\/100.*EN 52\/100.*SLOT1 A-01.*SLOT2 S-02/);
  r.click('lab-open');r.click('lab-boss-3');r.run('assetsReady=true;draw()');assert.ok(r.drawCalls.some(c=>c[0]==='fillText'&&String(c[1]).includes('B-03 CORE OPEN')));
});
test('pointer ownership permits move+jump+fire and two owners on a key; cancel / lost capture / rotation release safely',()=>{
  const r=lab();r.pointer('right','pointerdown',{pointerId:10});r.pointer('right','pointerdown',{pointerId:11});r.pointer('jump','pointerdown',{pointerId:12});r.pointer('aimPad','pointerdown',{pointerId:13});
  assert.deepEqual(r.json('[input.right,input.jump,input.fire]'),[true,true,true]);assert.equal(r.get('right').attributes['aria-pressed'],'true');
  r.pointer('right','pointerup',{pointerId:10});assert.equal(r.run('input.right'),true);r.pointer('right','lostpointercapture',{pointerId:11});assert.equal(r.run('input.right'),false);assert.equal(r.run('input.fire'),true);
  r.pointer('jump','pointercancel',{pointerId:12});assert.equal(r.run('input.jump'),false);r.event('orientationchange');assert.deepEqual(r.json('[input.right,input.jump,input.fire,remoteTimer]'),[false,false,false,null]);assert.equal(r.get('aimPad').attributes['aria-pressed'],'false');
});
test('class-specific touch controls preserve SCOUT dash and WING ascent / HOLD; LAB panel blocks gameplay input',()=>{
  const r=lab();r.click('lab-open');r.change('labPreset','SCOUT');r.click('lab-close');r.pointer('right','pointerdown');r.pointer('special','pointerdown');r.run('update(1/60)');assert.ok(r.run('game.player.dashTime')>0);
  r.click('lab-open');r.change('labPreset','WING');r.pointer('right','pointerdown');assert.equal(r.run('input.right'),false);r.click('lab-close');
  r.pointer('up','pointerdown');r.run('update(1/60)');assert.ok(r.run('game.player.energy')<100);r.pointer('up','pointerup');r.pointer('hover','pointerdown');r.run('const en=game.player.energy;update(.1)');assert.ok(Math.abs(r.run('en-game.player.energy')-.8)<1e-7);assert.equal(r.run('game.player.vy'),0);
});
test('mine long hold works beside movement / FIRE; cancellation and rotation never detonate or switch accidentally',()=>{
  const r=lab();r.run("game.lab.equipped[0]='M-18';shoot()");assert.equal(r.run('mineCount(game)'),1);r.pointer('right','pointerdown',{pointerId:7});r.pointer('aimPad','pointerdown',{pointerId:8});r.pointer('switch','pointerdown',{pointerId:9});r.pointer('switch','pointercancel',{pointerId:9});assert.equal(r.run('mineCount(game)'),1);assert.equal(r.run('game.player.weaponSlot'),0);assert.equal(r.run('input.right&&input.fire'),true);
  r.pointer('switch','pointerdown',{pointerId:9});r.flush();assert.equal(r.run('mineCount(game)'),0);r.pointer('switch','pointerup',{pointerId:9});assert.equal(r.run('game.player.weaponSlot'),0);
  r.run('game.player.shotCd=0;shoot()');r.pointer('switch','pointerdown',{pointerId:9});r.event('orientationchange');r.flush();assert.equal(r.run('mineCount(game)'),1);
});
test('fifth preset selection inert; explicit QA apply uses normal class/HP, starters, no invulnerability, preserves world and save',()=>{
  const r=lab(10),saved=r.storage.get(SAVE_KEY);r.click('lab-open');r.change('labPreset','GUARDIAN');r.run('game.player.hp=5;game.player.x=1100;game.time=12;const before=JSON.stringify(game)');
  r.get('labUIPreset').value='gameplay';r.change('labUIPreset','gameplay');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));r.click('lab-preset-apply');
  assert.deepEqual(r.json('[game.lab.preset,game.player.hp,game.lab.invincible,...game.lab.equipped,game.lab.stageDensity,game.density,game.player.x,game.time,game.liveEnemies]'),['GUARDIAN',200,false,'A-01','S-02','STANDARD','MASSIVE',1100,12,10]);
  r.change('labStageMission','M03');r.change('labStageArea','3');r.click('lab-stage-start');assert.equal(r.run('game.density'),'STANDARD');assert.equal(r.run('game.lab.run.mode'),'B');assert.equal(r.run('game.lab.run.snapshot(game).gameplayQA'),true);assert.equal(r.run('game.lab.run.snapshot(game).coverage'),'CHECKPOINT_ONLY');
  r.run('game.player.invuln=0;hurtPlayer(20,0)');assert.equal(r.run('game.player.hp'),185);r.run("finishLabRun('BOSS_DEFEATED')");assert.equal(r.run('game.lab.run.snapshot(game).normalClearCertified'),false);assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of ['M01','M02','M03'])test(`${id} results reflect actual mission/class/time/kills, existing rewards save once; GAMEOVER retries`,()=>{
  const seed=structuredClone(DEFAULT_SAVE);seed.clearedMissions=['M01','M02'];seed.unlockedMissions=['M01','M02','M03'];seed.selectedClass='GUARDIAN';
  const r=runtime(seed);r.run(`startMission('${id}');game.time=123.4;game.kills=47;game.score=2345;game.area=4;gCrate();completeMission();const stored=localStorage.getItem(SAVE_KEY);completeMission()`);
  assert.equal(r.storage.get(SAVE_KEY),r.run('stored'));assert.match(r.get('resultTitle').textContent,new RegExp(id));assert.match(r.get('resultClass').textContent,/GUARDIAN/);assert.match(r.get('resultStats').innerHTML,/02:03.*47/s);assert.ok(r.run('game.resultSummary.newWeapons.length')>=1);
  assert.equal(r.run('save.clearedMissions.includes(game.missionId)'),true);assert.equal(r.run('canvas.width'),320);r.flush();assert.equal(r.run('state'),'result');r.key('keydown',' ');assert.ok(r.get('screenResult').classes.has('skip-intro'));
  r.run(`startMission('${id}');game.area=2;game.time=45;game.kills=3;game.player.hp=0;update(1/60)`);r.flush();assert.equal(r.run('state'),'gameover');assert.match(r.get('gameoverStats').innerHTML,/AREA 03.*00:45.*3/s);r.click('retry');assert.equal(r.run('state'),'play');assert.equal(r.run('game.time'),0);assert.equal(r.run('game.player.hp'),200);
});
test('first M01 clear lists only newly playable M02, old save layout / unlocks retained, QA never grants reward',()=>{
  const r=runtime({version:1,unlocked:['A-01','S-02','R-04'],equipped:['R-04','A-01']});r.run('startMission();completeMission()');assert.match(r.get('resultUnlock').textContent,/M02/);assert.doesNotMatch(r.get('resultUnlock').textContent,/M04/);assert.equal(r.run("save.unlocked.includes('R-04')"),true);assert.deepEqual(r.json('save.equipped'),['R-04','A-01']);
  const l=lab(),saved=l.storage.get(SAVE_KEY);l.run('gCrate();completeMission()');assert.equal(l.storage.get(SAVE_KEY),saved);
});
function mockAudio(){const oscillators=[];const c={state:'suspended',currentTime:0,destination:{},resume(){this.state='running';return Promise.resolve()},createOscillator(){const o={frequency:{},connect(){},disconnect(){},start(){},stop(){}};oscillators.push(o);return o},createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}};return {c,oscillators}}
test('audio never creates before gesture, resumes suspended context; bounds voices / per-second starts and event bursts',()=>{
  const {c,oscillators}=mockAudio();let created=0;const a=new CombatAudio(()=>{created++;return c});assert.equal(a.play(100,.1,'sine',.02),false);assert.equal(created,0);a.unlock();assert.equal(c.state,'running');
  for(let i=0;i<100;i++)a.play(100,.1,'sine',.02);assert.equal(a.voices.size,AUDIO_LIMITS.voices);assert.equal(a.dropped,92);for(const o of oscillators)o.onended();assert.equal(a.voices.size,0);
  for(let i=0;i<30;i++){if(a.play(100,.1,'sine',.02))oscillators.at(-1).onended()}assert.equal(a.starts,AUDIO_LIMITS.startsPerSecond);
  c.currentTime=1.1;assert.equal(a.play(100,.1,'sine',.02,'weak'),true);oscillators.at(-1).onended();assert.equal(a.play(100,.1,'sine',.02,'weak'),false);c.state='suspended';assert.equal(a.play(100,.1,'sine',.02),false);a.unlock();a.stop();assert.equal(a.voices.size,0);
});
test('unavailable / rejected / failed Web Audio never stops gameplay and removes failed voices',async()=>{
  const a=new CombatAudio(()=>{throw Error('unsupported')});assert.doesNotThrow(()=>a.unlock());assert.equal(a.play(100,.1,'sine',.02),false);
  const {c}=mockAudio();c.resume=()=>Promise.reject(Error('blocked'));const b=new CombatAudio(()=>c);b.unlock();await Promise.resolve();assert.equal(b.status,'blocked');
  c.state='running';c.createOscillator=()=>({frequency:{},connect(){},disconnect(){},start(){throw Error('failed')}});assert.equal(b.play(100,.1,'sine',.02),false);assert.equal(b.voices.size,0);
});
test('normal mute and volume remain persisted; LAB audio/FX metrics and controls remain NO SAVE',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run('sampleCombatResources(game)');const resources=r.json('labExport().resources');assert.deepEqual(resources.current,{effects:0,particles:0,shake:0,voices:0});assert.equal(resources.audio.limit,8);
  r.run('syncLabUI()');assert.match(r.get('labMetrics').textContent,/粒子.*音0\/8/);r.change('settingsVolume','0.4');assert.equal(r.storage.get(SAVE_KEY),saved);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.equal(WEAPONS.length,20);assert.equal(Object.keys(PLAYER_CLASSES).length,4);
});
