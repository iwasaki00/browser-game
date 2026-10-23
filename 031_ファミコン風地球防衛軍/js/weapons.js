import {WORLD,clamp} from "./data.js?v=0.2.2";

export const WEAPON_LIMITS=Object.freeze({shots:384,jobs:128,eventsPerTick:4,remoteHoldMs:450,turretActiveDistance:700,trailDraws:64});
export function createArsenal(){return {ownerId:"player",nextId:1,installations:[],jobs:[],pending:[],candidates:[],stats:{blasts:0,maxDepth:0,strikes:0,splits:0},lastMineCount:-1}}
export function clearArsenal(g){g.arsenal=createArsenal();let n=0;for(const s of g.shots)if(!s.expanded)g.shots[n++]=s;g.shots.length=n}
export function mineCount(g){let n=0;if(g?.arsenal)for(const i of g.arsenal.installations)if(i.type==="mine"&&i.ownerId===g.arsenal.ownerId)n++;return n}

// Earliest segment entry, also used for swept enemy hits (not just visual trails).
export function segmentEntry(x,y,nx,ny,left,top,right,bottom){
  const dx=nx-x,dy=ny-y;let enter=0,leave=1,normalX=0,normalY=0;
  for(let axis=0;axis<2;axis++){
    const p=axis?y:x,d=axis?dy:dx,min=axis?top:left,max=axis?bottom:right;
    if(Math.abs(d)<1e-9){if(p<min||p>max)return null;continue}
    const a=(min-p)/d,b=(max-p)/d,lo=Math.min(a,b),hi=Math.max(a,b);
    if(lo>=enter){enter=lo;normalX=axis?0:(d>0?-1:1);normalY=axis?(d>0?-1:1):0}
    leave=Math.min(leave,hi);if(enter>leave)return null;
  }
  if(leave<0||enter>1)return null;
  if(!normalX&&!normalY){if(Math.abs(dx)>Math.abs(dy))normalX=dx>0?-1:1;else normalY=dy>0?-1:1}
  return {t:Math.max(0,enter),nx:normalX,ny:normalY};
}
export function terrainContact(x,y,nx,ny,platforms,r=0,ceiling=false,world=WORLD){
  let best=null;
  const consider=hit=>{if(hit&&(!best||hit.t<best.t))best=hit};
  if(nx<r)consider({t:(r-x)/(nx-x),nx:1,ny:0});
  if(nx>world.width-r)consider({t:(world.width-r-x)/(nx-x),nx:-1,ny:0});
  if(ny>world.ground-r)consider({t:(world.ground-r-y)/(ny-y),nx:0,ny:-1});
  if(ceiling&&ny<r)consider({t:(r-y)/(ny-y),nx:0,ny:1});
  for(const pl of platforms)if(pl.active!==false)consider(segmentEntry(x,y,nx,ny,pl.x-r,pl.y-r,pl.x+pl.w+r,pl.y+(pl.h??8)+r));
  if(best){best.t=clamp(best.t,0,1);best.x=x+(nx-x)*best.t;best.y=y+(ny-y)*best.t}return best;
}
function surfaceAt(g,x,fromY){let y=WORLD.ground;for(const p of g.platforms)if(p.active!==false&&x>=p.x&&x<=p.x+p.w&&p.y>=fromY-.01)y=Math.min(y,p.y);return y}
function addShot(g,w,x,y,vx,vy,extra={}){
  if(g.shots.length+g.arsenal.pending.length>=WEAPON_LIMITS.shots)return null;
  const s={uid:g.arsenal.nextId++,ownerId:g.arsenal.ownerId,expanded:true,weapon:w,type:w.type,effectType:w.effectType,assetIndex:w.assetIndex,
    x,y,oldX:x,oldY:y,vx,vy,originX:x,originY:y,w:w.size||8,h:w.size||8,life:w.life,age:0,damage:w.damage,radius:w.radius,pierce:w.pierce||1,bounces:0,generation:0,rehit:Object.create(null),...extra};
  g.arsenal.pending.push(s);return s;
}
function flushShots(g){for(const s of g.arsenal.pending)g.shots.push(s);g.arsenal.pending.length=0}
function queue(g,job){if(g.arsenal.jobs.length>=WEAPON_LIMITS.jobs)return false;g.arsenal.jobs.push(job);return true}
function aimPoint(w,origin,target,world=WORLD){const dx=target.x-origin.x,dy=target.y-origin.y,len=Math.hypot(dx,dy)||1,t=Math.min(1,w.range/len);return {x:clamp(origin.x+dx*t,8,world.width-8),y:clamp(origin.y+dy*t,0,world.ground)}}

