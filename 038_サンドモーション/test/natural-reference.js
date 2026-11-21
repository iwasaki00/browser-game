// Shared deterministic opaque image and trajectory for Node and browser QA.
import { traceShade } from '../src/trace.js';
export function naturalFixture(Engine, width, height) {
  const engine = new Engine(width, height), particles = [];
  for (let y = Math.round(height * .1); y < height * .8; y++) for (let x = Math.round(width * .1); x < width * .9; x++) {
    const top = y < height * .45, noise = ((Math.imul(x + 1, 17431) ^ Math.imul(y + 1, 5317)) >>> 0) % 17 - 8;
    particles.push({ x, y, color: [top ? 218 + noise : 63 + noise, 140 + noise, top ? 80 + noise : 192 + noise, 255] });
  }
  engine.load(particles); return engine;
}
export function naturalRaster(e) {
  const data = new Uint8ClampedArray(e.width * e.height * 4);
  for (let id = 0; id < e.count; id++) {
    const dst = (e.y[id] * e.width + e.x[id]) * 4, src = id * 4, shade = traceShade(e, id);
    data[dst] = e.colors[src] * shade; data[dst + 1] = e.colors[src + 1] * shade;
    data[dst + 2] = e.colors[src + 2] * shade; data[dst + 3] = e.colors[src + 3];
  }
  return data;
}
export function referenceStroke(e, previous = false) {
  return e.traceSegment(e.width * .3, e.height * .45, e.width * .7, e.height * .45,
    (previous ? 12 : 3) * e.width / 180, 800, 'standard');
}
export function referenceMetrics(e, path = [.3,.45,.7,.45], affectedRadius = 4) {
  const rgba = naturalRaster(e); let visible = 0, changed = 0, outside = 0, maxDistance = 0, distantChanges = 0;
  const ax=e.width*path[0], ay=e.height*path[1], dx=e.width*(path[2]-path[0]), dy=e.height*(path[3]-path[1]), length2=dx*dx+dy*dy;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]) visible++;
  for (let id = 0; id < e.count; id++) {
    const d = Math.hypot(e.x[id] - e.originX[id], e.y[id] - e.originY[id]);
    maxDistance = Math.max(maxDistance, d); if (d) changed++;
    const t=length2?Math.max(0,Math.min(1,((e.originX[id]-ax)*dx+(e.originY[id]-ay)*dy)/length2)):0;
    if (d && Math.hypot(e.originX[id]-ax-t*dx,e.originY[id]-ay-t*dy)>affectedRadius*e.width/180) distantChanges++;
    if (e.x[id] < 0 || e.x[id] >= e.width || e.y[id] < 0 || e.y[id] >= e.height) outside++;
  }
  return { particles: e.count, occupied: e.grid.filter(Boolean).length, visible, outside, changed, maxDistance: +maxDistance.toFixed(2), distantChanges };
}
export function referenceSheet(width, height, frames) {
  const data = new Uint8Array(width * height * 16);
  for (let n = 0; n < 4; n++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const src = (y * width + x) * 4, dst = (y * width * 4 + n * width + x) * 4;
    data.set(frames[n][src + 3] ? frames[n].subarray(src, src + 4) : [20, 25, 28, 255], dst);
  }
  return data;
}
