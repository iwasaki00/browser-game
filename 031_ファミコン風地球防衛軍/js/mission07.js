import {WORLD,ENEMY_TYPES,clamp} from './data.js?v=0.9.0';
import {movePlayerBody} from './player.js?v=0.2.2';
import {SKY,createSkyState,updateSkyEnemy,skyShieldSource,refreshSkyVisuals,frameSkyBoss,updateSkyHazards} from './mission04.js?v=0.4.1';
import {createMobileState,updateMobileEnemy,updateMobileRepairs} from './mission05.js?v=0.5.0';
import {createLivingState,updateLivingEnemy} from './mission06.js?v=0.6.0';
import {createCoastalState,updateCoastalEnemy,advanceCoastalFormations} from './mission03.js?v=0.3.1';
import {createImpactState} from './impact.js?v=0.6.0';
import {AttackDirector} from './invasion.js?v=0.6.0';
import {worldToScreen,viewBounds} from './camera.js?v=0.6.0';

export const MOTHERSHIP=Object.freeze({coreHp:4200,deviceHp:300,controlHp:120,fusionSeconds:6,
  warning:1.4,recovery:1.6,unstableRecovery:1.15,hazardLife:.24,hazardLimit:4,shotLimit:48,
  commandRange:240,commandStep:.2,commandTargets:6,commandLinks:12,commandStagger:.3,
  shiftWarning:.9,shiftRecovery:1.2,shiftCooldown:4,shiftSafeDistance:100,
  titanWarning:1.25,titanRecovery:1.5,collapseDuration:1.8,summonInterval:7,summonLimit:6});
export const M07_RADIO=Object.freeze([
  '侵略兵器の発信源を確認。目標は地球上空の巨大母艦',
  '既知の敵反応が複数。同じ指揮系統で制御されている',
  '機械設備と生体組織が融合している','司令中枢への防衛網を確認','司令中枢を破壊せよ',
  '母艦の指揮系統が停止した。しかし、さらに奥から未知の信号を検出']);
