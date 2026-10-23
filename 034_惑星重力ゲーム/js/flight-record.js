export const RECORD_VERSION=1;
export function createFlightRecorder(stage,state,metadata={},now=Date.now()){
 const frames=[];
 const record={version:RECORD_VERSION,id:globalThis.crypto?.randomUUID?.()??`flight-${now}-${Math.random().toString(36).slice(2)}`,createdAt:now,favorite:false,
  stageId:stage.id,stageName:stage.name,world:{...stage.world},goal:{...stage.goal},rocketRadius:state.rocket.radius,
  planets:structuredClone(state.planets),launch:{position:{...state.rocket.position},velocity:{...state.rocket.velocity},angleDeg:Math.atan2(state.rocket.velocity.y,state.rocket.velocity.x)*180/Math.PI,speed:Math.hypot(state.rocket.velocity.x,state.rocket.velocity.y)},...metadata,frames};
 let ended=false;
 function capture(state){
  if(ended||frames.length>=1443)return;
  if(frames.at(-1)?.[0]===state.elapsed)return;
  frames.push([state.elapsed,state.rocket.position.x,state.rocket.position.y,...state.planets.flatMap(p=>[p.x,p.y])]);
 }
 capture(state);
 return {capture,finish(state,reason){
  if(ended)return null;capture(state);ended=true;
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
