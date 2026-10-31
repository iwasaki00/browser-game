import {createFinalVoyage} from '../js/final-voyage.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {planetExtent} from '../js/planets.js';
import {encounterBodies} from '../js/encounters.js';
import {writeFileSync} from 'node:fs';
function fly(stage,angle,speed){let state=createSimulation(stage,{angleDeg:angle,speed}),clearance=Infinity,anomaly=Infinity,distance=0;while(state.status==='flying'){const before=state;state=stepSimulation(state,1/120);const p=state.rocket.position;distance+=Math.hypot(p.x-before.rocket.position.x,p.y-before.rocket.position.y);for(const q of state.planets)clearance=Math.min(clearance,Math.hypot(q.x-p.x,q.y-p.y)-planetExtent(q)-state.rocket.radius);for(const e of state.encounters.filter(e=>e.type!=='station'))for(const q of encounterBodies(e,state.elapsed)){const d=Math.hypot(q.x-p.x,q.y-p.y)-q.radius-state.rocket.radius;clearance=Math.min(clearance,d);if(e.type==='unknown')anomaly=Math.min(anomaly,d);}}return {state,clearance,anomaly,distance};}
const pairs=[['origin','earth'],['origin','rescue'],['rescue','earth'],['origin','network'],['network','earth'],['network','passage'],['origin','observatory'],['observatory','berth'],['berth','earth'],['passage','earth'],['earth','network'],['earth','rescue'],['earth','observatory'],['observatory','earth'],['origin','relay'],['relay','berth']];
const routes=[];for(const[from,target]of pairs){const stage=createFinalVoyage({checkpoint:from,selected:target}),guess=Math.atan2(stage.goal.y-stage.launch.position.y,stage.goal.x-stage.launch.position.x)*180/Math.PI;let result;
 for(const speed of [220,200,180]){for(const offset of [0,...Array.from({length:240},(_,i)=>(i%2?-1:1)*(Math.floor(i/2)+1)*.25)]){const angle=Math.round((guess+offset)*100)/100,r=fly(stage,angle,speed);if(r.state.status==='cleared'){result={from,target,angleDeg:angle,speed,time:r.state.elapsed,start:stage.launch.position,end:r.state.rocket.position,minClearance:r.clearance,anomalyClearance:r.anomaly,distance:r.distance};break;}}if(result)break;}
 if(!result)throw Error(`No verified route ${from}>${target}`);routes.push(result);console.log(JSON.stringify(result));
}
writeFileSync(new URL('../reports/final-voyage/routes.json',import.meta.url),JSON.stringify(routes,null,2));
