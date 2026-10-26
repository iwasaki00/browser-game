// Manual mobile QA is session-only. It does not use the legacy BENCH gap filter.
export const MOBILE_TEST=Object.freeze({warmupMs:1000,durationMs:30000,histogramStepMs:.25,maxContinuousGapMs:2000,historyLimit:8});
export const MOBILE_STATUS=Object.freeze({ARMED:'ゲーム再開待ち',WARMUP:'準備中（1秒）',RECORDING:'30秒計測中',COMPLETE:'計測完了',INTERRUPTED:'中断あり',INVALID:'無効'});
const terminal=s=>['COMPLETE','INTERRUPTED','INVALID'].includes(s);
export class MobilePlaytest {
  constructor(){this.run=null;this.history=[];this.serial=0;this.bins=new Uint32Array(MOBILE_TEST.maxContinuousGapMs/MOBILE_TEST.histogramStepMs+1);this.seconds=new Uint32Array(32)}
  get active(){return !!this.run&&!terminal(this.run.status)}
  start(metadata,startedAt=new Date().toISOString()){
    if(this.active)this.interrupt('再計測を開始したため終了');
    this.bins.fill(0);this.seconds.fill(0);
    this.run={id:++this.serial,startedAt,metadata:JSON.parse(JSON.stringify(metadata)),status:'ARMED',reason:'LABを閉じ、ゲーム更新・描画と前景復帰を待っています',last:null,warmupStart:null,recordStart:null,
      samples:0,durationMs:0,updateMs:0,drawMs:0,maxFrameMs:0,maxEnemies:0,maxShots:0,maxEffects:0,interruptions:0,warmupFrames:0,unclassifiedGapMs:null};
    return this.snapshot();
  }
  interrupt(reason='ゲーム操作による中断'){
    if(!this.active)return false;this.run.interruptions++;this.finish('INTERRUPTED',reason);return true;
  }
  record(ts,updateMs,drawMs,counts={},active=true,reason='前景のゲーム更新・描画が停止'){
    if(!this.active)return false;const r=this.run;
    if(!active){if(r.status!=='ARMED')this.interrupt(reason);return false}
    if(!Number.isFinite(ts)||!Number.isFinite(updateMs)||!Number.isFinite(drawMs)||updateMs<0||drawMs<0){this.finish('INVALID','時刻またはCPU時間が不正');return true}
    if(r.last===null){r.last=r.warmupStart=ts;r.status='WARMUP';r.reason='実際のゲーム再開後1秒を除外';return false}
    const delta=ts-r.last;r.last=ts;if(delta<=0){this.finish('INVALID','RAF時刻が単調増加していません');return true}
    // A huge unsignalled gap could be an OS suspension OR a heavy frame. Retain
    // its exact size and invalidate the run; never quietly drop it and claim 30s.
    if(delta>MOBILE_TEST.maxContinuousGapMs){r.unclassifiedGapMs=delta;r.interruptions++;this.finish('INVALID',`${delta.toFixed(1)}msの長間隔：停止と高負荷を判別不能。間隔を記録し正常30秒として採用しません`);return true}
    if(r.status==='WARMUP'){
      r.warmupFrames++;if(ts-r.warmupStart<MOBILE_TEST.warmupMs-1e-6)return false;
      r.recordStart=ts;r.status='RECORDING';r.reason='可視・前景・ゲーム更新／描画中の連続RAFを記録';this.peaks(counts);return false;
    }
    r.samples++;r.durationMs=ts-r.recordStart;r.updateMs+=updateMs;r.drawMs+=drawMs;r.maxFrameMs=Math.max(r.maxFrameMs,delta);
    this.bins[Math.min(this.bins.length-1,Math.ceil(delta/MOBILE_TEST.histogramStepMs))]++;
    this.seconds[Math.min(this.seconds.length-1,Math.max(0,Math.floor((r.durationMs-1e-6)/1000)))]++;
    this.peaks(counts);
    if(r.durationMs>=MOBILE_TEST.durationMs-1e-6){this.finish('COMPLETE','中断なしの観測RAF計測完了（表示完了・GPU時間の測定ではありません）');return true}
    return false;
  }
  peaks(c){const r=this.run;for(const [key,source] of [['maxEnemies','enemies'],['maxShots','shots'],['maxEffects','effects']])r[key]=Math.max(r[key],Number.isFinite(c[source])?c[source]:0)}
  percentile(q){const r=this.run;if(!r?.samples)return null;const rank=Math.ceil(r.samples*q);let n=0;for(let i=0;i<this.bins.length;i++)if((n+=this.bins[i])>=rank)return i*MOBILE_TEST.histogramStepMs;return null}
  snapshot(){
    const r=this.run;if(!r)return null;
    const fullSeconds=Math.min(this.seconds.length,Math.floor((r.durationMs+1e-6)/1000));let minimum=null;
    for(let i=0;i<fullSeconds;i++)minimum=minimum===null?this.seconds[i]:Math.min(minimum,this.seconds[i]);
    return {id:r.id,startedAt:r.startedAt,metadata:JSON.parse(JSON.stringify(r.metadata)),status:r.status,statusLabel:MOBILE_STATUS[r.status],reason:r.reason,
      valid:r.status==='COMPLETE'&&r.samples>0&&r.durationMs>=MOBILE_TEST.durationMs-1e-6&&r.interruptions===0,targetDurationMs:MOBILE_TEST.durationMs,acceptedDurationMs:r.durationMs,remainingMs:Math.max(0,MOBILE_TEST.durationMs-r.durationMs),samples:r.samples,
      observedRafFps:r.samples?1000*r.samples/r.durationMs:null,minimumOneSecondFps:minimum,fullSecondWindows:fullSeconds,
      p50FrameMs:this.percentile(.5),p95FrameMs:this.percentile(.95),p99FrameMs:this.percentile(.99),maxFrameMs:r.samples?r.maxFrameMs:null,
      updateCpuMs:r.samples?r.updateMs/r.samples:null,drawCpuMs:r.samples?r.drawMs/r.samples:null,maxEnemies:r.maxEnemies,maxShots:r.maxShots,maxEffects:r.maxEffects,
      interruptions:r.interruptions,warmupFrames:r.warmupFrames,warmupMs:MOBILE_TEST.warmupMs,actualWarmupMs:r.recordStart===null?null:r.recordStart-r.warmupStart,unclassifiedGapMs:r.unclassifiedGapMs,histogramResolutionMs:MOBILE_TEST.histogramStepMs,
      normalProgressSaved:false,normalClearCertified:false};
  }
  finish(status,reason){if(!this.active)return;this.run.status=status;this.run.reason=reason;this.history.push(this.snapshot());if(this.history.length>MOBILE_TEST.historyLimit)this.history.shift()}
  result(id){return this.run?.id===Number(id)?this.snapshot():this.history.find(r=>r.id===Number(id))??null}
}

