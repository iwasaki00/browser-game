"use strict";

((root) => {
  const ZOOM_LEVELS = Object.freeze([2, 4, 8]);
  const POSE_DURATION = 380;
  function fitRect(image, viewport, zoom = null) {
    const scale = Math.min(viewport.width / image.width, viewport.height / image.height);
    const width = image.width * scale * (zoom?.enabled ? zoom.scale : 1);
    const height = image.height * scale * (zoom?.enabled ? zoom.scale : 1);
    return { x: zoom?.enabled ? viewport.width / 2 - zoom.center.x * width : (viewport.width - width) / 2,
      y: zoom?.enabled ? viewport.height / 2 - zoom.center.y * height : (viewport.height - height) / 2, width, height };
  }
  function panCenter(center, delta, rect) {
    return { x: Math.max(0, Math.min(1, center.x - delta.x / rect.width)),
      y: Math.max(0, Math.min(1, center.y - delta.y / rect.height)) };
  }
  function backingSize(viewport, density) {
    const ratio = Math.min(density || 1, 3, 2048 / Math.max(viewport.width, viewport.height, 1));
    return { width: Math.max(1, Math.round(viewport.width * ratio)), height: Math.max(1, Math.round(viewport.height * ratio)), ratio };
  }
  function poseFrame(progress) {
    const t = Math.max(0, Math.min(1, progress));
    const phase = Math.max(0, Math.min(1, (t - 0.15) / 0.65));
    const blend = phase * phase * (3 - 2 * phase);
    const compress = Math.sin(Math.PI * Math.min(t / 0.7, 1));
    const bounce = t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI) : 0;
    return {
      old: { alpha: 1 - blend, scaleX: 1 + 0.07 * compress, scaleY: 1 - 0.2 * compress, tilt: -0.035 * compress },
      next: { alpha: blend, scaleX: 1 + 0.06 * compress - 0.035 * bounce, scaleY: 1 - 0.16 * compress + 0.06 * bounce, tilt: 0.025 * compress }
    };
  }
  const api = { ZOOM_LEVELS, POSE_DURATION, fitRect, panCenter, backingSize, poseFrame };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronView = api;
})(globalThis);
