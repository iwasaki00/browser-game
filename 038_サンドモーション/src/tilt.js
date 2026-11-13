// Input only: no particle data or simulation rules live in this module.
export const TILT = Object.freeze({
  gain: 2.5, deadZoneDegrees: 4, hysteresisDegrees: 3,
  smoothingMs: 100, minimumProjection: 0.12,
  sensorTimeoutMs: 4000, watchdogMs: 500,
  resumeStableMs: 350, resumeToleranceDegrees: 2.5, resumeMinSamples: 3,
  maxSampleGapMs: 250
});
const radians = Math.PI / 180;
const wrap = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
const DIRECTIONS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

export function orientationRoll({ beta, gamma }, parameters = TILT) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma) || Math.abs(beta) > 180 || Math.abs(gamma) > 90) return null;
  // Gravity projected onto the portrait screen. Raw gamma alone is unreliable
  // near a vertical hold (Euler-angle singularity). Alpha/compass is unnecessary.
  const x = Math.cos(beta * radians) * Math.sin(gamma * radians);
  const y = Math.sin(beta * radians);
  if (Math.hypot(x, y) < parameters.minimumProjection) return null;
  return Math.atan2(x, y) / radians;
}

export class TiltMapper {
  constructor(parameters = {}) {
    this.parameters = { ...TILT, ...parameters };
    this.baseline = null;
    this.resetFilter();
  }
  resetFilter() { this.filtered = 0; this.direction = 0; this.lastTime = null; }
  calibrate(roll) { this.baseline = roll; this.resetFilter(); }
  update(roll, now) {
    if (this.baseline === null) this.calibrate(roll);
    const p = this.parameters;
    const target = wrap(roll - this.baseline);
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(100, now - this.lastTime));
    const alpha = p.smoothingMs ? 1 - Math.exp(-dt / p.smoothingMs) : 1;
    this.filtered = wrap(this.filtered + wrap(target - this.filtered) * alpha);
    this.lastTime = now;
    const input = Math.abs(this.filtered) <= p.deadZoneDegrees ? 0 : this.filtered;
    const angle = Math.max(-180, Math.min(180, input * p.gain));
    const center = this.direction * 45;
    if (Math.abs(wrap(angle - center)) > 22.5 + p.hysteresisDegrees * p.gain) {
      this.direction = ((Math.round(angle / 45) % 8) + 8) % 8;
    }
    return DIRECTIONS[this.direction];
  }
}

