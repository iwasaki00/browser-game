import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePlanet,placementAllowed,addPlanet} from '../js/planets.js';
import {getStage} from '../js/stages.js';
import {gravitationalAcceleration,createSimulation,stepSimulation,simulateTrajectory} from '../js/physics.js';
import {velocityFromAngleSpeed,slingshotLaunch} from '../js/launch.js';

test('地球型中は既存惑星と同じ軌道',()=>{
 const a=getStage(), b=getStage(); b.planets=b.planets.map(p=>configurePlanet(p));
 const first=simulateTrajectory(a), second=simulateTrajectory(b);
 assert.deepEqual(first.points,second.points);
 assert.deepEqual(first.state.rocket,second.state.rocket);
 assert.equal(first.state.status,second.state.status);
});
for(const count of [2,3]) test(`${count}惑星の重力合算と順序独立`,()=>{
 const planets=Array.from({length:count},(_,i)=>configurePlanet({id:String(i),x:100+i*70,y:150+i*20}));
 const point={x:30,y:40};
 const sum=planets.map(p=>gravitationalAcceleration(point,[p])).reduce((a,b)=>({x:a.x+b.x,y:a.y+b.y}),{x:0,y:0});
 assert.deepEqual(gravitationalAcceleration(point,planets),sum);
 assert.deepEqual(gravitationalAcceleration(point,[...planets].reverse()),sum);
});
test('種類とサイズに応じた重力・質量、上限',()=>{
 const p={id:'a',x:200,y:200};
 const masses=['asteroid','earth','gas'].map(type=>configurePlanet(p,type).mass);
 assert.ok(masses[0]<masses[1]&&masses[1]<masses[2]);
 const sizes=['small','medium','large'].map(size=>configurePlanet(p,'gas',size));
 assert.deepEqual(sizes.map(p=>p.mass),[5600,8000,10400]);
 assert.ok(sizes[0].radius<sizes[1].radius&&sizes[1].radius<sizes[2].radius);
 assert.ok(gravitationalAcceleration({x:0,y:0},[sizes[2]]).x>gravitationalAcceleration({x:0,y:0},[sizes[0]]).x);
});
test('追加上限、全惑星間の間隔、発射地点・ゴール・画面境界の制限',()=>{
 const s=getStage();assert.ok(addPlanet(s));assert.ok(addPlanet(s));assert.equal(addPlanet(s),null);
 for(const p of s.planets) assert.equal(placementAllowed(p,s),true);
 const p=s.planets[0];
 for(const point of [s.launch.position,s.goal,s.planets[1],{x:0,y:0}]) assert.equal(placementAllowed({...p,x:point.x,y:point.y},s),false);
});
test('2番目と3番目の惑星でも高速衝突を検出',()=>{
 for(const target of [1,2]){
  const s=getStage();s.planets=[0,1,2].map(i=>({id:String(i),x:100,y:i===target?250:100+i*30,radius:15,mass:0}));
  const state=createSimulation(s,{velocity:{x:1000,y:0}});state.rocket.position={x:0,y:250};
  const next=stepSimulation(state,.2);assert.equal(next.status,'crashed');assert.equal(next.target,String(target));
 }
});
test('複数惑星で両発射方式の共通ベクトルを維持',()=>{
 const s=getStage();addPlanet(s);addPlanet(s);
 const shot=slingshotLaunch({x:0,y:0},{x:-60,y:60});
 const precise=velocityFromAngleSpeed(shot.angleDeg,shot.speed);
 const a=simulateTrajectory(s,{velocity:shot.velocity});const b=simulateTrajectory(s,{velocity:precise});
 assert.equal(a.state.status,b.state.status);
 assert.ok(Math.hypot(a.state.rocket.position.x-b.state.rocket.position.x,a.state.rocket.position.y-b.state.rocket.position.y)<1e-8);
});
