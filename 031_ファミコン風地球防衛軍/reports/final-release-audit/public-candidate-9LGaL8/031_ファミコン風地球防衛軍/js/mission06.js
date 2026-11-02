import {WORLD,clamp} from './data.js?v=0.6.0';
import {movePlayerBody} from './player.js?v=0.2.2';
import {frameSkyBoss} from './mission04.js?v=0.4.1';
import {createImpactState} from './impact.js?v=0.6.0';
import {AttackDirector} from './invasion.js?v=0.6.0';
import {worldToScreen} from './camera.js?v=0.6.0';

export const LIVING=Object.freeze({coreHp:3800,shellHp:120,pulseOpen:4,pulseWarning:1,pulseClosed:2,pulseReopen:.5,
  nodeCooldown:.8,nodeWindow:6,coreWindow:8,reconnectWarning:.75,signalTime:.6,defenseOff:8,
  forwardForce:24,reverseForce:-24,intermittentForce:32,flowWarning:1,flowOn:2,flowRest:3,
  bossWarning:1.35,bossRecovery:1.65,hazardLife:.25,shotLimit:48,hazardLimit:4,signalLimit:8,
  summonInterval:7,summonLimit:6,collapseDuration:1.8});
export const M06=Object.freeze({id:'M06',world:{...WORLD,width:8400,ground:260},bossX:7000,bossSpawnX:7420,
  areas:[{x:0,name:'巨体侵入口'},{x:1400,name:'脈動回廊'},{x:3100,name:'体液循環区画'},{x:4800,name:'神経伝達網'},{x:6500,name:'神経中枢'}],
  platforms:[{x:0,y:148,w:8400,h:112,solid:true,kind:'biofloor'},
    {x:0,y:0,w:8400,h:28,solid:true,kind:'bioceiling'},
    {x:440,y:136,w:64,h:12,solid:true,kind:'biorib'},{x:3340,y:136,w:56,h:12,solid:true,kind:'biorib'},
    {x:4200,y:124,w:48,h:24,solid:true,kind:'biorib'},{x:6040,y:136,w:64,h:12,solid:true,kind:'biorib'},
    {x:886,y:28,w:28,h:120,solid:true,kind:'shell',gate:'shell'},
    {x:1800,y:28,w:24,h:120,solid:true,kind:'pulse',gate:'pulse-1'},
    {x:2620,y:28,w:24,h:120,solid:true,kind:'pulse',gate:'pulse-2'},
    {x:5820,y:28,w:24,h:120,solid:true,kind:'neuralgate',gate:'network'}],
  encounters:[{id:'m6-entry',x:240,until:1320,pattern:'WAVE',enemy:'pulseworm',count:10,batch:2,interval:1.4},
    {id:'m6-pulse',x:1480,until:3000,pattern:'SWARM',enemy:'pulseworm',fraction:.6,batch:4,interval:1},
    {id:'m6-spores',x:3180,until:4700,pattern:'WAVE',enemy:'sporefly',count:12,batch:3,interval:2.4},
    {id:'m6-fluid',x:3480,until:4700,pattern:'SWARM',enemy:'pulseworm',fraction:.6,batch:4,interval:1},
    {id:'m6-network',x:4860,until:6320,pattern:'WAVE',enemy:'guardiancell',count:5,batch:1,interval:3},
    {id:'m6-deep',x:6060,until:6880,pattern:'SWARM',enemy:'sporefly',fraction:.5,batch:3,interval:1.2}]
});
export const createM06Geometry=()=>M06.platforms.map(p=>({...p,active:!['pulse','neuralgate'].includes(p.kind)}));
export function createLivingState(){return {pulses:[{x:1800,y:28,w:24,h:120,state:'OPEN',elapsed:0},{x:2620,y:28,w:24,h:120,state:'OPEN',elapsed:0}],
  flows:[{x:3180,w:430,force:24,kind:'FORWARD',active:true},{x:3740,w:500,force:-24,kind:'REVERSE',active:true},{x:4380,w:340,force:32,kind:'INTERMITTENT',active:false,state:'REST'}],
  nodes:[],signals:[],hazards:[],events:[],defenseUntil:0,networkState:'ACTIVE',shell:null,safeX:64,safeY:116,rescueWait:0,rescues:0,
  collapseLeft:0,collapseTick:0,flowOverride:null,pulseOverride:null,bossStart:'SHIELDED'};}
