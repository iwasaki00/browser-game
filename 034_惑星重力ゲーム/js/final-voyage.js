import {createDeepSpace,DEEP_TARGETS} from './deep-space.js';
import {planetExtent} from './planets.js';
import {encounterBodies} from './encounters.js';

export const FINAL_ID='homeward-final';
export const FINAL_SECTOR={id:FINAL_ID,number:'FINAL',name:'FINAL VOYAGE',theme:'未来は予告ではない。最後の航路を、自分で選ぶ。',distance:0,map:{x:78,y:78},next:null,finalVoyage:true,
 enter:'THE LAST SIGNAL：こちらは……応答を……。観測網が最後の通信を転送した。地球への航路は開いている。信号の先へ進むか、故郷を目指すか。',departure:'最終航行：選んだ航路は、まだ記録されていない。',arrival:'最後の目的地へ到達。選んだ判断と航行の結果を記録する。',hint:'宇宙マップで最終判断と目的地を選び、予測を確認して発射。判断は変更できます。救難・中枢調査は寄港後に地球へ再発射。自動操縦はありません。'};
export const FINAL_DESTINATIONS=[
 {id:'earth',port:'origin',name:'地球帰還ゲート',x:600,y:9000,radius:100,color:'#80f5ba'},
 {id:'rescue',port:'DS04',name:'最終救難地点',x:9500,y:4000,radius:100,color:'#ffc68c'},
 {id:'network',port:'DS03',name:'観測網中枢',x:7800,y:6500,radius:100,color:'#9edfff'},
 {id:'passage',port:'DS02',name:'時空異常の通過地点',x:4700,y:5800,radius:100,color:'#c5a4ff'},
 {id:'observatory',port:'DS06',name:'外縁観測点',x:3000,y:1800,radius:100,color:'#bca6ff'},
 {id:'berth',port:'DS01',name:'外縁待機点',x:2400,y:7200,radius:100,color:'#ffe2a4'},
 {id:'relay',name:'北側安全中継点',x:1000,y:800,radius:100,color:'#9ee6dc'},
];
export const finalDestination=id=>FINAL_DESTINATIONS.find(d=>d.id===id);
export const FINAL_CHOICES=[{id:'home',label:'RETURN HOME / 帰還を優先'},{id:'rescue',label:'RESCUE / 救難して帰還'},{id:'truth',label:'SEEK THE TRUTH / 真相を調査'},{id:'other',label:'INVESTIGATE / 異常を調査'},{id:'continue',label:'CONTINUE / 探索を続ける'}];
export const FINAL_CHAPTERS=[
 {id:1,title:'THE LAST SIGNAL',message:'最後の通信が届く。「まだ、そこへ行くな」。警告は未来の確定を意味するのか。'},
 {id:2,title:'THE OBSERVATION NETWORK',message:'古い通信と72時間のずれが、同じ観測網で重なる。中枢へ行けば転送の仕組みを調べられる。'},
 {id:3,title:'THE CHOICE',message:'帰還、救難、真相の追跡。記録を残し、行き先は何度でも選び直せる。'},
 {id:4,title:'THE FINAL APPROACH',message:'予測を確かめ、自分で発射する。選んだ目的地への実際の到達が最後の通信を開く。'},
 {id:5,title:'HOME',message:'航路の先で、私たちの答えを記録する。帰還の後も、別の航路へ進める。'},
];
export const ENDINGS=[
 {id:'END-01',title:'HOMEWARD',color:'#83f2b5',communication:'こちらヒナギ。故郷の応答を確認。',text:'地球の光が窓に戻る。消えた船のすべては分からない。それでも、帰還を選んだ航跡はここに残った。'},
 {id:'END-02',title:'RESCUE',color:'#ffce8d',communication:'救助した乗員の生命信号、安定。本船とともに帰還します。',text:'帰ってきた呼出音は一つではなかった。失われた航路から救い出した声が、新しい星図の最初の行になる。'},
 {id:'END-03',title:'THE TRUTH',color:'#93ddff',communication:'観測網は未来を予言しない。航行情報を、別の時間軸へ転送していた。',text:'古い台帳と未来の時刻は、転送された記録の到着順だった。イサリの信号には、別の航路を選んだ本船の記録が重なった可能性がある。未来は一つではない。私たちは帰還する航路を選んだ。'},
 {id:'END-04',title:'THE OTHER SIDE',color:'#c6a4ff',communication:'「こちらは……ヒナギ」「まだ、そこへ行くな」。その声は、いま送信した本船の声だった。',text:'異常の向こうに船はなかった。観測窓には、本船が選ばなかった帰還航路の記録が流れる。信号は本船の記録を別の時間軸へ渡した。しかし、調査船の乗員が誰だったのかは記録されていない。私たちは境界を観測し、次の航路を選べる場所に留まった。'},
 {id:'END-05',title:'ENDLESS VOYAGE',color:'#aabaff',communication:'帰還予定を保留。航海日誌を開いたまま、次の反応へ。',text:'故郷への道は閉じていない。私たちは、まだ星図の空白を見ていたい。いつでも帰還を選び直せる。'},
];
export const endingDefinition=id=>ENDINGS.find(e=>e.id===id);
export const TRUTH_CLUES=['CLUE-01','CLUE-02','CLUE-03','CLUE-06','CLUE-07','CLUE-09'];
// Keep the first story transmissions even after many reversible choices.
function retainCommunications(rows){const first=new Map();for(const e of rows)if(/^chapter:[124]$|^network-revealed$|^rescue-complete$|^ending:END-0[1-5]$/.test(e.id)&&!first.has(e.id))first.set(e.id,e);const pinned=new Set(first.values()),recent=new Set(rows.filter(e=>!pinned.has(e)).slice(-Math.max(0,60-pinned.size)));return rows.filter(e=>pinned.has(e)||recent.has(e));}
export function normalizeFinal(raw){
 const v=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},endings={};
 for(const e of ENDINGS){const row=v.endings?.[e.id];if(row&&typeof row==='object'&&Number.isFinite(row.firstAt)&&row.firstAt>=0)endings[e.id]={...row,id:e.id};}
 return {...v,version:1,selected:finalDestination(v.selected)?v.selected:'earth',checkpoint:v.checkpoint==='origin'||finalDestination(v.checkpoint)?v.checkpoint:'origin',decision:FINAL_CHOICES.some(c=>c.id===v.decision)?v.decision:null,
  choices:Array.isArray(v.choices)?v.choices.filter(c=>c&&FINAL_CHOICES.some(a=>a.id===c.decision)).slice(-100):[],chapters:Array.isArray(v.chapters)?[...new Set(v.chapters.filter(n=>[1,2,3,4,5].includes(n)))]:[],communications:Array.isArray(v.communications)?retainCommunications(v.communications.filter(e=>e&&typeof e.id==='string'&&typeof e.message==='string')):[],visited:Array.isArray(v.visited)?[...new Set(v.visited.filter(id=>finalDestination(id)))]:[],records:v.records&&typeof v.records==='object'&&!Array.isArray(v.records)?{...v.records}:{},endings,networkRead:v.networkRead===true,rescueSaved:v.rescueSaved===true,elapsed:Number.isFinite(v.elapsed)?Math.max(0,v.elapsed):0};
}
function communicate(v,id,chapter,title,message,now,elapsed=0){if(v.communications.some(c=>c.id===id))return null;const event={id,chapter,title,message,destination:v.selected,at:now(),elapsed};v.communications.push(event);v.communications=retainCommunications(v.communications);v.chapters=[...new Set([...v.chapters,chapter])];return event;}
export function beginFinal(raw,now=()=>Date.now()){const voyage=normalizeFinal(raw),events=[];for(const c of FINAL_CHAPTERS.slice(0,2)){const event=communicate(voyage,`chapter:${c.id}`,c.id,c.title,c.message,now);if(event)events.push(event);}return {voyage,events};}
export function finalSupport(homeward,raw){const v=normalizeFinal(raw),missing=TRUTH_CLUES.filter(id=>!homeward.echoes?.clues?.[id]),chart=homeward.deep?.rewards?.includes('final-voyage-chart')===true&&['DS02','DS03','DS06'].every(id=>homeward.deep?.targets?.[id]?.state==='INVESTIGATED');return {rescue:v.rescueSaved||homeward.voyage?.visited?.includes('rescue')===true,truth:!missing.length&&chart&&v.networkRead,missing,chart,network:v.networkRead};}
export function decisionRequirements(homeward,raw){const v=normalizeFinal(raw),s=finalSupport(homeward,v);switch(v.decision){case 'home':return [];case 'rescue':return s.rescue?[]:['最終救難地点へ到達して救難活動を完了してください（Sector09の救助済み記録も有効）。'];case 'truth':return [...(s.missing.length?[`Sector09で ${s.missing.join(' / ')} を確認してください。`]:[]),...(!s.chart?['DEEP SPACEの重力異常・人工構造物・時間観測点を調査してください。']:[]),...(!s.network?['観測網中枢へ到達して転送記録を確認してください。']:[])];case 'other':return s.network?[]:['観測網中枢の情報を確認してから異常の通過地点へ。'];case 'continue':return [];default:return ['宇宙マップで最終判断を選んでください。'];}}
export function chooseFinal(raw,decision,homeward={},now=()=>Date.now(),elapsed=0){if(!FINAL_CHOICES.some(c=>c.id===decision))return null;const voyage=normalizeFinal(raw),support=finalSupport(homeward,voyage);voyage.decision=decision;voyage.selected=decision==='rescue'&&!support.rescue?'rescue':decision==='truth'&&!voyage.networkRead||decision==='other'&&!voyage.networkRead?'network':decision==='other'?'passage':decision==='continue'?'observatory':'earth';voyage.choices.push({decision,destination:voyage.selected,at:now()});voyage.choices=voyage.choices.slice(-100);const event=communicate(voyage,`decision:${voyage.choices.at(-1).at}:${voyage.choices.length}`,3,'THE CHOICE',FINAL_CHOICES.find(c=>c.id===decision).label,now,elapsed);return {voyage,events:event?[event]:[]};}
export function startFinalFlight(raw,now=()=>Date.now()){const voyage=normalizeFinal(raw),c=FINAL_CHAPTERS[3],event=communicate(voyage,'chapter:4',4,c.title,c.message,now);return {voyage,events:event?[event]:[]};}
export function createFinalVoyage(raw){const v=normalizeFinal(raw),port=v.checkpoint==='origin'?'return':finalDestination(v.checkpoint).port,target=finalDestination(v.selected);
 // Reuse the exact DEEP geometry/forces and safe departure calculation. Only
 // the selected goal and independent narrative identity differ.
 const base=createDeepSpace({checkpoint:port,selected:'return',planets:v.planets,targets:Object.fromEntries(DEEP_TARGETS.map(t=>[t.id,{state:'DETECTED'}]))});
 if(v.checkpoint==='relay'){
  const center=finalDestination('relay');let safe;
  for(const radius of [200,280,400,600]){for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/8,p={x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius};if(p.x>40&&p.x<11960&&p.y>40&&p.y<9960&&base.planets.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>planetExtent(q)+40)&&base.encounters.filter(e=>e.type!=='station').every(e=>encounterBodies(e,0).every(q=>Math.hypot(q.x-p.x,q.y-p.y)>q.radius+40))){safe=p;break;}}if(safe)break;}
  if(!safe)throw Error('安全な再発射位置がありません。');base.launch={...base.launch,position:safe};
 }
 return {...base,id:FINAL_ID,name:'HOMEWARD / FINAL VOYAGE',description:FINAL_SECTOR.theme,deepSpace:false,finalVoyage:true,goal:{...target},launch:{...base.launch,angleDeg:Math.round(Math.atan2(target.y-base.launch.position.y,target.x-base.launch.position.x)*180/Math.PI)}};
}
export function evaluateEnding(homeward,raw,state){const v=normalizeFinal(raw),target=finalDestination(v.selected);if(state?.status!=='cleared'||state.target!==target.id||state.goal?.id!==target.id||Math.hypot(state.rocket.position.x-target.x,state.rocket.position.y-target.y)>target.radius+1e-6)return {ending:null,reasons:['選択した目的地への実航行の成功が必要です。']};
 const expected=v.decision==='other'?'passage':v.decision==='continue'?'observatory':'earth',reasons=decisionRequirements(homeward,v);if(target.id!==expected)reasons.push(`最終判断の到達先は「${finalDestination(expected).name}」です。この寄港後も航行を続けられます。`);
 return {ending:reasons.length?null:({home:'END-01',rescue:'END-02',truth:'END-03',other:'END-04',continue:'END-05'})[v.decision]??null,reasons};
}
export function dockFinal(homeward,raw,state,now=()=>Date.now()){
 const voyage=normalizeFinal(raw),target=finalDestination(voyage.selected);if(state?.status!=='cleared'||state.target!==target.id||state.goal?.id!==target.id||Math.hypot(state.rocket.position.x-target.x,state.rocket.position.y-target.y)>target.radius+1e-6)return null;
 voyage.checkpoint=target.id;voyage.visited=[...new Set([...voyage.visited,target.id])];voyage.elapsed+=state.elapsed;voyage.planets=state.planets.map(p=>({id:p.id,x:p.x,y:p.y}));const events=[];
 if(target.id==='rescue'){voyage.rescueSaved=true;const e=communicate(voyage,'rescue-complete',4,'RESCUE COMPLETE','救難船を保護。失われた調査船のものかは確認できない。同行して帰還できる。',now,state.elapsed);if(e)events.push(e);}
 if(target.id==='network'){voyage.networkRead=true;const e=communicate(voyage,'network-revealed',2,'THE OBSERVATION NETWORK','中枢記録を解読。観測網は予測器ではなく、異常を通る船の航行情報を異なる時間軸へ届ける転送網だった。古い記録に未来の時刻が含まれても、未来が確定した証拠にはならない。',now,state.elapsed);if(e)events.push(e);}
 const result=evaluateEnding(homeward,voyage,state);let newlyAwarded=false;
 if(result.ending){const old=voyage.endings[result.ending],at=now();newlyAwarded=!old;voyage.endings[result.ending]={...old,id:result.ending,firstAt:old?.firstAt??at,lastAt:at};const e=endingDefinition(result.ending),event=communicate(voyage,`ending:${e.id}`,5,e.title,e.communication,now,state.elapsed);if(event)events.push(event);}
 return {voyage,...result,events,newlyAwarded};
}
