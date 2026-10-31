import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_SAVE,WEAPONS,MISSIONS,SAVE_KEY,sanitizeSave} from '../js/data.js';
import {ACHIEVEMENTS,ACHIEVEMENT_BY_ID,CHALLENGE_WEAPONS,CHALLENGE_MISSIONS} from '../js/achievement-master.js';
import {ChallengeRun,AchievementNotices,achievementProgress,achievementSummary,reconcileAchievements,selectAchievementTitle,recommendAchievements} from '../js/challenges.js';
import {runtime} from './helpers/runtime.mjs';
const fresh=()=>sanitizeSave(structuredClone(DEFAULT_SAVE));
const p=id=>ACHIEVEMENT_BY_ID.get(id);
const unlocked=(s,id)=>Object.hasOwn(s.achievements.unlocked,id);
const seed=()=>({...fresh(),clearedMissions:['M01','M02','M03','M04','M05'],unlocked:WEAPONS.map(w=>w.id)});
const normal=(id='M01',classId='RANGER')=>{const s=seed();s.selectedClass=classId;const r=runtime(s,{recordDraw:false});r.run(`startMission('${id}')`);return r};
const save=r=>r.json('save');
const fire=(r,id)=>r.run(`save.equipped[0]='${id}';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;shoot()`);
const clear=r=>{r.run('completeMission()');r.flush()};

test('30 stable master IDs, six categories and fixed 0.8 targets with complete metadata',()=>{
 assert.equal(ACHIEVEMENTS.length,30);assert.equal(new Set(ACHIEVEMENTS.map(a=>a.id)).size,30);assert.equal(CHALLENGE_WEAPONS.length,20);assert.equal(CHALLENGE_MISSIONS.length,6);
 assert.deepEqual(['C','K','W','B','S','T'].map(c=>ACHIEVEMENTS.filter(a=>a.category===c).length),[6,5,6,5,5,3]);
 for(const a of ACHIEVEMENTS){assert.ok(a.name&&a.description&&a.condition&&a.badge&&a.method);assert.ok(a.target>0&&a.difficulty>=1&&a.difficulty<=5);assert.ok(['save','stats','new'].includes(a.past));assert.ok(Object.isFrozen(a))}
});
test('legacy campaign/collection restore silently, never invent specials, classes, streaks or 0.8 kills',()=>{
 const s={version:1,cleared:['M01','M02','M03','M04','M05','M06'],unlocked:CHALLENGE_WEAPONS,highScore:4000,bestTime:60,missionStats:{M06:{highScore:3000,bestTime:60,kills:1100}}};
 const r=runtime(s,{recordDraw:false}),out=save(r);assert.equal(achievementSummary(out).done,10);for(const id of ['ACH-C01','ACH-C06','ACH-W03','ACH-B01'])assert.ok(unlocked(out,id));
 for(const id of ['ACH-K01','ACH-W04','ACH-S03','ACH-T01','ACH-T02','ACH-T03','ACH-B05'])assert.equal(unlocked(out,id),false);
 assert.equal(out.achievements.totals.kills,0);assert.equal(r.run('achievementNotices.queue.length'),0);assert.equal(out.highScore,4000);assert.equal(out.missionStats.M06.kills,1100);
});
test('only accurate 0.7 class clears and unlocked weapon uses restore eligible achievements',()=>{
 const s=seed();for(const id of ['RANGER','SCOUT','GUARDIAN','WING'])s.campaignStats.classes[id]={sorties:1,clears:1,gameOvers:0,kills:4,playSeconds:10,missions:{}};
 for(const id of CHALLENGE_WEAPONS)s.campaignStats.weapons[id]={equipped:1,uses:1};const out=sanitizeSave(s);reconcileAchievements(out,1000);
 for(const a of ACHIEVEMENTS.filter(a=>a.category==='K'||a.category==='W'))assert.ok(unlocked(out,a.id));assert.ok(unlocked(out,'ACH-B01'));assert.equal(out.achievements.totals.kills,0);
 const locked=fresh();locked.campaignStats.weapons['L-03']={uses:100};assert.equal(achievementProgress(p('ACH-W04'),locked),0);assert.equal(achievementProgress(p('ACH-K01'),locked),null);
});
test('fixed all-six/all-twenty conditions never expand when future IDs appear',()=>{
 const s=seed();s.clearedMissions.push('M06');s.unlocked.push('Z-21');reconcileAchievements(s,1000);assert.ok(unlocked(s,'ACH-C06'));assert.ok(unlocked(s,'ACH-W03'));assert.equal(achievementProgress(p('ACH-W03'),s),20);assert.equal(achievementSummary(s).total,ACHIEVEMENTS.filter(a=>a.implemented).length);
});

