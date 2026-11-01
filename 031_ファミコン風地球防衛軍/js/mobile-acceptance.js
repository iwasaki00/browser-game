import {MobilePlaytest,MOBILE_TEST} from './mobile-playtest.js?v=1.2.0-A';

export const ACCEPTANCE=Object.freeze({gapMs:250,minSamples:30,minDurationMs:1000,publishMs:750,historyLimit:20,eventLimit:32,issueLimit:12});
export const ACCEPTANCE_KEY='pixel-defense-front-acceptance-v1';
export const ACCEPTANCE_PRESETS=Object.freeze([
 {id:'IP-01',name:'M01 基本操作',mission:'M01',area:0,density:'STANDARD',weapon:'A-01'},
 {id:'IP-02',name:'M01 大量敵100・爆発',mission:'M01',area:0,density:'MASSIVE',enemy:'crawler',count:100,weapon:'R-04',seconds:60},
 {id:'IP-03',name:'M03 沿岸・対空',mission:'M03',area:2,density:'STANDARD',weapon:'A-01'},
 {id:'IP-04',name:'M06 脈動→体液→神経網',mission:'M06',area:1,density:'STANDARD',weapon:'A-01'},
 {id:'IP-05',name:'M08 第1形態',mission:'M08',form:1,weapon:'A-01'},
 {id:'IP-06',name:'M08 第2形態',mission:'M08',form:2,weapon:'A-01'},
 {id:'IP-07',name:'M08 第3形態',mission:'M08',form:3,weapon:'R-04'},
 {id:'IP-08',name:'M08 エンディング6シーン',mission:'M08',ending:true,weapon:'A-01'},
 {id:'IP-09',name:'武器・FX負荷100',mission:'M01',area:0,density:'MASSIVE',enemy:'crawler',count:100,weapon:'R-04',secondWeapon:'T-16',seconds:60},
 {id:'IP-10',name:'現在の戦闘・長時間',current:true,seconds:120}
]);
const copy=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(v)&&v>=0;
const clip=(v,n=300)=>String(v??'').slice(0,n);
const qualityNames={VALID:'成立',REFERENCE:'参考値',INVALID:'測定不成立'};

