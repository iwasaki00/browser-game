import {insideInterval} from './frontier.js';
export const TEMPORAL_SITE={id:'temporal-anomaly',x:2200,y:800,radius:80,approachRadius:600,investigateRadius:150,observeInner:220,observeOuter:500,observeSeconds:1};
export const TRANSMISSION_OFFSET_HOURS=72;
export const SHIP_ID='HN-0417';
export const IMPOSSIBLE_CLUES=[
 {id:'CLUE-06',name:'本船と一致する識別番号',text:'識別番号 HN-0417 が本船と一致。発信元の船体は確認できない。記録の誤りも排除できない。',condition:'CLUE-05取得後、識別番号を解析',related:['CLUE-05'],unlocks:['通信時刻の解析']},
 {id:'CLUE-07',name:'未来の送信日時',text:'送信時刻は航行基準時より72時間先を示す。時計の誤差か、破損か、まだ判断できない。',condition:'CLUE-06取得後、送信時刻を解析',related:['CLUE-05','CLUE-06'],unlocks:['信号座標の照合']},
 {id:'CLUE-08',name:'時空異常の座標情報',text:'通信と識別列から、一つの反応地点を特定した。時空異常という解釈は仮説にすぎない。',condition:'CLUE-06と07の照合',related:['CLUE-06','CLUE-07'],unlocks:['UNKNOWN ANOMALY']},
 {id:'CLUE-09',name:'異常領域からの追加通信',text:'識別番号と未来の時刻は一致する。しかし発信元の宇宙船は見えない。「こちらは……」「応答を……」「まだ、そこへ行くな……」。通信は途絶えた。警告か救難かは不明。',condition:'INVESTIGATEで150以内、またはOBSERVEで220〜500以内に連続1航行秒',related:['CLUE-05','CLUE-06','CLUE-07','CLUE-08'],unlocks:['追加通信と調査結果の日誌']},
];
export const IMPOSSIBLE_ACTIONS=[{id:'investigate',label:'INVESTIGATE · 詳細調査'},{id:'avoid',label:'AVOID · 帰還を優先'},{id:'observe',label:'OBSERVE · 距離を保って観測'}];
export function impossibleState(raw){const s=raw?.impossible,received=Boolean(raw?.clues?.['CLUE-09']);return {...s,analysis:{...s?.analysis},choices:Array.isArray(s?.choices)?s.choices.filter(c=>c&&IMPOSSIBLE_ACTIONS.some(a=>a.id===c.choice)).map(c=>({...c})):[],tracking:Math.max(0,Number.isFinite(s?.tracking)?s.tracking:0),approached:s?.approached===true||received,investigated:s?.investigated===true||received};}
export const temporalUnlocked=story=>Boolean(story?.clues?.['CLUE-08']);
// Date.now is metadata only. Distances and durations use simulation state.
export function resolveImpossible(raw,{analysis=null,previous,next,now=()=>Date.now(),restoring=false}={}){
 const story={...raw,clues:{...raw?.clues},events:[...(raw?.events??[])],records:{...raw?.records}},episode=impossibleState(story),events=[];let changed=false;story.impossible=episode;
 const elapsed=next?.elapsed??0;
 const event=(id,message,destination=TEMPORAL_SITE.id)=>{if(story.events.some(e=>e.id===id))return;const e={id,message,destination,at:restoring?null:now(),elapsed};story.events.push(e);events.push(e);changed=true;};
 const clue=(id,message)=>{if(story.clues[id])return;const d=IMPOSSIBLE_CLUES.find(c=>c.id===id),source=story.records['CLUE-05']??story.clues['CLUE-05']?.flightId;story.clues[id]={id,at:restoring?null:now(),related:d.related,unlocks:d.unlocks,...(source?{flightId:source}:{})};event(id,message);changed=true;};
 if(story.clues['CLUE-05']){
  if(analysis==='identity')episode.analysis.identity=true;
  if(analysis==='timestamp'&&story.clues['CLUE-06'])episode.analysis.timestamp=true;
  if(episode.analysis.identity)clue('CLUE-06',`IDENTITY MATCH · 識別番号 ${SHIP_ID} は本船と同一。記録に矛盾`);
  if(story.clues['CLUE-06']&&episode.analysis.timestamp)clue('CLUE-07','TEMPORAL ERROR · 送信時刻は基準時より72時間先。整合性を確認できません');
  if(story.clues['CLUE-06']&&story.clues['CLUE-07'])clue('CLUE-08','NEW COORDINATES · UNKNOWN ANOMALYの反応座標を特定');
 }
 if(!previous||!next||!temporalUnlocked(story))return {story,events,changed};
 const a={x:previous.rocket.position.x-TEMPORAL_SITE.x,y:previous.rocket.position.y-TEMPORAL_SITE.y},b={x:next.rocket.position.x-TEMPORAL_SITE.x,y:next.rocket.position.y-TEMPORAL_SITE.y},dt=Math.max(0,next.elapsed-previous.elapsed);
 if(insideInterval(a,b,TEMPORAL_SITE.approachRadius)&&!episode.approached){episode.approached=true;changed=true;event('impossible-approach','SIGNAL RISING · 本船の識別信号を検出。発信時刻は依然として未来');}
 const choice=episode.choices.at(-1);if(!choice||choice.result!=='pending')return {story,events,changed};
 const close=insideInterval(a,b,TEMPORAL_SITE.investigateRadius);if(close&&!choice.enteredInner){choice.enteredInner=true;changed=true;}
 const finish=(result,message,receive=false)=>{choice.result=result;choice.completedAt=now();choice.elapsed=next.elapsed;changed=true;event('impossible-result-'+choice.choice,message,choice.choice==='avoid'?'gate':TEMPORAL_SITE.id);if(receive){episode.investigated=true;clue('CLUE-09','ADDITIONAL SIGNAL · 識別番号も未来の時刻も一致。発信元の宇宙船は確認できません');event('impossible-ending','SIGNAL LOST · 「こちらは……」「応答を……」「まだ、そこへ行くな……」');}};
 if(choice.choice==='investigate'&&close)finish('investigated','調査結果 · 内側で追加通信を受信。時空異常という仮説は未確定',true);
 if(choice.choice==='avoid'&&next.status==='cleared'&&next.goal.id==='gate')finish(choice.enteredInner?'returned-after-approach':'returned','判断結果 · 帰還を優先。取得情報を保持し、調査は後から再開できます');
 if(choice.choice==='observe'){
  const outer=insideInterval(a,b,TEMPORAL_SITE.observeOuter),inner=insideInterval(a,b,TEMPORAL_SITE.observeInner),parts=[];
  if(outer){if(!inner)parts.push(outer);else{if(outer[0]<inner[0])parts.push([outer[0],Math.min(outer[1],inner[0])]);if(inner[1]<outer[1])parts.push([Math.max(outer[0],inner[1]),outer[1]]);}}
  let cursor=0;for(const [lo,hi]of parts){if(lo>cursor+1e-10)episode.tracking=0;episode.tracking+=dt*(hi-lo);cursor=hi;if(episode.tracking+1e-10>=TEMPORAL_SITE.observeSeconds){finish('observed','観測結果 · 外側の距離を1秒保ち、追加通信を受信。自動操船は行っていません',true);break;}}
  if(cursor<1-1e-10||!parts.length)episode.tracking=0;
 }
 return {story,events,changed};
}
// Three rings and a small waveform only. No force/collision object.
export function drawImpossible(ctx,story,time,scale,quality='standard'){if(!temporalUnlocked(story))return;ctx.save();ctx.translate(TEMPORAL_SITE.x,TEMPORAL_SITE.y);ctx.strokeStyle='#a7a2ed';ctx.lineWidth=1.2/scale;for(let i=0;i<(quality==='light'?1:3);i++){ctx.globalAlpha=.16+.12*Math.sin(time*.001+i)**2;ctx.beginPath();ctx.ellipse(0,0,90+i*45,55+i*30,time*.00008+i,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=.65;ctx.beginPath();for(let i=0;i<=24;i++){const x=-100+i*200/24,y=Math.sin(i*.85+time*.003)*8;(i?ctx.lineTo(x,y):ctx.moveTo(x,y));}ctx.stroke();ctx.restore();}
