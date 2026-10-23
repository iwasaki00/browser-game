import {replayFrame} from './flight-record.js';
export function artFilename(record){
 const stage=record.playType==='free'?'FREE':String(record.stageId??'FREE');
 const safe=stage.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,60)||'FREE';
 const date=new Date(record.createdAt);const stamp=Number.isFinite(date.getTime())?date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'):'UNDATED';
 return `ORBIT_MAKER_${safe}_${stamp}.png`;
}
export function artLayout(record,width,height,text=true){
 if(!record.frames?.length)throw Error('飛行記録に座標がありません。');
 const points=record.frames.map(f=>({x:f[1],y:f[2]}));
 const planets=replayFrame(record,0).planets;
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 const include=(x,y,r=0)=>{if(![x,y,r].every(Number.isFinite))throw Error('座標が不正です。');left=Math.min(left,x-r);right=Math.max(right,x+r);top=Math.min(top,y-r);bottom=Math.max(bottom,y+r);};
 points.forEach(p=>include(p.x,p.y,record.rocketRadius??6));
 include(record.launch.position.x,record.launch.position.y,14);include(record.goal.x,record.goal.y,record.goal.radius+12);
 planets.forEach(p=>include(p.x,p.y,Math.max(p.radius+16,...(p.hazards??[]).map(h=>h.radius+8))));
 const pad=width*.085,header=text?width*.18:pad,footer=text?width*.13:pad;
 const area={x:pad,y:header,width:width-2*pad,height:height-header-footer};
 const scale=Math.min(area.width/Math.max(1,right-left),area.height/Math.max(1,bottom-top));
 return {planets,points,bounds:{left,right,top,bottom},area,scale,
  offsetX:area.x+(area.width-(right-left)*scale)/2-left*scale,
  offsetY:area.y+(area.height-(bottom-top)*scale)/2-top*scale};
}
export async function drawOrbitArt(canvas,record,{text=true,background='space'}={},yieldTask=async()=>{}){
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像用Canvasを作成できません。');
 const w=canvas.width,h=canvas.height,layout=artLayout(record,w,h,text);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#060d1c';ctx.fillRect(0,0,w,h);
 if(background==='space'){
  const mist=ctx.createRadialGradient(w*.7,h*.3,0,w*.5,h*.45,w*.85);mist.addColorStop(0,'#17345b');mist.addColorStop(.5,'#0c1930');mist.addColorStop(1,'#030817');ctx.fillStyle=mist;ctx.fillRect(0,0,w,h);
  for(let i=0;i<190;i++){const x=((i*137.507+23)%997)/997*w,y=((i*83.713+47)%991)/991*h;ctx.fillStyle=`rgba(211,233,255,${.18+(i%7)*.09})`;ctx.beginPath();ctx.arc(x,y,(i%11===0?1.8:.7)*w/1080,0,Math.PI*2);ctx.fill();}
 }
 await yieldTask();
 ctx.save();ctx.translate(layout.offsetX,layout.offsetY);ctx.scale(layout.scale,layout.scale);
 const line=()=>{ctx.beginPath();layout.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));};
 ctx.lineJoin=ctx.lineCap='round';ctx.strokeStyle=record.result==='clear'?'#8cffe0':'#7ce6ff';ctx.lineWidth=2.2;ctx.shadowColor='#52cbff';ctx.shadowBlur=18*w/1080;line();ctx.stroke();ctx.shadowBlur=0;
 ctx.strokeStyle='#e7ffff';ctx.lineWidth=.8;line();ctx.stroke();
 for(const p of layout.planets){
  const color=p.render?.glow??p.color??'#78d9ff';
  const halo=ctx.createRadialGradient(p.x,p.y,p.radius*.5,p.x,p.y,p.radius+14);halo.addColorStop(0,color+'66');halo.addColorStop(1,color+'00');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,p.radius+14,0,Math.PI*2);ctx.fill();
  for(const hazard of p.hazards??[]){ctx.fillStyle=hazard.reason==='overheated'?'#ff9b331a':'#ac83ff22';ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(p.x,p.y,hazard.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);}
  const body=ctx.createRadialGradient(p.x-p.radius*.3,p.y-p.radius*.35,1,p.x,p.y,p.radius);
  body.addColorStop(0,p.effect==='absorption'?'#05020b':p.effect==='heat'?'#fff2b1':'#d7edff');body.addColorStop(.4,p.color??'#78d9ff');body.addColorStop(1,p.effect==='heat'?'#c65b21':'#101a31');
  ctx.fillStyle=body;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.9;ctx.stroke();
  if(['absorption','repulsion'].includes(p.effect)){ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(p.x,p.y,p.radius+10,(p.radius+10)*.65,-.3,0,Math.PI*2);ctx.stroke();}
 }
 const start=record.launch.position,goal=record.goal;
 ctx.strokeStyle='#fff4c4';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(start.x,start.y,10,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#fff4c4';ctx.beginPath();ctx.moveTo(start.x+5,start.y);ctx.lineTo(start.x-3,start.y-4);ctx.lineTo(start.x-3,start.y+4);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#8bffc3';ctx.lineWidth=2;ctx.beginPath();ctx.arc(goal.x,goal.y,goal.radius,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(goal.x,goal.y,goal.radius+5,0,Math.PI*2);ctx.lineWidth=.6;ctx.stroke();ctx.restore();
 await yieldTask();
 if(text){
  ctx.fillStyle='#e8f8ff';ctx.font=`800 ${w*.045}px system-ui,sans-serif`;ctx.fillText('ORBIT MAKER',w*.085,w*.09);
  ctx.fillStyle='#90bbd5';ctx.font=`500 ${w*.021}px system-ui,sans-serif`;
  let title=String(record.stageName??'FREE');while(title.length>1&&ctx.measureText(title).width>w*.8)title=title.slice(0,-2)+'…';ctx.fillText(title,w*.085,w*.13);
  ctx.fillStyle=record.result==='clear'?'#9bffce':'#ffc09b';ctx.font=`700 ${w*.025}px system-ui,sans-serif`;ctx.fillText(`${record.result==='clear'?'CLEAR':'FAIL'}   /   ${record.duration.toFixed(2)} s`,w*.085,h-w*.065);
 }
 return layout;
}
export async function canvasPng(canvas){
 if(canvas.convertToBlob)return canvas.convertToBlob({type:'image/png'});
 return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG画像を作成できません。')),'image/png');}catch(error){reject(error);}});
}
export function canShareImage(navigator,file){try{return typeof navigator?.share==='function'&&typeof navigator?.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false;}}
