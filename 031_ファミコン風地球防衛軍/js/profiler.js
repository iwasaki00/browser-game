// RAF spacing is not CPU time. Only sustained foreground samples count.
export const MEASUREMENT=Object.freeze({warmupMs:500,minSamples:30,minDurationMs:500,maxGapMs:250});
export const PROFILE_LABELS=Object.freeze({WARMUP:'ウォームアップ',MEASURING:'計測中',INSUFFICIENT:'有効サンプル不足',INTERRUPTED:'タブ中断・長いフレーム間隔を検出',PAUSED:'操作・非表示により計測中断',COMPLETE:'計測完了'});

// Bounded histogram; a run may contain independently warmed-up segments.
export class RunProfiler {
  constructor(options={}){
    this.options={...MEASUREMENT,...options};this.bins=new Uint32Array(501);this.samples=0;this.excluded=0;this.warmupExcluded=0;this.inactivePeriods=0;
    this.last=null;this.segmentStart=null;this.status='WARMUP';this.reason='開始後500msを除外';this.totalFrameMs=0;this.updateCpuMs=0;this.drawCpuMs=0;this.maxFrameMs=0;this.maxExcludedGapMs=0;this.maxEnemies=0;this.maxShots=0;this.maxEffects=0;this.complete=false;
  }
  pause(reason='操作による中断'){
    if(this.last!==null)this.inactivePeriods++;this.last=this.segmentStart=null;
    if(!this.complete){this.status='PAUSED';this.reason=reason}
  }
  record(ts,updateMs,drawMs,counts={},active=true,reason='タブ非表示またはLAB・ポーズ操作'){
    if(this.complete)return;
    if(!active){this.pause(reason);return}
    const delta=this.last===null?0:ts-this.last;this.last=ts;
    if(this.segmentStart===null)this.segmentStart=ts;
    if(delta>this.options.maxGapMs){this.excluded++;this.maxExcludedGapMs=Math.max(this.maxExcludedGapMs,delta);this.segmentStart=ts;this.status='INTERRUPTED';this.reason=`${delta.toFixed(0)}msの間隔：停止・操作中断・極端な遅延を区別できないため除外`;return}
    if(delta<=0)return;
    if(ts-delta-this.segmentStart<this.options.warmupMs-1e-6){this.warmupExcluded++;this.status='WARMUP';this.reason='前景復帰後の500msを除外';return}
    this.samples++;this.bins[Math.min(500,Math.ceil(delta*2))]++;this.totalFrameMs+=delta;this.updateCpuMs+=Math.max(0,updateMs);this.drawCpuMs+=Math.max(0,drawMs);this.maxFrameMs=Math.max(this.maxFrameMs,delta);
    this.maxEnemies=Math.max(this.maxEnemies,counts.enemies??0);this.maxShots=Math.max(this.maxShots,counts.shots??0);this.maxEffects=Math.max(this.maxEffects,counts.effects??0);
    this.status=this.sufficient()?'MEASURING':'INSUFFICIENT';this.reason=this.sufficient()?'前景の有効区間のみ':'30サンプルかつ有効時間500msが必要';
  }
  sufficient(){return this.samples>=this.options.minSamples&&this.totalFrameMs>=this.options.minDurationMs-1e-6}
  finish(){this.complete=true;this.status=this.sufficient()?'COMPLETE':'INSUFFICIENT';this.reason=this.sufficient()?'前景の有効区間で完了':'有効サンプル不足。前景で連続実行し再計測してください';return this.snapshot()}
  snapshot(){
    let n=0,p95=null;for(let i=0;i<this.bins.length;i++){n+=this.bins[i];if(n>=Math.ceil(this.samples*.95)&&this.samples){p95=i/2;break}}
    const valid=this.sufficient();let tailLeft=Math.max(1,Math.ceil(this.samples*.01)),tailCount=tailLeft,tailMs=0;for(let i=500;i>=0&&tailLeft;i--){const take=Math.min(tailLeft,this.bins[i]);tailMs+=take*i/2;tailLeft-=take}
    return {status:this.status,statusLabel:PROFILE_LABELS[this.status],reason:this.reason,samples:this.samples,excludedInterruptions:this.excluded,maxExcludedGapMs:this.maxExcludedGapMs,warmupExcluded:this.warmupExcluded,inactivePeriods:this.inactivePeriods,
      acceptedDurationMs:this.totalFrameMs,fps:valid?1000*this.samples/this.totalFrameMs:null,low1PercentFps:valid?1000*tailCount/tailMs:null,meanFrameMs:valid?this.totalFrameMs/this.samples:null,p95FrameMs:valid?p95:null,maxFrameMs:valid?this.maxFrameMs:null,
      updateCpuMs:valid?this.updateCpuMs/this.samples:null,drawCpuMs:valid?this.drawCpuMs/this.samples:null,maxEnemies:this.maxEnemies,maxShots:this.maxShots,maxEffects:this.maxEffects,histogramResolutionMs:.5};
  }
}

