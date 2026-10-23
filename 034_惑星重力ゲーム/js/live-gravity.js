import { DEFAULT_PHYSICS, stepSimulation, segmentCircleHit } from './physics.js';
export const LIVE_GRAVITY = Object.freeze({ maxSpeed: 90 });
export const GAME_MODE_KEY = 'orbit-maker.game-mode';
export function loadGameMode(storage) {
  try { return storage?.getItem(GAME_MODE_KEY)==='live'?'live':'design'; } catch { return 'design'; }
}
export function saveGameMode(storage,mode) {
  const value=mode==='live'?'live':'design';
  try { storage?.setItem(GAME_MODE_KEY,value); } catch { /* Optional storage. */ }
  return value;
}
export function movePlanets(planets,targets,stage,dt,maxSpeed=LIVE_GRAVITY.maxSpeed) {
  const result=planets.map(p=>({...p}));
  for(const p of [...result].sort((a,b)=>a.id.localeCompare(b.id))) {
    const target=targets[p.id]; if(!target)continue;
    const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);
    if(!Number.isFinite(d)||d===0)continue;
    const length=Math.min(d,Math.max(0,maxSpeed)*dt);
    const end={x:Math.max(p.radius,Math.min(stage.world.width-p.radius,p.x+dx/d*length)),y:Math.max(p.radius,Math.min(stage.world.height-p.radius,p.y+dy/d*length))};
    const obstacles=[...result.filter(q=>q.id!==p.id).map(q=>({...q,radius:q.radius+p.radius+8})),
      {...stage.launch.position,radius:p.radius+28}, {...stage.goal,radius:stage.goal.radius+p.radius+12}];
    let fraction=1;
    const range=stage.rules?.placement;
    if(range) {
      end.x=Math.max(range.left+p.radius,Math.min(range.right-p.radius,end.x));
      end.y=Math.max(range.top+p.radius,Math.min(range.bottom-p.radius,end.y));
    }
    for(const obstacle of obstacles) {
      // At a boundary, motion away from the protected circle is permitted.
      if((p.x-obstacle.x)*(end.x-p.x)+(p.y-obstacle.y)*(end.y-p.y)>=0 && Math.hypot(p.x-obstacle.x,p.y-obstacle.y)>=obstacle.radius-1e-7)continue;
      const hit=segmentCircleHit(p,end,obstacle);
      if(hit!==null)fraction=Math.min(fraction,Math.max(0,hit-1e-6));
    }
    p.x+=(end.x-p.x)*fraction;p.y+=(end.y-p.y)*fraction;
  }
  return result;
}
export function stepLiveFlight(state,targets,stage,gameMode,dt=DEFAULT_PHYSICS.fixedTimeStep,maxSpeed=LIVE_GRAVITY.maxSpeed) {
  if(gameMode!=='live'||state.status!=='flying')return stepSimulation(state,dt);
  const planets=movePlanets(state.planets,targets,stage,dt,maxSpeed);
  let next=stepSimulation({...state,planets},dt);
  const goalTime=segmentCircleHit(state.rocket.position,next.rocket.position,state.goal);
  let first=null;
  for(let i=0;i<planets.length;i++) {
    const old=state.planets[i],p=planets[i];
    const hit=segmentCircleHit({x:state.rocket.position.x-old.x,y:state.rocket.position.y-old.y},
      {x:next.rocket.position.x-p.x,y:next.rocket.position.y-p.y},{x:0,y:0,radius:p.radius+state.rocket.radius});
    if(hit!==null&&(!first||hit<first.t))first={t:hit,id:p.id};
  }
  if(first&&(goalTime===null||first.t<=goalTime))next={...next,status:'crashed',target:first.id};
  return next;
}
