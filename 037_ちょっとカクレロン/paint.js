"use strict";

// Shared by the UI and internal tests; no network or persistent storage.
((root) => {
  const Poses = typeof module !== "undefined" && module.exports ? require("./poses.js") : root.KakureronPoses;
  const Copy = typeof module !== "undefined" && module.exports ? require("./copy-brush.js") : root.KakureronCopy;
  const WIDTH = 384;
  const HEIGHT = 576;
  const HISTORY_LIMIT = 25;
  const BRUSHES = Object.freeze({ small: 12, medium: 32, large: 72 });

  function screenToLocal(point, character, fit, pose = Poses.get(character.poseId)) {
    const dx = point.x - (fit.x + character.x * fit.width);
    const dy = point.y - (fit.y + character.y * fit.height);
    const scale = WIDTH / (character.size * fit.width);
    const height = Poses.rasterSize(pose).height;
    return {
      x: (dx * Math.cos(character.angle) + dy * Math.sin(character.angle)) * scale + WIDTH / 2,
      y: (-dx * Math.sin(character.angle) + dy * Math.cos(character.angle)) * height / (character.size * fit.width * pose.ratio) + height / 2
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
    let width = WIDTH;
    let height = HEIGHT;
    let bounds = null;
    let copySurfaces = null;

    const snapshot = () => ctx.getImageData(0, 0, width, height);
    function prepareMask(image, pose = Poses.get()) {
      const size = Poses.rasterSize(pose);
      const surface = makeCanvas();
      surface.width = size.width;
      surface.height = size.height;
      try {
        const context = surface.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, size.width, size.height);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        let left = size.width, top = size.height, right = -1, bottom = -1;
        for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
          if (pixels[(y * size.width + x) * 4 + 3]) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
        if (right < 0) throw new Error("シルエットを読み込めません。");
        return { surface, pixels, ...size, bounds: { x: left / size.width, y: top / size.height,
          width: (right - left + 1) / size.width, height: (bottom - top + 1) / size.height } };
      } catch (error) { surface.width = surface.height = 1; throw error; }
    }
    function applyMask(prepared) {
      width = prepared.width;
      height = prepared.height;
      for (const canvas of [paint, mask, stamp]) { canvas.width = width; canvas.height = height; }
      maskCtx.drawImage(prepared.surface, 0, 0);
      maskPixels = prepared.pixels;
      bounds = { ...prepared.bounds };
      prepared.surface.width = prepared.surface.height = 1;
      reset();
    }
    function setMask(image, pose) {
      applyMask(prepareMask(image, pose));
    }
    function hasPaint() {
      const pixels = snapshot().data;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) return true;
      return false;
    }
    function contains(point) {
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      return !!maskPixels && x >= 0 && x < width && y >= 0 && y < height && maskPixels[(y * width + x) * 4 + 3] > 0;
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
      clearCopySurfaces();
    }
    function cancel() {
      if (before) ctx.putImageData(before, 0, 0);
      before = null;
      previous = null;
      stroke = null;
      clearCopySurfaces();
    }
    function clearCopySurfaces() {
      if (copySurfaces) for (const surface of Object.values(copySurfaces)) surface.width = surface.height = 1;
    }
    function begin(mode, color, brush) {
      finish();
      stroke = { mode, color, width: BRUSHES[brush] };
    }
    function beginCopy(options) {
      finish();
      if (!Copy.OPACITIES.includes(options.opacity)) throw new Error("コピーの濃さが正しくありません。");
      if (!options.source || !Number.isFinite(options.source.x) || !Number.isFinite(options.source.y)
        || options.source.x < 0 || options.source.y < 0 || options.source.x >= options.imageSize.width || options.source.y >= options.imageSize.height) {
        throw new Error("コピー元を指定してください。");
      }
      stroke = { mode: "copy", width: BRUSHES[options.brush], opacity: options.opacity,
        copy: { ...options, source: { ...options.source }, character: { ...options.character } }, mapping: null, outside: false };
    }
    function trace(context, point, color) {
      context.strokeStyle = context.fillStyle = color;
      context.lineWidth = stroke.width;
      context.lineCap = context.lineJoin = "round";
      context.beginPath();
      if (previous) {
        context.moveTo(previous.x, previous.y);
        context.lineTo(point.x, point.y);
        context.stroke();
      } else {
        context.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    function dabCopy(point) {
      if (!stroke.mapping) {
        const options = stroke.copy;
        stroke.mapping = Copy.mapping(options.source, point, options.character, options.pose,
          options.imageSize, { width, height }, options.background);
        if (!copySurfaces) copySurfaces = { texture: makeCanvas(), coverage: makeCanvas() };
        for (const surface of Object.values(copySurfaces)) { surface.width = width; surface.height = height; }
        const textureCtx = copySurfaces.texture.getContext("2d");
        const m = stroke.mapping.draw;
        textureCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
        // Outside the photo stays transparent: no repeat and no black padding.
        textureCtx.drawImage(options.background, 0, 0);
        textureCtx.setTransform(1, 0, 0, 1, 0, 0);
      }
      const dirty = Copy.dirtyRect(previous, point, stroke.width, { width, height });
      const sample = Copy.transform(stroke.mapping.sample, point);
      const background = stroke.copy.background;
      stroke.outside = sample.x < 0 || sample.y < 0 || sample.x >= background.width || sample.y >= background.height;
      if (!Copy.intersectsPhoto(stroke.mapping.sample, dirty, background)) { previous = null; return false; }
      if (!before) before = snapshot();
      const coverageCtx = copySurfaces.coverage.getContext("2d");
      trace(coverageCtx, point, "#FFFFFF");
      stampCtx.save();
      stampCtx.beginPath(); stampCtx.rect(dirty.x, dirty.y, dirty.width, dirty.height); stampCtx.clip();
      stampCtx.clearRect(dirty.x, dirty.y, dirty.width, dirty.height);
      stampCtx.globalCompositeOperation = "source-over";
      stampCtx.drawImage(copySurfaces.texture, 0, 0);
      stampCtx.globalCompositeOperation = "destination-in";
      stampCtx.drawImage(copySurfaces.coverage, 0, 0);
      stampCtx.drawImage(mask, 0, 0);
      stampCtx.restore();
      stampCtx.globalCompositeOperation = "source-over";
      // Recompose over the pre-stroke state; overlap cannot exceed the chosen opacity.
      ctx.putImageData(before, 0, 0, dirty.x, dirty.y, dirty.width, dirty.height);
      ctx.save();
      ctx.beginPath(); ctx.rect(dirty.x, dirty.y, dirty.width, dirty.height); ctx.clip();
      ctx.globalAlpha = stroke.opacity;
      ctx.drawImage(stamp, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
      previous = { ...point };
      return true;
    }
    function dab(point) {
      if (!stroke) return false;
      if (!contains(point)) { previous = null; return false; }
      if (stroke.mode === "copy") return dabCopy(point);
      if (!before) before = snapshot();
      stampCtx.clearRect(0, 0, width, height);
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
      ctx.clearRect(0, 0, width, height);
      clearCopySurfaces();
    }
    return { canvas: paint, setMask, prepareMask, applyMask, hasPaint, bounds: () => bounds && { ...bounds }, contains, begin, beginCopy, dab, finish, cancel, reset,
      copyOutside: () => !!stroke?.outside,
      undo: () => restore(undo, redo), redo: () => restore(redo, undo),
      history: () => ({ undo: undo.length, redo: redo.length }) };
  }

  const api = { WIDTH, HEIGHT, HISTORY_LIMIT, BRUSHES, screenToLocal, backgroundPoint, toHex, createLayer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronPaint = api;
})(globalThis);