export class LiveProfiler {
  constructor(){this.frames=new Float64Array(240);this.updates=new Float64Array(240);this.draws=new Float64Array(240);this.sorted=new Float64Array(240);this.reset()}
  reset(){this.count=0;this.cursor=0;this.last=null;this.segmentStart=null;this.lastPublish=0;this.result=this.lastValid=null;this.excluded=0;this.warmupExcluded=0;this.status='WARMUP';this.reason='前景で500msの準備後に集計'}
  pause(reason='LAB・ポーズ操作'){if(this.result)this.lastValid=this.result;this.last=this.segmentStart=null;this.count=this.cursor=0;this.result=null;this.status='PAUSED';this.reason=reason}
  state(){return {status:this.status,statusLabel:PROFILE_LABELS[this.status],reason:this.reason,samples:this.count,excluded:this.excluded,warmupExcluded:this.warmupExcluded}}
  record(ts,updateMs,drawMs,active=true){
    if(!active){if(this.last!==null)this.pause('LAB・ポーズ操作またはタブ非表示');return null}
    const delta=this.last===null?0:ts-this.last;this.last=ts;if(this.segmentStart===null)this.segmentStart=ts;
    if(delta>MEASUREMENT.maxGapMs){if(this.result)this.lastValid=this.result;this.excluded++;this.count=this.cursor=0;this.result=null;this.segmentStart=ts;this.status='INTERRUPTED';this.reason=`${delta.toFixed(0)}ms：停止・操作中断・極端な遅延のため除外`;return {...this.state(),interrupted:true,gapMs:delta}}
    if(delta<=0)return null;
    if(ts-delta-this.segmentStart<MEASUREMENT.warmupMs-1e-6){this.warmupExcluded++;this.status='WARMUP';this.reason='前景復帰後500msを除外';return ts-this.lastPublish>=500?this.publishState(ts):null}
    const i=this.cursor;this.frames[i]=delta;this.updates[i]=updateMs;this.draws[i]=drawMs;this.cursor=(i+1)%240;this.count=Math.min(240,this.count+1);
    let frame=0,update=0,draw=0,max=0;
    for(let j=0;j<this.count;j++){frame+=this.frames[j];update+=this.updates[j];draw+=this.draws[j];max=Math.max(max,this.frames[j])}
    if(this.count<MEASUREMENT.minSamples||frame<MEASUREMENT.minDurationMs-1e-6){this.status='INSUFFICIENT';this.reason='30サンプルかつ有効時間500msが必要';return ts-this.lastPublish>=500?this.publishState(ts):null}
    this.status='MEASURING';this.reason='直近の連続した前景区間';if(this.result&&ts-this.lastPublish<500)return null;this.lastPublish=ts;
    this.sorted.set(this.frames);const sorted=this.sorted.subarray(0,this.count);sorted.sort();
    this.result={...this.state(),fps:1000/(frame/this.count),frameMs:frame/this.count,p95FrameMs:sorted[Math.max(0,Math.ceil(this.count*.95)-1)],maxFrameMs:max,updateMs:update/this.count,drawMs:draw/this.count};return this.result;
  }
  publishState(ts){this.lastPublish=ts;return this.state()}
}

// Six-second BENCH: interrupted intervals never produce a fake FPS.
export class FrameProfiler {
  constructor(){this.running=false;this.result=null}
  start(limit){this.limit=limit;this.first=null;this.running=true;this.result=null;this.profile=new RunProfiler();this.minEnemies=limit;this.maxEnemies=0}
  record(time,cpu,enemies,active=true){
    if(!this.running)return;if(this.first===null)this.first=time;
    this.profile.record(time,cpu,0,{enemies},active);this.minEnemies=Math.min(this.minEnemies,enemies);this.maxEnemies=Math.max(this.maxEnemies,enemies);
    if(time-this.first<6000)return;this.running=false;const s=this.profile.finish();
    this.result={limit:this.limit,...s,averageFps:s.fps,meanCpuMs:s.updateCpuMs,minEnemies:this.minEnemies,maxEnemies:this.maxEnemies};
  }
}
