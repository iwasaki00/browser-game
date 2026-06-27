(() => {
  "use strict";

  const STORAGE_KEY = "suikaStyleGame:bestScore:v1";
  const SHAKE_COOLDOWN = 10;
  const GAME_OVER_LIMIT_SECONDS = 2.4;
  const MAX_DT = 1000 / 30;
  const ASSET_IDS = Object.freeze({
    fruits: Array.from({ length: 11 }, (_, index) => `fruit_${String(index + 1).padStart(2, "0")}`),
    effectMerge: "effect_merge",
    backgroundMain: "background_main",
    uiButtons: "ui_buttons",
    uiIcons: "ui_icons",
    logoTitle: "logo_title"
  });

  const FRUIT_DEFS = Object.freeze([
    { id: ASSET_IDS.fruits[0], name: "さくらんぼ", emoji: "🍒", radius: 15, color: "#f04461", score: 2 },
    { id: ASSET_IDS.fruits[1], name: "いちご", emoji: "🍓", radius: 19, color: "#e8354f", score: 4 },
    { id: ASSET_IDS.fruits[2], name: "ぶどう", emoji: "🍇", radius: 23, color: "#8b5cf6", score: 8 },
    { id: ASSET_IDS.fruits[3], name: "デコポン", emoji: "🍊", radius: 27, color: "#f59e0b", score: 16 },
    { id: ASSET_IDS.fruits[4], name: "かき", emoji: "🟠", radius: 32, color: "#fb923c", score: 32 },
    { id: ASSET_IDS.fruits[5], name: "りんご", emoji: "🍎", radius: 38, color: "#ef4444", score: 64 },
    { id: ASSET_IDS.fruits[6], name: "なし", emoji: "🍐", radius: 45, color: "#d9e76c", score: 128 },
    { id: ASSET_IDS.fruits[7], name: "もも", emoji: "🍑", radius: 52, color: "#fb8fb1", score: 256 },
    { id: ASSET_IDS.fruits[8], name: "パイン", emoji: "🍍", radius: 60, color: "#facc15", score: 512 },
    { id: ASSET_IDS.fruits[9], name: "メロン", emoji: "🍈", radius: 69, color: "#86efac", score: 1024 },
    { id: ASSET_IDS.fruits[10], name: "スイカ", emoji: "🍉", radius: 80, color: "#22c55e", score: 2048 }
  ]);

  class StorageManager {
    constructor(key) {
      this.key = key;
    }

    loadBestScore() {
      const value = Number(localStorage.getItem(this.key));
      return Number.isFinite(value) ? value : 0;
    }

    saveBestScore(score) {
      localStorage.setItem(this.key, String(Math.max(0, Math.floor(score))));
    }
  }

  class ScoreManager {
    constructor(storage) {
      this.storage = storage;
      this.score = 0;
      this.bestScore = storage.loadBestScore();
    }

    reset() {
      this.score = 0;
    }

    add(points) {
      this.score += points;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        this.storage.saveBestScore(this.bestScore);
      }
    }
  }

  class Fruit {
    constructor(level, body) {
      this.level = level;
      this.body = body;
      this.assetId = FRUIT_DEFS[level].id;
      body.fruit = this;
    }

    get def() {
      return FRUIT_DEFS[this.level];
    }
  }

  class Physics {
    constructor(width, height, onCollision) {
      this.Matter = window.Matter;
      this.width = width;
      this.height = height;
      this.onCollision = onCollision;
      this.engine = this.Matter.Engine.create({ enableSleeping: true });
      this.world = this.engine.world;
      this.runner = null;
      this.bounds = [];
      this.engine.gravity.y = 1.05;
      this.buildBounds(width, height);
      this.Matter.Events.on(this.engine, "collisionStart", (event) => this.handleCollisions(event));
    }

    buildBounds(width, height) {
      const { Bodies, Composite } = this.Matter;
      for (const body of this.bounds) Composite.remove(this.world, body);
      const wall = 42;
      this.bounds = [
        Bodies.rectangle(width / 2, height + wall / 2 - 6, width + wall * 2, wall, { isStatic: true, label: "floor" }),
        Bodies.rectangle(-wall / 2, height / 2, wall, height * 2, { isStatic: true, label: "leftWall" }),
        Bodies.rectangle(width + wall / 2, height / 2, wall, height * 2, { isStatic: true, label: "rightWall" })
      ];
      Composite.add(this.world, this.bounds);
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.buildBounds(width, height);
    }

    addFruitBody(level, x, y) {
      const { Bodies, Composite } = this.Matter;
      const def = FRUIT_DEFS[level];
      const body = Bodies.circle(x, y, def.radius, {
        label: "fruit",
        restitution: 0.12,
        friction: 0.82,
        frictionStatic: 0.9,
        frictionAir: 0.018,
        density: 0.0012 + level * 0.00012,
        slop: 0.04
      });
      Composite.add(this.world, body);
      return body;
    }

    removeBody(body) {
      this.Matter.Composite.remove(this.world, body);
    }

    update(delta) {
      this.Matter.Engine.update(this.engine, Math.min(delta, MAX_DT));
    }

    shake(strength = 0.024) {
      const bodies = this.Matter.Composite.allBodies(this.world);
      for (const body of bodies) {
        if (!body.fruit) continue;
        const direction = body.position.x < this.width / 2 ? 1 : -1;
        this.Matter.Body.applyForce(body, body.position, {
          x: direction * strength * body.mass,
          y: -0.004 * body.mass
        });
      }
    }

    clearFruits() {
      const fruits = this.Matter.Composite.allBodies(this.world).filter((body) => body.fruit);
      for (const body of fruits) this.Matter.Composite.remove(this.world, body);
    }

    handleCollisions(event) {
      for (const pair of event.pairs) {
        const fruitA = pair.bodyA.fruit;
        const fruitB = pair.bodyB.fruit;
        if (fruitA && fruitB) this.onCollision(fruitA, fruitB);
      }
    }
  }

  class FruitManager {
    constructor(physics, scoreManager) {
      this.physics = physics;
      this.scoreManager = scoreManager;
      this.fruits = new Set();
      this.mergeQueue = new Set();
      this.nextLevel = this.randomDropLevel();
      this.canDrop = true;
      this.dropDelay = 430;
    }

    reset() {
      this.fruits.clear();
      this.mergeQueue.clear();
      this.nextLevel = this.randomDropLevel();
      this.canDrop = true;
    }

    randomDropLevel() {
      return Math.floor(Math.random() * 5);
    }

    drop(x) {
      if (!this.canDrop) return null;
      const level = this.nextLevel;
      const y = Math.max(FRUIT_DEFS[level].radius + 8, 34);
      const body = this.physics.addFruitBody(level, x, y);
      const fruit = new Fruit(level, body);
      this.fruits.add(fruit);
      this.nextLevel = this.randomDropLevel();
      this.canDrop = false;
      window.setTimeout(() => {
        this.canDrop = true;
      }, this.dropDelay);
      return fruit;
    }

    queueMerge(fruitA, fruitB) {
      if (fruitA.level !== fruitB.level) return;
      if (fruitA.level >= FRUIT_DEFS.length - 1) return;
      if (!this.fruits.has(fruitA) || !this.fruits.has(fruitB)) return;
      const key = [fruitA.body.id, fruitB.body.id].sort((a, b) => a - b).join(":");
      this.mergeQueue.add({ key, fruitA, fruitB });
    }

    processMerges() {
      if (!this.mergeQueue.size) return;
      const consumed = new Set();
      const queue = Array.from(this.mergeQueue);
      this.mergeQueue.clear();

      for (const item of queue) {
        const { fruitA, fruitB } = item;
        if (consumed.has(fruitA) || consumed.has(fruitB)) continue;
        if (!this.fruits.has(fruitA) || !this.fruits.has(fruitB)) continue;
        if (fruitA.level !== fruitB.level || fruitA.level >= FRUIT_DEFS.length - 1) continue;

        consumed.add(fruitA);
        consumed.add(fruitB);
        const x = (fruitA.body.position.x + fruitB.body.position.x) / 2;
        const y = (fruitA.body.position.y + fruitB.body.position.y) / 2;
        const vx = (fruitA.body.velocity.x + fruitB.body.velocity.x) * 0.25;
        const nextLevel = fruitA.level + 1;

        this.removeFruit(fruitA);
        this.removeFruit(fruitB);
        const body = this.physics.addFruitBody(nextLevel, x, y);
        this.physics.Matter.Body.setVelocity(body, { x: vx, y: -1.2 });
        const merged = new Fruit(nextLevel, body);
        this.fruits.add(merged);
        this.scoreManager.add(FRUIT_DEFS[nextLevel].score);
      }
    }

    removeFruit(fruit) {
      this.fruits.delete(fruit);
      this.physics.removeBody(fruit.body);
    }

    all() {
      return Array.from(this.fruits);
    }
  }

  class Renderer {
    constructor(canvas, nextCanvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.nextCanvas = nextCanvas;
      this.nextCtx = nextCanvas.getContext("2d");
      this.width = 0;
      this.height = 0;
      this.ratio = 1;
    }

    resize(width, height) {
      this.ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = width;
      this.height = height;
      this.canvas.width = Math.floor(width * this.ratio);
      this.canvas.height = Math.floor(height * this.ratio);
      this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    }

    draw(fruits, nextLevel, gameOverLine, dropX) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      this.drawBackground(ctx);
      this.drawDropPreview(ctx, nextLevel, dropX);
      this.drawGameOverLine(ctx, gameOverLine);
      for (const fruit of fruits) this.drawFruit(ctx, fruit, 1);
      this.drawNextFruit(nextLevel);
    }

    drawBackground(ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#182032");
      gradient.addColorStop(1, "#0f141d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let y = 40; y < this.height; y += 42) ctx.fillRect(0, y, this.width, 1);
    }

    drawDropPreview(ctx, level, x) {
      const radius = FRUIT_DEFS[level].radius;
      ctx.save();
      ctx.globalAlpha = 0.52;
      this.drawFruitShape(ctx, FRUIT_DEFS[level], x, radius + 14, radius);
      ctx.restore();
    }

    drawGameOverLine(ctx, y) {
      ctx.strokeStyle = "rgba(255,97,112,0.58)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(this.width - 12, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawFruit(ctx, fruit, scale) {
      const { position, angle } = fruit.body;
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(angle);
      this.drawFruitShape(ctx, fruit.def, 0, 0, fruit.def.radius * scale);
      ctx.restore();
    }

    drawFruitShape(ctx, def, x, y, radius) {
      const highlight = Math.max(4, radius * 0.22);
      ctx.beginPath();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.ellipse(x, y + radius * 0.72, radius * 0.75, radius * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.42, highlight, x, y, radius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.12, def.color);
      gradient.addColorStop(1, this.shade(def.color, -34));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(1.5, radius * 0.06);
      ctx.stroke();

      ctx.fillStyle = "#10141c";
      ctx.font = `${Math.max(13, radius * 0.58)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji || def.name, x, y + radius * 0.04);
    }

    drawNextFruit(level) {
      const ctx = this.nextCtx;
      const size = this.nextCanvas.width;
      ctx.clearRect(0, 0, size, size);
      const def = FRUIT_DEFS[level];
      const radius = Math.min(30, def.radius * 0.62);
      this.drawFruitShape(ctx, def, size / 2, size / 2, radius);
    }

    shade(hex, amount) {
      const color = hex.replace("#", "");
      const num = parseInt(color, 16);
      const r = Math.max(0, Math.min(255, (num >> 16) + amount));
      const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
      const b = Math.max(0, Math.min(255, (num & 255) + amount));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  class InputManager {
    constructor(canvas, onMove, onDrop) {
      this.canvas = canvas;
      this.onMove = onMove;
      this.onDrop = onDrop;
      this.bind();
    }

    bind() {
      this.canvas.addEventListener("pointermove", (event) => {
        event.preventDefault();
        this.onMove(this.eventX(event));
      });
      this.canvas.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const x = this.eventX(event);
        this.onMove(x);
        this.onDrop(x);
      });
      document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
      document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
    }

    eventX(event) {
      const rect = this.canvas.getBoundingClientRect();
      return (event.clientX - rect.left) * (this.canvas.logicalWidth / rect.width);
    }
  }

  class UIManager {
    constructor(elements) {
      this.elements = elements;
    }

    updateScore(score, bestScore) {
      this.elements.scoreText.textContent = String(score);
      this.elements.bestScoreText.textContent = String(bestScore);
      this.elements.finalScoreText.textContent = String(score);
      this.elements.finalBestText.textContent = String(bestScore);
    }

    setDropGuide(x) {
      this.elements.dropGuide.style.left = `${x}px`;
    }

    setShakeCooldown(seconds) {
      const button = this.elements.shakeButton;
      if (seconds > 0) {
        button.disabled = true;
        button.textContent = `揺らす ${Math.ceil(seconds)}秒`;
      } else {
        button.disabled = false;
        button.textContent = "揺らす";
      }
    }

    setPaused(paused) {
      this.elements.pauseButton.textContent = paused ? "▶" : "Ⅱ";
      this.elements.pauseButton.setAttribute("aria-label", paused ? "再開" : "一時停止");
    }

    showGameOver(show) {
      this.elements.gameOverOverlay.classList.toggle("show", show);
    }
  }

  class AudioManager {
    constructor() {
      this.enabled = false;
      this.assets = new Map();
    }

    register(assetId, url) {
      this.assets.set(assetId, url);
    }

    play(_assetId) {
      // Future hook for effect_merge and other sound assets.
    }
  }

  class Game {
    constructor() {
      if (!window.Matter) {
        document.body.innerHTML = "<p style=\"padding:24px;color:white\">Matter.js の読み込みに失敗しました。ネットワーク接続を確認してください。</p>";
        return;
      }

      this.canvas = document.getElementById("gameCanvas");
      this.playArea = document.querySelector(".play-area");
      this.storage = new StorageManager(STORAGE_KEY);
      this.scoreManager = new ScoreManager(this.storage);
      this.renderer = new Renderer(this.canvas, document.getElementById("nextCanvas"));
      this.ui = new UIManager({
        scoreText: document.getElementById("scoreText"),
        bestScoreText: document.getElementById("bestScoreText"),
        finalScoreText: document.getElementById("finalScoreText"),
        finalBestText: document.getElementById("finalBestText"),
        dropGuide: document.getElementById("dropGuide"),
        shakeButton: document.getElementById("shakeButton"),
        pauseButton: document.getElementById("pauseButton"),
        gameOverOverlay: document.getElementById("gameOverOverlay")
      });
      this.audio = new AudioManager();
      this.physics = new Physics(420, 680, (a, b) => this.fruitManager.queueMerge(a, b));
      this.fruitManager = new FruitManager(this.physics, this.scoreManager);
      this.input = new InputManager(this.canvas, (x) => this.setDropX(x), (x) => this.dropFruit(x));

      this.dropX = 210;
      this.paused = false;
      this.gameOver = false;
      this.lastTime = 0;
      this.shakeCooldown = 0;
      this.shakeTimer = 0;
      this.overLineTimer = 0;
      this.gameOverLine = 96;

      this.bindUI();
      this.resize();
      this.restart();
      requestAnimationFrame((time) => this.frame(time));
    }

    bindUI() {
      window.addEventListener("resize", () => this.resize());
      document.getElementById("restartButton").addEventListener("click", () => this.restart());
      document.getElementById("overlayRestartButton").addEventListener("click", () => this.restart());
      document.getElementById("pauseButton").addEventListener("click", () => this.togglePause());
      document.getElementById("shakeButton").addEventListener("click", () => this.startShake());
    }

    resize() {
      const rect = this.playArea.getBoundingClientRect();
      const viewportH = window.visualViewport?.height || window.innerHeight;
      const top = this.playArea.getBoundingClientRect().top;
      const reserved = 74;
      const height = Math.max(430, Math.min(720, viewportH - top - reserved));
      this.playArea.style.height = `${height}px`;
      const width = Math.max(300, Math.floor(rect.width));
      this.canvas.logicalWidth = width;
      this.canvas.logicalHeight = height;
      this.renderer.resize(width, height);
      this.physics.resize(width, height);
      this.gameOverLine = Math.max(84, height * 0.16);
      this.setDropX(this.dropX);
    }

    restart() {
      this.physics.clearFruits();
      this.fruitManager.reset();
      this.scoreManager.reset();
      this.paused = false;
      this.gameOver = false;
      this.shakeCooldown = 0;
      this.shakeTimer = 0;
      this.overLineTimer = 0;
      this.setDropX(this.renderer.width / 2);
      this.ui.showGameOver(false);
      this.ui.setPaused(false);
      this.ui.setShakeCooldown(0);
      this.ui.updateScore(this.scoreManager.score, this.scoreManager.bestScore);
    }

    setDropX(x) {
      const nextRadius = FRUIT_DEFS[this.fruitManager?.nextLevel || 0].radius;
      this.dropX = clamp(x, nextRadius + 8, this.renderer.width - nextRadius - 8);
      this.ui.setDropGuide((this.dropX / this.renderer.width) * this.playArea.clientWidth);
    }

    dropFruit(x) {
      if (this.paused || this.gameOver) return;
      this.setDropX(x);
      this.fruitManager.drop(this.dropX);
    }

    togglePause() {
      if (this.gameOver) return;
      this.paused = !this.paused;
      this.ui.setPaused(this.paused);
    }

    startShake() {
      if (this.paused || this.gameOver || this.shakeCooldown > 0) return;
      this.shakeTimer = 0.48;
      this.shakeCooldown = SHAKE_COOLDOWN;
    }

    update(dt) {
      if (this.paused || this.gameOver) return;
      this.physics.update(dt * 1000);
      this.fruitManager.processMerges();
      this.updateShake(dt);
      this.updateGameOver(dt);
      this.ui.updateScore(this.scoreManager.score, this.scoreManager.bestScore);
    }

    updateShake(dt) {
      this.shakeCooldown = Math.max(0, this.shakeCooldown - dt);
      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        this.physics.shake(0.018 + Math.sin(performance.now() * 0.045) * 0.008);
      }
      this.ui.setShakeCooldown(this.shakeCooldown);
    }

    updateGameOver(dt) {
      const over = this.fruitManager.all().some((fruit) => {
        const body = fruit.body;
        if (body.speed > 0.75 || body.position.y < 0) return false;
        return body.position.y - fruit.def.radius < this.gameOverLine;
      });

      this.overLineTimer = over ? this.overLineTimer + dt : Math.max(0, this.overLineTimer - dt * 1.5);
      if (this.overLineTimer >= GAME_OVER_LIMIT_SECONDS) {
        this.gameOver = true;
        this.ui.showGameOver(true);
      }
    }

    draw() {
      this.renderer.draw(this.fruitManager.all(), this.fruitManager.nextLevel, this.gameOverLine, this.dropX);
    }

    frame(time) {
      if (!this.lastTime) this.lastTime = time;
      const dt = Math.min(0.033, (time - this.lastTime) / 1000);
      this.lastTime = time;
      this.update(dt);
      this.draw();
      requestAnimationFrame((nextTime) => this.frame(nextTime));
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.addEventListener("DOMContentLoaded", () => {
    new Game();
  });
})();
