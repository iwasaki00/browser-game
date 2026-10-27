import {getStage} from './stages.js';
import {configurePlanet,planetExtent} from './planets.js';
import {createEncounter} from './encounters.js';
export const OPEN_SECTOR={id:'homeward-09',number:'09',name:'分かれ道の星域',theme:'行き先を選び、同じ星域を何度も航行する',distance:3600,map:{x:79,y:23},next:null,openVoyage:true,
 initial:{angleDeg:-55,speed:200},planets:[],goal:{x:2900,y:700,radius:100},
 enter:'航行ログ09：星図は一本の線ではなくなった。帰還ゲートへ直行できる。救難信号、未知の星、灯台へ寄り道してから進むこともできる。行き先は航行中も変えられる。',
 departure:'出航：ヒナギの次の行き先は、私たちが選ぶ。',arrival:'到着09：帰還ゲートへ到達。見つけた情報とともに、次の宙域への航路を記録した。',
 hint:'宇宙マップで目的地を選択。寄港後は「次の航行へ」で安全な発射地点へ。救難信号を調べると初期配置用の参考航路が解読されます。惑星を動かした場合は予測で再調整してください。'};
export const DESTINATIONS=[
 {id:'gate',name:'帰還ゲート',x:2900,y:700,radius:100,color:'#75f1b0',log:'帰還ゲートを通過。地球へつながる次の宙域を確認した。',reward:'next-region',information:'次の宙域への通行情報'},
 {id:'rescue',name:'救難信号',x:900,y:3100,radius:95,color:'#ffc37e',log:'漂流船の乗員を救助。残された観測記録から、星域の航路を解読した。',reward:'route-charts',information:'参考航路の表示を解放'},
 {id:'planet',name:'未知の惑星',x:3000,y:2650,radius:110,color:'#bfadff',log:'反発する重力の境界を調査。未知の航法技術で、帰還経路を900航路単位短縮できる。',reward:'navigation-tech',information:'帰還経路の短縮 −900'},
 {id:'station',name:'宇宙ステーション',x:3400,y:1100,radius:100,color:'#83dfff',log:'静かな寄港地で航行情報を受信。次の宙域の安全な進入方位を記録した。',reward:'station-intel',information:'次の宙域向けの航行情報'},
];
export const ORIGIN={id:'origin',name:'星域入口',x:250,y:4500};
export const newVoyage=()=>({checkpoint:'origin',selected:'gate',visited:[],discoveries:[],rewards:[],completed:false,elapsed:0,planets:null,records:{}});
export function destination(id){return DESTINATIONS.find(d=>d.id===id);}
export function normalizeVoyage(raw){
 const source=raw&&typeof raw==='object'?raw:{},v={...source,...newVoyage()};
 v.checkpoint=source.checkpoint==='origin'||destination(source.checkpoint)?source.checkpoint:'origin';
 v.selected=destination(source.selected)?source.selected:'gate';
 for(const key of ['visited','discoveries','rewards'])v[key]=Array.isArray(source[key])?[...new Set(source[key].filter(s=>typeof s==='string'))]:[];
 v.completed=source.completed===true;v.elapsed=Number.isFinite(source.elapsed)?Math.max(0,source.elapsed):0;
 v.planets=Array.isArray(source.planets)?structuredClone(source.planets):null;v.records=source.records&&typeof source.records==='object'?{...source.records}:{};
 return v;
}
export function departurePosition(voyage){if(voyage.launchPosition&&Number.isFinite(voyage.launchPosition.x)&&Number.isFinite(voyage.launchPosition.y))return {...voyage.launchPosition};const p=destination(voyage.checkpoint);return p?{x:p.x,y:p.y+160}:{x:ORIGIN.x,y:ORIGIN.y};}
export function safeDeparture(voyage,planets){
 const center=destination(voyage.checkpoint)??ORIGIN;
 const valid=p=>p.x>=34&&p.x<=3716&&p.y>=34&&p.y<=4966&&planets.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=planetExtent(q)+34)&&(!destination(voyage.checkpoint)||Math.hypot(center.x-p.x,center.y-p.y)>=center.radius+34);
 const preferred=departurePosition(voyage);if(valid(preferred))return preferred;
 for(const radius of [160,240,320,480])for(let i=0;i<16;i++){const angle=Math.PI/2+i*Math.PI/8,p={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};if(valid(p))return p;}
 throw Error('安全な再発射地点を確保できません。');
}
function initialPlanets(){return [[1100,3400,'earth'],[1900,1500,'gas'],[2700,2350,'repulsor']].map(([x,y,type],i)=>configurePlanet({id:`voyage-planet-${i+1}`,x,y},type));}
export function createOpenVoyage(raw){
 const voyage=normalizeVoyage(raw),base=getStage(),goal={...destination(voyage.selected)};
 const planets=initialPlanets();
 if(voyage.planets)for(const p of planets){const saved=voyage.planets.find(s=>s.id===p.id);if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.x>=p.radius&&saved.x<=3750-p.radius&&saved.y>=p.radius&&saved.y<=5000-p.radius){p.x=saved.x;p.y=saved.y;}}
 const position=safeDeparture(voyage,planets);
 const comet=createEncounter('comet','voyage-comet',650,3700,{speed:12,strength:45,fixed:true});comet.angleDeg=-65;comet.tailWidth=35;comet.x+=Math.cos(-65*Math.PI/180)*12*voyage.elapsed;comet.y+=Math.sin(-65*Math.PI/180)*12*voyage.elapsed;
 const station=createEncounter('station','voyage-station',3400,1100,{fixed:true});station.reactionRadius=160;
 const unknown=createEncounter('unknown','voyage-anomaly',3500,3500,{strength:45,fixed:true});
 return {...base,id:OPEN_SECTOR.id,name:'HOMEWARD 09 / 分かれ道の星域',description:OPEN_SECTOR.theme,openVoyage:true,destinationId:goal.id,
  world:{width:3750,height:5000},worldPreset:'huge',flightLimits:{maxFlightTime:180},previewSeconds:120,
  launch:{...base.launch,position,angleDeg:Math.round(Math.atan2(goal.y-position.y,goal.x-position.x)*180/Math.PI),speed:200,angleRange:[-180,180]},
  goal,planets,encounters:[comet,station,unknown],
  rules:{minPlanets:3,maxPlanets:3,types:['earth','gas','repulsor'],sizes:['medium'],fixedPlanets:planets.map(p=>({id:p.id,type:p.type,size:p.size})),placement:{left:0,top:0,right:3750,bottom:5000}},
  launchConditions:{precisionAngleRange:[-180,180],slingshotAngleRange:[-180,180],speedRange:[120,220]},
 };
}
// A dock is awarded only by the unchanged physics engine hitting the selected goal.
export function dockVoyage(raw,state){
 const v=normalizeVoyage(raw),d=destination(v.selected);
 if(state.status!=='cleared'||state.target!==d.id||Math.hypot(state.rocket.position.x-d.x,state.rocket.position.y-d.y)>d.radius+1e-6)return null;
 const planets=state.planets.map(p=>({...p})),next={...v,checkpoint:d.id,visited:[...new Set([...v.visited,d.id])],discoveries:[...new Set([...v.discoveries,d.information])],rewards:[...new Set([...v.rewards,d.reward])],completed:v.completed||d.id==='gate',elapsed:v.elapsed+state.elapsed,planets};
 // Do not teleport into a planet if it was moved over the departure berth.
 delete next.launchPosition;next.launchPosition=safeDeparture(next,planets);
 return next;
}
export function voyageTargetDistance(raw,position=departurePosition(normalizeVoyage(raw))){const d=destination(normalizeVoyage(raw).selected);return Math.hypot(d.x-position.x,d.y-position.y);}
