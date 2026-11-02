import {BeginnerProgress,BEGINNER_STEPS,freshEvidence,tutorialSucceeded,tutorialFocus,practiceSession} from './beginner-tutorial.js';
const POLICY={direct:'最短帰還',safe:'安全重視',explore:'探索重視'};
export function createBeginnerTutorial({storage,onOpen=()=>{}}){
 const $=s=>document.querySelector(s),progress=new BeginnerProgress(storage),offer=$('#beginnerOffer'),dialog=$('#beginnerDialog');
 let iframe=null,session='',epoch=0,e=freshEvidence(),ready=false,key='',lastFocus='',hint=false,policy='',destination='',previewReady=false;
 function command(data){iframe?.contentWindow?.postMessage({kind:'orbit-beginner-command',session,epoch,...data},location.origin);}
 function configure(){epoch++;e=freshEvidence();e.policy=Boolean(policy);e.destination=Boolean(destination);previewReady=false;key='';lastFocus='';command({action:'configure',step:progress.state.current,destination:destination||'gate'});render();}
 function dispose(){iframe?.remove();iframe=null;ready=false;}
 function finish(){progress.later();dispose();dialog.close();}
 function open(restart=false){
  onOpen();offer.close();progress.start(restart);hint=false;policy='';destination='';ready=false;epoch=0;key='';
  $('#beginnerPolicy').value='';$('#beginnerDestination').value='';$('#beginnerFlow').open=true;
  session=practiceSession();iframe=document.createElement('iframe');iframe.id='beginnerFrame';iframe.title='本編から独立した操作練習';iframe.src=`./index.html?practice=beginner&session=${encodeURIComponent(session)}`;iframe.setAttribute('allow','');
  $('#beginnerSpace').replaceChildren(iframe);dialog.showModal();render();
 }
 function showOffer(){
  $('#beginnerOfferText').textContent=progress.state.everCompleted?'もう一度、基本操作を練習できます。':progress.state.active||progress.state.current>0?'保存したSTEPの開始状態から続けられます。':'実際に操作しながら、発射・重力・探索を練習できます。本編の進行は変わりません。';
  $('#beginnerStart').textContent=progress.state.everCompleted?'もう一度練習する':progress.state.current>0?'続きから練習する':'チュートリアルを始める';
  $('#beginnerRestartAll').hidden=!progress.state.current&&!progress.state.finished;
  onOpen();offer.showModal();
 }
 function render(){
  const s=progress.state,step=s.current,done=s.steps[step]==='success',skipped=s.steps[step]==='skipped',focus=done||skipped?'next':tutorialFocus(step,e);
  const nextKey=JSON.stringify([s,focus,hint,ready,previewReady,e.prediction,e.station,e.log,policy,destination,progress.notice]);if(key===nextKey)return;key=nextKey;
  dialog.dataset.step=String(step+1);dialog.dataset.result=s.steps[step];
  $('#beginnerTitle').textContent=`STEP ${step+1}/6 · ${BEGINNER_STEPS[step].title}`;$('#beginnerText').textContent=step===3&&e.infoOpen?'情報が開きました。「たたむ」で戻り、惑星をドラッグしましょう。':BEGINNER_STEPS[step].text;
  $('#beginnerHintText').hidden=!hint;$('#beginnerHintText').textContent=BEGINNER_STEPS[step].hint;
  $('#beginnerHint').setAttribute('aria-expanded',String(hint));
  $('#beginnerSuccess').textContent=done?['✓ 発射成功！','✓ 角度・推力を変えて再発射！','✓ 本物の重力で航路が曲がりました！','✓ 惑星と予測航路が変わりました！','✓ 対象の説明を確認しました！','✓ 帰還航行と探索を体験しました！'][step]:skipped?'このSTEPはスキップ済みです。成功として記録していません。':!ready?'練習宙域を準備しています…':'';
  $('#beginnerNext').disabled=!(done||skipped);$('#beginnerNext').textContent=step===5?'練習を終了':'次のSTEP';
  $('#beginnerAgain').disabled=!ready;$('#beginnerNotice').textContent=progress.notice;
  $('#beginnerFlow').hidden=step!==5;
  const confirm=$('#beginnerConfirm');confirm.hidden=![2,3,5].includes(step)||done;
  confirm.textContent=step===2?'予測線を確認した':step===3?'予測の変化を確認した':'受信した探索ログを確認';
  confirm.disabled=!ready||(step===2?!previewReady:step===3?!e.prediction:!e.station);
  if(step===5){$('#beginnerPolicy').disabled=$('#beginnerDestination').disabled=e.phase==='flying';$('#beginnerLog').hidden=!e.log;$('#beginnerLog').textContent='練習ステーション：帰還する船の航路を観測しました。これは練習専用の通信です。';}
  for(const [id,kind]of [['beginnerConfirm','confirm'],['beginnerPolicy','policy'],['beginnerDestination','destination'],['beginnerNext','next']])$('#'+id).classList.toggle('beginner-target',focus===kind);
  if(focus!==lastFocus){lastFocus=focus;command({action:'focus',focus});}
 }
 function evaluate(){if(progress.state.steps[progress.state.current]==='pending'&&tutorialSucceeded(progress.state.current,e))progress.result('success');render();}
 window.addEventListener('message',event=>{
  const m=event.data;if(!iframe||event.source!==iframe.contentWindow||event.origin!==location.origin||m?.kind!=='orbit-beginner'||m.session!==session)return;
  if(m.event==='ready'){ready=true;configure();return;}if(m.epoch!==epoch)return;
  const step=progress.state.current;
  if(m.event==='snapshot'){
   const d=m.data;e.phase=d.phase;e.infoOpen=d.infoOpen;previewReady=d.previewReady;e.scan=e.scan||d.scan;
   if(step===1){e.angle=e.angle||d.angle!==-55;e.thrust=e.thrust||d.speed!==170;}
   if(step===3){e.selected=e.selected||d.selected;e.moved=e.moved||d.moved;e.prediction=e.prediction||d.moved&&d.predictionChanged&&d.previewReady;}
   e.cleared=e.cleared||d.cleared;
  }
  if(m.event==='launch'){if(step===1){e.angle=e.angle||m.angle!==-55;e.thrust=e.thrust||m.speed!==170;e.launched=m.angle!==-55&&m.speed!==170;}else e.launched=true;}
  if(m.event==='gravity'&&m.degrees>=5)e.turn=true;
  if(m.event==='station')e.station=true;
  if(m.event==='inspection'&&m.id)e.info=true;
  if(m.event==='interrupted')command({action:'cancel'});
  evaluate();
 });
 $('#startBeginner').addEventListener('click',showOffer);
 $('#beginnerStart').addEventListener('click',()=>open(progress.state.everCompleted));
 $('#beginnerRestartAll').addEventListener('click',()=>open(true));
 $('#beginnerLater').addEventListener('click',()=>{progress.later();offer.close();});
 offer.addEventListener('cancel',()=>progress.later());
 $('#beginnerExit').addEventListener('click',finish);
 dialog.addEventListener('close',()=>{dispose();progress.later();});
 dialog.addEventListener('cancel',()=>progress.later());
 $('#beginnerHint').addEventListener('click',()=>{hint=!hint;render();});
 $('#beginnerAgain').addEventListener('click',()=>{progress.result('pending');hint=false;policy='';destination='';$('#beginnerPolicy').value='';$('#beginnerDestination').value='';$('#beginnerFlow').open=true;configure();});
 const advance=()=>{if(progress.next()){hint=false;policy='';destination='';$('#beginnerPolicy').value='';$('#beginnerDestination').value='';configure();}else finish();};
 $('#beginnerNext').addEventListener('click',()=>{if(progress.state.steps[progress.state.current]!=='pending')advance();});
 $('#beginnerSkip').addEventListener('click',()=>{if(progress.state.steps[progress.state.current]==='pending')progress.result('skipped');advance();});
 $('#beginnerConfirm').addEventListener('click',()=>{if($('#beginnerConfirm').disabled)return;if(progress.state.current===5)e.log=true;else e.preview=true;evaluate();});
 for(const id of ['beginnerPolicy','beginnerDestination'])$('#'+id).addEventListener('change',()=>{
  policy=$('#beginnerPolicy').value;destination=$('#beginnerDestination').value;if(!POLICY[policy])policy='';if(!['gate','signal'].includes(destination))destination='';
  configure();if(policy&&destination)$('#beginnerFlow').open=false;
 });
 let existing=false;try{existing=Boolean(storage?.getItem('orbit-maker.homeward.v1')||storage?.getItem('orbit-maker.stage-progress.v1'));}catch{existing=true;}
 if(progress.state.active||!progress.state.offered&&!existing)queueMicrotask(showOffer);
 return {isOpen:()=>dialog.open||offer.open,guide:()=>dialog.open?{title:`STEP ${progress.state.current+1} · ${BEGINNER_STEPS[progress.state.current].title}`,text:BEGINNER_STEPS[progress.state.current].text,selector:'#beginnerDialog'}:null};
}
