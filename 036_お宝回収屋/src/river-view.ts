import {tool} from './data';
import type {State} from './engine';
import {project} from './surface';
import {riverCapabilities} from './river';

export function renderRiver(ctx:CanvasRenderingContext2D,s:State,time:number,active:string,aim?:{x:number;y:number}){
 const p=s.explorationAreas[0];ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,325);
 const water=ctx.createLinearGradient(0,0,0,310);water.addColorStop(0,'#285963');water.addColorStop(.65,'#739a87');water.addColorStop(1,'#b4bea0');ctx.fillStyle=water;ctx.fillRect(0,0,360,325);
 ctx.save();ctx.beginPath();[project(0,0),project(360,0),project(360,280),project(0,280)].forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.clip();
 // Fixed stones and plants create recognizable positions without exposing identities.
 for(let i=0;i<70;i++){const x=(p.seed+i*137)%350,y=20+(p.seed+i*79)%250,q=project(x,y),k=.5+y/280;ctx.fillStyle=i%3===0?'#536e65':'#a2a58c';ctx.beginPath();ctx.ellipse(q.x,q.y,3+4*k,2+2*k,0,0,Math.PI*2);ctx.fill();if(i%9===0){ctx.strokeStyle='#467462';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.quadraticCurveTo(q.x-6,q.y-10,q.x+Math.sin(time+i)*3,q.y-18);ctx.stroke();}}
 for(const f of p.items){if(f.state!=='buried')continue;const q=project(f.x,f.y);ctx.globalAlpha=.12+.6*f.y/280;ctx.fillStyle=f.obstacle?'#354842':'#4d6255';ctx.beginPath();ctx.ellipse(q.x,q.y,f.obstacle?12:6,f.obstacle?7:3,-.3,0,Math.PI*2);ctx.fill();if(f.y>230){ctx.strokeStyle='#d8e6b4';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(q.x,q.y,11,6,0,0,Math.PI*2);ctx.stroke();}}
 ctx.globalAlpha=1;const haze=ctx.createLinearGradient(0,40,0,280);haze.addColorStop(0,'#366773aa');haze.addColorStop(1,'#96c1ad05');ctx.fillStyle=haze;ctx.fillRect(0,0,360,325);ctx.restore();
 ctx.lineWidth=.7;for(let i=0;i<12;i++){ctx.strokeStyle=i%2?'#d4efe62c':'#173f4722';ctx.beginPath();for(let x=0;x<=360;x+=6){const y=25+i*23+Math.sin(x/29+time*.8+i)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
 // Near bank remains level from left to right, matching the beach projection.
 ctx.fillStyle='#c3b18a';ctx.beginPath();ctx.moveTo(0,298);ctx.quadraticCurveTo(180,282,360,298);ctx.lineTo(360,325);ctx.lineTo(0,325);ctx.fill();ctx.strokeStyle='#ecdfb8';ctx.stroke();
 const r=s.riverSession,c=riverCapabilities(s,active),origin=project(180,278);
 if(aim&&c.rope&&!r?.uid){const q=project(aim.x,aim.y);ctx.setLineDash([4,4]);ctx.strokeStyle='#f9e2a8aa';ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.setLineDash([]);}
 if(r){const flight=Math.min(1,r.elapsed/.45),progress=r.progress;
  const q=project(r.originX+(r.x-r.originX)*flight*(1-progress),r.originY+(r.y-r.originY)*flight*(1-progress));
  if(r.magnetic){ctx.strokeStyle=progress>.65?'#e3be7d':'#d5d8bc';ctx.lineWidth=progress>.65?2:1;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.quadraticCurveTo((origin.x+q.x)/2+8,(origin.y+q.y)/2+12*(1-progress),q.x,q.y);ctx.stroke();ctx.fillStyle='#bd704d';ctx.fillRect(q.x-4,q.y-4,8,7);}
  ctx.strokeStyle=r.uid?'#ffe3a3':'#bad9cc';ctx.beginPath();ctx.ellipse(q.x,q.y,12+Math.sin(time*4)*2,6,0,0,Math.PI*2);ctx.stroke();
  if(r.uid&&!r.magnetic){ctx.strokeStyle='#cbbf94';ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.fillStyle='#c1c8bb';ctx.fillRect(q.x-3,q.y-3,6,6);}
  if(r.uid){const f=p.items.find(f=>f.uid===r.uid),weight=f?.weight??0;ctx.fillStyle='#e3eee0';ctx.font='9px sans-serif';ctx.textAlign='left';ctx.fillText((tool(r.tool)?.name??'素手')+' / '+(weight>8?'強い抵抗':weight>2?'重みあり':'軽い手応え'),15,31);ctx.fillStyle='#e4e9c9';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(progress>.85?'水面付近':progress>.1?'水中から移動中':'引き上げ開始',q.x,Math.max(20,q.y-14));ctx.fillStyle='#264d47';ctx.fillRect(90,307,180,5);ctx.fillStyle='#e4bf77';ctx.fillRect(90,307,180*progress,5);ctx.textAlign='left';}
 }
 ctx.fillStyle='#e3eee0';ctx.font='8px sans-serif';ctx.fillText('RIVER / 水面の下を探ろう',13,18);
}
