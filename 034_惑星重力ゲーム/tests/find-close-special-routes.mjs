import{SPECIAL_CHALLENGES}from'../js/special-challenges.js';
import{simulateTrajectory}from'../js/physics.js';
import{placementAllowed}from'../js/planets.js';
for(const source of SPECIAL_CHALLENGES.filter(s=>['stage-12','stage-16','stage-18'].includes(s.id))){let best=null;
 for(const dx of [-30,-15,0,15,30])for(const dy of [-30,-15,0,15,30]){
  const s=structuredClone(source);s.planets[0].x+=dx;s.planets[0].y+=dy;delete s.rules;
  if(!s.planets.every(p=>placementAllowed(p,s)))continue;
  for(let angleDeg=-80;angleDeg<=-40;angleDeg+=2)for(let speed=140;speed<=220;speed+=4){
   const r=simulateTrajectory(s,{angleDeg,speed});if(r.state.status!=='cleared'||r.state.elapsed>5)continue;
   const p=s.planets[0],radius=p.hazards?.[0]?.radius??p.collisionRadius??p.radius;
   const near=Math.min(...r.points.map(q=>Math.hypot(q.x-p.x,q.y-p.y)-radius-6));
   if(near<8||best&&near>=best.near)continue;
   let tolerance=0;for(const x of [-2,0,2])for(const y of [-2,0,2]){
    const t=structuredClone(s);t.planets[0].x+=x;t.planets[0].y+=y;if(simulateTrajectory(t,{angleDeg,speed}).state.status==='cleared')tolerance++;
   }if(tolerance<5)continue;
   if(simulateTrajectory({...s,planets:[]},{angleDeg,speed}).state.status==='cleared')continue;
   best={x:p.x,y:p.y,angleDeg,speed,time:r.state.elapsed,near,tolerance};
  }
 }console.log(source.id,JSON.stringify(best));}
