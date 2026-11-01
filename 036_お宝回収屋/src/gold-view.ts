import type {State} from './engine';
import {project} from './surface';
export function renderGold(ctx:CanvasRenderingContext2D,s:State,time:number){
 const p=s.explorationAreas[0];ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,325);
 const ground=ctx.createLinearGradient(0,0,0,325);ground.addColorStop(0,'#a6b6aa');ground.addColorStop(1,'#d2c4a6');ctx.fillStyle=ground;ctx.fillRect(0,0,360,325);
 // A small stream runs across the distant edge; all horizontal lines remain level.
 ctx.fillStyle='#81aaa4';ctx.fillRect(0,0,360,43);ctx.fillStyle='#c5cebd';ctx.fillRect(0,43,360,8);
 for(let i=0;i<230;i++){const x=(p.seed+i*137)%360,y=16+(p.seed+i*79)%264,q=project(x,y),k=.6+y/280;ctx.fillStyle=['#7e8e82','#b3b49b','#ddd1b1','#8f9690'][i%4];ctx.beginPath();ctx.ellipse(q.x,q.y,(2+i%4)*k,(1.2+i%3)*k,.2*(i%3),0,Math.PI*2);ctx.fill();}
 for(const site of p.goldSites??[]){const q=project(site.x,site.y),left=1-site.collected/site.total;
  ctx.fillStyle=left>.02?'#bcae8b80':'#8b8f7d80';ctx.beginPath();ctx.ellipse(q.x,q.y,31,18,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=left>.02?'#eef0c6aa':'#76867766';ctx.lineWidth=1;ctx.setLineDash(left>.02?[3,5]:[]);ctx.stroke();ctx.setLineDash([]);
  if(left>.02){ctx.fillStyle='#c9c5a2';for(let i=0;i<Math.ceil(left*9);i++){const a=i*2.4;ctx.beginPath();ctx.ellipse(q.x+Math.cos(a)*17,q.y+Math.sin(a)*9,3,2,0,0,Math.PI*2);ctx.fill();}}
  if(site.rich&&site.announced){ctx.strokeStyle=`rgba(255,236,146,${.5+Math.sin(time*3)*.2})`;ctx.beginPath();ctx.ellipse(q.x,q.y,34,20,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#5a6148';ctx.font='8px sans-serif';ctx.fillText('砂金の集まる場所',Math.min(260,q.x-30),q.y-24);}
  ctx.fillStyle='#586757';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText(left>.02?'採取':'採取済み',q.x,q.y+29);ctx.textAlign='left';
 }
 ctx.strokeStyle='#e0f0db88';ctx.lineWidth=1;for(let row=0;row<3;row++){ctx.beginPath();for(let x=0;x<=360;x+=5){const y=9+row*11+Math.sin(x/28+time*.8+row)*1.8;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
 ctx.fillStyle='#3b5c54';ctx.font='8px sans-serif';ctx.fillText('許可採取区 / GRAVEL & MINERALS',12,314);
}
