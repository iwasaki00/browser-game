import {createOpenVoyage,DESTINATIONS} from '../js/open-voyage.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const solutions={};
for(const from of ['origin',...DESTINATIONS.map(d=>d.id)])for(const target of DESTINATIONS){
 if(from===target.id)continue;
 const stage=createOpenVoyage({checkpoint:from,selected:target.id});
 const bearing=Math.atan2(target.y-stage.launch.position.y,target.x-stage.launch.position.x)*180/Math.PI;
 let answer=null;
 for(const speed of [220,200,180,160,140,120]){
  for(const delta of Array.from({length:51},(_,i)=>i===0?0:Math.ceil(i/2)*(i%2?1:-1))){
   const angleDeg=Math.round(bearing)+delta;let state=createSimulation(stage,{angleDeg,speed});
   while(state.status==='flying'&&state.elapsed<55)state=stepSimulation(state,1/120);
   if(state.status==='cleared'){answer={angleDeg,speed,elapsed:state.elapsed,end:state.rocket.position};break;}
  }if(answer)break;
 }
 console.log(from+'>'+target.id,answer);if(!answer)throw Error('No real route');solutions[from+'>'+target.id]=answer;
}
mkdirSync(new URL('../reports/open-voyage/',import.meta.url),{recursive:true});writeFileSync(new URL('../reports/open-voyage/course-design.json',import.meta.url),JSON.stringify(solutions,null,2));
