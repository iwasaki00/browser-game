import {WORLD,PLAYER_CLASSES,normalizeClass,clamp} from "./data.js?v=0.1.8";

export function applyPlayerClass(p,id){
  const c=PLAYER_CLASSES[normalizeClass(id)];
  Object.assign(p,{classId:c.id,hp:c.hp,maxHp:c.hp,energy:c.energyMax??0,flightLocked:false,dashTime:0,dashCd:0,dashHeld:false,dashDirection:p.face||1,hitPose:0,vx:0,vy:0});
}

// Swept movement against the same 8px platforms used by the LAB and renderer.
// Ground classes keep one-way platform landing; flight collides on all faces.
export function movePlayerBody(p,platforms,dt,solid=false){
  let x=clamp(p.x+p.vx*dt,8,WORLD.width-25);
  for(const pl of platforms)if(p.y+32>pl.y&&p.y<pl.y+8){
    if(p.vx>0&&p.x+7<=pl.x&&x+7>pl.x)x=Math.min(x,pl.x-7);
    if(p.vx<0&&p.x-7>=pl.x+pl.w&&x-7<pl.x+pl.w)x=Math.max(x,pl.x+pl.w+7);
  }
  p.x=x;
  let y=clamp(p.y+p.vy*dt,0,WORLD.ground-32);
  for(const pl of platforms)if(p.x+7>pl.x&&p.x-7<pl.x+pl.w){
    if(p.vy>=0&&p.y+32<=pl.y&&y+32>=pl.y)y=Math.min(y,pl.y-32);
    if(solid&&p.vy<0&&p.y>=pl.y+8&&y<pl.y+8)y=Math.max(y,pl.y+8);
  }
  if(y!==p.y+p.vy*dt)p.vy=0;
  p.y=y;p.onGround=p.y===WORLD.ground-32||platforms.some(pl=>p.y+32===pl.y&&p.x+7>pl.x&&p.x-7<pl.x+pl.w);
  if(p.onGround)p.vy=0;
}

export function moveClassPlayer(p,input,platforms,dt){
  if(!(dt>0))return;
  const c=PLAYER_CLASSES[p.classId],direction=(input.right?1:0)-(input.left?1:0);
  p.dashCd=Math.max(0,p.dashCd-dt);p.hitPose=Math.max(0,p.hitPose-dt);
  if(p.dead){p.vx=0;p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);movePlayerBody(p,platforms,dt,c.id==="WING");return}
  if(direction)p.face=direction;
  p.vx=direction*c.speed;
  if(c.id==="WING"){
    if(p.onGround){p.energy=Math.min(c.energyMax,p.energy+c.energyRecovery*dt);if(p.energy>=20)p.flightLocked=false}
    const ascend=input.up,hover=input.hover;
    const powered=p.energy>0&&!p.flightLocked&&(!p.onGround||ascend);
    if(powered){
      p.vy=ascend?-c.ascentSpeed:input.down?c.downSpeed:hover?0:c.descentSpeed;
      p.energy=Math.max(0,p.energy-c.energyDrain*dt);
      if(p.energy<1e-8){p.energy=0;p.flightLocked=true}
    }else p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);
    movePlayerBody(p,platforms,dt,true);return;
  }
  if(c.id==="SCOUT"&&input.special&&!p.dashHeld&&p.dashCd===0){p.dashTime=c.dashDuration;p.dashCd=c.dashCooldown;p.dashDirection=direction||p.face}
  p.dashHeld=!!input.special;
  if(p.dashTime>0){
    // Integrate the last partial dash step without extending it by a whole frame.
    const active=Math.min(dt,p.dashTime);p.vx=(p.dashDirection*c.dashSpeed*active+p.vx*(dt-active))/dt;p.dashTime=Math.max(0,p.dashTime-dt);
  }
  if(input.jump&&p.onGround){p.vy=-c.jump;p.onGround=false}
  p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);movePlayerBody(p,platforms,dt);
}

export function classPlayerFrame(p){
  return p.dead?8:p.hitPose>0?7:p.dashTime>0?9:p.shootPose>0?6:p.classId==="WING"&&!p.onGround?(p.vy<0?10:11):!p.onGround?(p.vy<0?4:5):Math.abs(p.vx)>0?Math.floor(p.anim)%4:0;
}
