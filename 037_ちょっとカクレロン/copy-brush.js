"use strict";

((root) => {
  const OPACITIES = Object.freeze([1, 0.7, 0.4]);
  function screenToImage(point, fit, imageSize) {
    const u = (point.x - fit.x) / fit.width, v = (point.y - fit.y) / fit.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    return { x: u * imageSize.width, y: v * imageSize.height };
  }
  function localToImageMatrix(character, pose, imageSize, raster) {
    const width = character.size * imageSize.width, height = width * pose.ratio;
    const cos = Math.cos(character.angle), sin = Math.sin(character.angle);
    const a = cos * width / raster.width, b = sin * width / raster.width;
    const c = -sin * height / raster.height, d = cos * height / raster.height;
    return { a, b, c, d, e: character.x * imageSize.width - a * raster.width / 2 - c * raster.height / 2,
      f: character.y * imageSize.height - b * raster.width / 2 - d * raster.height / 2 };
  }
  const transform = (matrix, point) => ({ x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f });
  function invert(matrix) {
    const { a, b, c, d, e, f } = matrix;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error("コピー座標を変換できません。");
    return { a: d / determinant, b: -b / determinant, c: -c / determinant, d: a / determinant,
      e: (c * f - d * e) / determinant, f: (b * e - a * f) / determinant };
  }
  function mapping(source, startLocal, character, pose, imageSize, raster, background) {
    const original = localToImageMatrix(character, pose, imageSize, raster);
    const target = transform(original, startLocal);
    const sx = background.width / imageSize.width, sy = background.height / imageSize.height;
    const sample = { a: original.a * sx, b: original.b * sy, c: original.c * sx, d: original.d * sy,
      e: (original.e + source.x - target.x) * sx, f: (original.f + source.y - target.y) * sy };
    return { sample, draw: invert(sample), target };
  }
  function dirtyRect(previous, point, brushWidth, raster) {
    const radius = brushWidth / 2 + 2;
    const x = Math.max(0, Math.floor(Math.min(previous?.x ?? point.x, point.x) - radius));
    const y = Math.max(0, Math.floor(Math.min(previous?.y ?? point.y, point.y) - radius));
    const right = Math.min(raster.width, Math.ceil(Math.max(previous?.x ?? point.x, point.x) + radius));
    const bottom = Math.min(raster.height, Math.ceil(Math.max(previous?.y ?? point.y, point.y) + radius));
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
  }
  function intersectsPhoto(matrix, rect, background) {
    const points = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height]].map(([x, y]) => transform(matrix, { x, y }));
    return Math.max(...points.map(p => p.x)) > 0 && Math.min(...points.map(p => p.x)) < background.width
      && Math.max(...points.map(p => p.y)) > 0 && Math.min(...points.map(p => p.y)) < background.height;
  }
  const api = { OPACITIES, screenToImage, localToImageMatrix, transform, invert, mapping, dirtyRect, intersectsPhoto };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronCopy = api;
})(globalThis);
