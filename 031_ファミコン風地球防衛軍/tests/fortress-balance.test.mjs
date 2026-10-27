import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES} from '../js/data.js';
import {SKY,SKY_PHASES,FORTRESS_GUIDANCE as F,skyPlatformMotion} from '../js/mission04.js';

function setup(phase=1,id='RANGER',wid='A-01',invincible=true,recordDraw=false){
  const r=runtime(structuredClone(DEFAULT_SAVE),{debug:true,recordDraw});r.click('test-lab');
  r.change('labPreset',id);r.change('labValidation',invincible?'C':'B');r.change('labSkyPhase',String(phase));r.click('lab-boss-4');
  r.run("game.player.weaponSlot="+(wid==='A-01'?0:1));return r;
}
for(const phase of [1,2,3])test('Phase '+phase+': full instruction, compact persistent goal, device states and read-only markers',()=>{
  const r=setup(phase);assert.equal(r.run('fortressObjective(game).text'),SKY_PHASES[phase].text);assert.equal(r.run('fortressObjective(game).intro'),true);
  r.run("var stateBefore=JSON.stringify(game);var marks=drawFortressHud(ctx,game,view.zoom)");assert.equal(r.run('JSON.stringify(game)'),r.run('stateBefore'));assert.equal(r.run('marks.targets'),phase===3?1:2);
  r.run("game.time=3");assert.equal(r.run('fortressObjective(game).intro'),false);assert.equal(r.run('fortressObjective(game).text'),SKY_PHASES[phase].text);
  assert.equal(r.run('fortressObjective(game).left'),phase===1?'防御中':phase===2?'攻撃可':'破壊済');
});
test('destroyed targets disappear; protected core reacts SHIELDED, transition clears stale blocked text',()=>{
  const r=setup(1,'RANGER','A-01',true,true);r.run("var b=game.enemies[0];damageEnemy(b,8,{type:'bullet'});drawFortressHud(ctx,game,view.zoom)");assert.ok(r.drawCalls.some(c=>c[0]==='fillText'&&c[1]==='SHIELDED'));assert.equal(r.run('b.hp'),3200);
  r.run("damageEnemy(game.sky.parts[0],999);drawFortressHud(ctx,game,view.zoom)");assert.equal(r.run('fortressObjective(game).targets.length'),1);
  r.run("damageEnemy(game.sky.parts[1],999);updateEnemies(1/60)");assert.equal(r.run('fortressObjective(game).phase'),2);
  r.run("damageEnemy(game.sky.parts[2],999);updateEnemies(1/60)");assert.equal(r.run('fortressObjective(game).left'),'破壊済');assert.equal(r.run('fortressObjective(game).right'),'攻撃可');
  r.run("damageEnemy(b,8);damageEnemy(game.sky.parts[3],999);updateEnemies(1/60)");assert.equal(r.run('b.skyPhase'),3);assert.equal(r.run('b.shieldedUntil'),0);
});
test('off-screen directions use current camera and never alter world coordinates',()=>{
  const r=setup();r.run("var target=game.sky.parts[0],x=target.x;game.camera=x-1000;var right=fortressMarker(target,game,.5);game.camera=x+100;var left=fortressMarker(target,game,.5)");
  assert.equal(r.run('right.direction'),1);assert.equal(r.run('left.direction'),-1);assert.equal(r.run('right.x'),308);assert.equal(r.run('left.x'),12);assert.equal(r.run('target.x'),r.run('x'));
});

