import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,PLAYER_CLASSES,WEAPONS,MISSIONS,sanitizeSave,canPlayMission,missionStatus} from '../js/data.js';
import {M06,LIVING} from '../js/mission06.js';
import {LIVING_FILES,loadLivingArt} from '../js/living-art.js';
const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01','M02','M03','M04','M05']});
const lab=()=>{const r=runtime(seed(),{debug:true,recordDraw:false});r.click('test-lab');r.change('labStageMission','M06');return r};
function start(r,area=0,mode='C',id='RANGER'){if(r.run('state')==='play')r.click('lab-open');r.change('labPreset',id);r.change('labValidation',mode);r.change('labStageArea',String(area));r.click('lab-stage-start')}
// Input-only route controller. It never writes player coordinates, enemy HP,
// gate state, cooldowns, energy or progression after the chosen start.
export const livingRoute=`const p=game.player;input.right=true;input.left=false;input.jump=false;input.up=false;input.hover=false;input.special=false;
const obstacle=game.platforms.some(b=>b.active!==false&&!b.gate&&b.kind==='biorib'&&p.x+35>=b.x&&p.x-7<b.x+b.w&&p.y+32>b.y+.5);
input.jump=p.onGround&&obstacle;input.up=p.classId==='WING'&&obstacle;
const b=game.enemies.find(e=>e.type==='neuralheart'&&!e.dead),m=game.living;
let target=null;
if(b){target=b.shielded?nearestEnemy(m.nodes.filter(n=>n.stoppedUntil<=game.time),p.x,p.y):b;
 if(target){const desired=target.x-70;input.right=p.x<desired-3;input.left=p.x>desired+3;input.jump=input.up=false}}
else if(m.shell&&!m.shell.dead&&Math.abs(m.shell.x-p.x)<300){target=m.shell;input.right=p.x<target.x-70}
else if(p.x>5400&&p.x<5820&&m.networkState!=='DISABLED'){target=m.nodes.find(n=>n.partKind==='network');input.right=p.x<target.x-70}
else target=nearestEnemy(game.enemies.filter(e=>!e.fixedDevice),p.x,p.y,200);
const point=target?{x:target.x,y:target.y+target.h/2}:{x:p.x+200,y:p.y+13},dx=point.x-p.x-18,dy=point.y-p.y-13,len=Math.hypot(dx,dy)||1;
input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;input.fire=true;`;

