import {encounterPosition,encounterExtent} from './encounters.js';
// Presentation only. Reads snapshots; never integrates or changes a simulation.
export const CINEMATIC = Object.freeze({
  launchSeconds:.8, launchZoom:1.15, cruiseZoom:1.05, arrivalZoom:1.35,
  planetDistance:180, goalDistance:240, exitRatio:1.35,
  fastEnter:320, fastExit:260, positionTau:.3, zoomTau:.48, margin:28,
  rightMargin:96, bottomMargin:80,
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const extent=p=>Math.max(p.radius??0,...(p.hazards??[]).map(h=>h.radius));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class CinematicCamera {
  constructor(){this.reset();}
  reset(){this.phase='launch';this.planetId=null;this.goalActive=false;this.fast=false;this.updates=0;this.signalCue=null;}
  cue(point){this.signalCue={...point,radius:24,left:1.6};}
  update(camera,state,seconds,rate=1){
    if(camera.mode!=='cinematic'||!state)return;
    const config=CINEMATIC,rocket=state.rocket.position,velocity=state.rocket.velocity;
    const speed=Math.hypot(velocity.x,velocity.y),factor=clamp(Math.sqrt(Math.max(state.world.width/375,state.world.height/500)),1,Math.sqrt(10));
    const planetRange=p=>Math.max(config.planetDistance*factor,extent(p)*4);
    const planets=[...(state.planets??[]),...(state.encounters??[]).map(e=>({...encounterPosition(e,state.elapsed),id:e.id,radius:encounterExtent(e)}))];
    let planet=planets.find(p=>p.id===this.planetId);
    if(planet&&distance(rocket,planet)>planetRange(planet)*config.exitRatio)planet=null;
    if(!planet)planet=planets.filter(p=>distance(rocket,p)<=planetRange(p)).sort((a,b)=>distance(rocket,a)/planetRange(a)-distance(rocket,b)/planetRange(b)||String(a.id).localeCompare(String(b.id)))[0];
    this.planetId=planet?.id??null;
    const goalRange=Math.max(config.goalDistance*factor,(state.goal.radius??0)*4);
    this.goalActive=distance(rocket,state.goal)<=goalRange*(this.goalActive?config.exitRatio:1);
    this.fast=speed>(this.fast?config.fastExit:config.fastEnter);
    // Terminal > gate > planet encounter (retained through departure) > launch > fast > cruise.
    const terminal=state.status!=='flying'&&state.status!=='ready';
    this.phase=state.status==='cleared'?'arrival':terminal?'ended':this.goalActive?'goal':planet?'planet':state.elapsed<config.launchSeconds?'launch':this.fast?'fast':'cruise';
    let focus=this.phase==='goal'||this.phase==='arrival'?state.goal:this.phase==='planet'?planet:null;
    if(this.signalCue){this.signalCue.left-=Math.max(0,Math.min(.1,seconds||0));if(this.signalCue.left<=0)this.signalCue=null;}
    if(!focus&&!terminal&&this.signalCue&&distance(rocket,this.signalCue)<Math.max(500,config.planetDistance*factor*1.5)){focus=this.signalCue;this.phase='discovery';}
    let target={...rocket};
    if(focus&&this.phase!=='arrival')target={x:rocket.x*.65+focus.x*.35,y:rocket.y*.65+focus.y*.35};
    else if(['cruise','fast'].includes(this.phase)){
      const lookSeconds=.38*Math.sqrt(factor);
      target={x:rocket.x+velocity.x*lookSeconds,y:rocket.y+velocity.y*lookSeconds};
    }
    target.x=clamp(target.x,camera.bounds.left,camera.bounds.right);target.y=clamp(target.y,camera.bounds.top,camera.bounds.bottom);
    const points=[{...rocket,radius:state.rocket.radius??6}];
    if(focus)points.push({...focus,radius:extent(focus)+10});
    const fitAt=(center,framed=points)=>{
      const scales=framed.flatMap(p=>[
        (camera.width/2-(p.x>=center.x?config.rightMargin:config.margin))/Math.max(1,Math.abs(p.x-center.x)+p.radius),
        (camera.height/2-(p.y>=center.y?config.bottomMargin:config.margin))/Math.max(1,Math.abs(p.y-center.y)+p.radius),
      ]);
      return clamp(Math.min(...scales)/camera.baseScale,camera.minZoom,camera.maxZoom);
    };
    let zoom=this.phase==='launch'?config.launchZoom:this.phase==='arrival'?config.arrivalZoom:this.phase==='ended'?camera.zoom:config.cruiseZoom/Math.sqrt(Math.max(1,speed/230));
    // At 50/100x, enlarge the view rather than running camera work per physics step.
    if(!terminal)zoom/=Math.sqrt(Math.max(1,rate));
    zoom=clamp(Math.min(zoom,fitAt(target)),camera.minZoom,camera.maxZoom);
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1);
    const positionAlpha=1-Math.exp(-dt/config.positionTau),zoomAlpha=1-Math.exp(-dt/config.zoomTau);
    camera.center={x:camera.center.x+(target.x-camera.center.x)*positionAlpha,y:camera.center.y+(target.y-camera.center.y)*positionAlpha};
    camera.zoom=Math.exp(Math.log(camera.zoom)+(Math.log(zoom)-Math.log(camera.zoom))*zoomAlpha);
    // A smoothing lag may otherwise hide a rocket during a large time-warp frame.
    // Containment can zoom out immediately; zoom-in always remains interpolated.
    camera.zoom=clamp(Math.min(camera.zoom,fitAt(camera.center,points.slice(0,1))),camera.minZoom,camera.maxZoom);
    const left=Math.max(1,camera.width/2-config.margin)/camera.scale,right=Math.max(1,camera.width/2-config.rightMargin)/camera.scale;
    const top=Math.max(1,camera.height/2-config.margin)/camera.scale,bottom=Math.max(1,camera.height/2-config.bottomMargin)/camera.scale;
    camera.center.x=clamp(camera.center.x,rocket.x-right,rocket.x+left);
    camera.center.y=clamp(camera.center.y,rocket.y-bottom,rocket.y+top);
    camera.clamp();this.updates++;
    return {phase:this.phase,planetId:this.planetId,target,zoom};
  }
}
