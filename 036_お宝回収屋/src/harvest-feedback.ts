import {exposure,type Plot} from './engine';
import {CONFIG} from './data';
export type HarvestPulse={kind:'exposed'|'recovered';x:number;y:number;at:number;};
export function riverVisualPoint(r:{originX:number;originY:number;x:number;y:number;elapsed:number;progress:number}){
 const flight=Math.min(1,Math.max(0,r.elapsed/.45)),travel=flight*(1-r.progress);
 return {x:r.originX+(r.x-r.originX)*travel,y:r.originY+(r.y-r.originY)*travel};
}
// Current input load, not the unprocessed stock remaining in its bag.
export function panBulkScale(b?:{id:string;processed:number;screened:number;magnetized?:number},w?:{batchId:string;work:number;required:number}){
 if(!b)return 0;
 if(w?.batchId===b.id)return 1-Math.max(0,Math.min(1,w.work/Math.max(.001,w.required)))*.83;
 return b.processed>0||b.screened>0||(b.magnetized??0)>0?.17:.85;
}
export class HarvestFeedback {
 enabled=true;motion=true;readonly cap=8;
 contact?:{x:number;y:number;at:number};pulses:HarvestPulse[]=[];
 private beach?:Plot;private exposed=new Set<string>();
 private counters={spawned:0,peak:0,painted:0,panWrites:0,rendered:0,skipped:0};grainActive=0;
 allowed(effects:string){return this.enabled&&effects!=='off';}
 setEnabled(on:boolean){this.enabled=on;this.reset();}
 reset(){this.clearField();this.beach=undefined;this.exposed.clear();this.grainActive=0;}
 clearField(){this.contact=undefined;this.pulses=[];}
 resetMetrics(){this.counters={spawned:0,peak:0,painted:0,panWrites:0,rendered:0,skipped:0};}
 prepareBeach(p:Plot){if(this.beach===p)return;this.clearField();this.beach=p;this.exposed=new Set(p.items.filter(f=>f.state==='buried'&&exposure(p,f)>=CONFIG.exposure).map(f=>f.uid));}
 dug(p:Plot,x:number,y:number,at:number,amount:number){
  if(!this.enabled||amount<=0)return;this.contact={x,y,at};this.counters.peak=Math.max(this.counters.peak,this.pulses.length+1);
  for(const f of p.items)if(f.state==='buried'&&!this.exposed.has(f.uid)&&exposure(p,f)>=CONFIG.exposure){this.exposed.add(f.uid);this.pulse('exposed',f.x,f.y,at);}
 }
 pulse(kind:HarvestPulse['kind'],x:number,y:number,at:number){if(!this.enabled)return;this.prune(at);if(this.pulses.length===this.cap)this.pulses.shift();this.pulses.push({kind,x,y,at});this.counters.spawned++;this.counters.peak=Math.max(this.counters.peak,this.pulses.length+(this.contact?1:0));}
 prune(now:number){if(this.pulses.length)this.pulses=this.pulses.filter(p=>now-p.at<550);if(this.contact&&now-this.contact.at>160)this.contact=undefined;}
 frame(drawn:boolean){this.counters[drawn?'rendered':'skipped']++;}
 painted(){this.counters.painted++;}panWrite(){this.counters.panWrites++;}
 stats(now:number){this.prune(now);return {enabled:this.enabled,motion:this.motion,active:this.pulses.length+(this.contact?1:0),grainActive:this.grainActive,cap:this.cap+1,contact:this.contact?{...this.contact}:null,...this.counters};}
}
export const harvestFeedback=new HarvestFeedback();
