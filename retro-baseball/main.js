(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const retryButton = document.getElementById("retryButton");

  const W = canvas.width;
  const H = canvas.height;
  const DPR_SCALE = 1;

  const COLORS = {
    sky: "#5eb6cf",
    grass: "#2d9b52",
    grassDark: "#1f7a43",
    dirt: "#c77b36",
    dirtDark: "#8f4c25",
    chalk: "#fff1c7",
    ink: "#1d1410",
    white: "#fff9dc",
    red: "#e74b3c",
    blue: "#2459a8",
    yellow: "#ffd85c",
    shadow: "rgba(0,0,0,0.28)",
  };

  const FIELD = {
    home: { x: W / 2, y: 610 },
    mound: { x: W / 2, y: 398 },
    second: { x: W / 2, y: 235 },
    first: { x: 300, y: 350 },
    third: { x: 90, y: 350 },
    fenceY: 116,
  };

  class SoundFX {
    constructor() {
      this.ctx = null;
    }

    ensure() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }

    tone(freq, duration, type = "square", gain = 0.05, delay = 0) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const vol = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      vol.gain.setValueAtTime(gain, now);
      vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(vol);
      vol.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    pitch() {
      this.ensure();
      this.tone(520, 0.06, "square", 0.035);
      this.tone(820, 0.04, "square", 0.025, 0.04);
    }

    hit(power) {
      this.ensure();
      this.tone(110 + power * 170, 0.09, "square", 0.08);
      this.tone(220 + power * 210, 0.08, "triangle", 0.06, 0.05);
    }

    whiff() {
      this.ensure();
      this.tone(150, 0.08, "sawtooth", 0.045);
      this.tone(90, 0.06, "square", 0.03, 0.07);
    }

    homer() {
      this.ensure();
      [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.16, "square", 0.055, i * 0.1));
    }
  }

  class Pitcher {
    constructor() {
      this.reset();
    }

    reset() {
      this.cooldown = 0.85;
      this.throwTime = 0;
      this.isThrowing = false;
      this.armAngle = 0;
    }

    update(dt, ball, sound) {
      if (ball.active || ball.batted) return;
      this.cooldown -= dt;
      this.armAngle = Math.sin(performance.now() / 130) * 0.2;
      if (this.cooldown <= 0) {
        this.isThrowing = true;
        this.throwTime = 0.22;
        ball.pitch();
        sound.pitch();
      }
      if (this.isThrowing) {
        this.throwTime -= dt;
        if (this.throwTime <= 0) this.isThrowing = false;
      }
    }
  }

  class Batter {
    constructor() {
      this.swingTimer = 0;
      this.side = -1;
    }

    swing() {
      this.swingTimer = 0.22;
      this.side *= -1;
    }

    update(dt) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
    }

    get swinging() {
      return this.swingTimer > 0;
    }
  }

  class Ball {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = FIELD.mound.x;
      this.y = FIELD.mound.y;
      this.z = 0;
      this.active = false;
      this.batted = false;
      this.progress = 0;
      this.speed = 1.05;
      this.landing = { x: FIELD.home.x, y: FIELD.home.y };
      this.target = { x: FIELD.home.x, y: FIELD.home.y };
      this.power = 0;
      this.result = "";
    }

    pitch() {
      this.reset();
      this.active = true;
      this.x = FIELD.mound.x;
      this.y = FIELD.mound.y;
      this.speed = 1.0 + Math.random() * 0.16;
    }

    hit(result, power) {
      const spread = (Math.random() - 0.5) * 120;
      const distance = {
        out: 190,
        single: 255,
        double: 320,
        triple: 370,
        homer: 480,
      }[result];

      this.active = false;
      this.batted = true;
      this.progress = 0;
      this.power = power;
      this.result = result;
      this.x = FIELD.home.x;
      this.y = FIELD.home.y - 14;
      this.target = {
        x: W / 2 + spread,
        y: FIELD.home.y - distance,
      };
    }

    update(dt) {
      if (this.active) {
        this.progress += dt * this.speed;
        const t = Math.min(1, this.progress);
        this.x = lerp(FIELD.mound.x, FIELD.home.x, t);
        this.y = lerp(FIELD.mound.y, FIELD.home.y - 28, t);
        this.z = Math.sin(t * Math.PI) * 14;
      } else if (this.batted) {
        this.progress += dt * (0.92 + this.power * 0.58);
        const t = Math.min(1, this.progress);
        this.x = lerp(FIELD.home.x, this.target.x, easeOutQuad(t));
        this.y = lerp(FIELD.home.y - 20, this.target.y, easeOutQuad(t));
        this.z = Math.sin(t * Math.PI) * (45 + this.power * 80);
        if (t >= 1) this.batted = false;
      }
    }

    get plateDelta() {
      return Math.abs(this.progress - 0.84);
    }

    get passedPlate() {
      return this.active && this.progress >= 1;
    }
  }

  class Runner {
    constructor(baseIndex) {
      this.baseIndex = baseIndex;
      this.visual = baseIndex;
    }
  }

  class GameState {
    constructor() {
      this.sound = new SoundFX();
      this.pitcher = new Pitcher();
      this.batter = new Batter();
      this.ball = new Ball();
      this.reset();
    }

    reset() {
      this.score = 0;
      this.outs = 0;
      this.strikes = 0;
      this.batterNo = 1;
      this.runners = [];
      this.gameOver = false;
      this.message = "TAPでスイング";
      this.messageTimer = 1.8;
      this.shake = 0;
      this.resultQueueTimer = 0;
      this.pitcher.reset();
      this.ball.reset();
      retryButton.classList.remove("show");
    }

    update(dt) {
      this.batter.update(dt);
      if (this.gameOver) return;

      this.shake = Math.max(0, this.shake - dt * 18);
      this.messageTimer = Math.max(0, this.messageTimer - dt);
      this.resultQueueTimer = Math.max(0, this.resultQueueTimer - dt);

      this.pitcher.update(dt, this.ball, this.sound);
      this.ball.update(dt);

      if (this.ball.passedPlate) {
        this.registerStrike("ストライク!");
      }

      if (!this.ball.active && !this.ball.batted && this.resultQueueTimer <= 0 && this.messageTimer <= 0) {
        this.pitcher.cooldown = 0.65;
      }
    }

    swing() {
      this.sound.ensure();
      if (this.gameOver) return;
      if (this.batter.swinging || this.ball.batted) return;

      this.batter.swing();

      if (!this.ball.active) {
        this.registerStrike("早すぎる!");
        this.sound.whiff();
        return;
      }

      const delta = this.ball.plateDelta;
      if (delta > 0.22) {
        this.ball.active = false;
        this.registerStrike(delta < 0.84 ? "空振り!" : "遅すぎる!");
        this.sound.whiff();
        return;
      }

      const hit = this.decideHit(delta);
      this.ball.hit(hit.kind, hit.power);
      this.sound.hit(hit.power);
      if (hit.kind === "homer") {
        this.sound.homer();
        this.shake = 8;
      }
      this.applyResult(hit.kind);
    }

    decideHit(delta) {
      const perfect = Math.max(0, 1 - delta / 0.22);
      const roll = Math.random();

      if (delta < 0.045) {
        if (roll < 0.3) return { kind: "homer", power: 1 };
        if (roll < 0.57) return { kind: "triple", power: 0.9 };
        if (roll < 0.84) return { kind: "double", power: 0.78 };
        return { kind: "single", power: 0.66 };
      }

      if (delta < 0.11) {
        if (roll < 0.12) return { kind: "homer", power: 0.86 };
        if (roll < 0.34) return { kind: "double", power: 0.72 };
        if (roll < 0.76) return { kind: "single", power: 0.58 };
        return { kind: "out", power: 0.5 };
      }

      if (roll < 0.45 + perfect * 0.1) return { kind: "single", power: 0.48 };
      return { kind: "out", power: 0.38 };
    }

    applyResult(kind) {
      const labels = {
        out: "アウト!",
        single: "ヒット!",
        double: "二塁打!",
        triple: "三塁打!",
        homer: "ホームラン!",
      };

      this.message = labels[kind];
      this.messageTimer = 1.25;
      this.resultQueueTimer = 1.05;
      this.strikes = 0;
      this.pitcher.cooldown = 1.15;

      if (kind === "out") {
        this.outs += 1;
      } else {
        const bases = { single: 1, double: 2, triple: 3, homer: 4 }[kind];
        this.advanceRunners(bases);
      }

      this.nextBatter();
      this.checkGameOver();
    }

    advanceRunners(bases) {
      let runs = bases >= 4 ? 1 : 0;
      const advanced = [];

      for (const runner of this.runners) {
        const next = runner.baseIndex + bases;
        if (next >= 4) runs += 1;
        else advanced.push(new Runner(next));
      }

      if (bases < 4) advanced.push(new Runner(bases));
      this.runners = advanced.sort((a, b) => a.baseIndex - b.baseIndex);
      this.score += runs;
    }

    registerStrike(text) {
      this.ball.reset();
      this.strikes += 1;
      this.message = text;
      this.messageTimer = 0.85;
      this.resultQueueTimer = 0.65;
      this.pitcher.cooldown = 0.9;
      if (this.strikes >= 3) {
        this.outs += 1;
        this.strikes = 0;
        this.message = "三振!";
        this.messageTimer = 1.1;
        this.pitcher.cooldown = 1.15;
        this.nextBatter();
        this.checkGameOver();
      }
    }

    nextBatter() {
      this.batterNo = (this.batterNo % 9) + 1;
    }

    checkGameOver() {
      if (this.outs >= 3) {
        this.gameOver = true;
        this.ball.reset();
        this.message = `ゲーム終了 ${this.score}点`;
        this.messageTimer = 999;
        retryButton.classList.add("show");
      }
    }
  }

  const game = new GameState();
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    draw(game);
    requestAnimationFrame(loop);
  }

  function draw(g) {
    ctx.save();
    ctx.setTransform(DPR_SCALE, 0, 0, DPR_SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (g.shake > 0) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    drawBackground();
    drawField();
    drawFielders();
    drawPitcher(g.pitcher);
    drawBatter(g.batter);
    drawBall(g.ball);
    drawHud(g);
    drawMessage(g);
    drawTapPrompt(g);
    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, W, 145);
    ctx.fillStyle = "#203d47";
    ctx.fillRect(0, 102, W, 18);
    for (let x = 12; x < W; x += 44) {
      ctx.fillStyle = x % 88 === 12 ? "#f6d15d" : "#f4f0c9";
      ctx.fillRect(x, 70 + (x % 3) * 7, 24, 32);
    }
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 120, W, H);
    for (let y = 140; y < H; y += 28) {
      ctx.fillStyle = y % 56 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
      ctx.fillRect(0, y, W, 14);
    }
  }

  function drawField() {
    ctx.fillStyle = COLORS.grassDark;
    ctx.beginPath();
    ctx.arc(FIELD.home.x, FIELD.home.y, 440, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineTo(FIELD.home.x, FIELD.home.y);
    ctx.fill();

    ctx.strokeStyle = COLORS.chalk;
    ctx.lineWidth = 4;
    line(FIELD.home.x, FIELD.home.y, 32, 126);
    line(FIELD.home.x, FIELD.home.y, W - 32, 126);

    ctx.fillStyle = COLORS.dirt;
    diamond(FIELD.home.x, FIELD.home.y - 10, 110, 110);
    ctx.fillStyle = COLORS.grass;
    diamond(FIELD.home.x, FIELD.home.y - 10, 76, 76);
    ctx.fillStyle = COLORS.dirt;
    circle(FIELD.mound.x, FIELD.mound.y, 34);

    drawBase(FIELD.home.x, FIELD.home.y);
    drawBase(FIELD.first.x, FIELD.first.y);
    drawBase(FIELD.second.x, FIELD.second.y);
    drawBase(FIELD.third.x, FIELD.third.y);
  }

  function drawFielders() {
    [
      [82, 220], [195, 180], [308, 220],
      [128, 315], [262, 315], [195, 278],
    ].forEach(([x, y], i) => drawPlayer(x, y, i % 2 ? COLORS.blue : "#295d93", "#f7c58a", false));
  }

  function drawPitcher(p) {
    drawPlayer(FIELD.mound.x, FIELD.mound.y - 10, COLORS.red, "#f7c58a", false);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 5;
    const arm = p.isThrowing ? -24 : Math.sin(performance.now() / 150) * 9;
    line(FIELD.mound.x + 9, FIELD.mound.y - 23, FIELD.mound.x + 23, FIELD.mound.y - 32 + arm);
  }

  function drawBatter(b) {
    const x = FIELD.home.x + 36;
    const y = FIELD.home.y - 42;
    drawPlayer(x, y, COLORS.blue, "#f7c58a", true);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 6;
    ctx.lineCap = "square";
    if (b.swinging) {
      line(x - 24, y - 18, x - 66, y - 38);
      line(x - 24, y - 18, x - 70, y + 6);
    } else {
      line(x - 4, y - 28, x - 38, y - 66);
    }
    ctx.lineCap = "butt";
  }

  function drawPlayer(x, y, uniform, skin, faceRight) {
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(x - 13, y + 20, 26, 8);
    ctx.fillStyle = skin;
    circle(x, y - 28, 13);
    ctx.fillStyle = uniform;
    ctx.fillRect(x - 13, y - 16, 26, 30);
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(x - 10, y - 10, 20, 5);
    ctx.fillStyle = uniform;
    ctx.fillRect(x - 15, y - 39, 30, 8);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(x + (faceRight ? 5 : -7), y - 30, 4, 4);
    ctx.fillRect(x - 11, y + 14, 8, 12);
    ctx.fillRect(x + 3, y + 14, 8, 12);
  }

  function drawBall(ball) {
    if (!ball.active && !ball.batted) return;
    ctx.fillStyle = COLORS.shadow;
    circle(ball.x, ball.y + 8, Math.max(3, 8 - ball.z * 0.04));
    ctx.fillStyle = COLORS.white;
    circle(ball.x, ball.y - ball.z, ball.batted ? 7 : 6);
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(ball.x - 2, ball.y - ball.z - 4, 4, 8);
  }

  function drawHud(g) {
    panel(12, 14, W - 24, 86);
    text("SCORE", 28, 42, 13, COLORS.red);
    text(String(g.score).padStart(2, "0"), 28, 76, 28, COLORS.ink);
    text("OUT", 112, 42, 13, COLORS.red);
    drawDots(112, 62, 3, g.outs, COLORS.ink);
    text("STRIKE", 190, 42, 13, COLORS.red);
    drawDots(190, 62, 3, g.strikes, COLORS.ink);
    text("BATTER", 298, 42, 13, COLORS.red);
    text(`#${g.batterNo}`, 310, 76, 24, COLORS.ink);

    panel(270, 112, 96, 84);
    text("RUNNER", 286, 136, 12, COLORS.red);
    drawRunnerMap(g.runners);
  }

  function drawRunnerMap(runners) {
    const has = new Set(runners.map((r) => r.baseIndex));
    const pts = { 1: [336, 164], 2: [318, 146], 3: [300, 164] };
    Object.entries(pts).forEach(([base, p]) => {
      ctx.fillStyle = has.has(Number(base)) ? COLORS.yellow : "#bfae85";
      diamond(p[0], p[1], 13, 13);
    });
  }

  function drawDots(x, y, count, active, color) {
    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = i < active ? color : "#c9b889";
      circle(x + i * 20, y, 7);
    }
  }

  function drawMessage(g) {
    if (g.messageTimer <= 0) return;
    const size = g.gameOver ? 25 : g.message.length >= 8 ? 24 : 34;
    ctx.fillStyle = "rgba(32,19,15,0.82)";
    ctx.fillRect(26, 238, W - 52, 70);
    ctx.strokeStyle = COLORS.yellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 238, W - 52, 70);
    text(g.message, W / 2, 284, size, COLORS.white, "center");
  }

  function drawTapPrompt(g) {
    if (g.gameOver) return;
    const blink = Math.floor(performance.now() / 420) % 2 === 0;
    if (!blink && g.ball.active) return;
    panel(42, 646, W - 84, 46);
    text("TAPでスイング", W / 2, 676, 20, COLORS.ink, "center");
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = "#fff4c2";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
  }

  function drawBase(x, y) {
    ctx.fillStyle = COLORS.white;
    diamond(x, y, 16, 16);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function text(value, x, y, size, color, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Courier New", "Yu Gothic UI", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y);
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function diamond(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x, y + h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.fill();
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function handleAction(event) {
    event.preventDefault();
    game.swing();
  }

  canvas.addEventListener("pointerdown", handleAction);
  retryButton.addEventListener("click", () => game.reset());

  requestAnimationFrame(loop);
})();
