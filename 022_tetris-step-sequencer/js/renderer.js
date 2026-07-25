const BOARD_COLUMNS = 16;
const BOARD_ROWS = 20;
const SEQUENCER_STEPS = 16;

export const PIECE_COLORS = Object.freeze({
  I: "#32d9f5",
  O: "#ffd84a",
  T: "#b96bff",
  S: "#5ee173",
  Z: "#ff5576",
  J: "#5988ff",
  L: "#ff9d45",
});

export const PIECE_SHAPES = Object.freeze({
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
});

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function roundRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function pieceType(value, fallback = null) {
  if (typeof value === "string") return value.toUpperCase();
  return String(
    value?.type ?? value?.pieceType ?? value?.kind ?? value?.name ?? fallback ?? "",
  ).toUpperCase();
}

function cellColor(cell, fallbackType = null) {
  return (
    cell?.color ??
    PIECE_COLORS[pieceType(cell, fallbackType)] ??
    PIECE_COLORS[fallbackType] ??
    "#8a9ab5"
  );
}

function boardFromState(state) {
  const candidates = [
    state?.grid,
    state?.board?.grid,
    state?.board?.cells,
    state?.board,
    state?.cells,
  ];
  return candidates.find(Array.isArray) ?? [];
}

function matrixFromPiece(piece) {
  const matrix =
    piece?.matrix ??
    piece?.shape ??
    piece?.rotationMatrix ??
    piece?.blocks;
  if (
    Array.isArray(matrix) &&
    matrix.length > 0 &&
    Array.isArray(matrix[0])
  ) {
    return matrix;
  }
  return PIECE_SHAPES[pieceType(piece)] ?? [];
}

function positionFromPiece(piece) {
  return {
    x: Number(piece?.x ?? piece?.position?.x ?? piece?.col ?? 0),
    y: Number(piece?.y ?? piece?.position?.y ?? piece?.row ?? 0),
  };
}

function cellsFromPiece(piece) {
  if (!piece) return [];

  let suppliedCells = piece.cells;
  if (typeof suppliedCells === "function") suppliedCells = suppliedCells.call(piece);

  if (Array.isArray(suppliedCells) && suppliedCells.length > 0) {
    const origin = positionFromPiece(piece);
    const absolute =
      piece.cellsAreAbsolute ??
      piece.absoluteCells ??
      suppliedCells.some(
        (cell) =>
          Number(Array.isArray(cell) ? cell[0] : cell?.x ?? cell?.col) >= 4 ||
          Number(Array.isArray(cell) ? cell[1] : cell?.y ?? cell?.row) >= 4,
      );

    return suppliedCells.map((cell) => ({
      x:
        Number(Array.isArray(cell) ? cell[0] : cell?.x ?? cell?.col ?? 0) +
        (absolute ? 0 : Number.isFinite(origin.x) ? origin.x : 0),
      y:
        Number(Array.isArray(cell) ? cell[1] : cell?.y ?? cell?.row ?? 0) +
        (absolute ? 0 : Number.isFinite(origin.y) ? origin.y : 0),
      type: Array.isArray(cell)
        ? pieceType(piece)
        : pieceType(cell, pieceType(piece)),
      color: (Array.isArray(cell) ? null : cell?.color) ?? piece?.color,
      sound: Boolean(Array.isArray(cell) ? false : cell?.sound),
    }));
  }

  const matrix = matrixFromPiece(piece);
  const origin = positionFromPiece(piece);
  const type = pieceType(piece);
  const result = [];

  matrix.forEach((row, localY) => {
    row.forEach((value, localX) => {
      if (!value) return;
      result.push({
        x: origin.x + localX,
        y: origin.y + localY,
        type: pieceType(value, type) || type,
        color: value?.color ?? piece?.color,
      });
    });
  });

  return result;
}

function isOccupied(cell) {
  return cell !== null && cell !== undefined && cell !== false && cell !== 0;
}

/**
 * Canvas renderer for the 16x20 board.
 *
 * Accepted state aliases make the class easy to connect to either a plain
 * object or a Board/Piece model:
 *   grid | board | board.grid
 *   activePiece | currentPiece | piece
 *   ghostPiece | ghost, or ghostY
 */
