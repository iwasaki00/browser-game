import {WORLD,BATTLE_CAMERA,PLAYER_CLASSES,clamp} from "./data.js?v=0.2.2";
import {movePlayerBody} from "./player.js?v=0.2.2";

export const PLAYER_PRESETS=Object.freeze({
  STANDARD:{...PLAYER_CLASSES.RANGER}, SPEED:{...PLAYER_CLASSES.SCOUT,jump:220},
  HEAVY:{...PLAYER_CLASSES.GUARDIAN,jump:176}, FLIGHT:{...PLAYER_CLASSES.WING,jump:0}
});
export const LAB_ENEMIES=Object.freeze({"E-01":"crawler","E-02":"spider","E-03":"needle","E-04":"beetle","B-01":"boss","E-05":"worm","E-06":"spitter","H-01":"nest","B-02":"queen","E-07":"shorecrab","E-08":"skyray","E-09":"siegebeetle","B-03":"leviathan"});
export const LAB_COUNTS=Object.freeze([1,10,30,50,100,200]);
export function createLabState(equipped,settings){return {
  equipped:[...equipped],settings:{...settings},invincible:true,preset:"STANDARD",
  enemy:"crawler",count:30,placement:"dense",cameraMode:"AUTO",fixedZoom:.5,showFps:true,
  // Reposition always starts from this anchor, not the player's later position.
  anchorX:1000,anchorY:WORLD.ground-32,terrain:'M01',stageMission:'M01',stageArea:0,stageRoute:'LOWER',validationMode:'C',stageDensity:settings.enemyDensity??'STANDARD'
}}

export function landLabPlayer(p,platforms){
  let floor=WORLD.ground-32;
  for(const pl of platforms)if(pl.active!==false&&p.x+7>pl.x&&p.x-7<pl.x+pl.w&&p.y+32<=pl.y+(pl.h??8))floor=Math.min(floor,pl.y-32);
  p.y=floor;p.vx=p.vy=0;p.onGround=true;
}
export function moveFlightPlayer(p,input,platforms,dt){
  const speed=PLAYER_PRESETS.FLIGHT.speed;
  p.vx=((input.right?1:0)-(input.left?1:0))*speed;
  p.vy=((input.down?1:0)-(input.up?1:0))*speed;
  if(p.vx)p.face=Math.sign(p.vx);
  movePlayerBody(p,platforms,dt,true);
}

export function fixedLabCamera(camera,p,zoom){
  camera.zoom=camera.targetZoom=clamp(zoom,BATTLE_CAMERA.minZoom,BATTLE_CAMERA.maxZoom);
  camera.mode="fixed";camera.x=clamp(p.x-160/camera.zoom,0,Math.max(0,(p.world??WORLD).width-320/camera.zoom));
}

// Reuse SpawnDirector's safe position calculation; lab only overrides the formation envelope.
export function labSpawnPosition(director,type,index,count,placement,game){
  const p=game.player,direction=p.x>WORLD.width-1200?-1:1;
  const bounds={left:p.x-180,right:p.x+180};
  const original=game.battleCamera.direction;game.battleCamera.direction=direction;
  const safe=director.position({pattern:"SWARM",enemy:type},index,game,bounds);
  game.battleCamera.direction=original;if(!safe)return null;
  const offset=placement==="dense"?(index%10)*7+Math.floor(index/10)*2:index*8;
  const x=clamp(p.x+direction*(220+offset),24,WORLD.width-48);
  return {x,y:type==="needle"?(placement==="dense"?48+(index%5)*5:20+(index%9)*9):safe.y};
}