export function isMobileDevice(navigator) {
  return navigator.userAgentData?.mobile === true || /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isLandscapeDisplay({ type, angle, legacyAngle, width, height }) {
  if (/^(portrait|landscape)-/.test(type || '')) return type.startsWith('landscape');
  const rotation = Number.isFinite(angle) ? angle : legacyAngle;
  if (Number.isFinite(rotation)) return Math.abs(rotation % 180) === 90;
  return width > height;
}

export class TiltController {
  constructor(environment, { onGravity = () => {}, onState = () => {} } = {}, parameters = {}) {
    this.env = environment;
    this.onGravity = onGravity; this.onState = onState;
    this.parameters = { ...TILT, ...parameters };
    this.mapper = new TiltMapper(this.parameters);
    this.mode = 'manual'; this.starting = false; this.pauseReason = null;
    this.reason = '手動で操作しています。';
    this.generation = 0; this.watchdog = null; this.listening = false;
    this.lastRoll = null; this.lastReceived = null;
    this.listener = event => this.receive(event);
  }
  get paused() { return this.pauseReason !== null; }
  publish() { this.onState(this); }
  clearStability() { this.stableSince = null; this.stableRoll = null; this.stableSamples = 0; this.sampleTime = null; }
  stopListening() {
    if (this.listening) this.env.removeEventListener('deviceorientation', this.listener);
    this.listening = false;
    if (this.watchdog !== null) this.env.clearInterval(this.watchdog);
    this.watchdog = null;
  }
  manual(reason = '手動で操作しています。') {
    this.generation++; this.stopListening();
    this.mode = 'manual'; this.starting = false; this.pauseReason = null;
    this.reason = reason; this.clearStability(); this.publish();
  }
  async start() {
    if (this.starting || this.mode === 'tilt') return;
    const token = ++this.generation;
    if (!this.env.isSecureContext) {
      this.manual('傾き操作にはHTTPSなどの安全な接続が必要です。手動で操作できます。'); return;
    }
    const orientation = this.env.DeviceOrientationEvent;
    if (!orientation) { this.manual('この端末・ブラウザは傾きセンサーに対応していません。手動で操作できます。'); return; }
    this.starting = true; this.reason = 'センサーの許可を確認しています…'; this.publish();
    try {
      // Called synchronously from the click handler, before any await: iOS
      // requestPermission must retain transient user activation.
      if (typeof orientation.requestPermission === 'function') {
        const permission = await orientation.requestPermission();
        if (token !== this.generation) return;
        if (permission !== 'granted') {
          this.manual('傾きセンサーの利用が許可されませんでした。手動で操作できます。'); return;
        }
      }
      if (token !== this.generation) return;
      this.mapper = new TiltMapper(this.parameters);
      this.lastRoll = null; this.lastReceived = this.env.now();
      this.clearStability();
      this.reason = '有効な傾きを待っています。端末を縦に起こして持ってください。';
      this.listening = true;
      this.env.addEventListener('deviceorientation', this.listener);
      this.watchdog = this.env.setInterval(() => this.checkTimeout(), this.parameters.watchdogMs);
      this.publish();
    } catch {
      if (token === this.generation) this.manual('傾きセンサーを開始できませんでした。サイトの許可設定を確認してください。手動で操作できます。');
    }
  }
  checkTimeout() {
    if (this.env.hidden()) { this.lastReceived = this.env.now(); return; }
    if (this.env.now() - this.lastReceived >= this.parameters.sensorTimeoutMs) {
      this.manual('有効な傾きの値を受信できません。端末を縦に起こして再試行してください。手動で操作できます。');
    }
  }
  updateDisplay() {
    if (this.mode !== 'tilt') return;
    if (this.env.mobile() && this.env.landscape()) {
      if (this.pauseReason !== 'landscape') {
        this.pauseReason = 'landscape'; this.clearStability(); this.publish();
      }
    } else if (this.pauseReason === 'landscape') {
      this.pauseReason = 'settling'; this.mapper.resetFilter(); this.clearStability(); this.publish();
    }
  }
  receive(event) {
    if (!this.listening || this.env.hidden()) return;
    const roll = orientationRoll(event, this.parameters);
    if (roll === null) return;
    const now = this.env.now();
    this.lastRoll = roll; this.lastReceived = now;
    if (this.starting) {
      this.starting = false; this.mode = 'tilt'; this.mapper.calibrate(roll);
      this.reason = '傾きで操作しています。今の持ち方を基準にしました。';
      this.updateDisplay();
      // Do not change the engine while a landscape display is paused.
      if (!this.paused) this.onGravity(0, 1);
      this.publish(); return;
    }
    this.updateDisplay();
    if (this.pauseReason === 'landscape') return;
    if (this.pauseReason === 'settling') {
      this.mapper.update(roll, now);
      const p = this.parameters;
      if (this.stableSince === null || now - this.sampleTime > p.maxSampleGapMs ||
          Math.abs(wrap(roll - this.stableRoll)) > p.resumeToleranceDegrees) {
        this.stableSince = now; this.stableRoll = roll; this.stableSamples = 0;
      }
      this.sampleTime = now; this.stableSamples++;
      if (now - this.stableSince < p.resumeStableMs || this.stableSamples < p.resumeMinSamples) return;
      this.pauseReason = null; this.publish();
    }
    const [x, y] = this.mapper.update(roll, now);
    this.onGravity(x, y);
  }
  calibrate() {
    if (this.mode !== 'tilt' || this.paused || this.lastRoll === null ||
        this.env.now() - this.lastReceived > this.parameters.maxSampleGapMs) return false;
    this.mapper.calibrate(this.lastRoll); this.onGravity(0, 1);
    this.reason = '今の持ち方に基準を合わせました。'; this.publish(); return true;
  }
}
