import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createFreeWorld,getHugeSample,WORLD_PRESETS} from '../js/worlds.js';
import {createSimulation,stepSimulation,simulateTrajectory} from '../js/physics.js';
import {createPreview,advancePreview} from '../js/preview.js';
import {createFlightRecorder,replayFrame} from '../js/flight-record.js';
import {configurePlanet,placementAllowed} from '../js/planets.js';
import {Camera} from '../js/camera.js';
import {CHALLENGES} from '../js/challenges.js';
const dt=1/120,report=new URL('../reports/expanded-space/',import.meta.url);mkdirSync(report,{recursive:true});
const metrics=[];
for(const id of ['voyage','swing','deep'])test(`HUGE ${id}：長距離到達・予測一致・記録終端・引力の寄与`,()=>{
 const s=getHugeSample(id),before=structuredClone(s);assert.ok(s.planets.every(p=>placementAllowed(p,s)));
 let state=createSimulation(s),distance=0,turn=0,maxX=0,minY=5000;const states=[state],rec=createFlightRecorder(s,state,{playType:'free',gameMode:'design',launchMode:'precision'},1);
 while(state.status==='flying'){
  const old=state;state=stepSimulation(state,dt);const a=old.rocket.position,b=state.rocket.position;
  distance+=Math.hypot(b.x-a.x,b.y-a.y);turn+=Math.abs(Math.atan2(Math.sin(Math.atan2(state.rocket.velocity.y,state.rocket.velocity.x)-Math.atan2(old.rocket.velocity.y,old.rocket.velocity.x)),Math.cos(Math.atan2(state.rocket.velocity.y,state.rocket.velocity.x)-Math.atan2(old.rocket.velocity.y,old.rocket.velocity.x))));
  maxX=Math.max(maxX,b.x);minY=Math.min(minY,b.y);states.push(state);rec.capture(state);
 }
 assert.equal(state.status,'cleared');assert.ok(state.elapsed>12);assert.ok(distance>3500);assert.ok(maxX>1500);assert.ok(turn>.08);
 const prediction=createPreview(s,states[0].rocket.velocity);while(!prediction.done)advancePreview(prediction,2000);
 assert.deepEqual(prediction.state,state);for(const p of prediction.points)assert.deepEqual({x:p.x,y:p.y},states[Math.round(p.time*120)].rocket.position);
 const record=rec.finish(state);assert.deepEqual(replayFrame(record,record.duration).rocket,state.rocket.position);assert.equal(record.frames[0][0],0);assert.equal(record.frames.at(-1)[0],state.elapsed);assert.ok(record.frames.length<=4096);assert.equal(record.version,1);assert.deepEqual(s,before);
 const noGravity=simulateTrajectory({...s,planets:[]});assert.notEqual(noGravity.state.status,'cleared');
 const row={id,name:s.name,world:s.world,start:s.launch.position,goal:s.goal,end:state.rocket.position,elapsed:state.elapsed,status:state.status,distance,maxX,minY,turnDegrees:turn*180/Math.PI,frames:record.frames.length,withoutPlanets:noGravity.state.status};metrics.push(row);
 writeFileSync(new URL(`${id}-flight.json`,report),JSON.stringify(record));writeFileSync(new URL('航行検証.json',report),JSON.stringify(metrics,null,2));
});
test('STANDARDは従来のデータ・12秒制限。拡張ワールドでは旧境界を越えて飛べる',()=>{
 assert.deepEqual(createFreeWorld().world,{width:375,height:500});
 for(const id of ['large','huge']){
  const s=createFreeWorld(id);s.launch.position={x:100,y:400};s.planets=[];s.goal={x:50,y:50,radius:1};
  let a=createSimulation(s,{velocity:{x:220,y:0}});for(let i=0;i<240;i++)a=stepSimulation(a,dt);assert.equal(a.status,'flying');assert.ok(a.rocket.position.x>375+36);
  a.rocket.position={x:s.world.width+35,y:400};for(let i=0;i<3;i++)a=stepSimulation(a,dt);assert.equal(a.status,'escaped');
 }
});
test('HUGE 0.1倍・全体表示・追従・逆変換は物理状態を変更しない',()=>{
 const s=getHugeSample('voyage'),a=createSimulation(s),snapshot=structuredClone(a),c=new Camera();c.resize(363,514);c.fit(s);assert.ok(Math.abs(c.zoom-.1)<1e-9);
 for(const p of [s.launch.position,s.goal,...s.planets]){const screen=c.toScreen(p);assert.ok(screen.x>=11&&screen.x<=352&&screen.y>=11&&screen.y<=503);const back=c.toWorld(screen);assert.ok(Math.hypot(back.x-p.x,back.y-p.y)<1e-8);}
 c.setMode('follow',s);c.follow({x:2000,y:3000});c.zoomAt(.5);assert.equal(c.mode,'follow');assert.ok(Math.hypot(c.center.x-2000,c.center.y-3000)<1e-9);assert.deepEqual(a,snapshot);
});
test('予測の時間上限と描画点間引きは独立。180秒飛行の記録も終端を維持',()=>{
 const s=createFreeWorld('huge');s.planets=[];s.goal={x:10,y:10,radius:1};const job=createPreview(s,{x:0,y:0});while(!job.done)advancePreview(job,2000);
 assert.equal(job.state.status,'flying');assert.equal(job.steps,14401);assert.ok(job.points.length<=3603);
 let a=createSimulation(s,{velocity:{x:0,y:0}});const rec=createFlightRecorder(s,a);while(a.status==='flying'){a=stepSimulation(a,dt);rec.capture(a);}const r=rec.finish(a);
 assert.equal(a.status,'timeout');assert.ok(a.elapsed>=180);assert.ok(r.frames.length<=4096);assert.equal(r.frames.at(-1)[0],r.duration);
});
for(const [type,reason]of [['earth',undefined],['blackhole','absorbed'],['star','overheated']])test(`広域の高速連続衝突：${type}`,()=>{
 const s=createFreeWorld('huge'),p=configurePlanet({id:'far',x:2000,y:2200},type,'medium');s.planets=[p];s.launch.position={x:1900,y:2200};
 const a=stepSimulation(createSimulation(s,{velocity:{x:30000,y:0}}),dt);assert.equal(a.status,'crashed');assert.equal(a.reason,reason);
});
test('共通物理変更の影響範囲：Stage01〜20全基準軌道を変更前エンジンと各ステップ比較',async()=>{
 const source=execFileSync('git',['show','HEAD:034_惑星重力ゲーム/js/physics.js'],{encoding:'utf8'});
 const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const s of CHALLENGES){let a=createSimulation(s,s.solution),b=old.createSimulation(s,s.solution);while(a.status==='flying'){a=stepSimulation(a,dt);b=old.stepSimulation(b,dt);assert.deepEqual(a,b,s.id);}assert.equal(a.status,'cleared',s.id);}
});
