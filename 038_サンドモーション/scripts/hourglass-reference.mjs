// Real simulation snapshots; NOT browser screenshots or browser FPS.
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { sampleImage, particlesFromRGBA } from '../src/image.js';
import { HourglassEngine, hourglassPlacement } from '../src/hourglass.js';
import { QUALITIES, simulationTiming } from '../src/quality.js';
import { fixture, finishFlow } from '../test/hourglass-fixtures.js';

const out = new URL('../docs/hourglass-v0.4.0/', import.meta.url);
const temp = new URL('../.local/hourglass-reference/', import.meta.url);
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(temp, { recursive: true });
// Replay the actual sample drawing commands with the existing Windows renderer.
const commands = []; let points = [], circle;
const context = { fillStyle: null,
  createLinearGradient: () => ({ stops: [], addColorStop(position, color) { this.stops.push([position, color]); } }),
  fillRect(x, y, w, h) { commands.push({ kind: 'rect', x, y, w, h, style: this.fillStyle }); },
  beginPath() { points = []; circle = null; }, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
  closePath() {}, arc(x, y, r) { circle = { x, y, r }; },
  fill() { commands.push(circle ? { kind: 'circle', ...circle, style: this.fillStyle } : { kind: 'polygon', points, style: this.fillStyle }); }
};
const previousDocument = globalThis.document;
try { globalThis.document = { createElement: () => ({ getContext: () => context }) }; sampleImage(); }
finally { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
const layouts = ['standard', 'high'].map(quality => ({ quality, ...QUALITIES[quality],
  image: hourglassPlacement(600, 440, QUALITIES[quality].width, QUALITIES[quality].height) }));
const input = new URL('commands.json', temp);
fs.writeFileSync(input, JSON.stringify({ commands, layouts }));
execFileSync('powershell.exe', ['-NoProfile', '-File', fileURLToPath(new URL('quality-reference.ps1', import.meta.url)),
  '-InputPath', fileURLToPath(input), '-OutputPath', fileURLToPath(temp)], { stdio: 'inherit' });

function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(payload)); return Buffer.concat([length, payload, crc]);
}
function png(width, height, rgba) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const scan = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(scan, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]);
}
function raster(e) {
  const data = new Uint8ClampedArray(e.width * e.height * 4);
  for (let i = 0; i < e.grid.length; i++) data.set(e.container.outline[i] ? [129, 157, 149, 255] : [20, 25, 28, 255], i * 4);
  for (let id = 0; id < e.count; id++) data.set(e.colors.subarray(id * 4, id * 4 + 4), (e.y[id] * e.width + e.x[id]) * 4);
  return data;
}
const save = (name, e) => fs.writeFileSync(new URL(`${name}.png`, out), png(e.width, e.height, raster(e)));
const report = { version: '0.4.0', at: new Date().toISOString(), runtime: process.version,
  cpu: os.cpus()[0]?.model, platform: `${os.platform()} ${os.arch()}`,
  renderer: 'Node physics; System.Drawing sample reference; not browser screenshots',
  browserFps: null, browserVerified: false, iphoneVerified: false, emulatorVerified: false, measurements: [] };
for (const { quality, width, height } of layouts) {
  for (const source of ['sample', 'dense-portrait', 'dense-tall']) {
    const e = source === 'sample' ? new HourglassEngine(width, height) :
      fixture(width, height, source === 'dense-portrait' ? 600 : 300, source === 'dense-portrait' ? 1000 : 1200);
    if (source === 'sample') e.load(particlesFromRGBA(fs.readFileSync(new URL(`${quality}.rgba`, temp)), width, height));
    const initial = e.grid.slice(), colors = e.colors.slice(); save(`${source}-initial-${quality}`, e);
    e.releaseAll(); const start = performance.now();
    let settledAt = null;
    const flowSteps = finishFlow(e, 12000, n => {
      if (n % 100 === 0) e.assertIntegrity();
      if (settledAt === null && !e.active.some(v => v)) settledAt = n + 1;
    });
    const cpuMs = performance.now() - start;
    if (e.upperCount()) throw new Error(`${quality} ${source} clogged`);
    e.assertIntegrity(); save(`${source}-complete-${quality}`, e);
    const row = { quality, source, grid: `${width}x${height}`, count: e.count, flowSteps,
      // Time for last grain crossing midline; settling steps excluded from this number.
      simulatedFlowSeconds: +(flowSteps * simulationTiming(width).stepMs / 1000).toFixed(2),
      simulatedSettledSeconds: settledAt === null ? null : +(settledAt * simulationTiming(width).stepMs / 1000).toFixed(2),
      physicsCpuMsIncludingSettlingAndIntegrity: +cpuMs.toFixed(2), remainingUpper: e.upperCount(),
      wallIntegrity: true, colorIdentity: Buffer.from(e.colors).equals(Buffer.from(colors)), browserFps: null };
    e.reset(); row.resetExact = Buffer.from(e.grid.buffer).equals(Buffer.from(initial.buffer));
    report.measurements.push(row);
  }
  const straight = fixture(width, height), tilted = fixture(width, height), initial = raster(straight);
  straight.releaseAll(); finishFlow(straight); tilted.releaseAll();
  for (let i = 0; i < 400; i++) tilted.step();
  tilted.setGravity(-1); for (let i = 0; i < 180; i++) tilted.step();
  tilted.setGravity(1); for (let i = 0; i < 180; i++) tilted.step();
  tilted.setGravity(0); finishFlow(tilted); tilted.assertIntegrity();
  save(`bands-straight-${quality}`, straight); save(`bands-tilted-${quality}`, tilted);
  const comparison = new Uint8ClampedArray((width * 3) * height * 4), sources = [initial, raster(straight), raster(tilted)];
  for (let n = 0; n < 3; n++) for (let y = 0; y < height; y++)
    comparison.set(sources[n].subarray(y * width * 4, (y + 1) * width * 4), (y * width * 3 + n * width) * 4);
  fs.writeFileSync(new URL(`bands-comparison-${quality}.png`, out), png(width * 3, height, comparison));
}
fs.writeFileSync(new URL('node-results.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
