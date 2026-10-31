import {WORLD,ENEMY_TYPES,clamp} from './data.js?v=1.0.0';
import {createMothershipAIView,updateMothershipEnemy,updateCommands,mothershipDamage,safeMothershipSpawn,mothershipSurface} from './mission07.js?v=0.9.0';
import {refreshSkyVisuals,updateSkyHazards,frameSkyBoss} from './mission04.js?v=0.4.1';
import {updateMobileRepairs} from './mission05.js?v=0.5.0';
import {advanceCoastalFormations} from './mission03.js?v=0.3.1';
import {createImpactState} from './impact.js?v=0.6.0';
import {AttackDirector} from './invasion.js?v=0.6.0';
import {worldToScreen} from './camera.js?v=0.6.0';

export const FINAL=Object.freeze({formHp:[2400,3200,4000],nodeHp:180,controlHp:140,transitionTime:1.4,phaseGrace:1.8,
  warning:1.5,chargeWarning:1.6,recovery:1.5,pulseRecovery:1.05,hazardLife:.22,hazardLimit:4,shotLimit:48,
  shieldOpen:8,shieldClosed:2,shieldWarning:.75,summonInterval:8,summonLimit:6,collapseTime:3,
  orderWarning:.9,orderActive:3,orderCooldown:5,orderRange:240,orderTargets:6});
export const M08_RADIO=Object.freeze([
  '未知信号は母艦深層から発信。停止した司令中枢の奥へ進め',
  '侵略軍の最後の防衛部隊だ。支援機を優先して撃破せよ',
  '機械・生体・母艦防衛の3制御信号を遮断せよ',
  '要塞も移動基地も巨大生物も同じ信号網の一部だった',
  '真の信号源を確認。母艦と結合した生命体、オーバーマインドを撃破せよ']);
export const FINAL_REVEAL=Object.freeze([
  'M07で破壊したのは母艦の司令中枢に過ぎない。',
  '機械兵器と生体兵器は共通の指揮信号で制御されていた。',
  'M04の要塞、M05の移動基地、M06の巨大生物も信号網の一部だった。',
  '真の指揮生命体オーバーマインドは、母艦そのものと結合している。']);
