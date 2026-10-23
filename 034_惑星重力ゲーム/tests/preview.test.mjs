import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreview,advancePreview,PreviewController,loadPreviewEnabled,savePreviewEnabled} from '../js/preview.js';
import {createSimulation,stepSimulation,DEFAULT_PHYSICS} from '../js/physics.js';
import {getStage} from '../js/stages.js';
import {addPlanet} from '../js/planets.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';

function finish(job) { while(!job.done) advancePreview(job); return job; }
for(const count of [1,2,3]) for(const method of ['precision','slingshot']) {
 test(`${count}惑星・${method}の全ステップが実飛行と一致、入力は不変`,()=>{
  const stage=getStage(); while(stage.planets.length<count)addPlanet(stage);
  const velocity=method==='precision'?velocityFromAngleSpeed(-55,170):slingshotLaunch(stage.launch.position,{x:0,y:490}).velocity;
  const before=structuredClone(stage), vectorBefore={...velocity};
  const flight=createSimulation(stage,{velocity}), flightBefore=structuredClone(flight);
  const job=finish(createPreview(stage,velocity));
  let actual=flight;
  for(const point of job.points.slice(1)) {
   actual=stepSimulation(actual,DEFAULT_PHYSICS.fixedTimeStep);
   assert.deepEqual(point,{...actual.rocket.position,time:actual.elapsed});
  }
  assert.deepEqual(job.state,actual);
  assert.deepEqual(stage,before);assert.deepEqual(velocity,vectorBefore);assert.deepEqual(flight,flightBefore);
 });
}
for(const status of ['cleared','crashed','escaped','timeout']) test(`${status}の予測終端`,()=>{
 const s=getStage();s.launch.position={x:40,y:250};s.planets=[];s.goal={id:'goal',x:150,y:250,radius:10};
 if(status==='crashed')s.planets=[{id:'p',x:100,y:250,radius:15,mass:0}];
 if(status==='escaped'||status==='timeout')s.goal.y=50;
 const job=finish(createPreview(s,{x:status==='timeout'?0:200,y:0}));
 assert.equal(job.state.status,status);assert.ok(job.steps<=1441);
});
test('上限、分割実行、スナップショット独立性',()=>{
 const s=getStage(),job=createPreview(s,{x:0,y:0},5);
 const original=job.state.planets[0].x;s.planets[0].x=0;
 advancePreview(job,2);assert.equal(job.steps,2);assert.equal(job.done,false);
 finish(job);assert.equal(job.steps,5);assert.equal(job.state.planets[0].x,original);
});
test('ON/OFF保存、OFFは計算停止、条件変更時は古い結果を破棄、RESET後復元',()=>{
 const values=new Map(), storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(loadPreviewEnabled(storage),true);
 savePreviewEnabled(storage,false);assert.equal(loadPreviewEnabled(storage),false);
 const c=new PreviewController(),s=getStage(),v=velocityFromAngleSpeed(-55,170);
 const first=c.update(s,v);c.enabled=false;assert.equal(c.update(s,v),null);assert.equal(c.job,null);
 c.enabled=true;const second=c.update(s,v);assert.notEqual(first,second);
 s.planets[0].x+=10;assert.notEqual(c.update(s,v),second);
 c.clear();const reset=c.update(getStage(),v);finish(reset);
 assert.deepEqual(reset.points,finish(createPreview(getStage(),v)).points);
 assert.equal(c.update(s,v,false),null);
});