export const M07=Object.freeze({id:'M07',world:{...WORLD,width:9000,ground:260},bossX:7760,bossSpawnX:8500,
  areas:[{x:0,name:'母艦外殻'},{x:1600,name:'侵略兵器格納庫'},{x:3400,name:'生体機械融合区画'},{x:5300,name:'艦内防衛ネットワーク'},{x:7100,name:'母艦司令中枢'}],
  platforms:[{x:0,y:148,w:9000,h:112,solid:true,kind:'hull'},
    {x:1600,y:0,w:7400,h:20,solid:true,kind:'ceiling'},
    {x:480,y:136,w:64,h:12,solid:true,kind:'container'},
    {x:2240,y:124,w:64,h:24,solid:true,kind:'container'},
    {x:3680,y:136,w:64,h:12,solid:true,kind:'container'},
    {x:6180,y:124,w:64,h:24,solid:true,kind:'container'},
    {x:1260,y:0,w:24,h:148,solid:true,kind:'gate',gate:'entry'},
    {x:4700,y:20,w:24,h:128,solid:true,kind:'biofield',gate:'fusion'},
    {x:6900,y:20,w:24,h:128,solid:true,kind:'gate',gate:'network'}],
  encounters:[
    {id:'m7-entry',x:220,until:1500,pattern:'WAVE',enemy:'assaulttitan',count:2,batch:1,interval:4},
    {id:'m7-entry-escort',x:400,until:1500,pattern:'WAVE',enemy:'phasestalker',count:4,batch:1,interval:3},
    {id:'m7-a-shield',x:1640,until:2450,pattern:'WAVE',enemy:'shielddrone',count:3,batch:1,interval:2.5},
    {id:'m7-a-sentry',x:1640,until:2450,pattern:'SWARM',enemy:'sentrywalker',fraction:.35,batch:3,interval:1.8},
    {id:'m7-hangar-crab',x:1850,until:2500,pattern:'WAVE',enemy:'shorecrab',count:6,batch:2,interval:1.5},
    {id:'m7-b-repair',x:2480,until:3360,pattern:'WAVE',enemy:'repairdrone',count:3,batch:1,interval:3},
    {id:'m7-b-titan',x:2480,until:3360,pattern:'WAVE',enemy:'assaulttitan',count:4,batch:1,interval:2},
    {id:'m7-c-command',x:2700,until:3360,pattern:'WAVE',enemy:'commanddrone',count:3,batch:1,interval:3},
    {id:'m7-c-rays',x:2700,until:3360,pattern:'SWARM',enemy:'skyray',fraction:.35,batch:3,interval:1.8},
    {id:'m7-hangar-gun',x:2900,until:3370,pattern:'WAVE',enemy:'heavygunner',count:2,batch:1,interval:4},
    {id:'m7-fusion-air',x:3440,until:5150,pattern:'WAVE',enemy:'sporefly',count:8,batch:2,interval:2},
    {id:'m7-fusion-heavy',x:3560,until:5150,pattern:'WAVE',enemy:'guardiancell',count:4,batch:1,interval:4},
    {id:'m7-d-stalkers',x:4100,until:5150,pattern:'WAVE',enemy:'phasestalker',count:6,batch:2,interval:2.5},
    {id:'m7-d-melee',x:4100,until:5150,pattern:'SWARM',enemy:'assaulttitan',fraction:.25,batch:2,interval:2.4},
    {id:'m7-network-command',x:5340,until:6820,pattern:'WAVE',enemy:'commanddrone',count:5,batch:1,interval:3},
    {id:'m7-network-sentry',x:5340,until:6820,pattern:'SWARM',enemy:'sentrywalker',fraction:.5,batch:4,interval:1.2},
    {id:'m7-network-shield',x:5680,until:6820,pattern:'WAVE',enemy:'shielddrone',count:4,batch:1,interval:3},
    {id:'m7-final',x:7140,until:7660,pattern:'WAVE',enemy:'assaulttitan',count:3,batch:1,interval:3}]
});
export const MIXED_SQUADS=Object.freeze({A:['shielddrone','sentrywalker'],B:['repairdrone','assaulttitan'],C:['commanddrone','skyray'],D:['phasestalker','assaulttitan']});
export const createM07Geometry=()=>M07.platforms.map(p=>({...p,active:true}));
export function createMothershipState(){return {devices:[],network:{shield:true,reinforcement:true,turret:true},shieldRange:SKY.shieldRadius,fields:[{x:5760,y:136,w:80,h:12}],hazards:[],events:[],links:[],commandWait:0,
  fusionUntil:0,entryOpen:false,networkOpen:false,safeX:64,safeY:116,rescues:0,rescueWait:0,
  networkWait:3,reinforcementWait:7,networkPlan:null,collapseLeft:0,collapseTick:0,radioIndex:-1,radioUntil:0,storyPreview:false};}
