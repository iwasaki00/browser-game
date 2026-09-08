(function(root){
'use strict';
const CONFIG=Object.freeze({
 gravity:560,barX:220,barHeight:122,groundY:242,
 armLength:30,bodyLength:31,legLength:40,headRadius:14,torsoRadius:14,footRadius:6,
 legForwardAngle:-65*Math.PI/180,legReturnAngle:0,
 pumpStrength:3.5,pumpResponseSpeed:6,shoulderForwardAngle:-0.16,hipForwardAngle:-0.12,
 armMass:0.18,bodyMass:0.8,legMass:0.8,segmentInertia:90,
 swingDamping:0.055,initialAngle:-0.18,initialOmega:0.22,maxOmega:10,
 airDrag:0.015,matX:348,matWidth:190,matThickness:12,
 perfectAngle:0.23,goodAngle:0.55,stepAngle:1.05,
 perfectSpeed:600,goodSpeed:900,perfectSpin:4,goodSpin:7,perfectCenter:48,
 baseScore:1000,flipScore:250,heightScore:80,distanceScore:30,centerScore:300,postureScore:250,pixelsPerMeter:75,
 multipliers:{PERFECT:1.8,GOOD:1.2,STEP:0.7,CRASH:0.15},
 fixedStep:1/240,maxFrame:0.05,maxFlightTime:15,
 viewWidth:420,viewHeight:270,viewInitialHeight:178,viewBottomMargin:22,viewCenterOffset:40,viewMinHeight:166,viewMargin:12,cameraResponse:5
});
const TAU=2*Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const along=(a,l)=>({x:-Math.sin(a)*l,y:Math.cos(a)*l});
function geometry(pump){
 const shoulderAngle=CONFIG.shoulderForwardAngle*pump,bodyAngle=CONFIG.hipForwardAngle*pump;
 const legAngle=CONFIG.legReturnAngle+(CONFIG.legForwardAngle-CONFIG.legReturnAngle)*pump;
 const hand={x:0,y:0},shoulder=along(shoulderAngle,CONFIG.armLength);
 const hip=add(shoulder,along(bodyAngle,CONFIG.bodyLength)),foot=add(hip,along(bodyAngle+legAngle,CONFIG.legLength));
 const torso=add(shoulder,along(bodyAngle,CONFIG.bodyLength*.47));
 const head=add(shoulder,rotate({x:2,y:-20},bodyAngle));
 const masses=[
  {m:CONFIG.armMass,p:along(shoulderAngle,CONFIG.armLength*.5)},
  {m:CONFIG.bodyMass,p:torso},
  {m:CONFIG.legMass*CONFIG.pumpStrength,p:add(hip,along(bodyAngle+legAngle,CONFIG.legLength*.55))}
 ];
 const mass=masses.reduce((n,b)=>n+b.m,0);
 const com={x:masses.reduce((n,b)=>n+b.m*b.p.x,0)/mass,y:masses.reduce((n,b)=>n+b.m*b.p.y,0)/mass};
 const inertia=masses.reduce((n,b)=>n+b.m*(b.p.x*b.p.x+b.p.y*b.p.y),CONFIG.segmentInertia);
 const airInertia=inertia-mass*(com.x*com.x+com.y*com.y);
 return{hand,shoulder,hip,foot,torso,head,shoulderAngle,bodyAngle,legAngle,masses,mass,com,inertia,airInertia};
}
function metrics(pump){
 const g=geometry(pump),epsilon=1e-4,a=geometry(pump-epsilon),b=geometry(pump+epsilon);
 let coupling=0,airCoupling=0;
 g.masses.forEach((body,i)=>{
  const v={x:(b.masses[i].p.x-a.masses[i].p.x)/(2*epsilon),y:(b.masses[i].p.y-a.masses[i].p.y)/(2*epsilon)};
  coupling+=body.m*(body.p.x*v.y-body.p.y*v.x);
  const p={x:body.p.x-g.com.x,y:body.p.y-g.com.y};
  const cv={x:v.x-(b.com.x-a.com.x)/(2*epsilon),y:v.y-(b.com.y-a.com.y)/(2*epsilon)};
  airCoupling+=body.m*(p.x*cv.y-p.y*cv.x);
 });
  // Exaggerate the leg-pose inertia change for a lightweight toy; geometry and arm length stay unchanged.
 // The same factor applies to the moving-shape coupling, preserving momentum rather than adding speed.
 const poseFactor=1/(1+CONFIG.pumpStrength*(1-Math.cos(g.legAngle-CONFIG.legReturnAngle)));
 return{...g,inertia:g.inertia*poseFactor,airInertia:g.airInertia*poseFactor,coupling:coupling*poseFactor,airCoupling:airCoupling*poseFactor};
}
function point(s,x,y){return add({x:s.x,y:s.y},rotate({x,y},s.angle));}
function pose(s){
 const g=geometry(s.pump),origin=s.phase==='swing'?{x:CONFIG.barX,y:CONFIG.barHeight}:add({x:s.x,y:s.y},rotate({x:-g.com.x,y:-g.com.y},s.angle));
 const p={};
 for(const key of ['hand','shoulder','hip','foot','torso','head'])p[key]=add(origin,rotate(g[key],s.angle));
 return{...p,legAngle:g.legAngle,bodyAngle:g.bodyAngle,shoulderAngle:g.shoulderAngle,com:{x:s.x,y:s.y}};
}
function attachedPosition(s,g=metrics(s.pump)){
 const c=rotate(g.com,s.angle);
 s.x=CONFIG.barX+c.x;s.y=CONFIG.barHeight+c.y;
 const e=1e-4,a=geometry(s.pump-e).com,b=geometry(s.pump+e).com;
 const internal=rotate({x:(b.x-a.x)/(2*e)*s.pumpVelocity,y:(b.y-a.y)/(2*e)*s.pumpVelocity},s.angle);
 s.vx=-c.y*s.omega+internal.x;s.vy=c.x*s.omega+internal.y;
}
function create(){
 const s={phase:'swing',angle:CONFIG.initialAngle,omega:CONFIG.initialOmega,pump:0,pumpVelocity:0,previousPumpVelocity:0,held:false,
 x:0,y:0,vx:0,vy:0,angularMomentum:0,maxHeight:0,airRotation:0,giants:0,swingTravel:0,turnDirection:0,
 amplitude:Math.abs(CONFIG.initialAngle),peakAmplitude:Math.abs(CONFIG.initialAngle),flightTime:0,score:0,result:null,startX:0,elapsed:0,impact:null};
 attachedPosition(s);return s;
}
function release(s){
 if(s.phase!=='swing')return false;
 attachedPosition(s);
 const g=metrics(s.pump);s.angularMomentum=g.airInertia*s.omega+g.airCoupling*s.pumpVelocity;
 s.phase='flight';s.startX=s.x;s.flightTime=0;return true;
}
function evaluateLanding(s,collision){
 const p=pose(s),tilt=Math.abs(wrap(s.angle+p.bodyAngle)),onMat=collision.onMat,feetFirst=collision.part==='foot';
 const centerDistance=Math.abs(p.foot.x-(CONFIG.matX+CONFIG.matWidth/2)),speed=Math.hypot(s.vx,s.vy),spin=Math.abs(s.omega);
 let grade='CRASH';
 if(onMat&&feetFirst&&tilt<CONFIG.stepAngle&&s.pump<.5){
  grade='STEP';
  if(tilt<CONFIG.goodAngle&&speed<CONFIG.goodSpeed&&spin<CONFIG.goodSpin)grade='GOOD';
  if(tilt<CONFIG.perfectAngle&&speed<CONFIG.perfectSpeed&&spin<CONFIG.perfectSpin&&centerDistance<CONFIG.perfectCenter)grade='PERFECT';
 }
 const flips=Math.floor((s.airRotation+1e-8)/TAU),distance=Math.abs(s.x-s.startX)/CONFIG.pixelsPerMeter;
 const raw=CONFIG.baseScore+CONFIG.flipScore*flips*(flips+1)+s.maxHeight*CONFIG.heightScore+distance*CONFIG.distanceScore
 +(onMat?Math.max(0,1-centerDistance/(CONFIG.matWidth/2))*CONFIG.centerScore:0)+Math.max(0,1-tilt/Math.PI)*CONFIG.postureScore;
 return{grade,flips,distance,centerDistance,tilt,speed,spin,score:Math.round(raw*CONFIG.multipliers[grade]),
 reason:!onMat?'マットの外！離すタイミングを変えてみよう':!feetFirst?'着地の前に足を戻して、足先を下へ':grade==='PERFECT'?'中央にピタッ！見事な着地':grade==='GOOD'?'ナイス着地！次はマットの真ん中へ':'あと一歩！早めに足を戻して着地しよう'};
}
function step(s,dt){
 if(s.phase==='result')return;
 s.elapsed+=dt;
 const previous=pose(s),old=metrics(s.pump),oldAngle=s.angle,oldPump=s.pump;
 // A damped pose motor, never a velocity boost. Its moving leg mass exchanges angular momentum with the body.
 const target=s.held?1:0,response=CONFIG.pumpResponseSpeed*4;
 const acceleration=response*response*(target-s.pump)-2*response*s.pumpVelocity;
 s.pumpVelocity+=acceleration*dt;s.pump=clamp(s.pump+s.pumpVelocity*dt,0,1);
 if(s.pump===0||s.pump===1)s.pumpVelocity=(s.pump-oldPump)/dt;
 const g=metrics(s.pump);
 if(s.phase==='swing'){
  let momentum=old.inertia*s.omega+old.coupling*s.previousPumpVelocity;
  if(!Number.isFinite(momentum))momentum=old.inertia*s.omega;
  const com=rotate(g.com,s.angle);
  momentum+=CONFIG.gravity*g.mass*com.x*dt;
  momentum*=Math.exp(-CONFIG.swingDamping*dt);
  s.omega=clamp((momentum-g.coupling*s.pumpVelocity)/g.inertia,-CONFIG.maxOmega,CONFIG.maxOmega);
  s.angle+=s.omega*dt;
  // Current energy-equivalent amplitude shrinks again when poorly timed strokes remove energy.
  const radius=Math.hypot(g.com.x,g.com.y),potential=CONFIG.gravity*g.mass*(radius-com.y);
  const energy=.5*g.inertia*s.omega*s.omega+potential;
  s.amplitude=Math.acos(clamp(1-energy/(CONFIG.gravity*g.mass*radius),-1,1));
  s.peakAmplitude=Math.max(s.peakAmplitude,s.amplitude);
  const dir=Math.sign(s.omega);if(dir!==s.turnDirection){s.swingTravel=0;s.turnDirection=dir;}
  s.swingTravel+=Math.abs(s.angle-oldAngle);if(s.swingTravel>=TAU){s.giants++;s.swingTravel-=TAU;}
  attachedPosition(s,g);
 }else{
  s.flightTime+=dt;s.angularMomentum*=Math.exp(-CONFIG.airDrag*dt);
  s.omega=(s.angularMomentum-g.airCoupling*s.pumpVelocity)/g.airInertia;
  s.angle+=s.omega*dt;s.airRotation+=Math.abs(s.angle-oldAngle);
  s.vy+=CONFIG.gravity*dt;s.vx*=Math.exp(-CONFIG.airDrag*dt);s.x+=s.vx*dt;s.y+=s.vy*dt;
  const current=pose(s);let hit=null;
  for(const [part,radius]of[['foot',CONFIG.footRadius],['head',CONFIG.headRadius],['torso',CONFIG.torsoRadius]]){
   const a=previous[part],b=current[part];
   for(const onMat of[true,false]){
    const surface=CONFIG.groundY-(onMat?CONFIG.matThickness:0),dy=b.y-a.y;
    if(dy<=0||b.y+radius<surface)continue;
    const t=clamp((surface-radius-a.y)/dy,0,1),x=a.x+(b.x-a.x)*t;
    if(onMat&&(x+radius<CONFIG.matX||x-radius>CONFIG.matX+CONFIG.matWidth))continue;
    if(!hit||t<hit.t)hit={part,onMat,surface,t,x,y:surface-radius};
   }
  }
  if(hit){s.y-=current[hit.part].y-hit.y;s.result=evaluateLanding(s,hit);s.score=s.result.score;s.phase='result';s.held=false;s.impact=hit;}
  else if(s.flightTime>CONFIG.maxFlightTime||!Number.isFinite(s.x+s.y)){s.result={grade:'CRASH',score:0,flips:0,distance:0,reason:'場外！もう一度チャレンジ'};s.phase='result';s.held=false;}
 }
 s.previousPumpVelocity=s.pumpVelocity;
 s.maxHeight=Math.max(s.maxHeight,(CONFIG.groundY-s.y)/CONFIG.pixelsPerMeter);
}
const API={CONFIG,create,step,release,pose,point,wrap,evaluateLanding,geometry,metrics};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.BarPhysics=API;
})(typeof window!=='undefined'?window:globalThis);