test('M06 alone is not all-six completion; cosmetics never add weapons or mission rewards',()=>{
 const s=fresh();s.clearedMissions=['M06'];reconcileAchievements(s);assert.equal(achievementProgress(p('ACH-C06'),s),1);assert.equal(unlocked(s,'ACH-C06'),false);
 const r=runtime(null,{recordDraw:false});r.run("startMission('M01');shoot();completeMission()");r.flush();const out=save(r);assert.deepEqual(out.unlocked,['A-01','S-02','L-03']);assert.deepEqual(out.clearedMissions,['M01']);assert.ok(out.unlockedMissions.includes('M02'));assert.ok(unlocked(out,'ACH-S01'));assert.ok(unlocked(out,'ACH-C01'));
});

test('device orders and exposure progress are not committed by defeat or abandonment',()=>{
 const s=fresh(),m=new ChallengeRun(s,'M05','RANGER',100);m.special('mobile-device','left',{});m.special('mobile-device','right',{});m.finish(s,'GAME_OVER',{hp:0,maxHp:100});assert.deepEqual(s.achievements.b05Orders,[]);
 const l=new ChallengeRun(s,'M06','RANGER',100);for(let i=0;i<3;i++)l.special('core-open');l.finish(s,'ABANDONED',{hp:100,maxHp:100});reconcileAchievements(s);assert.equal(s.achievements.coreExposures,null);assert.equal(unlocked(s,'ACH-T02'),false);
});
test('unknown, recorded zero and not completed remain distinct; progress never needs fake legacy values',()=>{
 const s=fresh();assert.equal(achievementProgress(p('ACH-B05'),s),null);assert.equal(achievementProgress(p('ACH-T02'),s),null);const run=new ChallengeRun(s,'M01','RANGER',100);assert.equal(achievementProgress(p('ACH-B05'),s),0);run.use(s,'A-01');run.finish(s,'CLEAR',{hp:100,maxHp:100});reconcileAchievements(s);assert.equal(achievementProgress(p('ACH-S05'),s),0);assert.equal(achievementProgress(p('ACH-S01'),s),1);
});
for(const id of ['RANGER','SCOUT','GUARDIAN','WING'])test(id+' clear reuses existing exact class stats with one outcome only',()=>{
 const r=normal('M01',id);clear(r);r.run('completeMission();finishCampaign("CLEAR")');assert.ok(unlocked(save(r),'ACH-K0'+(['RANGER','SCOUT','GUARDIAN','WING'].indexOf(id)+1)));assert.equal(save(r).campaignStats.classes[id].clears,1);assert.equal(r.run("achievementNotices.queue.filter(x=>x==='ACH-S03').length"),1);
});
test('equipped-only does not count use; real accepted uses, capacity failures and mine detonation',()=>{
 const r=normal();assert.equal(achievementProgress(p('ACH-W04'),save(r)),0);
 for(const id of ['A-01','S-02','L-03','R-04','H-08'])fire(r,id);assert.ok(unlocked(save(r),'ACH-W04'));assert.equal(r.run('game.campaignRun.challenge.usedWeaponIds.size'),5);
 fire(r,'M-18');r.key('keydown','v');assert.ok(r.run("game.campaignRun.challenge.usedWeaponIds.has('M-18')"));assert.equal(save(r).campaignStats.weapons['M-18'].detonations,1);
});
test('30 and 100 kill sortie achievements share confirmed kill events, never parts or repeated deaths',()=>{
 const r=normal();r.run("for(let i=0;i<100;i++){var e=spawnEnemy('crawler',180);damageEnemy(e,999,{weaponId:'A-01'});damageEnemy(e,999,{weaponId:'A-01'});game.enemies.length=0}refreshAchievements()");
 for(const id of ['ACH-B01','ACH-B02','ACH-B03','ACH-B04'])assert.ok(unlocked(save(r),id));assert.equal(save(r).achievements.totals.kills,100);assert.equal(save(r).campaignStats.classes.RANGER.kills,100);
 const d=normal('M06');d.run("damageEnemy(game.living.shell,999,{weaponId:'A-01'});damageEnemy(game.living.nodes[0],999,{weaponId:'A-01'})");assert.equal(save(d).achievements.totals.kills,0);
});
test('1000 new kills start at zero regardless of old totals and are cumulative across sorties',()=>{
 const s=fresh();s.campaignStats.classes.RANGER={kills:4000};let r=new ChallengeRun(s,'M01','RANGER',100);for(let i=0;i<600;i++)r.kill(s);r.finish(s,'GAME_OVER',{});r=new ChallengeRun(s,'M01','RANGER',100);for(let i=0;i<399;i++)r.kill(s);reconcileAchievements(s);assert.equal(unlocked(s,'ACH-B05'),false);r.kill(s);reconcileAchievements(s);assert.ok(unlocked(s,'ACH-B05'));assert.equal(s.achievements.totals.kills,1000);
});
test('streak interval includes exactly five seconds, breaks above it and ends at sortie exit',()=>{
 const s=fresh(),r=new ChallengeRun(s,'M01','RANGER',100);r.kill(s);r.time(5);r.kill(s);assert.equal(r.streak,2);r.time(5.001);r.kill(s);assert.equal(r.streak,1);r.finish(s,'ABANDONED',{});assert.equal(r.streak,0);assert.equal(r.lastKillActiveTime,null);r.kill(s);assert.equal(s.achievements.totals.kills,3);
});
test('pause/hidden/focus interruption do not add challenge active time or expire streak',()=>{
 const r=normal();r.run("var e=spawnEnemy('crawler',180);damageEnemy(e,999,{weaponId:'A-01'});pause('QA');for(let i=0;i<600;i++)update(1/60);resume();document.hidden=true;for(let i=0;i<600;i++)update(1/60);document.hidden=false;var e=spawnEnemy('crawler',180);damageEnemy(e,999,{weaponId:'A-01'})");assert.equal(r.run('game.campaignRun.challenge.streak'),2);assert.equal(r.run('game.campaignRun.challenge.activeTime'),0);
});
test('starter-only is based on actual use, not switched/equipped slots; zero use is not sufficient',()=>{
 let r=normal();r.run("save.equipped=['R-04','A-01'];game.player.weaponSlot=1;shoot()");clear(r);assert.ok(unlocked(save(r),'ACH-S01'));
 r=normal();fire(r,'A-01');fire(r,'R-04');clear(r);assert.equal(unlocked(save(r),'ACH-S01'),false);
 r=normal();clear(r);assert.equal(unlocked(save(r),'ACH-S01'),false);
});
for(const mid of ['M03','M04','M05','M06'])test(mid+' actual starter use then clear qualifies S02 without balance changes',()=>{
 const r=normal(mid);fire(r,'S-02');clear(r);assert.ok(unlocked(save(r),'ACH-S02'));
});
test('one-weapon M02 includes mine use and ignores weapon slot switching',()=>{
 const r=normal('M02');fire(r,'M-18');r.run('useRemoteMines();game.player.weaponSlot=1');clear(r);assert.ok(unlocked(save(r),'ACH-S04'));
 const other=normal('M02');fire(other,'A-01');fire(other,'S-02');clear(other);assert.equal(unlocked(save(other),'ACH-S04'),false);
});
test('actual HP loss survives healing; invulnerable hits and zero damage do not disqualify no-damage',()=>{
 let r=normal();r.run('game.player.invuln=1;hurtPlayer(30,1)');clear(r);assert.ok(unlocked(save(r),'ACH-S03'));
 r=normal();r.run('game.player.invuln=0;hurtPlayer(30,1);game.player.hp=game.player.maxHp');clear(r);assert.equal(unlocked(save(r),'ACH-S03'),false);assert.equal(r.run('game.campaignRun.challenge.damageTaken'),30);
 const guardian=normal('M01','GUARDIAN');guardian.run('game.player.invuln=0;hurtPlayer(20,1)');assert.equal(guardian.run('game.campaignRun.challenge.damageTaken'),15);
});
test('low HP uses class maximum: inclusive 25 percent and strictly positive remaining HP',()=>{
 let r=normal('M01','GUARDIAN');r.run('game.player.hp=50');clear(r);assert.ok(unlocked(save(r),'ACH-S05'));
 r=normal('M01','GUARDIAN');r.run('game.player.hp=50.1');clear(r);assert.equal(unlocked(save(r),'ACH-S05'),false);
});
test('B05 records only actual left/right destruction once and commits the order only on normal clear',()=>{
 const s=seed();s.clearedMissions=[];s.unlockedMissions=['M01','M02','M03','M04','M05']; // sanitizer opens through legacy flags
 const r=normal('M05');r.run("game.player.x=7120;startBoss();var parts=game.mobile.devices.filter(e=>['left','right'].includes(e.partKind));var l=parts.find(e=>e.partKind==='left'),q=parts.find(e=>e.partKind==='right');damageEnemy(l,999,{weaponId:'A-01'});damageEnemy(l,999,{weaponId:'A-01'});damageEnemy(q,999,{weaponId:'A-01'})");assert.deepEqual(r.json('game.campaignRun.challenge.bossSpecialEvents.b05Order'),['left','right']);assert.deepEqual(save(r).achievements.b05Orders,[]);clear(r);assert.deepEqual(save(r).achievements.b05Orders,['left']);assert.equal(unlocked(save(r),'ACH-T01'),false);
 const retry=runtime(save(r),{recordDraw:false});retry.run("startMission('M05');game.player.x=7120;startBoss();var parts=game.mobile.devices.filter(e=>['left','right'].includes(e.partKind));damageEnemy(parts.find(e=>e.partKind==='right'),999,{weaponId:'A-01'});damageEnemy(parts.find(e=>e.partKind==='left'),999,{weaponId:'A-01'})");clear(retry);assert.ok(unlocked(save(retry),'ACH-T01'));assert.equal(save(retry).achievements.b05Orders.length,2);
});
test('B06 counts closed-to-open transitions, not repeated hits, and requires a normal clear',()=>{
 const r=normal('M06');r.run("game.player.x=7080;startBoss();for(let cycle=0;cycle<3;cycle++){damageEnemy(game.living.nodes[0],1);damageEnemy(game.living.nodes[1],1);damageEnemy(game.living.nodes[1],1);if(cycle<2){game.time+=9;updateLivingEnemy(game,game.enemies.find(e=>e.type==='neuralheart'),0,spawnEnemy,pushEffect);game.time+=1}} ");
 assert.equal(r.run('game.campaignRun.challenge.bossSpecialEvents.coreExposures'),3);assert.equal(unlocked(save(r),'ACH-T02'),false);assert.equal(save(r).achievements.coreExposures,null);clear(r);assert.ok(unlocked(save(r),'ACH-T02'));
});
test('same-mission defeat flag persists over reload and clear of another mission does not satisfy retry',()=>{
 const r=normal('M02');r.run('game.player.hp=0;update(1/60)');const persisted=JSON.parse(r.storage.get(SAVE_KEY));assert.deepEqual(persisted.achievements.failedMissions,['M02']);
 const next=runtime(persisted,{recordDraw:false});next.run("startMission('M01')");clear(next);assert.equal(unlocked(save(next),'ACH-T03'),false);next.run("startMission('M02')");clear(next);assert.ok(unlocked(save(next),'ACH-T03'));
});
test('special snapshots are closed once; repeated result/quit/retry cannot duplicate counters or reward unlock dates',()=>{
 const r=normal();fire(r,'A-01');clear(r);const before=save(r).achievements;r.run('completeMission();finishCampaign("CLEAR");finishCampaign("ABANDONED");refreshAchievements()');assert.deepEqual(save(r).achievements,before);assert.equal(reconcileAchievements(save(r)).length,0);
});
test('LAB, invincible QA and normal gameplay QA are byte-isolated for every challenge event',()=>{
 const r=runtime(seed(),{debug:true,recordDraw:false}),before=r.storage.get(SAVE_KEY);r.click('test-lab');r.run("shoot();var e=spawnEnemy('crawler',140);damageEnemy(e,999,{weaponId:'A-01'});hurtPlayer(5,1);refreshAchievements()");r.click('lab-open');r.get('labUIPreset').value='gameplay';r.click('lab-preset-apply');r.change('labStageMission','M06');r.click('lab-stage-start');r.click('lab-open');r.change('labLivingState','OPEN');r.click('lab-boss-6');r.run("damageEnemy(game.enemies[0],99999,{weaponId:'A-01'})");r.flush();r.event('pagehide');assert.equal(r.storage.get(SAVE_KEY),before);assert.equal(r.run('achievementNotices.queue.length'),0);assert.equal(save(r).achievements.totals.runs,0);
});
test('unlock queue is sequential, deduplicated, pause-aware, bounded and skippable; boot restoration is separate',()=>{
 const q=new AchievementNotices();q.enqueue(['ACH-C01','ACH-C01','ACH-C02','wrong']);assert.equal(q.queue.length,2);assert.equal(q.tick(0),'ACH-C01');for(let i=0;i<90;i++)assert.equal(q.tick(.1,false),null);assert.equal(q.current,'ACH-C01');q.skip();assert.equal(q.tick(0),'ACH-C02');for(let i=0;i<31;i++)q.tick(.1);assert.equal(q.current,null);q.enqueue(ACHIEVEMENTS.map(a=>a.id));assert.ok(q.queue.length<=ACHIEVEMENTS.length);
});
test('titles require earned achievement; choice and dates survive bounded legacy-compatible save',()=>{
 const s=fresh();assert.equal(selectAchievementTitle(s,'ACH-C06'),false);s.clearedMissions=[...CHALLENGE_MISSIONS];reconcileAchievements(s,123456);assert.ok(selectAchievementTitle(s,'ACH-C06'));const out=sanitizeSave(JSON.parse(JSON.stringify(s)));assert.equal(out.achievements.selectedTitle,'ACH-C06');assert.equal(out.achievements.unlocked['ACH-C06'],123456);assert.ok(selectAchievementTitle(out,null));assert.equal(selectAchievementTitle(out,'ACH-C01'),false);
});