export function fireExpanded(g,w,origin,target,api){
  const a=g.arsenal,dx=target.x-origin.x,dy=target.y-origin.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  if(w.type==="mine"||w.type==="turret"){
    let count=0;for(const i of a.installations)if(i.type===w.type&&i.ownerId===a.ownerId)count++;
    if(count>=w.installLimit)return false;
    const x=clamp(g.player.x+g.player.face*14,12,(g.world??WORLD).width-12),y=surfaceAt(g,x,g.player.y+32);
    if(g.missionId==='M02'&&g.platforms.some(p=>p.active!==false&&x>=p.x&&x<=p.x+p.w&&y-10<p.y+(p.h??8)&&y>p.y))return false;
    a.installations.push({uid:a.nextId++,ownerId:a.ownerId,type:w.type,weapon:w,x,y,life:w.life,cooldown:.12});return true;
  }
  if(w.type==="storm"||w.type==="meteor"){
    const point=aimPoint(w,origin,target,g.world??WORLD);
    return queue(g,{kind:w.type,weapon:w,...point,timer:0,remaining:w.strikes,index:0,hits:new Map(),life:w.life});
  }
  const count=w.type==="spiral"?2:w.type==="wideflame"?w.pellets:1;
  if(g.shots.length+a.pending.length+count>WEAPON_LIMITS.shots)return false;
  for(let i=0;i<count;i++){
    const angle=w.type==="wideflame"?(i/(count-1)-.5)*2*w.spread:0,ca=Math.cos(angle),sa=Math.sin(angle);
    addShot(g,w,origin.x,origin.y,(ux*ca-uy*sa)*w.speed,(ux*sa+uy*ca)*w.speed,
      w.type==="spiral"?{axisX:ux,axisY:uy,phase:i*Math.PI}:{});
  }
  flushShots(g);return true;
}

