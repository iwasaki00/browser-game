// Offline reference images, not browser screenshots/FPS. Replay the actual
// sampleImage drawing commands with Windows System.Drawing; no runtime dependency.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { sampleImage, imagePlacement, particlesFromRGBA } from '../src/image.js';
import { SandEngine } from '../src/engine.js';
import { QUALITIES, simulationTiming } from '../src/quality.js';

const root = new URL('../', import.meta.url), temporary = new URL('.local/quality-reference/', root), out = new URL('docs/quality-v0.2.1/', root);
mkdirSync(temporary, { recursive: true }); mkdirSync(out, { recursive: true });
const commands = []; let points = [], circle;
const context = { fillStyle: null,
  createLinearGradient: () => ({ stops: [], addColorStop(position, color) { this.stops.push([position, color]); } }),
  fillRect(x, y, w, h) { commands.push({ kind: 'rect', x, y, w, h, style: this.fillStyle }); },
  beginPath() { points = []; circle = null; }, moveTo(x, y) { points.push([x, y]); }, lineTo(x, y) { points.push([x, y]); },
  closePath() {}, arc(x, y, r) { circle = { x, y, r }; },
  fill() { commands.push(circle ? { kind: 'circle', ...circle, style: this.fillStyle } : { kind: 'polygon', points, style: this.fillStyle }); }
};
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => context }) };
sampleImage();
if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
const layouts = ['standard', 'high'].map(quality => ({ quality, ...QUALITIES[quality], image: imagePlacement(600, 440, QUALITIES[quality].width, QUALITIES[quality].height) }));
const input = new URL('commands.json', temporary);
writeFileSync(input, JSON.stringify({ commands, layouts }));
execFileSync('powershell.exe', ['-NoProfile', '-File', fileURLToPath(new URL('quality-reference.ps1', import.meta.url)),
  '-InputPath', fileURLToPath(input), '-OutputPath', fileURLToPath(temporary)], { stdio: 'inherit' });

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
  const rgba = new Uint8ClampedArray(e.width * e.height * 4);
  for (let id = 0; id < e.count; id++) rgba.set(e.colors.subarray(id * 4, id * 4 + 4), (e.y[id] * e.width + e.x[id]) * 4);
  return rgba;
}
const report = { version: '0.2.1', at: new Date().toISOString(), renderer: 'Windows System.Drawing reference, actual sampleImage commands; not a browser screenshot',
  runtime: process.version, cpu: os.cpus()[0]?.model, collapseBrowserFps: null, measurements: [] };
const initialBuffers = [];
for (const { quality, width, height } of layouts) {
  const e = new SandEngine(width, height), timing = simulationTiming(width);
  e.load(particlesFromRGBA(readFileSync(new URL(`${quality}.rgba`, temporary)), width, height));
  const initial = raster(e); initialBuffers.push({ width, height, rgba: initial });
  const save = name => writeFileSync(new URL(`reference-${name}-${quality}.png`, out), png(width, height, raster(e)));
  save('initial'); const count = e.count;
  const row = { quality, grid: `${width}x${height}`, count, physicsHz: 1000 / timing.stepMs };
  e.releaseAll();
  let time = performance.now();
  for (let step = 0; step < Math.round(2000 / timing.stepMs); step++) e.step();
  row.collapsePhysicsCpuMs = +(performance.now() - time).toFixed(2);
  e.assertIntegrity(); save('collapse');
  e.brushSegment(width * 0.15, height * 0.8, width * 0.85, height * 0.8, 12 * width / 180, 3, -1);
  time = performance.now();
  for (let step = 0; step < Math.round(2000 / timing.stepMs); step++) e.step();
  row.swipePhysicsCpuMs = +(performance.now() - time).toFixed(2);
  e.assertIntegrity(); save('swipe');
  row.countConserved = e.count === count; e.reset();
  row.resetExact = Buffer.from(raster(e)).equals(Buffer.from(initial));
  report.measurements.push(row);
}
// Same displayed dimensions, nearest-neighbor pixel enlargement, no retouching.
const width = 564, height = 450, comparison = new Uint8ClampedArray(width * height * 4);
for (let i = 0; i < comparison.length; i += 4) comparison.set([20, 25, 28, 255], i);
for (let image = 0; image < 2; image++) {
  const source = initialBuffers[image];
  for (let y = 0; y < 450; y++) for (let x = 0; x < 270; x++) {
    const i = (Math.floor(y * source.height / 450) * source.width + Math.floor(x * source.width / 270)) * 4;
    if (source.rgba[i + 3]) comparison.set(source.rgba.subarray(i, i + 4), (y * width + image * 294 + x) * 4);
  }
}
writeFileSync(new URL('reference-initial-comparison.png', out), png(width, height, comparison));
writeFileSync(new URL('reference-results.json', out), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
