// Immutable definitions and analytic motion; no rendering or physics imports.
export const ENCOUNTER_VERSION=1,MAX_ENCOUNTERS=6;
export const ENCOUNTER_TYPES={
 meteor:{name:'隕石群',radius:8,color:'#c2a18b',description:'移動する隕石。接触で失敗。数量と速度を設定可能'},
 comet:{name:'彗星',radius:12,color:'#80edff',description:'尾の帯で加速／減速。本体への接触は失敗'},
 unknown:{name:'未知の物体',radius:18,color:'#e7a0ff',description:'点線内は重力異常。中心への接触に注意'},
 ufo:{name:'UFO',radius:16,color:'#9af3a2',description:'設定航路を周回。接触を避けて航行'},
 station:{name:'宇宙ステーション',radius:20,color:'#ffdc8a',description:'接近すると発見ログ。接触しても航行は継続'},
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createEncounter(type,id,x,y,settings={}){
 if(!ENCOUNTER_TYPES[type])return null;
 return {id,type,x,y,radius:ENCOUNTER_TYPES[type].radius,speed:['unknown','station'].includes(type)?0:clamp(Number(settings.speed??40),0,160),
  angleDeg:0,count:type==='meteor'?clamp(Math.round(Number(settings.count??5)),1,12):1,strength:clamp(Number(settings.strength??60),0,120),
  tailMode:settings.tailMode==='brake'?'brake':'boost',tailLength:160,tailWidth:22,reactionRadius:type==='unknown'?180:100,
  route:type==='ufo'?[{x:-35,y:-20},{x:35,y:-20},{x:35,y:20},{x:-35,y:20}]:undefined,...(settings.fixed?{fixed:true}:{})};
}
function routeData(e){const route=e.route??[],lengths=route.map((p,i)=>Math.hypot(route[(i+1)%route.length].x-p.x,route[(i+1)%route.length].y-p.y));return {route,lengths,total:lengths.reduce((a,b)=>a+b,0)};}
export function encounterPosition(e,time){
 if(e.type==='ufo'){
  const {route,lengths,total}=routeData(e);if(total<=0||!route.length)return {x:e.x,y:e.y};
  let d=((Math.max(0,time)*e.speed)%total+total)%total;
  for(let i=0;i<route.length;i++){if(d<=lengths[i]||i===route.length-1){const a=route[i],b=route[(i+1)%route.length],f=lengths[i]?d/lengths[i]:0;return {x:e.x+a.x+(b.x-a.x)*f,y:e.y+a.y+(b.y-a.y)*f};}d-=lengths[i];}
 }
 const angle=(e.angleDeg??0)*Math.PI/180,speed=e.speed??0;
 return {x:e.x+Math.cos(angle)*speed*time,y:e.y+Math.sin(angle)*speed*time};
}
export function encounterBodies(e,time){
 const p=encounterPosition(e,time);
 return Array.from({length:e.type==='meteor'?e.count:1},(_,i)=>{
  const r=i?12+Math.sqrt(i)*9:0,angle=i*2.399963;
  return {...p,x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r,radius:e.radius,id:`${e.id}:${i}`};
 });
}
export function encounterCuts(e,start,end){
 const cuts=[start,end];if(e.type!=='ufo'||!(e.speed>0))return cuts;
 const {lengths,total}=routeData(e);if(!total)return cuts;const period=total/e.speed;
 for(let cycle=Math.floor(start/period);cycle<=Math.floor(end/period);cycle++){
  let offset=0;for(const length of lengths){offset+=length;const t=cycle*period+offset/e.speed;if(t>start&&t<end)cuts.push(t);}
 }
 return cuts.sort((a,b)=>a-b);
}
export function encounterGravity(position,objects,time){
 let x=0,y=0;
 for(const e of objects.filter(e=>e.type==='unknown').sort((a,b)=>a.id.localeCompare(b.id))){
  const p=encounterPosition(e,time),dx=p.x-position.x,dy=p.y-position.y,d=Math.hypot(dx,dy),range=e.reactionRadius;
  if(d>=range)continue;const softened=Math.max(24,d),force=e.strength*4000*(1-d/range)**2/softened**3;
  x+=dx*force;y+=dy*force;
 }return {x,y};
}
// Fraction of a segment inside a capsule, including full-speed tail crossings.
function circleInterval(a,b,c,r){
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-c.x,fy=a.y-c.y,A=dx*dx+dy*dy,C=fx*fx+fy*fy-r*r;
 if(!A)return C<=0?[0,1]:null;const B=2*(fx*dx+fy*dy),D=B*B-4*A*C;if(D<0)return null;
 const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));return lo<=hi?[lo,hi]:null;
}
export function tailExposure(e,start,end,t0,t1){
 const a0=encounterPosition(e,t0),b0=encounterPosition(e,t1),angle=(e.angleDeg??0)*Math.PI/180,dx=-Math.cos(angle),dy=-Math.sin(angle);
 const project=(p,c)=>({x:(p.x-c.x)*dx+(p.y-c.y)*dy,y:-(p.x-c.x)*dy+(p.y-c.y)*dx});
 const a=project(start,a0),b=project(end,b0),width=e.tailWidth,length=e.tailLength,intervals=[];
 let lo=0,hi=1;
 for(const [v,d,min,max]of [[a.x,b.x-a.x,0,length],[a.y,b.y-a.y,-width,width]]){
  if(Math.abs(d)<1e-12){if(v<min||v>max){hi=-1;break;}}
  else{const p=(min-v)/d,q=(max-v)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}
 }
 if(lo<=hi)intervals.push([lo,hi]);
 for(const c of [{x:0,y:0},{x:length,y:0}]){const interval=circleInterval(a,b,c,width);if(interval)intervals.push(interval);}
 intervals.sort((a,b)=>a[0]-b[0]);let coverage=0,last=0;
 for(const [a,b]of intervals){coverage+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}return clamp(coverage,0,1);
}
export function cometAcceleration(e,velocity,fraction){
 const speed=Math.hypot(velocity.x,velocity.y);
 const scale=e.tailMode==='brake'?-e.strength/120:e.strength/Math.max(1,speed);
 return {x:velocity.x*scale*fraction,y:velocity.y*scale*fraction};
}
export function encounterExtent(e){return e.type==='meteor'?e.radius+12+Math.sqrt(e.count)*9:e.type==='ufo'?e.radius+Math.max(...e.route.map(p=>Math.hypot(p.x,p.y))):e.radius;}
export function encounterPlacementAllowed(candidate,stage){
 if(candidate.fixed){const old=stage.encounters?.find(e=>e.id===candidate.id);if(!old||candidate.x!==old.x||candidate.y!==old.y)return false;}
 const r=encounterExtent(candidate),{x,y}=candidate;
 if(x<r||y<r||x>stage.world.width-r||y>stage.world.height-r)return false;
 if(Math.hypot(x-stage.launch.position.x,y-stage.launch.position.y)<r+28||Math.hypot(x-stage.goal.x,y-stage.goal.y)<r+stage.goal.radius+12)return false;
 return [...stage.planets.map(p=>({...p,radius:Math.max(p.radius,...(p.hazards??[]).map(h=>h.radius))})),...(stage.encounters??[]).filter(e=>e.id!==candidate.id).map(e=>({...e,radius:encounterExtent(e)}))].every(p=>Math.hypot(x-p.x,y-p.y)>=r+p.radius+8);
}
export function addEncounter(stage,type,settings={}){
 if((stage.encounters?.length??0)>=MAX_ENCOUNTERS)return null;
 const id=`encounter-${globalThis.crypto?.randomUUID?.()??Date.now()}`,candidate=createEncounter(type,id,0,0,settings);if(!candidate)return null;
 for(let y=65;y<stage.world.height;y+=65)for(let x=65;x<stage.world.width;x+=65){const p={...candidate,x,y};if(encounterPlacementAllowed(p,stage)){stage.encounters??=[];stage.encounters.push(p);return p;}}return null;
}
