import {VIEW,WORLD,BATTLE_CAMERA,clamp,visibleWorldWidth} from "./data.js";

export function worldToScreen(point,camera,zoom){
  return {x:(point.x-camera)*zoom,y:WORLD.ground+(point.y-WORLD.ground)*zoom};
}

export function screenToWorld(point,camera,zoom){
  return {x:camera+point.x/zoom,y:WORLD.ground+(point.y-WORLD.ground)/zoom};
}

export function clientToScreen(point,rect){
  return {x:(point.x-rect.left)*VIEW.canvasWidth/rect.width,y:(point.y-rect.top)*VIEW.canvasHeight/rect.height};
}

export function followCamera(playerX,zoom,direction=1,world=WORLD){
  return clamp(playerX-(VIEW.canvasWidth/2-direction*BATTLE_CAMERA.lookAhead)/zoom,0,Math.max(0,world.width-visibleWorldWidth(zoom)));
}

export function viewBounds(camera,zoom){
  const topLeft=screenToWorld({x:0,y:0},camera,zoom);
  const bottomRight=screenToWorld({x:VIEW.canvasWidth,y:VIEW.canvasHeight},camera,zoom);
  return {left:topLeft.x,top:topLeft.y,right:bottomRight.x,bottom:bottomRight.y};
}

export function aimTarget(input,origin,camera,zoom){
  if(input.aimMode==="touch")return {x:origin.x+input.touchDx*200,y:origin.y+input.touchDy*200};
  return screenToWorld({x:input.aimX,y:input.aimY},camera,zoom);
}

export const damp = (current,target,rate,dt) => target+(current-target)*Math.exp(-rate*Math.max(0,dt));

export function createBattleCamera(player){
  const bands=Math.ceil(BATTLE_CAMERA.evaluationDistance/BATTLE_CAMERA.bandWidth)*2;
  return {
    x:followCamera(player.x,BATTLE_CAMERA.idleZoom,player.face||1,player.world??WORLD),zoom:BATTLE_CAMERA.idleZoom,
    targetZoom:BATTLE_CAMERA.idleZoom,candidateZoom:BATTLE_CAMERA.idleZoom,
    rawZoom:BATTLE_CAMERA.idleZoom,mode:"idle",candidateMode:"idle",focusX:player.x,
    direction:player.face||1,lookAhead:(player.face||1)*BATTLE_CAMERA.lookAhead,frameLeft:player.x-12,frameRight:player.x+12,
    elapsed:0,stableTime:0,evaluatedEnemies:0,weightedDistance:0,spread:0,
    counts:new Uint32Array(bands),distances:new Float64Array(bands),
    lefts:new Float64Array(bands),rights:new Float64Array(bands)
  };
}