function log(g,event){const a=g.living.events;if(a.length>=32)a.shift();a.push({time:g.time,event})}
function fixed(g,type,x,y,w,h,partKind){const e={uid:g.nextEnemyId++,type,fixedDevice:true,partKind,x,y,w,h,hp:type==='bioshell'?LIVING.shellHp:1,maxHp:type==='bioshell'?LIVING.shellHp:1,dead:false,death:0,anim:0,hitFlash:0,face:1,shotCd:0,active:true,stoppedUntil:0,nextSignalAt:0};g.enemies.push(e);return e}
export function initializeLiving(g,area=0){
  const m=g.living;m.shell=fixed(g,'bioshell',900,84,28,64,'shell');
  if(area>0){m.shell.dead=true;m.shell.death=0;m.shell.hp=0;g.platforms.find(p=>p.gate==='shell').active=false}
  m.nodes.push(fixed(g,'neuralnode',5580,116,24,28,'network'));
  if(area>=4){m.defenseUntil=Infinity;m.networkState='DISABLED';g.platforms.find(p=>p.gate==='network').active=false}
}
const overlaps=(p,b)=>p.x+7>b.x&&p.x-7<b.x+b.w&&p.y+32>b.y&&p.y<b.y+b.h;
export function updateLivingTerrain(g,dt){
  const m=g.living,p=g.player;
  for(const pulse of m.pulses){const pl=g.platforms.find(b=>b.gate===`pulse-${pulse.x===1800?1:2}`);pulse.elapsed+=dt;
    const total=LIVING.pulseOpen+LIVING.pulseWarning+LIVING.pulseClosed+LIVING.pulseReopen,t=pulse.elapsed%total;
    let next=m.pulseOverride??(t<LIVING.pulseOpen?'OPEN':t<LIVING.pulseOpen+LIVING.pulseWarning?'WARNING':t<LIVING.pulseOpen+LIVING.pulseWarning+LIVING.pulseClosed?'CLOSED':'REOPEN');
    // Never create a collider around an occupant. A delayed WARNING remains
    // non-solid until clearance exists, even under a laboratory CLOSED override.
    if(next==='CLOSED'&&overlaps(p,pl)){next='WARNING';pulse.delayed=true}else pulse.delayed=false;
    pulse.state=next;pl.active=next==='CLOSED';
  }
  const gate=g.platforms.find(b=>b.gate==='network');
  let write=0;for(const s of m.signals){s.progress=Math.min(1,s.progress+dt/LIVING.signalTime);if(s.progress>=1){m.defenseUntil=g.time+LIVING.defenseOff;log(g,'NETWORK_DISABLED')}else m.signals[write++]=s}m.signals.length=write;
  const off=!m.nodes.some(n=>n.partKind==='network')||g.time<m.defenseUntil||overlaps(p,gate);gate.active=!off;m.networkState=off?'DISABLED':'ACTIVE';
  for(const f of m.flows){f.force=m.flowOverride?.force??(f.kind==='REVERSE'?LIVING.reverseForce:f.kind==='FORWARD'?LIVING.forwardForce:LIVING.intermittentForce);
    const phase=g.time%(LIVING.flowRest+LIVING.flowWarning+LIVING.flowOn);
    f.state=f.kind!=='INTERMITTENT'?'FLOW':phase<LIVING.flowRest?'REST':phase<LIVING.flowRest+LIVING.flowWarning?'WARNING':'FLOW';
    f.active=m.flowOverride?.active??f.state==='FLOW';
  }
}
export function applyLivingFlow(g,dt){
  const p=g.player;if(p.dead)return;
  // Fluid occupies feet y>=128 only; WING above the surface is unaffected.
  let force=0;for(const f of g.living.flows)if(f.active&&p.x>=f.x&&p.x<f.x+f.w&&p.y+32>=128)force+=f.force;
  if(!force)return;const vx=p.vx,vy=p.vy,grounded=p.onGround;p.vx=force;p.vy=0;movePlayerBody(p,g.platforms,dt,true);p.vx=vx;p.vy=vy;p.onGround=grounded&&p.y+32>=livingSurface(g,p.x)-.1;
}
export function livingSurface(g,x){let y=g.world.ground;for(const b of g.platforms)if(b.active!==false&&!['bioceiling','pulse','shell','neuralgate'].includes(b.kind)&&x>b.x&&x<b.x+b.w)y=Math.min(y,b.y);return y}
export function recoverLivingPlayer(g,dt,hurt,effect){
  const m=g.living,p=g.player;m.rescueWait=Math.max(0,m.rescueWait-dt);if(p.onGround&&p.y<150&&!g.platforms.some(b=>b.active!==false&&overlaps(p,b))){m.safeX=p.x;m.safeY=p.y}
  if(p.y<205||p.dead)return;
  for(let n=0;n<350;n++)for(const sign of n?[-1,1]:[1]){const x=clamp(m.safeX+n*24*sign,g.bossStarted?M06.bossX:16,8370),y=livingSurface(g,x)-32,candidate={x,y};
    if(y>150||g.platforms.some(b=>b.active!==false&&overlaps(candidate,b))||g.enemies.some(e=>!e.dead&&!e.fixedDevice&&Math.abs(e.x-x)<e.w/2+15))continue;
    Object.assign(p,{x,y,vx:0,vy:0,onGround:true});m.rescues++;if(!m.rescueWait){hurt(12,x-1);m.rescueWait=1.2}effect({kind:'livingFoam',x,y:y+32,life:.4,max:.4});return;
  }
}
export function hitLivingNode(g,e,effect){
  if(e.type!=='neuralnode')return false;
  const m=g.living,b=g.enemies.find(a=>a.type==='neuralheart'&&!a.dead);
  if(g.time<(e.nextSignalAt??0)||g.time<(e.stoppedUntil??0)||e.partKind!=='network'&&(!b||!b.shielded||g.time<(b.reconnectUntil??0)))return true;
  e.nextSignalAt=g.time+LIVING.nodeCooldown;e.stoppedUntil=g.time+(e.partKind==='network'?LIVING.signalTime+LIVING.defenseOff:LIVING.nodeWindow);e.hitFlash=.15;
  if(e.partKind==='network'){if(m.signals.length<LIVING.signalLimit)m.signals.push({fromX:e.x,toX:5832,progress:0});log(g,'NODE_SIGNAL')}
  else {log(g,e.partKind.toUpperCase()+'_STOPPED');const other=m.nodes.find(n=>n!==e&&n.partKind!=='network');
    if(other&&other.stoppedUntil>g.time){b.shielded=false;b.openUntil=g.time+LIVING.coreWindow;for(const n of m.nodes)n.stoppedUntil=b.openUntil;b.warningLeft=0;b.attackPlan=null;b.actionWait=1.5;m.hazards.length=0;g.enemyShots.length=0;log(g,'CORE_OPEN');effect({kind:'livingShield',x:b.x,y:b.y+40,life:.6,max:.6})}
  }
  effect({kind:'livingSignal',x:e.x,y:e.y+12,life:.3,max:.3});return true;
}
export const livingDamage=(g,e,damage)=>e.type==='neuralheart'&&e.shielded?0:damage;
export const livingCore=e=>({x:e.x,y:e.y+40,r:24,open:!e.dead&&!e.shielded});
export function livingPartDestroyed(g,e,effect){if(e.type==='bioshell'){g.platforms.find(b=>b.gate==='shell').active=false;log(g,'SHELL_BROKEN');effect({kind:'livingCollapse',x:e.x,y:e.y+24,life:.6,max:.6})}}
export function resetLivingBoss(g,b,start='SHIELDED'){
  const allowed=['SHIELDED','LEFT','RIGHT','OPEN','HP65','HP30'];if(!allowed.includes(start))start='SHIELDED';
  g.enemies.length=0;g.enemies.push(b);g.liveEnemies=1;g.liveMobs=0;g.shots.length=g.enemyShots.length=g.effects.length=0;
  g.impact=createImpactState();g.attacks=new AttackDirector();g.shake=0;g.clear=false;g.arsenal.installations.length=g.arsenal.jobs.length=g.arsenal.pending.length=0;
  g.living=createLivingState();for(const p of g.platforms)if(p.gate)p.active=false;g.living.bossStart=start;g.living.safeX=g.player.x;g.living.safeY=g.player.y;
  const hp=LIVING.coreHp*(start==='HP65'?.65:start==='HP30'?.30:1);
  Object.assign(b,{hp,maxHp:LIVING.coreHp,hpPhase:hp<=LIVING.coreHp*.30?3:hp<=LIVING.coreHp*.65?2:1,shielded:start!=='OPEN',openUntil:start==='OPEN'?g.time+LIVING.coreWindow:0,reconnectUntil:0,dead:false,death:0,deathTracked:false,timer:0,warningLeft:0,attackPlan:null,actionWait:1.6,actionIndex:0,summonWait:LIVING.summonInterval,shieldedUntil:0,vx:0,vy:0});
  for(const [kind,x] of [['left',7320],['right',7520]]){const n=fixed(g,'neuralnode',x,116,24,28,kind);if(start===kind.toUpperCase()||start==='OPEN')n.stoppedUntil=g.time+(start==='OPEN'?LIVING.coreWindow:LIVING.nodeWindow);g.living.nodes.push(n)}
  b.activeParts=g.living.nodes;g.bossStarted=true;log(g,'BOSS_RESET_'+start);
}
export const frameLivingBoss=g=>frameSkyBoss(g);
function spore(g,e,x,y,angle=0){if(g.enemyShots.length>=LIVING.shotLimit)return;const a=Math.atan2(y-e.y-12,x-e.x)+angle;g.enemyShots.push({kind:'livingSpore',x:e.x,y:e.y+12,vx:Math.cos(a)*100,vy:Math.sin(a)*100,w:6,h:6,damage:e.type==='neuralheart'?14:10,life:4,normal:e.type!=='neuralheart'})}
function planAttack(e,g){
  const p=g.player,index=e.actionIndex++%3,kind=index===0?'tentacle':index===1?'spore':'pulse';
  // All hazards are serialized: a full warning, one active strike, recovery.
  // A 64px stripe needs (32+7)/65+.25=.85s for GUARDIAN <1.35s.
  const z=kind==='pulse'?{x:clamp(p.x,7040,8310),y:120,w:e.hpPhase===3?96:80,h:28}:{x:clamp(p.x,7040,8310),y:28,w:e.hpPhase===1?56:64,h:120};
  e.attackPlan={kind,zones:[z]};e.warnX=p.x;e.warnY=p.y+16;e.warningLeft=LIVING.bossWarning;
}
export function updateLivingEnemy(g,e,dt,spawn,effect){
  if(e.fixedDevice)return;const p=g.player,dx=p.x-e.x;
  if(e.type==='pulseworm'){
    const pulse=g.living.pulses.find(a=>Math.abs(a.x-e.x)<600),ready=!pulse||['WARNING','REOPEN'].includes(pulse.state);
    e.recoverLeft=Math.max(0,(e.recoverLeft??0)-dt);
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){e.dashLeft=.35;e.vx=Math.sign(e.warnX-e.x)*100}}
    else if(e.dashLeft>0){e.x+=e.vx*dt;e.dashLeft=Math.max(0,e.dashLeft-dt);if(!e.dashLeft)e.recoverLeft=1.1}
    else if(!e.recoverLeft){e.x+=Math.sign(dx)*28*e.speedScale*dt;if(ready&&Math.abs(dx)<160&&g.attacks.dive(g.time)){e.warningLeft=.8;e.warnX=p.x;e.warnY=p.y+16}}
    e.x=clamp(e.x,24,8370);e.y=livingSurface(g,e.x)-e.h;
  }else if(e.type==='sporefly'){
    e.x=clamp(e.x+Math.sign(dx)*22*e.speedScale*dt,24,8370);e.y=clamp(62+Math.sin(e.anim*.45+e.uid)*25,32,105);
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){spore(g,e,e.warnX,e.warnY);e.shotCd=2.8}}
    else if(Math.abs(dx)<340&&e.shotCd<=0&&g.attacks.ranged(g.time)){e.warningLeft=.9;e.warnX=p.x;e.warnY=p.y+16}
  }else if(e.type==='guardiancell'){
    e.recoverLeft=Math.max(0,(e.recoverLeft??0)-dt);e.y=livingSurface(g,e.x)-e.h;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){if(g.living.hazards.length<LIVING.hazardLimit)g.living.hazards.push({x:e.warnX,y:88,w:44,h:60,life:.2,damage:18,hit:false});e.recoverLeft=1.5}}
    else if(!e.recoverLeft){if(Math.abs(dx)>64)e.x=clamp(e.x+Math.sign(dx)*16*e.speedScale*dt,24,8370);else if(g.attacks.dive(g.time)){e.warnX=p.x;e.warningLeft=1.1}}
  }else if(e.type==='neuralheart'){
    e.hpPhase=e.hp<=e.maxHp*.3?3:e.hp<=e.maxHp*.65?2:1;
    if(!e.shielded&&g.time>=e.openUntil){e.shielded=true;e.reconnectUntil=g.time+LIVING.reconnectWarning;for(const n of g.living.nodes){n.stoppedUntil=0;n.nextSignalAt=e.reconnectUntil}log(g,'CORE_SHIELDED')}
    e.timer+=dt;e.actionWait-=dt;e.summonWait-=dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){const plan=e.attackPlan;
      if(plan.kind==='spore'){for(let i=0;i<e.hpPhase+1;i++)spore(g,e,e.warnX,e.warnY,(i-e.hpPhase/2)*.14)}
      else for(const z of plan.zones)if(g.living.hazards.length<LIVING.hazardLimit)g.living.hazards.push({...z,life:LIVING.hazardLife,damage:20,hit:false});
      effect({kind:'livingPulse',x:e.warnX,y:128,life:.3,max:.3});e.attackPlan=null;e.actionWait=LIVING.bossRecovery;
    }}else if(e.actionWait<=0)planAttack(e,g);
    if(e.hpPhase>=2&&e.summonWait<=0){e.summonWait=LIVING.summonInterval;if(g.liveMobs<LIVING.summonLimit)spawn('sporefly',clamp(p.x+(p.x<e.x?240:-240),7040,8320),60)}
  }
}
export function updateLivingState(g,dt,hurt,effect){
  const m=g.living;let w=0;for(const h of m.hazards){h.life-=dt;if(!h.hit&&Math.abs(g.player.x-h.x)<h.w/2+7&&g.player.y+32>h.y&&g.player.y<h.y+h.h){if(g.lab?.run?.mode!=='A')hurt(h.damage,h.x);h.hit=true}if(h.life>0)m.hazards[w++]=h}m.hazards.length=w;
  if(m.collapseLeft>0){m.collapseLeft=Math.max(0,m.collapseLeft-dt);m.collapseTick-=dt;if(m.collapseTick<=0){m.collapseTick=.16;effect({kind:'livingCollapse',x:7420+Math.sin(g.time*17)*72,y:82+Math.cos(g.time*13)*36,life:.6,max:.6})}}
}
export function livingObjective(g){const b=g.enemies.find(e=>e.type==='neuralheart'&&!e.dead);if(!b)return ['外殻を射撃して侵入せよ','脈動壁の開放を待って通過','流向を確認・逆流を突破せよ','神経ノードを撃ち防御を停止','左右の神経ノードへ'][Math.max(0,g.area)];
  return !b.shielded?b.openUntil-g.time<1.5?'まもなく再防御':'中央神経核を攻撃せよ':g.living.nodes.some(n=>n.stoppedUntil>g.time)?'残りの神経ノードを停止せよ':'左右の神経ノードを停止せよ';}
