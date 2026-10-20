import './style.css';
import { stage01, type Direction, type ParcelColor } from './stage';
import { simulate, type SimulationResult } from './simulation';

type Mode = 'DESIGN' | 'RUN' | 'RESULT';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const cards = [get<HTMLButtonElement>('step-0'), get<HTMLButtonElement>('step-1')];
const start = get<HTMLButtonElement>('start');
const retry = get<HTMLButtonElement>('retry');
const reset = get<HTMLButtonElement>('reset');
let mode: Mode = 'DESIGN';
let pattern: Direction[] = [...stage01.nodes.find(n => n.id === 'a')!.initialPattern!];
let result: SimulationResult | undefined;
let startedAt = 0;
let elapsed = 0;
const tickMs = 1000;
const ink = '#243D4A';
const teal = '#247E72';
const colors = { RED: '#E27A69', BLUE: '#558CC7' };
const node = (id: string) => stage01.nodes.find(n => n.id === id)!;

function updateControls() {
  get('mode').textContent = mode;
  cards.forEach((card, i) => {
    const left = pattern[i] === 'L';
    card.innerHTML = `<span class="step">STEP 0${i + 1}</span><span class="arrow" aria-hidden="true">${left ? '↙' : '↘'}</span><span class="direction">${pattern[i]} / ${left ? '左' : '右'}</span>`;
    card.setAttribute('aria-label', `分岐A ステップ${i + 1}：${left ? 'L 左' : 'R 右'}。押すと切り替え`);
    card.disabled = mode === 'RUN';
    card.classList.remove('active');
  });
  start.disabled = mode !== 'DESIGN';
  retry.disabled = mode === 'RUN';
  reset.disabled = mode === 'RUN';
}

function design(initial = false) {
  if (initial) pattern = [...stage01.nodes.find(n => n.id === 'a')!.initialPattern!];
  mode = 'DESIGN';
  result = undefined;
  elapsed = 0;
  get('tick').textContent = 'READY';
  get('report').innerHTML = '<h3 id="result-title">配送の準備中</h3><p>丸印は左、三角印は右。<br>2枚の矢印で、3個を届けよう。</p>';
  updateControls();
  draw();
}

cards.forEach((card, i) => card.addEventListener('click', () => {
  if (mode === 'RUN') return;
  pattern[i] = pattern[i] === 'L' ? 'R' : 'L';
  design();
}));
retry.addEventListener('click', () => { design(); start.focus(); });
reset.addEventListener('click', () => design(true));
start.addEventListener('click', () => {
  if (mode !== 'DESIGN') return;
  result = simulate(stage01, { a: pattern });
  mode = 'RUN';
  startedAt = performance.now();
  get('report').innerHTML = '<h3 id="result-title">配送中…</h3><p>設定した循環パターンで<br>荷物を順番に送り出しています。</p>';
  updateControls();
  requestAnimationFrame(animate);
});

