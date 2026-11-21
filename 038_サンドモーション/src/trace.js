// Free-mode input only. Normal gravity and hourglass physics never call this.
export const TRACE = Object.freeze({
  widths: Object.freeze({ small: 3, medium: 5, large: 8 }),
  strengths: Object.freeze({ weak: .35, standard: .65, strong: 1 }),
  chainRadius: 3, chainNodes: 48, maxSamples: 768, maxWork: 100000
});
export const traceRadius = (width, size = 'small') => (TRACE.widths[size] ?? TRACE.widths.small) * width / 180;
const hash = value => { value = Math.imul(value ^ value >>> 16, 0x45d9f3b); return (value ^ value >>> 16) >>> 0; };

function buffers(e) {
  if (e.traceWork?.moves.length === e.count) return e.traceWork;
  return e.traceWork = { moves: new Uint8Array(e.count), seen: new Uint32Array(e.grid.length),
    touched: new Uint8Array(e.count),
    queue: new Int32Array(128), parent: new Int16Array(128), depth: new Uint8Array(128),
    cells: new Int32Array(4), ids: new Int32Array(4), stamp: 0 };
}

function commit(e, id, cell, work) {
  e.x[id] = cell % e.width; e.y[id] = Math.floor(cell / e.width);
  if (e.fixed[id]) { e.fixed[id] = 0; e.fixedCount--; }
  e.active[id] = 1; e.vx[id] = 0; e.vy[id] = 0; work.moves[id]++;
  work.touched[id] = 1;
}

// Display-only grain variation, only where trace has actually moved a grain.
export const traceShade = (e, id) => e.traceWork?.touched[id] ? .98 + (hash(id + 1) % 5) * .01 : 1;

// Vacancy propagation moves every involved ID by exactly one cardinal cell.
function push(e, start, sx, sy, cx, cy, reach, radius, budget, work, stats) {
  const limit = Math.min(128, Math.ceil(TRACE.chainNodes * e.width / 180));
  let head = 0, tail = 1, end = -1;
  work.queue[0] = start; work.parent[0] = -1; work.depth[0] = 0;
  if (++work.stamp === 0xffffffff) { work.seen.fill(0); work.stamp = 1; }
  work.seen[start] = work.stamp;
  while (head < tail && stats.work < stats.limit) {
    const index = head++, cell = work.queue[index], x = cell % e.width, y = Math.floor(cell / e.width);
    if (work.depth[index] >= reach) continue;
    for (let n = 0; n < 4 && stats.work < stats.limit; n++) {
      stats.work++;
      const dx = n === 0 ? sx : n === 1 ? -sy : n === 2 ? sy : -sx;
      const dy = n === 0 ? sy : n === 1 ? sx : n === 2 ? -sx : -sy;
      const nx = x + dx, ny = y + dy, next = ny * e.width + nx;
      if (nx < 0 || nx >= e.width || ny < 0 || ny >= e.height || e.walls[next] ||
          (nx - cx) ** 2 + (ny - cy) ** 2 > radius ** 2 || work.seen[next] === work.stamp) continue;
      const id = e.grid[next] - 1;
      if (id >= 0 && work.moves[id] >= budget) continue;
      if (tail >= limit) break;
      work.seen[next] = work.stamp; work.queue[tail] = next;
      work.parent[tail] = index; work.depth[tail] = work.depth[index] + 1;
      if (id < 0) { end = tail; break; }
      tail++;
    }
    if (end >= 0) break;
  }
  if (end < 0) return false;
  while (work.parent[end] >= 0) {
    const fromIndex = work.parent[end], from = work.queue[fromIndex], to = work.queue[end];
    const id = e.grid[from] - 1;
    e.grid[to] = id + 1; e.grid[from] = 0; commit(e, id, to, work); stats.moves++;
    end = fromIndex;
  }
  return true;
}

