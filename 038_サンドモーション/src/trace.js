// Free-mode input only. Normal gravity and hourglass physics never call this.
export const TRACE = Object.freeze({
  widths: Object.freeze({ small: 3, medium: 5, large: 8 }),
  strengths: Object.freeze({ weak: .3, standard: .7, strong: 1 }),
  profiles: Object.freeze({
    weak: Object.freeze({ steps: 1, halo: 0, ring: 2, passes: 1, work: 60000 }),
    standard: Object.freeze({ steps: 3, halo: 1, ring: 3, passes: 2, work: 120000 }),
    strong: Object.freeze({ steps: 5, halo: 2, ring: 4, passes: 3, work: 180000 })
  }),
  chainRadius: 4, chainNodes: 40, maxSamples: 768, maxWork: 180000, resolutionMobilityExponent: .5
});
export const traceRadius = (width, size = 'medium') => (TRACE.widths[size] ?? TRACE.widths.medium) * width / 180;
const hash = value => { value = Math.imul(value ^ value >>> 16, 0x45d9f3b); return (value ^ value >>> 16) >>> 0; };

function buffers(e) {
  if (e.traceWork?.moves.length === e.count && e.traceWork.dirty?.length === e.grid.length) return e.traceWork;
  return e.traceWork = { moves: new Uint8Array(e.count), seen: new Uint32Array(e.grid.length),
    touched: new Uint8Array(e.count),
    dirty: new Uint8Array(e.grid.length),
    queue: new Int32Array(128), parent: new Int16Array(128), depth: new Uint8Array(128),
    cells: new Int32Array(32), ids: new Int32Array(32), stamp: 0 };
}

function commit(e, id, cell, work) {
  const oldX = e.x[id], oldY = e.y[id];
  e.x[id] = cell % e.width; e.y[id] = Math.floor(cell / e.width);
  if (e.fixed[id]) { e.fixed[id] = 0; e.fixedCount--; }
  e.active[id] = 1; e.vx[id] = 0; e.vy[id] = 0; work.moves[id]++;
  work.touched[id] = 1;
  // Gravity is frozen here. Defer duplicate neighbor wakes until tool exit.
  work.dirty[oldY * e.width + oldX] = 1; work.dirty[cell] = 1;
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
  stats.maxChainLength = Math.max(stats.maxChainLength, work.depth[end]);
  while (work.parent[end] >= 0) {
    const fromIndex = work.parent[end], from = work.queue[fromIndex], to = work.queue[end];
    const id = e.grid[from] - 1;
    e.grid[to] = id + 1; e.grid[from] = 0; commit(e, id, to, work); stats.moves++;
    end = fromIndex;
  }
  return true;
}

// Directional rectangular contact ring. All grains move one cardinal cell;
// no random distant swaps, overlaps or momentary unregistered particles.
function shear(e, x, y, sx, sy, turn, cx, cy, radius, budget, work, stats, ringLength) {
  const px = -sy * turn, py = sx * turn;
  const length = Math.max(2, Math.ceil(ringLength * e.width / 180));
  const breadth = Math.max(2, Math.ceil(2 * e.width / 180));
  const count = 2 * (length + breadth) - 4;
  if (count > work.cells.length) return false;
  for (let n = 0; n < count; n++) {
    let along, across;
    if (n < length) { along = n; across = 0; }
    else if (n < length + breadth - 1) { along = length - 1; across = n - length + 1; }
    else if (n < 2 * length + breadth - 2) { along = 2 * length + breadth - 3 - n; across = breadth - 1; }
    else { along = 0; across = count - n; }
    const qx = x + along * sx + across * px, qy = y + along * sy + across * py;
    if (qx < 0 || qx >= e.width || qy < 0 || qy >= e.height || (qx - cx) ** 2 + (qy - cy) ** 2 > radius ** 2) return false;
    const cell = qy * e.width + qx, id = e.grid[cell] - 1;
    if (e.walls[cell] || id < 0 || work.moves[id] >= budget) return false;
    work.cells[n] = cell; work.ids[n] = id;
  }
  for (let n = 0; n < count; n++) {
    const to = work.cells[(n + 1) % count], id = work.ids[n];
    e.grid[to] = id + 1; commit(e, id, to, work);
  }
  stats.moves += count; stats.mixMoves += count; stats.cycles++; return true;
}

