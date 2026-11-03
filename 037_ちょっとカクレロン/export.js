"use strict";

((root) => {
  const Poses = typeof module !== "undefined" && module.exports ? require("./poses.js") : root.KakureronPoses;
  const MAX_EDGE = 2048;

  function outputSize(width, height) {
    if (!(width > 0 && height > 0)) throw new Error("写真を選択してください。");
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  function answerBounds(character, rect, pose = Poses.get(character.poseId), bounds = pose.bounds) {
    const width = character.size * rect.width;
    const height = width * pose.ratio;
    const cos = Math.cos(character.angle);
    const sin = Math.sin(character.angle);
    const corners = [
      [bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]
    ].map(([u, v]) => {
      const x = (u - 0.5) * width, y = (v - 0.5) * height;
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    });
    const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
    const padding = rect.width * 0.012;
    const boxWidth = Math.max(maxX - minX + padding * 2, Math.min(24, rect.width));
    const boxHeight = Math.max(maxY - minY + padding * 2, Math.min(24, rect.height));
    const cx = rect.x + character.x * rect.width + (minX + maxX) / 2;
    const cy = rect.y + character.y * rect.height + (minY + maxY) / 2;
    const left = Math.max(rect.x, cx - boxWidth / 2);
    const top = Math.max(rect.y, cy - boxHeight / 2);
    const right = Math.min(rect.x + rect.width, cx + boxWidth / 2);
    const bottom = Math.min(rect.y + rect.height, cy + boxHeight / 2);
    return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }

  function drawAnswer(ctx, character, rect, pose, bounds) {
    const box = answerBounds(character, rect, pose, bounds);
    const line = Math.max(2, rect.width * 0.003);
    const inset = Math.min(line, box.width / 4, box.height / 4);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = line * 2;
    ctx.strokeRect(box.x + inset, box.y + inset, Math.max(0, box.width - inset * 2), Math.max(0, box.height - inset * 2));
    ctx.strokeStyle = "#E52D35";
    ctx.lineWidth = line;
    ctx.strokeRect(box.x + inset, box.y + inset, Math.max(0, box.width - inset * 2), Math.max(0, box.height - inset * 2));
    const fontSize = Math.max(12, rect.width * 0.022);
    const labelWidth = Math.min(rect.width, fontSize * 3.8);
    const labelHeight = Math.min(rect.height, fontSize * 1.6);
    const x = Math.min(box.x, rect.x + rect.width - labelWidth);
    const y = Math.max(rect.y, Math.min(box.y - labelHeight, rect.y + rect.height - labelHeight));
    ctx.fillStyle = "#E52D35";
    ctx.fillRect(x, y, labelWidth, labelHeight);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("ここ！", x + fontSize * 0.35, y + labelHeight / 2, labelWidth - fontSize * 0.5);
  }

  // The editor, question and answer all use exactly the same transform and layers.
  function drawScene(ctx, scene, rect, answer = false) {
    const { background, characterImage, paintLayer, character } = scene;
    const pose = scene.pose || Poses.get(character.poseId);
    ctx.drawImage(background, rect.x, rect.y, rect.width, rect.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    const width = rect.width * character.size;
    ctx.save();
    ctx.translate(rect.x + character.x * rect.width, rect.y + character.y * rect.height);
    ctx.rotate(character.angle);
    ctx.drawImage(characterImage, -width / 2, -width * pose.ratio / 2, width, width * pose.ratio);
    ctx.drawImage(paintLayer, -width / 2, -width * pose.ratio / 2, width, width * pose.ratio);
    ctx.restore();
    if (answer) drawAnswer(ctx, character, rect, pose, scene.bounds || pose.bounds);
    ctx.restore();
  }

  async function createPNG(makeCanvas, scene, answer = false) {
    if (!scene.background) throw new Error("写真を選択してください。");
    const size = outputSize(scene.background.width, scene.background.height);
    const canvas = makeCanvas();
    try {
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvasを作成できません。");
      drawScene(ctx, scene, { x: 0, y: 0, ...size }, answer);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value && value.type === "image/png" && value.size > 0 ? resolve(value) : reject(new Error("PNGを作成できません。")), "image/png");
      });
      return { blob, ...size };
    } finally {
      // Retain only the PNG; release the large backing store even on failure.
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  function fileName(kind, date = new Date()) {
    const pad = value => String(value).padStart(2, "0");
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `kakureron_${kind}_${stamp}.png`;
  }

  function canShareFile(navigator, secureContext, file) {
    if (!secureContext || !file || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    try { return navigator.canShare({ files: [file] }); } catch { return false; }
  }

  const api = { MAX_EDGE, outputSize, answerBounds, drawScene, createPNG, fileName, canShareFile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronExport = api;
})(globalThis);
