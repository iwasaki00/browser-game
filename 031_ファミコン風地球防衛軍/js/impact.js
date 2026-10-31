import {WORLD,INVASION,DESTRUCTION_LEVELS,normalizeDestructionLevel,clamp} from "./data.js?v=0.1.7";

export const IMPACT=Object.freeze({
  maxCorpses:256,maxParticles:96,reducedParticles:48,maxExplosions:8,reducedExplosions:4,
  gravity:480,groundFade:.10,shakeMax:4,shakeDuration:.18,shakeCooldown:.24,
  stopDuration:.033,multiStopDuration:.025,stopCooldown:.22,stopBudget:.066,stopWindow:1,
  multiWindow:.18,multiDisplay:.55,shakeAbsoluteMax:6.4,
  bounceRestitution:.35,bounceFriction:.65,minBounceSpeed:30,
  trailSlots:3,trailInterval:.03,trailLife:.12,maxTrailDraws:32
});
export const REACTIONS=Object.freeze({
  bullet:{speed:60,lift:85,spin:3,life:.40,color:"#ffe05c"},
  spread:{speed:155,lift:135,spin:7,life:.44,color:"#fff08b"},
  laser:{speed:85,lift:95,spin:4,life:.38,color:"#6ffcff"},
  rocket:{speed:210,lift:175,spin:10,life:.48,color:"#ff8b42"},
  flame:{speed:32,lift:45,spin:2,life:.26,color:"#ff4f6d"},
  thunder:{speed:140,lift:145,spin:9,life:.45,color:"#b88cff",delay:.06},
  grenade:{speed:235,lift:185,spin:11,life:.48,color:"#ffe05c"},
  homing:{speed:145,lift:120,spin:6,life:.42,color:"#fff08b"}
});
export const FEEDBACK=Object.freeze({targetGap:.055,flashGap:.09,window:.1,maxStarts:12,reducedStarts:6});
const ARMOR_TYPES=new Set(['beetle','boss','queen','leviathan','barrier','shorecrab','siegebeetle','fortress','skydevice','heavygunner','shielddrone','assaultroller','sentrywalker','reactor','basedevice','neuralheart','neuralnode','bioshell','guardiancell']);
export const feedbackCategory=(e,base,actual,finish=false)=>finish?'FINISH':actual>base+1e-8?'WEAK POINT':ARMOR_TYPES.has(e.type)?'ARMOR HIT':'HIT';
const ENEMY_COLORS={crawler:"#ff4f6d",spider:"#b88cff",needle:"#37e8df",beetle:"#718ca1",boss:"#718ca1",worm:"#d7b350",spitter:"#85df88",nest:"#ff659a",queen:"#bc81eb",barrier:"#718ca1",shorecrab:"#b7a9b4",skyray:"#7eacd1",siegebeetle:"#9f8aab",leviathan:"#b5a0c4",interceptor:"#98bdd3",shielddrone:"#8ec9ad",heavygunner:"#bc9d80",fortress:"#9caac0",skydevice:"#e8bc7c",assaultroller:"#bc9876",repairdrone:"#9bd8ba",sentrywalker:"#b4a69c",reactor:"#d4b989",basedevice:"#d8c392",pulseworm:"#b2d4bf",sporefly:"#e1d2a2",guardiancell:"#b7c5ba",neuralheart:"#e2c6b0",neuralnode:"#9cdecf",bioshell:"#a8ada5"};
const noise=n=>((n*2654435761)>>>0)/4294967296;
export function createImpactState(){return {clock:0,stop:0,nextStop:0,budgetStart:0,spent:0,shakeUntil:0,nextShake:0,
  corpses:0,particles:[],free:[],chainCount:0,lastKill:-10,labelUntil:0,feedbackStart:0,feedbackStarts:0,feedbackDropped:0,feedbackCounts:{HIT:0,'ARMOR HIT':0,'WEAK POINT':0,'SHIELD HIT':0,FINISH:0}}}
