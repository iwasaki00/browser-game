const DEFAULT_COLUMNS = 16;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

function normalizeCell(cell) {
  if (Array.isArray(cell)) {
    return { x: Number(cell[0]), y: Number(cell[1]), color: cell[2] };
  }

  return {
    x: Number(cell?.x ?? cell?.col ?? cell?.column),
    y: Number(cell?.y ?? cell?.row),
    color: cell?.color,
    type: cell?.type,
  };
}

/**
 * Keeps short-lived visual effects separate from the game rules.
 *
 * Coordinates are expressed in board cells. The renderer converts them to
 * pixels, so effects remain correct after an orientation change or resize.
 */
export class EffectsManager {
  constructor({ columns = DEFAULT_COLUMNS, now = () => performance.now() } = {}) {
    this.columns = columns;
    this._now = now;
    this.flashDuration = 150;
    this.lineFlashDuration = 260;
    this.gameOverFadeDuration = 380;
    this.reset();
  }

  reset() {
    this.flashes = new Map();
    this.lineFlashes = [];
    this.particles = [];
    this.shakeEffect = null;
    this.gameOverStartedAt = null;
    this.screenFlashStartedAt = null;
    this.screenFlashDuration = 220;
    this.frame = this._emptyFrame();
  }

  /**
   * Adds the white pulse used when the sequencer triggers board cells.
   * Accepts [{x, y}], [[x, y]], or cells containing row/column aliases.
   */
  flashCells(cells = [], now = this._now()) {
    for (const source of cells) {
      const cell = normalizeCell(source);
      if (!Number.isFinite(cell.x) || !Number.isFinite(cell.y)) continue;

      this.flashes.set(`${cell.x}:${cell.y}`, {
        ...cell,
        startedAt: now,
        duration: this.flashDuration,
      });
    }
  }

  /**
   * Creates a fast row glow, particles, and a small shake.
   */
  lineClear(rows = [], options = {}) {
    const now = options.now ?? this._now();
    const columns = options.columns ?? this.columns;
    const rowList = Array.isArray(rows) ? rows : [rows];

    for (const rowSource of rowList) {
      const row = Number(
        typeof rowSource === "object"
          ? rowSource?.y ?? rowSource?.row
          : rowSource,
      );
      if (!Number.isFinite(row)) continue;

      this.lineFlashes.push({
        row,
        startedAt: now,
        duration: this.lineFlashDuration,
      });

      for (let x = 0; x < columns; x += 1) {
        const color =
          options.colors?.[x] ??
          rowSource?.cells?.[x]?.color ??
          rowSource?.colors?.[x] ??
          "#ffffff";

        // Two light fragments per cell keep the effect readable on small
        // iPhone screens without creating an expensive particle system.
        const fragments = Math.max(2, Math.floor(options.fragments ?? 2));
        for (let fragment = 0; fragment < fragments; fragment += 1) {
          this.particles.push({
            x: x + 0.5 + (Math.random() - 0.5) * 0.42,
            y: row + 0.5 + (Math.random() - 0.5) * 0.32,
            vx: (Math.random() - 0.5) * 5.4,
            vy: -1.8 - Math.random() * 4,
            gravity: 7 + Math.random() * 3,
            size: 0.11 + Math.random() * 0.16,
            rotation: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 9,
            color,
            startedAt: now,
            duration: 430 + Math.random() * 280,
          });
        }
      }
    }

    if (rowList.length) {
      this.shake(4 + Math.min(rowList.length, 4) * 1.2, 180, now);
    }
  }

  shake(intensity = 6, duration = 180, now = this._now()) {
    this.shakeEffect = {
      intensity: Math.max(0, intensity),
      duration: Math.max(1, duration),
      startedAt: now,
    };
  }

  gameOver(now = this._now()) {
    if (this.gameOverStartedAt === null) {
      this.gameOverStartedAt = now;
      this.shake(8, 260, now);
    }
  }

