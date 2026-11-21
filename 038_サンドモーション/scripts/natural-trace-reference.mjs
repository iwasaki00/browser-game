import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import { TraceV063Engine as PathEngine } from './fixtures/trace-v0.6.3.mjs';
import { PreviousTraceEngine } from './fixtures/trace-v0.6.2.mjs';
import { naturalFixture, naturalRaster, referenceStroke, referenceMetrics, referenceSheet } from '../test/natural-reference.js';
import { png } from './reference-raster.mjs';
import { TRACE, traceRadius } from './fixtures/trace-v0.6.3.mjs';
const out = 'docs/natural-trace-v0.6.3'; fs.mkdirSync(out, { recursive: true });
const report = { version: '0.6.3', runtime: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
  environment: 'Node CPU/raster reference; no browser FPS or iPhone claim', browserFps: null, measurements: [], stress: [] };
for (const [width, height] of [[180, 300], [270, 450]]) for (const previous of [true, false]) {
  const e = naturalFixture(previous ? PreviousTraceEngine : PathEngine, width, height), colors = e.colors.slice();
  const frames = [naturalRaster(e)], snapshots = [{ stroke: 0, ...referenceMetrics(e) }], times = [];
  let maxSingleStrokeDistance = 0; e.beginTrace();
  for (let i = 1; i <= 30; i++) {
    const x = e.x.slice(), y = e.y.slice(), start = performance.now(); referenceStroke(e, previous); times.push(performance.now() - start);
    for (let id = 0; id < e.count; id++) maxSingleStrokeDistance = Math.max(maxSingleStrokeDistance, Math.hypot(e.x[id] - x[id], e.y[id] - y[id]));
    e.assertIntegrity(); assert.deepEqual(e.colors, colors);
    const metrics = referenceMetrics(e); assert.equal(metrics.visible, e.count); assert.equal(metrics.occupied, e.count);
    if ([1,10,30].includes(i)) { frames.push(naturalRaster(e)); snapshots.push({ stroke: i, ...metrics }); }
  }
  const tag = previous ? 'before-v0.6.2' : 'after-v0.6.3';
  fs.writeFileSync(`${out}/${tag}-${width}.png`, png(width * 4, height, referenceSheet(width, height, frames)));
  times.sort((a,b) => a-b);
  report.measurements.push({ grid: `${width}x${height}`, version: previous ? '0.6.2' : '0.6.3', defaultRadius: (previous ? 12 : 3) * width / 180,
    cpuMedianMs: +times[15].toFixed(3), cpuP95Ms: +times[28].toFixed(3), maxSingleStrokeDistance: +maxSingleStrokeDistance.toFixed(2), snapshots });
}
for (const [width,height] of [[180,300],[270,450]]) for (const size of ['small','medium','large']) for (const force of ['weak','standard','strong']) {
  const e=naturalFixture(PathEngine,width,height), colors=e.colors.slice(), times=[];
  e.beginTrace(); let maxWork=0, buffersReused=true, buffers;
  for(let i=0;i<30;i++) {
    const start=performance.now();
    e.traceSegment(width*.2,height*.2,width*.8,height*.7,traceRadius(width,size),16,force);
    times.push(performance.now()-start); maxWork=Math.max(maxWork,e.lastTraceStats.work);
    if(!buffers) buffers=e.traceWork;
    else buffersReused &&= buffers === e.traceWork;
    e.assertIntegrity(); assert.deepEqual(e.colors,colors); assert.ok(e.lastTraceStats.work<=TRACE.maxWork);
  }
  const metrics=referenceMetrics(e,[.2,.2,.8,.7],TRACE.widths[size]+1); assert.equal(metrics.visible,e.count); assert.equal(metrics.occupied,e.count); assert.equal(metrics.distantChanges,0);
  times.sort((a,b)=>a-b);
  report.stress.push({grid:`${width}x${height}`,size,force,cpuMedianMs:+times[15].toFixed(3),cpuP95Ms:+times[28].toFixed(3),
    maxWork,buffersReused,...metrics});
}
fs.writeFileSync(`${out}/node-results.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
