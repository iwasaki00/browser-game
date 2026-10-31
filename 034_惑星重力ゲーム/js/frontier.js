// Observation layer only. No writes to physics snapshots, forces or goals.
export const DISCOVERY_STATES=['UNKNOWN','DETECTED','INVESTIGATED'];
export const FRONTIER_TARGETS=[
 {id:'D01',destination:'probe',name:'漂流探査機',x:1500,y:3000,detectRadius:700,investigateRadius:100,reward:'probe-routes',information:'回収した星図：別の信号位置と参考航路を解読',reveals:['D04'],message:'漂流探査機の記録を回収'},
 {id:'D02',destination:'rescue',name:'謎の救難信号',x:900,y:3100,detectRadius:700,investigateRadius:170,reward:'rescue-option',information:'救難情報：漂流船の位置を特定。任意の救助航路を選択可能',message:'救難信号の発信位置を特定'},
 {id:'D03',destination:'planet',name:'未知の惑星',planetId:'voyage-planet-3',x:2700,y:2350,detectRadius:1000,investigateRadius:550,reward:'gravity-notes',information:'重力情報：紫の天体は反発。予測線の曲がりと、外側の調査点を確認',message:'反発重力の観測データを取得'},
 {id:'D04',destination:'station',name:'宇宙ステーション',x:3400,y:1100,detectRadius:700,investigateRadius:160,dock:true,reward:'station-guidance',information:'航行支援：安全な寄港地と、次の航行の参考方位を記録',message:'寄港地で航行支援情報を受信'},
 {id:'D05',destination:'anomaly',name:'正体不明の物体',encounterId:'voyage-anomaly',x:3500,y:3500,detectRadius:1000,investigateRadius:380,trackSeconds:.5,reward:'anomaly-clue',information:'探索記録：反応の追跡から、漂流記録装置の位置を推定',reveals:['D01'],message:'追跡した反応から新しい調査地点を発見'},
];
export const frontierTarget=id=>FRONTIER_TARGETS.find(t=>t.id===id||t.destination===id);
export function normalizeFrontier(raw){
 const targets={};for(const t of FRONTIER_TARGETS){const value=raw?.targets?.[t.id]??{};targets[t.id]={...value,id:t.id,state:DISCOVERY_STATES.includes(value.state)?value.state:'UNKNOWN',tracking:Number.isFinite(value.tracking)?Math.max(0,value.tracking):0};}
 return {...raw,version:1,targets,rewards:Array.isArray(raw?.rewards)?[...new Set(raw.rewards.filter(r=>typeof r==='string'))]:[]};
}
export function legacyFrontier(voyage){
 const f=normalizeFrontier();for(const t of FRONTIER_TARGETS){if(voyage?.visited?.includes(t.destination)){f.targets[t.id]={...f.targets[t.id],state:'INVESTIGATED',legacy:true,information:t.information,...(typeof voyage.records?.[t.destination]==='string'?{investigatedFlightId:voyage.records[t.destination]}:{})};f.rewards.push(t.reward);}else if(voyage?.selected===t.destination)f.targets[t.id]={...f.targets[t.id],state:'DETECTED',legacy:true,source:'legacy-selected'};}
 return f;
}
export function discoveryEntry(raw,id){return raw?.targets?.[frontierTarget(id)?.id]??{state:'UNKNOWN'};}
export function targetAvailable(raw,id,story){return id==='temporal-anomaly'?Boolean(story?.clues?.['CLUE-08']):id==='echo-signal'?Boolean(story?.clues?.['CLUE-01']&&story?.clues?.['CLUE-02']&&story?.clues?.['CLUE-03']):id==='gate'||discoveryEntry(raw,id).state!=='UNKNOWN';}
export function targetLabel(raw,id,story){if(id==='temporal-anomaly')return story?.impossible?.investigated?'時空異常（未確定）':'UNKNOWN ANOMALY';if(id==='echo-signal')return '救難信号の発信源';const t=frontierTarget(id);return !t?'帰還ゲート':discoveryEntry(raw,id).state==='INVESTIGATED'?t.name:`未解析の信号 ${t.id}`;}
export function frontierPosition(t,state){return state.planets?.find(p=>p.id===t.planetId)??state.encounters?.find(e=>e.id===t.encounterId)??t;}
// Exact interval inside a circle for the same linear step segment used by CCD.
export function insideInterval(a,b,radius){
 const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy,C=a.x*a.x+a.y*a.y-radius*radius;if(A<1e-20)return C<=0?[0,1]:null;
 const B=2*(a.x*dx+a.y*dy),discriminant=B*B-4*A*C;if(discriminant<0)return null;
 const root=Math.sqrt(discriminant),lo=Math.max(0,(-B-root)/(2*A)),hi=Math.min(1,(-B+root)/(2*A));return lo<=hi?[lo,hi]:null;
}
export function observeFrontier(raw,previous,next,now=()=>Date.now()){
 const frontier=normalizeFrontier(raw),events=[],dt=next.elapsed-previous.elapsed;
 const promote=(t,state,source='proximity',fraction=1)=>{
  const entry=frontier.targets[t.id];if(DISCOVERY_STATES.indexOf(entry.state)>=DISCOVERY_STATES.indexOf(state))return;
  const at=now(),elapsed=previous.elapsed+dt*fraction;entry.state=state;entry.source=source;
  if(entry.firstDetectedAt==null&&!entry.legacy)entry.firstDetectedAt=at;
  if(entry.detectedElapsed===undefined&&!entry.legacy)entry.detectedElapsed=elapsed;
  if(state==='INVESTIGATED'){entry.investigatedAt=at;entry.investigatedElapsed=elapsed;entry.information=t.information;frontier.rewards=[...new Set([...frontier.rewards,t.reward])];}
  events.push({id:t.id,state,source,at,elapsed,message:state==='INVESTIGATED'?t.message:source==='chart'?'新しい調査地点を開示':`UNKNOWN SIGNAL：反応 ${t.id} を検出`});
 };
 for(const t of FRONTIER_TARGETS){
  const before=frontierPosition(t,previous),after=frontierPosition(t,next),a={x:previous.rocket.position.x-before.x,y:previous.rocket.position.y-before.y},b={x:next.rocket.position.x-after.x,y:next.rocket.position.y-after.y};
  const detection=insideInterval(a,b,t.detectRadius),investigation=insideInterval(a,b,t.investigateRadius),entry=frontier.targets[t.id];
  if(detection)promote(t,'DETECTED','proximity',detection[0]);
  if(!investigation||entry.state==='INVESTIGATED'){if(!investigation)entry.tracking=0;continue;}
  if(t.dock){if(next.status==='cleared'&&next.target===t.destination)promote(t,'INVESTIGATED','dock');}
  else if(t.trackSeconds){entry.tracking+=dt*(investigation[1]-investigation[0]);if(entry.tracking+1e-10>=t.trackSeconds)promote(t,'INVESTIGATED','tracking',investigation[1]);if(investigation[1]<1)entry.tracking=0;}
  else promote(t,'INVESTIGATED','proximity',investigation[0]);
 }
 for(const t of FRONTIER_TARGETS)if(frontier.targets[t.id].state==='INVESTIGATED')for(const id of t.reveals??[])promote(frontierTarget(id),'DETECTED','chart');
 return {frontier,events};
}
