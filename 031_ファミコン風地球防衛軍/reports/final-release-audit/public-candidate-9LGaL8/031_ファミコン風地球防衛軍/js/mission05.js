import {WORLD,VIEW,BATTLE_CAMERA,clamp} from './data.js?v=0.5.0';
import {advanceSkyPlatforms,skyPlatformMotion,frameSkyBoss} from './mission04.js?v=0.4.1';
import {movePlayerBody} from './player.js?v=0.2.2';
import {createImpactState} from './impact.js?v=0.5.0';
import {AttackDirector} from './invasion.js?v=0.5.0';
import {worldToScreen} from './camera.js?v=0.5.0';

export const MOBILE=Object.freeze({coreHp:3600,deviceHp:240,turretHp:150,driveHp:240,controlHp:120,
  runningSpeed:45,disabledSpeed:.35,warning:1.3,hazardLife:.22,recovery:1.8,weakRecovery:2.8,
  summonInterval:4,summonBatch:1,summonLimit:10,shotLimit:48,hazardLimit:6,repairRange:120,repairAmount:8,
  repairInterval:2,repairStep:.25,repairBudget:8,repairTargets:2,repairLinks:8,collapseDuration:1.6});
export const M05=Object.freeze({id:'M05',world:{...WORLD,width:8000,ground:260},bossX:6840,bossSpawnX:7480,
  areas:[{x:0,name:'荒野追撃戦'},{x:1400,name:'装甲甲板'},{x:3000,name:'機関区画'},{x:4600,name:'制御中枢'},{x:6200,name:'動力炉決戦'}],
  platforms:[{x:0,y:148,w:8000,h:112,solid:true,kind:'wilderness'},
    {x:1120,y:136,w:120,h:12,solid:true,kind:'boarding'},
    {x:1240,y:124,w:1760,h:24,solid:true,kind:'deck'},
    {x:3000,y:0,w:3200,h:36,solid:true,kind:'ceiling'},
    {x:3360,y:124,w:64,h:24,solid:true,kind:'machine'},
    {x:4840,y:124,w:64,h:24,solid:true,kind:'machine'},
    {x:5740,y:124,w:64,h:24,solid:true,kind:'machine'},
    {x:2920,y:0,w:24,h:260,solid:true,kind:'hatch',gate:'turrets'},
    {x:4500,y:0,w:24,h:260,solid:true,kind:'hatch',gate:'drive'},
    {x:6100,y:0,w:24,h:260,solid:true,kind:'hatch',gate:'control'}],
  movers:[{id:'base-lift',x:2240,y:88,w:96,h:12,travel:24,speed:12,axis:'y'},
    {id:'base-machine',x:3940,y:124,w:104,h:12,travel:160,speed:32,axis:'x'}],
  encounters:[
    {id:'m5-chase',x:220,until:1320,pattern:'WAVE',enemy:'assaultroller',count:12,batch:2,interval:1.1},
    {id:'m5-deck',x:1480,until:2860,pattern:'SWARM',enemy:'assaultroller',fraction:.65,batch:4,interval:.7},
    {id:'m5-repair',x:1740,until:2800,pattern:'WAVE',enemy:'repairdrone',count:3,batch:1,interval:3},
    {id:'m5-engine',x:3060,until:4400,pattern:'WAVE',enemy:'sentrywalker',count:5,batch:1,interval:3},
    {id:'m5-engine-wave',x:3480,until:4420,pattern:'SWARM',enemy:'assaultroller',fraction:.65,batch:4,interval:.8},
    {id:'m5-control',x:4660,until:6000,pattern:'WAVE',enemy:'sentrywalker',count:5,batch:1,interval:2.5},
    {id:'m5-support',x:4960,until:6000,pattern:'WAVE',enemy:'repairdrone',count:4,batch:1,interval:3},
    {id:'m5-final',x:6260,until:6760,pattern:'SWARM',enemy:'assaultroller',fraction:.7,batch:5,interval:.7}]
});
export const createM05Geometry=()=>[...M05.platforms.map(p=>({...p,active:true})),...M05.movers.map(p=>({...p,baseX:p.x,baseY:p.y,moving:true,solid:true,kind:'transport',active:true}))];
export const createMobileState=()=>({devices:[],hazards:[],repairs:[],repairScratch:[],repairWait:0,repairCursor:0,
  speed:1,travel:0,turretsOff:false,driveOff:false,controlOff:false,safeX:64,safeY:116,rescues:0,rescueWait:0,
  collapseLeft:0,collapseTick:0,collapseDone:false,guideUntil:0,events:[],bossStart:'FULL'});
