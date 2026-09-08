'use strict';
const assert = require('node:assert/strict');
const P = require('../physics.js'), C = P.CONFIG, dt = C.fixedStep;
function advance(s, seconds) { for(let i=0;i<Math.round(seconds/dt);i++) P.step(s,dt); }
function controller() {
  let peak = 0, presses = 0;
  return { run(s) {
    const a=P.wrap(s.angle), toward=a*s.omega<0;
    if(!s.held&&toward&&Math.abs(a)<Math.max(.06,Math.min(.5,s.amplitude*.3))){s.held=true;presses++;peak=0;}
    peak=Math.max(peak,Math.abs(s.omega));
    if(s.held&&!toward&&Math.abs(s.omega)<peak*.25)s.held=false;
  }, get presses(){return presses;} };
}
// No input, a constant hold, and mistimed pumping must not produce automatic giants.
for(const mode of ['idle','hold','wrong']){
  const s=P.create();
  for(let i=0;i<30/dt;i++){s.held=mode==='hold'||(mode==='wrong'&&P.wrap(s.angle)*s.omega<0);P.step(s,dt);}
  assert.equal(s.giants,0,mode);
}
const swing=P.create(), control=controller();
while(swing.giants===0&&swing.elapsed<15){control.run(swing);P.step(swing,dt);}
assert(swing.giants>0,'Timed retraction must yield a giant');
assert(control.presses>=2&&control.presses<=5,`Expected 2–5 presses, got ${control.presses}`);
console.log(`Timed pumping: giant after ${control.presses} presses, ${swing.elapsed.toFixed(2)}s`);
// Instantaneous release preserves angular and linear velocities, including radial motion.
const launch=P.create();launch.held=true;advance(launch,.07);
const before={vx:launch.vx,vy:launch.vy,omega:launch.omega,angle:launch.angle};
assert(P.release(launch));for(const key of Object.keys(before))assert.equal(launch[key],before[key]);assert(!P.release(launch));
// Free flight conserves spin momentum (apart from the configured drag).
const airborne=P.create();P.release(airborne);airborne.y=-1000;airborne.omega=2;airborne.angularMomentum=2*P.airInertia(0);airborne.held=true;
advance(airborne,.14);assert(airborne.omega>7);airborne.held=false;advance(airborne,.14);assert(airborne.omega<2.01);
// Every landing grade can be distinguished by actual contacts.
for(const [grade,angle,x,vx] of [['PERFECT',0,675,0],['GOOD',.35,620,0],['STEP',.8,560,180],['CRASH',Math.PI,675,0]]){
  const s=P.create();P.release(s);s.x=x;s.y=240;s.angle=angle;s.vx=vx;s.vy=100;s.omega=0;s.angularMomentum=0;
  advance(s,2);assert.equal(s.result?.grade,grade);assert(Number.isFinite(s.score));
}
// Real play trajectories: sweep release times and a single air-tuck duration.
const base=P.create(), pump=controller(), grades=new Set(), flips=new Set();let example=null;
for(let i=0;i<1800;i++){
  pump.run(base);P.step(base,dt);
  if(i%6!==0||i<140)continue;
  for(let tuckTime=0;tuckTime<=1.8;tuckTime+=.06){
    const s=structuredClone(base);P.release(s);
    while(s.phase==='flight'){s.held=s.flightTime<tuckTime;P.step(s,dt);}
    grades.add(s.result.grade);flips.add(s.result.flips);
    if(s.result.grade==='PERFECT'&&!example)example={releaseAt:base.elapsed,tuckTime,flips:s.result.flips};
  }
}
assert(grades.has('PERFECT')&&grades.has('GOOD')&&grades.has('STEP')&&grades.has('CRASH'),`Reachable grades: ${[...grades]}`);
for(const n of [0,1,2,3])assert(flips.has(n),`Must be able to perform ${n} air rotations`);
console.log('Reachable play grades:',[...grades].join(', '),'Air rotations:',[...flips].sort((a,b)=>a-b).join(', '));
console.log('Perfect example:',example);
// Determinism and restart isolation.
const fresh=P.create();assert.equal(fresh.held,false);assert.equal(fresh.giants,0);assert.equal(fresh.result,null);
const a=P.create(), b=P.create();advance(a,3);advance(b,3);assert.deepEqual(a,b);
console.log('All physics tests passed.');