test('legacy M05 clear unlocks M06 with old records intact; M07 cannot run; death retry is monotonic',()=>{
 const s=sanitizeSave({...seed(),version:1,unlocked:['A-01','S-02','R-04'],selectedClass:'GUARDIAN',missionStats:{M05:{highScore:555,bestTime:250,kills:34}}});assert.ok(canPlayMission('M06',s));assert.equal(missionStatus(MISSIONS.find(m=>m.id==='M08'),s),'COMING SOON');assert.equal(s.missionStats.M05.kills,34);
 const r=runtime(s);r.run("startMission('M06');game.player.hp=0;update(1/60)");r.flush();const before=r.storage.get(SAVE_KEY);r.click('retry');assert.equal(r.run('game.missionId'),'M06');assert.deepEqual(JSON.parse(r.storage.get(SAVE_KEY)).unlockedMissions,JSON.parse(before).unlockedMissions);assert.deepEqual(JSON.parse(r.storage.get(SAVE_KEY)).clearedMissions,JSON.parse(before).clearedMissions);assert.equal(r.run("startMission('M07')"),false);
});
for(let area=0;area<5;area++)test('M06 AREA '+(area+1)+' explicit restore and repeated initialization',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);for(let n=0;n<2;n++){start(r,area);assert.equal(r.run('game.area'),area);assert.equal(r.run('game.missionId'),'M06');assert.equal(r.run('game.living.nodes.length'),1);assert.equal(r.run('game.shots.length+game.enemyShots.length+game.arsenal.jobs.length'),0);assert.equal(r.run('game.living.shell.dead'),area>0);assert.equal(r.run('game.living.networkState'),area>=4?'DISABLED':'ACTIVE')}
 assert.equal(r.storage.get(SAVE_KEY),saved);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' A real movement and mandatory shooting reaches boss entrance without warp',t=>{
 const r=lab();start(r,0,'A',id);r.run('var visited=new Set()');r.run("for(let i=0;i<30000&&state==='play';i++){"+livingRoute+"visited.add(game.area);update(1/60)}");assert.equal(r.run('game.lab.run.outcome'),'TERRAIN_REACHED',JSON.stringify(r.json('({x:game.player.x,y:game.player.y,time:game.time,shell:game.living.shell.hp,network:game.living.networkState})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.ok(!r.json('game.lab.run.warnings').some(w=>w.code==='TERRAIN_INTRUSION'));t.diagnostic(id+' A '+r.run('game.time').toFixed(2)+'s, not combat clear');
});
test('pulse phases match collider, occupied closure delays, closed blocks swept SCOUT and reopens',()=>{
 const r=lab();start(r,1,'A','SCOUT');r.run("var wall=game.platforms.find(p=>p.gate==='pulse-1'),pulse=game.living.pulses[0];var states=[];for(const t of [0,4.1,5.1,7.1,7.6]){pulse.elapsed=t;updateLivingTerrain(game,0);states.push([pulse.state,wall.active])}");assert.deepEqual(r.json('states'),[['OPEN',false],['WARNING',false],['CLOSED',true],['REOPEN',false],['OPEN',false]]);
 r.run("game.player.x=1812;game.player.y=116;pulse.elapsed=5.1;updateLivingTerrain(game,0)");assert.equal(r.run('wall.active'),false);assert.equal(r.run('pulse.delayed'),true);
 r.run("game.player.x=1770;updateLivingTerrain(game,0);input.right=true;input.special=true;moveClassPlayer(game.player,input,game.platforms,.2)");assert.ok(r.run('game.player.x+7<=wall.x'));r.run('pulse.elapsed=7.1;updateLivingTerrain(game,0);for(let i=0;i<30;i++)moveClassPlayer(game.player,input,game.platforms,1/60)');assert.ok(r.run('game.player.x>1824'));
 assert.ok((24+14)/PLAYER_CLASSES.GUARDIAN.speed+.25<LIVING.pulseWarning);
});
test('flow uses swept environmental displacement, Guardian advances against reverse; no input/collision instability; WING above fluid unaffected',()=>{
 const r=lab();start(r,2,'A','GUARDIAN');r.run("game.player.x=3800;input.right=true;for(let i=0;i<60;i++)update(1/60)");assert.ok(Math.abs(r.run('game.player.x')-3841)<.1);
 r.run('input.right=false;var old=game.player.x;for(let i=0;i<60;i++)update(1/60)');assert.ok(Math.abs(r.run('game.player.x-old')+24)<.1);
 r.run('game.living.flowOverride={force:0,active:false};old=game.player.x;for(let i=0;i<60;i++)update(1/60)');assert.equal(r.run('game.player.x'),r.run('old'));
 r.run("applyPlayerClass(game.player,'WING');game.player.x=3800;game.player.y=50;game.player.onGround=false;input.hover=true;old=game.player.x;for(let i=0;i<60;i++)update(1/60)");assert.equal(r.run('game.player.x'),r.run('old'));assert.ok(Math.abs(r.run('game.player.energy')-92)<1e-6);assert.ok(r.run('game.player.y>=28'));
 r.run('game.player.y=220;recoverLivingPlayer(game,1/60,hurtPlayer,pushEffect)');assert.ok(r.run('game.player.y<150'));
});
test('repeatable network hit, bounded signal, sequential propagation, timed shutdown and restart without death/score',()=>{
 const r=lab();start(r,3);r.run("var n=game.living.nodes[0],s=game.score;for(let i=0;i<100;i++)damageEnemy(n,999,{type:'flame'});var gate=game.platforms.find(p=>p.gate==='network')");assert.equal(r.run('n.dead'),false);assert.equal(r.run('n.hp'),1);assert.equal(r.run('game.score'),r.run('s'));assert.equal(r.run('game.living.signals.length'),1);
 r.run('for(let i=0;i<20;i++)update(1/60)');assert.ok(r.run('game.living.signals[0].progress>0'));assert.equal(r.run('gate.active'),true);r.run('for(let i=0;i<20;i++)update(1/60)');assert.equal(r.run('gate.active'),false);r.run('for(let i=0;i<530;i++)update(1/60)');assert.equal(r.run('gate.active'),true);r.run('damageEnemy(n,1);for(let i=0;i<40;i++)update(1/60)');assert.equal(r.run('gate.active'),false);assert.equal(r.run('game.kills'),0);
});
for(const state of ['SHIELDED','LEFT','RIGHT','OPEN','HP65','HP30'])test('B06 '+state+' full state restart and camera/save isolation',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labLivingState',state);for(let n=0;n<2;n++){r.click('lab-boss-6');assert.equal(r.run('game.living.nodes.length'),2);assert.equal(r.run('game.enemies.length'),3);assert.equal(r.run('game.liveEnemies'),1);assert.equal(r.run('game.shots.length+game.enemyShots.length+game.arsenal.jobs.length+game.living.hazards.length'),0);assert.equal(r.run('game.battleCamera.mode'),'boss');assert.equal(r.run('game.enemies[0].hpPhase'),state==='HP65'?2:state==='HP30'?3:1);assert.equal(r.run('game.enemies[0].shielded'),state!=='OPEN');r.run('game.arsenal.jobs.push({});game.enemyShots.push({});game.living.hazards.push({})');r.click('lab-open')};assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('B06 repeatable node cycle, expired single stop, reconnection grace and shield blocks every damage source',()=>{
 const r=lab();r.click('lab-boss-6');r.run("var b=game.enemies[0],l=game.living.nodes[0],rr=game.living.nodes[1];for(const w of WEAPONS)damageEnemy(b,999,{type:w.type,weapon:w});damageEnemy(l,1);for(let i=0;i<370;i++)update(1/60);damageEnemy(rr,1)");assert.equal(r.run('b.hp'),3800);assert.equal(r.run('b.shielded'),true);r.run('damageEnemy(l,1)');assert.equal(r.run('b.shielded'),false);r.run('damageEnemy(b,1400);for(let i=0;i<490;i++)update(1/60)');assert.equal(r.run('b.hpPhase'),2);assert.equal(r.run('b.shielded'),true);r.run('damageEnemy(l,1);damageEnemy(rr,1)');assert.equal(r.run('b.shielded'),true);r.run('for(let i=0;i<60;i++)update(1/60);damageEnemy(l,1);damageEnemy(rr,1);damageEnemy(b,1300);update(1/60)');assert.equal(r.run('b.shielded'),false);assert.equal(r.run('b.hpPhase'),3);assert.equal(r.run('game.kills'),0);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' '+wid+' actual shots repeatedly stop nodes, damage and destroy B06',t=>{
 const r=lab();r.change('labPreset',id);r.change('labWeapon1',wid);r.click('lab-boss-6');for(let batch=0;batch<400&&r.run("game.lab.run.outcome==='RUNNING'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+livingRoute+"update(1/60)}");r.flush()}
 assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,time:game.time,nodes:game.living.nodes.map(n=>n.stoppedUntil),events:game.living.events})')));t.diagnostic(id+' '+wid+' C boss '+r.run('game.time').toFixed(2)+'s (immunity QA)');
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' C complete M06 through-QA with real movement/fire, no post-start warp',t=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);start(r,0,'C',id);r.run('var visited=new Set()');for(let batch=0;batch<500&&r.run("game.lab.run.outcome==='RUNNING'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+livingRoute+"visited.add(game.area);update(1/60)}");r.flush()}
 assert.equal(r.run('game.lab.run.outcome'),'BOSS_DEFEATED',JSON.stringify(r.json('({x:game.player.x,hp:game.enemies[0]?.hp,time:game.time})')));assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);assert.equal(r.storage.get(SAVE_KEY),saved);t.diagnostic(id+' full C '+r.run('game.time').toFixed(2)+'s, not human normal clear');
});
test('normal engine full M06 through-QA plus result and once-only rewards, immunity aid not D',t=>{
 const r=runtime(seed(),{recordDraw:false});r.run("startMission('M06');game.player.invuln=2000;var visited=new Set()");for(let batch=0;batch<600&&r.run("state!=='result'");batch++){r.run("for(let i=0;i<120&&state==='play';i++){"+livingRoute+"visited.add(game.area);update(1/60)}");r.flush();r.flush()}
 assert.equal(r.run('state'),'result');assert.deepEqual(r.json('[...visited]'),[0,1,2,3,4]);const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(saved.clearedMissions.includes('M06'));assert.ok(saved.unlockedMissions.includes('M07'));assert.equal(canPlayMission('M07',saved),true);assert.ok(saved.missionStats.M06.kills>0);assert.ok(saved.missionStats.M06.bestTime>0);assert.equal(sanitizeSave(saved).missionStats.M06.kills,saved.missionStats.M06.kills);r.run('completeMission()');assert.equal(r.storage.get(SAVE_KEY),JSON.stringify(saved));t.diagnostic('normal engine + immunity '+r.run('game.time').toFixed(2)+'s');
});
test('E16 pulse-linked warning/dash/recovery, E17 warned spores/ground-shootable flight, E18 warned melee and armor feedback',()=>{
 const r=lab();start(r,1);r.run("clearLabEnemies();game.player.x=1800;var e=spawnEnemy('pulseworm',1880);game.living.pulses[0].state='WARNING';updateEnemies(1/60)");assert.ok(r.run('e.warningLeft>0'));r.run('for(let i=0;i<80;i++){game.time+=1/60;updateEnemies(1/60)}');assert.ok(r.run('e.recoverLeft>0'));
 r.run("clearLabEnemies();game.player.x=1000;e=spawnEnemy('sporefly',1150,60);e.shotCd=0;for(let i=0;i<100;i++){game.time+=1/60;updateEnemies(1/60)}");assert.ok(r.run('game.enemyShots.length>0'));assert.ok(r.run('e.y>=32&&e.y<=105'));
 r.run("clearLabEnemies();e=spawnEnemy('guardiancell',1050);updateEnemies(1/60)");assert.ok(r.run('e.warningLeft>0'));r.run('for(let i=0;i<68;i++){game.time+=1/60;updateEnemies(1/60)}');assert.ok(r.run('e.recoverLeft>0'));assert.ok(r.run('game.living.hazards.length>0'));
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' B06 actual dodge after .25s reaction, serialized shared warning/strike geometry',()=>{
 const r=lab();r.change('labPreset',id);r.change('labValidation','B');r.click('lab-boss-6');r.run("game.player.x=7420;var b=game.enemies[0],hp=game.player.hp;b.actionWait=0;for(let i=0;i<125;i++){input.left=i>=15;update(1/60)}");assert.equal(r.run('game.player.hp'),r.run('hp'));assert.equal(r.run('game.lab.invincible'),false);assert.ok(r.run('game.living.hazards.length<=LIVING.hazardLimit'));
});
for(const [mode,cap] of [['LIGHT',30],['STANDARD',50],['MASSIVE',100]])test('M06 '+mode+' shared cap excludes repeatable fixtures',()=>{
 const r=lab();r.change('labStageDensity',mode);start(r);r.run("for(let i=0;i<210;i++)spawnEnemy('sporefly',1000+i,60)");assert.equal(r.run('game.liveEnemies'),cap);assert.equal(r.run('game.enemies.filter(e=>e.fixedDevice&&!e.dead).length'),2);
});
for(const count of [50,100,200])test(count+' enemies and all20 weapons use bounded effects/arrays without omitting damage',()=>{
 const r=lab();r.change('labEnemy','pulseworm');r.change('labCount',String(count));r.click('lab-spawn');assert.equal(r.run('game.liveEnemies'),count);for(const w of WEAPONS){r.run("game.lab.equipped[0]='"+w.id+"';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=-.1;shoot();for(let i=0;i<30;i++){updateShots(1/60);updateExpanded(game,1/60,weaponAPI)}clearArsenal(game);game.shots.length=0");assert.ok(r.run('game.enemyShots.length')<=LIVING.shotLimit)}
 r.run("for(const e of game.enemies){e.x=1300;e.y=124}game.grid.rebuild(game.enemies);explode({x:1300,y:136,radius:48,damage:999,type:'rocket'})");assert.equal(r.run('game.kills'),count);assert.ok(r.run('game.effects.length')<=80);assert.ok(r.run('game.impact.particles.length')<=96);
});
for(const id of Object.keys(PLAYER_CLASSES))for(const wid of ['A-01','S-02'])test(id+' '+wid+' actual pre-boss shell destruction and repeatable network trigger',()=>{
 const r=lab();start(r,0,'C',id);r.run("game.lab.equipped[0]='"+wid+"';game.player.x=825;var shell=game.living.shell;for(let i=0;i<1200&&!shell.dead;i++){const dx=shell.x-game.player.x-18,dy=shell.y+shell.h/2-game.player.y-13,len=Math.hypot(dx,dy);input.aimMode='touch';input.touchDx=dx/len;input.touchDy=dy/len;game.player.shotCd=Math.max(0,game.player.shotCd-1/60);game.grid.rebuild(game.enemies);shoot();updateShots(1/60)}");assert.equal(r.run('shell.dead'),true);assert.equal(r.run("game.platforms.find(p=>p.gate==='shell').active"),false);
 r.run("game.player.x=5500;game.player.y=116;game.player.shotCd=0;var n=game.living.nodes[0];for(let i=0;i<120&&!game.living.signals.length;i++){const dx=n.x-game.player.x-18,dy=n.y+14-game.player.y-13,len=Math.hypot(dx,dy);input.touchDx=dx/len;input.touchDy=dy/len;game.player.shotCd=Math.max(0,game.player.shotCd-1/60);game.grid.rebuild(game.enemies);shoot();updateShots(1/60)}");assert.equal(r.run('game.living.signals.length'),1);assert.equal(r.run('n.dead'),false);assert.equal(r.run('game.kills'),0);
});
for(const id of Object.keys(PLAYER_CLASSES))test(id+' all20 weapons fire using existing performance data on living terrain',()=>{
 const r=lab();start(r,4,'C',id);for(const w of WEAPONS){r.run("game.lab.equipped[0]='"+w.id+"';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=-.1;shoot();for(let i=0;i<30;i++){updateShots(1/60);updateExpanded(game,1/60,weaponAPI)}clearArsenal(game);game.shots.length=0");assert.equal(r.run('game.player.maxHp'),PLAYER_CLASSES[id].hp)}
});
test('new melee warnings reserve the existing simultaneous-attack budget even at 200 enemies',()=>{
 const r=lab();r.change('labEnemy','guardiancell');r.change('labCount','200');r.click('lab-spawn');r.run("game.player.x=1000;for(const e of game.enemies)e.x=1040;var peak=0;for(let i=0;i<180;i++){game.time+=1/60;updateEnemies(1/60);updateLivingState(game,1/60,hurtPlayer,pushEffect);peak=Math.max(peak,game.enemies.filter(e=>e.warningLeft>0||e.dashLeft>0).length)}");assert.ok(r.run('peak')<=r.run('INVASION.simultaneousDives'));assert.equal(r.run('game.liveEnemies'),200);assert.ok(r.run('game.living.hazards.length')<=LIVING.hazardLimit);
});
test('WING real ascent respects ceiling and closed pulse walls; EN depletion falls to safe floor',()=>{
 const r=lab();start(r,1,'A','WING');r.run("game.player.x=1765;game.living.pulseOverride='CLOSED';input.up=true;input.right=true;for(let i=0;i<240;i++)update(1/60)");assert.ok(r.run('game.player.x+7<=1800'));assert.ok(r.run('game.player.y>=28'));r.run('input.right=false;for(let i=0;i<240;i++)update(1/60)');assert.ok(r.run('game.player.y>=28&&game.player.y<=116'));assert.ok(r.run('game.player.energy>=0'));assert.ok(!r.json('game.lab.run.warnings').some(w=>w.code==='TERRAIN_INTRUSION'));
});
test('free LAB terrain/clear never leaves an orphan locked network gate; flow actions remain transient',()=>{
 const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labTerrain','M06');r.click('lab-terrain-apply');r.click('lab-close');r.run('for(let i=0;i<600;i++)update(1/60)');assert.equal(r.run("game.platforms.find(p=>p.gate==='network').active"),false);r.click('lab-open');r.click('lab-living-flow');r.click('lab-open');r.change('labLivingFlow','-40');r.click('lab-living-flow-apply');assert.equal(r.run('game.living.flowOverride.force'),-40);r.click('lab-living-flow-stop');assert.equal(r.run('game.living.flowOverride.active'),false);assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('HP phase and shield visuals are independent; pulse warning uses exact collider rectangle',()=>{
 const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='old:'+k);startMission('M06');game.player.x=7080;startBoss();var b=game.enemies[0];b.hp=1000;update(1/60);var before=JSON.stringify(game);draw()");assert.equal(r.run('b.hpPhase'),3);assert.equal(r.run('b.shielded'),true);assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
 const l=lab();start(l,1);assert.deepEqual(l.json('game.living.pulses.map(p=>[p.x,p.y,p.w,p.h])'),l.json("game.platforms.filter(p=>p.kind==='pulse').map(p=>[p.x,p.y,p.w,p.h])"));
});
test('new asset dimensions/fallback, pure renderer, five tabs, M01-M05 basic progression preserved',async()=>{
 const catalog=JSON.parse(readFileSync(new URL('../assets/living-colossus-01/catalog.json',import.meta.url)));for(const [key,[path,w,h]] of Object.entries(LIVING_FILES))assert.deepEqual(catalog.assets.find(a=>a.path===path)?.size,[w,h],key);assert.ok(Object.values(await loadLivingArt(async()=>{throw Error('missing')})).every(v=>v===null));
 const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='old:'+k);startMission('M06');var before=JSON.stringify(game);draw()");assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.ok(r.drawCalls.every(c=>c.slice(1).every(v=>typeof v!=='number'||Number.isFinite(v))));
 const ui=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(ui,/<option value="50">通常敵50体/);assert.doesNotMatch(ui,/<\/option\s+value=/);
 for(const id of ['M01','M02','M03','M04','M05']){r.run("startMission('"+id+"');update(1/60)");assert.equal(r.run('game.missionId'),id);assert.equal(r.run('game.area'),0)}const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="labTab-/g)||[]).length,5);assert.match(html,/labLivingState/);
});