function device(g,kind,x,y,hp,dead=false){const e={uid:g.nextEnemyId++,type:'basedevice',fixedDevice:true,partKind:kind,x,y,w:28,h:32,hp:dead?0:hp,maxHp:hp,dead,death:0,anim:0,face:-1,shotCd:1+(x%7)*.2,active:true,warningLeft:0};g.mobile.devices.push(e);g.enemies.push(e);return e}
export function initializeMobile(g,area=0){
  const m=g.mobile;
  device(g,'turret',1900,92,MOBILE.turretHp,area>=2);device(g,'turret',2500,92,MOBILE.turretHp,area>=2);
  device(g,'drive',3750,116,MOBILE.driveHp,area>=3);device(g,'control',5520,116,MOBILE.controlHp,area>=4);
  syncMobileGates(g);m.events.length=0;
}
export function syncMobileGates(g){
  const m=g.mobile,off=kind=>m.devices.filter(e=>e.partKind===kind).every(e=>e.dead);
  const changes=[['turretsOff',off('turret')],['driveOff',off('drive')],['controlOff',off('control')]];
  for(const [key,value] of changes)if(value!==m[key]){m[key]=value;m.events.push({time:g.time,event:key});if(m.events.length>16)m.events.shift()}
  m.speed=m.driveOff?MOBILE.disabledSpeed:1;
  for(const p of g.platforms)if(p.gate)p.active=!m[p.gate==='turrets'?'turretsOff':p.gate==='drive'?'driveOff':'controlOff'];
}
export function advanceMobilePlatforms(g,dt){
  // Horizontal mechanics are the existing M04 sweep/installation support code.
  for(const p of g.platforms)if(p.axis==='y')p.moving=false;
  advanceSkyPlatforms(g,dt);
  for(const b of g.platforms)if(b.axis==='y'){
    b.moving=true;const old=b.y,supported=g.player.onGround&&Math.abs(g.player.y+32-old)<.05&&g.player.x+7>b.x&&g.player.x-7<b.x+b.w;
    b.y=skyPlatformMotion({...b,baseX:b.baseY},g.time).x;const dy=b.y-old,p=g.player;
    if(supported&&!p.dead){const vx=p.vx,vy=p.vy;b.active=false;p.vx=0;p.vy=dy/dt;movePlayerBody(p,g.platforms,dt,true);b.active=true;p.vx=vx;p.vy=vy;p.onGround=Math.abs(p.y+32-b.y)<.1}
    if(!supported&&p.x+7>b.x&&p.x-7<b.x+b.w&&p.y+32>b.y&&p.y<b.y+b.h){
      if(p.y+32<=old+.05){p.y=b.y-32;p.onGround=true}
      else if(p.y>=old+b.h-.05){p.y=b.y+b.h;p.onGround=false}
      else{const target=p.x<b.x+b.w/2?b.x-7:b.x+b.w+7,vx=p.vx,vy=p.vy;b.active=false;p.vx=(target-p.x)/dt;p.vy=0;movePlayerBody(p,g.platforms,dt,true);b.active=true;p.vx=vx;p.vy=vy}
      p.vy=0;
    }
    for(const i of g.arsenal.installations)if(i.supportId===b.id||!i.supportId&&Math.abs(i.y-old)<.1&&i.x>=b.x&&i.x<=b.x+b.w){i.supportId=b.id;i.y+=dy}
  }
}
export function mobileSurface(g,x){let floor=g.world.ground;for(const b of g.platforms)if(b.active!==false&&b.kind!=='ceiling'&&b.kind!=='hatch'&&x>b.x&&x<b.x+b.w)floor=Math.min(floor,b.y);return floor}
export function recoverMobilePlayer(g,dt,hurt,effect){
  const m=g.mobile,p=g.player;m.rescueWait=Math.max(0,m.rescueWait-dt);
  if(p.onGround&&p.y<150){m.safeX=p.x;m.safeY=p.y}
  if(p.y<205||p.dead)return;
  for(let n=0;n<334;n++)for(const sign of n?[-1,1]:[1]){
    const x=clamp(m.safeX+n*24*sign,g.bossStarted?M05.bossX:16,7970),y=mobileSurface(g,x)-32;
    if(y>150||g.platforms.some(b=>b.active!==false&&x+7>b.x&&x-7<b.x+b.w&&y+32>b.y+.01&&y<b.y+b.h-.01)||g.enemies.some(e=>!e.dead&&Math.abs(e.x-x)<e.w/2+15&&y+32>e.y-8&&y<e.y+e.h+8))continue;
    Object.assign(p,{x,y,vx:0,vy:0,onGround:true});m.rescues++;if(!m.rescueWait){hurt(12,x-1);m.rescueWait=1.2}effect({kind:'mobileDust',x,y:y+32,life:.4,max:.4});return;
  }
}
export const mobileCore=e=>({x:e.x,y:e.y+32,r:23,open:!e.dead&&!e.shielded});
export const mobileDamage=(g,e,damage)=>e.type==='reactor'&&e.shielded?0:damage;
export function mobilePartDestroyed(g,e,effect){
  if(e.destroyNotified)return;e.destroyNotified=true;
  effect({kind:'mobileBreak',x:e.x,y:e.y+16,life:.6,max:.6});
  const b=g.enemies.find(e=>e.type==='reactor'&&!e.dead);
  if(b&&['left','right'].includes(e.partKind)){
    if(e.partKind==='left'){b.leftDestroyed=true;b.warningLeft=0;b.attackPlan=null;g.mobile.hazards.length=0;b.actionWait=MOBILE.weakRecovery}
    else{b.rightDestroyed=true;b.summonWait=Infinity}
    b.shielded=!(b.leftDestroyed&&b.rightDestroyed);b.mobilePhase=b.shielded?2:3;
    if(!b.shielded){b.warningLeft=0;b.attackPlan=null;b.actionWait=1.6;g.mobile.hazards.length=0;g.enemyShots.length=0}
    if(!b.shielded)effect({kind:'mobileShieldOff',x:b.x,y:b.y+32,life:.6,max:.6});
    b.shieldedUntil=0;g.mobile.guideUntil=g.time+2.5;g.mobile.events.push({time:g.time,event:e.partKind+'Destroyed'});
  }else syncMobileGates(g);
}
export function resetMobileBoss(g,b,start='FULL'){
  const allowed=['FULL','LEFT','RIGHT','OPEN'];if(!allowed.includes(start))start='FULL';
  g.enemies.length=0;g.enemies.push(b);g.liveEnemies=1;g.liveMobs=0;g.shots.length=g.enemyShots.length=g.effects.length=0;
  g.impact=createImpactState();g.attacks=new AttackDirector();g.shake=0;g.clear=false;
  g.arsenal.installations.length=g.arsenal.jobs.length=g.arsenal.pending.length=0;
  g.mobile=createMobileState();initializeMobile(g,5);g.mobile.devices.length=0;g.enemies.length=1;
  Object.assign(b,{dead:false,death:0,deathTracked:false,hp:MOBILE.coreHp,maxHp:MOBILE.coreHp,shielded:start!=='OPEN',leftDestroyed:['LEFT','OPEN'].includes(start),rightDestroyed:['RIGHT','OPEN'].includes(start),mobilePhase:start==='FULL'?1:start==='OPEN'?3:2,timer:0,warningLeft:0,attackPlan:null,actionWait:1.6,actionIndex:0,summonWait:MOBILE.summonInterval,shieldedUntil:0,vx:0,vy:0});
  device(g,'left',7140,116,MOBILE.deviceHp,b.leftDestroyed);device(g,'right',7740,116,MOBILE.deviceHp,b.rightDestroyed);
  b.activeParts=g.mobile.devices;g.mobile.guideUntil=g.time+2.5;g.mobile.safeX=g.player.x;g.mobile.safeY=g.player.y;g.mobile.bossStart=start;g.bossStarted=true;
}
export function frameMobileBoss(g){frameSkyBoss(g)}
function mobileShot(g,e,x,y,angle=0){if(g.enemyShots.length>=MOBILE.shotLimit)return false;const a=Math.atan2(y-e.y-12,x-e.x)+angle;g.enemyShots.push({kind:'mobileOrb',x:e.x,y:e.y+12,vx:Math.cos(a)*110,vy:Math.sin(a)*110,w:6,h:6,damage:e.fixedDevice?12:16,life:4,normal:!e.fixedDevice});return true}
export function updateMobileEnemy(g,e,dt,spawn,effect){
  const p=g.player,dx=p.x-e.x;
  if(e.fixedDevice){
    if(e.partKind==='turret'&&Math.abs(dx)<420){if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){mobileShot(g,e,e.warnX,e.warnY);e.shotCd=3.2}}else if(e.shotCd<=0){e.warnX=p.x;e.warnY=p.y+16;e.warningLeft=1.2}}
    return;
  }
  if(e.type==='assaultroller'){
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){e.dashLeft=.5;e.vx=Math.sign(e.warnX-e.x)*160}}
    else if(e.dashLeft>0){e.dashLeft=Math.max(0,e.dashLeft-dt);e.x+=e.vx*dt;if(!e.dashLeft)e.recoverLeft=.85}
    else if(e.recoverLeft>0)e.recoverLeft=Math.max(0,e.recoverLeft-dt);
    else{e.x+=Math.sign(dx)*42*e.speedScale*dt;if(Math.abs(dx)<160&&g.attacks.dive(g.time)){e.warningLeft=.65;e.warnX=p.x;e.warnY=p.y+16}}
    e.x=clamp(e.x,24,7970);e.y=mobileSurface(g,e.x)-e.h;
  }else if(e.type==='repairdrone'){
    e.x=clamp(e.x+Math.sign(dx)*24*dt,24,7970);e.y=(e.x>=3000&&e.x<6200?64:50)+Math.sin(e.anim*.5)*10;
  }else if(e.type==='sentrywalker'){
    e.y=mobileSurface(g,e.x)-e.h;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){e.burstLeft=3;e.burstWait=0}}
    else if(e.burstLeft>0){e.burstWait-=dt;if(e.burstWait<=0&&g.attacks.ranged(g.time)){mobileShot(g,e,e.warnX,e.warnY,(e.burstLeft-2)*.07);e.burstLeft--;e.burstWait=.22;if(!e.burstLeft)e.shotCd=2.6}}
    else if(e.shotCd<=0&&Math.abs(dx)<380){e.warningLeft=1.25;e.warnX=p.x;e.warnY=p.y+16}
    else if(Math.abs(dx)>200)e.x=clamp(e.x+Math.sign(dx)*16*dt,24,7970);
  }else if(e.type==='reactor'){
    e.timer+=dt;e.actionWait-=dt;e.summonWait-=dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){for(const z of e.attackPlan.zones)if(g.mobile.hazards.length<MOBILE.hazardLimit)g.mobile.hazards.push({...z,life:MOBILE.hazardLife,hit:false,damage:20});effect({kind:'mobileFire',x:e.x,y:100,life:.3,max:.3});e.attackPlan=null;e.actionWait=e.leftDestroyed?MOBILE.weakRecovery:MOBILE.recovery}}
    else if(e.actionWait<=0){const width=e.leftDestroyed?32:56;e.attackPlan={kind:'strike',zones:[{x:clamp(p.x,M05.bossX+40,7920),y:0,w:width,h:148}]};e.warningLeft=MOBILE.warning;e.actionIndex++}
    if(!e.rightDestroyed&&e.summonWait<=0){e.summonWait=MOBILE.summonInterval;for(let i=0;i<MOBILE.summonBatch&&g.liveMobs<MOBILE.summonLimit;i++){const x=clamp(p.x+(p.x<7480?260:-260)+i*42,M05.bossX+24,7950);if(Math.abs(x-p.x)>=180)spawn('assaultroller',x)}}
  }
}
export function updateMobileRepairs(g,dt){
  const m=g.mobile;let write=0;for(const link of m.repairs){link.life-=dt;if(link.life>0&&!link.from.dead&&!link.target.dead)m.repairs[write++]=link}m.repairs.length=write;
  m.repairWait-=dt;if(m.repairWait>0)return;m.repairWait=MOBILE.repairStep;
  let budget=MOBILE.repairBudget;const enemies=g.enemies,len=enemies.length;
  for(let n=0;n<len&&budget>0;n++){
    const d=enemies[(m.repairCursor+n)%len];if(d.dead||d.type!=='repairdrone'||g.time<(d.nextHeal??0))continue;
    d.nextHeal=g.time+MOBILE.repairInterval;let hits=0;
    const candidates=g.grid.query(d.x-MOBILE.repairRange,d.y-MOBILE.repairRange,d.x+MOBILE.repairRange,d.y+MOBILE.repairRange,m.repairScratch);
    for(const e of candidates){if(e===d||e.dead||e.fixedDevice||e.type==='reactor'||e.hp<=0||e.hp>=e.maxHp||g.time<(e.nextRepair??0)||Math.hypot(e.x-d.x,e.y-d.y)>MOBILE.repairRange)continue;
      const amount=Math.min(MOBILE.repairAmount,e.maxHp-e.hp);e.hp+=amount;e.nextRepair=g.time+MOBILE.repairInterval;budget--;hits++;
      if(m.repairs.length<MOBILE.repairLinks)m.repairs.push({from:d,target:e,life:.4});if(hits>=MOBILE.repairTargets||budget<=0)break;
    }
  }
  m.repairCursor=len?(m.repairCursor+MOBILE.repairBudget)%len:0;
}
export function updateMobileState(g,dt,hurt,effect){
  const m=g.mobile;m.travel+=MOBILE.runningSpeed*m.speed*dt;
  let w=0;for(const h of m.hazards){h.life-=dt;const p=g.player;if(!h.hit&&Math.abs(p.x-h.x)<h.w/2+7&&p.y+32>h.y&&p.y<h.y+h.h){hurt(h.damage,h.x);h.hit=true}if(h.life>0)m.hazards[w++]=h}m.hazards.length=w;
  if(m.collapseLeft>0){m.collapseLeft=Math.max(0,m.collapseLeft-dt);m.collapseTick-=dt;if(m.collapseTick<=0){m.collapseTick=.18;effect({kind:'mobileBreak',x:7480+Math.sin(g.time*17)*105,y:70+Math.cos(g.time*13)*38,life:.6,max:.6})}}
}
export function mobileObjective(g){
  const b=g.enemies.find(e=>e.type==='reactor'&&!e.dead),m=g.mobile;
  if(b)return b.shielded?b.leftDestroyed?'右装置を破壊：増援を停止':b.rightDestroyed?'左装置を破壊：砲撃を弱化':'左右装置を破壊（順序自由）':'中央動力炉を破壊せよ';
  return ['基地へ接近・足場から乗り込め',m.turretsOff?'ハッチ開放：内部へ進め':'外部砲塔2基を破壊せよ',m.driveOff?'駆動停止：制御中枢へ進め':'駆動装置を破壊せよ',m.controlOff?'装甲扉開放：動力炉へ進め':'制御盤を破壊・装甲扉を開け','動力炉の左右制御装置へ'][Math.max(0,g.area)];
}
export function drawMobileHud(c,g,zoom,offset=0){
  const m=g.mobile,b=g.enemies.find(e=>e.type==='reactor'&&!e.dead);c.save();c.fillStyle='#04101de8';c.fillRect(4,39,111,20);c.fillStyle='#ffe1a1';c.font='6px monospace';c.textAlign='left';
  const text=mobileObjective(g);c.fillText(text.slice(0,17),8,47);c.fillStyle='#afccc8';c.font='5px monospace';
  c.fillText(b?`砲撃:${b.leftDestroyed?'低下':'稼働'} 増援:${b.rightDestroyed?'停止':'稼働'}`:`走行 ${Math.round(m.speed*100)}% / ${m.turretsOff?'HATCH OPEN':'HATCH CLOSED'}`,8,55);
  let count=0;const targets=b&&!b.shielded?[b]:m.devices;
  for(const e of targets){if(e.dead||count>=4||!b&&Math.abs(e.x-g.player.x)>600)continue;const p=worldToScreen({x:e.x,y:e.y},g.camera,zoom);p.x+=offset;p.y+=offset;const x=clamp(p.x,12,308),y=clamp(p.y-15,91,133);c.fillStyle='#ffdf8b';c.font='6px monospace';const label=e.type==='reactor'?'CORE':e.partKind==='left'?'L 砲撃':e.partKind==='right'?'R 増援':e.partKind==='drive'?'DRIVE':e.partKind==='control'?'CONTROL':'TURRET';c.fillText((p.x<12?'<':p.x>308?'>':'')+label,clamp(x-12,4,267),y-3);c.beginPath();c.strokeStyle='#ffdf8b';c.moveTo(x-3,y);c.lineTo(x,y+3);c.lineTo(x+3,y);c.stroke();count++}
  if(b&&g.time<(b.shieldedUntil??0)){c.fillStyle='#b8e4e3';c.font='7px monospace';c.fillText('SHIELDED',144,76)}
  c.restore();return count;
}
