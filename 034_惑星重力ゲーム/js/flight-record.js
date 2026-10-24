export const RECORD_VERSION=1;
export function createFlightRecorder(stage,state,metadata={},now=Date.now()){
 const frames=[];
 const record={version:RECORD_VERSION,id:globalThis.crypto?.randomUUID?.()??`flight-${now}-${Math.random().toString(36).slice(2)}`,createdAt:now,favorite:false,
  stageId:stage.id,stageName:stage.name,world:{...stage.world},goal:{...stage.goal},rocketRadius:state.rocket.radius,
  planets:structuredClone(state.planets),launch:{position:{...state.rocket.position},velocity:{...state.rocket.velocity},angleDeg:Math.atan2(state.rocket.velocity.y,state.rocket.velocity.x)*180/Math.PI,speed:Math.hypot(state.rocket.velocity.x,state.rocket.velocity.y)},...metadata,frames};
 let ended=false;
 let sampleEvery=Math.max(1,Math.ceil((stage.flightLimits?.maxFlightTime??12)*120/3600)),step=0;
 function capture(state,force=false){
  if(ended)return;
  if(frames.at(-1)?.[0]===state.elapsed)return;
  const previous=frames.at(-1),before=frames.at(-2);
  let turn=false;
  if(previous&&before){const a=Math.atan2(previous[2]-before[2],previous[1]-before[1]),b=Math.atan2(state.rocket.position.y-previous[2],state.rocket.position.x-previous[1]);turn=Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))>.04;}
  if(!force&&frames.length&&++step%sampleEvery&&!turn)return;
  if(frames.length>=4095){const keep=frames.filter((_,i)=>i===0||i%2===1);frames.splice(0,frames.length,...keep);sampleEvery*=2;}
  frames.push([state.elapsed,state.rocket.position.x,state.rocket.position.y,...state.planets.flatMap(p=>[p.x,p.y])]);
 }
 capture(state);
 return {capture,finish(state,reason){
  if(ended)return null;capture(state,true);ended=true;
  return {...record,duration:state.elapsed,result:state.status==='cleared'?'clear':'fail',reason:reason??state.reason??state.status};
 }};
}

// Interpolation is only for display; stored fixed-step samples are never simulated again.
export function replayFrame(record,time){
 const frames=record.frames,t=Math.max(0,Math.min(record.duration,time));
 let lo=0,hi=frames.length-1;
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid][0]<=t)lo=mid;else hi=mid-1;}
 const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)];
 const mix=b[0]===a[0]?0:(t-a[0])/(b[0]-a[0]);
 const value=i=>a[i]+(b[i]-a[i])*mix;
 return {time:t,index:lo,rocket:{x:value(1),y:value(2)},planets:record.planets.map((p,i)=>({...p,x:value(3+i*2),y:value(4+i*2)}))};
}
export class ReplayClock{
 constructor(record){this.record=record;this.time=0;this.speed=1;this.playing=false;}
 advance(seconds){if(this.playing){this.time=Math.min(this.record.duration,this.time+Math.max(0,seconds)*this.speed);if(this.time>=this.record.duration)this.playing=false;}return replayFrame(this.record,this.time);}
 restart(){this.time=0;this.playing=true;}
 setSpeed(value){if([.5,1,2,4].includes(value))this.speed=value;}
}
