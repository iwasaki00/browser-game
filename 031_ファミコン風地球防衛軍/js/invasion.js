import {WORLD,ENEMY_TYPES,DENSITY_MODES,INVASION,SPAWN_PATTERNS,M01_ENCOUNTERS,clamp} from "./data.js";

export const isMob = e => !["boss","beetle","queen","leviathan","nest","barrier"].includes(e.type);
export const variation = uid => ((uid*2654435761)>>>0)/4294967296;

export class SpatialGrid {
  constructor(size=INVASION.gridSize,world=WORLD){
    this.size=size;this.cols=Math.ceil(world.width/size)+2;this.rows=12;this.top=-256;
    this.buckets=Array.from({length:this.cols*this.rows},()=>[]);this.used=[];
  }
  rebuild(enemies){
    for(let i=0;i<this.used.length;i++)this.buckets[this.used[i]].length=0;this.used.length=0;
    for(let i=0;i<enemies.length;i++){
      const e=enemies[i];if(e.dead)continue;
      const x=clamp(Math.floor(e.x/this.size),0,this.cols-1),y=clamp(Math.floor((e.y+e.h/2-this.top)/this.size),0,this.rows-1),index=y*this.cols+x;
      const bucket=this.buckets[index];if(!bucket.length)this.used.push(index);bucket.push(e);
    }
  }
  query(left,top,right,bottom,out){
    out.length=0;
    const x1=clamp(Math.floor(left/this.size),0,this.cols-1),x2=clamp(Math.floor(right/this.size),0,this.cols-1);
    const y1=clamp(Math.floor((top-this.top)/this.size),0,this.rows-1),y2=clamp(Math.floor((bottom-this.top)/this.size),0,this.rows-1);
    for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++){
      const bucket=this.buckets[y*this.cols+x];for(let i=0;i<bucket.length;i++)out.push(bucket[i]);
    }
    return out;
  }
}

export class SpawnDirector {
  constructor(mode="STANDARD",definitions=M01_ENCOUNTERS){
    this.mode=Object.hasOwn(DENSITY_MODES,mode)?mode:"STANDARD";this.config=DENSITY_MODES[this.mode];
    this.progress=0;this.midbossSpawned=false;this.stopped=false;this.spawned=0;
    this.entries=definitions.map(d=>({definition:d,spawned:0,wait:0,active:false,done:false,
      total:d.fraction?Math.ceil(this.config.limit*d.fraction):Math.max(1,Math.ceil(d.count*(d.unscaled?1:this.config.scale)))}));
  }
  update(dt,game,spawn,bounds){
    if(this.stopped||game.bossStarted||game.clear||game.player.dead)return;
    this.progress=Math.max(this.progress,game.player.x);
    for(const entry of this.entries){
      const d=entry.definition;if(entry.done||this.progress<d.x)continue;
      if(d.until&&this.progress>d.until){entry.done=true;continue}
      if(d.afterMidboss&&(!this.midbossSpawned||game.midbossAlive))continue;
      if(d.midbossOnly&&!game.midbossAlive)continue;
      entry.active=true;entry.wait-=dt;if(entry.wait>0)continue;
      const pattern=SPAWN_PATTERNS[d.pattern];
      const reserve=this.midbossSpawned?0:1;
      const cap=d.enemy==="beetle"?this.config.limit:game.midbossAlive?INVASION.midbossEscorts[this.mode]+1:this.config.limit-reserve;
      if(game.liveEnemies>=cap)continue;
      if(d.pattern==="REINFORCEMENT"&&game.liveMobs>this.config.limit*(d.below??pattern.below))continue;
      const batch=Math.min(d.batch??pattern.batch,entry.total-entry.spawned,cap-game.liveEnemies);
      for(let i=0;i<batch;i++){
        const position=this.position(d,entry.spawned,game,bounds);
        if(!position)break;
        const enemy=spawn(d.enemy??pattern.enemy,position.x,position.y);
        if(!enemy)break;
        if(d.formation){enemy.formationId=`${d.id}-${Math.floor(entry.spawned/6)}`;enemy.formationOrder=entry.spawned%6;enemy.formationPattern=d.formation}
        if(d.sea)enemy.landingLeft=.65;
        entry.spawned++;this.spawned++;if(d.enemy==="beetle")this.midbossSpawned=true;
      }
      entry.wait=d.interval??pattern.interval;
      if(entry.spawned>=entry.total)entry.done=true;
    }
  }
  position(d,ordinal,game,bounds){
    if(d.fixedX!==undefined)return {x:d.fixedX,y:null};
    const p=game.player,pattern=SPAWN_PATTERNS[d.pattern];
    let direction=game.battleCamera?.direction||Math.sign(p.vx)||1;
    if(pattern.sides==="both"&&ordinal%2)direction*=-1;
    const column=ordinal%INVASION.columns,row=Math.floor(ordinal/INVASION.columns);
    const edge=(direction>0?bounds.right:bounds.left)+(d.sea?(direction>0?-64:64):0);
    const offset=INVASION.outsideMargin+column*INVASION.columnSpacing+row*9;
    const desired=direction>0?Math.max(edge+offset,p.x+INVASION.minSpawnDistance+offset):Math.min(edge-offset,p.x-INVASION.minSpawnDistance-offset);
    const x=clamp(desired,24,(game.world??WORLD).width-24);
    if(Math.abs(x-p.x)<INVASION.minSpawnDistance)return null;
    const type=d.enemy??pattern.enemy;
    const y=type==="skyray"?36+(ordinal%3)*12:type==="needle"?35+(ordinal%5)*14+variation(ordinal+7)*6:type==="spider"?28+(ordinal%3)*6:null;
    return {x,y};
  }
}

