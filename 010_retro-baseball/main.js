(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const debugButton = document.getElementById("debugButton");

  const W = canvas.width;
  const H = canvas.height;
  const CELL = 32;
  const SOURCE_CELL = 160;
  const SPRITE_SRC = "assets/baseball_sprites.png";

  // Sprite coordinates are intentionally centralized. Adjust only this table
  // when the spritesheet layout changes.
  const SPRITES = {
    pitcher: {
      idle: [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ],
      pitch: [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 3, row: 0 },
      ],
    },

    batter: {
      ready: [
        { col: 0, row: 2 },
        { col: 1, row: 2 },
      ],
      swing: [
        { col: 0, row: 3 },
        { col: 1, row: 3 },
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
      ],
    },

    fielder: {
      idle: [
        { col: 0, row: 4 },
      ],
      catch: [
        { col: 4, row: 4 },
        { col: 5, row: 4 },
      ],
    },

    ball: {
      normal: [
        { col: 0, row: 5 },
      ],
      fast: [
        { col: 1, row: 5 },
        { col: 2, row: 5 },
      ],
    },
  };

  const COLORS = {
    sky: "#4d8fb4",
    grass: "#1f8f4a",
    grass2: "#2fa65c",
    dirt: "#c77a35",
    dirtDark: "#85451f",
    chalk: "#fff2bf",
    ink: "#17100c",
    panel: "#fff2bf",
    red: "#e84b35",
    blue: "#1e4f9c",
    gold: "#ffd65a",
    shadow: "rgba(0, 0, 0, 0.32)",
  };

  const STATE = {
    waiting: "waiting",
    pitching: "pitching",
    swing: "swing",
    hit: "hit",
    result: "result",
  };

  const PLATE_PROGRESS = 0.84;
  const PERFECT_RANGE = 0.04;
  const HIT_RANGE = 0.11;
  const FOUL_RANGE = 0.2;

  class SpriteManager {
    constructor(image) {
      this.image = image;
      this.cellSize = CELL;
      // The supplied PNG is an enlarged pixel-art sheet: one logical 32px
      // sprite occupies a 160px square in the source image.
      this.sourceCellSize = SOURCE_CELL;
    }

    draw(ctx, col, row, x, y, scale = 4) {
      ctx.drawImage(
        this.image,
        col * this.sourceCellSize,
        row * this.sourceCellSize,
        this.sourceCellSize,
        this.sourceCellSize,
        Math.round(x),
        Math.round(y),
        Math.round(this.cellSize * scale),
        Math.round(this.cellSize * scale),
      );
    }
  }

  class AnimationPlayer {
    constructor(frames, fps = 8, loop = true) {
      this.frames = frames;
      this.fps = fps;
      this.loop = loop;
      this.elapsed = 0;
      this.index = 0;
      this.finished = false;
    }

    update(deltaTime) {
      if (this.finished || this.frames.length <= 1) return;

      this.elapsed += deltaTime;
      const frameTime = 1 / this.fps;
      while (this.elapsed >= frameTime && !this.finished) {
        this.elapsed -= frameTime;
        this.index += 1;
        if (this.index >= this.frames.length) {
          if (this.loop) {
            this.index = 0;
          } else {
            this.index = this.frames.length - 1;
            this.finished = true;
          }
        }
      }
    }

    getCurrentFrame() {
      return this.frames[this.index] || this.frames[0];
    }

    reset(frames = this.frames, fps = this.fps, loop = this.loop) {
      this.frames = frames;
      this.fps = fps;
      this.loop = loop;
      this.elapsed = 0;
      this.index = 0;
      this.finished = false;
    }
  }

  class Ball {
    constructor() {
      this.reset();
      this.anim = new AnimationPlayer(SPRITES.ball.fast, 12, true);
    }

    reset() {
      this.progress = 0;
      this.x = W / 2;
      this.y = 232;
      this.scale = 1.1;
      this.active = false;
      this.hit = false;
      this.hitTimer = 0;
      this.result = "";
    }

    pitch() {
      this.reset();
      this.active = true;
      this.speed = 0.72 + Math.random() * 0.13;
      this.drift = (Math.random() - 0.5) * 36;
    }

    update(deltaTime) {
      this.anim.update(deltaTime);
      if (this.active) {
        this.progress = Math.min(1.08, this.progress + deltaTime * this.speed);
        const t = Math.min(1, this.progress);
        const curve = Math.sin(t * Math.PI) * this.drift;
        this.x = W / 2 + curve;
        this.y = lerp(225, 488, easeInQuad(t));
        this.scale = lerp(1.0, 3.2, t);
      }

      if (this.hit) {
        this.hitTimer += deltaTime;
        const t = Math.min(1, this.hitTimer / 0.78);
        this.x = lerp(W / 2, this.hitTarget.x, easeOutQuad(t));
        this.y = lerp(482, this.hitTarget.y, easeOutQuad(t));
        this.scale = lerp(3.0, this.hitTarget.scale, t);
        if (t >= 1) this.hit = false;
      }
    }

    startHit(result) {
      const targets = {
        homer: { x: W / 2 + 34, y: 74, scale: 0.8 },
        hit: { x: W / 2 - 62, y: 142, scale: 1.0 },
        foul: { x: W - 32, y: 242, scale: 0.8 },
      };
      this.active = false;
      this.hit = true;
      this.hitTimer = 0;
      this.result = result;
      this.hitTarget = targets[result] || targets.foul;
    }

    get deltaFromPlate() {
      return Math.abs(this.progress - PLATE_PROGRESS);
    }
  }

  class GameState {
    constructor(spriteManager) {
      this.sprites = spriteManager;
      this.pitcherAnim = new AnimationPlayer(SPRITES.pitcher.idle, 3, true);
      this.batterAnim = new AnimationPlayer(SPRITES.batter.ready, 3, true);
      this.fielderAnim = new AnimationPlayer(SPRITES.fielder.idle, 2, true);
      this.ball = new Ball();
      this.debug = false;
      this.reset();
    }

    reset() {
      this.state = STATE.waiting;
      this.score = 0;
      this.strikes = 0;
      this.outs = 0;
      this.waitTimer = 0.75;
      this.resultTimer = 0;
      this.resultText = "TAPでスイング";
      this.resultKind = "";
      this.shake = 0;
      this.ball.reset();
      this.pitcherAnim.reset(SPRITES.pitcher.idle, 3, true);
      this.batterAnim.reset(SPRITES.batter.ready, 3, true);
    }

    update(deltaTime) {
      this.pitcherAnim.update(deltaTime);
      this.batterAnim.update(deltaTime);
      this.fielderAnim.update(deltaTime);
      this.ball.update(deltaTime);
      this.shake = Math.max(0, this.shake - deltaTime * 12);

      if (this.state === STATE.waiting) {
        this.waitTimer -= deltaTime;
        if (this.waitTimer <= 0) this.startPitch();
      }

      if (this.state === STATE.pitching && this.ball.progress >= 1) {
        this.addStrike("空振り");
      }

      if (this.state === STATE.swing && this.batterAnim.finished) {
        if (this.resultKind === "miss") this.addStrike("空振り");
        else if (this.resultKind === "foul") this.addStrike("ファール", true);
        else this.startHit(this.resultKind);
      }

      if (this.state === STATE.hit && !this.ball.hit) {
        this.showResult(this.resultText, 0.95);
      }

      if (this.state === STATE.result) {
        this.resultTimer -= deltaTime;
        if (this.resultTimer <= 0) this.prepareNextPitch();
      }
    }

    startPitch() {
      this.state = STATE.pitching;
      this.resultText = "";
      this.resultKind = "";
      this.ball.pitch();
      this.pitcherAnim.reset(SPRITES.pitcher.pitch, 10, false);
      this.batterAnim.reset(SPRITES.batter.ready, 3, true);
    }

    swing() {
      if (this.outs >= 3) {
        this.reset();
        return;
      }
      if (this.state !== STATE.pitching) return;

      const delta = this.ball.deltaFromPlate;
      this.state = STATE.swing;
      this.ball.active = false;
      this.batterAnim.reset(SPRITES.batter.swing, 14, false);

      if (delta <= PERFECT_RANGE) {
        this.resultKind = "homer";
        this.resultText = "ホームラン!";
        this.score += 1;
        this.shake = 8;
      } else if (delta <= HIT_RANGE) {
        this.resultKind = "hit";
        this.resultText = "ヒット!";
        this.score += 1;
      } else if (delta <= FOUL_RANGE) {
        this.resultKind = "foul";
        this.resultText = "ファール";
      } else {
        this.resultKind = "miss";
        this.resultText = "空振り";
      }
    }

    startHit(kind) {
      this.state = STATE.hit;
      this.ball.startHit(kind);
      if (kind === "homer") {
        this.pitcherAnim.reset(SPRITES.fielder.catch, 5, false);
      }
    }

    addStrike(text, isFoul = false) {
      this.ball.reset();
      if (!isFoul || this.strikes < 2) this.strikes += 1;
      if (this.strikes >= 3) {
        this.outs += 1;
        this.strikes = 0;
        this.showResult(this.outs >= 3 ? "3アウト GAME SET" : "アウト!", 1.2);
      } else {
        this.showResult(text, 0.85);
      }
    }

    showResult(text, duration) {
      this.state = STATE.result;
      this.resultText = text;
      this.resultTimer = duration;
      this.pitcherAnim.reset(SPRITES.pitcher.idle, 3, true);
    }

    prepareNextPitch() {
      if (this.outs >= 3) {
        this.resultText = "TAPでリスタート";
        this.resultTimer = 0.25;
        this.state = STATE.result;
        return;
      }
      this.state = STATE.waiting;
      this.waitTimer = 0.65;
      this.resultText = "TAPでスイング";
      this.pitcherAnim.reset(SPRITES.pitcher.idle, 3, true);
      this.batterAnim.reset(SPRITES.batter.ready, 3, true);
    }
  }

  const image = new Image();
  image.src = SPRITE_SRC;

  let game = null;
  let lastTime = performance.now();

  image.addEventListener("load", () => {
    game = new GameState(new SpriteManager(image));
    requestAnimationFrame(loop);
  });

  image.addEventListener("error", () => {
    drawLoadError();
  });

  function loop(now) {
    const deltaTime = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;

    ctx.imageSmoothingEnabled = false;
    game.update(deltaTime);
    draw(game);
    requestAnimationFrame(loop);
  }

  function draw(g) {
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (g.shake > 0) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    drawBackground();
    drawField();
    drawSprites(g);
    drawHud(g);
    drawResultText(g);
    drawPrompt(g);
    if (g.debug) drawDebug(g);

    ctx.restore();
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, W, 132);
    ctx.fillStyle = "#203445";
    ctx.fillRect(0, 94, W, 20);
    for (let x = 10; x < W; x += 42) {
      ctx.fillStyle = x % 84 === 10 ? "#f5cf5a" : "#efe6bd";
      ctx.fillRect(x, 58 + (x % 3) * 7, 24, 36);
    }

    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 114, W, H - 114);
    for (let y = 128; y < H; y += 32) {
      ctx.fillStyle = y % 64 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(0, y, W, 16);
    }
  }

  function drawField() {
    // Catcher-eye perspective: the pitcher is small and far away, while the
    // batter and plate area are large in the foreground.
    ctx.fillStyle = COLORS.dirt;
    ellipse(W / 2, 220, 78, 28);
    ctx.fillStyle = COLORS.dirtDark;
    ellipse(W / 2, 478, 154, 56);

    ctx.strokeStyle = COLORS.chalk;
    ctx.lineWidth = 4;
    line(W / 2 - 18, 246, 50, 610);
    line(W / 2 + 18, 246, W - 50, 610);

    ctx.fillStyle = COLORS.chalk;
    diamond(W / 2, 520, 42, 28);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = COLORS.shadow;
    ellipse(W / 2, 230, 42, 10);
    ellipse(W / 2 - 30, 616, 76, 18);
  }

  function drawSprites(g) {
    const pitcherFrame = g.pitcherAnim.getCurrentFrame();
    const batterFrame = g.batterAnim.getCurrentFrame();
    const fielderFrame = g.fielderAnim.getCurrentFrame();

    // Far fielders are small background cues.
    drawSprite(g, fielderFrame, 68, 166, 2.1);
    drawSprite(g, fielderFrame, 278, 166, 2.1);

    drawSprite(g, pitcherFrame, W / 2 - 48, 154, 3);

    if (g.ball.active || g.ball.hit) {
      const ballFrame = g.ball.anim.getCurrentFrame();
      drawSprite(
        g,
        ballFrame,
        g.ball.x - (CELL * g.ball.scale) / 2,
        g.ball.y - (CELL * g.ball.scale) / 2,
        g.ball.scale,
      );
    }

    // Batter is intentionally oversized and placed in front of the plate.
    drawSprite(g, batterFrame, W / 2 - 86, 528, 4.2);
  }

  function drawSprite(g, frame, x, y, scale) {
    g.sprites.draw(ctx, frame.col, frame.row, x, y, scale);
  }

  function drawHud(g) {
    panel(12, 12, W - 116, 74);
    labelValue("SCORE", String(g.score).padStart(2, "0"), 28, 38);
    labelValue("STRIKE", `${g.strikes}`, 126, 38);
    labelValue("OUT", `${g.outs}`, 218, 38);
  }

  function drawResultText(g) {
    if (!g.resultText) return;
    const big = g.resultText.includes("ホームラン") || g.resultText.includes("GAME");
    ctx.fillStyle = "rgba(23, 16, 12, 0.82)";
    ctx.fillRect(28, 292, W - 56, big ? 76 : 62);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 292, W - 56, big ? 76 : 62);
    text(g.resultText, W / 2, big ? 336 : 326, big ? 25 : 22, COLORS.panel, "center");
  }

  function drawPrompt(g) {
    if (g.outs >= 3) return;
    const blink = Math.floor(performance.now() / 440) % 2 === 0;
    if (!blink && g.state === STATE.pitching) return;
    panel(45, 662, W - 90, 42);
    text("TAPでスイング", W / 2, 685, 18, COLORS.ink, "center");
  }

  function drawDebug(g) {
    const scale = 0.22;
    const sheetW = image.width * scale;
    const sheetH = image.height * scale;
    const x = 10;
    const y = 96;

    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(6, 92, sheetW + 108, Math.min(sheetH, 382) + 84);
    ctx.drawImage(image, x, y, sheetW, sheetH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= image.width; gx += CELL) {
      const px = x + gx * scale;
      line(px, y, px, y + sheetH);
    }
    for (let gy = 0; gy <= image.height; gy += CELL) {
      const py = y + gy * scale;
      line(x, py, x + sheetW, py);
    }

    ctx.strokeStyle = "rgba(255, 216, 90, 0.9)";
    ctx.lineWidth = 2;
    for (let gx = 0; gx <= image.width; gx += SOURCE_CELL) {
      const px = x + gx * scale;
      line(px, y, px, y + sheetH);
    }
    for (let gy = 0; gy <= image.height; gy += SOURCE_CELL) {
      const py = y + gy * scale;
      line(x, py, x + sheetW, py);
    }

    const used = [
      ["P", g.pitcherAnim.getCurrentFrame()],
      ["B", g.batterAnim.getCurrentFrame()],
      ["F", g.fielderAnim.getCurrentFrame()],
      ["O", g.ball.anim.getCurrentFrame()],
    ];
    used.forEach(([name, frame], index) => {
      text(`${name}: c${frame.col} r${frame.row}`, x + sheetW + 12, y + 18 + index * 18, 12, COLORS.panel);
      ctx.strokeStyle = index === 0 ? "#ff3d3d" : index === 1 ? "#35a7ff" : index === 2 ? "#55ff74" : "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x + frame.col * SOURCE_CELL * scale,
        y + frame.row * SOURCE_CELL * scale,
        SOURCE_CELL * scale,
        SOURCE_CELL * scale,
      );
    });

    // Ball and judgement range overlay.
    ctx.strokeStyle = "#ff3d3d";
    ctx.lineWidth = 2;
    const zoneY = lerp(225, 488, easeInQuad(PLATE_PROGRESS));
    ctx.strokeRect(W / 2 - 74, zoneY - 24, 148, 48);
    ctx.fillStyle = "#ff3d3d";
    ctx.fillRect(g.ball.x - 3, g.ball.y - 3, 6, 6);
    text(`ball ${g.ball.progress.toFixed(2)} delta ${g.ball.deltaFromPlate.toFixed(2)}`, 18, 612, 12, COLORS.panel);
    text(`state ${g.state}`, 18, 630, 12, COLORS.panel);
  }

  function drawLoadError() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, W, H);
    text("assets/baseball_sprites.png が読み込めません", W / 2, H / 2, 16, COLORS.panel, "center");
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
  }

  function labelValue(label, value, x, y) {
    text(label, x, y, 12, COLORS.red);
    text(value, x, y + 26, 26, COLORS.ink);
  }

  function text(value, x, y, size, color, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "Courier New", "Yu Gothic UI", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, x, y);
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
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

  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInQuad(t) {
    return t * t;
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function toggleDebug() {
    if (!game) return;
    game.debug = !game.debug;
    debugButton.setAttribute("aria-pressed", String(game.debug));
  }

  function handleSwing(event) {
    event.preventDefault();
    if (game) game.swing();
  }

  canvas.addEventListener("pointerdown", handleSwing);
  debugButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDebug();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "d") toggleDebug();
  });
})();
