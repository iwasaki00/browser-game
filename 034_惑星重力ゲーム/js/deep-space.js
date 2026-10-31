import {getStage} from './stages.js';
import {configurePlanet,planetExtent} from './planets.js';
import {createEncounter} from './encounters.js';
import {insideInterval} from './frontier.js';

export const DEEP_ID='homeward-deep';
export const DEEP_SECTOR={id:DEEP_ID,number:'DEEP',name:'遠方探索領域',theme:'静かな星間空間に残る、次の帰還航路の手掛かり',distance:0,map:{x:92,y:52},next:null,deepSpace:true,
 enter:'DEEP SPACE：帰還ゲートの先に古い観測網を検出。帰還を急ぐか、遠方の反応を調べるか。航路は自分たちで描く。',departure:'出航：星の少ない海へ。',arrival:'遠方帰還中継点に到達。通信の矛盾は残る。',hint:'目的地と方針は宇宙マップから変更できます。方針は自動操縦ではありません。予測を見ながらANGLE / THRUSTを調整してください。'};
export const DEEP_ORIGIN={id:'origin',name:'遠方領域入口',x:600,y:9000};
export const DEEP_GATE={id:'return',name:'帰還中継点',x:10500,y:1000,radius:120,color:'#7bf3b5'};
export const DEEP_TARGETS=[
 {id:'DS01',name:'漂流探査機',x:2400,y:7200,radius:100,detectRadius:1100,investigateRadius:180,reward:'deep-charts',reveals:['DS02','DS03'],message:'漂流探査機の航路図を回収',information:'航路情報：二つの反応を開示。記録の船影は判読できない。'},
 {id:'DS02',name:'重力異常領域',x:4700,y:5800,radius:100,detectRadius:1400,investigateRadius:180,reward:'gravity-reference',reveals:['DS04'],message:'重力異常の観測を完了',information:'重力情報：中心(5000,6000)に引力。外側の調査点を目標にし、予測線の曲がりを比較する。'},
 {id:'DS03',name:'未知の人工構造物',x:7800,y:6500,radius:100,detectRadius:1200,investigateRadius:180,reward:'structure-map',reveals:['DS05'],message:'無人構造物から星図の断片を受信',information:'航行支援：この付近は空白域。次の目的地までの距離と予測時間を確認する。構造物の用途は不明。'},
 {id:'DS04',name:'微弱な救難信号',x:9500,y:4000,radius:100,detectRadius:1300,investigateRadius:180,reward:'distress-log',reveals:['DS06'],message:'通常通信に埋もれた救難信号を分離',information:'救難情報：同じ識別列の一部を検出。発信者の存在は確認できない。時間観測地点を開示。'},
 {id:'DS05',name:'星間残骸群',x:6500,y:2600,radius:100,detectRadius:1200,investigateRadius:160,reward:'fleet-fragment',reveals:['DS06'],message:'残骸の観測記録を回収',information:'探索記録：複数船の観測配列。破壊か放棄かは不明。隕石本体から離れた調査点を使う。'},
 {id:'DS06',name:'時間異常観測点',x:3000,y:1800,radius:100,detectRadius:1300,investigateRadius:180,reward:'temporal-reference',message:'72時間のずれを示す別の記録を取得',information:'観測記録：72時間先を示す時刻は再現する。しかし、船体も時間移動も確認できない。'},
];
export const DEEP_POLICIES={direct:{label:'DIRECT RETURN',description:'帰還中継点を目標にする。途中の調査は任意。'},safe:{label:'SAFE VOYAGE',description:'空白域の中継点を選ぶ。安全保証や自動回避はありません。予測で危険領域を確認。'},explore:{label:'DEEP EXPLORATION',description:'検出済みで未調査の反応を優先する。発射条件は自分で設定。'}};
export const deepTarget=id=>id==='return'?DEEP_GATE:DEEP_TARGETS.find(t=>t.id===id);
export function normalizeDeep(raw){
 const v=raw&&typeof raw==='object'?raw:{},targets={};
 for(const t of DEEP_TARGETS){const e=v.targets?.[t.id]??{};targets[t.id]={...e,state:['UNKNOWN','DETECTED','INVESTIGATED'].includes(e.state)?e.state:t.id==='DS01'?'DETECTED':'UNKNOWN'};}
 const selected=deepTarget(v.selected)?v.selected:'return';
 return {...v,version:1,targets,selected:selected==='return'||targets[selected].state!=='UNKNOWN'?selected:'return',checkpoint:v.checkpoint==='origin'||deepTarget(v.checkpoint)?v.checkpoint:'origin',visited:Array.isArray(v.visited)?[...new Set(v.visited.filter(id=>deepTarget(id)))]:[],rewards:Array.isArray(v.rewards)?[...new Set(v.rewards.filter(x=>typeof x==='string'))]:[],choices:Array.isArray(v.choices)?v.choices.slice(-100):[],records:v.records&&typeof v.records==='object'?{...v.records}:{},elapsed:Number.isFinite(v.elapsed)?Math.max(0,v.elapsed):0,completed:v.completed===true};
}
export const deepAvailable=(v,id)=>id==='return'||Boolean(DEEP_TARGETS.find(t=>t.id===id)&&normalizeDeep(v).targets[id].state!=='UNKNOWN');
export function deepLabel(raw,id){const t=deepTarget(id);return id==='return'?t.name:normalizeDeep(raw).targets[id]?.state==='INVESTIGATED'?t?.name:`未解析の反応 ${id}`;}
export function deepPlanets(){return [[3500,7600,'gas'],[7200,4400,'earth'],[4500,2200,'repulsor']].map(([x,y,type],i)=>configurePlanet({id:`deep-planet-${i}`,x,y},type));}
export function deepDeparture(raw,planets=deepPlanets()){
 const v=normalizeDeep(raw),center=v.checkpoint==='origin'?DEEP_ORIGIN:deepTarget(v.checkpoint);
 const valid=p=>p.x>40&&p.x<11960&&p.y>40&&p.y<9960&&planets.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>planetExtent(q)+40)&&Math.hypot(p.x-5000,p.y-6000)>100&&Math.hypot(p.x-6300,p.y-2600)>100;
 if(v.checkpoint==='origin'&&valid(center))return {x:center.x,y:center.y};
 for(const r of [200,280,400,600])for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/8,p={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};if(valid(p))return p;}
 throw Error('安全な出航地点がありません。');
}
export function createDeepSpace(raw){
 const v=normalizeDeep(raw),base=getStage(),planets=deepPlanets();
 if(Array.isArray(v.planets))for(const p of planets){const saved=v.planets.find(q=>q.id===p.id);if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.x>=p.radius&&saved.x<=12000-p.radius&&saved.y>=p.radius&&saved.y<=10000-p.radius){p.x=saved.x;p.y=saved.y;}}
 const position=deepDeparture(v,planets),goal={...deepTarget(v.selected)},unknown={...createEncounter('unknown','deep-gravity',5000,6000,{strength:120,fixed:true}),reactionRadius:1400};
 const structure=createEncounter('station','deep-structure',7800,6500,{fixed:true}),debris=createEncounter('meteor','deep-debris',6300,2600,{speed:0,count:3,fixed:true});
 return {...base,id:DEEP_ID,name:'HOMEWARD / DEEP SPACE',description:DEEP_SECTOR.theme,deepSpace:true,world:{width:12000,height:10000},worldPreset:'deep',flightLimits:{maxFlightTime:180},previewSeconds:120,
 launch:{...base.launch,position,angleDeg:Math.round(Math.atan2(goal.y-position.y,goal.x-position.x)*180/Math.PI),speed:220,angleRange:[-180,180]},goal,planets,encounters:[unknown,structure,debris],
 rules:{minPlanets:3,maxPlanets:3,types:['gas','earth','repulsor'],sizes:['medium'],fixedPlanets:planets.map(p=>({id:p.id,type:p.type,size:p.size})),placement:{left:0,top:0,right:12000,bottom:10000}},launchConditions:{precisionAngleRange:[-180,180],slingshotAngleRange:[-180,180],speedRange:[120,220]}};
}
// Pure observation of the exact physical step segment. No force, velocity or goal writes.
export function observeDeep(raw,previous,next,now=()=>Date.now()){
 const deep=normalizeDeep(raw),events=[];
 const promote=(t,state,source,fraction=1)=>{const e=deep.targets[t.id];if(e.state==='INVESTIGATED'||e.state===state)return;e.state=state;e.firstDetectedAt??=now();const elapsed=previous.elapsed+(next.elapsed-previous.elapsed)*fraction;
  if(state==='INVESTIGATED'){e.investigatedAt=now();e.information=t.information;deep.rewards=[...new Set([...deep.rewards,t.reward])];}
  events.push({id:t.id,destination:t.id,state,source,elapsed,at:now(),message:state==='INVESTIGATED'?t.message:`UNKNOWN SIGNAL：${t.id} に反応`,information:state==='INVESTIGATED'?t.information:undefined});};
 for(const t of DEEP_TARGETS){const a={x:previous.rocket.position.x-t.x,y:previous.rocket.position.y-t.y},b={x:next.rocket.position.x-t.x,y:next.rocket.position.y-t.y},d=insideInterval(a,b,t.detectRadius),r=insideInterval(a,b,t.investigateRadius);if(d)promote(t,'DETECTED','proximity',d[0]);if(r&&next.status!=='failed')promote(t,'INVESTIGATED','proximity',r[0]);}
 for(const t of DEEP_TARGETS)if(deep.targets[t.id].state==='INVESTIGATED')for(const id of t.reveals??[]){const q=deepTarget(id);if(deep.targets[id].state==='UNKNOWN')promote(q,'DETECTED','chart');}
 if(['gravity-reference','structure-map','temporal-reference'].every(id=>deep.rewards.includes(id))&&!deep.rewards.includes('final-voyage-chart')){deep.rewards.push('final-voyage-chart');events.push({id:'final-voyage-chart',elapsed:next.elapsed,message:'FINAL VOYAGE：矛盾する三つの記録から、次の帰還航路の候補を特定。真相は未確認。'});}
 return {deep,events};
}
export function chooseDeepPolicy(raw,policy,position){const v=normalizeDeep(raw);if(!DEEP_POLICIES[policy])return null;const candidates=DEEP_TARGETS.filter(t=>deepAvailable(v,t.id)&&v.targets[t.id].state!=='INVESTIGATED');const target=policy==='direct'?DEEP_GATE:policy==='safe'?DEEP_TARGETS.find(t=>t.id==='DS03'&&deepAvailable(v,t.id))??DEEP_GATE:candidates.sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0]??DEEP_GATE;
 return {...v,selected:target.id,choices:[...v.choices,{policy,target:target.id,at:Date.now()}].slice(-100)};}
export function dockDeep(raw,state){const v=normalizeDeep(raw),d=deepTarget(v.selected);if(state.status!=='cleared'||state.target!==d.id||Math.hypot(state.rocket.position.x-d.x,state.rocket.position.y-d.y)>d.radius+1e-6)return null;return {...v,checkpoint:d.id,visited:[...new Set([...v.visited,d.id])],elapsed:v.elapsed+state.elapsed,planets:state.planets.map(p=>({id:p.id,x:p.x,y:p.y})),completed:v.completed||d.id==='return'};}