function animate(now: number) {
  if (mode !== 'RUN' || !result) return;
  elapsed = Math.min((now - startedAt) / tickMs, result.ticks);
  get('tick').textContent = `TICK ${Math.min(Math.floor(elapsed) + 1, result.ticks)} / ${result.ticks}`;
  const dispatch = result.events.find(e => e.type === 'move' && e.direction && e.tick === Math.floor(elapsed));
  cards.forEach((card, i) => card.classList.toggle('active', dispatch?.patternIndex === i));
  draw();
  if (elapsed < result.ticks) requestAnimationFrame(animate);
  else {
    mode = 'RESULT';
    updateControls();
    get('report').innerHTML = `<h3 id="result-title" class="${result.clear ? 'success' : 'failed'}">${result.clear ? 'CLEAR! 全便、到着。' : 'FAILED / 誤配送あり'}</h3><div class="count">${result.correctCount} <small>/ ${result.parcels.length} 個 正しく配送</small></div><ul class="result-list">${result.parcels.map(p => `<li><span>${String(p.id + 1).padStart(2, '0')} ${p.color === 'RED' ? '● RED' : '▲ BLUE'}</span><span>→ ${node(p.destination).label} ${p.correct ? '✓' : '×'}</span></li>`).join('')}</ul><p>${result.clear ? '矢印のループが、ぴったりつながった！' : '矢印を見直して、もう一度届けてみよう。'}</p>`;
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function text(label: string, x: number, y: number, size = 12, color = ink) {
  ctx.font = `800 ${size}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(label, x, y);
}
function symbol(color: ParcelColor, x: number, y: number, size: number) {
  ctx.fillStyle = '#fffdf6'; ctx.beginPath();
  if (color === 'RED') ctx.arc(x, y, size, 0, Math.PI * 2);
  else { ctx.moveTo(x, y - size); ctx.lineTo(x + size, y + size * .8); ctx.lineTo(x - size, y + size * .8); ctx.closePath(); }
  ctx.fill();
}
function draw() {
  ctx.clearRect(0, 0, 640, 480);
  ctx.fillStyle = '#d8e0d3';
  for (let x = 20; x < 640; x += 24) for (let y = 16; y < 480; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
  for (const edge of stage01.edges) {
    const a = node(edge.from), b = node(edge.to);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 5); ctx.lineTo(b.x, b.y + 5); ctx.strokeStyle = '#c6d0c5'; ctx.lineWidth = 42; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 32; ctx.stroke();
    ctx.setLineDash([3, 12]); ctx.strokeStyle = '#c8d8ce'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(a.x + (b.x - a.x) * .53, a.y + (b.y - a.y) * .53); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(1, 0); ctx.lineTo(-6, 6); ctx.strokeStyle = '#8ca99c'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }
  text('L / 左', 195, 280, 13, teal); text('R / 右', 445, 280, 13, teal);
  for (const n of stage01.nodes) {
    if (n.kind === 'source') {
      roundRect(n.x - 61, n.y - 40, 122, 72, 17, '#c5d5c8');
      roundRect(n.x - 61, n.y - 46, 122, 72, 17, '#CDE8DF', '#afcabe');
      text('SOURCE', n.x, n.y - 17, 12, teal); roundRect(n.x - 32, n.y - 5, 64, 10, 5, teal);
      text('発送口', n.x, n.y + 47, 10, '#6b807e');
    } else if (n.kind === 'switch') {
      roundRect(n.x - 47, n.y - 35, 94, 83, 22, '#c6ae66');
      roundRect(n.x - 47, n.y - 41, 94, 83, 22, '#E4B754', '#d3aa49');
      text('A', n.x, n.y + 12, 30);
      for (const dx of [-32, 32]) for (const dy of [-26, 26]) { ctx.beginPath(); ctx.arc(n.x + dx, n.y + dy, 3, 0, 7); ctx.fillStyle = '#ad8b3f'; ctx.fill(); }
      text('SWITCH A', n.x, n.y + 65, 10, '#6b807e');
    } else {
      const color = n.accepts!;
      roundRect(n.x - 61, n.y - 47, 122, 82, 18, color === 'RED' ? '#c5685a' : '#4473a2');
      roundRect(n.x - 61, n.y - 53, 122, 82, 18, colors[color]);
      symbol(color, n.x, n.y - 26, 12);
      roundRect(n.x - 40, n.y - 2, 80, 9, 4, '#243d4a66');
      text(n.label, n.x, n.y + 52, 12, color === 'RED' ? '#b15c4f' : '#4473a2');
    }
  }
  if (result) for (const p of result.parcels) {
    const moves = result.events.filter(e => e.parcel === p.id && e.type === 'move');
    const move = moves.find(e => elapsed >= e.tick && elapsed < e.tick + 1);
    if (move) {
      const a = node(move.from!), b = node(move.to);
      let t = elapsed - move.tick; t = t * t * (3 - 2 * t);
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      roundRect(x - 18, y - 16, 36, 36, 9, '#243d4a25');
      roundRect(x - 18, y - 20, 36, 36, 9, colors[p.color], '#fffdf6'); symbol(p.color, x, y - 3, 8);
      text(String(p.id + 1), x + 21, y - 17, 10);
    } else if (elapsed >= moves[moves.length - 1].tick + 1) {
      const dest = node(p.destination);
      const siblings = result.parcels.filter(q => q.destination === p.destination);
      const index = siblings.findIndex(q => q.id === p.id);
      const x = dest.x - 35 + index * 30;
      roundRect(x - 11, dest.y + 12, 25, 25, 6, colors[p.color], '#fffdf6');
      symbol(p.color, x + 1, dest.y + 24, 5);
      text(p.correct ? '✓' : '×', x + 1, dest.y + 72, 15, p.correct ? teal : '#b34f42');
    }
  }
}
function resize() {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.getBoundingClientRect().width;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(width * 480 / 640 * ratio);
  ctx.setTransform(canvas.width / 640, 0, 0, canvas.height / 480, 0, 0);
  draw();
}
new ResizeObserver(resize).observe(canvas);
// The menu is two levels above the Vite source and three above its static build.
document.querySelector<HTMLAnchorElement>('.back')!.href = import.meta.env.DEV ? '../../index.html' : '../../../index.html';
design();