export function drawLivingHud(c,g,zoom,offset=0){
  const m=g.living,b=g.enemies.find(e=>e.type==='neuralheart'&&!e.dead);c.save();c.fillStyle='#071522ee';c.fillRect(4,39,112,21);c.font='6px monospace';c.fillStyle='#e5e7ba';c.fillText(livingObjective(g).slice(0,18),7,47);c.font='5px monospace';c.fillStyle='#a3ded4';
  c.fillText(b?`L:${m.nodes[0]?.stoppedUntil>g.time?'STOP':'ON'} R:${m.nodes[1]?.stoppedUntil>g.time?'STOP':'ON'} ${b.shielded?'SHIELD':Math.max(0,b.openUntil-g.time).toFixed(1)+'s'}`:g.area===1?m.pulses.map(a=>a.state).join(' / '):g.area===3?`防御 ${m.networkState}`:'LIVING COLOSSUS',7,56);
  let count=0;for(const e of b?b.shielded?m.nodes:[b]:m.nodes){if(count>=3||!b&&Math.abs(e.x-g.player.x)>600)continue;const p=worldToScreen({x:e.x,y:e.y},g.camera,zoom);const x=clamp(p.x+offset,12,308),y=clamp(p.y-16+offset,91,133);c.fillStyle='#cfe9b6';c.font='6px monospace';c.fillText((p.x<12?'<':p.x>308?'>':'')+(e.type==='neuralheart'?'CORE':e.partKind==='left'?'L NODE':e.partKind==='right'?'R NODE':'NODE'),clamp(x-14,4,270),y);c.fillRect(x-2,y+3,5,2);count++}
  if(b&&g.time<(b.shieldedUntil??0)){c.fillStyle='#abdfd3';c.fillText('SHIELDED',145,76)}c.restore();return count;
}
