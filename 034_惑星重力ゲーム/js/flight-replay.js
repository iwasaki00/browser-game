import {ReplayClock,replayFrame} from './flight-record.js';
import {Camera} from './camera.js';
import {CinematicCamera} from './cinematic-camera.js';
import {frontierTarget} from './frontier.js';
import {Starfield} from './starfield.js';

export const REPLAY_MODES=['normal','follow','cinematic','overview'];
export const REPLAY_HOLD={intro:.65,outro:.85};
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;

// Display adapter only. Velocity is the derivative of the recorded interpolation,
// not a new physics calculation. No field in the stored record is assigned to.
export function replaySnapshot(record,time){
  const frame=replayFrame({...record,planets:record.planets??[]},time),rows=record.frames;
  let a=rows[frame.index],b=rows[frame.index+1];
  if(!b||b[0]<=a[0]){
    b=a;let index=frame.index-1;
    while(index>=0&&rows[index][0]>=b[0])index--;
    a=rows[index]??b;
  }
  const dt=b[0]-a[0],fallback=record.launch?.velocity??{};
  const velocity=dt>0?{x:finite((b[1]-a[1])/dt),y:finite((b[2]-a[2])/dt)}:{x:finite(fallback.x),y:finite(fallback.y)};
  return {status:frame.time>=record.duration?(record.result==='clear'?'cleared':'ended'):'flying',elapsed:frame.time,
    world:{...record.world},goal:{...record.goal},rocket:{position:{...frame.rocket},velocity,radius:record.rocketRadius??6},
    planets:frame.planets.map((p,i)=>({...p,x:finite(p.x,finite(record.planets[i].x)),y:finite(p.y,finite(record.planets[i].y))})),...(record.encounters?.length?{encounters:record.encounters}:{}),frame};
}

export class FlightReplay {
  constructor(record){
    this.record=record;this.clock=new ReplayClock(record);this.camera=new Camera();this.cinematic=new CinematicCamera();this.stars=new Starfield();this.cueTime=-Infinity;
    // Bounds include every recorded moving planet and the flight endpoints.
    let left=0,top=0,right=record.world.width,bottom=record.world.height;
    for(const row of record.frames)for(let i=1;i+1<row.length;i+=2){left=Math.min(left,finite(row[i]));right=Math.max(right,finite(row[i]));top=Math.min(top,finite(row[i+1]));bottom=Math.max(bottom,finite(row[i+1]));}
    this.stage={finalVoyage:record.finalVoyage===true,deepSpace:record.deepSpace===true,world:{...record.world},launch:{position:{x:record.frames[0][1],y:record.frames[0][2]}},goal:{...record.goal},planets:[...(record.planets??[]),{x:left,y:top,radius:0},{x:right,y:bottom,radius:0}]};
    this.mode='normal';this.playing=false;this.phase='flight';this.remaining=0;this.camera.resize(375,500);this.camera.fit(this.stage);
  }
  get time(){return this.clock.time;}
  get speed(){return this.clock.speed;}
  get snapshot(){return replaySnapshot(this.record,this.time);}
  resize(w,h){this.camera.resize(w,h);if(['normal','overview'].includes(this.mode)||this.phase==='intro')this.camera.fit(this.stage);}
  pause(){this.playing=false;this.clock.playing=false;}
  setSpeed(value){this.clock.setSpeed(value);}
  setMode(mode){
    if(!REPLAY_MODES.includes(mode))return;
    const previous=this.mode;this.mode=mode;this.cinematic.reset();this.cueTime=this.time;
    if(mode==='normal'||mode==='overview')this.camera.fit(this.stage);
    else{
      this.camera.setMode(mode);
      if(mode==='follow'){if(['normal','overview'].includes(previous))this.camera.zoom=1;this.camera.follow(this.snapshot.rocket.position);}
    }
    if(mode==='cinematic'&&this.time===0){this.phase='intro';this.remaining=REPLAY_HOLD.intro;this.camera.fit(this.stage);}
    else if(this.phase==='intro')this.phase='flight';
    if(mode!=='cinematic'&&this.phase==='outro'){this.phase='ended';this.pause();}
    this.updateCamera(1/60);
  }
  restart(){
    this.clock.restart();this.playing=true;this.phase=this.mode==='cinematic'?'intro':'flight';this.remaining=REPLAY_HOLD.intro;
    this.cinematic.reset();this.cueTime=-Infinity;if(this.mode!=='manual')this.camera.fit(this.stage);
    this.updateCamera(0);
  }
  toggle(){if(this.playing)this.pause();else if(this.phase==='ended')this.restart();else this.playing=true;}
  seek(time){
    this.clock.time=Math.max(0,Math.min(this.record.duration,finite(Number(time))));
    this.phase=this.time>=this.record.duration?'ended':'flight';this.remaining=0;this.cinematic.reset();this.cueTime=this.time;
    if(this.phase==='ended')this.pause();
    if(this.mode==='cinematic'){this.camera.center={...this.snapshot.rocket.position};this.camera.zoom=1;}
    this.updateCamera(1/60);
  }
  manual(){this.mode='manual';this.camera.mode='fixed';this.cinematic.reset();if(this.phase==='intro')this.phase='flight';}
  updateCamera(seconds){
    if(this.phase==='intro'){this.camera.fit(this.stage);return;}
    if(this.mode==='follow'){this.camera.mode='follow';this.camera.follow(this.snapshot.rocket.position);}
    if(this.mode==='cinematic'){
      const event=[...(this.record.frontierEvents??[]),...(this.record.storyEvents??[])].filter(e=>e.elapsed>this.cueTime&&e.elapsed<=this.time).sort((a,b)=>a.elapsed-b.elapsed).at(-1);
      if(event){const target=frontierTarget(event.id),point=this.record.destinations?.find(d=>d.id===(event.destination??target?.destination));if(point)this.cinematic.cue(point);this.cueTime=event.elapsed;}
      this.camera.mode='cinematic';this.cinematic.update(this.camera,this.snapshot,seconds,this.speed);
    }
  }
  advance(seconds){
    if(!this.playing)return;
    let dt=Math.max(0,finite(seconds));
    if(this.phase==='intro'){
      const spent=Math.min(this.remaining,dt);this.remaining-=spent;dt-=spent;
      if(this.remaining>1e-9){this.updateCamera(0);return;}
      this.phase='flight';
    }
    if(this.phase==='outro'){
      this.remaining-=dt;this.updateCamera(dt);
      if(this.remaining<=0){this.phase='ended';this.pause();}return;
    }
    this.clock.playing=true;this.clock.advance(dt);this.updateCamera(dt);
    if(this.time>=this.record.duration){
      if(this.mode==='cinematic'){this.phase='outro';this.remaining=REPLAY_HOLD.outro;}
      else{this.phase='ended';this.pause();}
    }
  }
}
