import {WORLD,clamp} from './data.js?v=0.2.2';

// Geometry and encounter data are separate from the mission-specific controllers below.
export const M02=Object.freeze({id:'M02',world:{...WORLD,width:5600},bossX:4780,bossSpawnX:5280,
  areas:[{x:0,name:'地下入口'},{x:900,name:'配管区画'},{x:2000,name:'増殖区画・上下分岐'},{x:3300,name:'地下深部'},{x:4500,name:'中央巣穴'}],
  platforms:[
    {x:0,y:-16,w:4500,h:24,solid:true,kind:'ceiling'},
    {x:4500,y:-24,w:1100,h:24,solid:true,kind:'cave'},
    {x:1080,y:28,w:500,h:16,solid:true,kind:'pipe'},
    {x:1220,y:124,w:72,h:24,solid:true,kind:'metal'},
    {x:1640,y:0,w:32,h:72,solid:true,kind:'wall'},
    {x:2000,y:120,w:64,h:8,solid:true,kind:'metal'},
    {x:2080,y:96,w:64,h:8,solid:true,kind:'metal'},
    {x:2160,y:72,w:1000,h:8,solid:true,kind:'metal'},
    {x:3200,y:104,w:64,h:8,solid:true,kind:'metal'},
    {x:3650,y:120,w:80,h:28,solid:true,kind:'metal'},
    {x:3910,y:0,w:32,h:76,solid:true,kind:'wall'}
  ],
  barriers:[{x:2520,y:116,w:24,h:32},{x:4140,y:116,w:24,h:32}],
  nests:[{x:1520,y:100},{x:2720,y:100},{x:3500,y:100},{x:4320,y:100}],
  encounters:[
    {id:'u1-warmup',x:220,until:860,pattern:'WAVE',enemy:'worm',count:10,batch:2,interval:.9},
    {id:'u1-spitter',x:600,until:1100,pattern:'WAVE',enemy:'spitter',count:4,batch:1,interval:1.6},
    {id:'u2-swarm',x:980,until:1900,pattern:'SWARM',enemy:'worm',fraction:.85,batch:5,interval:.20},
    {id:'u2-ceiling',x:1300,until:2000,pattern:'WAVE',enemy:'spitter',count:8,batch:2,interval:1.3},
    {id:'u3-lower',x:2060,until:3250,pattern:'SWARM',enemy:'worm',fraction:1.1,batch:7,interval:.14},
    {id:'u3-upper',x:2140,until:3240,pattern:'AIR_RAID',enemy:'needle',count:12,batch:3,interval:.7},
    {id:'u3-roof',x:2400,until:3250,pattern:'WAVE',enemy:'spitter',count:10,batch:2,interval:1.2},
    {id:'u4-wave',x:3360,until:4470,pattern:'WAVE',enemy:'worm',fraction:1.25,batch:5,interval:.18},
    {id:'u4-swarm',x:3750,until:4550,pattern:'SWARM',enemy:'worm',fraction:1.2,batch:8,interval:.12},
    {id:'u4-roof',x:3900,until:4550,pattern:'WAVE',enemy:'spitter',count:8,batch:2,interval:.8}
  ]
});
export const NEST=Object.freeze({hp:250,interval:4,minBatch:2,maxBatch:4,ownedLimit:12,activationDistance:600,enemy:'worm',score:1500});
export const ABYSS=Object.freeze({hp:2400,weakMultiplier:1.5,attackInterval:2.5,chargedInterval:1.8,summons:3,chargeSpeed:120,chargeDuration:1.1,weakCycle:4,weakOpen:2.6});
export const isBoss=e=>e.type==='boss'||e.type==='queen'||e.type==='leviathan'||e.type==='fortress'||e.type==='reactor'||e.type==='neuralheart'||e.type==='commandcore'||e.type==='overmind';
export function createM02Geometry(){return M02.platforms.map(p=>({...p}))}
export function ceilingAt(platforms,x){let bottom=8;for(const p of platforms)if(p.active!==false&&p.solid&&p.kind!=='metal'&&x>=p.x&&x<=p.x+p.w)bottom=Math.max(bottom,p.y+(p.h??8));return bottom}
export function floorAt(platforms,x,fromY=0){let floor=WORLD.ground;for(const p of platforms)if(p.active!==false&&x>=p.x&&x<=p.x+p.w&&p.y>=fromY-.01)floor=Math.min(floor,p.y);return floor}
export function validEnemyPosition(g,type,x,y=null){
  const ground=type==='worm'||type==='crawler'||type==='beetle'||type==='nest'||type==='barrier'||type==='queen';
  if(ground)return {x,y};
  const roof=ceilingAt(g.platforms,x),floor=floorAt(g.platforms,x,roof+1);
  return {x,y:type==='spitter'?roof:clamp(y??40,roof+2,Math.max(roof+2,floor-24))};
}
export function updateNests(g,dt,spawn){
  if(g.clear||g.player.dead||g.bossStarted)return;
  for(const n of g.enemies){
    if(n.type!=='nest'||n.dead||Math.abs(n.x-g.player.x)>NEST.activationDistance)continue;
    n.nestWait=(n.nestWait??NEST.interval)-dt;if(n.nestWait>0)continue;
    let owned=0;for(const e of g.enemies)if(!e.dead&&e.nestId===n.uid)owned++;
    const count=Math.min(NEST.minBatch+(n.spawnCycle??0)%3,NEST.ownedLimit-owned,g.enemyLimit-g.liveEnemies);
    if(count<=0){n.nestWait=.4;continue} // bounded retry, no deferred backlog
    for(let i=0;i<count;i++){
      const direction=n.x>=g.player.x?1:-1,x=n.x+direction*(40+i*30);
      if(Math.abs(x-g.player.x)<72)continue;
      const e=spawn(NEST.enemy,x);if(e)e.nestId=n.uid;
    }
    n.spawnCycle=(n.spawnCycle??0)+1;n.nestWait=NEST.interval;
  }
}
export function moveTunnelEnemy(g,e,dt){
  const previous=e.x;let x=clamp(e.x+e.vx*dt,e.w/2,g.world.width-e.w/2);
  for(const p of g.platforms){if(p.active===false||e.y+e.h<=p.y||e.y>=p.y+(p.h??8))continue;
    if(e.vx>0&&previous+e.w/2<=p.x&&x+e.w/2>p.x)x=Math.min(x,p.x-e.w/2);
    if(e.vx<0&&previous-e.w/2>=p.x+p.w&&x-e.w/2<p.x+p.w)x=Math.max(x,p.x+p.w+e.w/2);
  }
  e.x=x;e.vy=Math.min(WORLD.maxFall,(e.vy??0)+WORLD.gravity*dt);
  let y=Math.min(WORLD.ground-e.h,e.y+e.vy*dt);
  for(const p of g.platforms)if(p.active!==false&&e.x+e.w/2>p.x&&e.x-e.w/2<p.x+p.w&&e.y+e.h<=p.y&&y+e.h>=p.y){y=Math.min(y,p.y-e.h);e.vy=0}
  e.y=y;
}
export function weakCore(e){return {x:e.x+4,y:e.y+60,r:19,open:e.type==='queen'&&!e.dead&&(e.timer%ABYSS.weakCycle<ABYSS.weakOpen||e.phase==='charge')}}
export function queenDamage(e,damage,source){
  const core=weakCore(e),x=source.x??e.x,y=source.y??-1000;
  let hit=Math.hypot(x-core.x,y-core.y)<=core.r+(source.radial?source.radius??0:0);
  // A projectile hits the shell's front first. Evaluate its incoming ray against
  // the exposed abdominal core, rather than demanding penetration of the body.
  if(!source.radial&&Number.isFinite(source.vx+source.vy)){
    const ox=source.originX??source.oldX??x,oy=source.originY??source.oldY??y,dx=core.x-ox,dy=core.y-oy,speed=Math.hypot(source.vx,source.vy);
    if(speed>0)hit=dx*source.vx+dy*source.vy>=0&&Math.abs(dx*source.vy-dy*source.vx)/speed<=core.r;
  }
  return core.open&&hit?damage*ABYSS.weakMultiplier:damage;
}
export function updateQueen(g,e,dt,fire,spawn,effect){
  e.timer+=dt;e.actionWait=(e.actionWait??1.5)-dt;
  const enraged=e.hp<=ABYSS.hp/2;
  if(e.phase==='charge'){
    e.chargeTime-=dt;e.x=clamp(e.x+e.vx*dt,M02.bossX+100,5500);
    if(e.chargeTime<=0||e.x===M02.bossX+100||e.x===5500){e.phase='move';e.vx=0}
  }
  if(e.actionWait>0)return;
  e.actionWait=enraged?ABYSS.chargedInterval:ABYSS.attackInterval;
  const action=(e.actionIndex??0)%(enraged?4:3);e.actionIndex=(e.actionIndex??0)+1;e.attackFlash=.25;
  if(action===0){for(let i=0;i<(enraged?7:5);i++)fire(e,100,(i-(enraged?3:2))*.20)}
  else if(action===1){for(let i=0;i<ABYSS.summons;i++){const x=clamp(e.x-100-i*35,M02.bossX+20,5500);if(Math.abs(x-g.player.x)>72)spawn('worm',x)}}
  else if(action===2){for(const direction of [-1,1])g.enemyShots.push({kind:'wave',x:e.x,y:WORLD.ground-6,vx:direction*(enraged?125:90),vy:0,w:22,h:12,life:5,damage:15});effect({kind:'explosion',x:e.x,y:WORLD.ground-4,r:22,life:.3,max:.3})}
  else{e.phase='charge';e.vx=Math.sign(g.player.x-e.x)*ABYSS.chargeSpeed;e.chargeTime=ABYSS.chargeDuration}
}
