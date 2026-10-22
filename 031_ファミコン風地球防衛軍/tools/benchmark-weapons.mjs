// Simulation CPU only. No browser, RAF, GPU or real FPS claim.
import {runtime} from "../tests/helpers/runtime.mjs";
import {WEAPONS} from "../js/data.js";
const results=[];
for(const w of WEAPONS.filter(w=>w.expanded)){
  const r=runtime(null,{debug:true,recordDraw:false});r.click("test-lab");r.change("labWeapon1",w.id);r.change("labCount","200");r.click("lab-spawn");r.click("lab-close");
  r.run(`game.lab.settings.sound=false;game.lab.settings.shake=false;game.areaTimer=0;input.fire=true;input.aimMode="mouse";
    const samples=[];let peakShots=0,peakJobs=0,peakBodies=0;
    for(let frame=0;frame<660;frame++){
      const start=performance.now();
      while(game.liveEnemies<200)spawnEnemy("crawler",1100+(game.nextEnemyId%12)*7);
      const aim=worldToScreen({x:1130,y:138},game.camera,view.zoom);input.aimX=aim.x;input.aimY=aim.y;
      if(frame%90===0)detonateMines(game,weaponAPI);
      update(1/60);peakShots=Math.max(peakShots,game.shots.length);peakJobs=Math.max(peakJobs,game.arsenal.jobs.length);peakBodies=Math.max(peakBodies,game.impact.corpses);
      if(frame>=60)samples.push(performance.now()-start);
    }
    samples.sort((a,b)=>a-b);`);
  results.push({id:w.id,...r.json("({meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),samples:samples.length,kills:game.kills,peakShots,peakJobs,peakBodies})")});
}
console.log(JSON.stringify({method:"Node VM simulation CPU; 200 live enemies replenished; 60 warmup + 600 fixed-60Hz samples; no rendering/GPU/RAF/FPS",results},null,2));
