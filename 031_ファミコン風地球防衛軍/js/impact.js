import {WORLD,INVASION,clamp} from "./data.js";

export const IMPACT=Object.freeze({
  maxCorpses:256,maxParticles:96,reducedParticles:48,maxExplosions:8,reducedExplosions:4,
  gravity:480,groundFade:.10,shakeMax:4,shakeDuration:.18,shakeCooldown:.24,
  stopDuration:.033,multiStopDuration:.025,stopCooldown:.22,stopBudget:.066,stopWindow:1,
  multiWindow:.18,multiDisplay:.55
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
const ENEMY_COLORS={crawler:"#ff4f6d",spider:"#b88cff",needle:"#37e8df",beetle:"#718ca1",boss:"#718ca1"};
const noise=n=>((n*2654435761)>>>0)/4294967296;
export function createImpactState(){return {clock:0,stop:0,nextStop:0,budgetStart:0,spent:0,shakeUntil:0,nextShake:0,
  corpses:0,particles:[],free:[],chainCount:0,lastKill:-10,labelUntil:0}}
export const reducedImpact=g=>!!g.lab&&g.enemyLimit>100;
export function pushImpactEffect(g,f){
  const max=reducedImpact(g)?IMPACT.reducedExplosions:IMPACT.maxExplosions;
  if(f.kind==="explosion"){
    let count=0,oldest=-1;
    for(let i=0;i<g.effects.length;i++)if(g.effects[i].kind==="explosion"){count++;if(oldest<0||g.effects[i].life<g.effects[oldest].life)oldest=i}
    if(count>=max){g.effects[oldest]=f;return true}
  }
  if(g.effects.length<INVASION.maxEffects){g.effects.push(f);return true}
  if(f.kind==="explosion")for(let i=0;i<g.effects.length;i++)if(g.effects[i].kind!=="explosion"){g.effects[i]=f;return true}
  return false;
}
export function hitVisual(g,e,source={}){
  const type=REACTIONS[source.type]?source.type:"bullet",r=REACTIONS[type],length=Math.hypot(source.vx||0,source.vy||0)||1;
  pushImpactEffect(g,{kind:"hit",type,x:e.x,y:e.y+e.h/2,vx:(source.vx||1)/length,vy:(source.vy||0)/length,
    color:r.color,seed:e.uid,life:type==="flame"?.18:.12,max:type==="flame"?.18:.12});
}
export function requestHitStop(g,strong=false){
  const a=g.impact;if(a.clock-a.budgetStart>=IMPACT.stopWindow){a.budgetStart=a.clock;a.spent=0}
  const duration=strong?IMPACT.stopDuration:IMPACT.multiStopDuration;
  if(a.clock<a.nextStop||a.spent+duration>IMPACT.stopBudget+1e-9)return;
  a.stop=Math.max(a.stop,duration);a.spent+=duration;a.nextStop=a.clock+IMPACT.stopCooldown;
}
export function impactShake(g){
  const a=g.impact;if(a.clock<a.nextShake)return;
  g.shake=IMPACT.shakeMax;a.shakeUntil=a.clock+IMPACT.shakeDuration;a.nextShake=a.clock+IMPACT.shakeCooldown;
}
export function advanceImpact(g,dt){
  const a=g.impact,stopped=a.stop>0;a.clock+=dt;a.stop=Math.max(0,a.stop-dt);
  if(a.shakeUntil&&a.clock>=a.shakeUntil){g.shake=0;a.shakeUntil=0}
  return stopped;
}
export function beginDeath(g,e,source={},bounds){
  const a=g.impact,type=REACTIONS[source.type]?source.type:"bullet",r=REACTIONS[type];
  if(a.corpses>=IMPACT.maxCorpses)for(const old of g.enemies)if(old.dead&&old.deathTracked&&old!==e){old.death=0;old.deathTracked=false;a.corpses--;break}
  const radial=source.radial,dx=radial?e.x-source.x:source.vx??(e.x-g.player.x),dy=radial?e.y+e.h/2-source.y:source.vy??0;
  const length=Math.hypot(dx,dy)||1,sign=Math.sign(dx)||(e.uid%2?1:-1);
  const close=type==="spread"?1.15-.55*clamp(Math.abs(e.x-(source.originX??g.player.x))/150,0,1):1;
  const leader=e.type==="boss"||e.type==="beetle",weight=leader?.25:1;
  e.deathType=type;e.deathColor=ENEMY_COLORS[e.type];e.deathMax=e.death=leader?.48:r.life;
  e.deathVx=(radial?(Math.abs(dx)<.01?sign*.7:dx/length):sign)*r.speed*close*weight;
  e.deathVy=(-r.lift+clamp(dy/length,-1,1)*r.speed*.3)*weight;
  e.deathAngle=0;e.deathSpin=sign*r.spin*weight;e.deathDelay=r.delay||0;e.deathGround=false;e.deathTracked=true;a.corpses++;
  a.chainCount=a.clock-a.lastKill<=IMPACT.multiWindow?a.chainCount+1:1;a.lastKill=a.clock;
  if(a.chainCount>=3){a.labelUntil=a.clock+IMPACT.multiDisplay;requestHitStop(g)}
  if(type==="rocket"||type==="grenade")requestHitStop(g,true);
  // No gameplay RNG: particles must not change the item-drop random sequence.
  if(bounds&&(e.x<bounds.left-32||e.x>bounds.right+32))return;
  const limit=reducedImpact(g)?IMPACT.reducedParticles:IMPACT.maxParticles;
  const count=reducedImpact(g)?1:type==="flame"?4:3;
  for(let i=0;i<count&&a.particles.length<limit;i++){
    const n=noise(e.uid*7+i+1),f=a.free.pop()||{};
    Object.assign(f,{x:e.x,y:e.y+e.h/2,vx:(n*2-1)*110+e.deathVx*.25,vy:-45-n*110,
      life:.20+n*.16,max:.36,color:i%2?e.deathColor:r.color,size:1+i%2,flame:type==="flame"});a.particles.push(f);
  }
}
export function updateDeath(g,e,dt){
  e.death-=dt;
  if(e.deathDelay>0)e.deathDelay=Math.max(0,e.deathDelay-dt);
  else if(e.deathVx!==undefined){
    e.deathVy+=IMPACT.gravity*dt;e.x=clamp(e.x+e.deathVx*dt,0,WORLD.width);e.y+=e.deathVy*dt;e.deathAngle+=e.deathSpin*dt;
    if(e.y+e.h>=WORLD.ground&&e.deathVy>0){e.y=WORLD.ground-e.h;e.deathVy=e.deathVx=0;e.death=Math.min(e.death,IMPACT.groundFade);e.deathGround=true}
  }
  if(e.death<=0&&e.deathTracked){e.deathTracked=false;g.impact.corpses=Math.max(0,g.impact.corpses-1)}
}
export function updateParticles(g,dt){
  const a=g.impact;let write=0;
  for(const f of a.particles){f.life-=dt;if(f.life<=0){a.free.push(f);continue}f.x+=f.vx*dt;f.vy+=IMPACT.gravity*dt;f.y+=f.vy*dt;
    if(f.y>WORLD.ground){f.y=WORLD.ground;f.vx*=.7;f.vy=0;f.life=Math.min(f.life,.08)}a.particles[write++]=f}
  a.particles.length=write;
}
