import {runtime} from "../tests/helpers/runtime.mjs";

// Logic + death/effect update + Canvas calls (no actual rasterization); not display FPS.
const results=[];
for(const level of [1,2,3])for(const count of [50,100,200])for(const type of ["rocket","grenade"]){
  const r=runtime(null,{recordDraw:false,debug:true});r.click("test-lab");r.change("labDestruction",String(level));r.change("labCount",String(count));r.click("lab-spawn");r.click("lab-close");
  r.run(`assetsReady=true;const w=WEAPONS.find(w=>w.type==='${type}');
    function burst(){clearLabEnemies();game.enemyLimit=${count};for(let i=0;i<${count};i++)spawnEnemy('crawler',1220+(i%10)*3);game.grid.rebuild(game.enemies);explode({x:1234,y:138,type:w.type,radius:w.radius,damage:w.damage})}
    for(let i=0;i<120;i++){if(i%60===0)burst();update(1/60);draw()}
    const samples=new Float64Array(600);
    for(let i=0;i<samples.length;i++){const start=performance.now();if(i%60===0)burst();update(1/60);draw();samples[i]=performance.now()-start}
  `);
  const samples=r.json("Array.from(samples)").sort((a,b)=>a-b),round=n=>Math.round(n*1000)/1000;
  results.push({level,count,type,meanMs:round(samples.reduce((a,b)=>a+b,0)/samples.length),p95Ms:round(samples[Math.floor(samples.length*.95)]),maxMs:round(samples.at(-1)),kills:r.run("game.kills")});
}
console.log("Node CPU: repeated full-population explosions, 120 warm-up / 600 timed ticks, includes draw calls to no-op Canvas; excludes raster/audio, not display FPS.");
console.table(results);console.log(JSON.stringify(results));