// Reuse the shipped mobile meter's bounded histogram, quantiles, CPU sums,
// resource peaks and start/finish pipeline. Only acceptance's resumable window
// policy differs; the legacy continuous-30s mode keeps its original semantics.
export class AcceptanceMeter extends MobilePlaytest {
 constructor(){super({historyLimit:20});this.recent=new Float64Array(120)}
 start(metadata,startedAt=new Date().toISOString(),seconds=30){
  if(this.active)this.stop('新規計測に切替');this.options.durationMs=seconds===0?Infinity:[30,60,120].includes(seconds)?seconds*1000:30000;
  super.start(metadata,startedAt);Object.assign(this.run,{excludedFrames:0,warmupExcluded:0,baselineExcluded:0,longGaps:0,cpuLoadFrames:0,unresolvedGapMs:0,gapStreak:0,continuousDelaySuspected:false,missingCpu:0,events:[],firstTs:null,wallMs:0,currentCounts:{enemies:0,shots:0,effects:0},endMetadata:null});this.resetRecent();return this.snapshot();
 }
 resetRecent(){this.recent.fill(0);this.recentCount=this.recentCursor=0}
 event(kind,detail){if(!this.run)return;const a=this.run.events;if(a.length>=ACCEPTANCE.eventLimit)a.shift();a.push({kind,atMs:this.run.wallMs,detail:clip(detail,160)})}
 interrupt(reason='前景・戦闘中断'){
  if(!this.active||this.run.last===null&&this.run.status==='ARMED')return false;
  const r=this.run;r.interruptions++;r.last=r.warmupStart=r.recordStart=null;r.status='ARMED';r.reason=clip(reason,160)+'：復帰時に1秒準備をやり直します';this.resetRecent();this.event('INTERRUPTION',reason);return true;
 }
 record(ts,updateMs,drawMs,counts={},active=true,reason='非表示・ポーズ・LAB操作'){
  if(!this.active)return false;const r=this.run;if(!finite(ts)){this.finish('INVALID','不正なRAF時刻');return true}
  if(r.firstTs===null)r.firstTs=ts;r.wallMs=Math.max(r.wallMs,ts-r.firstTs);r.currentCounts={enemies:finite(counts.enemies)?counts.enemies:null,shots:finite(counts.shots)?counts.shots:null,effects:finite(counts.effects)?counts.effects:null};this.peaks(counts);
  if(!active){r.excludedFrames++;this.interrupt(reason);return false}
  const delta=r.last===null?null:ts-r.last,previousCpu=r.previousCpuMs;
  if(delta!==null&&delta<=0){r.excludedFrames++;this.interrupt('RAF時刻が非単調');return false}
  if(delta!==null&&delta>ACCEPTANCE.gapMs){
   r.longGaps++;r.gapStreak++;r.continuousDelaySuspected||=r.gapStreak>=3;
   const cpuEvidence=delta<=MOBILE_TEST.maxContinuousGapMs&&previousCpu>=delta*MOBILE_TEST.cpuGapEvidenceRatio;
   this.event(cpuEvidence?'CPU_LOAD':'UNRESOLVED_LONG_GAP',`${delta.toFixed(1)}ms / 直前CPU ${Number.isFinite(previousCpu)?previousCpu.toFixed(1):'未取得'}ms`);
   if(cpuEvidence)r.cpuLoadFrames++;
   else{r.excludedFrames++;r.unresolvedGapMs+=delta;this.interrupt('長い間隔：停止／継続遅延を判別不能');return false}
  }else if(delta!==null)r.gapStreak=0;
  const cpuKnown=finite(updateMs)&&finite(drawMs);if(!cpuKnown)r.missingCpu++;
  // Base accumulation measures a continuous recordStart span. Rebase that
  // origin on accepted time, not wall time, after each interruption segment.
  if(r.status==='RECORDING'&&delta!==null)r.recordStart=ts-(r.durationMs+delta);
  const before=r.samples,was=r.status;
  if(delta===null){r.baselineExcluded++;r.excludedFrames++}
  else if(was==='WARMUP'){r.warmupExcluded++;r.excludedFrames++}
  const done=super.record(ts,cpuKnown?updateMs:0,cpuKnown?drawMs:0,counts,true,reason);
  if(r.samples>before){this.recent[this.recentCursor]=delta;this.recentCursor=(this.recentCursor+1)%120;this.recentCount=Math.min(120,this.recentCount+1)}return done;
 }
 stop(reason='手動停止',endMetadata=null){if(!this.active)return this.snapshot();this.run.endMetadata=endMetadata?copy(endMetadata):null;this.finish('STOPPED',reason);return this.snapshot()}
 snapshot(){const s=super.snapshot(),r=this.run;if(!s||!r)return null;if(!r.events)return s;const enough=s.samples>=ACCEPTANCE.minSamples&&s.acceptedDurationMs>=ACCEPTANCE.minDurationMs;const target=Number.isFinite(this.options.durationMs)?this.options.durationMs:30000;
  const quality=!enough?'INVALID':s.acceptedDurationMs>=target-1e-6&&!s.interruptions&&!r.unresolvedGapMs?'VALID':'REFERENCE';let recentMs=0;for(let i=0;i<this.recentCount;i++)recentMs+=this.recent[i];
  return {...s,statusLabel:s.status==='STOPPED'?'計測停止':s.status==='ARMED'?'再開待ち':s.statusLabel,valid:quality==='VALID',quality,qualityLabel:qualityNames[quality],
   currentFps:recentMs?1000*this.recentCount/recentMs:null,averageFps:s.observedRafFps,lowFps:s.p95FrameMs?1000/s.p95FrameMs:null,lowFpsDefinition:'1000 / p95 RAF間隔（最低FPSではない）',
   updateCpuMs:r.missingCpu?null:s.updateCpuMs,drawCpuMs:r.missingCpu?null:s.drawCpuMs,minimumOneSecondFps:null,
   targetDurationMs:Number.isFinite(this.options.durationMs)?this.options.durationMs:null,remainingMs:Number.isFinite(s.remainingMs)?s.remainingMs:null,
   elapsedWallMs:r.wallMs,excludedFrames:r.excludedFrames,warmupExcluded:r.warmupExcluded,baselineExcluded:r.baselineExcluded,longGaps:r.longGaps,cpuLoadFrames:r.cpuLoadFrames,unresolvedGapMs:r.unresolvedGapMs,continuousDelaySuspected:r.continuousDelaySuspected,
   sessionId:r.sessionId??null,currentCounts:{...r.currentCounts},endMetadata:r.endMetadata,events:copy(r.events),histogramResolutionMs:MOBILE_TEST.histogramStepMs};
 }
}

