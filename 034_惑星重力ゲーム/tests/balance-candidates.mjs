import {CHALLENGES}from'../js/challenges.js';
import{simulateTrajectory}from'../js/physics.js';
for(const stage of CHALLENGES.filter((s,i)=>[2,4,5,6,7,8,9].includes(i))){
 let best=null,fastest=null;
 for(let angleDeg=-72;angleDeg<=-35;angleDeg++)for(let speed=120;speed<=220;speed+=2){
  const r=simulateTrajectory(stage,{angleDeg,speed});if(r.state.status!=='cleared')continue;
  if(!fastest||r.state.elapsed<fastest.time)fastest={angleDeg,speed,time:r.state.elapsed};
  let hits=0,total=0;
  for(const da of [-1,0,1])for(const dv of [-4,0,4]){
   if(angleDeg+da< -72||angleDeg+da> -35||speed+dv<120||speed+dv>220)continue;
   total++;if(simulateTrajectory(stage,{angleDeg:angleDeg+da,speed:speed+dv}).state.status==='cleared')hits++;
  }
  const score=hits/total-Math.abs(speed-160)*.0001;
  if(!best||score>best.score)best={angleDeg,speed,time:r.state.elapsed,hits,total,score};
 }
 let star=null;
 for(let a=-72;a<=-35&&!star;a++)for(let v=120;v<=220;v+=2){const r=simulateTrajectory(stage,{angleDeg:a,speed:v});if(r.state.status==='cleared'&&r.state.elapsed<=stage.rating.three.maxTime-.08){star={angleDeg:a,speed:v,time:r.state.elapsed};break;}}
 console.log(stage.id,JSON.stringify({best,fastest,star}));
}
