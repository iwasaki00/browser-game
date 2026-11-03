"use strict";

(() => {
  const VERSION = "0.5.0";
  const Poses = globalThis.KakureronPoses;
  const Copy = globalThis.KakureronCopy;
  const Paint = globalThis.KakureronPaint;
  const Export = globalThis.KakureronExport;
  const MAX_PHOTO_EDGE = 2048;
  const INITIAL = Object.freeze({ x: 0.5, y: 0.5, size: 0.18, angle: 0, poseId: Poses.DEFAULT_ID });
  const MIN_SIZE = 0.05;
  const MAX_SIZE = 0.6;
  const SIZE_STEP = 0.02;
  const ROTATION_STEP = 5 * Math.PI / 180;
  const canvas = document.querySelector("#canvas");
  const ctx = canvas.getContext("2d");
  const stage = document.querySelector("#stage");
  const input = document.querySelector("#image-input");
  const status = document.querySelector("#status");
  let characterImage = new Image();
  const poseImages = new Map([[Poses.DEFAULT_ID, characterImage]]);
  const poseLoads = new Map();
  const pointers = new Map();
  const paint = Paint.createLayer(() => document.createElement("canvas"));
  const photo = document.createElement("canvas");
  const photoCtx = photo.getContext("2d", { willReadFrequently: true });
  const loupe = document.querySelector("#loupe");
  const loupeCtx = loupe.getContext("2d");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const brushButtons = [...document.querySelectorAll("[data-brush]")];
  const poseButtons = [...document.querySelectorAll("[data-pose]")];
  const opacityButtons = [...document.querySelectorAll("[data-opacity]")];
  const confirmDialog = document.querySelector("#change-confirm");
  let poseBusy = false;
  let pendingChange = null;
  let poseSequence = 0;
  const modeHints = {
    place: "1本指で移動 ／ 2本指でサイズ・角度を調整",
    pick: "写真をタップ・なぞって色を取得。白いキャラの下も拾えます。",
    paint: "カクレロンをなぞって現在色で塗ります。",
    erase: "塗装をなぞって消し、白い下地に戻します。",
    copy: "写真からコピーする場所を選んでください"
  };
  let originalSize = null;
  let copySource = null;
  let copyCandidate = null;
  let copyPicking = false;
  let copyOpacity = 1;
  let strokeInvalidated = false;
  let mode = "place";
  let brush = "medium";
  let currentColor = "#FFFFFF";
  let background = null;
  let character = { ...INITIAL };
  let fit = { x: 0, y: 0, width: 1, height: 1 };
  let gesture = null;
  let loadSequence = 0;
  let previewing = false;
  let preparing = false;
  let sharing = false;
  let previewSequence = 0;
  let previewScene = null;
  let previewDate = null;
  let previewKind = "question";
  let retryKind = "question";
  let encodingQueue = Promise.resolve();
  const outputs = { question: null, answer: null };
  const previewImage = document.querySelector("#preview-image");
  const GENERATION_ERROR = "画像を作成できませんでした。画像サイズを小さくして再度お試しください。";
  const SHARE_FALLBACK = "このブラウザでは直接共有できません。画像を保存してから共有してください。";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const editBlocked = () => previewing || poseBusy || !!pendingChange;
  const currentPose = () => Poses.get(character.poseId);

  // Positions and width are relative to the fitted background, independent of device pixels.
  function updateFit() {
    if (!background) return;
    const scale = Math.min(stage.clientWidth / background.width, stage.clientHeight / background.height);
    const width = background.width * scale;
    const height = background.height * scale;
    fit = { x: (stage.clientWidth - width) / 2, y: (stage.clientHeight - height) / 2, width, height };
  }

  function scene() {
    return { background, characterImage, paintLayer: paint.canvas, character: { ...character }, pose: currentPose(), bounds: paint.bounds() };
  }

  function render() {
    if (previewing) return;
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
    const ready = characterImage.complete && characterImage.naturalWidth > 0 && !!paint.bounds();
    if (ready) Export.drawScene(ctx, scene(), fit);
    else ctx.drawImage(background, fit.x, fit.y, fit.width, fit.height);
    document.querySelector("#open-preview").disabled = !ready;
    updatePoseUI();
    document.querySelector("#size-value").textContent = `${Math.round(character.size * 100)}%`;
    document.querySelector("#angle-value").textContent = `${Math.round(character.angle * 180 / Math.PI)}°`;
    document.querySelector("#smaller").disabled = character.size <= MIN_SIZE;
    document.querySelector("#larger").disabled = character.size >= MAX_SIZE;
    updateHistory();
    updateCopyUI();
  }

  function updateHistory() {
    const history = paint.history();
    document.querySelector("#undo").disabled = !background || !history.undo;
    document.querySelector("#redo").disabled = !background || !history.redo;
  }

  function clearGesture(cancel = false) {
    if (cancel) paint.cancel();
    else paint.finish();
    loupe.hidden = true;
    copyCandidate = null;
    const ids = [...pointers.keys()];
    pointers.clear();
    for (const id of ids) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    gesture = null;
    canvas.classList.remove("dragging");
    updateHistory();
    updateCopyUI();
  }

  function updateCopyUI() {
    document.querySelector("#copy-controls").hidden = mode !== "copy";
    document.querySelector("#select-copy-source").setAttribute("aria-pressed", String(copyPicking));
    document.querySelector("#copy-source-state").textContent = copySource
      ? `指定済み (${Math.round(copySource.x)}, ${Math.round(copySource.y)})` : "未指定";
    if (mode === "copy" && background) {
      const hint = copyPicking || !copySource ? "写真からコピーする場所を選んでください" : "カクレロンをなぞって模様をコピー";
      document.querySelector("#hint").textContent = hint;
      document.querySelector("#gesture-help").textContent = hint;
      canvas.setAttribute("aria-label", `カクレロン編集。${hint}`);
    }
    const marker = document.querySelector("#copy-marker");
    const point = copyCandidate || copySource;
    marker.hidden = previewing || mode !== "copy" || !point || !originalSize;
    if (!marker.hidden) {
      marker.style.left = `${fit.x + point.x / originalSize.width * fit.width}px`;
      marker.style.top = `${fit.y + point.y / originalSize.height * fit.height}px`;
    }
  }

  function resetState() {
    clearGesture();
    if (character.poseId !== Poses.DEFAULT_ID) {
      const image = poseImages.get(Poses.DEFAULT_ID);
      paint.setMask(image, Poses.get());
      characterImage = image;
    }
    character = { ...INITIAL };
    paint.reset();
    releaseOutputs();
    render();
  }

  function updatePoseUI() {
    document.querySelector("#toggle-poses").textContent = `ポーズ：${currentPose().name} ▾`;
    document.querySelector("#toggle-poses").disabled = !background || !paint.bounds() || poseBusy;
    document.querySelector("#open-preview").disabled ||= poseBusy || !!pendingChange;
    poseButtons.forEach(button => {
      button.disabled = !background || !paint.bounds() || poseBusy;
      button.setAttribute("aria-pressed", String(button.dataset.pose === character.poseId));
    });
  }

  function loadPose(pose) {
    const cached = poseImages.get(pose.poseId);
    if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
    if (poseLoads.has(pose.poseId)) return poseLoads.get(pose.poseId);
    const task = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { poseImages.set(pose.poseId, image); resolve(image); };
      image.onerror = () => reject(new Error("ポーズを読み込めません。"));
      image.src = pose.silhouette;
    }).finally(() => poseLoads.delete(pose.poseId));
    poseLoads.set(pose.poseId, task);
    return task;
  }

  function discardPrepared(change) {
    if (change?.prepared) change.prepared.surface.width = change.prepared.surface.height = 1;
  }

  function cancelChange() {
    const change = pendingChange;
    pendingChange = null;
    discardPrepared(change);
    if (confirmDialog.open) confirmDialog.close();
    updatePoseUI();
    if (background && !previewing) render();
    document.querySelector(change?.kind === "reset" ? "#reset" : "#toggle-poses").focus();
  }

  function applyChange(change) {
    try {
      if (change.kind === "reset") resetState();
      else {
        paint.applyMask(change.prepared);
        characterImage = change.image;
        character.poseId = change.pose.poseId;
        releaseOutputs();
        render();
      }
      status.textContent = "";
    } catch {
      status.textContent = "ポーズを変更できませんでした。もう一度お試しください。";
    }
    updatePoseUI();
  }

  function confirmOrApply(change) {
    const history = paint.history();
    if (!history.undo && !history.redo && !paint.hasPaint()) { applyChange(change); return; }
    pendingChange = change;
    document.querySelector("#confirm-title").textContent = change.kind === "reset" ? "リセット" : "ポーズの変更";
    document.querySelector("#confirm-message").textContent = change.kind === "reset"
      ? "リセットすると、現在の塗装が消去されます。リセットしますか？"
      : "ポーズを変更すると、現在の塗装が消去されます。変更しますか？";
    document.querySelector("#confirm-change").textContent = change.kind === "reset" ? "リセットする" : "変更する";
    try { confirmDialog.showModal(); }
    catch { confirmDialog.setAttribute("open", ""); }
    document.querySelector("#cancel-change").focus();
    updatePoseUI();
  }

  async function requestPose(id) {
    if (editBlocked() || !background || !paint.bounds() || id === character.poseId) return;
    clearGesture();
    const sequence = ++poseSequence;
    const pose = Poses.get(id);
    poseBusy = true;
    updatePoseUI();
    status.textContent = "ポーズを読み込んでいます…";
    let change = null;
    try {
      const image = await loadPose(pose);
      if (sequence !== poseSequence) return;
      // Prepare and validate the new mask without touching the current paint or history.
      change = { kind: "pose", pose, image, prepared: paint.prepareMask(image, pose) };
      poseBusy = false;
      status.textContent = "";
      confirmOrApply(change);
    } catch {
      discardPrepared(change);
      if (sequence === poseSequence) status.textContent = "ポーズを読み込めませんでした。現在の塗装を残したまま、もう一度お試しください。";
    } finally {
      if (sequence === poseSequence) { poseBusy = false; updatePoseUI(); }
    }
  }

  function requestReset() {
    if (editBlocked() || !background) return;
    clearGesture();
    confirmOrApply({ kind: "reset" });
  }

  function setMode(next) {
    if (editBlocked()) return;
    clearGesture();
    mode = next;
    copyPicking = false;
    status.textContent = "";
    canvas.dataset.mode = mode;
    modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    document.querySelector("#placement-controls").hidden = mode !== "place";
    document.querySelector("#brush-controls").hidden = mode !== "paint" && mode !== "erase" && mode !== "copy";
    document.querySelector("#gesture-help").textContent = modeHints[mode];
    if (background) document.querySelector("#hint").textContent = modeHints[mode];
    canvas.setAttribute("aria-label", `カクレロン編集。${modeHints[mode]}`);
    if (background) document.querySelector("#workspace-state").textContent = { place: "配置を調整中", pick: "背景から色を取得", paint: "擬態ペイント中", erase: "塗装を消去中", copy: "背景模様をコピー" }[mode];
    updateCopyUI();
  }

  function pickColor(point) {
    const pixel = Paint.backgroundPoint(point, fit, photo.width, photo.height);
    if (!pixel) { loupe.hidden = true; return; }
    try {
      currentColor = Paint.toHex(photoCtx.getImageData(pixel.x, pixel.y, 1, 1).data);
      document.querySelector("#color-value").textContent = currentColor;
      document.querySelector("#color-swatch").style.backgroundColor = currentColor;
      showLoupe(point, pixel);
      status.textContent = "";
    } catch {
      status.textContent = "色を取得できませんでした。静的Web配信で開き直してお試しください。";
    }
  }

  function showLoupe(point, pixel) {
    loupe.hidden = false;
    // Keep the loupe on the opposite side from the finger; show only the original photo.
    loupe.style.left = point.x < stage.clientWidth / 2 ? "auto" : "12px";
    loupe.style.right = point.x < stage.clientWidth / 2 ? "12px" : "auto";
    loupeCtx.fillStyle = "#fff";
    loupeCtx.fillRect(0, 0, 120, 120);
    loupeCtx.imageSmoothingEnabled = false;
    const region = Math.max(8, Math.round(photo.width / fit.width * 24));
    loupeCtx.drawImage(photo, pixel.x - region / 2, pixel.y - region / 2, region, region, 0, 0, 120, 120);
    loupeCtx.strokeStyle = "#fff";
    loupeCtx.lineWidth = 3;
    loupeCtx.strokeRect(56, 56, 8, 8);
    loupeCtx.strokeStyle = "#243721";
    loupeCtx.lineWidth = 1;
    loupeCtx.strokeRect(56, 56, 8, 8);
  }

  function editPoint(point) {
    if (mode === "pick") pickColor(point);
    else if (mode === "copy" && copyPicking) {
      copyCandidate = Copy.screenToImage(point, fit, originalSize);
      const pixel = Paint.backgroundPoint(point, fit, photo.width, photo.height);
      if (pixel) showLoupe(point, pixel);
      else loupe.hidden = true;
      updateCopyUI();
    } else if (!insidePhoto(point)) paint.dab({ x: -1, y: -1 });
    else {
      try {
        const changed = paint.dab(Paint.screenToLocal(point, character, fit));
        if (changed) {
          if (!strokeInvalidated) { releaseOutputs(); strokeInvalidated = true; }
          render();
        }
        if (mode === "copy") status.textContent = paint.copyOutside() ? "コピー元の画像外は転写しません。" : "";
      } catch {
        clearGesture(true);
        render();
        status.textContent = "模様をコピーできませんでした。もう一度お試しください。";
      }
    }
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
    return insidePhoto(point) && paint.contains(Paint.screenToLocal(point, character, fit));
  }

  function insidePhoto(point) {
    return point.x >= fit.x && point.x <= fit.x + fit.width && point.y >= fit.y && point.y <= fit.y + fit.height;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (editBlocked() || !background || !paint.bounds() || (event.pointerType === "mouse" && event.button !== 0) || pointers.size >= 2) return;
    if (mode !== "place" && pointers.size) return;
    if (mode === "copy" && !copyPicking && !copySource) {
      status.textContent = "写真からコピーする場所を選んでください";
      return;
    }
    const point = localPoint(event);
    if (mode === "place" && !pointers.size && !hitsCharacter(point)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point);
    canvas.setPointerCapture(event.pointerId);
    strokeInvalidated = false;
    if (mode === "place") beginGesture();
    else {
      if (mode === "copy" && !copyPicking) paint.beginCopy({ background: photo, imageSize: { ...originalSize },
        source: copySource, character: { ...character }, pose: currentPose(), brush, opacity: copyOpacity });
      else if (mode !== "pick" && mode !== "copy") paint.begin(mode, currentColor, brush);
      editPoint(point);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (editBlocked() || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, localPoint(event));
    if (mode !== "place") { editPoint(localPoint(event)); return; }
    if (!gesture) return;
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
    if (mode !== "place" && pointers.has(event.pointerId)) {
      if (event.type === "pointerup") editPoint(localPoint(event));
      if (mode === "copy" && copyPicking && event.type === "pointerup" && copyCandidate) {
        copySource = { ...copyCandidate };
        copyPicking = false;
        status.textContent = "";
      }
      clearGesture(event.type !== "pointerup");
      render();
      return;
    }
    if (!pointers.delete(event.pointerId)) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    beginGesture();
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => canvas.addEventListener(type, endPointer));
  ["contextmenu", "dragstart", "gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    canvas.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });
  window.addEventListener("blur", () => { clearGesture(true); render(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearGesture(true); render(); } });

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
      poseSequence++;
      poseBusy = false;
      if (pendingChange) cancelChange();
      if (previewing) leavePreview();
      clearGesture();
      const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      photo.width = Math.max(1, Math.round(image.naturalWidth * scale));
      photo.height = Math.max(1, Math.round(image.naturalHeight * scale));
      photoCtx.drawImage(image, 0, 0, photo.width, photo.height);
      background = photo;
      originalSize = { width: image.naturalWidth, height: image.naturalHeight };
      copySource = null;
      copyCandidate = null;
      copyPicking = false;
      document.querySelector("#empty-state").hidden = true;
      canvas.hidden = false;
      document.querySelector("#change-image").hidden = false;
      document.querySelectorAll(".controls button").forEach((button) => { button.disabled = false; });
      document.querySelector("#workspace-state").textContent = "配置を調整中";
      document.querySelector("#hint").textContent = "カクレロンをドラッグ。2本指で大きさと角度を変えられます。";
      resetState();
      setMode("place");
      status.textContent = "";
    } catch {
      if (sequence === loadSequence) status.textContent = "この画像は読み込めませんでした。JPEG・PNGなど別の画像を選んでください。";
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  function adjust(sizeDelta, angleDelta) {
    if (editBlocked() || !background) return;
    clearGesture();
    character.size = clamp(character.size + sizeDelta, MIN_SIZE, MAX_SIZE);
    character.angle = normalizeAngle(character.angle + angleDelta);
    render();
  }
  document.querySelector("#smaller").addEventListener("click", () => adjust(-SIZE_STEP, 0));
  document.querySelector("#larger").addEventListener("click", () => adjust(SIZE_STEP, 0));
  document.querySelector("#rotate-left").addEventListener("click", () => adjust(0, -ROTATION_STEP));
  document.querySelector("#rotate-right").addEventListener("click", () => adjust(0, ROTATION_STEP));
  document.querySelector("#reset").addEventListener("click", requestReset);
  document.querySelector("#toggle-poses").addEventListener("click", () => {
    if (editBlocked() || !background) return;
    clearGesture();
    const panel = document.querySelector("#pose-options");
    panel.hidden = !panel.hidden;
    document.querySelector("#toggle-poses").setAttribute("aria-expanded", String(!panel.hidden));
  });
  poseButtons.forEach(button => button.addEventListener("click", () => requestPose(button.dataset.pose)));
  document.querySelector("#cancel-change").addEventListener("click", cancelChange);
  document.querySelector("#confirm-change").addEventListener("click", () => {
    const change = pendingChange;
    if (!change) return;
    pendingChange = null;
    confirmDialog.close();
    applyChange(change);
    document.querySelector("#toggle-poses").focus();
  });
  confirmDialog.addEventListener("cancel", event => { event.preventDefault(); cancelChange(); });
  confirmDialog.addEventListener("close", () => { if (pendingChange) cancelChange(); });
  modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  document.querySelector("#select-copy-source").addEventListener("click", () => {
    if (editBlocked() || !background || mode !== "copy") return;
    clearGesture();
    copyPicking = true;
    status.textContent = "";
    updateCopyUI();
  });
  opacityButtons.forEach(button => button.addEventListener("click", () => {
    if (editBlocked()) return;
    clearGesture();
    copyOpacity = Number(button.dataset.opacity);
    opacityButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  }));
  brushButtons.forEach(button => button.addEventListener("click", () => {
    if (editBlocked()) return;
    clearGesture();
    brush = button.dataset.brush;
    brushButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  }));
  for (const action of ["undo", "redo"]) {
    document.querySelector(`#${action}`).addEventListener("click", () => {
      if (editBlocked()) return;
      clearGesture();
      paint[action]();
      render();
    });
  }
  canvas.addEventListener("keydown", (event) => {
    if (editBlocked() || !background || mode !== "place") return;
    const moves = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] };
    if (!moves[event.key]) return;
    event.preventDefault();
    clearGesture();
    character.x = clamp(character.x + moves[event.key][0], 0, 1);
    character.y = clamp(character.y + moves[event.key][1], 0, 1);
    render();
  });
  new ResizeObserver(() => { clearGesture(true); render(); }).observe(stage);
  const standImage = characterImage;
  standImage.onload = () => {
    if (characterImage !== standImage) return;
    try { paint.setMask(standImage, Poses.get()); render(); }
    catch { status.textContent = "カクレロンのマスクを作成できませんでした。静的Web配信で開き直してください。"; }
  };
  characterImage.onerror = () => { status.textContent = "カクレロンを読み込めませんでした。ページを開き直してください。"; };
  characterImage.src = Poses.get().silhouette;
  document.documentElement.dataset.version = VERSION;

  function updateOutputButtons() {
    const blocked = preparing || sharing;
    for (const id of ["share-question", "save-question", "show-answer"]) {
      document.querySelector(`#${id}`).disabled = blocked || !outputs.question;
    }
    document.querySelector("#save-answer").disabled = blocked || !outputs.answer;
    document.querySelector("#show-question").disabled = blocked || !outputs.question;
    document.querySelector("#retry-preview").disabled = blocked;
  }

  function releaseOutputs() {
    previewSequence++;
    previewImage.removeAttribute("src");
    const fallback = document.querySelector("#open-generated-image");
    fallback.removeAttribute("href");
    fallback.hidden = true;
    for (const kind of ["question", "answer"]) {
      if (outputs[kind]) URL.revokeObjectURL(outputs[kind].url);
      outputs[kind] = null;
    }
    previewScene = null;
    previewDate = null;
    preparing = false;
    sharing = false;
  }

  function showOutput(kind) {
    previewKind = kind;
    const output = outputs[kind];
    previewImage.src = output.url;
    previewImage.alt = kind === "answer" ? "赤い枠で正解位置を示した答え画像" : "完成した問題画像。カクレロンを探してみよう";
    previewImage.hidden = false;
    document.querySelector("#preview-progress").hidden = true;
    document.querySelector("#preview-title").textContent = kind === "answer" ? "答え画像" : "問題画像";
    document.querySelector("#output-size").textContent = `${output.width} × ${output.height} px / PNG`;
    document.querySelector("#question-actions").hidden = kind !== "question";
    document.querySelector("#answer-actions").hidden = kind !== "answer";
    const fallback = document.querySelector("#open-generated-image");
    fallback.href = output.url;
    fallback.hidden = false;
    document.querySelector("#share-note").textContent = kind === "question"
      ? (Export.canShareFile(navigator, globalThis.isSecureContext, output.file) ? "共有メニューからLINE・メッセージ・AirDropなどを選べます。" : SHARE_FALLBACK)
      : "答えの印はこの答え画像だけに含まれます。";
  }

  async function prepareOutput(kind) {
    if (!previewing || preparing || sharing) return;
    if (outputs[kind]) { showOutput(kind); updateOutputButtons(); return; }
    const sequence = previewSequence;
    retryKind = kind;
    preparing = true;
    document.querySelector("#retry-preview").hidden = true;
    status.textContent = "画像を作成しています…";
    updateOutputButtons();
    try {
      const requestedScene = previewScene;
      // Serialize encoders even if the user leaves and reopens a pending preview.
      const task = encodingQueue.then(() => sequence === previewSequence && previewing
        ? Export.createPNG(() => document.createElement("canvas"), requestedScene, kind === "answer") : null);
      encodingQueue = task.then(() => {}, () => {});
      const result = await task;
      if (sequence !== previewSequence || !previewing) return;
      const name = Export.fileName(kind, previewDate);
      let file = null;
      if (typeof File === "function") {
        try { file = new File([result.blob], name, { type: "image/png" }); } catch { /* Saving still works without File sharing. */ }
      }
      outputs[kind] = { ...result, name, file, url: URL.createObjectURL(result.blob) };
      showOutput(kind);
      status.textContent = "";
    } catch {
      if (sequence !== previewSequence || !previewing) return;
      status.textContent = GENERATION_ERROR;
      if (!outputs[previewKind]) {
        document.querySelector("#preview-progress").textContent = GENERATION_ERROR;
        document.querySelector("#preview-progress").hidden = false;
      }
      document.querySelector("#retry-preview").textContent = kind === "answer" ? "答え画像の作成を再試行" : "画像作成を再試行";
      document.querySelector("#retry-preview").hidden = false;
    } finally {
      if (sequence === previewSequence) { preparing = false; updateOutputButtons(); }
    }
  }

  async function enterPreview() {
    if (editBlocked()) return;
    if (!background) { status.textContent = "先に写真を選択してください。"; return; }
    if (!characterImage.complete || !characterImage.naturalWidth) { status.textContent = "カクレロンの読込が終わってからお試しください。"; return; }
    clearGesture();
    releaseOutputs();
    previewing = true;
    updateCopyUI();
    previewKind = "question";
    previewScene = scene();
    previewDate = new Date();
    document.querySelector(".app").dataset.screen = "preview";
    document.querySelector("#editor-workspace").hidden = true;
    document.querySelector("#editor-controls").hidden = true;
    document.querySelector("#change-image").hidden = true;
    document.querySelector("#preview-screen").hidden = false;
    document.querySelector("#preview-title").textContent = "問題画像";
    document.querySelector("#preview-title").focus();
    document.querySelector("#output-size").textContent = "";
    document.querySelector("#share-note").textContent = "";
    document.querySelector("#question-actions").hidden = false;
    document.querySelector("#answer-actions").hidden = true;
    previewImage.hidden = true;
    document.querySelector("#preview-progress").hidden = false;
    document.querySelector("#preview-progress").textContent = "画像を作成しています…";
    await prepareOutput("question");
  }

  function leavePreview() {
    if (!previewing) return;
    previewing = false;
    releaseOutputs();
    document.querySelector(".app").dataset.screen = "edit";
    document.querySelector("#preview-screen").hidden = true;
    document.querySelector("#editor-workspace").hidden = false;
    document.querySelector("#editor-controls").hidden = false;
    document.querySelector("#change-image").hidden = !background;
    status.textContent = "";
    render();
    document.querySelector("#open-preview").focus();
  }

  function saveOutput(kind) {
    if (!previewing || preparing || sharing || !outputs[kind]) return;
    try {
      const link = document.createElement("a");
      link.href = outputs[kind].url;
      link.download = outputs[kind].name;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      status.textContent = "保存を開始しました。iPhoneでは「ファイル」に保存される場合があります。";
    } catch {
      status.textContent = "保存を開始できませんでした。「保存できない場合は画像を開く」からお試しください。";
    }
  }

  async function shareQuestion() {
    if (!previewing || preparing || sharing || !outputs.question) return;
    const file = outputs.question.file;
    if (!Export.canShareFile(navigator, globalThis.isSecureContext, file)) { status.textContent = SHARE_FALLBACK; return; }
    const sequence = previewSequence;
    sharing = true;
    updateOutputButtons();
    try {
      // No image generation or await before share: retain this button's user activation.
      await navigator.share({ files: [file] });
      if (sequence === previewSequence) status.textContent = "共有操作が完了しました。";
    } catch (error) {
      if (sequence === previewSequence) status.textContent = error?.name === "AbortError" ? "" : "共有できませんでした。画像を保存してから共有するか、再度お試しください。";
    } finally {
      if (sequence === previewSequence) { sharing = false; updateOutputButtons(); }
    }
  }

  document.querySelector("#open-preview").addEventListener("click", enterPreview);
  document.querySelector("#back-to-edit").addEventListener("click", leavePreview);
  document.querySelector("#show-answer").addEventListener("click", () => prepareOutput("answer"));
  document.querySelector("#show-question").addEventListener("click", () => prepareOutput("question"));
  document.querySelector("#retry-preview").addEventListener("click", () => prepareOutput(retryKind));
  document.querySelector("#save-question").addEventListener("click", () => saveOutput("question"));
  document.querySelector("#save-answer").addEventListener("click", () => saveOutput("answer"));
  document.querySelector("#share-question").addEventListener("click", shareQuestion);
  window.addEventListener("pagehide", leavePreview);
})();