// In a full patch there is no local vacancy. A four-grain contact cycle shears
// the pattern without holes, overlaps, crossing paths or a long-range push.
function shear(e, x, y, sx, sy, turn, cx, cy, radius, budget, work, stats) {
  const px = -sy * turn, py = sx * turn;
  for (let n = 0; n < 4; n++) {
    const qx = x + (n === 1 || n === 2 ? sx : 0) + (n >= 2 ? px : 0);
    const qy = y + (n === 1 || n === 2 ? sy : 0) + (n >= 2 ? py : 0);
    if (qx < 0 || qx >= e.width || qy < 0 || qy >= e.height || (qx - cx) ** 2 + (qy - cy) ** 2 > radius ** 2) return false;
    const cell = qy * e.width + qx, id = e.grid[cell] - 1;
    if (e.walls[cell] || id < 0 || work.moves[id] >= budget) return false;
    work.cells[n] = cell; work.ids[n] = id;
  }
  for (let n = 0; n < 4; n++) {
    const to = work.cells[(n + 1) % 4], id = work.ids[n];
    e.grid[to] = id + 1; commit(e, id, to, work);
  }
  stats.moves += 4; stats.cycles++; return true;
}

export function naturalTrace(e, ax, ay, bx, by, radius, elapsedMs = 50, strength = 'standard') {
  if (!e.tracing || ![ax, ay, bx, by, radius, elapsedMs].every(Number.isFinite) || radius <= 0) return 0;
  const length = Math.hypot(bx - ax, by - ay);
  if (length < .1) return 0;
  const scale = e.width / 180, ux = (bx - ax) / length, uy = (by - ay) / length;
  const speed = Math.min(1, length / scale / Math.max(8, elapsedMs) / 1.5);
  const force = TRACE.strengths[strength] ?? TRACE.strengths.standard;
  const steps = Math.min(TRACE.maxSamples, Math.max(1, Math.ceil(length / scale)));
  const reach = Math.max(1, Math.ceil(TRACE.chainRadius * scale));
  const budget = Math.max(1, Math.ceil(scale * (speed > .6 ? 2 : 1)));
  const work = buffers(e); work.moves.fill(0);
  const stats = e.lastTraceStats = { work: 0, moves: 0, cycles: 0, samples: steps + 1, budget, reach, limit: 0 };
  const serial = e.traceSerial = (e.traceSerial || 0) + 1;
  // Interpolated dabs have fixed screen-space spacing, independent of event rate.
  for (let sample = 0; sample <= steps && stats.work < TRACE.maxWork; sample++) {
    stats.limit = Math.floor(TRACE.maxWork * (sample + 1) / (steps + 1));
    const cx = ax + (bx - ax) * sample / steps, cy = ay + (by - ay) * sample / steps;
    const minX = Math.max(0, Math.ceil(cx - radius)), maxX = Math.min(e.width - 1, Math.floor(cx + radius));
    const minY = Math.max(0, Math.ceil(cy - radius)), maxY = Math.min(e.height - 1, Math.floor(cy + radius));
    for (let y = minY; y <= maxY && stats.work < stats.limit; y++) for (let x = minX; x <= maxX && stats.work < stats.limit; x++) {
      stats.work++;
      const distance = Math.hypot(x - cx, y - cy) / radius;
      if (distance >= 1) continue;
      const cell = y * e.width + x, id = e.grid[cell] - 1;
      if (id < 0 || work.moves[id] >= budget) continue;
      const noise = hash(cell + Math.imul(serial, 17431) + sample * 271);
      if ((noise & 65535) / 65536 > force * (1 - distance) ** 2 * (.45 + speed * .35)) continue;
      const side = Math.sign((x - cx) * -uy + (y - cy) * ux) || (noise & 1 ? 1 : -1);
      const jitter = ((noise >>> 16) / 65535 - .5) * (.15 + speed * .3);
      const fx = -uy * side + ux * (.15 + speed * .4) + jitter;
      const fy = ux * side + uy * (.15 + speed * .4) - jitter;
      const forward = (noise >>> 24) / 256 < .06 + speed * .22;
      const tx = forward ? ux : fx, ty = forward ? uy : fy;
      const sx = Math.abs(tx) >= Math.abs(ty) ? Math.sign(tx) : 0, sy = sx ? 0 : Math.sign(ty);
      if (!push(e, cell, sx, sy, cx, cy, reach, radius + scale, budget, work, stats))
        shear(e, x, y, sx, sy, noise & 2 ? 1 : -1, cx, cy, radius, budget, work, stats);
    }
  }
  return stats.moves;
}
