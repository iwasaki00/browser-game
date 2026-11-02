import {getStage} from './stages.js';
import {createEncounter} from './encounters.js';
export const PRACTICE_DESTINATIONS={gate:{id:'practice-gate',name:'帰還中継点',x:319,y:105,radius:26},signal:{id:'practice-signal',name:'練習用の観測地点',x:240,y:175,radius:26}};
export function practiceStage(step=0,target='gate'){
 const s=getStage();s.id=`beginner-${step+1}`;s.name='本編とは別の練習宙域';s.description='惑星の重力と予測線を使って航路を試します。';
 s.goal={...PRACTICE_DESTINATIONS[target]??PRACTICE_DESTINATIONS.gate};
 s.rules={minPlanets:1,maxPlanets:1,types:['earth'],sizes:['medium']};
 if(step>=2){s.launch.angleDeg=-62;s.launch.speed=220;}
 if(step===5)s.encounters=[createEncounter('station','practice-station',130,320,{fixed:true})];
 return s;
}
// Measures the real integrator's velocity. It does not apply any acceleration.
export function gravityTurn(initial,state){
 if(!initial||state.status!=='flying'||state.elapsed<.15)return 0;
 const v=state.rocket.velocity,a=Math.atan2(initial.y,initial.x),b=Math.atan2(v.y,v.x),turn=Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)));
 const near=state.planets.some(p=>Math.hypot(p.x-state.rocket.position.x,p.y-state.rocket.position.y)<p.radius+160);
 return near?turn*180/Math.PI:0;
}
export function previewDigest(job){
 if(!job?.done)return null;let hash=2166136261;
 for(const p of job.points)for(const value of [p.x,p.y]){const text=value.toFixed(5);for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);}
 return `${job.points.length}:${hash>>>0}:${job.state.status}`;
}