export const freshReview=()=>({device:'',outcome:'未評価',ratings:{controls:null,visibility:null,difficulty:null,audio:null,performance:null},notes:{controls:'',visibility:'',difficulty:'',audio:'',performance:''},memo:''});
export function sanitizeReview(raw={}){const out=freshReview();out.device=clip(raw.device,80);out.outcome=['未評価','クリア','敗北','中断'].includes(raw.outcome)?raw.outcome:'未評価';out.memo=clip(raw.memo,500);for(const k of Object.keys(out.ratings)){const n=Number(raw.ratings?.[k]);out.ratings[k]=[1,2,3,4,5].includes(n)?n:null;out.notes[k]=clip(raw.notes?.[k],200)}return out}
export function makeIssue(recordId,raw={},index=1){return {id:recordId+'-I'+index,severity:['BLOCKER','HIGH','MEDIUM','LOW'].includes(raw.severity)?raw.severity:'MEDIUM',missionId:clip(raw.missionId,8),condition:clip(raw.condition),repro:clip(raw.repro),impact:clip(raw.impact),measurement:clip(raw.measurement),status:['OPEN','RETEST','RESOLVED'].includes(raw.status)?raw.status:'OPEN',memo:clip(raw.memo)}}
export class AcceptanceArchive {
 constructor(storage){this.storage=storage;this.rows=[];this.error='';this.serial=0;try{const a=JSON.parse(storage.getItem(ACCEPTANCE_KEY));if(a?.version===1&&Array.isArray(a.rows))this.rows=a.rows.slice(-20).filter(r=>r?.id&&r?.measurement?.metadata).map(r=>({...r,review:sanitizeReview(r.review),issues:Array.isArray(r.issues)?r.issues.slice(0,12).map((q,i)=>makeIssue(clip(r.id,60),q,i+1)):[]}))}catch{this.error='診断履歴を読み込めません。通常セーブには影響しません。'}}
 save(){try{const raw=JSON.stringify({version:1,rows:this.rows.slice(-20)});if(raw.length>240000)throw Error('診断履歴の容量上限');this.storage.setItem(ACCEPTANCE_KEY,raw);this.error='';return true}catch{this.error='診断履歴を保存できません。コピー／JSON出力で保管してください。';return false}}
 put(measurement,review=null){if(!measurement)return null;const found=this.rows.find(r=>r.sessionId===measurement.sessionId&&r.sessionId);if(found){found.measurement=copy(measurement);if(review)found.review=sanitizeReview(review);this.save();return found}
  const row={id:'QA-'+Date.now().toString(36)+'-'+(++this.serial),sessionId:measurement.sessionId,measurement:copy(measurement),review:sanitizeReview(review??{}),issues:[]};this.rows.push(row);if(this.rows.length>20)this.rows.shift();this.save();return row}
 review(id,raw){const row=this.rows.find(r=>r.id===id);if(!row)return false;row.review=sanitizeReview(raw);return this.save()}
 issue(id,raw){const row=this.rows.find(r=>r.id===id);if(!row||row.issues.length>=12)return null;const issue=makeIssue(row.id,raw,row.issues.length+1);row.issues.push(issue);this.save();return issue}
 delete(id){this.rows=this.rows.filter(r=>r.id!==id);return this.save()}
 export(){return {schema:'mobile-acceptance-1',rows:copy(this.rows),normalSaveModified:false,externalTransmission:false}}
}
const n=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'未取得';
export function acceptanceText(row){if(!row)return '実機診断：未取得。推定値は表示しません。';const s=row.measurement,m=s.metadata,r=row.review;return `PIXEL DEFENSE FRONT 実機診断\n記録ID ${row.id}\n試験 ${m.testId} / ${s.startedAt}\nVersion ${m.version} / ${m.browser||'未取得'}\n端末（任意） ${r.device||'未入力'}\n開始 ${m.missionId} AREA${m.area} / ${m.playerClass} / ${m.weapons.join(' + ')}\n終了 ${s.endMetadata?.missionId??m.missionId} AREA${s.endMetadata?.area??m.area}\n${m.density} / 無敵${m.invincible?'ON':'OFF'} / ${m.resolution} / zoom ${n(m.cameraZoom,2)}\n品質 ${s.qualityLabel} / ${s.reason}\n有効 ${s.samples}フレーム / ${n(s.acceptedDurationMs/1000,2)}秒 / 経過${n(s.elapsedWallMs/1000,2)}秒\n現在FPS ${n(s.currentFps)} / 有効平均RAF FPS ${n(s.averageFps)} / p95換算低FPS ${n(s.lowFps)}\nP50 ${n(s.p50FrameMs,2)}ms / P95 ${n(s.p95FrameMs,2)}ms\nupdateCPU ${n(s.updateCpuMs,2)}ms / drawCPU ${n(s.drawCpuMs,2)}ms（GPU時間ではない）\n敵最大 ${s.maxEnemies} / 弾最大 ${s.maxShots} / FX最大 ${s.maxEffects}\n除外${s.excludedFrames} / 長間隔${s.longGaps} / CPU整合${s.cpuLoadFrames} / 判別不能間隔合計${n(s.unresolvedGapMs)}ms / 中断${s.interruptions}\n継続遅延疑い ${s.continuousDelaySuspected?'あり':'検出なし（性能保証ではない）'}\n結果 ${r.outcome}\n${Object.keys(r.ratings).map(k=>`${k}: ${r.ratings[k]??'未評価'} / ${r.notes[k]}`).join('\n')}\nメモ ${r.memo}\n問題 ${row.issues.map(q=>`${q.id} ${q.severity} ${q.status} / ${q.condition} / 再現:${q.repro} / 影響:${q.impact} / 値:${q.measurement} / 備考:${q.memo}`).join('\n')||'未記録'}\nLAB試験は通常攻略認定ではありません。温度・メモリは未取得。外部送信なし。`}
