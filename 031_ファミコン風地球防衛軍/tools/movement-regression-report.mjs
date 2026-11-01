import {mkdirSync,writeFileSync} from 'node:fs';
import {REFS,movementCase,setupMovement,sample,step} from '../tests/helpers/movement-comparison.mjs';
const versions=['A1','B','B1'],classes=['RANGER','SCOUT','GUARDIAN','WING'];
export function collectMovementReport(){
 const movement=[];for(const version of versions)for(const classId of classes)for(const seconds of [1,3])for(const direction of [-1,1])movement.push(movementCase(version,classId,{seconds,direction}));
 const air=[];for(const version of versions)for(const classId of classes)air.push(movementCase(version,classId,{seconds:1,air:classId==='WING',jump:classId!=='WING'}));
 const cameras=[];
 for(const version of versions)for(const classId of classes)for(const direction of [-1,1])for(const fixed of [true,false]){
  // x=64: left camera edge holds at zero; x=1800: free camera follow.
  const r=setupMovement(version,classId,{x:fixed?64:1800});
  if(fixed&&direction<0)continue;
  const frames=[sample(r)];r.pointer(direction>0?'right':'left','pointerdown');
  for(let i=0;i<60;i++){r.run('update(1/60)');frames.push(sample(r))}
  const a=frames[0],b=frames[60];cameras.push({version,classId,scene:fixed?'LEFT_EDGE':'FOLLOW',direction,
   playerDistance:b.x-a.x,backgroundScrollPx:(b.cameraX-a.cameraX)*.5,followLagWorldPx:b.x-((320/2-b.lookAhead)/b.zoom)-b.cameraX,
   firstDirectionSeconds:frames.findIndex(f=>f.direction===direction)/60,frames:frames.filter((f,i)=>[0,1,6,7,8,15,30,60].includes(i))});
 }
 return {version:'1.2.0-B1',references:REFS,method:'actual historical game.js/camera.js + byte-identical production player/data; flat isolated LAB fixture; 60Hz simulation, not wall-clock/iPhone speed',movement,air,cameras};
}
const report=collectMovementReport();mkdirSync('reports/movement-regression',{recursive:true});writeFileSync('reports/movement-regression/measurements.json',JSON.stringify(report,null,2)+'\n');
for(const v of versions){console.log(v,report.movement.filter(r=>r.version===v&&r.direction===1).map(r=>`${r.classId}/${r.seconds}s=${(r.after.x-r.before.x).toFixed(3)}`).join(' '));console.log('RANGER follow left',report.cameras.filter(r=>r.version===v&&r.classId==='RANGER'&&r.scene==='FOLLOW'&&r.direction===-1).map(r=>({scroll:r.backgroundScrollPx,lag:r.followLagWorldPx,firstTurn:r.firstDirectionSeconds})))}
