// Node coordinate/raster evidence; this does not run a browser or export from the app.
import fs from 'node:fs';
import zlib from 'node:zlib';
import os from 'node:os';
import { PathEngine } from '../src/paths.js';

const tag = process.argv[2] || 'after-v0.6.2';
if (!['before-v0.6.1', 'after-v0.6.2'].includes(tag)) throw new Error('Unknown report tag');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
if (tag === 'before-v0.6.1' && version !== '0.6.1') throw new Error('Baseline requires the original v0.6.1 implementation');
const out = 'docs/trace-visibility-v0.6.2'; fs.mkdirSync(out, { recursive: true });
function dense(width, height) {
  const e = new PathEngine(width, height), particles = [];
  for (let y = Math.round(height * .1); y < height * .8; y++) for (let x = Math.round(width * .1); x < width * .9; x++)
    particles.push({ x, y, color: [50 + Math.floor(x / width * 180), 70 + Math.floor(y / height * 160), 100 + Math.floor(x / width * 80), 255] });
  e.load(particles); return e;
}
function raster(e) {
  const data = new Uint8Array(e.width * e.height * 4);
  // Same one-cell RGBA overwrite as app.draw(). Alpha below counts actual visible pixels.
  for (let id = 0; id < e.count; id++) data.set(e.colors.subarray(id * 4, id * 4 + 4), (e.y[id] * e.width + e.x[id]) * 4);
  return data;
}
function png(width, height, data) {
  const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, bytes) => { const body = Buffer.concat([Buffer.from(type), bytes]), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(bytes.length); c.writeUInt32BE(crc(body)); return Buffer.concat([n, body, c]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
const report = { tag, runtime: process.version, platform: `${os.platform()} ${os.arch()}`, browserVerified: false, iphoneVerified: false, measurements: [] };
for (const [width, height] of [[180, 300], [270, 450]]) {
  const e = dense(width, height), colors = e.colors.slice(), images = [];
  const snapshot = (stage, capture = false) => {
    const data = raster(e); if (capture) images.push(data);
    let renderedPixels = 0, outside = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) renderedPixels++;
    for (let id = 0; id < e.count; id++) if (e.x[id] < 0 || e.x[id] >= width || e.y[id] < 0 || e.y[id] >= height) outside++;
    if (tag === 'after-v0.6.2') {
      e.assertIntegrity();
      if (renderedPixels !== e.count || outside || !Buffer.from(e.colors).equals(Buffer.from(colors))) throw new Error('Particle visibility/conservation failure');
    }
    report.measurements.push({ grid: `${width}x${height}`, stage, particles: e.count,
      occupiedCells: e.grid.filter(Boolean).length, inBoundsDrawCalls: e.count - outside, renderedPixels, outside,
      colorsEqual: Buffer.from(e.colors).equals(Buffer.from(colors)) });
  };
  snapshot('initial', true); e.beginTrace();
  for (let i = 1; i <= 30; i++) {
    e.traceSegment(width * .3, height * .45, width * .7, height * .45, 12 * width / 180, 800);
    snapshot(`same-${i}`, i === 10 || i === 30);
  }
  for (let i = 0; i < 24; i++) {
    const t = (i % 8 + 1) / 10;
    e.traceSegment(width * .15, height * t, width * .85, height * (1 - t), 12 * width / 180, 30);
    snapshot(`multi-${i * 2 + 1}`);
    e.traceSegment(width * t, height * .1, width * (1 - t), height * .85, 12 * width / 180, 30);
    snapshot(`multi-${i * 2 + 2}`);
  }
  snapshot('multi-direction', true);
  // Four panels: initial / 10 repeats / 30 repeats / 48 multidirectional strokes.
  const sheet = new Uint8Array(width * 4 * height * 4);
  for (let panel = 0; panel < 4; panel++) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const src = (y * width + x) * 4, dst = (y * width * 4 + panel * width + x) * 4;
    sheet.set(images[panel][src + 3] ? images[panel].subarray(src, src + 4) : [20, 25, 28, 255], dst);
  }
  fs.writeFileSync(`${out}/${tag}-${width}.png`, png(width * 4, height, sheet));
}
fs.writeFileSync(`${out}/${tag}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.measurements.filter(row => ['initial', 'same-10', 'same-30', 'multi-direction'].includes(row.stage))));
