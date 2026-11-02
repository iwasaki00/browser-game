export const BEGINNER_KEY='orbit-maker.beginner.v1';
export function practiceSession(provider=globalThis.crypto){
 if(provider?.randomUUID)return provider.randomUUID();
 if(provider?.getRandomValues)return Array.from(provider.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
 return `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export class PracticeStorage {
 constructor(){this.values=new Map();}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,String(value));}
 removeItem(key){this.values.delete(key);}
}
export const BEGINNER_STEPS=[
 {title:'ロケットを発射しよう',text:'LAUNCHを押して、ロケットを飛ばしましょう。',hint:'下の青いLAUNCHボタンです。実際に発射すると成功です。'},
 {title:'角度と推力を調整しよう',text:'ANGLEは方向、THRUSTは勢いです。両方を変えて再発射しましょう。',hint:'飛行中ならRESET。ANGLEとTHRUSTをそれぞれ少し変えてからLAUNCHを押します。'},
 {title:'重力で曲がる航路を見よう',text:'予測線を確認して発射。惑星の近くで曲がる様子を見ましょう。',hint:'「予測線を確認した」を押し、LAUNCH。練習用の初期設定で重力による旋回を体験できます。'},
 {title:'惑星を動かそう',text:'惑星を選んでドラッグ。予測線が変わる様子を見ましょう。',hint:'光る惑星を少し横へ動かします。予測の再計算後に「変化を確認した」を押してください。'},
 {title:'SPACE SCANNERを使おう',text:'SCANを開き、対象を選んで説明を確認しましょう。',hint:'SCAN→「惑星を探す」、または「対象」の一覧から選びます。表示された名前と説明を読みましょう。'},
 {title:'HOMEWARDを体験しよう',text:'故郷から遠く離れた宇宙船。重力を借りて帰還する短い練習です。',hint:'方針と行き先を選び、予測を見て発射。探索ログを確認し、選んだゲートへ到達します。本編は進みません。'},
];
export function normalizeBeginner(raw){
 const steps=Array.from({length:6},(_,i)=>['success','skipped'].includes(raw?.steps?.[i])?raw.steps[i]:'pending');
 return {version:1,offered:raw?.offered===true,active:raw?.active===true,current:Math.max(0,Math.min(5,Number.isInteger(raw?.current)?raw.current:0)),steps,completed:steps.every(s=>s==='success'),finished:steps.every(s=>s!=='pending'),everCompleted:raw?.everCompleted===true||steps.every(s=>s==='success')};
}
export class BeginnerProgress {
 constructor(storage){this.storage=storage;this.notice='';try{this.state=normalizeBeginner(JSON.parse(storage?.getItem(BEGINNER_KEY)??'null'));}catch{this.state=normalizeBeginner();}}
 commit(patch){this.state=normalizeBeginner({...this.state,...patch});try{if(!this.storage?.setItem)throw Error('unavailable');this.storage.setItem(BEGINNER_KEY,JSON.stringify(this.state));this.notice='';}catch{this.notice='練習の進行を保存できません。練習は続けられます。';}return this.state;}
 start(restart=false){return this.commit(restart?{...normalizeBeginner(),offered:true,active:true,everCompleted:this.state.everCompleted}:{offered:true,active:true});}
 later(){return this.commit({offered:true,active:false});}
 result(status){if(!['success','skipped','pending'].includes(status))return;const steps=[...this.state.steps];steps[this.state.current]=status;return this.commit({steps});}
 next(){if(this.state.steps[this.state.current]==='pending')return false;if(this.state.current===5){this.commit({active:false});return false;}this.commit({current:this.state.current+1});return true;}
}
export function freshEvidence(){return {launched:false,angle:false,thrust:false,preview:false,turn:false,selected:false,moved:false,prediction:false,scan:false,info:false,policy:false,destination:false,station:false,log:false,cleared:false,phase:'editing'};}
export function tutorialSucceeded(step,e){return [e.launched,e.angle&&e.thrust&&e.launched,e.preview&&e.launched&&e.turn,e.selected&&e.moved&&e.prediction&&e.preview,e.scan&&e.info,e.policy&&e.destination&&e.launched&&e.station&&e.log&&e.cleared][step]===true;}
export function tutorialFocus(step,e){
 if(step===0)return 'launch';
 if(step===1)return e.phase!=='editing'?'reset':!e.angle?'angle':!e.thrust?'speed':'launch';
 if(step===2)return !e.preview?'confirm':e.phase==='editing'?'launch':e.phase==='flying'?'canvas':'reset';
 if(step===3)return e.infoOpen?'scanCollapse':!e.selected||!e.moved?'planet':e.prediction?'confirm':'planet';
 if(step===4)return !e.scan?'scan':'scanTargets';
 return !e.policy?'policy':!e.destination?'destination':e.station&&!e.log?'confirm':e.phase==='editing'?'launch':e.phase==='flying'?'canvas':e.cleared?'confirm':'reset';
}
