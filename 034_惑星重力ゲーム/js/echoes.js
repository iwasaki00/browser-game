// Narrative projection only: never changes a simulation, launch input or force.
import {IMPOSSIBLE_CLUES} from './impossible-signal.js';
export const ECHO_CLUES=[
 {id:'CLUE-01',source:'D01',name:'破損した通信記録',text:'雑音の奥に、三つの短い呼出音。発信元も言葉も失われている。'},
 {id:'CLUE-02',source:'D03',name:'一致する信号パターン',text:'惑星の重力境界で、通信断片と同じ間隔の反応を観測した。'},
 {id:'CLUE-03',source:'D04',name:'失われた航海記録',text:'寄港台帳には、帰着しなかった調査船「イサリ」の記録がある。最後の通信時刻だけが空白だ。'},
 {id:'CLUE-04',name:'救難信号の発信源',text:'三つの記録が、一つの方位で重なる。消えた調査船の救難信号かもしれない。'},
 {id:'CLUE-05',name:'未解明の識別信号',text:'受信した識別列の一部が、私たちの船の認証列と一致する。しかし、この記録は私たちの出航より古い。偶然か、破損か。解析は続く。'},
 ...IMPOSSIBLE_CLUES,
];
export const ECHO_ROUTES=[{id:'return',label:'RETURN HOME · 帰還を優先'},{id:'follow',label:'FOLLOW SIGNAL · 信号を追跡'},{id:'explore',label:'CONTINUE EXPLORATION · 追加調査'}];
export const SIGNAL_ID='echo-signal';
export function normalizeEchoes(raw){return {...raw,version:1,clues:{...raw?.clues},events:Array.isArray(raw?.events)?raw.events.filter(e=>e&&typeof e.id==='string'):[],choices:Array.isArray(raw?.choices)?raw.choices.filter(e=>e&&ECHO_ROUTES.some(r=>r.id===e.choice)):[],records:{...raw?.records}};}
export const signalUnlocked=raw=>Boolean(raw?.clues?.['CLUE-01']&&raw?.clues?.['CLUE-02']&&raw?.clues?.['CLUE-03']);
export function resolveEchoes(raw,frontier,voyage,{now=()=>Date.now(),elapsed=0,arrival=false,restoring=false}={}){
 const story=normalizeEchoes(raw),events=[];
 const addEvent=(id,message,destination)=>{if(story.events.some(e=>e.id===id))return;const event={id,message,destination,at:restoring?null:now(),elapsed};story.events.push(event);events.push(event);};
 for(const clue of ECHO_CLUES.filter(c=>c.source))if(frontier?.targets?.[clue.source]?.state==='INVESTIGATED'&&!story.clues[clue.id]){
  const source=frontier.targets[clue.source];story.clues[clue.id]={id:clue.id,at:source.investigatedAt??null,source:clue.source,...(source.investigatedFlightId?{flightId:source.investigatedFlightId}:{})};
  addEvent(clue.id,clue.id==='CLUE-01'?'SIGNAL DETECTED · 古い通信断片を回収':clue.id==='CLUE-02'?'DATA MATCH · 同じ間隔の信号を観測':'ARCHIVE FOUND · 帰着しなかった調査船の記録',clue.source==='D01'?'probe':clue.source==='D03'?'planet':'station');
 }
 if(story.clues['CLUE-01']&&story.clues['CLUE-02'])addEvent('match-pattern','DATA MATCH · 二つの場所に、同じ信号パターン','planet');
 if(story.clues['CLUE-01']&&story.clues['CLUE-03'])addEvent('match-vessel','DATA MATCH · 通信断片は、消えた調査船と関連する可能性','station');
 if(signalUnlocked(story)){
  if(!story.clues['CLUE-04'])story.clues['CLUE-04']={id:'CLUE-04',at:restoring?null:now()};
  addEvent('CLUE-04','NEW DESTINATION · 救難信号の発信源を特定',SIGNAL_ID);
  if((arrival||voyage?.visited?.includes(SIGNAL_ID))&&!story.clues['CLUE-05']){
   story.clues['CLUE-05']={id:'CLUE-05',at:restoring?null:now()};addEvent('CLUE-05','UNKNOWN IDENTITY · 識別信号が一致。しかし、この記録は……',SIGNAL_ID);
  }
 }
 return {story,events};
}
export function storyRouteDestination(raw,frontier,choice){
 if(choice==='return')return 'gate';
 if(choice==='follow')return signalUnlocked(raw)?SIGNAL_ID:null;
 if(choice!=='explore')return null;
 const entries=[['D01','probe'],['D03','planet'],['D04','station'],['D05','anomaly'],['D02','rescue']];
 return entries.find(([id])=>frontier?.targets?.[id]?.state==='DETECTED')?.[1]??entries.find(([id])=>frontier?.targets?.[id]?.state==='INVESTIGATED')?.[1]??null;
}
