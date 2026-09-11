'use strict';
const assert=require('node:assert/strict'),P=require('../physics.js'),dt=P.CONFIG.fixedStep;
function play(mode,kind){
 const s=P.create(mode);let presses=0,peak=0,last=-1;
 for(let i=0;i<15/dt;i++){
  if(kind==='hold')s.held=true;
  if(kind==='rapid')s.held=Math.floor(s.elapsed/.07)%2===0;
  if(kind==='timed'||kind==='early'){
   const g=P.geometry(s.pump,s.config),a=P.wrap(s.angle-Math.atan2(g.com.x,g.com.y)),toward=a*s.omega<0;
   if(!s.held&&toward&&Math.abs(a)<Math.max(.1,s.amplitude*(kind==='early'?.65:.4))&&s.elapsed-last>.25){s.held=true;presses++;peak=0;last=s.elapsed;}
   peak=Math.max(peak,Math.abs(s.omega));
   if(s.held&&!toward&&Math.abs(s.omega)<peak*.3&&s.elapsed-last>.25){s.held=false;last=s.elapsed;}
  }
  P.step(s,dt);if(s.giants)break;
 }
 return{...s,presses};
}
for(const mode of ['easy','normal']){
 for(const kind of ['idle','hold','rapid'])assert.equal(play(mode,kind).giants,0,mode+' '+kind);
 assert(play(mode,'timed').giants>0);
 const s=P.create(mode);P.release(s);s.x=443;s.y=160;s.angle=0;s.pump=0;s.vx=0;s.vy=200;s.omega=0;
 const r=P.evaluateLanding(s,{onMat:true,part:'foot'});assert.equal(r.score,Math.round(r.baseScore*(mode==='easy'?.7:1)));
}
const easy=play('easy','early'),normal=play('normal','early');assert(easy.giants>0&&easy.presses<normal.presses);
assert(P.settings('easy').matWidth>P.settings('normal').matWidth);
assert(P.settings('easy').perfectAngle>P.settings('normal').perfectAngle);
assert(P.settings('easy').gravity<P.settings('normal').gravity);
assert(P.settings('easy').airControl>P.settings('normal').airControl);
// A mat-edge landing is available only in EASY; geometry and rendering share this config.
function edge(mode){const s=P.create(mode);P.release(s);s.x=330;s.y=140;s.vx=0;s.vy=100;s.angle=0;s.omega=0;s.angularMomentum=0;for(let i=0;i<1000&&s.phase==='flight';i++)P.step(s,dt);return s;}
assert(edge('easy').impact.onMat);assert(!edge('normal').impact.onMat);
console.log('Difficulty: manual control, timing tolerance ('+easy.presses+' vs '+normal.presses+' early strokes), score multiplier and wider mat OK');