function event(g,name){const a=g.mothership.events;if(a.length>=64)a.shift();a.push({time:g.time,event:name})}
function fixed(g,kind,x,hp=MOTHERSHIP.controlHp){
  const e={uid:g.nextEnemyId++,type:'commanddevice',partKind:kind,fixedDevice:true,x,y:116,w:28,h:32,hp,maxHp:hp,dead:false,death:0,anim:0,face:1,active:true,shotCd:0};
  g.enemies.push(e);g.mothership.devices.push(e);return e;
}
// Existing mission AI is reused through views: the root never gains sky/mobile/
// living flags, so terrain, camera, reward and render dispatch remain M07-only.
function attachViews(g){
  const floors=g.platforms.filter(p=>!['ceiling','gate','biofield'].includes(p.kind)),m=g.mothership;
  for(const [key,state] of [['sky',createSkyState()],['mobile',createMobileState()],['living',createLivingState()],['coast',createCoastalState()]]){
    const v=Object.create(g);v[key]=state;v.platforms=floors;m[key+'View']=v;
  }
}
export function createMothershipAIView(g){const view=Object.create(g);view.mothership=createMothershipState();attachViews(view);return view;}
export function initializeMothership(g,area=0){
  const m=g.mothership;attachViews(g);fixed(g,'entry',1110);fixed(g,'fusion',4540,1);
  for(const [kind,x] of [['shield',5500],['reinforcement',5980],['turret',6520]])fixed(g,kind,x);
  if(area>0){const d=m.devices[0];d.dead=true;d.hp=0;m.entryOpen=true}
  if(area>2)m.fusionUntil=Infinity;
  if(area>3){for(const d of m.devices.slice(2)){d.dead=true;d.hp=0}for(const k of Object.keys(m.network))m.network[k]=false;m.networkOpen=true}
  syncMothershipGates(g);m.radioIndex=area;m.radioUntil=g.time+6;
}
const occupied=(p,b)=>p.x+7>b.x&&p.x-7<b.x+b.w&&p.y+32>b.y&&p.y<b.y+b.h;
export function syncMothershipGates(g){
  const m=g.mothership;
  for(const gate of g.platforms){if(!gate.gate)continue;
    const open=g.bossStarted||gate.gate==='entry'&&m.entryOpen||gate.gate==='fusion'&&g.time<m.fusionUntil||gate.gate==='network'&&m.networkOpen;
    // Timeout never materializes solid terrain inside an actor/installation.
    gate.active=!open&&!occupied(g.player,gate)&&!g.enemies.some(e=>!e.dead&&!e.fixedDevice&&occupied({x:e.x,y:e.y},gate))&&!g.arsenal.installations.some(i=>i.life>0&&i.x>gate.x-16&&i.x<gate.x+gate.w+16);
  }
}
export function mothershipSurface(g,x){let y=g.world.ground;for(const b of g.platforms)if(b.active!==false&&!['ceiling','gate','biofield'].includes(b.kind)&&x>b.x&&x<b.x+b.w)y=Math.min(y,b.y);return y}
export function safeMothershipSpawn(g,type,x,y){
  const t=ENEMY_TYPES[type];if(!t)return null;if(type==='commandcore')return {x,y:y??68};
  const flying=['commanddrone','shielddrone','repairdrone','sporefly','skyray','interceptor','needle','spider','spitter'].includes(type);
  for(const offset of [0,32,-32,64,-64,96,-96,160,-160]){const cx=clamp(x+offset,t.w/2+1,g.world.width-t.w/2-1),cy=flying?clamp(y??52,22,Math.max(22,mothershipSurface(g,cx)-t.h-4)):mothershipSurface(g,cx)-t.h;
    if(g.platforms.some(b=>b.active!==false&&cx+t.w/2>b.x+.01&&cx-t.w/2<b.x+b.w-.01&&cy+t.h>b.y+.01&&cy<b.y+b.h-.01))continue;
    if(Math.hypot(cx-g.player.x,cy-g.player.y)<70)continue;return {x:cx,y:cy};
  }return null;
}
export function recoverMothershipPlayer(g,dt,hurt,effect){
  const m=g.mothership,p=g.player;m.rescueWait=Math.max(0,m.rescueWait-dt);
  if(p.onGround&&p.y<150&&!g.platforms.some(b=>b.active!==false&&occupied(p,b))){m.safeX=p.x;m.safeY=p.y}
  if(p.y<205||p.dead)return false;
  for(let n=0;n<375;n++)for(const side of n?[-1,1]:[1]){
    const x=clamp(m.safeX+n*24*side,g.bossStarted?M07.bossX:16,8960),y=mothershipSurface(g,x)-32,c={x,y};
    if(y>150||g.platforms.some(b=>b.active!==false&&occupied(c,b))||g.enemies.some(e=>!e.dead&&!e.fixedDevice&&Math.abs(e.x-x)<e.w/2+15))continue;
    Object.assign(p,{x,y,vx:0,vy:0,onGround:true});m.rescues++;if(!m.rescueWait){hurt(12,x-1);m.rescueWait=1.2}effect({kind:'mothershipPhase',x,y:y+16,life:.4,max:.4});return true;
  }return false;
}
export function hitMothershipControl(g,e,effect){
  if(e.type!=='commanddevice'||e.partKind!=='fusion')return false;
  if(g.time>=(e.nextSignalAt??0)){e.nextSignalAt=g.time+.4;e.hitFlash=.15;g.mothership.fusionUntil=g.time+MOTHERSHIP.fusionSeconds;event(g,'FUSION_DISABLED');syncMothershipGates(g);effect({kind:'mothershipCommand',x:e.x,y:e.y+16,life:.4,max:.4})}return true;
}
export function mothershipDamage(g,e,damage){
  if(e.type==='commandcore'&&e.shielded||e.type==='phasestalker'&&['VANISH','SHIFT'].includes(e.phaseState))return 0;
  const bossShield=g.bossStarted&&g.mothership.devices.some(d=>d.partKind==='shield'&&!d.dead);
  return !e.fixedDevice&&e.type!=='commandcore'&&(bossShield||skyShieldSource(g.mothership.skyView,e))?damage*SKY.shieldScale:damage;
}
export const mothershipCore=e=>({x:e.x,y:e.y+32,r:24,open:!e.dead&&!e.shielded});
function openCore(g,b,effect){
  b.shielded=g.mothership.devices.some(d=>!d.dead);b.hpPhase=b.shielded?1:b.hp<=b.maxHp*.3?3:2;
  if(!b.shielded){b.warningLeft=0;b.attackPlan=null;b.actionWait=1.6;g.mothership.hazards.length=0;g.enemyShots.length=0;effect({kind:'mothershipShield',x:b.x,y:b.y+32,life:.6,max:.6});event(g,'CORE_OPEN')}
}
export function mothershipPartDestroyed(g,e,effect){
  const m=g.mothership;if(e.partKind==='entry')m.entryOpen=true;
  else if(Object.hasOwn(m.network,e.partKind)){m.network[e.partKind]=false;m.networkOpen=Object.values(m.network).every(v=>!v);if(e.partKind==='turret')m.networkPlan=null;}
  const boss=g.enemies.find(a=>a.type==='commandcore'&&!a.dead);if(boss)openCore(g,boss,effect);
  syncMothershipGates(g);event(g,e.partKind.toUpperCase()+'_DISABLED');effect({kind:'mothershipBreak',x:e.x,y:e.y+16,life:.6,max:.6});
}
export function resetMothershipBoss(g,b,phase=1,mask=0){
  phase=clamp(Math.floor(Number(phase)||1),1,3);mask=clamp(Math.floor(Number(mask)||0),0,7);if(phase>=2)mask=7;
  g.enemies.length=0;g.enemies.push(b);g.liveEnemies=1;g.liveMobs=0;g.shots.length=g.enemyShots.length=g.effects.length=0;g.impact=createImpactState();g.attacks=new AttackDirector();g.shake=0;g.clear=false;
  g.arsenal.installations.length=g.arsenal.jobs.length=g.arsenal.pending.length=0;
  g.mothership=createMothershipState();attachViews(g);const m=g.mothership;m.entryOpen=m.networkOpen=true;m.fusionUntil=Infinity;m.safeX=g.player.x;m.safeY=g.player.y;
  for(const k of Object.keys(m.network))m.network[k]=false;
  const hp=phase===3?MOTHERSHIP.coreHp*.3:MOTHERSHIP.coreHp;
  Object.assign(b,{x:M07.bossSpawnX,y:68,hp,maxHp:MOTHERSHIP.coreHp,dead:false,death:0,deathTracked:false,shielded:mask!==7,hpPhase:mask===7?(phase===3?3:2):1,
    timer:0,warningLeft:0,attackPlan:null,actionWait:1.6,actionIndex:0,summonWait:MOTHERSHIP.summonInterval,shieldedUntil:0,vx:0,vy:0});
  let i=0;for(const [kind,x] of [['shield',7980],['reinforcement',8320],['turret',8680]]){const d=fixed(g,kind,x,MOTHERSHIP.deviceHp);d.dead=!!(mask&(1<<i++));if(d.dead)d.hp=0}
  b.activeParts=m.devices;g.bossStarted=true;syncMothershipGates(g);event(g,'BOSS_RESET_P'+b.hpPhase+'_MASK'+mask);
}
export const frameMothershipBoss=g=>frameSkyBoss(g);
export function spawnMixedSquad(g,key,spawn){
  const types=MIXED_SQUADS[key];if(!types)return 0;let count=0;
  const direction=g.player.x<g.world.width-700?1:-1;
  for(let i=0;i<6;i++){const type=types[i%2],x=clamp(g.player.x+direction*(220+i*35),24,8960);if(spawn(type,x))count++}return count;
}
function legalPosition(g,e,x){
  const y=mothershipSurface(g,x)-e.h;
  if(x<24||x>g.world.width-32||Math.abs(x-g.player.x)<MOTHERSHIP.shiftSafeDistance)return null;
  for(const b of g.platforms)if(b.active!==false&&x+e.w/2>b.x&&x-e.w/2<b.x+b.w&&y+e.h>b.y+.01&&y<b.y+b.h-.01)return null;
  return {x,y};
}
export function phaseDestination(g,e){
  const bounds=viewBounds(g.camera??0,g.battleCamera?.zoom??.5),side=e.x<g.player.x?-1:1;
  for(const distance of [160,200,120,240])for(const dir of [-side,side]){const x=clamp(g.player.x+distance*dir,bounds.left+32,bounds.right-32),p=legalPosition(g,e,x);if(p)return p}return null;
}
function moveGround(g,e,dx){
  const old=e.x,candidate=clamp(old+dx,e.w/2+1,g.world.width-e.w/2-1),feet=e.y+e.h;
  for(const b of g.platforms)if(b.active!==false&&b.y<feet-.1&&b.y+b.h>e.y&&candidate+e.w/2>b.x&&candidate-e.w/2<b.x+b.w){e.x=dx>0?b.x-e.w/2:b.x+b.w+e.w/2;e.y=mothershipSurface(g,e.x)-e.h;return false}
  e.x=candidate;e.y=mothershipSurface(g,e.x)-e.h;return true;
}
function addHazard(g,z,damage=20){if(g.mothership.hazards.length<MOTHERSHIP.hazardLimit)g.mothership.hazards.push({...z,damage,life:MOTHERSHIP.hazardLife,hit:false})}
export function updateMothershipEnemy(g,e,dt,spawn,effect){
  const m=g.mothership,p=g.player,dx=p.x-e.x;
  if(e.fixedDevice)return true;
  if(['interceptor','shielddrone','heavygunner'].includes(e.type)){updateSkyEnemy(m.skyView,e,dt,spawn,effect);return true}
  if(['assaultroller','repairdrone','sentrywalker'].includes(e.type)){updateMobileEnemy(m.mobileView,e,dt,spawn,effect);return true}
  if(['pulseworm','sporefly','guardiancell'].includes(e.type)){updateLivingEnemy(m.livingView,e,dt,spawn,effect);return true}
  if(['shorecrab','skyray','siegebeetle'].includes(e.type)){updateCoastalEnemy(m.coastView,e,dt,spawn,effect);return true}
  if(e.type==='commanddrone'){
    e.x=clamp(e.x+Math.sign(dx)*20*dt,24,8960);e.y=clamp(54+Math.sin(e.anim*.4+e.uid)*12,26,88);
  }else if(e.type==='phasestalker'){
    e.phaseState??='READY';e.phaseTimer=(e.phaseTimer??(2+(e.uid%4)*.5))-dt;
    if(e.phaseState==='SHIFT'){
      e.warningLeft=Math.max(0,e.warningLeft-dt);
      if(e.phaseTimer<=0){const destination=legalPosition(g,e,e.targetX);if(destination)Object.assign(e,destination);e.phaseState='RECOVERY';e.phaseTimer=MOTHERSHIP.shiftRecovery;e.warningLeft=0;e.attackPlan=null;effect({kind:'mothershipPhase',x:e.x,y:e.y+16,life:.35,max:.35})}
    }else if(e.phaseState==='RECOVERY'){if(e.phaseTimer<=0){e.phaseState='READY';e.phaseTimer=MOTHERSHIP.shiftCooldown}}
    else{moveGround(g,e,Math.sign(dx)*32*e.speedScale*dt);if(e.phaseTimer<=0){const destination=phaseDestination(g,e);if(destination){e.targetX=destination.x;e.targetY=destination.y;e.phaseState='SHIFT';e.phaseTimer=e.warningLeft=MOTHERSHIP.shiftWarning;e.attackPlan={kind:'shift',zones:[{x:e.targetX,y:e.targetY,w:e.w,h:e.h}]}}else e.phaseTimer=.5}}
  }else if(e.type==='assaulttitan'){
    e.recoverLeft=Math.max(0,(e.recoverLeft??0)-dt);
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){if(e.attackPlan.kind==='charge'){e.dashLeft=.4;e.vx=e.attackPlan.direction*140}else{for(const z of e.attackPlan.zones)addHazard(g,z,22);e.recoverLeft=MOTHERSHIP.titanRecovery}effect({kind:'mothershipStrike',x:e.warnX,y:128,life:.3,max:.3});e.attackPlan=null}}
    else if(e.dashLeft>0){e.dashLeft=Math.max(0,e.dashLeft-dt);if(!moveGround(g,e,e.vx*dt))e.dashLeft=0;if(!e.dashLeft)e.recoverLeft=MOTHERSHIP.titanRecovery}
    else if(!e.recoverLeft){if(Math.abs(dx)>95)moveGround(g,e,Math.sign(dx)*18*e.speedScale*dt);if(Math.abs(dx)<190&&g.attacks.dive(g.time)){const direction=Math.sign(dx)||1,charge=(e.actionIndex??0)%2===1;e.actionIndex=(e.actionIndex??0)+1;e.warnX=e.x+direction*58;e.warningLeft=MOTHERSHIP.titanWarning;e.attackPlan={kind:charge?'charge':'strike',direction,zones:[{x:e.x+direction*(charge?28:58),y:100,w:charge?112:72,h:48}]}}}
  }else if(e.type==='commandcore'){
    e.hpPhase=e.shielded?1:e.hp<=e.maxHp*.3?3:2;e.timer+=dt;e.actionWait-=dt;e.summonWait-=dt;
    const turret=m.devices.find(d=>d.partKind==='turret'&&!d.dead),reinforce=m.devices.find(d=>d.partKind==='reinforcement'&&!d.dead);
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){for(const z of e.attackPlan.zones)addHazard(g,z);effect({kind:'mothershipStrike',x:e.warnX,y:120,life:.35,max:.35});e.attackPlan=null;e.actionWait=e.hpPhase===3?MOTHERSHIP.unstableRecovery:MOTHERSHIP.recovery}}
    else if(e.actionWait<=0&&(turret||!e.shielded)){const wide=e.hpPhase===3&&e.actionIndex++%3===2;e.warnX=clamp(p.x,M07.bossX+40,8920);e.attackPlan={kind:wide?'wave':'strike',zones:[{x:e.warnX,y:wide?124:20,w:wide?96:64,h:wide?24:128}]};e.warningLeft=MOTHERSHIP.warning}
    if(reinforce&&e.summonWait<=0){e.summonWait=MOTHERSHIP.summonInterval;for(let i=0;i<2&&g.liveMobs<MOTHERSHIP.summonLimit;i++){const x=clamp(p.x+(p.x<8450?240:-240)+i*40,M07.bossX+40,8920);if(Math.abs(x-p.x)>150)spawn(i?'phasestalker':'commanddrone',x)}}
  }else return false;
  return true;
}
export function updateCommands(g,dt){
  const m=g.mothership;
  // Clear stale links promptly, also after a support kill earlier this tick.
  let w=0;for(const l of m.links)if(!l.from.dead&&!l.target.dead&&Math.hypot(l.from.x-l.target.x,l.from.y-l.target.y)<MOTHERSHIP.commandRange){m.links[w++]=l}else if(l.target.linkedCommander===l.from.uid)delete l.target.linkedCommander;m.links.length=w;
  m.commandWait-=dt;if(m.commandWait>0)return;m.commandWait=MOTHERSHIP.commandStep;
  for(const d of g.enemies){if(d.dead||d.type!=='commanddrone')continue;let targets=0;
    const nearby=g.grid.query(d.x-MOTHERSHIP.commandRange,d.y-MOTHERSHIP.commandRange,d.x+MOTHERSHIP.commandRange,d.y+MOTHERSHIP.commandRange,m.commandScratch??=[]);
    for(const e of nearby){if(targets>=MOTHERSHIP.commandTargets||m.links.length>=MOTHERSHIP.commandLinks)break;
      if(e===d||e.dead||e.fixedDevice||e.type==='commandcore'||e.type==='commanddrone'||Math.hypot(e.x-d.x,e.y-d.y)>MOTHERSHIP.commandRange)continue;
      if(e.linkedCommander&&e.linkedCommander!==d.uid)continue;
      if(!e.linkedCommander){e.linkedCommander=d.uid;e.shotCd=Math.max(e.shotCd??0,.6+targets*MOTHERSHIP.commandStagger);e.diveCd=Math.max(e.diveCd??0,.6+targets*MOTHERSHIP.commandStagger);m.links.push({from:d,target:e})}targets++;
    }
  }
}
export function updateMothershipState(g,dt,hurt,effect,spawn){
  const m=g.mothership,p=g.player;
  syncMothershipGates(g);if(m.radioIndex!==g.area){m.radioIndex=g.area;m.radioUntil=g.time+6}
  const combat=g.lab?.run?.mode!=='A'&&!g.clear&&!p.dead;
  if(combat){advanceCoastalFormations(m.coastView,dt);refreshSkyVisuals(m.skyView);updateMobileRepairs(m.mobileView,dt);updateSkyHazards(m.skyView,dt,hurt,effect);updateCommands(g,dt);
    // Reuse guardian-cell hazards without advancing its terrain/flow subsystem.
    for(const h of m.livingView.living.hazards)if(m.hazards.length<MOTHERSHIP.hazardLimit)m.hazards.push(h);m.livingView.living.hazards.length=0;
    if(!g.bossStarted&&g.area===3){m.networkWait-=dt;m.reinforcementWait-=dt;
      if(m.networkPlan){m.networkPlan.left-=dt;if(m.networkPlan.left<=0){addHazard(g,m.networkPlan.zone,16);m.networkPlan=null;m.networkWait=m.network.turret?3:8}}
      else if(m.networkWait<=0){m.networkPlan={left:MOTHERSHIP.warning,zone:{x:p.x,y:20,w:56,h:128}}}
      if(m.network.shield)for(const z of m.fields)if(Math.abs(p.x-z.x)<z.w/2+7&&p.y+32>z.y)hurt(12,z.x);
      if(m.network.reinforcement&&m.reinforcementWait<=0){m.reinforcementWait=7;if(g.liveMobs<Math.min(g.enemyLimit-1,12))spawn('phasestalker',clamp(p.x+220,5340,6780))}
    }
  }
  let w=0;for(const h of m.hazards){h.life-=dt;if(combat&&!h.hit&&Math.abs(p.x-h.x)<h.w/2+7&&p.y+32>h.y&&p.y<h.y+h.h){hurt(h.damage,h.x);h.hit=true}if(h.life>0)m.hazards[w++]=h}m.hazards.length=w;
  if(m.collapseLeft>0){m.collapseLeft=Math.max(0,m.collapseLeft-dt);m.collapseTick-=dt;if(m.collapseTick<=0){m.collapseTick=.14;effect({kind:'mothershipBreak',x:M07.bossSpawnX+Math.sin(g.time*17)*70,y:85+Math.cos(g.time*13)*32,life:.6,max:.6})}}
}
export function mothershipObjective(g){const m=g.mothership,b=g.enemies.find(e=>e.type==='commandcore'&&!e.dead);
  if(b)return b.shielded?'3制御装置を破壊（順序自由）':b.hpPhase===3?'不安定化した中央コアを破壊':'シールド解除：中央コアを攻撃';
  return [m.entryOpen?'侵入口開放：格納庫へ':'外殻制御部を破壊せよ','支援敵を倒し混成部隊を突破','制御装置を撃つと防御6秒停止',m.networkOpen?'3系統停止：司令中枢へ':'A/B/C制御を破壊（順序自由）','母艦司令中枢を破壊せよ'][Math.max(0,g.area)];}
