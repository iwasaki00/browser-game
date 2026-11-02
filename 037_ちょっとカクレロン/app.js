"use strict";

(() => {
  const VERSION = "0.1.0";
  const INITIAL = Object.freeze({ x: 0.5, y: 0.5, size: 0.18, angle: 0 });
  const MIN_SIZE = 0.05;
  const MAX_SIZE = 0.6;
  const SIZE_STEP = 0.02;
  const ROTATION_STEP = 5 * Math.PI / 180;
  const CHARACTER_RATIO = 180 / 120;
  const canvas = document.querySelector("#canvas");
  const ctx = canvas.getContext("2d");
  const stage = document.querySelector("#stage");
  const input = document.querySelector("#image-input");
  const status = document.querySelector("#status");
  const characterImage = new Image();
  const pointers = new Map();
  let background = null;
  let character = { ...INITIAL };
  let fit = { x: 0, y: 0, width: 1, height: 1 };
  let gesture = null;
  let loadSequence = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  // Positions and width are relative to the fitted background, independent of device pixels.
  function updateFit() {
    if (!background) return;
    const scale = Math.min(stage.clientWidth / background.naturalWidth, stage.clientHeight / background.naturalHeight);
    const width = background.naturalWidth * scale;
    const height = background.naturalHeight * scale;
    fit = { x: (stage.clientWidth - width) / 2, y: (stage.clientHeight - height) / 2, width, height };
  }

  function drawCharacter() {
    if (!characterImage.complete || !characterImage.naturalWidth) return;
    const width = fit.width * character.size;
    ctx.save();
    ctx.translate(fit.x + character.x * fit.width, fit.y + character.y * fit.height);
    ctx.rotate(character.angle);
    // White base / silhouette source. Future paint layers can use this same transform.
    ctx.drawImage(characterImage, -width / 2, -width * CHARACTER_RATIO / 2, width, width * CHARACTER_RATIO);
    ctx.restore();
  }

  function render() {
    const density = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(stage.clientWidth * density);
    const height = Math.round(stage.clientHeight * density);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
    if (!background) return;
    updateFit();
    ctx.drawImage(background, fit.x, fit.y, fit.width, fit.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(fit.x, fit.y, fit.width, fit.height);
    ctx.clip();
    drawCharacter();
    ctx.restore();
    document.querySelector("#size-value").textContent = `${Math.round(character.size * 100)}%`;
    document.querySelector("#angle-value").textContent = `${Math.round(character.angle * 180 / Math.PI)}°`;
    document.querySelector("#smaller").disabled = character.size <= MIN_SIZE;
    document.querySelector("#larger").disabled = character.size >= MAX_SIZE;
  }

  function clearGesture() {
    for (const id of pointers.keys()) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    pointers.clear();
    gesture = null;
    canvas.classList.remove("dragging");
  }

  function reset() {
    clearGesture();
    character = { ...INITIAL };
    render();
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pairMetrics() {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function beginGesture() {
    if (!pointers.size) { gesture = null; canvas.classList.remove("dragging"); return; }
    gesture = { start: { ...character }, point: pointers.size === 1 ? [...pointers.values()][0] : pairMetrics() };
    canvas.classList.add("dragging");
  }

  function hitsCharacter(point) {
    const dx = point.x - (fit.x + character.x * fit.width);
    const dy = point.y - (fit.y + character.y * fit.height);
    const x = dx * Math.cos(character.angle) + dy * Math.sin(character.angle);
    const y = -dx * Math.sin(character.angle) + dy * Math.cos(character.angle);
    const width = character.size * fit.width;
    return Math.abs(x) <= Math.max(width / 2, 22) && Math.abs(y) <= Math.max(width * CHARACTER_RATIO / 2, 22);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!background || (event.pointerType === "mouse" && event.button !== 0) || pointers.size >= 2) return;
    const point = localPoint(event);
    if (!pointers.size && !hitsCharacter(point)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    beginGesture();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    event.preventDefault();
    pointers.set(event.pointerId, localPoint(event));
    const current = pointers.size === 1 ? [...pointers.values()][0] : pairMetrics();
    const start = gesture.start;
    character.x = clamp(start.x + (current.x - gesture.point.x) / fit.width, 0, 1);
    character.y = clamp(start.y + (current.y - gesture.point.y) / fit.height, 0, 1);
    if (pointers.size === 2) {
      character.size = clamp(start.size * current.distance / Math.max(gesture.point.distance, 1), MIN_SIZE, MAX_SIZE);
      character.angle = normalizeAngle(start.angle + normalizeAngle(current.angle - gesture.point.angle));
    }
    render();
  });

  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    beginGesture();
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => canvas.addEventListener(type, endPointer));
  ["contextmenu", "dragstart", "gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    canvas.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });
  window.addEventListener("blur", clearGesture);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearGesture(); });

  function chooseImage() { input.click(); }
  document.querySelector("#choose-image").addEventListener("click", chooseImage);
  document.querySelector("#change-image").addEventListener("click", chooseImage);
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    const sequence = ++loadSequence;
    const url = URL.createObjectURL(file);
    status.textContent = "画像を読み込んでいます…";
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      if (sequence !== loadSequence) return;
      clearGesture();
      background = image;
      document.querySelector("#empty-state").hidden = true;
      canvas.hidden = false;
      document.querySelector("#change-image").hidden = false;
      document.querySelectorAll(".controls button").forEach((button) => { button.disabled = false; });
      document.querySelector("#workspace-state").textContent = "配置を調整中";
      document.querySelector("#hint").textContent = "カクレロンをドラッグ。2本指で大きさと角度を変えられます。";
      reset();
      status.textContent = "";
    } catch {
      if (sequence === loadSequence) status.textContent = "この画像は読み込めませんでした。JPEG・PNGなど別の画像を選んでください。";
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  function adjust(sizeDelta, angleDelta) {
    if (!background) return;
    clearGesture();
    character.size = clamp(character.size + sizeDelta, MIN_SIZE, MAX_SIZE);
    character.angle = normalizeAngle(character.angle + angleDelta);
    render();
  }
  document.querySelector("#smaller").addEventListener("click", () => adjust(-SIZE_STEP, 0));
  document.querySelector("#larger").addEventListener("click", () => adjust(SIZE_STEP, 0));
  document.querySelector("#rotate-left").addEventListener("click", () => adjust(0, -ROTATION_STEP));
  document.querySelector("#rotate-right").addEventListener("click", () => adjust(0, ROTATION_STEP));
  document.querySelector("#reset").addEventListener("click", reset);
  canvas.addEventListener("keydown", (event) => {
    if (!background) return;
    const moves = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] };
    if (!moves[event.key]) return;
    event.preventDefault();
    clearGesture();
    character.x = clamp(character.x + moves[event.key][0], 0, 1);
    character.y = clamp(character.y + moves[event.key][1], 0, 1);
    render();
  });
  new ResizeObserver(() => { clearGesture(); render(); }).observe(stage);
  characterImage.onload = render;
  characterImage.src = "assets/kakureron.svg";
  document.documentElement.dataset.version = VERSION;
})();
