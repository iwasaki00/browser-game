import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSimulation,stepSimulation} from '../js/physics.js';
import {velocityFromAngleSpeed} from '../js/launch.js';
import {newMission,observeMission,missionSatisfied} from '../js/homeward-mission.js';
import {observeApproach} from '../js/navigation-feedback.js';
import {balanceRoutes} from './game-balance-routes.mjs';
export function legal(stage,a,s){const angle=stage.launchConditions?.precisionAngleRange??stage.launch.angleRange,speed=stage.launchConditions?.speedRange??stage.launch.speedRange;return a>=angle[0]-1e-8&&a<=angle[1]+1e-8&&s>=speed[0]-1e-8&&s<=speed[1]+1e-8;}
export function runRoute(stage,input,{metrics=true}={}){
 let state=createSimulation(stage,input),evidence=newMission(),metric=null,steps=0;
 while(state.status==='flying') {const previous=state;state=stepSimulation(state,1/120);steps++;if(stage.mission)evidence=observeMission(evidence,previous,state);if(metrics)metric=observeApproach(metric,previous,state);if(steps>23000)throw Error('Unbounded flight');}
 const success=state.status==='cleared'&&missionSatisfied(stage,evidence,'pursue');
 return {state,steps,success,reason:success?'cleared':state.status==='cleared'?'mission-incomplete':state.reason??state.status,minimum:metric?.minimum};
}
if(process.argv[1]===new URL(import.meta.url).pathname.slice(1).replaceAll('/','\\')||process.argv.includes('--measure')){
 const dir=new URL('../reports/game-balance/',import.meta.url);mkdirSync(dir,{recursive:true});
 const files=['js/physics.js','js/live-gravity.js','js/challenges.js','js/special-challenges.js','js/homeward-data.js','js/lost-sectors.js','js/open-voyage.js','js/deep-space.js','js/final-voyage.js','js/flight-clock.js'];
 const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(new URL('../'+f,import.meta.url))).digest('hex')]));
 const angle=[-5,-2,-1,-.5,-.25,-.1,0,.1,.25,.5,1,2,5],speed=[-20,-10,-5,-2,-1,0,1,2,5,10,20];
 const results=[];
 for(const route of balanceRoutes()){
  const {stage,input}=route,base=runRoute(stage,input),samples=[];
  if(!base.success)throw Error('Baseline not clear: '+route.id);
  for(const da of angle)for(const ds of speed){const a=input.angleDeg+da,s=input.speed+ds;if(!legal(stage,a,s)){samples.push({da,ds,reason:'outside-input-range',success:false});continue;}const r=runRoute(stage,{angleDeg:a,speed:s},{metrics:false});samples.push({da,ds,success:r.success,reason:r.reason,time:r.state.elapsed});}
  const boundaries={};for(const [kind,max]of [['angle',5],['speed',20]])for(const direction of [-1,1]){
   let good=0,bad=null;const increment=kind==='angle'?.05:.5;
   for(let d=increment;d<=max+1e-8;d+=increment){const a=input.angleDeg+(kind==='angle'?d*direction:0),s=input.speed+(kind==='speed'?d*direction:0);if(!legal(stage,a,s)){bad={delta:d*direction,reason:'outside-input-range'};break;}const r=runRoute(stage,{angleDeg:a,speed:s},{metrics:false});if(!r.success){bad={delta:d*direction,reason:r.reason};break;}good=d;}
   boundaries[kind+(direction<0?'-':'+')]={lastSuccess:good*direction,firstFailure:bad,resolution:increment};
  }
  const summarize=filter=>{const items=samples.filter(filter),valid=items.filter(s=>s.reason!=='outside-input-range');return {tested:items.length,valid:valid.length,success:valid.filter(s=>s.success).length,excluded:items.length-valid.length,failures:valid.filter(s=>!s.success).reduce((o,s)=>(o[s.reason]=(o[s.reason]??0)+1,o),{})};};
  results.push({id:route.id,group:route.group,input:{angleDeg:input.angleDeg,speed:input.speed},time:base.state.elapsed,steps:base.steps,end:base.state.rocket.position,angle:summarize(s=>s.ds===0),speed:summarize(s=>s.da===0),combined:summarize(s=>s.da!==0&&s.ds!==0),boundaries,samples});
  console.log(route.id,base.state.elapsed.toFixed(3));writeFileSync(new URL('measurements.json',dir),JSON.stringify({version:'1.9.1',hashes,angleOffsets:angle,speedOffsets:speed,results},null,2));
 }
}
