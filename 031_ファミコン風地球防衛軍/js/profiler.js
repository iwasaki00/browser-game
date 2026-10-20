// Debug-only measurements of actual requestAnimationFrame intervals and synchronous frame work.
export class FrameProfiler {
  constructor(){this.running=false;this.frames=[];this.cpu=[];this.result=null}
  start(limit){this.limit=limit;this.frames.length=0;this.cpu.length=0;this.first=null;this.last=null;this.running=true;this.result=null;this.minEnemies=limit;this.maxEnemies=0}
  record(time,cpu,enemies){
    if(!this.running)return;
    if(this.first===null)this.first=time;
    if(this.last!==null){this.frames.push(time-this.last);this.cpu.push(cpu)}
    this.last=time;this.minEnemies=Math.min(this.minEnemies,enemies);this.maxEnemies=Math.max(this.maxEnemies,enemies);
    if(time-this.first<6000)return;
    this.running=false;
    const sorted=[...this.frames].sort((a,b)=>a-b),cost=[...this.cpu].sort((a,b)=>a-b);
    const mean=a=>a.reduce((sum,x)=>sum+x,0)/a.length,round=n=>Math.round(n*1000)/1000;
    this.result={limit:this.limit,samples:sorted.length,averageFps:round(1000/mean(sorted)),low1PercentFps:round(1000/mean(sorted.slice(-Math.max(1,Math.ceil(sorted.length*.01))))),
      meanCpuMs:round(mean(cost)),p95CpuMs:round(cost[Math.min(cost.length-1,Math.floor(cost.length*.95))]),maxCpuMs:round(cost.at(-1)),
      minEnemies:this.minEnemies,maxEnemies:this.maxEnemies};
  }
}

// Bounded rolling measurements. RAF intervals and synchronous CPU work stay separate.
export class LiveProfiler {
  constructor(){this.frames=new Float64Array(240);this.updates=new Float64Array(240);this.draws=new Float64Array(240);this.reset()}
  reset(){this.count=0;this.cursor=0;this.last=null;this.lastPublish=0;this.result=null;this.excluded=0}
  record(ts,updateMs,drawMs,active=true){
    const delta=this.last===null?0:ts-this.last;this.last=active?ts:null;
    // Inactive periods and >250ms interruptions are not ordinary gameplay samples.
    if(!active||delta<=0)return null;
    if(delta>250){this.excluded++;this.result=null;return {interrupted:true,gapMs:delta,excluded:this.excluded,samples:this.count}}
    const i=this.cursor;this.frames[i]=delta;this.updates[i]=updateMs;this.draws[i]=drawMs;
    this.cursor=(i+1)%240;this.count=Math.min(240,this.count+1);
    if(ts-this.lastPublish<500)return null;this.lastPublish=ts;
    let frame=0,update=0,draw=0,max=0;
    for(let j=0;j<this.count;j++){frame+=this.frames[j];update+=this.updates[j];draw+=this.draws[j];max=Math.max(max,this.frames[j])}
    this.result={fps:1000/(frame/this.count),frameMs:frame/this.count,maxFrameMs:max,updateMs:update/this.count,drawMs:draw/this.count,samples:this.count,excluded:this.excluded};
    return this.result;
  }
}