export class AttackDirector {
  constructor(){this.nextShot=0;this.windowStart=0;this.starts=0;this.nextDive=0;this.activeDives=0;this.projectiles=0}
  begin(time,enemies,shots){
    if(time-this.windowStart>=INVASION.normalAttackWindow){this.windowStart=time;this.starts=0}
    this.activeDives=0;this.projectiles=0;
    for(let i=0;i<enemies.length;i++)if(!enemies[i].dead&&enemies[i].diveTimer>0)this.activeDives++;
    for(let i=0;i<shots.length;i++)if(shots[i].normal&&!shots[i].dead)this.projectiles++;
  }
  ranged(time){
    if(time<this.nextShot||this.starts>=INVASION.normalStartsPerWindow||this.projectiles>=INVASION.maxNormalProjectiles)return false;
    this.nextShot=time+INVASION.normalShotGap;this.starts++;this.projectiles++;return true;
  }
  dive(time){
    if(time<this.nextDive||this.activeDives>=INVASION.simultaneousDives)return false;
    this.nextDive=time+INVASION.diveGap;this.activeDives++;return true;
  }
}

export function prepareSeparation(enemies,grid,scratch){
  const radius=INVASION.separationRadius;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];e.separateX=0;e.separateY=0;if(e.dead||!isMob(e))continue;
    const cy=e.y+e.h/2;grid.query(e.x-radius,cy-radius,e.x+radius,cy+radius,scratch);
    let fx=0,fy=0;
    for(let j=0;j<scratch.length;j++){
      const other=scratch[j];if(other===e||other.dead||other.type!==e.type)continue;
      const dx=e.x-other.x,dy=cy-(other.y+other.h/2);
      if(Math.abs(dx)>=radius||Math.abs(dy)>=e.h)continue;
      const strength=(1-Math.abs(dx)/radius)*(1-Math.abs(dy)/e.h);
      fx+=(dx===0?(e.uid>other.uid?1:-1):Math.sign(dx))*strength;
      if(e.type==="needle")fy+=(dy===0?(e.uid%2?1:-1):Math.sign(dy))*strength;
    }
    e.separateX=clamp(fx,-1,1)*INVASION.separationSpeed;
    e.separateY=clamp(fy,-1,1)*INVASION.separationVerticalSpeed;
  }
}

export function nearestEnemy(enemies,x,y,maxDistance=Infinity,exclude=null,horizontal=false){
  let nearest=null,best=maxDistance;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];if(e.dead||(exclude&&exclude.has(e)))continue;
    const d=horizontal?Math.abs(e.x-x):Math.hypot(e.x-x,e.y-y);
    if(d<best){best=d;nearest=e}
  }
  return nearest;
}
