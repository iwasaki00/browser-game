'use strict';
const assert=require('node:assert/strict'),P=require('../physics.js'),C=P.CONFIG,dt=C.fixedStep;
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,a+' != '+b);
function advance(s,t){for(let i=0;i<t/dt;i++)P.step(s,dt);}
function controller(){
 let presses=0,peak=0,last=-1;
 return{run(s){
  const g=P.geometry(s.pump),a=P.wrap(s.angle-Math.atan2(g.com.x,g.com.y)),toward=a*s.omega<0;
  if(!s.held&&toward&&Math.abs(a)<Math.max(.1,s.amplitude*.4)&&s.elapsed-last>.25){s.held=true;presses++;peak=0;last=s.elapsed;}
  peak=Math.max(peak,Math.abs(s.omega));
  if(s.held&&!toward&&Math.abs(s.omega)<peak*.3&&s.elapsed-last>.25){s.held=false;last=s.elapsed;}
 },get presses(){return presses;}};
}
// Link lengths must stay invariant in every pose, orientation, and game phase.
for(const phase of ['swing','flight','result'])for(let q=0;q<=1;q+=.05)for(let angle=-Math.PI;angle<=Math.PI;angle+=.2){
 const s=P.create();s.phase=phase;s.pump=q;s.angle=angle;const p=P.pose(s);
 near(Math.hypot(p.hand.x-p.shoulder.x,p.hand.y-p.shoulder.y),C.armLength);
 near(Math.hypot(p.foot.x-p.hip.x,p.foot.y-p.hip.y),C.legLength);
 if(phase==='swing'){near(p.hand.x,C.barX);near(p.hand.y,C.barHeight);}
}
const regular=P.geometry(0),forward=P.geometry(1);
near(regular.legAngle,C.legReturnAngle);near(forward.legAngle,C.legForwardAngle);
assert(forward.foot.x-forward.hip.x>30,'Leg visibly extends forward');
assert(forward.com.x>regular.com.x);assert(P.metrics(1).inertia<P.metrics(0).inertia);
assert(C.legForwardAngle>=-70*Math.PI/180&&C.legForwardAngle<=-30*Math.PI/180);
for(const held of [false,true]){
 const s=P.create();s.held=held;advance(s,30);assert.equal(s.giants,0,'No giants from idle/constant hold');
 assert(s.amplitude<.6,'A held pose must settle rather than accelerate itself');
}
for(const mode of ['wrong','rapid']){
 const s=P.create();for(let i=0;i<15/dt;i++){s.held=mode==='wrong'?s.omega>0:Math.floor(s.elapsed/.07)%2===0;P.step(s,dt);}
 assert.equal(s.giants,0,'Mistimed pumping must not automatically yield giants');
}
const s=P.create(),control=controller(),history=[];
while(!s.giants&&s.elapsed<15){
 const n=control.presses;control.run(s);P.step(s,dt);if(control.presses!==n)history.push(s.amplitude);
}
assert(s.giants>0);assert(control.presses>=2&&control.presses<=6);
console.log('Timed leg pumping: '+control.presses+' strokes, '+s.elapsed.toFixed(2)+'s to giant.');
// Pose response is smooth, and release retains COM velocity, angle and angular velocity exactly.
const launch=P.create();launch.held=true;advance(launch,.08);assert(launch.pump>0&&launch.pump<1);
const before={vx:launch.vx,vy:launch.vy,omega:launch.omega,angle:launch.angle},beforePose=P.pose(launch);
assert(P.release(launch));for(const key of Object.keys(before))near(launch[key],before[key]);
const afterPose=P.pose(launch);for(const key of ['hand','shoulder','hip','foot']){near(beforePose[key].x,afterPose[key].x);near(beforePose[key].y,afterPose[key].y);}
assert(!P.release(launch));
// Airborne posture changes conserve total angular momentum, apart from drag.
launch.y=-2000;const momentum=launch.angularMomentum;advance(launch,.4);
near(launch.angularMomentum,momentum*Math.exp(-C.airDrag*Math.round(.4/dt)*dt),1e-5);
launch.held=false;advance(launch,.8);assert(launch.pump<.001);
// With a settled pose, integration must equal gravity torque + damping, not a button-dependent speed bonus.
for(const held of [false,true]){
 const v=P.create();v.pump=held?1:0;v.held=held;v.angle=.4;v.omega=.5;
 const g=P.metrics(v.pump),x=g.com.x*Math.cos(v.angle)-g.com.y*Math.sin(v.angle);
 const expected=(g.inertia*v.omega+C.gravity*g.mass*x*dt)*Math.exp(-C.swingDamping*dt)/g.inertia;
 P.step(v,dt);near(v.omega,expected);
}
// Real release/stroke combinations must still support all landing grades and aerial rotations.
const base=P.create(),pump=controller(),grades=new Set(),flips=new Set();let perfect;
for(let i=0;i<1900;i++){
 pump.run(base);P.step(base,dt);if(i<100||i%8)continue;
 for(const returnTime of [0,.12,.24,.4])for(let duration=0;duration<=1.8;duration+=.08){
  const v=structuredClone(base);if(returnTime){v.held=false;advance(v,returnTime);}P.release(v);
  while(v.phase==='flight'){v.held=v.flightTime<duration;P.step(v,dt);}
  grades.add(v.result.grade);flips.add(v.result.flips);
  if(v.result.grade==='PERFECT'&&!perfect)perfect={release:base.elapsed,hold:duration,flips:v.result.flips};
 }
}
for(const grade of ['PERFECT','GOOD','STEP','CRASH'])assert(grades.has(grade),'Reachable '+grade);
for(const count of [0,1,2,3])assert(flips.has(count),'Reachable '+count+' flips');
console.log('Playable landings: '+[...grades]+'. Air rotations: '+[...flips].sort((a,b)=>a-b));
console.log('Perfect example:',perfect);
const a=P.create(),b=P.create();advance(a,3);advance(b,3);assert.deepEqual(a,b);
console.log('Fixed arms, leg geometry, momentum, pumping, landing, and restart tests passed.');