export const M08=Object.freeze({id:'M08',world:{...WORLD,width:10000,ground:260},bossX:8380,bossSpawnX:9200,
  areas:[{x:0,name:'母艦深層'},{x:1700,name:'侵略兵器総力戦'},{x:3700,name:'侵略制御網'},{x:5700,name:'真の指揮者'},{x:7700,name:'最終決戦'}],
  platforms:[{x:0,y:148,w:10000,h:112,solid:true,kind:'hull'},{x:0,y:0,w:10000,h:20,solid:true,kind:'ceiling'},
    {x:460,y:136,w:64,h:12,solid:true,kind:'container'},{x:2260,y:124,w:64,h:24,solid:true,kind:'container'},
    {x:3980,y:136,w:64,h:12,solid:true,kind:'container'},{x:6280,y:124,w:64,h:24,solid:true,kind:'container'},
    {x:1460,y:20,w:24,h:128,solid:true,kind:'gate',gate:'deep'},
    {x:5520,y:20,w:24,h:128,solid:true,kind:'gate',gate:'control'}],
  encounters:[
    {id:'f-entry',x:220,until:1630,pattern:'WAVE',enemy:'coreguard',count:6,batch:2,interval:2.5},
    {id:'f-entry-bio',x:700,until:1630,pattern:'WAVE',enemy:'biobreaker',count:3,batch:1,interval:3},
    {id:'f-a-ground',x:1740,until:2380,pattern:'SWARM',enemy:'assaultroller',fraction:.35,batch:3,interval:1.3},
    {id:'f-a-support',x:1740,until:2380,pattern:'WAVE',enemy:'shielddrone',count:3,batch:1,interval:3},
    {id:'f-b-gun',x:2400,until:3020,pattern:'WAVE',enemy:'siegebeetle',count:4,batch:1,interval:3},
    {id:'f-b-repair',x:2400,until:3020,pattern:'WAVE',enemy:'repairdrone',count:3,batch:1,interval:3},
    {id:'f-c-command',x:3000,until:3620,pattern:'WAVE',enemy:'commanddrone',count:3,batch:1,interval:3},
    {id:'f-c-air',x:3000,until:3620,pattern:'SWARM',enemy:'skyray',fraction:.35,batch:3,interval:1.8,formation:'V'},
    {id:'f-mechanical',x:3740,until:5480,pattern:'WAVE',enemy:'sentrywalker',count:6,batch:2,interval:3},
    {id:'f-biological',x:3740,until:5480,pattern:'SWARM',enemy:'sporefly',fraction:.4,batch:3,interval:2},
    {id:'f-control',x:4140,until:5480,pattern:'WAVE',enemy:'overseer',count:4,batch:1,interval:4},
    {id:'f-source',x:5740,until:7610,pattern:'WAVE',enemy:'biobreaker',count:8,batch:2,interval:3},
    {id:'f-source-guard',x:5980,until:7610,pattern:'WAVE',enemy:'coreguard',count:8,batch:2,interval:2.5},
    {id:'f-source-support',x:6420,until:7610,pattern:'WAVE',enemy:'overseer',count:4,batch:1,interval:3},
    {id:'f-final',x:7740,until:8320,pattern:'SWARM',enemy:'coreguard',fraction:.4,batch:3,interval:1.5}]
});
export const FINAL_SQUADS=Object.freeze({A:['shielddrone','assaulttitan'],B:['repairdrone','siegebeetle'],C:['commanddrone','skyray'],D:['overseer','coreguard'],E:['biobreaker','crawler']});
export const createM08Geometry=()=>M08.platforms.map(b=>({...b,active:true}));
export function createFinalState(){return {devices:[],network:{mechanical:true,biological:true,defense:true},hazards:[],events:[],entryOpen:false,networkOpen:false,
  mechanicalWait:4,biologicalWait:6,defenseWait:3,networkPlan:null,radioIndex:-1,radioUntil:0,revealSeen:false,revealLeft:0,
  collapseLeft:0,collapseTick:0,collapseStage:0,finalDefeated:false,endingStarted:false,formStats:[],safeX:64,safeY:116,rescues:0,orderWait:0};}
