// Read-only geometry used by drawing and tests, never by a simulation.
export function previewFeatures(job,goal){
 if(!job?.points?.length)return {kind:'normal',turns:[],near:null};
 const points=job.points,turns=[];let near=points[0],minimum=Infinity,accumulated=0,last=null;
 for(let i=0;i<points.length;i++){const p=points[i],d=Math.hypot(p.x-goal.x,p.y-goal.y);if(d<minimum){minimum=d;near=p;}
  if(i){const a=points[i-1],angle=Math.atan2(p.y-a.y,p.x-a.x);if(last!=null){accumulated+=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));if(Math.abs(accumulated)>.45&&turns.length<3){turns.push(p);accumulated=0;}}last=angle;}
 }
 return {kind:job.done&&job.state.status==='cleared'?'clear':job.done&&job.state.status==='crashed'?'danger':'normal',turns,near:minimum<Math.max(goal.radius*3,200)?near:null};
}
export function drawPreviewRoute(ctx,job,goal,scale){
 if(!job||job.points.length<2)return;const f=previewFeatures(job,goal),color=f.kind==='clear'?'#75f5af':f.kind==='danger'?'#ff8996':'#69dfff',end=job.points.at(-1),stride=Math.max(1,Math.ceil(job.points.length/650));
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=(f.kind==='clear'?2:1.6)/scale;ctx.setLineDash([4/scale,5/scale]);ctx.beginPath();ctx.moveTo(job.points[0].x,job.points[0].y);for(let i=stride;i<job.points.length-1;i+=stride)ctx.lineTo(job.points[i].x,job.points[i].y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
 for(const p of f.turns){ctx.strokeStyle='#d3a7ff';ctx.beginPath();ctx.arc(p.x,p.y,5/scale,0,Math.PI*1.65);ctx.stroke();}
 if(f.near){ctx.strokeStyle='#ffe59a';ctx.beginPath();ctx.arc(f.near.x,f.near.y,7/scale,0,Math.PI*2);ctx.stroke();}
 if(f.kind==='danger'){ctx.strokeStyle='#ff667c';ctx.beginPath();ctx.moveTo(end.x-6/scale,end.y-6/scale);ctx.lineTo(end.x+6/scale,end.y+6/scale);ctx.moveTo(end.x+6/scale,end.y-6/scale);ctx.lineTo(end.x-6/scale,end.y+6/scale);ctx.stroke();}
 ctx.restore();return f;
}
export function discoveryStyle(event){return event.source==='chart'||['CLUE-04','CLUE-08'].includes(event.id)?'route':event.state==='INVESTIGATED'||event.id?.startsWith('CLUE-')?'decode':'discovery';}
export class VoyageFeedback {
 constructor(){this.cue=null;}
 publish(events,pointFor){if(!events.length)return;const event=events.findLast(e=>e.state==='INVESTIGATED')??events.at(-1);this.cue={point:{...pointFor(event)},kind:discoveryStyle(event),left:2.4};return this.cue;}
 update(dt){if(this.cue){this.cue.left-=dt;if(this.cue.left<=0)this.cue=null;}}
 draw(ctx,scale,light=false){if(!this.cue)return;const c=this.cue,color={discovery:'#ffe28a',decode:'#c6a7ff',route:'#8affd0'}[c.kind];ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=Math.min(1,c.left);ctx.lineWidth=2/scale;ctx.beginPath();ctx.arc(c.point.x,c.point.y,(10+(2.4-c.left)*(light?4:14))/scale,0,Math.PI*2);ctx.stroke();ctx.restore();}
}
