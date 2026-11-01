import {runtime} from '../tests/helpers/runtime.mjs';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.argv[2]||'reference',rows=[];
for(const n of [30,50,100,200]){
 const r=runtime(null,{debug:true,recordDraw:false});r.click('test-lab');r.change('labCount',String(n));r.click('lab-spawn');r.run("assetsReady=true;game.effects.length=0;for(let i=0;i<80;i++)game.effects.push({kind:'hit',x:game.player.x+60+i%20*8,y:100,life:.1,max:.12,type:'bullet',category:'HIT',vx:1,vy:0,seed:i,color:'#fff'})");
 const before=r.json('({enemies:game.enemies.length,hp:game.player.hp})');for(let i=0;i<30;i++)r.run('draw()');const samples=[];for(let j=0;j<7;j++){const t=performance.now();r.run('for(let i=0;i<120;i++)draw()');samples.push((performance.now()-t)/120)}samples.sort((a,b)=>a-b);rows.push({enemies:n,effects:80,drawProxyMedianMs:samples[3],minMs:samples[0],maxMs:samples[6],stateUnchanged:JSON.stringify(before)===JSON.stringify(r.json('({enemies:game.enemies.length,hp:game.player.hp})'))});
}
mkdirSync('reports/final-polish',{recursive:true});const report={phase,at:new Date().toISOString(),environment:'Node VM / Canvas proxy, NO browser/GPU/FPS measurement',rows};writeFileSync('reports/final-polish/cpu-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