export class BoardRenderer {
  constructor(canvas, effects = null, options = {}) {
    if (!canvas?.getContext) {
      throw new TypeError("BoardRenderer requires a canvas element.");
    }

    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    if (!this.context) throw new Error("2D canvas is unavailable.");

    this.effects = effects;
    this.columns = options.columns ?? BOARD_COLUMNS;
    this.rows = options.rows ?? BOARD_ROWS;
    this.steps = options.steps ?? SEQUENCER_STEPS;
    this.maxPixelRatio = options.maxPixelRatio ?? 3;
    this.background = options.background ?? "#07101f";
    this._lastState = null;
    this._lastOptions = null;
    this._gameOverWasVisible = false;
    this._resizeFrame = 0;
    this.layout = null;

    this.resize();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        if (this._resizeFrame) cancelAnimationFrame(this._resizeFrame);
        this._resizeFrame = requestAnimationFrame(() => {
          this.resize();
          if (this._lastState) {
            this.render(this._lastState, this._lastOptions ?? {});
          }
        });
      });
      this.resizeObserver.observe(canvas);
    }
  }

  resize(width, height) {
    const rect = this.canvas.getBoundingClientRect?.() ?? {};
    const cssWidth =
      Number(width) ||
      Number(rect.width) ||
      Number(this.canvas.clientWidth) ||
      300;
    const cssHeight =
      Number(height) ||
      Number(rect.height) ||
      Number(this.canvas.clientHeight) ||
      cssWidth * 2;
    const pixelRatio = clamp(
      globalThis.devicePixelRatio || 1,
      1,
      this.maxPixelRatio,
    );

    const backingWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const backingHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (
      this.canvas.width !== backingWidth ||
      this.canvas.height !== backingHeight
    ) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }

    const boardWidth = Math.min(cssWidth, cssHeight * (this.columns / this.rows));
    const cellSize = boardWidth / this.columns;
    const boardHeight = cellSize * this.rows;

    this.layout = {
      cssWidth,
      cssHeight,
      pixelRatio,
      x: (cssWidth - boardWidth) / 2,
      y: (cssHeight - boardHeight) / 2,
      width: boardWidth,
      height: boardHeight,
      cellSize,
    };

    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return this.layout;
  }

  render(state = {}, options = {}) {
    this._lastState = state;
    this._lastOptions = options;

    if (!this.layout) this.resize();
    const ctx = this.context;
    const layout = this.layout;
    const now = options.now ?? performance.now();
    const gameOver = Boolean(state.gameOver ?? state.status === "gameover");
    if (gameOver && !this._gameOverWasVisible) this.effects?.gameOver?.(now);
    if (!gameOver && this._gameOverWasVisible) this.effects?.reset?.();
    this._gameOverWasVisible = gameOver;
    const effectFrame = this.effects?.update?.(now) ?? {
      flashes: [],
      lineFlashes: [],
      particles: [],
      shake: { x: 0, y: 0 },
      gameOverAlpha: 0,
    };

    ctx.setTransform(layout.pixelRatio, 0, 0, layout.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, layout.cssWidth, layout.cssHeight);

    ctx.save();
    ctx.translate(effectFrame.shake?.x ?? 0, effectFrame.shake?.y ?? 0);
    this._drawBoardBackground();

    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.x, layout.y, layout.width, layout.height);
    ctx.clip();

    const grid = boardFromState(state);
    const flashMap = new Map(
      (effectFrame.flashes ?? []).map((flash) => [
        `${flash.x}:${flash.y}`,
        flash,
      ]),
    );

    this._drawLockedCells(grid, flashMap);
    this._drawLineFlashes(effectFrame.lineFlashes ?? []);

    const activePiece =
      state.active ??
      state.activePiece ??
      state.currentPiece ??
      state.piece ??
      null;
    const ghostCells = this._resolveGhostCells(state, activePiece, grid);
    this._drawGhost(ghostCells);
    this._drawPiece(activePiece, flashMap);

    this._drawStepGuides();
    this._drawSequencerBar(state, options);
    this._drawParticles(effectFrame.particles ?? []);
    ctx.restore();

    this._drawBorder();
    ctx.restore();

    const overlayAlpha = Math.max(
      effectFrame.gameOverAlpha ?? 0,
      gameOver && !this.effects ? 0.68 : 0,
    );
    if (overlayAlpha > 0) this._drawGameOverOverlay(overlayAlpha);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    if (this._resizeFrame) cancelAnimationFrame(this._resizeFrame);
    this._lastState = null;
    this._lastOptions = null;
  }

  _drawBoardBackground() {
    const { context: ctx, layout } = this;
    const gradient = ctx.createLinearGradient(
      layout.x,
      layout.y,
      layout.x,
      layout.y + layout.height,
    );
    gradient.addColorStop(0, "#0b1930");
    gradient.addColorStop(1, this.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 190, 233, 0.075)";
    for (let x = 1; x < this.columns; x += 1) {
      const px = layout.x + x * layout.cellSize;
      ctx.beginPath();
      ctx.moveTo(px, layout.y);
      ctx.lineTo(px, layout.y + layout.height);
      ctx.stroke();
    }
    for (let y = 1; y < this.rows; y += 1) {
      const py = layout.y + y * layout.cellSize;
      ctx.beginPath();
      ctx.moveTo(layout.x, py);
      ctx.lineTo(layout.x + layout.width, py);
      ctx.stroke();
    }
  }

  _drawLockedCells(grid, flashMap) {
    const rowOffset = Math.max(0, grid.length - this.rows);
    for (let visibleY = 0; visibleY < this.rows; visibleY += 1) {
      const row = grid[visibleY + rowOffset];
      if (!Array.isArray(row)) continue;

      for (let x = 0; x < this.columns; x += 1) {
        const cell = row[x];
        if (!isOccupied(cell)) continue;
        const type = pieceType(cell);
        this._drawBlock(
          x,
          visibleY,
          cellColor(cell, type),
          flashMap.get(`${x}:${visibleY}`),
          Boolean(cell?.sound),
        );
      }
    }
  }

  _drawPiece(piece, flashMap) {
    const type = pieceType(piece);
    for (const cell of cellsFromPiece(piece)) {
      if (
        cell.y < 0 ||
        cell.y >= this.rows ||
        cell.x < 0 ||
        cell.x >= this.columns
      ) {
        continue;
      }
      this._drawBlock(
        cell.x,
        cell.y,
        cellColor(cell, type),
        flashMap.get(`${cell.x}:${cell.y}`),
        Boolean(cell.sound),
      );
    }
  }

  _resolveGhostCells(state, activePiece, grid) {
    const suppliedGhost = state.ghostPiece ?? state.ghost;
    if (suppliedGhost) return cellsFromPiece(suppliedGhost);
    if (!activePiece) return [];

    const activeCells = cellsFromPiece(activePiece);
    if (!activeCells.length) return [];

    const requestedGhostY = Number(
      state.ghostY ?? activePiece.ghostY ?? state.dropY,
    );
    if (Number.isFinite(requestedGhostY)) {
      const origin = positionFromPiece(activePiece);
      return activeCells.map((cell) => ({
        ...cell,
        y: cell.y + requestedGhostY - origin.y,
      }));
    }

    let offset = 0;
    while (
      activeCells.every((cell) => {
        const x = cell.x;
        const y = cell.y + offset + 1;
        if (x < 0 || x >= this.columns || y >= this.rows) return false;
        if (y < 0) return true;
        return !isOccupied(grid[y]?.[x]);
      })
    ) {
      offset += 1;
    }
    return activeCells.map((cell) => ({ ...cell, y: cell.y + offset }));
  }

  _drawGhost(cells) {
    const { context: ctx, layout } = this;
    ctx.save();
    ctx.lineWidth = Math.max(1.25, layout.cellSize * 0.075);
    ctx.setLineDash([
      Math.max(2, layout.cellSize * 0.18),
      Math.max(2, layout.cellSize * 0.12),
    ]);

    for (const cell of cells) {
      if (
        cell.y < 0 ||
        cell.y >= this.rows ||
        cell.x < 0 ||
        cell.x >= this.columns
      ) {
        continue;
      }
      const x = layout.x + cell.x * layout.cellSize + 2.5;
      const y = layout.y + cell.y * layout.cellSize + 2.5;
      const size = layout.cellSize - 5;
      roundRectPath(ctx, x, y, size, size, layout.cellSize * 0.16);
      ctx.fillStyle = "rgba(225, 246, 255, 0.075)";
      ctx.fill();
      ctx.strokeStyle = "rgba(226, 248, 255, 0.5)";
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBlock(column, row, color, flash = null, sound = false) {
    const { context: ctx, layout } = this;
    const cell = layout.cellSize;
    const gap = Math.max(1, cell * 0.055);
    const baseX = layout.x + column * cell + gap;
    const baseY = layout.y + row * cell + gap;
    const baseSize = cell - gap * 2;
    const scale = flash?.scale ?? 1;
    const size = baseSize * scale;
    const x = baseX - (size - baseSize) / 2;
    const y = baseY - (size - baseSize) / 2;
    const radius = cell * 0.16;

    ctx.save();
    if (flash) {
      ctx.shadowColor = `rgba(255,255,255,${0.55 * flash.alpha})`;
      ctx.shadowBlur = cell * (0.45 + flash.alpha * 0.5);
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = cell * 0.13;
    }

    roundRectPath(ctx, x, y, size, size, radius);
    ctx.fillStyle = color;
    ctx.fill();

    const gloss = ctx.createLinearGradient(x, y, x, y + size);
    gloss.addColorStop(0, "rgba(255,255,255,0.48)");
    gloss.addColorStop(0.18, "rgba(255,255,255,0.16)");
    gloss.addColorStop(0.55, "rgba(255,255,255,0)");
    gloss.addColorStop(1, "rgba(0,0,0,0.28)");
    roundRectPath(ctx, x, y, size, size, radius);
    ctx.fillStyle = gloss;
    ctx.fill();

    roundRectPath(
      ctx,
      x + size * 0.11,
      y + size * 0.1,
      size * 0.78,
      size * 0.22,
      radius * 0.55,
    );
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();

    roundRectPath(ctx, x, y, size, size, radius);
    ctx.lineWidth = Math.max(0.8, cell * 0.035);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();

    if (flash) {
      roundRectPath(ctx, x, y, size, size, radius);
      ctx.fillStyle = `rgba(255,255,255,${0.78 * flash.alpha})`;
      ctx.fill();
    }

    if (sound) {
      ctx.beginPath();
      ctx.arc(
        x + size / 2,
        y + size / 2,
        Math.max(2, size * 0.16),
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "#020409";
      ctx.shadowColor = "rgba(255,255,255,.28)";
      ctx.shadowBlur = Math.max(1, cell * 0.08);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawLineFlashes(flashes) {
    const { context: ctx, layout } = this;
    for (const flash of flashes) {
      const y = layout.y + flash.row * layout.cellSize;
      const gradient = ctx.createLinearGradient(
        layout.x,
        y,
        layout.x + layout.width,
        y,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(
        0.5,
        `rgba(255,255,255,${flash.alpha ?? 0})`,
      );
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(layout.x, y, layout.width, layout.cellSize);
    }
  }

  _drawStepGuides() {
    const { context: ctx, layout } = this;
    ctx.save();
    ctx.strokeStyle = "rgba(103, 224, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let step = 1; step < this.steps; step += 1) {
      const x = layout.x + (step / this.steps) * layout.width;
      ctx.beginPath();
      ctx.moveTo(x, layout.y);
      ctx.lineTo(x, layout.y + layout.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSequencerBar(state, options) {
    const { context: ctx, layout } = this;
    const rawStep =
      options.stepPosition ??
      options.step ??
      state.sequencer?.position ??
      state.sequencer?.step ??
      state.currentStep;
    if (!Number.isFinite(Number(rawStep))) return;

    const numericStep = Number(rawStep);
    const wrapped = ((numericStep % this.steps) + this.steps) % this.steps;
    const isWholeStep = Math.abs(wrapped - Math.round(wrapped)) < 0.0001;
    const normalized = isWholeStep
      ? (wrapped + 0.5) / this.steps
      : wrapped / this.steps;
    const x = layout.x + normalized * layout.width;

    ctx.save();
    ctx.shadowColor = "#bdf7ff";
    ctx.shadowBlur = Math.max(10, layout.cellSize * 0.8);
    ctx.strokeStyle = "rgba(230, 254, 255, 0.98)";
    ctx.lineWidth = Math.max(1.5, layout.cellSize * 0.065);
    ctx.beginPath();
    ctx.moveTo(x, layout.y);
    ctx.lineTo(x, layout.y + layout.height);
    ctx.stroke();

    ctx.shadowBlur = Math.max(5, layout.cellSize * 0.35);
    ctx.strokeStyle = "rgba(73, 224, 255, 0.72)";
    ctx.lineWidth = Math.max(3.5, layout.cellSize * 0.16);
    ctx.globalAlpha = 0.28;
    ctx.stroke();
    ctx.restore();
  }

  _drawParticles(particles) {
    const { context: ctx, layout } = this;
    for (const particle of particles) {
      const x = layout.x + particle.x * layout.cellSize;
      const y = layout.y + particle.y * layout.cellSize;
      const size = Math.max(1.5, particle.size * layout.cellSize);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = clamp(particle.alpha);
      ctx.fillStyle = particle.color || "#ffffff";
      ctx.shadowColor = particle.color || "#ffffff";
      ctx.shadowBlur = size * 1.8;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  _drawBorder() {
    const { context: ctx, layout } = this;
    ctx.save();
    ctx.strokeStyle = "rgba(129, 230, 255, 0.44)";
    ctx.lineWidth = Math.max(1.2, layout.cellSize * 0.055);
    ctx.shadowColor = "rgba(64, 217, 255, 0.35)";
    ctx.shadowBlur = layout.cellSize * 0.32;
    ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);
    ctx.restore();
  }

  _drawGameOverOverlay(alpha) {
    const { context: ctx, layout } = this;
    ctx.save();
    ctx.fillStyle = `rgba(1, 5, 14, ${clamp(alpha, 0, 0.75)})`;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
    ctx.restore();
  }
}

export default BoardRenderer;
