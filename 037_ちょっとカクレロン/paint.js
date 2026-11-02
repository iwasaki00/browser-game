"use strict";

// Shared by the UI and internal tests; no network or persistent storage.
((root) => {
  const WIDTH = 384;
  const HEIGHT = 576;
  const HISTORY_LIMIT = 25;
  const BRUSHES = Object.freeze({ small: 12, medium: 32, large: 72 });

  function screenToLocal(point, character, fit) {
    const dx = point.x - (fit.x + character.x * fit.width);
    const dy = point.y - (fit.y + character.y * fit.height);
    const scale = WIDTH / (character.size * fit.width);
    return {
      x: (dx * Math.cos(character.angle) + dy * Math.sin(character.angle)) * scale + WIDTH / 2,
      y: (-dx * Math.sin(character.angle) + dy * Math.cos(character.angle)) * scale + HEIGHT / 2
    };
  }

  function backgroundPoint(point, fit, width, height) {
    const x = (point.x - fit.x) / fit.width;
    const y = (point.y - fit.y) / fit.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    return { x: Math.floor(x * width), y: Math.floor(y * height) };
  }

  function toHex(rgb) {
    return `#${Array.from(rgb).slice(0, 3).map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  function createLayer(makeCanvas) {
    const make = () => { const canvas = makeCanvas(); canvas.width = WIDTH; canvas.height = HEIGHT; return canvas; };
    const paint = make();
    const mask = make();
    const stamp = make();
    const ctx = paint.getContext("2d", { willReadFrequently: true });
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    const stampCtx = stamp.getContext("2d");
    const undo = [];
    const redo = [];
    let maskPixels = null;
    let before = null;
    let previous = null;
    let stroke = null;

    const snapshot = () => ctx.getImageData(0, 0, WIDTH, HEIGHT);
    function setMask(image) {
      maskCtx.clearRect(0, 0, WIDTH, HEIGHT);
      maskCtx.drawImage(image, 0, 0, WIDTH, HEIGHT);
      maskPixels = maskCtx.getImageData(0, 0, WIDTH, HEIGHT).data;
    }
    function contains(point) {
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      return !!maskPixels && x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && maskPixels[(y * WIDTH + x) * 4 + 3] > 0;
    }
    function finish() {
      if (before) {
        undo.push(before);
        if (undo.length > HISTORY_LIMIT) undo.shift();
        redo.length = 0;
      }
      before = null;
      previous = null;
      stroke = null;
    }
    function begin(mode, color, brush) {
      finish();
      stroke = { mode, color, width: BRUSHES[brush] };
    }
    function dab(point) {
      if (!stroke) return false;
      if (!contains(point)) { previous = null; return false; }
      if (!before) before = snapshot();
      stampCtx.clearRect(0, 0, WIDTH, HEIGHT);
      stampCtx.globalCompositeOperation = "source-over";
      stampCtx.strokeStyle = stroke.color;
      stampCtx.fillStyle = stroke.color;
      stampCtx.lineWidth = stroke.width;
      stampCtx.lineCap = "round";
      stampCtx.lineJoin = "round";
      if (previous) {
        stampCtx.beginPath();
        stampCtx.moveTo(previous.x, previous.y);
        stampCtx.lineTo(point.x, point.y);
        stampCtx.stroke();
      } else {
        stampCtx.beginPath();
        stampCtx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
        stampCtx.fill();
      }
      // Clip each stamp before applying it: neither paint nor eraser can affect the background.
      stampCtx.globalCompositeOperation = "destination-in";
      stampCtx.drawImage(mask, 0, 0);
      stampCtx.globalCompositeOperation = "source-over";
      ctx.globalCompositeOperation = stroke.mode === "erase" ? "destination-out" : "source-over";
      ctx.drawImage(stamp, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      previous = { ...point };
      return true;
    }
    function restore(from, to) {
      finish();
      if (!from.length) return;
      to.push(snapshot());
      ctx.putImageData(from.pop(), 0, 0);
    }
    function reset() {
      before = null;
      stroke = null;
      previous = null;
      undo.length = 0;
      redo.length = 0;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
    }
    return { canvas: paint, setMask, contains, begin, dab, finish, reset,
      undo: () => restore(undo, redo), redo: () => restore(redo, undo),
      history: () => ({ undo: undo.length, redo: redo.length }) };
  }

  const api = { WIDTH, HEIGHT, HISTORY_LIMIT, BRUSHES, screenToLocal, backgroundPoint, toHex, createLayer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronPaint = api;
})(globalThis);
