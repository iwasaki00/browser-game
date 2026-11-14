// Explicit local-only QA server. Normal `npm start` has no artifact write API.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'docs', 'quality-v0.2.1');
const port = Number(process.env.QA_PORT || 5174), origin = `http://127.0.0.1:${port}`;
const names = ['initial-standard', 'initial-high', 'initial-comparison', 'collapse-standard', 'collapse-high', 'swipe-standard', 'swipe-high'];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    if (req.method === 'POST' && ['/__qa/report', '/__qa/reassembly'].includes(pathname)) {
      if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) { res.writeHead(403); res.end(); return; }
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 4_000_000) throw new Error('QA payload too large'); chunks.push(chunk); }
      const { images, ...report } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const directory = pathname === '/__qa/reassembly' ? path.join(root, 'docs', 'reassembly-v0.3.0') : out;
      const imageNames = pathname === '/__qa/reassembly' ? ['mid-standard', 'mid-high', 'complete-standard', 'complete-high'] : names;
      await mkdir(directory, { recursive: true });
      for (const name of imageNames) {
        const uri = images?.[name];
        if (typeof uri === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(uri))
          await writeFile(path.join(directory, `${name}.png`), Buffer.from(uri.split(',')[1], 'base64'));
      }
      await writeFile(path.join(directory, 'browser-results.json'), JSON.stringify({ ...report,
        host: { cpu: os.cpus()[0]?.model, platform: `${os.platform()} ${os.arch()}` } }, null, 2) + '\n');
      console.log(`QA report saved: ${directory}`); res.writeHead(200); res.end('saved'); return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/test/quality.html' : pathname));
    if (!file.startsWith(root) || path.relative(root, file).startsWith('..')) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  } catch (error) { console.error(error.message); res.writeHead(400); res.end(error.message); }
});
server.listen(port, '127.0.0.1', () => console.log(`Quality QA: ${origin}/test/quality.html`));
