const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');
const write = (p,s) => fs.writeFileSync(p,s);
let h=read('index.html').replace(', user-scalable=no','').replace(/^.*<a class="back-link".*\r?\n/m,''); write('index.html',h);
let c=read('css/style.css').replace('  touch-action: manipulation;\n','').replace('  touch-action: manipulation;\r\n','').replace('.back-link,\n','').replace('.back-link,\r\n','').replace('grid-template-columns: 48px 1fr 48px;','grid-template-columns: 1fr 48px;').replace(/  min-height: 42[03]px;\r?\n/g,'');
c += `
/* Restrict selection and touch suppression to game controls. */
.app-shell, .overlay {
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.app-shell {
  height: 100vh;
  height: 100dvh;
  min-height: 560px;
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  grid-template-rows: auto auto minmax(280px, 1fr) auto;
}
.app-shell > *, .score-grid > * { min-width: 0; }
.play-area { max-height: 720px; }
#gameCanvas { min-height: 0; }
.score-card strong { overflow-wrap: anywhere; }
.overlay { overflow-y: auto; }

@media (max-width: 560px), (max-height: 500px) and (pointer: coarse) {
  .app-shell {
    width: calc(100% - 16px);
    min-height: 460px;
    padding-top: max(6px, env(safe-area-inset-top));
    padding-bottom: max(6px, env(safe-area-inset-bottom));
    gap: 6px;
  }
  .topbar { grid-template-columns: 1fr 44px; gap: 6px; }
  .icon-button { width: 44px; height: 44px; }
  .title-block p { font-size: .6rem; }
  h1 { font-size: 1.4rem; }
  .score-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 90px; gap: 6px; }
  .score-card, .next-card { min-height: 52px; padding: 6px 8px; }
  .score-card strong { margin-top: 3px; font-size: 1.4rem; }
  .next-card { grid-template-columns: 1fr 40px; gap: 2px; }
  #nextCanvas { width: 40px; height: 40px; }
  .primary-button, .secondary-button { min-height: 44px; padding: 0 8px; }
  .play-area { width: 100%; }
}
/* Short landscape screens retain a useful board; controls stay beside it.
   Below the minimum usable height, the page scrolls instead of clipping. */
@media (orientation: landscape) and (max-height: 500px) {
  .app-shell {
    width: calc(100% - 16px);
    min-height: 320px;
    grid-template-columns: minmax(150px, 220px) minmax(0, 460px);
    grid-template-rows: auto 1fr auto;
    justify-content: center;
    gap: 8px;
    padding-top: max(6px, env(safe-area-inset-top));
    padding-bottom: max(6px, env(safe-area-inset-bottom));
  }
  .topbar { grid-column: 1; grid-row: 1; }
  .score-grid { grid-column: 1; grid-row: 2; align-content: start; grid-template-columns: 1fr 1fr; }
  .next-card { grid-column: 1 / -1; grid-template-columns: 1fr 44px; }
  .play-area { grid-column: 2; grid-row: 1 / 4; width: 100%; }
  .controls { grid-column: 1; grid-row: 3; grid-template-columns: 1fr; gap: 6px; }
  h1 { font-size: 1.25rem; }
  .title-block p { font-size: .55rem; }
  .score-card, .next-card { min-height: 52px; padding: 6px; }
  .score-card strong { margin-top: 3px; font-size: 1.4rem; }
  #nextCanvas { width: 40px; height: 40px; }
  .primary-button, .secondary-button { min-height: 44px; }
}
@media (max-width: 300px) {
  .score-grid { grid-template-columns: 1fr 1fr; }
  .next-card { grid-column: 1 / -1; }
  .app-shell { min-height: 530px; }
}
`; write('css/style.css',c);
let s=read('js/main.js').replace(/\r\n/g,'\n');
s=s.replace('      const value = Number(localStorage.getItem(this.key));\n      return Number.isFinite(value) ? value : 0;',`      try {
        const value = Number(localStorage.getItem(this.key));
        return Number.isFinite(value) ? Math.max(0, value) : 0;
      } catch {
        return 0;
      }`);
s=s.replace('      localStorage.setItem(this.key, String(Math.max(0, Math.floor(score))));',`      try {
        localStorage.setItem(this.key, String(Math.max(0, Math.floor(score))));
      } catch {
        // The in-memory best score remains available when storage is blocked.
      }`);