export const reducedImpact=g=>!!g.lab&&g.enemyLimit>100;
export const impactLevel=g=>DESTRUCTION_LEVELS[normalizeDestructionLevel((g.lab?.settings??g.settings)?.destructionLevel)];
export function pushImpactEffect(g,f){
  const max=reducedImpact(g)?IMPACT.reducedExplosions:IMPACT.maxExplosions;
  const explosion=f.kind==="explosion"||f.kind==="weaponBurst";
  if(explosion){
    f.destructionLevel=impactLevel(g).id;f.visualScale=impactLevel(g).explosion;
    let count=0,oldest=-1;
    for(let i=0;i<g.effects.length;i++)if(g.effects[i].kind==="explosion"||g.effects[i].kind==="weaponBurst"){count++;if(oldest<0||g.effects[i].life<g.effects[oldest].life)oldest=i}
    if(count>=max){g.effects[oldest]=f;return true}
  }
  if(g.effects.length<INVASION.maxEffects){g.effects.push(f);return true}
  if(explosion)for(let i=0;i<g.effects.length;i++)if(g.effects[i].kind!=="explosion"&&g.effects[i].kind!=="weaponBurst"){g.effects[i]=f;return true}
  return false;
}
export function hitVisual(g,e,source={},category='HIT',point=null){
  const a=g.impact;a.feedbackCounts[category]++;
  if(a.clock-a.feedbackStart>=FEEDBACK.window){a.feedbackStart=a.clock;a.feedbackStarts=0}
  if(a.clock<(e.nextHitVisual??0)||a.feedbackStarts>=(reducedImpact(g)?FEEDBACK.reducedStarts:FEEDBACK.maxStarts)){a.feedbackDropped++;return false}
  e.nextHitVisual=a.clock+FEEDBACK.targetGap;a.feedbackStarts++;
  if(a.clock>=(e.nextHitFlash??0)){e.hitFlash=.055;e.nextHitFlash=a.clock+FEEDBACK.flashGap}
  const type=REACTIONS[source.effectType]?source.effectType:REACTIONS[source.type]?source.type:"bullet",r=REACTIONS[type],length=Math.hypot(source.vx||0,source.vy||0)||1;
  return pushImpactEffect(g,{kind:"hit",type,category,x:point?.x??clamp(source.x??e.x,e.x-e.w/2,e.x+e.w/2),y:point?.y??clamp(source.y??e.y+e.h/2,e.y,e.y+e.h),vx:(source.vx||1)/length,vy:(source.vy||0)/length,
    color:r.color,assetIndex:source.assetIndex,seed:e.uid,life:type==="flame"?.18:.12,max:type==="flame"?.18:.12});
}
export function drawFeedbackAccent(c,f){
  if(f.category==='HIT'||!f.category)return;const progress=1-f.life/f.max,x=Math.round(f.x),y=Math.round(f.y);c.save();c.globalAlpha=Math.min(1,f.life/.06);
  c.fillStyle=f.category==='ARMOR HIT'?'#bfd0d9':f.category==='WEAK POINT'?'#fff1a1':f.color;
  if(f.category==='SHIELD HIT'){c.strokeStyle='#95dfc4';c.lineWidth=1;c.strokeRect(x-4,y-5,8,7);c.beginPath();c.moveTo(x-4,y+2);c.lineTo(x,y+6);c.lineTo(x+4,y+2);c.stroke()}
  else if(f.category==='ARMOR HIT'){for(const sign of [-1,1])c.fillRect(x+sign*Math.round(3+progress*9),y-Math.round(progress*6),3,2)}
  else{const r=Math.round((f.category==='FINISH'?7:5)+progress*9);for(const sign of [-1,1]){c.fillRect(x+sign*r-1,y-1,3,2);c.fillRect(x-1,y+sign*r-1,2,3)}}
  c.restore();
}
export function requestHitStop(g,strong=false){
  const a=g.impact;if(a.clock-a.budgetStart>=IMPACT.stopWindow){a.budgetStart=a.clock;a.spent=0}
  const duration=strong?IMPACT.stopDuration:IMPACT.multiStopDuration;
  if(a.clock<a.nextStop||a.spent+duration>IMPACT.stopBudget+1e-9)return;
  a.stop=Math.max(a.stop,duration);a.spent+=duration;a.nextStop=a.clock+IMPACT.stopCooldown;
}
export function impactShake(g){
  if((g.lab?.settings??g.settings)?.shake===false){g.shake=0;g.impact.shakeUntil=0;return}
  const a=g.impact;if(a.clock<a.nextShake)return;
  g.shake=Math.min(IMPACT.shakeAbsoluteMax,IMPACT.shakeMax*impactLevel(g).shake);a.shakeUntil=a.clock+IMPACT.shakeDuration;a.nextShake=a.clock+IMPACT.shakeCooldown;
}
export function advanceImpact(g,dt){
  const a=g.impact,stopped=a.stop>0;a.clock+=dt;a.stop=Math.max(0,a.stop-dt);
  if(a.shakeUntil&&a.clock>=a.shakeUntil){g.shake=0;a.shakeUntil=0}
  return stopped;
}
export function beginDeath(g,e,source={},bounds){
  const a=g.impact,type=REACTIONS[source.effectType]?source.effectType:REACTIONS[source.type]?source.type:"bullet",r=REACTIONS[type],level=impactLevel(g);
  if(a.corpses>=IMPACT.maxCorpses)for(const old of g.enemies)if(old.dead&&old.deathTracked&&old!==e){old.death=0;old.deathTracked=false;a.corpses--;break}
  const radial=source.radial,dx=radial?e.x-source.x:source.vx??(e.x-g.player.x),dy=radial?e.y+e.h/2-source.y:source.vy??0;
  const length=Math.hypot(dx,dy)||1,sign=Math.sign(dx)||(e.uid%2?1:-1);
  const close=type==="spread"?1.15-.55*clamp(Math.abs(e.x-(source.originX??g.player.x))/150,0,1):1;
  const leader=e.type==="boss"||e.type==="beetle"||e.type==="queen"||e.type==="leviathan"||e.type==="fortress"||e.type==="reactor"||e.type==="neuralheart"||e.fixedDevice||e.type==="nest",weight=leader?.25:1;
  e.deathType=type;e.deathColor=ENEMY_COLORS[e.type];e.deathMax=e.death=(leader?.48:r.life)*level.life;
  e.deathVx=(radial?(Math.abs(dx)<.01?sign*.7:dx/length):sign)*r.speed*close*weight*level.speed;
  e.deathVy=(-r.lift+clamp(dy/length,-1,1)*r.speed*.3)*weight*level.speed;
  e.deathAngle=0;e.deathSpin=sign*r.spin*weight*level.spin;e.deathDelay=r.delay||0;e.deathGround=false;e.deathTracked=true;
  e.deathLevel=level.id;e.deathBounces=0;e.deathAge=0;e.trailElapsed=0;e.trailCursor=e.trailCount=0;e.deathTrail=level.trails?new Float32Array(IMPACT.trailSlots*4):null;a.corpses++;
  a.chainCount=a.clock-a.lastKill<=IMPACT.multiWindow?a.chainCount+1:1;a.lastKill=a.clock;
  if(a.chainCount>=3){a.labelUntil=a.clock+IMPACT.multiDisplay;requestHitStop(g)}
  if(type==="rocket"||type==="grenade")requestHitStop(g,true);
  // No gameplay RNG: particles must not change the item-drop random sequence.
  if(bounds&&(e.x<bounds.left-32||e.x>bounds.right+32))return;
  const limit=reducedImpact(g)?IMPACT.reducedParticles:IMPACT.maxParticles;
  const desired=(reducedImpact(g)?1:type==="flame"?4:3)*level.particles;
  const count=Math.floor(desired)+(noise(e.uid+419)<desired%1?1:0);
  for(let i=0;i<count&&a.particles.length<limit;i++){
    const n=noise(e.uid*7+i+1),f=a.free.pop()||{};
    const spread=level.id===3?1+(noise(e.uid*13+i+31)-.5)*.8:1;
    Object.assign(f,{x:e.x,y:e.y+e.h/2,vx:((n*2-1)*110*spread+e.deathVx*.25)*level.fragmentSpeed,vy:(-45-n*110*spread)*level.fragmentSpeed,
      life:.20+n*.16,max:.36,color:i%2?e.deathColor:r.color,size:1+i%2,flame:type==="flame"});a.particles.push(f);
  }
}
export function updateDeath(g,e,dt){
  e.death-=dt;e.deathAge=(e.deathAge||0)+dt;
  if(e.death<=0){releaseDeath(g,e);return}
  if(e.deathDelay>0)e.deathDelay=Math.max(0,e.deathDelay-dt);
  else if(e.deathVx!==undefined){
    if(e.deathTrail){e.trailElapsed+=dt;if(e.trailElapsed>=IMPACT.trailInterval){e.trailElapsed%=IMPACT.trailInterval;const i=e.trailCursor*4;e.deathTrail[i]=e.x;e.deathTrail[i+1]=e.y;e.deathTrail[i+2]=e.deathAngle;e.deathTrail[i+3]=e.deathAge;e.trailCursor=(e.trailCursor+1)%IMPACT.trailSlots;e.trailCount=Math.min(IMPACT.trailSlots,e.trailCount+1)}}
    e.deathVy+=IMPACT.gravity*DESTRUCTION_LEVELS[e.deathLevel||1].gravity*dt;e.x+=e.deathVx*dt;e.y+=e.deathVy*dt;e.deathAngle+=e.deathSpin*dt;
    if(e.x<0||e.x>(g.world??WORLD).width||!Number.isFinite(e.x+e.y)||e.y< -WORLD.height*4){e.death=0;releaseDeath(g,e);return}
    if(e.y+e.h>=WORLD.ground&&e.deathVy>0){e.y=WORLD.ground-e.h;
      if(DESTRUCTION_LEVELS[e.deathLevel||1].bounce&&e.deathBounces===0&&e.deathVy>=IMPACT.minBounceSpeed){e.deathVy*=-IMPACT.bounceRestitution;e.deathVx*=IMPACT.bounceFriction;e.deathBounces=1}
      else{e.deathVy=e.deathVx=0;e.death=Math.min(e.death,IMPACT.groundFade);e.deathGround=true}
    }
  }
}
function releaseDeath(g,e){if(e.deathTracked){e.deathTracked=false;g.impact.corpses=Math.max(0,g.impact.corpses-1)}e.deathTrail=null;e.trailCount=0}
export function updateParticles(g,dt){
  const a=g.impact;let write=0;
  for(const f of a.particles){f.life-=dt;if(f.life<=0){a.free.push(f);continue}f.x+=f.vx*dt;f.vy+=IMPACT.gravity*dt;f.y+=f.vy*dt;
    if(f.y>WORLD.ground){f.y=WORLD.ground;f.vx*=.7;f.vy=0;f.life=Math.min(f.life,.08)}a.particles[write++]=f}
  a.particles.length=write;
}
