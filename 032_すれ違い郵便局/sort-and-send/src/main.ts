import './style.css';
import { stages, type Direction, type ParcelColor } from './stage';
import { simulate, type SimulationResult } from './simulation';
import { validateStage } from './validation';

type Mode = 'DESIGN' | 'RUN' | 'RESULT';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d')!;
const start = get<HTMLButtonElement>('start');
const retry = get<HTMLButtonElement>('retry');
const reset = get<HTMLButtonElement>('reset');
const next = get<HTMLButtonElement>('next');
let mode: Mode = 'DESIGN';
let stageIndex = 0;
let stage = stages[0];
let selectedSwitch = 'a';
let patterns: Record<string, Direction[]> = {};
let stageErrors: string[] = [];
let cards: HTMLButtonElement[] = [];
let result: SimulationResult | undefined;
let startedAt = 0;
let elapsed = 0;
const tickMs = 700;
const ink = '#243D4A';
const teal = '#247E72';
const colors = { RED: '#E27A69', BLUE: '#558CC7', YELLOW: '#E4B754' };
const marks = { RED: '●', BLUE: '▲', YELLOW: '◆' };
const node = (id: string) => {
  const n = stage.nodes.find(n => n.id === id)!;
  return { ...n, ...n.layout };
};

function updateControls() {
  get('mode').textContent = mode;
  get('switch-name').textContent = `分岐 ${selectedSwitch.toUpperCase()}`;
  const pattern = patterns[selectedSwitch] ?? [];
  get('loop-length').textContent = `${pattern.length} STEP LOOP`;
  if (cards.length !== pattern.length) {
    get('pattern').replaceChildren();
    cards = pattern.map((_, i) => {
      const card = document.createElement('button');
      card.className = 'arrow-card'; card.type = 'button'; card.id = `step-${i}`;
      card.addEventListener('click', () => {
        if (mode === 'RUN') return;
        patterns[selectedSwitch][i] = patterns[selectedSwitch][i] === 'L' ? 'R' : 'L';
        design();
      });
      get('pattern').append(card); return card;
    });
  }
  cards.forEach((card, i) => {
    const left = pattern[i] === 'L';
    card.innerHTML = `<span class="step">STEP 0${i + 1}</span><span class="arrow" aria-hidden="true">${left ? '↙' : '↘'}</span><span class="direction">${pattern[i]} / ${left ? '左' : '右'}</span>`;
    card.setAttribute('aria-label', `分岐${selectedSwitch.toUpperCase()} ステップ${i + 1}：${left ? 'L 左' : 'R 右'}。押すと切り替え`);
    card.disabled = mode === 'RUN' || stageErrors.length > 0;
    card.classList.remove('active');
  });
  for (const button of get('switch-selector').querySelectorAll('button')) {
    const id = button.dataset.switch!;
    button.textContent = `分岐 ${id.toUpperCase()} · ${patterns[id].join('')}`;
    button.setAttribute('aria-pressed', String(id === selectedSwitch));
  }
  for (const button of get('stage-selector').querySelectorAll('button')) button.disabled = mode === 'RUN';
  start.disabled = mode !== 'DESIGN' || stageErrors.length > 0;
  retry.disabled = mode === 'RUN'; reset.disabled = mode === 'RUN';
  next.hidden = !(mode === 'RESULT' && result?.clear && stageIndex < stages.length - 1);
  highlightDispatch();
}

function design(initial = false) {
  if (initial) patterns = Object.fromEntries(stage.nodes.filter(n => n.kind === 'switch').map(n => [n.id, [...(n.initialPattern ?? [])]]));
  mode = 'DESIGN'; result = undefined; elapsed = 0;
  stageErrors = validateStage(stage);
  get('tick').textContent = 'READY';
  get('report').innerHTML = '<h3 id="result-title">配送の準備中</h3><p>荷物と同じ印の出口へ。<br>矢印のループを組んで配送しよう。</p>';
  if (stageErrors.length) showError(stageErrors.join('\n'));
  updateControls(); draw();
}

function showError(message: string) {
  get('report').innerHTML = '<h3 id="result-title" class="failed">ステージを開始できません</h3><p class="error-message"></p>';
  get('report').querySelector('p')!.textContent = message;
}