function blast(g,s,api,chain=null){
  g.arsenal.stats.blasts++;
  const source={...s,effectType:s.weapon.effectType,assetIndex:s.weapon.assetIndex};
  if(chain){
    g.arsenal.stats.maxDepth=Math.max(g.arsenal.stats.maxDepth,chain.depth);
    source.onKill=e=>{
      if(chain.state.scheduled>=s.weapon.chainLimit||chain.state.seen.has(e.uid))return;
      chain.state.seen.add(e.uid);
      if(queue(g,{kind:"chain",weapon:s.weapon,x:e.x,y:e.y+e.h/2,timer:s.weapon.chainDelay,
        depth:chain.depth+1,state:chain.state}))chain.state.scheduled++;
    };
  }
  api.blast(source);
}
function startBlast(g,s,api){
  if(s.weapon.type==="chain")blast(g,s,api,{depth:1,state:{scheduled:1,seen:new Set()}});
  else blast(g,s,api);
}
function splitShot(g,s,cluster){
  const w=s.weapon;if(s.generation>=w.maxGeneration)return false;
  const base=Math.atan2(s.vy,s.vx);g.arsenal.stats.splits++;
  for(let i=0;i<w.children;i++){
    const angle=cluster?-Math.PI+(i+.5)*Math.PI/w.children:base+(i-(w.children-1)/2)*.23;
    const speed=cluster?70+(i%3)*15:185;
    addShot(g,w,clamp(s.x,2,(g.world??WORLD).width-2),Math.min(s.y,WORLD.ground-3),Math.cos(angle)*speed,Math.sin(angle)*speed,
      {generation:s.generation+1,life:cluster?.7+(i%3)*.10:1.6,gravity:cluster?330:0,w:6,h:6});
  }
  s.dead=true;return true;
}
export function detonateMines(g,api){
  if(!g?.arsenal)return 0;let count=0,write=0;
  for(const i of g.arsenal.installations){
    if(i.type==="mine"&&i.ownerId===g.arsenal.ownerId){blast(g,{...i,y:i.y-3,radius:i.weapon.radius,damage:i.weapon.damage},api);count++}
    else g.arsenal.installations[write++]=i;
  }
  g.arsenal.installations.length=write;return count;
}
function nearest(g,x,y,r,hits=null,limit=Infinity){
  const list=g.grid.query(x-r-48,y-r-32,x+r+48,y+r+32,g.arsenal.candidates);
  let best=null,bestHits=Infinity,bestDistance=Infinity;
  for(const e of list){if(e.dead||e.active===false)continue;const n=hits?.get(e.uid)||0,d=Math.hypot(e.x-x,e.y+e.h/2-y);
    if(d<=r&&n<limit&&(n<bestHits||n===bestHits&&d<bestDistance)){best=e;bestHits=n;bestDistance=d}}
  return best;
}
function updateJobs(g,dt,api){
  const jobs=g.arsenal.jobs,initial=jobs.length;let blasts=0;
  for(let i=0;i<initial;i++){
    const j=jobs[i],w=j.weapon;j.timer-=dt;
    if(j.kind==="chain"){
      if(j.timer<=0&&blasts<WEAPON_LIMITS.eventsPerTick){blasts++;blast(g,{...j,type:w.type,radius:w.radius,damage:w.damage},api,{depth:j.depth,state:j.state});j.dead=true}
      continue;
    }
    j.life-=dt;
    if(j.timer<=0&&j.remaining>0){
      if(j.kind==="storm"){
        const e=nearest(g,j.x,j.y,w.targetRadius,j.hits,w.targetLimit),x=e?.x??j.x,y=e?e.y+e.h/2:Math.min(WORLD.ground,j.y+45);
        const blocked=g.missionId==='M02'&&terrainContact(j.x,j.y-40,x,y,g.platforms,0,false,g.world??WORLD);
        if(e&&!blocked){j.hits.set(e.uid,(j.hits.get(e.uid)||0)+1);api.damage(e,w.damage,{type:w.type,effectType:w.effectType,assetIndex:w.assetIndex,x,y,vx:0,vy:1})}
        api.effect({kind:"lightning",x:j.x,y:j.y-40,x2:x,y2:y,life:.16,max:.16,assetIndex:w.assetIndex});g.arsenal.stats.strikes++;
      }else{
        const x=clamp(j.x+(j.index-(w.strikes-1)/2)*22,8,(g.world??WORLD).width-8);
        addShot(g,w,x,-60-(j.index%3)*12,0,w.speed,{life:2,gravity:100,radius:w.radius});
      }
      j.index++;j.remaining--;j.timer+=w.strikeInterval;
    }
    if(j.life<=0||!j.remaining)j.dead=true;
  }
  let write=0;for(const j of jobs)if(!j.dead)jobs[write++]=j;jobs.length=write;
}
function updateInstallations(g,dt){
  const list=g.arsenal.installations;let write=0;
  for(const i of list){i.life-=dt;if(i.life<=0||i.ownerId!==g.arsenal.ownerId)continue;list[write++]=i;
    if(i.type!=="turret"||g.player.dead||Math.abs(i.x-g.player.x)>WEAPON_LIMITS.turretActiveDistance)continue;
    i.cooldown-=dt;if(i.cooldown>0)continue;
    const w=i.weapon,e=nearest(g,i.x,i.y-10,w.range);if(!e){i.cooldown=.1;continue}
    const dx=e.x-i.x,dy=e.y+e.h/2-(i.y-10),len=Math.hypot(dx,dy)||1;
    addShot(g,w,i.x,i.y-10,dx/len*w.speed,dy/len*w.speed,{type:"turretBolt",life:w.range/w.speed,w:5,h:4,radius:0});i.cooldown=w.shotInterval;
  }
  list.length=write;
}
export function updateExpanded(g,dt,api){
  if(g.clear)return;
  updateJobs(g,dt,api);updateInstallations(g,dt);
  // Newly split/installed shots enter only after this bounded pass, never recursively.
  const length=g.shots.length;
  for(let index=0;index<length;index++){
    const s=g.shots[index];if(!s.expanded||s.dead)continue;const w=s.weapon;s.age+=dt;s.life-=dt;s.oldX=s.x;s.oldY=s.y;
    const cluster=w.type==="cluster",parent=s.generation===0;
    if((cluster&&parent&&s.age>=w.fuse)||(w.type==="split"&&parent&&(s.age>=w.splitAfter||nearest(g,s.x,s.y,w.proximity)))){splitShot(g,s,cluster);continue}
    if(s.gravity||cluster)s.vy+=(s.gravity??w.gravity)*dt;
    let nx=s.x+s.vx*dt,ny=s.y+s.vy*dt;
    if(w.type==="spiral"){
      const offset=Math.sin(s.age*w.frequency+s.phase)*w.amplitude;
      nx=s.originX+s.axisX*w.speed*s.age-s.axisY*offset;ny=s.originY+s.axisY*w.speed*s.age+s.axisX*offset;
    }
    const contact=terrainContact(s.x,s.y,nx,ny,g.platforms,s.w/2,w.type==="bounce",g.world??WORLD);
    if(contact){nx=contact.x;ny=contact.y}
    // Enemy damage is independent of terrain reflection and uses swept positions.
    const list=g.grid.query(Math.min(s.x,nx)-s.w/2-48,Math.min(s.y,ny)-s.h/2-32,Math.max(s.x,nx)+s.w/2+48,Math.max(s.y,ny)+s.h/2+32,g.arsenal.candidates);
    let impact=null;
    for(const e of list){
      if(e.dead||(s.rehit[e.uid]??-1)>g.time)continue;
      const hit=segmentEntry(s.x,s.y,nx,ny,e.x-e.w/2-s.w/2,e.y-s.h/2,e.x+e.w/2+s.w/2,e.y+e.h+s.h/2);
      if(!hit)continue;
      if(s.radius||w.type==="split"&&parent||cluster&&parent){if(!impact||hit.t<impact.t)impact=hit;continue}
      s.rehit[e.uid]=w.rehit?g.time+w.rehit:Infinity;api.damage(e,s.damage,s);
      if(w.type!=="wideflame"&&--s.pierce<=0){s.dead=true;break}
    }
    s.x=nx;s.y=ny;
    if(impact){s.x=s.oldX+(nx-s.oldX)*impact.t;s.y=s.oldY+(ny-s.oldY)*impact.t;
      if((w.type==="split"||cluster)&&parent)splitShot(g,s,cluster);else{startBlast(g,s,api);s.dead=true}continue}
    if(contact){
      if(w.type==="bounce"&&!s.dead&&s.bounces<w.bounces){s.bounces++;if(contact.nx)s.vx*=-1;if(contact.ny)s.vy*=-1;s.x+=contact.nx*.25;s.y+=contact.ny*.25}
      else{if(!s.dead){if((w.type==="split"||cluster)&&parent)splitShot(g,s,cluster);else if(s.radius)startBlast(g,s,api)}s.dead=true}
    }
    if(!s.dead&&s.life<=0){if((w.type==="split"||cluster)&&parent)splitShot(g,s,cluster);else if(s.radius)startBlast(g,s,api);s.dead=true}
    if(s.x<0||s.x>(g.world??WORLD).width||s.y< -200||s.y>WORLD.ground+32||!Number.isFinite(s.x+s.y))s.dead=true;
  }
  let write=0;for(const s of g.shots)if(!s.dead)g.shots[write++]=s;g.shots.length=write;flushShots(g);
}

