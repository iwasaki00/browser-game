// CPU / raw-coordinate reference only; no browser FPS or product image export.
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { TRACE, traceRadius } from '../src/trace.js';
import { TraceV063Engine } from './fixtures/trace-v0.6.3.mjs';
import { naturalFixture, naturalRaster, referenceSheet } from '../test/natural-reference.js';
import { png } from './reference-raster.mjs';

const out='docs/flow-trace-v0.6.4';fs.mkdirSync(out,{recursive:true});
const report={version:'0.6.4',runtime:process.version,platform:`${os.platform()} ${os.arch()}`,cpu:os.cpus()[0]?.model,
  environment:'Node coordinate/raster/CPU reference; browser and iPhone unverified',browserFps:null,settings:[],speed:[],comparisons:[],stress:[]};
function metrics(e,path,radius) {
  let moved=0,sum=0,max=0,visible=0,outside=0,distant=0;
  const rgba=naturalRaster(e),ax=e.width*path[0],ay=e.height*path[1],dx=e.width*(path[2]-path[0]),dy=e.height*(path[3]-path[1]),length2=dx*dx+dy*dy;
  for(let i=3;i<rgba.length;i+=4)if(rgba[i])visible++;
  for(let id=0;id<e.count;id++) {
    const d=Math.hypot(e.x[id]-e.originX[id],e.y[id]-e.originY[id]);if(d)moved++;sum+=d;max=Math.max(max,d);
    if(e.x[id]<0||e.x[id]>=e.width||e.y[id]<0||e.y[id]>=e.height)outside++;
    const t=Math.max(0,Math.min(1,((e.originX[id]-ax)*dx+(e.originY[id]-ay)*dy)/length2));
    if(d&&Math.hypot(e.originX[id]-ax-t*dx,e.originY[id]-ay-t*dy)>radius+1e-8)distant++;
  }
  return {particles:e.count,occupied:e.grid.filter(Boolean).length,visible,outside,moved,meanMovedDistance:+(moved?sum/moved:0).toFixed(3),maxDistance:+max.toFixed(3),distantChanges:distant};
}
function run(Engine,w,h,{size='medium',strength='standard',time=800,path=[.3,.45,.7,.45],porous=false,legacy=false}={}) {
  const e=naturalFixture(Engine,w,h);
  if(porous){const p=[];for(let id=0;id<e.count;id++)if((e.x[id]+e.y[id])%5)p.push({x:e.x[id],y:e.y[id],color:[...e.colors.subarray(id*4,id*4+4)]});e.load(p);}
  const colors=e.colors.slice(),radius=traceRadius(w,size),scope=radius+(legacy?1:TRACE.profiles[strength].halo)*w/180;
  const frames=[naturalRaster(e)],snapshots=[{stroke:0,...metrics(e,path,scope)}],times=[];e.beginTrace();
  let maxWork=0,maxPushes=0,maxMixMoves=0,maxChainLength=0,firstStats,buffer,cpuTotalMs=0;
  for(let i=1;i<=30;i++) {
    const cpuStart=process.cpuUsage(),start=performance.now();e.traceSegment(w*path[0],h*path[1],w*path[2],h*path[3],radius,time,strength);times.push(performance.now()-start);
    const cpu=process.cpuUsage(cpuStart);cpuTotalMs+=(cpu.user+cpu.system)/1000;
    e.assertIntegrity();assert.deepEqual(e.colors,colors);
    if(i===1)firstStats={...e.lastTraceStats};
    maxWork=Math.max(maxWork,e.lastTraceStats.work);
    if(!buffer)buffer=e.traceWork;else assert.equal(buffer,e.traceWork);
    if(!legacy){
      assert.ok(e.lastTraceStats.work<=e.lastTraceStats.workLimit);assert.ok(e.lastTraceStats.workLimit<=TRACE.maxWork);
      maxPushes=Math.max(maxPushes,e.lastTraceStats.pushes);
      maxMixMoves=Math.max(maxMixMoves,e.lastTraceStats.mixMoves);maxChainLength=Math.max(maxChainLength,e.lastTraceStats.maxChainLength);
    }
    const m=metrics(e,path,scope);assert.equal(m.particles,m.occupied);assert.equal(m.particles,m.visible);assert.equal(m.outside,0);if(!legacy)assert.equal(m.distantChanges,0);
    if([1,10,30].includes(i)){snapshots.push({stroke:i,...m});frames.push(naturalRaster(e));}
  }
  times.sort((a,b)=>a-b);
  return {frames,result:{grid:`${w}x${h}`,size,strength,timeMs:time,porous,cpuMedianMs:+times[15].toFixed(3),cpuP95Ms:+times[28].toFixed(3),
    cpuTotalMs:+cpuTotalMs.toFixed(3),cpuMeanMs:+(cpuTotalMs/30).toFixed(3),radius,influenceRadius:scope,maxWork,
    maxPushes:legacy?null:maxPushes,maxMixMoves:legacy?null:maxMixMoves,maxChainLength:legacy?null:maxChainLength,
    buffersReused:true,firstStats,snapshots}};
}
for(const [w,h]of[[180,300],[270,450]]) {
  for(const strength of ['weak','standard','strong']) {
    const {frames,result}=run(PathEngine,w,h,{strength});report.settings.push(result);
    fs.writeFileSync(`${out}/strength-${strength}-${w}.png`,png(w*4,h,referenceSheet(w,h,frames)));
  }
  report.speed.push(run(PathEngine,w,h,{time:16}).result);
  for(const before of [true,false]) {
    const {frames,result}=run(before?TraceV063Engine:PathEngine,w,h,{size:before?'small':'medium',legacy:before});
    const tag=before?'before-v0.6.3':'after-v0.6.4';report.comparisons.push({version:before?'0.6.3':'0.6.4',...result});
    fs.writeFileSync(`${out}/${tag}-${w}.png`,png(w*4,h,referenceSheet(w,h,frames)));
  }
  // Equal-width baseline isolates the algorithm from the new default width.
  report.comparisons.push({version:'0.6.3',equalWidth:true,...run(TraceV063Engine,w,h,{legacy:true}).result});
  for(const size of ['small','medium','large'])for(const strength of ['weak','standard','strong'])
    report.stress.push(run(PathEngine,w,h,{size,strength,time:16,path:[.2,.2,.8,.7]}).result);
  report.stress.push(run(PathEngine,w,h,{porous:true,strength:'strong'}).result);
}
fs.writeFileSync(`${out}/node-results.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.settings.map(r=>({grid:r.grid,strength:r.strength,first:r.snapshots[1],cpuMedianMs:r.cpuMedianMs,cpuP95Ms:r.cpuP95Ms,stats:r.firstStats})),null,2));
