import {project} from './surface';import {harvestFeedback as feedback} from './harvest-feedback';
export function paintHarvestFeedback(ctx:CanvasRenderingContext2D,now:number,effects:string){
 if(!feedback.allowed(effects)){feedback.clearField();return;}
 feedback.prune(now);if(!feedback.contact&&!feedback.pulses.length)return;ctx.save();ctx.lineWidth=1.3;
 if(feedback.contact){const q=project(feedback.contact.x,feedback.contact.y);ctx.strokeStyle='#795e37';ctx.globalAlpha=.75;ctx.beginPath();ctx.ellipse(q.x,q.y,6,3,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff0bf';ctx.beginPath();ctx.ellipse(q.x,q.y-1,4,2,0,Math.PI,Math.PI*2);ctx.stroke();}
 for(const pulse of feedback.pulses){const q=project(pulse.x,pulse.y),t=Math.max(0,Math.min(1,(now-pulse.at)/550)),moving=feedback.motion&&effects==='full';ctx.globalAlpha=moving?1-t:.75;ctx.strokeStyle=pulse.kind==='exposed'?'#fff4c1':'#f4e1a0';const radius=pulse.kind==='exposed'?9:14;ctx.beginPath();ctx.ellipse(q.x,q.y,radius+(moving?t*8:0),radius*.55+(moving?t*4:0),0,0,Math.PI*2);ctx.stroke();if(pulse.kind==='exposed'){ctx.beginPath();ctx.moveTo(q.x,q.y-5);ctx.lineTo(q.x+4,q.y);ctx.lineTo(q.x,q.y+5);ctx.lineTo(q.x-4,q.y);ctx.closePath();ctx.stroke();}}
 ctx.restore();feedback.painted();
}