export function drawMothershipHud(c,g,zoom,offset=0){
  const m=g.mothership,b=g.enemies.find(e=>e.type==='commandcore'&&!e.dead);c.save();c.fillStyle='#071522ee';c.fillRect(4,39,113,21);c.font='6px monospace';c.fillStyle='#e5e7ba';c.fillText(mothershipObjective(g).slice(0,18),7,47);c.font='5px monospace';c.fillStyle='#a3ded4';
  const states=b?m.devices.map(d=>`${d.partKind[0].toUpperCase()}:${d.dead?'OFF':'ON'}`).join(' '):g.area===2?`防御停止 ${Math.max(0,m.fusionUntil-g.time).toFixed(1)}s`:Object.entries(m.network).map(([k,v])=>`${k[0].toUpperCase()}:${v?'ON':'OFF'}`).join(' ');c.fillText(states,7,56);
  let count=0;for(const e of b&&!b.shielded?[b]:m.devices){if(e.dead||count>=4||!b&&Math.abs(e.x-g.player.x)>650)continue;
    const p=worldToScreen({x:e.x,y:e.y},g.camera,zoom),x=clamp(p.x+offset,12,308),y=clamp(p.y-14+offset,91,133);c.fillStyle='#ffdf8b';c.fillText((p.x<12?'<':p.x>308?'>':'')+(e.type==='commandcore'?'CORE':e.partKind==='fusion'?'CONTROL':e.partKind.toUpperCase()),clamp(x-12,4,265),y);c.fillRect(x-2,y+3,5,2);count++}
  if(b&&g.time<(b.shieldedUntil??0)){c.fillStyle='#b9e3dc';c.fillText('SHIELDED',145,76)}
  if(g.time<m.radioUntil||m.storyPreview){const text=M07_RADIO[m.storyPreview?5:Math.max(0,m.radioIndex)];c.fillStyle='#081521ed';c.fillRect(6,144,308,28);c.fillStyle='#d5dfca';c.font='6px monospace';for(let i=0;i<text.length;i+=48)c.fillText(text.slice(i,i+48),10,153+Math.floor(i/48)*8);if(m.storyPreview)c.fillText('SIGNAL SOURCE UNKNOWN',10,169)}c.restore();return count;
}
