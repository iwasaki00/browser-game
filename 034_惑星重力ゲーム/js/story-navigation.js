// Read-only projection: no migrations, clocks, storage writes or physics.
import {HOMEWARD_SECTORS} from './homeward-data.js';
import {ECHO_CLUES} from './echoes.js';
import {FRONTIER_TARGETS} from './frontier.js';
import {DEEP_TARGETS} from './deep-space.js';
import {FINAL_CHAPTERS,ENDINGS} from './final-voyage.js';
import {scanObjects} from './space-scanner.js';
import {missionGuide,destinationInfo} from './mission-guide.js';
const list=value=>Array.isArray(value)?value:[];
const date=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=8640000000000000?value:null;
const ref=value=>typeof value==='string'&&value.length?value:null;
export const optionalStoryAction=g=>['analysis','unlocked'].includes(g.code);
export const storyObjective=(context,g)=>optionalStoryAction(g)?`${destinationInfo(context)?.name??'選択した目的地'}への航行`:g.title;
export function storySteps(context,g){return g.code==='launch'?[context.launchMode==='slingshot'?'ロケット付近を引き、予測を確認して指を離します。元へ戻すとキャンセルできます。':'調整した予測を確認し、LAUNCHを押します。']:g.steps;}
export function storyHints(context,g=missionGuide(context)){
 const screen=g.selector==='#flightRate'?'航行速度':g.selector==='#scanButton'?'SCAN':g.selector==='#openDestinations'||g.selector==='#openHomeward'?'HOMEWARDの目的地画面':g.selector?.includes('retry')?'航行結果の再調整':g.selector==='#nextStage'?'到達後の操作':g.code==='tutorial'?'表示中の操作ガイド':'航行画面';
 const action=storySteps(context,g).join(' → ');
 return [`${screen}を確認しましょう。`,`${g.title}。${g.description}`,action];
}
export function storyNavigation(context){
 if(context.playType!=='homeward')return null;
 const p=context.progress??{},clues=p.echoes?.clues??{},known=id=>Boolean(clues[id]),entries=[],chapters=[],scan=scanObjects(context),g=missionGuide(context);
 const push=e=>entries.push({at:null,record:null,target:null,...e,order:entries.length});
 const cleared=[...new Set(list(p.cleared).filter(id=>HOMEWARD_SECTORS.some(s=>s.id===id)))],seen=list(p.eventsSeen);
 for(const sector of HOMEWARD_SECTORS){
  const entry=p.journal?.[sector.id],current=p.currentSector===sector.id,done=cleared.includes(sector.id),entered=Boolean(entry)||seen.includes(`${sector.id}:enter`)||done||current;
  if(!entered)continue;
  chapters.push({id:sector.id,title:`${sector.number} ${sector.name}`,state:done?'完了':current?'現在の章':'到達済み'});
  if(done&&!entry)push({id:'sector:'+sector.id,title:`${sector.number} ${sector.name}`,label:'完了',text:'この宙域を通過した記録があります。個別の通信・発生日時は保存されていません。'});
  for(const [key,label]of [['departure','出航'],['encounter','遭遇'],['discovery','発見'],['choiceLog','判断'],['arrival','到着']])if(typeof entry?.[key]==='string'&&entry[key]){
   const unconfirmed=key==='encounter'&&!list(entry.encounters).length;
   push({id:`${sector.id}:${key}`,title:`${sector.number} ${unconfirmed?'宙域の説明':label}`,label:unconfirmed?'確認待ち':'記録',text:unconfirmed?`保存されている宙域説明です。遭遇の達成は未確認：${entry[key]}`:entry[key],record:ref(entry.importantFlightId??entry.clearFlightId??entry.flightId)});
  }
 }
 const addTarget=(t,e,area)=>{
  if(!['DETECTED','INVESTIGATED'].includes(e?.state))return;
  const surveyed=e.state==='INVESTIGATED',name=surveyed?t.name:`未解析の信号 ${t.id}`,id='destination:'+(t.destination??t.id);
  const row=scan.find(o=>o.id===id),same=area==='frontier'?context.stage.openVoyage:context.stage.deepSpace;
  push({id:area+':'+t.id,title:name,label:surveyed?'調査済み':'確認待ち',text:surveyed?(typeof e.information==='string'?e.information:t.information):'反応を検出しています。正体は未確認です。調査するか、現在の航路を続けるか選べます。',at:date(surveyed?e.investigatedAt:e.firstDetectedAt),record:ref(surveyed?e.investigatedFlightId:e.detectedFlightId),target:same&&row?id:null});
 };
 for(const t of FRONTIER_TARGETS)addTarget(t,p.frontier?.targets?.[t.id],'frontier');
 for(const t of DEEP_TARGETS)addTarget(t,p.deep?.targets?.[t.id],'deep');
 for(const c of ECHO_CLUES)if(known(c.id)){
  const e=clues[c.id],related=list(c.related).filter(known);
  push({id:c.id,title:`${c.id} ${c.name}`,label:'手掛かり',text:c.text+(related.length?` 関連：${related.join('・')}`:''),at:date(e.at),record:ref(p.echoes?.records?.[c.id]??e.flightId)});
 }
 const allowedEvent=id=>known(id)||id==='match-pattern'&&known('CLUE-01')&&known('CLUE-02')||id==='match-vessel'&&known('CLUE-01')&&known('CLUE-03')||['impossible-approach','impossible-result-investigate','impossible-result-avoid','impossible-result-observe'].includes(id)&&known('CLUE-08')||id==='impossible-ending'&&known('CLUE-09');
 for(const e of list(p.echoes?.events))if(allowedEvent(e?.id)&&typeof e.message==='string')push({id:'event:'+e.id,title:'通信・照合',label:'記録',text:e.message,at:date(e.at),record:ref(p.echoes?.records?.[e.id])});
 const decisions={return:'帰還を優先',follow:'信号を追跡',explore:'追加調査',investigate:'詳細調査',avoid:'帰還を優先',observe:'距離を保って観測',direct:'帰還を優先',safe:'安全重視',home:'帰還を優先',rescue:'救難',truth:'真相を調査',other:'異常を調査',continue:'探索を続行'};
 for(const [source,choices]of [['route',p.echoes?.choices],['anomaly',known('CLUE-08')?p.echoes?.impossible?.choices:[]],['deep',p.deep?.choices],['final',p.finalVoyage?.choices]])for(const [i,e]of list(choices).entries())if(e&&decisions[e.choice??e.policy??e.decision])push({id:`choice:${source}:${i}`,title:'航行判断',label:'判断',text:decisions[e.choice??e.policy??e.decision],at:date(e.at)});
 const final=p.finalVoyage??{},finalReached=list(final.chapters);
 for(const c of FINAL_CHAPTERS)if(finalReached.includes(c.id))chapters.push({id:'final:'+c.id,title:c.title,state:c.id===Math.max(...finalReached)?'現在の段階':'到達済み'});
 for(const e of list(final.communications))if(e&&typeof e.id==='string'&&finalReached.includes(e.chapter)&&typeof e.message==='string'&&(!e.id.startsWith('ending:')||date(final.endings?.[e.id.slice(7)]?.firstAt)!==null))push({id:'final-event:'+e.id,title:typeof e.title==='string'?e.title:'最終章の通信',label:'記録',text:e.message,at:date(e.at),record:ref(final.records?.[e.destination])});
 for(const ending of ENDINGS){const e=final.endings?.[ending.id];if(e&&date(e.firstAt)!==null)push({id:ending.id,title:ending.title,label:'到達済み',text:ending.communication+' '+ending.text,at:date(e.firstAt),record:ref(e.flightId)});}
 const mysteries=[];
 if(known('CLUE-01')&&!known('CLUE-04'))mysteries.push('回収した通信の発信元は、まだ特定できていません。');
 if(known('CLUE-04')&&!known('CLUE-05'))mysteries.push('特定した信号地点の通信内容は、まだ確認していません。');
 if(known('CLUE-05')&&!known('CLUE-06'))mysteries.push('識別列の一致は偶然か、記録の破損か、まだ不明です。');
 if(known('CLUE-06')&&!known('CLUE-07'))mysteries.push('同じ識別番号が含まれる理由は不明です。通信記録を解析できます。');
 if(known('CLUE-07')&&!final.networkRead)mysteries.push('72時間先を示す通信と観測の食い違いは、まだ説明できていません。');
 if(known('CLUE-09')&&!final.networkRead)mysteries.push('途絶えた通信が警告か救難か、発信元の船体も確認できていません。');
 for(const [i,text]of mysteries.entries())push({id:'mystery:'+i,title:'未解決の謎',label:'謎',text});
 const current=chapters.find(c=>c.id===p.currentSector)?.title??'HOMEWARD',achieved=entries.filter(e=>e.label!=='謎');
 const recent=[...achieved].sort((a,b)=>(b.at??-1)-(a.at??-1)||b.order-a.order)[0];
 const recap=[];if(p.openingSeen)recap.push('故郷への帰還航路を探しています。');if(known('CLUE-01'))recap.push('古い通信断片を回収しました。');if(known('CLUE-01')&&known('CLUE-02'))recap.push('別の場所でも同じ信号を観測しました。');if(known('CLUE-03'))recap.push('帰着しなかった調査船の記録が見つかりました。');if(known('CLUE-06'))recap.push('信号の識別番号は本船と一致しました。');if(known('CLUE-07'))recap.push('通信時刻は72時間先を示しています。');if(known('CLUE-09'))recap.push('追加通信は途中で途絶えました。');if(final.networkRead)recap.push('観測網の転送についての記録を得ました。');
 const summary=[recap.slice(-3).join(''),cleared.length?`通過した宙域：${cleared.length}。`:'帰還の旅は、ここから始まります。',recent?`${recent.at!==null?'保存されている最近の記録':'保存順で最後の記録'}：${recent.title}。`:'個別の出来事はまだ記録されていません。'].join('');
 return {current,summary,chapters,entries,objective:storyObjective(context,g),next:storySteps(context,g)[0],nextOptional:optionalStoryAction(g),completed:g.code==='arrived'||g.code==='ending',optional:context.stage.openVoyage||context.stage.deepSpace||context.stage.finalVoyage?'寄り道・再調査は任意です。帰還を優先する航路も選べます。':null,hints:storyHints(context,g)};
}
export function sortedStoryEntries(entries,oldest=false){return [...entries].sort((a,b)=>a.at===null&&b.at!==null?1:a.at!==null&&b.at===null?-1:a.at!==null?(oldest?a.at-b.at:b.at-a.at)||(oldest?a.order-b.order:b.order-a.order):oldest?a.order-b.order:b.order-a.order);}
export function storyLocation(context,entryId){const item=storyNavigation(context)?.entries.find(e=>e.id===entryId);return item?.target??null;}