test('notification presentation failure cannot roll back saved unlock; saves are not per-shot',()=>{
 const r=normal(),before=r.storage.get(SAVE_KEY);fire(r,'A-01');fire(r,'S-02');assert.equal(r.storage.get(SAVE_KEY),before);
 r.run("var e=spawnEnemy('crawler',180);damageEnemy(e,999,{weaponId:'A-01'});document.querySelector('#achievementToastName').__defineSetter__('textContent',()=>{throw Error('paint failed')});updateAchievementNotice(1000)");
 const s=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(unlocked(s,'ACH-B01'));assert.equal(r.get('achievementToast').hidden,true);r.run('refreshAchievements()');assert.equal(r.run("achievementNotices.seen.size"),1);
});

test('earned title is actually displayed on the command profile and restored after reload',()=>{
 const s=seed();s.clearedMissions.push('M06');const r=runtime(s,{recordDraw:false});r.click('start');r.run("selectAchievementTitle(save,'ACH-C06');storeSave();renderMissionList()");assert.match(r.get('campaignCoverage').textContent,/称号：地球防衛の英雄/);
 const restored=runtime(JSON.parse(r.storage.get(SAVE_KEY)),{recordDraw:false});restored.click('start');assert.match(restored.get('campaignCoverage').textContent,/称号：地球防衛の英雄/);
});
test('corrupt counters, dates, unknown IDs, titles and progress values cannot expand save or crash UI',()=>{
 const s=sanitizeSave({...fresh(),achievements:{schemaVersion:1,unlocked:{'ACH-C01':Infinity,'ACH-C02':-1,UNKNOWN:50,'ACH-C03':100},selectedTitle:'ACH-C06',totals:{runs:NaN,kills:-1,bestStreak:Infinity},completed:['ACH-S03','ACH-S03','BAD'],observed:['ACH-S05','BAD'],failedMissions:['M01','BAD'],b05Orders:['left','left','bad'],coreExposures:-4}});
 assert.deepEqual(s.achievements.unlocked,{'ACH-C03':100});assert.equal(s.achievements.selectedTitle,null);assert.equal(s.achievements.totals.kills,0);assert.deepEqual(s.achievements.b05Orders,['left']);assert.deepEqual(s.achievements.failedMissions,['M01']);assert.ok(JSON.stringify(s).length<15000);
});
test('UI filters, details, badge categories, recommendation selection and locked titles reuse real master',()=>{
 const r=runtime(null,{recordDraw:false});r.click('start');r.run("campaign.tab='achievements';renderMissionList()");assert.equal(r.get('achievementList').children.length,30);assert.match(r.get('achievementProgress').textContent,/0\/30/);assert.ok(r.get('achievementRecommendations').children.length<=3);r.run("campaign.challenges.category='T';campaign.challenges.render(save,campaign.selected)");assert.equal(r.get('achievementList').children.length,3);assert.match(r.get('achievementDetail').innerHTML,/ACH-T01/);r.run("campaign.challenges.status='DONE';campaign.challenges.render(save,campaign.selected)");assert.equal(r.get('achievementList').children.length,1);assert.match(r.get('achievementList').children[0].textContent,/ありません/);assert.equal(r.get('achievementTitles').children.filter(b=>b.disabled).length,5);
 const rec=recommendAchievements(fresh());assert.equal(new Set(rec.map(a=>a.id)).size,rec.length);const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal((html.match(/id="campaignTab-/g)||[]).length,4);assert.equal((html.match(/id="labTab-/g)||[]).length,5);
});
