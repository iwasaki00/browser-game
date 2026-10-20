import {runtime} from "../tests/helpers/runtime.mjs";
import {DENSITY_MODES} from "../js/data.js";

console.log("Node CPU benchmark: actual fixed-step game logic; Canvas is a no-op, audio off. Not display FPS.");
console.log("240 warm-up + 1200 measured ticks at dt=1/60. Live population is replenished to the selected cap.");
const results=[];
for(const mode of Object.keys(DENSITY_MODES))for(const scenario of ["steady-fire","explosion-burst"]){
  const r=runtime(null,{recordDraw:false});r.density(mode);
  r.run(`startMission();game.director.stopped=true;game.player.x=3200;game.player.invuln=999;input.aimMode="touch";input.touchDx=1;input.touchDy=0;input.fire=true;
    function refill(){while(game.liveEnemies<game.enemyLimit){const n=game.nextEnemyId;spawnEnemy(n%10<2?"needle":n%10===2?"spider":"crawler",game.player.x+120+(n%18)*13)}}
    refill();for(let i=0;i<240;i++){refill();update(1/60)}
    const samples=new Float64Array(1200);let killed=0;
    for(let i=0;i<samples.length;i++){
      const start=performance.now();refill();
      ${scenario==="explosion-burst"?'if(i%120===0){game.grid.rebuild(game.enemies);const e=game.enemies.find(e=>!e.dead);if(e)explode({x:e.x,y:e.y+e.h/2,radius:42,damage:45})}':""}
      update(1/60);samples[i]=performance.now()-start;
    }
  `);
  const samples=r.json("Array.from(samples)").sort((a,b)=>a-b),round=x=>Math.round(x*1000)/1000;
  results.push({mode,limit:DENSITY_MODES[mode].limit,scenario,meanMs:round(samples.reduce((a,b)=>a+b,0)/samples.length),
    p95Ms:round(samples[Math.floor(samples.length*.95)]),p99Ms:round(samples[Math.floor(samples.length*.99)]),maxMs:round(samples.at(-1)),kills:r.run("game.kills")});
}
console.table(results);
console.log(JSON.stringify(results));