export const MOBILE_QA_ITEMS=Object.freeze([
  ['IP-01','起動・横画面表示'],['IP-02','移動＋ジャンプ＋射撃'],['IP-03','4兵科の特殊操作'],['IP-04','20武器・武器切替'],
  ['IP-05','M01〜M03の戦闘表示'],['IP-06','50体・100体の性能'],['IP-07','TEST LAB 200体'],['IP-08','音声・保存・復帰']
]);
export const createMobileQA=()=>Object.fromEntries(MOBILE_QA_ITEMS.map(([id])=>[id,{status:'未確認',note:''}]));
export function setMobileQA(qa,id,value,note=false){if(!Object.hasOwn(qa,id))return false;if(note)qa[id].note=String(value).slice(0,200);else if(['未確認','OK','NG'].includes(value))qa[id].status=value;else return false;return true}
const number=(n,digits=1)=>Number.isFinite(n)?n.toFixed(digits):'未計測';
export function mobileReportText(r,memo=''){
  if(!r)return '【ドット防衛戦線 実機性能レポート】\n未計測です。推定値は表示しません。';
  const m=r.metadata;return `【ドット防衛戦線 実機性能レポート】\nVersion：${m.version}\n環境：${m.environment||'未入力（実機環境を記入してください）'}\n開始日時：${r.startedAt}\nミッション：${m.missionId} AREA${m.area}\n兵科：${m.playerClass}\n武器：${m.weapons.join(' / ')}\n敵密度：${m.density} / 上限${m.enemyLimit} / 開始時${m.initialEnemies}体\nアート：${m.artStyle}\n描画：${m.resolution}\nカメラ：${m.cameraMode} / 開始時${number(m.cameraZoom,2)}倍\n無敵：${m.invincible?'ON':'OFF'} / QA：${m.validationMode}\n撃破演出：LEVEL ${m.destructionLevel}\n\n有効時間：${number(r.acceptedDurationMs/1000,3)}秒（目標30秒、準備1秒は除外）\n有効フレーム数：${r.samples}\n平均観測RAF FPS：${number(r.observedRafFps)}\n最低1秒平均FPS：${number(r.minimumOneSecondFps)}（固定1秒窓${r.fullSecondWindows}個）\nフレームP50：${number(r.p50FrameMs,2)}ms\nフレームP95：${number(r.p95FrameMs,2)}ms\nフレームP99：${number(r.p99FrameMs,2)}ms\n最大フレーム間隔：${number(r.maxFrameMs,2)}ms\n更新CPU平均：${number(r.updateCpuMs,2)}ms\n描画CPU平均：${number(r.drawCpuMs,2)}ms\n最大生存敵数：${r.maxEnemies}\n最大弾数：${r.maxShots}\n最大エフェクト数：${r.maxEffects}\n中断回数：${r.interruptions}\n判別不能な長間隔：${number(r.unclassifiedGapMs,1)}ms\n\n計測結果：${r.valid?'有効':r.statusLabel} / ${r.reason}\n${r.valid?'':'未完了・中断の数値は部分記録で、正常30秒の性能値ではありません。\n'}RAFは表示完了・GPU時間ではありません。通常セーブなし。QA途中開始は全編攻略ではありません。\n体感メモ：${String(memo).slice(0,500)||'未記入'}`;
}
export function mobileChecklistText(qa,environment='',memo=''){
  return `【ドット防衛戦線 iPhone実機受入チェック】\n環境：${environment||'未入力'}\n${MOBILE_QA_ITEMS.map(([id,label])=>`${id} ${label}：${qa[id].status}${qa[id].note?` / ${qa[id].note}`:''}`).join('\n')}\n体感メモ：${String(memo).slice(0,500)||'未記入'}\nユーザーの手動記録です。自動テスト結果からOKへ変更しません。通常セーブなし。`;
}