for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' / '+wid+': C actual fire destroys every mandatory part and core, not merely a hit',t=>{
  const r=setup(1,id,wid),saved=r.storage.get(SAVE_KEY);
  r.run("input.fire=true;var phases=new Set()");
  for(let batch=0;batch<220&&r.run("game.lab.run.outcome==='RUNNING'");batch++){
    r.run("for(let n=0;n<120&&state==='play';n++){const p=game.player,b=game.enemies.find(e=>e.type==='fortress'&&!e.dead);if(!b){update(1/60);continue}phases.add(b.skyPhase);const target=b.skyPhase===3?b:nearestEnemy(game.sky.parts.filter(e=>!e.dead&&skyTargetOpen(game,e)),p.x,p.y);if(target){input.right=target.x-p.x>75;input.left=target.x-p.x<65;const dx=target.x-p.x-18,dy=target.y+target.h/2-p.y-13,len=Math.hypot(dx,dy)||1;input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len}update(1/60)}");r.flush();
  }
  const report=r.json('game.lab.run.snapshot(game)');assert.equal(report.outcome,'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,phase:game.enemies[0]?.skyPhase})')));assert.deepEqual(r.json('[...phases]'),[1,2,3]);assert.ok(r.run('game.sky.parts.every(e=>e.dead)'));assert.ok(report.weaponDamage[wid]>=3960);assert.equal(r.storage.get(SAVE_KEY),saved);
  assert.equal(report.validationMode,'C');t.diagnostic(id+' '+wid+' C boss '+report.bossDefeatTime.toFixed(2)+'s / HP '+report.remainingHp+' / NOT HUMAN D');
});
for(const id of Object.keys(PLAYER_CLASSES))for(const phase of [1,2,3])test(id+' B: real movement escapes Phase '+phase+' strike after 0.25s reaction, invulnerability OFF',()=>{
  const r=setup(phase,id,'A-01',false);r.run("game.player.x=6650;var before=game.player.hp,b=game.enemies[0];b.actionWait=0;update(1/60);var z={...b.attackPlan.zones[0]};for(let i=0;i<110;i++){input.right=i>=15;update(1/60)}");
  assert.equal(r.run('game.player.hp'),r.run('before'));assert.ok(r.run('game.player.x-z.x>z.w/2+7'));assert.equal(r.run('game.lab.invincible'),false);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' B: low sweep is avoidable by real jump/flight timing',()=>{
  const r=setup(3,id,'A-01',false);r.run("game.player.x=6650;var before=game.player.hp,b=game.enemies[0];b.actionIndex=2;b.actionWait=0;update(1/60);var elevated=false;for(let i=0;i<110;i++){input.jump=i>=60;input.up=game.player.classId==='WING'&&i>=60;update(1/60);if(i===75)elevated=game.player.y+32<136}");
  assert.ok(r.run('elevated'));assert.equal(r.run('game.player.hp'),r.run('before'));
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' B: representative simultaneous strike, E10 dive and E12 artillery remain survivable',t=>{
  const r=setup(3,id,'A-01',false);r.run("game.player.x=6650;var before=game.player.hp,b=game.enemies[0];var gun=spawnEnemy('heavygunner',6850);gun.shotCd=0;var air=spawnEnemy('interceptor',6780,50);air.diveCd=0;b.actionWait=0;var attacks=0;for(let i=0;i<240;i++){input.left=i>=15&&game.player.x>6250;input.right=false;const closeShot=game.enemyShots.some(s=>Math.abs(s.x-game.player.x)<65);input.jump=closeShot&&game.player.onGround;input.up=game.player.classId==='WING'&&closeShot;update(1/60);attacks+=game.sky.hazards.length}");
  assert.ok(r.run('attacks>0'));assert.ok(r.run('game.player.hp>0'));assert.equal(r.run('game.lab.invincible'),false);assert.ok(r.run('Number.isFinite(game.player.x+game.player.y)'));t.diagnostic(id+' B overlap damage '+r.run('before-game.player.hp')+' / 4s scripted sample, not full clear');
});
test('Phase2 real summon plus escape and retry retain ordinary GUARDIAN stats',()=>{
  const r=setup(2,'GUARDIAN','A-01',false);r.run("game.player.x=6650;var b=game.enemies[0];b.actionIndex=1;b.actionWait=0;for(let i=0;i<110;i++){input.left=i>=15;update(1/60)}");
  assert.ok(r.run("game.enemies.some(e=>e.type==='shielddrone'&&!e.dead)"));assert.equal(r.run('game.player.hp'),200);assert.equal(r.run('game.player.maxHp'),200);
  r.click('lab-open');r.click('lab-boss-4');assert.equal(r.run('game.player.hp'),200);assert.equal(r.run('game.sky.guideUntil'),2.5);
});
test('moving-platform direction, turnaround notice and boarding strip do not change movement',()=>{
  const b={baseX:2890,travel:250,speed:44};const m=skyPlatformMotion(b,250/44-.2);assert.equal(m.direction,1);assert.ok(m.turnLeft<F.turnWarning);assert.equal(skyPlatformMotion(b,250/44+.2).direction,-1);
  const r=setup(1,'GUARDIAN','A-01',false);r.click('lab-open');r.click('lab-sky-platforms');r.run("game.director.stopped=true;var deck=game.platforms.find(b=>b.moving);Object.assign(game.player,{x:deck.x+45,y:deck.y-32,onGround:true});hurtPlayer(12,game.player.x+20);for(let i=0;i<150;i++)update(1/60)");
  assert.equal(r.run('game.player.hp'),191);assert.ok(r.run('game.player.onGround'));assert.ok(r.run('Number.isFinite(game.player.x+game.player.y)'));
});
test('rescue avoids an enemy-occupied saved anchor and solid terrain without moving enemies',()=>{
  const r=setup(1,'GUARDIAN','A-01',false);r.click('lab-open');r.click('lab-sky-platforms');r.run("game.director.stopped=true;var e=spawnEnemy('heavygunner',2700);game.sky.safeX=2700;game.sky.safeY=116;Object.assign(game.player,{x:2700,y:220,onGround:false,invuln:0});var ex=e.x;update(1/60)");
  assert.equal(r.run('game.sky.rescues'),1);assert.notEqual(r.run('game.player.x'),2700);assert.equal(r.run('e.x'),r.run('ex'));assert.ok(r.run('Math.abs(game.player.x-e.x)>e.w/2+7'));assert.equal(r.run('game.sky.rescuePending'),false);
  assert.equal(r.run('game.platforms.some(b=>b.active!==false&&game.player.x+7>b.x&&game.player.x-7<b.x+b.w&&game.player.y+32>b.y+.01&&game.player.y<b.y+b.h-.01)'),false);
});
test('E11 support markers and SHIELD HIT follow the actual one-stack 30% rule and release immediately',()=>{
  const r=setup();r.run("clearLabEnemies();game.camera=900;var victim=spawnEnemy('heavygunner',1100),a=spawnEnemy('shielddrone',1110,60),b=spawnEnemy('shielddrone',1120,60);refreshSkyVisuals(game);damageEnemy(victim,10,{type:'bullet'});var marks=drawFortressHud(ctx,game,.5)");
  assert.equal(r.run('victim.hp'),213);assert.equal(r.run("game.impact.feedbackCounts['SHIELD HIT']"),1);assert.ok(r.run('marks.shields')>0);
  r.run("damageEnemy(a,999);damageEnemy(b,999);refreshSkyVisuals(game);var after=drawFortressHud(ctx,game,.5);damageEnemy(victim,10,{type:'bullet'})");assert.equal(r.run('victim.hp'),203);assert.equal(r.run('after.shields'),0);assert.ok(r.run("game.effects.some(f=>f.kind==='skyShieldOff')"));
  r.run("var d=spawnEnemy('shielddrone',1100,50);refreshSkyVisuals(game);d.x=1500;var outside=drawFortressHud(ctx,game,.5)");assert.equal(r.run('outside.shields'),0);
});
for(const count of [50,100,200])test(count+' enemies: source/target/shield marker budgets and effect limits are bounded',()=>{
  const r=setup();r.click('lab-open');r.change('labEnemy','shielddrone');r.change('labCount',String(count));r.click('lab-spawn');r.run("game.camera=1000;for(let i=0;i<game.enemies.length;i++){game.enemies[i].x=1200+i%5;game.enemies[i].y=50}refreshSkyVisuals(game);var marks=drawFortressHud(ctx,game,.5)");
  assert.equal(r.run('game.liveEnemies'),count);assert.ok(r.run('marks.sources')<=F.sourceMarkers);assert.ok(r.run('marks.shields')<=(count===200?F.reducedShieldMarkers:F.shieldMarkers));assert.ok(r.run('game.effects.length')<=80);
});
test('QA shortcuts never restart or save; explicit start uses GUARDIAN, invincible OFF, starters and STANDARD',()=>{
  const r=setup(),saved=r.storage.get(SAVE_KEY);r.click('lab-open');r.run("var before=game.time;var enemy=game.enemies[0]");r.click('lab-fortress-guardian');
  assert.equal(r.run('game.time'),r.run('before'));assert.equal(r.run('game.enemies[0]===enemy'),true);assert.equal(r.run('game.lab.preset'),'GUARDIAN');assert.equal(r.run('game.lab.invincible'),false);assert.deepEqual(r.json('game.lab.equipped'),['A-01','S-02']);
  r.click('lab-boss-4');assert.equal(r.run('game.density'),'STANDARD');assert.equal(r.run('game.enemyLimit'),50);assert.equal(r.run('game.player.hp'),200);assert.equal(r.storage.get(SAVE_KEY),saved);
  r.run("game.enemies[0].shieldedUntil=99;game.sky.shieldSources.push({});game.sky.rescuePending=true");r.click('lab-open');r.click('lab-boss-4');assert.equal(r.run('game.enemies[0].shieldedUntil'),0);assert.equal(r.run('game.sky.shieldSources.length'),0);assert.equal(r.run('game.sky.rescuePending'),false);
});
test('five tabs and weapon picker stay intact; new shortcuts live in an existing collapsed help group',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.match(html,/lab-fortress-guardian/);assert.match(html,/id="labWeaponPicker"/);
});