s=s.replace(`    resize(width, height) {
      this.width = width;
      this.height = height;
      this.buildBounds(width, height);
    }`,`    resize(width, height) {
      if (width === this.width && height === this.height) return;
      const { Body, Composite, Pairs } = this.Matter;
      const bodies = Composite.allBodies(this.world).filter((body) => body.fruit);
      const oldWidth = this.width;
      const oldHeight = this.height;
      this.width = width;
      this.height = height;
      this.buildBounds(width, height);
      const contain = (body, position) => {
        const r = body.circleRadius;
        return { x: clamp(position.x, r, width - r), y: Math.min(position.y, height - 6 - r) };
      };
      for (const body of bodies) {
        const r = body.circleRadius;
        Body.setPosition(body, contain(body, {
          x: r + (body.position.x - r) * (width - 2 * r) / (oldWidth - 2 * r),
          y: height - 6 - r - (oldHeight - 6 - r - body.position.y) * height / oldHeight
        }));
      }
      // Position projection resolves compression without injecting velocities.
      // Leave the top open, as in the original world, for a crowded stack.
      for (let pass = 0; pass < 120; pass++) {
        let overlap = 0;
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], b = bodies[j];
            const dx = b.position.x - a.position.x, dy = b.position.y - a.position.y;
            const distance = Math.hypot(dx, dy);
            const depth = a.circleRadius + b.circleRadius - distance;
            if (depth <= 0.04) continue;
            overlap = Math.max(overlap, depth);
            const nx = distance > 0 ? dx / distance : 0;
            const ny = distance > 0 ? dy / distance : 1;
            const shift = (depth + 0.01) / 2;
            Body.setPosition(a, contain(a, { x: a.position.x - nx * shift, y: a.position.y - ny * shift }));
            Body.setPosition(b, contain(b, { x: b.position.x + nx * shift, y: b.position.y + ny * shift }));
          }
        }
        if (overlap <= 0.04) break;
      }
      for (const body of bodies) {
        body.positionImpulse.x = body.positionImpulse.y = 0;
        body.constraintImpulse.x = body.constraintImpulse.y = body.constraintImpulse.angle = 0;
        body.force.x = body.force.y = body.torque = 0;
      }
      Pairs.clear(this.engine.pairs);
    }`);
s=s.replace('      for (const body of fruits) this.Matter.Composite.remove(this.world, body);','      for (const body of fruits) this.Matter.Composite.remove(this.world, body);\n      this.Matter.Engine.clear(this.engine);');
s=s.replace('      this.dropDelay = 430;','      this.dropDelay = 430;\n      this.dropTimer = null;\n      this.generation = 0;');
s=s.replace('    reset() {\n      this.fruits.clear();','    reset() {\n      window.clearTimeout(this.dropTimer);\n      this.dropTimer = null;\n      this.generation++;\n      this.fruits.clear();');
s=s.replace('      window.setTimeout(() => {\n        this.canDrop = true;','      const generation = this.generation;\n      this.dropTimer = window.setTimeout(() => {\n        if (generation !== this.generation) return;\n        this.dropTimer = null;\n        this.canDrop = true;');
s=s.replace('      this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);','      this.ctx.setTransform(this.canvas.width / width, 0, 0, this.canvas.height / height, 0, 0);');
s=s.replace('x, radius + 14, radius','x, Math.max(radius + 8, 34), radius');
s=s.replace('        event.preventDefault();\n        this.onMove', '        if (!event.isPrimary) return;\n        event.preventDefault();\n        this.onMove');
s=s.replace('        event.preventDefault();\n        const x = this.eventX(event);','        if (!event.isPrimary || event.button !== 0) return;\n        event.preventDefault();\n        const x = this.eventX(event);');
s=s.replace('      document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });\n      document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });','      this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());');
s=s.replace('document.getElementById("restartButton").addEventListener("click", () => this.restart());','document.getElementById("restartButton").addEventListener("click", () => this.confirmRestart());');
s=s.replace('      window.addEventListener("resize", () => this.resize());',`      window.addEventListener("resize", () => this.resize());
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.playArea);
      window.addEventListener("blur", () => this.suspend());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.suspend();
        this.lastTime = 0;
      });`);
const start=s.indexOf('    resize() {',s.indexOf('  class Game'));
const end=s.indexOf('    restart() {',start);
s=s.slice(0,start)+`    resize() {
      // client dimensions exclude the border and match the Canvas CSS content box.
      const width = this.playArea.clientWidth;
      const height = this.playArea.clientHeight;
      if (!width || !height) return;
      const x = this.dropX * width / (this.renderer.width || width);
      this.canvas.logicalWidth = width;
      this.canvas.logicalHeight = height;
      this.renderer.resize(width, height);
      this.physics.resize(width, height);
      this.gameOverLine = Math.max(84, height * 0.16);
      this.playArea.querySelector(".danger-label").style.top = \`\${this.gameOverLine}px\`;
      this.setDropX(x);
      this.lastTime = 0;
    }

    suspend() {
      this.lastTime = 0;
      if (!this.gameOver) {
        this.paused = true;
        this.ui.setPaused(true);
      }
    }

    confirmRestart() {
      const wasPaused = this.paused;
      this.paused = true;
      const active = !this.gameOver && this.fruitManager.fruits.size > 0;
      const confirmed = !active || window.confirm("プレイ中のゲームをリスタートしますか？");
      this.lastTime = 0;
      if (confirmed) this.restart();
      else {
        this.paused = wasPaused || document.hidden;
        this.ui.setPaused(this.paused);
      }
    }

`+s.slice(end);
s=s.replace('      this.physics.clearFruits();','      this.lastTime = 0;\n      this.physics.clearFruits();');
s=s.replace('      this.fruitManager.drop(this.dropX);','      if (this.fruitManager.drop(this.dropX)) this.setDropX(this.dropX);');
s=s.replace('      this.paused = !this.paused;','      this.lastTime = 0;\n      this.paused = !this.paused;');
write('js/main.js',s);
