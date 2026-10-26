import {ENCOUNTER_TYPES,encounterBodies,encounterPosition} from './encounters.js';
export function drawEncounters(ctx,objects,time,rocket,scale=1,selected=null,camera=null){
 for(const e of objects??[]){
  const center=encounterPosition(e,time),data=ENCOUNTER_TYPES[e.type];if(!data)continue;
  if(camera){const p=camera.toScreen(center),reach=(e.type==='comet'?e.tailLength:Math.max(e.reactionRadius??0,60))*scale+30;if(p.x+reach<0||p.y+reach<0||p.x-reach>camera.width||p.y-reach>camera.height)continue;}
  ctx.save();ctx.strokeStyle=data.color;ctx.fillStyle=data.color;ctx.lineWidth=1.3/scale;
  if(e.type==='comet'){
   const angle=(e.angleDeg??0)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle),end={x:center.x-dx*e.tailLength,y:center.y-dy*e.tailLength};
   ctx.globalAlpha=.15;ctx.lineWidth=e.tailWidth*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(end.x,end.y);ctx.stroke();
   ctx.globalAlpha=1;ctx.lineWidth=1.2/scale;ctx.setLineDash([5/scale,5/scale]);ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
   ctx.font=`${10/scale}px sans-serif`;ctx.fillText(e.tailMode==='brake'?'減速帯':'加速帯',end.x,end.y-6/scale);
  }
  if(e.type==='unknown'||e.type==='station'){
   const near=rocket&&Math.hypot(rocket.x-center.x,rocket.y-center.y)<=e.reactionRadius;
   ctx.globalAlpha=near?.32:.13;ctx.beginPath();ctx.arc(center.x,center.y,e.reactionRadius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
   ctx.setLineDash([4/scale,5/scale]);ctx.beginPath();ctx.arc(center.x,center.y,e.reactionRadius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
   ctx.font=`${10/scale}px sans-serif`;ctx.fillText(e.type==='unknown'?'重力異常・中心注意':'発見圏',center.x+e.radius+6,center.y-6/scale);
  }
  for(const p of encounterBodies(e,time)){
   const r=Math.max(p.radius,5/scale);ctx.beginPath();
   if(e.type==='meteor'){for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,rr=r*(i%2?.85:1);if(!i)ctx.moveTo(p.x+Math.cos(angle)*rr,p.y+Math.sin(angle)*rr);else ctx.lineTo(p.x+Math.cos(angle)*rr,p.y+Math.sin(angle)*rr);}ctx.closePath();}
   else if(e.type==='ufo')ctx.ellipse(p.x,p.y,r*1.3,r*.55,0,0,Math.PI*2);
   else if(e.type==='unknown'){ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();}
   else if(e.type==='station'){ctx.rect(p.x-r,p.y-r*.45,r*2,r*.9);ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);}
   else ctx.arc(p.x,p.y,r,0,Math.PI*2);
   ctx.fill();ctx.stroke();
  }
  if(e.id===selected){ctx.strokeStyle='#fff2a8';ctx.lineWidth=2/scale;ctx.beginPath();ctx.arc(center.x,center.y,Math.max(e.radius+10,20/scale),0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
}
