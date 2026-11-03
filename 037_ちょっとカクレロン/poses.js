"use strict";

((root) => {
  const DEFAULT_ID = "P01";
  const list = [
    { poseId: "P01", name: "立つ", english: "STAND", silhouette: "assets/kakureron.svg", referenceWidth: 120, referenceHeight: 180 },
    { poseId: "P02", name: "しゃがむ", english: "CROUCH", silhouette: "assets/poses/crouch.svg", referenceWidth: 140, referenceHeight: 130 },
    { poseId: "P03", name: "大の字", english: "SPREAD", silhouette: "assets/poses/spread.svg", referenceWidth: 180, referenceHeight: 180 },
    { poseId: "P04", name: "寝る", english: "LIE", silhouette: "assets/poses/lie.svg", referenceWidth: 200, referenceHeight: 100 }
  ].map(pose => Object.freeze({ ...pose, ratio: pose.referenceHeight / pose.referenceWidth,
    bounds: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }) }));
  Object.freeze(list);
  const get = id => list.find(pose => pose.poseId === id) || list[0];
  const rasterSize = pose => ({ width: 384, height: Math.round(384 * pose.ratio) });
  const api = { DEFAULT_ID, list, get, rasterSize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KakureronPoses = api;
})(globalThis);
