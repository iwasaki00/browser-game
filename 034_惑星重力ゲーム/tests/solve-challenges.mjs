import {CHALLENGES} from '../js/challenges.js';
import {simulateTrajectory} from '../js/physics.js';
for(const stage of CHALLENGES){
 let solution=null;
 for(let angle=-72;angle<=-35&&!solution;angle++)for(let speed=120;speed<=220;speed+=2){
  const result=simulateTrajectory(stage,{angleDeg:angle,speed});
  if(result.state.status==='cleared'){solution={angleDeg:angle,speed,elapsed:result.state.elapsed};break;}
 }
 console.log(stage.id,JSON.stringify(solution));
}