function log(g,event){const a=g.finalDefense.events;if(a.length>=64)a.shift();a.push({time:g.time,event})}
function fixed(g,kind,x,hp=FINAL.controlHp){const d={uid:g.nextEnemyId++,type:'defensenode',partKind:kind,fixedDevice:true,x,y:116,w:28,h:32,hp,maxHp:hp,dead:false,death:0,anim:0,active:true,face:1};g.enemies.push(d);g.finalDefense.devices.push(d);return d}
export function initializeFinal(g,area=0){const f=g.finalDefense;f.ai=createMothershipAIView(g);fixed(g,'deep',1310);for(const [k,x] of [['mechanical',4140],['biological',4700],['defense',5260]])fixed(g,k,x);
  if(area>0){f.entryOpen=true;f.devices[0].dead=true;f.devices[0].hp=0}
  if(area>2){f.networkOpen=true;for(const k of Object.keys(f.network))f.network[k]=false;for(const d of f.devices.slice(1)){d.dead=true;d.hp=0}}
  f.radioIndex=area;f.radioUntil=g.time+6;syncFinalGates(g);
}
const occupied=(p,b)=>p.x+7>b.x&&p.x-7<b.x+b.w&&p.y+32>b.y&&p.y<b.y+b.h;
export function syncFinalGates(g){const f=g.finalDefense;for(const b of g.platforms)if(b.gate)b.active=!(g.bossStarted||(b.gate==='deep'?f.entryOpen:f.networkOpen))&&!occupied(g.player,b)}
export const finalSurface=mothershipSurface;
export function safeFinalSpawn(g,type,x,y){return safeMothershipSpawn(g,type==='overseer'?'commanddrone':type==='overmind'?'commandcore':type,x,y)}
export function recoverFinalPlayer(g){const p=g.player,f=g.finalDefense;if(p.onGround&&p.y<=116&&!g.platforms.some(b=>b.active!==false&&occupied(p,b))){f.safeX=p.x;f.safeY=p.y}if(p.y<=205||p.dead)return;
  for(let n=0;n<420;n++)for(const side of n?[-1,1]:[1]){const x=clamp(f.safeX+n*24*side,g.bossStarted?M08.bossX:16,9960),y=finalSurface(g,x)-32;if(y>150||g.platforms.some(b=>b.active!==false&&occupied({x,y},b))||g.enemies.some(e=>!e.dead&&!e.fixedDevice&&Math.abs(e.x-x)<e.w/2+15))continue;Object.assign(p,{x,y,vx:0,vy:0,onGround:true,invuln:Math.max(p.invuln,.8)});f.rescues++;return true}
}
export function finalDamage(g,e,damage){if(e.type==='overmind'&&(e.shielded||e.transitionLeft>0||e.finalDefeated))return 0;if(e.type==='coreguard'&&e.guardState==='GUARD')return damage*.25;return mothershipDamage(g.finalDefense.ai,e,damage)}
export const finalCore=e=>({x:e.x,y:e.y+32,r:24,open:!e.dead&&!e.shielded&&!e.transitionLeft});
export function recordFinalHit(g,e,base,applied){if(e.type!=='overmind')return;const row=g.finalDefense.formStats[e.form-1];if(!row)return;row.attempts++;if(applied>0){row.accepted++;row.damage+=Math.min(e.hp,applied)}}
function stats(form,time){return {form,startedAt:time,endedAt:null,duration:null,damage:0,attempts:0,accepted:0,nodeReleases:0}}
export function finalPartDestroyed(g,d,effect){const f=g.finalDefense;if(d.partKind==='deep')f.entryOpen=true;
  if(Object.hasOwn(f.network,d.partKind)){f.network[d.partKind]=false;f.networkOpen=Object.values(f.network).every(v=>!v);if(d.partKind==='defense')f.networkPlan=null}
  const b=g.enemies.find(e=>e.type==='overmind'&&!e.dead);if(b&&d.partKind.startsWith('boss')){f.formStats[0].nodeReleases++;if(f.devices.every(n=>n.dead)){b.shielded=false;b.actionWait=FINAL.phaseGrace;b.warningLeft=0;b.attackPlan=null;f.hazards.length=0;g.enemyShots.length=0;log(g,'FORM1_OPEN')}}syncFinalGates(g);effect({kind:'finalCollapse',x:d.x,y:d.y+16,life:.5,max:.5});log(g,d.partKind+'_OFF');
}
function clearCombat(g,b){g.enemies.length=0;g.enemies.push(b);g.liveEnemies=1;g.liveMobs=0;g.shots.length=g.enemyShots.length=g.effects.length=0;g.arsenal.installations.length=g.arsenal.jobs.length=g.arsenal.pending.length=0;g.finalDefense.hazards.length=0;g.finalDefense.networkPlan=null;g.impact=createImpactState();g.attacks=new AttackDirector();g.shake=0;g.finalDefense.ai=createMothershipAIView(g)}
export function resetFinalBoss(g,b,form=1,mask=0){form=clamp(Math.floor(Number(form)||1),1,3);mask=clamp(Math.floor(Number(mask)||0),0,3);g.finalDefense=createFinalState();g.finalDefense.ai=createMothershipAIView(g);clearCombat(g,b);const f=g.finalDefense;f.entryOpen=f.networkOpen=true;for(const k of Object.keys(f.network))f.network[k]=false;
  Object.assign(b,{x:M08.bossSpawnX,y:68,form,hp:FINAL.formHp[form-1],maxHp:FINAL.formHp[form-1],shielded:form===1&&mask!==3,dead:false,death:0,deathTracked:false,transitionLeft:0,finalDefeated:false,timer:0,actionIndex:0,actionWait:FINAL.phaseGrace,warningLeft:0,attackPlan:null,summonWait:FINAL.summonInterval,shieldClock:0,chargeLeft:0,vx:0,vy:0});
  f.formStats=Array.from({length:3},(_,i)=>stats(i+1,g.time));if(form===1){let n=0;for(const [kind,x] of [['boss-left',8760],['boss-right',9460]]){const d=fixed(g,kind,x,FINAL.nodeHp);d.dead=!!(mask&(1<<n++));if(d.dead)d.hp=0}}b.activeParts=f.devices;g.bossStarted=true;f.safeX=g.player.x;f.safeY=g.player.y;syncFinalGates(g);log(g,'BOSS_FORM_'+form);
}
export const frameFinalBoss=g=>frameSkyBoss(g);
export function beginFinalTransition(g,b){if(b.form>=3||b.transitionLeft>0||b.dead)return false;const f=g.finalDefense,row=f.formStats[b.form-1];row.endedAt=g.time;row.duration=g.time-row.startedAt;clearCombat(g,b);f.devices.length=0;b.activeParts=f.devices;b.transitionLeft=FINAL.transitionTime;b.shielded=true;b.warningLeft=0;b.attackPlan=null;b.chargeLeft=0;g.player.invuln=Math.max(g.player.invuln,FINAL.transitionTime+FINAL.phaseGrace);log(g,'TRANSITION_'+b.form);return true}
export function startFinalCollapse(g,b){if(g.finalDefense.finalDefeated)return false;const f=g.finalDefense;f.finalDefeated=b.finalDefeated=true;f.collapseLeft=FINAL.collapseTime;f.collapseStage=0;f.hazards.length=0;g.enemyShots.length=g.shots.length=0;const row=f.formStats[2];row.endedAt=g.time;row.duration=g.time-row.startedAt;g.player.invuln=99;log(g,'CORE_DESTROYED');return true}
function hazard(g,z,damage=20){if(g.finalDefense.hazards.length<FINAL.hazardLimit)g.finalDefense.hazards.push({...z,damage,life:FINAL.hazardLife,hit:false})}
function projectile(g,e,x,y,angle=0){if(g.enemyShots.length>=FINAL.shotLimit)return;const a=Math.atan2(y-e.y-32,x-e.x)+angle;g.enemyShots.push({kind:'finalSpore',x:e.x,y:e.y+32,vx:Math.cos(a)*120,vy:Math.sin(a)*120,w:6,h:6,damage:16,life:4,normal:e.type!=='overmind'})}
function groundMove(g,e,dx){let x=clamp(e.x+dx,e.w/2+1,g.world.width-e.w/2-1);for(const b of g.platforms)if(b.active!==false&&b.y<e.y+e.h-.1&&b.y+b.h>e.y&&x+e.w/2>b.x&&x-e.w/2<b.x+b.w){x=dx>0?b.x-e.w/2:b.x+b.w+e.w/2;break}e.x=x;e.y=finalSurface(g,x)-e.h}
function planBoss(g,b){const p=g.player,index=b.actionIndex++%3,kind=b.form===1?'beam':b.form===2?['tentacle','charge','spore'][index]:['pulse','wave','spore'][index];
  const x=clamp(p.x,M08.bossX+45,9920),wide=kind==='wave',charge=kind==='charge',target=clamp(b.x+(p.x<b.x?-180:180),8640,9680);
  const zones=charge?[{x:(b.x+target)/2,y:132,w:Math.abs(target-b.x)+64,h:16}]:[{x,y:wide?128:20,w:wide?96:64,h:wide?20:128}];
  b.warnX=x;b.warnY=p.y+16;b.warningLeft=charge?FINAL.chargeWarning:FINAL.warning;b.attackPlan={kind,zones,targetX:target,originX:b.x};
}
export function updateFinalEnemy(g,e,dt,spawn,effect){const f=g.finalDefense,p=g.player,dx=p.x-e.x;if(e.fixedDevice)return true;
  if(e.type==='overseer'){e.x=clamp(e.x+Math.sign(dx)*18*dt,24,9960);e.y=52+Math.sin(e.anim*.4)*12;e.orderWait=(e.orderWait??2)-dt;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){e.orderActiveUntil=g.time+FINAL.orderActive;e.orderWait=FINAL.orderCooldown;effect({kind:'finalPulse',x:e.x,y:e.y+14,life:.4,max:.4})}}
    else if(e.orderWait<=0){e.warningLeft=FINAL.orderWarning;e.warnX=e.x;e.warnY=e.y+12}
  }else if(e.type==='biobreaker'){e.recoverLeft=Math.max(0,(e.recoverLeft??0)-dt);if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){for(const z of e.attackPlan.zones)hazard(g,z,22);e.attackPlan=null;e.recoverLeft=1.8}}
    else if(!e.recoverLeft){if(Math.abs(dx)>85)groundMove(g,e,Math.sign(dx)*18*e.speedScale*dt);if(Math.abs(dx)<160&&g.attacks.dive(g.time)){e.warningLeft=1.5;e.attackPlan={kind:'break',zones:[{x:e.x+(Math.sign(dx)||1)*52,y:120,w:96,h:28}]}}}
  }else if(e.type==='coreguard'){e.guardClock=(e.guardClock??(e.uid%3))+dt;e.guardState=e.guardClock%5<1.6?'GUARD':'OPEN';e.y=finalSurface(g,e.x)-e.h;
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){projectile(g,e,e.warnX,e.warnY);e.shotCd=2.6}}
    else if(e.guardState==='OPEN'&&e.shotCd<=0&&Math.abs(dx)<340&&g.attacks.ranged(g.time)){e.warningLeft=.9;e.warnX=p.x;e.warnY=p.y+16}
    else if(Math.abs(dx)>180)groundMove(g,e,Math.sign(dx)*20*e.speedScale*dt);
  }else if(e.type==='overmind'){
    if(e.transitionLeft>0){e.transitionLeft=Math.max(0,e.transitionLeft-dt);if(!e.transitionLeft){e.form++;e.hp=e.maxHp=FINAL.formHp[e.form-1];e.shielded=false;e.shieldClock=0;e.timer=0;e.actionIndex=0;e.actionWait=FINAL.phaseGrace;e.summonWait=FINAL.summonInterval;e.x=M08.bossSpawnX;e.y=68;f.formStats[e.form-1].startedAt=g.time;frameFinalBoss(g);effect({kind:'finalTransition',x:e.x,y:e.y+32,life:.8,max:.8});log(g,'FORM_'+e.form)}return true}
    e.timer+=dt;e.actionWait-=dt;e.summonWait-=dt;
    if(e.form===3){e.shieldClock+=dt;const shield=e.shieldClock%(FINAL.shieldOpen+FINAL.shieldClosed)>=FINAL.shieldOpen;if(shield!==e.shielded){e.shielded=shield;effect({kind:'finalShield',x:e.x,y:e.y+32,life:.4,max:.4});log(g,shield?'CORE_GUARD':'CORE_REOPEN')}}
    if(e.chargeLeft>0){const step=Math.min(dt,e.chargeLeft);e.x=clamp(e.x+e.vx*step,8640,9680);e.chargeLeft=Math.max(0,e.chargeLeft-dt)}
    else if(e.form===2&&!e.warningLeft&&Math.abs(dx)>200)e.x=clamp(e.x+Math.sign(dx)*12*dt,8640,9680);
    if(e.warningLeft>0){e.warningLeft=Math.max(0,e.warningLeft-dt);if(!e.warningLeft){const a=e.attackPlan;if(a.kind==='spore'){for(let i=-1;i<=1;i++)projectile(g,e,e.warnX,e.warnY,i*.16)}else for(const z of a.zones)hazard(g,z);
      if(a.kind==='charge'){e.chargeLeft=.5;e.vx=(a.targetX-e.x)/.5}e.attackPlan=null;e.actionWait=e.form===3?FINAL.pulseRecovery:FINAL.recovery;effect({kind:'finalPulse',x:e.warnX,y:128,life:.3,max:.3})}}
    else if(e.actionWait<=0&&!e.chargeLeft)planBoss(g,e);
    if(e.form===1&&e.summonWait<=0){e.summonWait=FINAL.summonInterval;for(let i=0;i<2&&g.liveMobs<FINAL.summonLimit;i++){const x=clamp(p.x+(p.x<9200?240:-240)+i*40,M08.bossX+40,9920);if(Math.abs(x-p.x)>150)spawn('coreguard',x)}}
  }else return updateMothershipEnemy(f.ai,e,dt,spawn,effect);return true;
}
function support(g,dt){const f=g.finalDefense,view=f.ai,m=view.mothership;
  let w=0;for(const l of m.links){if(l.from.type==='overseer'&&g.time>=(l.from.orderActiveUntil??0)){if(l.target.linkedCommander===l.from.uid)delete l.target.linkedCommander}else m.links[w++]=l}m.links.length=w;
  updateCommands(view,dt);f.orderWait-=dt;if(f.orderWait<=0){f.orderWait=.2;for(const d of g.enemies){if(d.dead||d.type!=='overseer'||g.time>=(d.orderActiveUntil??0))continue;let count=0;const near=g.grid.query(d.x-FINAL.orderRange,d.y-FINAL.orderRange,d.x+FINAL.orderRange,d.y+FINAL.orderRange,f.supportScratch??=[]);
    for(const e of near){if(count>=FINAL.orderTargets||m.links.length>=12)break;if(e===d||e.dead||e.fixedDevice||['overmind','overseer','commanddrone'].includes(e.type)||e.linkedCommander||Math.hypot(e.x-d.x,e.y-d.y)>FINAL.orderRange)continue;e.linkedCommander=d.uid;e.shotCd=Math.max(e.shotCd??0,.6+count*.3);e.diveCd=Math.max(e.diveCd??0,.6+count*.3);m.links.push({from:d,target:e});count++}}
  }refreshSkyVisuals(m.skyView);updateMobileRepairs(m.mobileView,dt);
}
export function updateFinalState(g,dt,hurt,effect,spawn){const f=g.finalDefense,p=g.player;syncFinalGates(g);
  if(f.radioIndex!==g.area){f.radioIndex=g.area;f.radioUntil=g.time+6;if(g.area===3&&!f.revealSeen){f.revealSeen=true;f.revealLeft=8;log(g,'OVERMIND_REVEAL')}}f.revealLeft=Math.max(0,f.revealLeft-dt);
  const combat=g.lab?.run?.mode!=='A'&&!p.dead&&!g.clear&&!f.finalDefeated;
  if(combat){support(g,dt);advanceCoastalFormations(f.ai.mothership.coastView,dt);updateSkyHazards(f.ai.mothership.skyView,dt,hurt,effect);
    for(const z of f.ai.mothership.livingView.living.hazards)if(f.hazards.length<FINAL.hazardLimit)f.hazards.push(z);f.ai.mothership.livingView.living.hazards.length=0;
    if(!g.bossStarted&&g.area>=2&&g.area<=3){f.mechanicalWait-=dt;f.biologicalWait-=dt;f.defenseWait-=dt;
      if(f.mechanicalWait<=0){f.mechanicalWait=f.network.mechanical?5:16;spawn('coreguard',clamp(p.x+240,3740,7580))}
      if(f.biologicalWait<=0){f.biologicalWait=f.network.biological?6:18;spawn('biobreaker',clamp(p.x+260,3740,7580))}
      if(f.networkPlan){f.networkPlan.left-=dt;if(f.networkPlan.left<=0){hazard(g,f.networkPlan.zone,16);f.networkPlan=null;f.defenseWait=f.network.defense?3:9}}
      else if(f.defenseWait<=0)f.networkPlan={left:FINAL.warning,zone:{x:p.x,y:20,w:56,h:128}};
    }
  }
  let w=0;for(const h of f.hazards){h.life-=dt;if(combat&&!h.hit&&Math.abs(p.x-h.x)<h.w/2+7&&p.y+32>h.y&&p.y<h.y+h.h){hurt(h.damage,h.x);h.hit=true}if(h.life>0)f.hazards[w++]=h}f.hazards.length=w;
  if(f.collapseLeft>0){f.collapseLeft=Math.max(0,f.collapseLeft-dt);f.collapseStage=Math.min(5,Math.floor((FINAL.collapseTime-f.collapseLeft)*2));f.collapseTick-=dt;if(f.collapseTick<=0){f.collapseTick=.16;effect({kind:'finalCollapse',x:M08.bossSpawnX+Math.sin(g.time*17)*76,y:85+Math.cos(g.time*13)*35,life:.6,max:.6})}}
}
export function spawnFinalSquad(g,key,spawn){let n=0;const a=FINAL_SQUADS[key];if(!a)return n;for(let i=0;i<6;i++)if(spawn(a[i%2],clamp(g.player.x+220+i*34,24,9960)))n++;return n}
export function finalObjective(g){const b=g.enemies.find(e=>e.type==='overmind'&&!e.dead),f=g.finalDefense;if(b)return b.transitionLeft>0?`第${b.form+1}形態へ移行中`:b.shielded?b.form===1?'左右防御ノードを破壊せよ':'再防御：まもなくコア再露出':`第${b.form}形態：オーバーマインドを攻撃`;
  return [f.entryOpen?'深層隔壁開放：内部へ':'隔壁制御部を破壊せよ','支援敵を断ち総力戦を突破','機械・生体・防衛を任意順で停止','真の信号源オーバーマインドへ','最後の中枢を破壊せよ'][Math.max(0,g.area)];}