function selectStage(index: number) {
  if (mode === 'RUN') return;
  stageIndex = index; stage = stages[index];
  selectedSwitch = stage.nodes.find(n => n.kind === 'switch')?.id ?? '';
  get('stage-name').textContent = stage.name;
  const branches = stage.nodes.filter(n => n.kind === 'switch');
  get('route-label').textContent = `ROUTE 0${index + 1} / 分岐 ${branches.map(n => n.id.toUpperCase()).join('・')}`;
  get('switch-selector').replaceChildren();
  for (const branch of branches) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.switch = branch.id;
    button.addEventListener('click', () => { selectedSwitch = branch.id; updateControls(); draw(); });
    get('switch-selector').append(button);
  }
  for (const [i, button] of [...get('stage-selector').querySelectorAll('button')].entries()) {
    if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  }
  // Validate before resolving edge labels or drawing malformed graph data.
  stageErrors = validateStage(stage);
  get('queue').innerHTML = stageErrors.length ? '' : [...stage.parcels].sort((a, b) => a.id - b.id).map(p => `<li><span class="parcel ${p.color.toLowerCase()}">${marks[p.color]}</span><small>${String(p.id + 1).padStart(2, '0')}</small><span class="sr-only">${p.color}</span></li>`).join('');
  get('legend').textContent = stageErrors.length ? '' : stage.nodes.filter(n => n.kind === 'exit').map(n => `${marks[n.accepts!]} ${n.accepts}`).join(' · ');
  canvas.setAttribute('aria-label', stageErrors.length ? 'ステージの構造にエラーがあります。配送レポートを確認してください。' : stage.edges.map(e => `${node(e.from).label}${e.direction ? ` の${e.direction === 'L' ? '左' : '右'}` : ''}から${node(e.to).label}へ`).join('。'));
  design(true);
}

stages.forEach((s, i) => {
  const button = document.createElement('button'); button.type = 'button';
  button.textContent = `0${i + 1}`; button.setAttribute('aria-label', s.name);
  button.addEventListener('click', () => selectStage(i)); get('stage-selector').append(button);
});
retry.addEventListener('click', () => { if (mode !== 'RUN') { design(); start.focus(); } });
reset.addEventListener('click', () => { if (mode !== 'RUN') design(true); });
next.addEventListener('click', () => { selectStage(stageIndex + 1); get('stage-name').scrollIntoView({ block: 'nearest' }); });
start.addEventListener('click', () => {
  if (mode !== 'DESIGN') return;
  stageErrors = validateStage(stage);
  if (stageErrors.length) { showError(stageErrors.join('\n')); updateControls(); return; }
  try { result = simulate(stage, patterns); }
  catch (error) { showError(error instanceof Error ? error.message : '配送データを確認してください。'); return; }
  mode = 'RUN'; startedAt = performance.now();
  get('report').innerHTML = '<h3 id="result-title">配送中…</h3><p>設定した循環パターンで<br>荷物を順番に送り出しています。</p>';
  updateControls(); requestAnimationFrame(animate);
});

function highlightDispatch() {
  const dispatches = result?.events.filter(e => e.type === 'move' && e.direction && e.tick === Math.floor(elapsed)) ?? [];
  cards.forEach((card, i) => card.classList.toggle('active', mode === 'RUN' && dispatches.some(e => e.from === selectedSwitch && e.patternIndex === i)));
}

