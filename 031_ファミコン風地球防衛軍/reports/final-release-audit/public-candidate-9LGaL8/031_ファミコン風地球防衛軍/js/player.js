import {WORLD,PLAYER_CLASSES,normalizeClass,clamp} from "./data.js?v=0.2.2";

export function applyPlayerClass(p,id){
  const c=PLAYER_CLASSES[normalizeClass(id)];
  Object.assign(p,{classId:c.id,hp:c.hp,maxHp:c.hp,energy:c.energyMax??0,flightLocked:false,dashTime:0,dashCd:0,dashHeld:false,dashDirection:p.face||1,hitPose:0,vx:0,vy:0});
}

// Swept movement against the same 8px platforms used by the LAB and renderer.
// Ground classes keep one-way platform landing; flight collides on all faces.
export function movePlayerBody(p,platforms,dt,solid=false){
  const world=p.world??WORLD;
  let x=clamp(p.x+p.vx*dt,8,world.width-25);
  for(const pl of platforms)if(pl.active!==false&&p.y+32>pl.y&&p.y<pl.y+(pl.h??8)){
    if(p.vx>0&&p.x+7<=pl.x&&x+7>pl.x)x=Math.min(x,pl.x-7);
    if(p.vx<0&&p.x-7>=pl.x+pl.w&&x-7<pl.x+pl.w)x=Math.max(x,pl.x+pl.w+7);
  }
  p.x=x;
  let y=clamp(p.y+p.vy*dt,0,world.ground-32);
  for(const pl of platforms)if(pl.active!==false&&p.x+7>pl.x&&p.x-7<pl.x+pl.w){
    if(p.vy>=0&&p.y+32<=pl.y&&y+32>=pl.y)y=Math.min(y,pl.y-32);
    if((solid||pl.solid)&&p.vy<0&&p.y>=pl.y+(pl.h??8)&&y<pl.y+(pl.h??8))y=Math.max(y,pl.y+(pl.h??8));
  }
  if(y!==p.y+p.vy*dt)p.vy=0;
  p.y=y;p.onGround=p.y===world.ground-32||platforms.some(pl=>pl.active!==false&&p.y+32===pl.y&&p.x+7>pl.x&&p.x-7<pl.x+pl.w);
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
    const ascend=!!input.up,hover=!!input.hover;
    // Do not recharge during the takeoff step. HOLD while grounded costs nothing.
    if(p.onGround&&(!ascend||p.flightLocked||p.energy===0)){
      p.energy=Math.min(c.energyMax,p.energy+c.energyRecovery*dt);
      if(p.energy>=c.flightRestartEnergy)p.flightLocked=false;
      p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);movePlayerBody(p,platforms,dt,true);return;
    }
    const powered=p.energy>0&&!p.flightLocked&&(ascend||hover);
    let fallingTime=dt;
    if(powered){
      // FLY wins over HOLD (and down); exactly one drain rate is charged.
      const drain=ascend?c.ascentDrain:c.hoverDrain,activeTime=Math.min(dt,p.energy/drain);
      p.vy=ascend?-c.ascentSpeed:0;
      p.energy=Math.max(0,p.energy-drain*activeTime);
      if(p.energy<1e-8){p.energy=0;p.flightLocked=true}
      movePlayerBody(p,platforms,activeTime,true);fallingTime=Math.max(0,dt-activeTime);
    }
    if(fallingTime>1e-10){
      if(input.down)p.vy=Math.max(c.downSpeed,p.vy);
      p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*fallingTime);
      p.energy=Math.max(0,p.energy-c.descentDrain*fallingTime);
      movePlayerBody(p,platforms,fallingTime,true);
    }
    return;
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