// Dense patches must not spend their whole input budget on fruitless BFS.
// Probe a bounded lane and adjacent vacancies before choosing push or mixing.
function vacancyNearby(e, x, y, sx, sy, reach, work, stats) {
  for (let direction = 0; direction < 4 && stats.work < stats.limit; direction++) {
    const dx = direction === 0 ? sx : direction === 1 ? -sy : direction === 2 ? sy : -sx;
    const dy = direction === 0 ? sy : direction === 1 ? sx : direction === 2 ? -sx : -sy;
    const distanceLimit = direction === 0 ? reach : 1;
    for (let distance = 1; distance <= distanceLimit && stats.work < stats.limit; distance++) {
      stats.work++;
      const nx = x + dx * distance, ny = y + dy * distance, cell = ny * e.width + nx;
      if (nx < 0 || nx >= e.width || ny < 0 || ny >= e.height || e.walls[cell]) break;
      if (!e.grid[cell]) return true;
    }
  }
  return false;
}

export function naturalTrace(e, ax, ay, bx, by, radius, elapsedMs = 50, strength = 'standard') {
  if (!e.tracing || ![ax, ay, bx, by, radius, elapsedMs].every(Number.isFinite) || radius <= 0) return 0;
  const length = Math.hypot(bx - ax, by - ay);
  if (length < .1) return 0;
  const scale = e.width / 180, ux = (bx - ax) / length, uy = (by - ay) / length;
  const speed = Math.min(1, length / scale / Math.max(8, elapsedMs) / 1.5);
  const force = TRACE.strengths[strength] ?? TRACE.strengths.standard;
  const profile = TRACE.profiles[strength] ?? TRACE.profiles.standard;
  const steps = Math.min(TRACE.maxSamples, Math.max(1, Math.ceil(length / scale)));
  const influence = radius + profile.halo * scale;
  const reach = Math.max(1, Math.ceil((TRACE.chainRadius + profile.halo) * scale));
  const resolutionGain = Math.max(1, scale) ** TRACE.resolutionMobilityExponent;
  const budget = Math.max(1, Math.ceil(resolutionGain * scale * (profile.steps + (speed > .6 ? (strength === 'weak' ? 1 : 2) : 0))));
  const work = buffers(e); work.moves.fill(0);
  const stats = e.lastTraceStats = { work: 0, moves: 0, cycles: 0, mixMoves: 0, pushes: 0, chainMoves: 0, maxChainLength: 0,
    samples: steps + 1, budget, reach, influenceRadius: influence, workLimit: profile.work, limit: 0 };
  const serial = e.traceSerial = (e.traceSerial || 0) + 1;
  // Interpolated dabs have fixed screen-space spacing, independent of event rate.
  for (let sample = 0; sample <= steps && stats.work < profile.work; sample++) {
    stats.limit = Math.floor(profile.work * (sample + 1) / (steps + 1));
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
      if ((noise & 65535) / 65536 > force * (.2 + .8 * (1 - distance)) * (.7 + speed * .3)) continue;
      const side = Math.sign((x - cx) * -uy + (y - cy) * ux) || (noise & 1 ? 1 : -1);
      const jitter = ((noise >>> 16) / 65535 - .5) * (.15 + speed * .3);
      const fx = -uy * side + ux * (.15 + speed * .4) + jitter;
      const fy = ux * side + uy * (.15 + speed * .4) - jitter;
      const forward = (noise >>> 24) / 256 < .06 + speed * .22;
      const tx = forward ? ux : fx, ty = forward ? uy : fy;
      const sx = Math.abs(tx) >= Math.abs(ty) ? Math.sign(tx) : 0, sy = sx ? 0 : Math.sign(ty);
      const before = stats.moves;
      const pushed = vacancyNearby(e, x, y, sx, sy, reach, work, stats) &&
        push(e, cell, sx, sy, cx, cy, reach, influence, budget, work, stats);
      if (pushed) {
        stats.pushes++; stats.chainMoves += stats.moves - before;
      } else {
        for (let pass = 0; pass < profile.passes && stats.work < stats.limit; pass++) {
          stats.work += Math.min(work.cells.length, stats.limit - stats.work);
          if (!shear(e, x, y, sx, sy, noise & 2 ? 1 : -1, cx, cy, influence, budget, work, stats, profile.ring)) {
            if (pass === 0) shear(e, x, y, sx, sy, noise & 2 ? -1 : 1, cx, cy, influence, budget, work, stats, 2);
            break;
          }
        }
      }
    }
  }
  return stats.moves;
}