function animate(now: number) {
  if (mode !== 'RUN' || !result) return;
  elapsed = Math.min((now - startedAt) / tickMs, result.ticks);
  get('tick').textContent = `TICK ${Math.min(Math.floor(elapsed) + 1, result.ticks)} / ${result.ticks}`;
  highlightDispatch(); draw();
  if (elapsed < result.ticks) requestAnimationFrame(animate);
  else {
    mode = 'RESULT'; updateControls();
    get('report').innerHTML = `<h3 id="result-title" class="${result.clear ? 'success' : 'failed'}">${result.clear ? 'CLEAR! 全便、到着。' : 'FAILED / 誤配送あり'}</h3><div class="count">${result.correctCount} <small>/ ${result.parcels.length} 個 正しく配送</small></div><ul class="result-list">${result.parcels.map(p => `<li><span>${String(p.id + 1).padStart(2, '0')} ${marks[p.color]} ${p.color}</span><span>→ ${node(p.destination).label} ${p.correct ? '✓' : '×'}</span></li>`).join('')}</ul><p>${result.clear ? '矢印のループが、ぴったりつながった！' : '矢印を見直して、もう一度届けてみよう。'}</p>`;
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
  else if (color === 'BLUE') { ctx.moveTo(x, y - size); ctx.lineTo(x + size, y + size * .8); ctx.lineTo(x - size, y + size * .8); ctx.closePath(); }
  else { ctx.moveTo(x, y - size); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size); ctx.lineTo(x - size, y); ctx.closePath(); }
  ctx.fill();
}
function draw() {
  ctx.clearRect(0, 0, 640, 540);
  if (stageErrors.length) return;
  ctx.fillStyle = '#d8e0d3';
  for (let x = 20; x < 640; x += 24) for (let y = 16; y < 540; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
  for (const edge of stage.edges) {
    const a = node(edge.from), b = node(edge.to);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 5); ctx.lineTo(b.x, b.y + 5); ctx.strokeStyle = '#c6d0c5'; ctx.lineWidth = 42; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 32; ctx.stroke();
    ctx.setLineDash([3, 12]); ctx.strokeStyle = '#c8d8ce'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(a.x + (b.x - a.x) * .53, a.y + (b.y - a.y) * .53); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(1, 0); ctx.lineTo(-6, 6); ctx.strokeStyle = '#8ca99c'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    if (edge.direction) text(edge.direction, a.x + (b.x - a.x) * .52 + (edge.direction === 'L' ? -24 : 24), a.y + (b.y - a.y) * .52 - 7, 14, teal);
  }
  for (const original of stage.nodes) {
    const n = { ...original, ...original.layout };
    if (n.kind === 'source') {
      roundRect(n.x - 61, n.y - 40, 122, 72, 17, '#c5d5c8');
      roundRect(n.x - 61, n.y - 46, 122, 72, 17, '#CDE8DF', '#afcabe');
      text('SOURCE', n.x, n.y - 17, 12, teal); roundRect(n.x - 32, n.y - 5, 64, 10, 5, teal);
      text('発送口', n.x, n.y + 47, 10, '#6b807e');
    } else if (n.kind === 'switch') {
      if (n.id === selectedSwitch) roundRect(n.x - 54, n.y - 48, 108, 98, 27, '#CDE8DF', teal);
      const dispatch = mode === 'RUN' ? result?.events.find(e => e.from === n.id && e.direction && e.tick === Math.floor(elapsed)) : undefined;
      if (dispatch) {
        ctx.beginPath(); ctx.arc(n.x, n.y, 62 + Math.sin(elapsed * Math.PI * 2) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#247E7266'; ctx.lineWidth = 4; ctx.stroke();
      }
      roundRect(n.x - 47, n.y - 35, 94, 83, 22, '#c6ae66');
      roundRect(n.x - 47, n.y - 41, 94, 83, 22, '#E4B754', '#d3aa49');
      text(n.id.toUpperCase(), n.x, n.y + 4, 26);
      text(dispatch ? `${dispatch.patternIndex! + 1}: ${dispatch.direction}` : (patterns[n.id] ?? []).join(' '), n.x, n.y + 23, 11);
      for (const dx of [-32, 32]) for (const dy of [-26, 26]) { ctx.beginPath(); ctx.arc(n.x + dx, n.y + dy, 3, 0, 7); ctx.fillStyle = '#ad8b3f'; ctx.fill(); }
      text(n.label, n.x, n.y + 65, 10, '#6b807e');
    } else {
      const color = n.accepts!;
      roundRect(n.x - 61, n.y - 47, 122, 82, 18, color === 'RED' ? '#c5685a' : color === 'BLUE' ? '#4473a2' : '#bc963f');
      roundRect(n.x - 61, n.y - 53, 122, 82, 18, colors[color]);
      symbol(color, n.x, n.y - 26, 12);
      roundRect(n.x - 40, n.y - 2, 80, 9, 4, '#243d4a66');
      text(n.label, n.x, n.y + 64, 12, color === 'RED' ? '#b15c4f' : color === 'BLUE' ? '#4473a2' : '#806320');
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
      const x = dest.x - 40 + (index % 5) * 20;
      const y = dest.y + 13 + Math.floor(index / 5) * 20;
      roundRect(x - 8, y - 8, 18, 18, 4, colors[p.color], '#fffdf6');
      symbol(p.color, x + 1, y + 1, 4);
    }
  }
}
function resize() {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.getBoundingClientRect().width;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(width * 540 / 640 * ratio);
  ctx.setTransform(canvas.width / 640, 0, 0, canvas.height / 540, 0, 0);
  draw();
}
new ResizeObserver(resize).observe(canvas);
// The menu is two levels above the Vite source and three above its static build.
document.querySelector<HTMLAnchorElement>('.back')!.href = import.meta.env.DEV ? '../../index.html' : '../../../index.html';
selectStage(0);
