import {exposure,MAX_DEPTH,type Plot} from './engine';
import {CONFIG} from './data';
export const VIEW={width:360,height:325};
export function project(x:number,y:number){return {x:180+(x-180)*(.8+.2*y/280),y:48+.88*y};}
export function unproject(x:number,y:number){const v=(y-48)/.88;return {x:180+(x-180)/(.8+.2*v/280),y:v};}
export const onSurface=(p:{x:number;y:number})=>p.x>=0&&p.x<360&&p.y>=0&&p.y<280;
const paths:Record<string,string>={
 hand:'<path d="M10 16V9a2 2 0 014 0v6-9a2 2 0 014 0v9-7a2 2 0 014 0v8-4a2 2 0 014 0v10c0 6-4 9-9 9-5 0-7-3-10-8l-3-5a2 2 0 013-2l3 3z" fill="#e7b77b"/>',
 B101:'<path d="M9 5l5 5M9 5L5 9l5 5 4-4 9 9"/><path d="M19 17l9 9c-8 6-14 0-9-9z" fill="#b4c8c2"/>',
 B102:'<path d="M8 3l14 19M13 27l15-10M13 27l3 4M18 24l3 4M23 21l3 4M28 17l3 4"/>',
 B104:'<ellipse cx="16" cy="14" rx="13" ry="8" fill="#e5d6a9"/><path d="M3 14v6c4 11 22 11 26 0v-6M7 10l17 10M9 8l18 9M6 17L20 7M12 21L26 11"/>',
 B105:'<path d="M5 3l9 9M5 3L2 7l8 8 4-3 8 8"/><path d="M18 17l12 12c-11 7-20-2-12-12z" fill="#70968b"/>',
 B201:'<path d="M7 3l5 7 5 12M9 6l7-4 4 6-7 4"/><ellipse cx="21" cy="25" rx="10" ry="5" fill="#5aaba3"/><ellipse cx="21" cy="25" rx="5" ry="2"/>',
};
export function toolIcon(id:string){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" stroke="#244e47" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[id]??paths.hand}</svg>`;}
export function toolCursor(id:string){return `url("data:image/svg+xml,${encodeURIComponent(toolIcon(id))}") 8 26, crosshair`;}
export function visibleFinds(p:Plot){return p.items.filter(f=>f.state==='buried'&&exposure(p,f)>.1);}
function polygon(ctx:CanvasRenderingContext2D,points:{x:number;y:number}[]){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
export function renderSurface(ctx:CanvasRenderingContext2D,p:Plot,time:number,detector?:{x:number;y:number;signal:number},tutorialHint=false){
 ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,360,325);
 const sea=ctx.createLinearGradient(0,0,0,100);sea.addColorStop(0,'#77bbb5');sea.addColorStop(1,'#c8e0cf');ctx.fillStyle=sea;ctx.fillRect(0,0,360,325);
 ctx.strokeStyle='#e6efe0';ctx.lineWidth=2;for(let n=0;n<3;n++){ctx.beginPath();for(let x=0;x<=360;x+=4){const y=12+n*12+Math.sin(x/37+time*.4+n)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}
 const corners=[project(0,0),project(360,0),project(360,280),project(0,280)];
 ctx.save();ctx.shadowColor='#4c684d55';ctx.shadowBlur=13;ctx.shadowOffsetY=8;polygon(ctx,corners);ctx.fillStyle='#cfb07d';ctx.fill();ctx.restore();
 ctx.save();polygon(ctx,corners);ctx.clip();const sand=ctx.createLinearGradient(0,35,100,325);sand.addColorStop(0,'#e7d2a6');sand.addColorStop(.5,'#ebd4a5');sand.addColorStop(1,'#d3b57f');ctx.fillStyle=sand;ctx.fillRect(0,0,360,325);
 // Perspective ripples and stable grain texture; no depth bands or numeric labels.
 ctx.lineWidth=.6;for(let row=0;row<28;row++){ctx.strokeStyle='rgba(149,112,61,.065)';ctx.beginPath();for(let x=0;x<=360;x+=12){const q=project(x,row*10+Math.sin(x/34+row)*2);x?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}ctx.stroke();}
 for(let y=0;y<28;y++)for(let x=0;x<36;x++){const h=((x*71+y*43+p.seed)%97)/97,q=project(x*10+2+h*5,y*10+3);ctx.fillStyle=`rgba(109,79,37,${.07+h*.11})`;ctx.fillRect(q.x,q.y,1,1);}
 drawPits(ctx,p);
 if(tutorialHint){const q=project(50,150);ctx.strokeStyle='rgba(255,251,215,.55)';ctx.lineWidth=1;ctx.setLineDash([2,5]);ctx.beginPath();ctx.ellipse(q.x,q.y,29,18,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#7e6845';ctx.font='8px sans-serif';ctx.textAlign='left';ctx.fillText('この辺りを掘ってみよう',Math.max(8,q.x-20),q.y-25);}
 for(const f of visibleFinds(p)){
  const ex=exposure(p,f),q=project(f.x,f.y);ctx.globalAlpha=Math.min(1,ex*1.6);ctx.shadowColor='#fff3a8';ctx.shadowBlur=ex>=CONFIG.exposure?12:0;ctx.fillStyle=ex>=CONFIG.exposure?'#ffed9b':'#9c8050';
  polygon(ctx,[{x:q.x,y:q.y-6},{x:q.x+6,y:q.y},{x:q.x,y:q.y+6},{x:q.x-6,y:q.y}]);ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;
  if(ex>=CONFIG.exposure){ctx.strokeStyle=`rgba(255,244,193,${.5+Math.sin(time*3)*.2})`;ctx.beginPath();ctx.ellipse(q.x,q.y,11+Math.sin(time*3),7,0,0,Math.PI*2);ctx.stroke();}
 }
 if(detector&&onSurface(detector)){
  const q=project(detector.x,detector.y);ctx.strokeStyle=`rgba(136,255,224,${.3+detector.signal*.7})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,20+detector.signal*13,12+detector.signal*8,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#1b665a';ctx.beginPath();ctx.arc(q.x,q.y,2,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

export function depthAppearance(depth:number){
 const d=Math.max(0,Math.min(MAX_DEPTH,depth));
 const stops:[number,number[]][]=[[0,[233,207,160]],[80,[215,179,119]],[180,[164,119,72]],[280,[100,66,43]]];
 let i=1;while(i<stops.length-1&&d>stops[i][0])i++;
 const [a,ca]=stops[i-1],[b,cb]=stops[i],t=(d-a)/(b-a),color=ca.map((n,k)=>Math.round(n+(cb[k]-n)*t));
 return {color:color as [number,number,number],wall:2+15*Math.pow(d/MAX_DEPTH,.75),shadow:.2+.6*d/MAX_DEPTH};
}
function drawPits(ctx:CanvasRenderingContext2D,p:Plot){
 const visited=new Set<number>();
 for(let start=0;start<1008;start++){
  if(p.mask[start]<.0001||visited.has(start))continue;
  const cells:number[]=[],todo=[start];visited.add(start);
  while(todo.length){const i=todo.pop()!;cells.push(i);const x=i%36,y=Math.floor(i/36);for(const [xx,yy]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=yy*36+xx;if(xx<0||xx>=36||yy<0||yy>=28||visited.has(n)||p.mask[n]<.0001)continue;visited.add(n);todo.push(n);}}
  const members=new Set(cells),edges=new Map<string,[number,number]>();
  const edge=(x:number,y:number,xx:number,yy:number)=>edges.set(x+','+y,[xx,yy]);
  for(const i of cells){const x=i%36,y=Math.floor(i/36);if(y===0||!members.has(i-36))edge(x,y,x+1,y);if(x===35||!members.has(i+1))edge(x+1,y,x+1,y+1);if(y===27||!members.has(i+36))edge(x+1,y+1,x,y+1);if(x===0||!members.has(i-1))edge(x,y+1,x,y);}
  const path=new Path2D();
  while(edges.size){const key=edges.keys().next().value!,vertices:{x:number;y:number}[]=[];let current=key;
   for(let count=0;count<=cells.length*4;count++){const next=edges.get(current);if(!next)break;const [x,y]=current.split(',').map(Number);vertices.push(project(x*10,y*10));edges.delete(current);current=next[0]+','+next[1];if(current===key)break;}
   if(vertices.length<3)continue;const first=vertices[0],last=vertices.at(-1)!;path.moveTo((last.x+first.x)/2,(last.y+first.y)/2);
   vertices.forEach((v,i)=>{const n=vertices[(i+1)%vertices.length];path.quadraticCurveTo(v.x,v.y,(v.x+n.x)/2,(v.y+n.y)/2);});path.closePath();
  }
  // Each floor patch uses the same local depth as digging and treasure exposure.
  // Averaging a connected hole would wash out its deep center when a wider tool adds shallows.
  ctx.fillStyle='#4a311f';ctx.fill(path);ctx.save();ctx.clip(path);
  for(const i of cells){const x=i%36*10,y=Math.floor(i/36)*10,depth=p.mask[i]*MAX_DEPTH,look=depthAppearance(depth);
   const patch=new Path2D(),corners=[project(x,y),project(x+10,y),project(x+10,y+10),project(x,y+10)];
   corners.forEach((q,j)=>j?patch.lineTo(q.x,q.y):patch.moveTo(q.x,q.y));patch.closePath();
   ctx.save();ctx.translate(0,look.wall*.28);ctx.fillStyle=`rgb(${look.color.join(',')})`;ctx.fill(patch);ctx.restore();
   const above=y>0?p.mask[i-36]*MAX_DEPTH:0;
   if(depth>above+1){const left=project(x,y),right=project(x+10,y);ctx.strokeStyle=`rgba(64,39,23,${look.shadow})`;ctx.lineWidth=Math.min(5,look.wall-depthAppearance(above).wall+1);ctx.beginPath();ctx.moveTo(left.x,left.y+1);ctx.lineTo(right.x,right.y+1);ctx.stroke();}
  }
  ctx.restore();
  ctx.strokeStyle='rgba(248,224,172,.7)';ctx.lineWidth=.8;ctx.stroke(path);
 }
}
