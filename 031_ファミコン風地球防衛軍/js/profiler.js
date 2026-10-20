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