// O(enemies + bands), only every 150 ms. Reuse signed distance-band buffers;
// neither drawing bounds nor the spawn schedule is used as a detection source.
export function evaluateBattleCamera(camera,player,enemies,battle,elapsed=BATTLE_CAMERA.evaluationInterval){
  const c=BATTLE_CAMERA,half=camera.counts.length/2;
  camera.counts.fill(0);camera.distances.fill(0);camera.lefts.fill(Infinity);camera.rights.fill(-Infinity);
  let count=0,boss=null,midboss=null;
  const playerY=player.y+(player.h||27)/2;
  for(let i=0;i<enemies.length;i++){
    const enemy=enemies[i];
    if(enemy.fixedDevice||enemy.dead||enemy.active===false||enemy.spawned===false||enemy.hp<=0)continue;
    const dx=enemy.x-player.x,dy=enemy.y+(enemy.h||0)/2-playerY;
    const distance=Math.hypot(dx,dy);
    if(distance>c.evaluationDistance&&!(enemy.type==='fortress'&&battle.bossStarted))continue;
    if(enemy.type==="boss"||enemy.type==="queen"||enemy.type==='leviathan'||enemy.type==='fortress'){
      if(battle.bossStarted)boss=enemy;
      continue;
    }
    if(enemy.type==="beetle"&&battle.midbossAlive)midboss=enemy;
    const band=Math.min(half-1,Math.floor(distance/c.bandWidth))+(dx>=0?0:half);
    camera.counts[band]++;camera.distances[band]+=distance;count++;
    camera.lefts[band]=Math.min(camera.lefts[band],enemy.x-(enemy.w||24)/2);
    camera.rights[band]=Math.max(camera.rights[band],enemy.x+(enemy.w||24)/2);
  }
  let raw=c.idleZoom,focusX=player.x,mode="idle",distanceSum=0,weightSum=0,weightedCount=0;
  let left=player.x-12,right=player.x+12;
  for(let i=0;i<camera.counts.length;i++){
    const n=camera.counts[i];if(!n)continue;
    const average=camera.distances[i]/n;
    const localBand=i%half;
    const neighbors=(localBand>0?camera.counts[i-1]:0)+(localBand<half-1?camera.counts[i+1]:0);
    const isolated=n===1&&average>c.isolationDistance&&count>c.isolatedGroupLimit&&neighbors===0;
    const ahead=(i<half)===(camera.direction>0);
    const relevance=(isolated?c.isolatedFarWeight:1)*(ahead?1:c.rearWeight);
    const weight=Math.sqrt(n)*relevance;
    distanceSum+=average*weight;weightSum+=weight;weightedCount+=n*relevance;
    // A lone remote outlier influences the mean slightly, but not the framing envelope.
    if(!isolated){left=Math.min(left,camera.lefts[i]);right=Math.max(right,camera.rights[i])}
  }
  if(count){
    const distance=distanceSum/weightSum;
    raw=c.farZoom+(c.maxZoom-c.farZoom)*Math.exp(-distance/c.distanceFalloff);
    raw-=Math.min(c.maxCrowdPenalty,Math.max(0,weightedCount-c.crowdFreeCount)*c.crowdPenalty);
    raw=Math.min(raw,VIEW.canvasWidth*c.groupScreenFraction/(right-left+2*c.groupPadding));
    focusX=(left+right)/2;
    mode="battle";
  }
  const leader=boss||midboss;
  if(leader){
    const padding=boss?c.bossPadding:c.midbossPadding;
    let focus=leader;if(leader.type==='fortress'&&leader.skyPhase<3){let best=Infinity;for(const part of leader.activeParts??[])if(!part.dead&&part.partKind===(leader.skyPhase===1?'turret':'generator')){const d=Math.abs(part.x-player.x);if(d<best){best=d;focus=part}}}
    left=Math.min(player.x-14,focus.x-(focus.w||88)/2);
    right=Math.max(player.x+14,focus.x+(focus.w||88)/2);
    raw=clamp(VIEW.canvasWidth/(right-left+padding*2),boss?c.bossMinZoom:c.minZoom,boss?c.bossMaxZoom:c.midbossMaxZoom);
    focusX=(left+right)/2;mode=boss?"boss":"midboss";
  }
  raw=clamp(raw,c.minZoom,c.maxZoom);
  camera.evaluatedEnemies=count+(boss?1:0);camera.weightedDistance=weightSum?distanceSum/weightSum:0;
  camera.spread=right-left;camera.frameLeft=left;camera.frameRight=right;camera.focusX=focusX;camera.mode=mode;camera.rawZoom=raw;
  if(camera.candidateMode!==mode||Math.abs(raw-camera.candidateZoom)>c.candidateTolerance){
    camera.candidateMode=mode;camera.candidateZoom=raw;camera.stableTime=0;
  }else{camera.candidateZoom=raw;camera.stableTime+=elapsed}
  const hold=mode==="idle"?c.idleHold:c.engageHold;
  if(camera.stableTime+1e-9>=hold&&(mode==="idle"||Math.abs(raw-camera.targetZoom)>c.zoomDeadband))camera.targetZoom=raw;
  return camera;
}

export function updateBattleCamera(camera,player,enemies,battle,dt){
  const c=BATTLE_CAMERA;
  if(Math.abs(player.vx||0)>1)camera.direction=Math.sign(player.vx);
  camera.elapsed+=dt;
  if(camera.elapsed+1e-9>=c.evaluationInterval){
    const elapsed=camera.elapsed;camera.elapsed=Math.max(0,camera.elapsed-c.evaluationInterval);
    evaluateBattleCamera(camera,player,enemies,battle,elapsed);
  }
  camera.zoom=clamp(damp(camera.zoom,camera.targetZoom,camera.targetZoom>camera.zoom?c.zoomInRate:c.zoomOutRate,dt),c.minZoom,c.maxZoom);
  camera.lookAhead=damp(camera.lookAhead,camera.direction*c.lookAhead,c.directionRate,dt);
  const width=visibleWorldWidth(camera.zoom),bossMode=camera.mode==="boss"||camera.mode==="midboss";
  let center=bossMode?camera.focusX:player.x+camera.lookAhead/camera.zoom;
  if(camera.mode==="battle"){
    // Fit the robust envelope when possible; a distant group should actually become visible.
    const minCenter=camera.frameRight+c.groupPadding-width/2,maxCenter=camera.frameLeft-c.groupPadding+width/2;
    center=minCenter<=maxCenter?clamp(center,minCenter,maxCenter):camera.focusX;
  }
  const safeLeft=player.x-(VIEW.canvasWidth-c.playerMargin)/camera.zoom,safeRight=player.x-c.playerMargin/camera.zoom;
  const target=clamp(center-width/2,safeLeft,safeRight);
  camera.x=damp(camera.x,target,c.positionRate,dt);
  camera.x=clamp(clamp(camera.x,safeLeft,safeRight),0,Math.max(0,(battle.world??WORLD).width-width));
  return camera;
}