export function drawExpanded(ctx,g,images,bounds){
  let trails=0;
  for(const s of g.shots){if(!s.expanded||s.x<bounds.left-32||s.x>bounds.right+32)continue;
    if(trails++<WEAPON_LIMITS.trailDraws){ctx.strokeStyle=s.weapon.color;ctx.lineWidth=s.weapon.type==="plasma"?4:1;ctx.beginPath();ctx.moveTo(s.oldX,s.oldY);ctx.lineTo(s.x,s.y);ctx.stroke()}
    const size=s.weapon.type==="plasma"?24:s.weapon.type==="wideflame"?14:16;
    ctx.save();ctx.translate(Math.round(s.x),Math.round(s.y));ctx.rotate(Math.atan2(s.vy,s.vx));ctx.drawImage(images.shots,s.assetIndex*16,0,16,16,-size/2,-size/2,size,size);ctx.restore();
  }
  for(const i of g.arsenal.installations){if(i.x<bounds.left-32||i.x>bounds.right+32)continue;ctx.drawImage(images.weapons,i.weapon.assetIndex*32,0,32,32,Math.round(i.x)-12,i.y-24,24,24)}
  for(const j of g.arsenal.jobs)if(j.kind==="storm"&&j.x>=bounds.left-100&&j.x<=bounds.right+100){ctx.drawImage(images.weaponFx,4*32,(j.weapon.assetIndex-8)*32,32,32,j.x-32,j.y-64,64,32)}
}