  screenFlash(now = this._now(), duration = 220) {
    this.screenFlashStartedAt = now;
    this.screenFlashDuration = Math.max(80, Number(duration) || 220);
  }

  /**
   * Advances effect lifetimes and returns an immutable-by-convention frame.
   * Call once immediately before drawing.
   */
  update(now = this._now()) {
    const flashes = [];
    for (const [key, flash] of this.flashes) {
      const progress = (now - flash.startedAt) / flash.duration;
      if (progress >= 1) {
        this.flashes.delete(key);
        continue;
      }

      const visibleProgress = clamp(progress);
      flashes.push({
        x: flash.x,
        y: flash.y,
        color: flash.color,
        type: flash.type,
        progress: visibleProgress,
        alpha: Math.pow(1 - visibleProgress, 1.7),
        scale: 1 + Math.sin(visibleProgress * Math.PI) * 0.1,
        bounce: -Math.sin(visibleProgress * Math.PI) * 0.12,
      });
    }

    const lineFlashes = [];
    this.lineFlashes = this.lineFlashes.filter((flash) => {
      const progress = (now - flash.startedAt) / flash.duration;
      if (progress >= 1) return false;
      const visibleProgress = clamp(progress);
      lineFlashes.push({
        row: flash.row,
        progress: visibleProgress,
        alpha: (1 - visibleProgress) * 0.85,
      });
      return true;
    });

    const particles = [];
    this.particles = this.particles.filter((particle) => {
      const age = now - particle.startedAt;
      const progress = age / particle.duration;
      if (progress >= 1) return false;

      const seconds = Math.max(0, age) / 1000;
      particles.push({
        x: particle.x + particle.vx * seconds,
        y:
          particle.y +
          particle.vy * seconds +
          0.5 * particle.gravity * seconds * seconds,
        size: particle.size * (1 - progress * 0.45),
        rotation: particle.rotation + particle.spin * seconds,
        color: particle.color,
        alpha: Math.pow(1 - clamp(progress), 1.45),
      });
      return true;
    });

    let shake = { x: 0, y: 0 };
    if (this.shakeEffect) {
      const age = now - this.shakeEffect.startedAt;
      const progress = age / this.shakeEffect.duration;
      if (progress >= 1) {
        this.shakeEffect = null;
      } else {
        const amount =
          this.shakeEffect.intensity * (1 - easeOutCubic(clamp(progress)));
        // Layered sine waves avoid a new random offset on every high-refresh
        // frame and therefore look less jittery on ProMotion displays.
        shake = {
          x: Math.sin(age * 0.19) * amount,
          y: Math.cos(age * 0.27) * amount * 0.68,
        };
      }
    }

    const gameOverAlpha =
      this.gameOverStartedAt === null
        ? 0
        : clamp(
            (now - this.gameOverStartedAt) / this.gameOverFadeDuration,
          ) * 0.68;
    let screenFlashAlpha = 0;
    if (this.screenFlashStartedAt !== null) {
      const progress =
        (now - this.screenFlashStartedAt) / this.screenFlashDuration;
      if (progress >= 1) this.screenFlashStartedAt = null;
      else screenFlashAlpha = Math.pow(1 - clamp(progress), 2) * 0.72;
    }

    this.frame = {
      flashes,
      lineFlashes,
      particles,
      shake,
      gameOverAlpha,
      screenFlashAlpha,
      active:
        flashes.length > 0 ||
        lineFlashes.length > 0 ||
        particles.length > 0 ||
        Boolean(this.shakeEffect) ||
        screenFlashAlpha > 0 ||
        (this.gameOverStartedAt !== null && gameOverAlpha < 0.68),
    };

    return this.frame;
  }

  get isActive() {
    return Boolean(this.frame.active);
  }

  _emptyFrame() {
    return {
      flashes: [],
      lineFlashes: [],
      particles: [],
      shake: { x: 0, y: 0 },
      gameOverAlpha: 0,
      screenFlashAlpha: 0,
      active: false,
    };
  }
}

export default EffectsManager;