export function finalBattleReport(g){return g.finalDefense.formStats.map(r=>({...r,bodyAcceptance:r.attempts?r.accepted/r.attempts:null}))}
export function drawFinalHud(c,g,zoom,offset=0){const f=g.finalDefense,b=g.enemies.find(e=>e.type==='overmind'&&!e.dead);c.save();c.fillStyle='#071522ee';c.fillRect(4,39,113,21);c.font='6px monospace';c.fillStyle='#e7d8bb';c.fillText(finalObjective(g).slice(0,18),7,47);c.font='5px monospace';c.fillStyle='#a9d2c3';c.fillText(b?`FORM ${b.form}/3 / ${b.shielded?'GUARD':'OPEN'} / TOTAL HP 9600`:Object.entries(f.network).map(([k,v])=>`${k[0].toUpperCase()}:${v?'ON':'OFF'}`).join(' '),7,56);
  let n=0;for(const e of b&&!b.shielded?[b]:f.devices){if(e.dead||n>=4||!b&&Math.abs(e.x-g.player.x)>600)continue;const p=worldToScreen({x:e.x,y:e.y},g.camera,zoom),x=clamp(p.x+offset,12,308),y=clamp(p.y-16+offset,91,133);c.fillStyle='#ead29b';c.fillText((p.x<12?'<':p.x>308?'>':'')+(e.type==='overmind'?'CORE':e.partKind.toUpperCase()),clamp(x-12,4,265),y);n++}
  if(g.time<f.radioUntil||f.revealLeft>0||f.collapseLeft>0){const text=f.collapseLeft>0?['真核破壊','機械外殻が連鎖崩壊','侵略制御信号が停止','敵部隊の活動停止を確認','母艦深層が崩壊','全隊離脱！地球へ帰還する'][f.collapseStage]:f.revealLeft>0?FINAL_REVEAL[Math.min(3,Math.floor((8-f.revealLeft)/2))]:M08_RADIO[Math.max(0,f.radioIndex)];c.fillStyle='#081521ed';c.fillRect(6,144,308,28);c.fillStyle='#e3dec8';c.font='6px monospace';for(let i=0;i<text.length;i+=47)c.fillText(text.slice(i,i+47),10,154+Math.floor(i/47)*8)}c.restore();return n;
}
