import {createDeepSpace,DEEP_TARGETS,dockDeep,normalizeDeep} from '../js/deep-space.js';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {writeFileSync} from 'node:fs';
const allKnown=()=>({targets:Object.fromEntries(DEEP_TARGETS.map(t=>[t.id,{state:'DETECTED'}]))});
function find(from,target){const raw={...allKnown(),checkpoint:from,selected:target},stage=createDeepSpace(raw),p=stage.launch.position,guess=Math.atan2(stage.goal.y-p.y,stage.goal.x-p.x)*180/Math.PI;
 for(const offset of [0,...Array.from({length:80},(_,i)=>(i%2?-1:1)*(Math.floor(i/2)+1)*.25)]){const angle=Math.round((guess+offset)*100)/100;let state=createSimulation(stage,{angleDeg:angle,speed:220});while(state.status==='flying')state=stepSimulation(state,1/120);if(state.status==='cleared'){if(!dockDeep(raw,state))throw Error('Invalid physical dock');return {from,target,angleDeg:angle,speed:220,time:state.elapsed,start:p,end:state.rocket.position};}}
 throw Error(`No course ${from}>${target}`);
}
const routes=[];for(const t of DEEP_TARGETS){for(const [from,to]of [['origin',t.id],[t.id,'return']]){const route=find(from,to);routes.push(route);console.log(JSON.stringify(route));}}
routes.push(find('origin','return'));for(const [from,to]of [['DS01','DS02'],['DS02','DS03'],['DS03','DS04'],['DS04','DS05'],['return','DS06']])routes.push(find(from,to));
writeFileSync(new URL('../reports/deep-space/routes.json',import.meta.url),JSON.stringify(routes,null,2));
