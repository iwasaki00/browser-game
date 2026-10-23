import {getStage}from'./stages.js';
import {configurePlanet,planetExtent}from'./planets.js';
const definitions=[
 ['小さな巨人','高密度惑星：小型でも強い引力を使おう。',[[185,280,'dense']],[319,105,24]],
 ['重力の針穴','高密度惑星：接近して急旋回、接触は避けよう。',[[180,240,'dense']],[320,100,18]],
 ['逆らう星','反重力惑星：反発で左上のゲートへ曲げよう。',[[180,300,'repulsor']],[85,80,24]],
 ['押して曲げる','反重力と地球型：押し返す力と引力をつなごう。',[[210,300,'repulsor'],[100,170,'earth']],[211,73,22]],
 ['灼熱の航路','恒星：橙色の熱危険領域の外を通ろう。',[[220,280,'star']],[315,100,24]],
 ['太陽をかすめて','恒星：熱領域を避けながら強い引力で旋回。',[[200,240,'star']],[320,90,18]],
 ['深淵の引力','ブラックホール：中心の吸収域を避けよう。',[[230,280,'blackhole']],[319,100,24]],
 ['事象の境界','ブラックホール：強重力で精密な旋回を作ろう。',[[210,230,'blackhole']],[320,80,18]],
 ['相反する力','ブラックホールと反重力：引力と反発を組み合わせよう。',[[240,300,'blackhole'],[100,160,'repulsor']],[327,122,22]],
 ['宇宙の支配者','ブラックホール・反重力・高密度を総動員しよう。',[[240,300,'blackhole'],[80,160,'repulsor'],[270,150,'dense']],[334,105,20]],
];
const answers=[[-70,170,2.199999999999995],[-68,208,1.8666666666666625],[-54,170,2.391666666666661],[-50,220,1.741666666666663],[-69,170,2.1583333333333283],[-72,176,2.1583333333333283],[-72,200,1.8583333333333292],[-74,220,1.7333333333333296],[-72,220,1.741666666666663],[-66,212,1.5916666666666635]];
export const SPECIAL_CHALLENGES=definitions.map(([name,description,definitions,goal],i)=>{
 const planets=definitions.map(([x,y,type],j)=>configurePlanet({id:`special-${j+1}`,x,y},type));
 const stage={...getStage(),id:`stage-${i+11}`,name,description,planets,goal:{id:'goal',x:goal[0],y:goal[1],radius:goal[2]},
  rules:{maxPlanets:planets.length,minPlanets:planets.length,types:[...new Set(planets.map(p=>p.type))],sizes:['medium'],placement:{left:0,top:0,right:375,bottom:500},fixedPlanets:planets.map(p=>({id:p.id,type:p.type,size:p.size})),planetRanges:Object.fromEntries(planets.map(p=>{const e=planetExtent(p);return[p.id,{left:p.x-e-12,top:p.y-e-12,right:p.x+e+12,bottom:p.y+e+12}];}))},
  launchConditions:{precisionAngleRange:[answers[i][0]-4,answers[i][0]+4],slingshotAngleRange:[answers[i][0]-4,answers[i][0]+4],speedRange:[answers[i][1]-12,Math.min(220,answers[i][1]+12)]},
  rating:{two:{maxTime:Math.ceil((answers[i][2]+.8)*10)/10},three:{maxTime:Math.ceil((answers[i][2]+.15)*10)/10,maxMovement:30}},
  solution:{planets:structuredClone(planets),angleDeg:answers[i][0],speed:answers[i][1],liveTargets:{},elapsed:answers[i][2],status:'cleared'},
  threeStarSolution:{angleDeg:answers[i][0],speed:answers[i][1]},
  verification:{design:'cleared',live:'cleared',elapsed:answers[i][2],fixedTimeStep:1/120}};
 stage.launch={...stage.launch,angleDeg:answers[i][0],speed:answers[i][1],angleRange:stage.launchConditions.precisionAngleRange,speedRange:stage.launchConditions.speedRange};
 if(i>=8){
  stage.launchConditions.precisionAngleRange=[answers[i][0]-1,answers[i][0]+1];
  stage.launchConditions.slingshotAngleRange=[...stage.launchConditions.precisionAngleRange];
  stage.launchConditions.speedRange=[answers[i][1]-4,Math.min(220,answers[i][1]+4)];
  stage.launch.angleRange=stage.launchConditions.precisionAngleRange;stage.launch.speedRange=stage.launchConditions.speedRange;
 }
 return stage;
});
export function launchAllowed(stage,velocity,method='precision'){
 if(!stage.rules?.fixedPlanets)return true;
 const angle=Math.atan2(velocity.y,velocity.x)*180/Math.PI,speed=Math.hypot(velocity.x,velocity.y);
 const range=method==='slingshot'?stage.launchConditions.slingshotAngleRange:stage.launchConditions.precisionAngleRange;
 return angle>=range[0]-1e-8&&angle<=range[1]+1e-8&&speed>=stage.launchConditions.speedRange[0]-1e-8&&speed<=stage.launchConditions.speedRange[1]+1e-8;
}
