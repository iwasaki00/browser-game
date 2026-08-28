"use strict";

const path = require("node:path");
const root = path.resolve(__dirname, "..");
global.window = global;
global.location = { search: "" };
global.devicePixelRatio = 3;
require(path.join(root, "js", "config.js"));
require(path.join(root, "js", "renderer.js"));

let rect = { left: 13, top: 17, width: 390, height: 260 };
const canvas = {
  width: 0,
  height: 0,
  getContext() { return {}; },
  getBoundingClientRect() { return rect; }
};
const renderer = new global.PythagoraLab.Renderer(canvas);
renderer.setStage({ fieldWidth: 760, fieldHeight: 440 });
const firstResize = renderer.resize();
renderer.setCamera({ x: 420, y: 210, zoom: 1.35 });

const points = [
  { x: 0, y: 0 },
  { x: 380, y: 220 },
  { x: 759, y: 439 },
  { x: 612.25, y: 118.75 }
];
const errors = points.map((point) => {
  const screen = renderer.worldToScreen(point.x, point.y);
  const roundTrip = renderer.screenToWorld(screen.x + rect.left, screen.y + rect.top);
  return Math.hypot(roundTrip.x - point.x, roundTrip.y - point.y);
});

const portraitPixels = { width: canvas.width, height: canvas.height, dpr: renderer.dpr };
rect = { left: 0, top: 0, width: 844, height: 190 };
const rotationResize = renderer.resize();
const landscapePixels = { width: canvas.width, height: canvas.height, dpr: renderer.dpr };

const report = {
  firstResize,
  rotationResize,
  maxRoundTripError: Math.max(...errors),
  portraitPixels,
  landscapePixels,
  expectedDprCap: global.PythagoraLab.CONFIG.dprCap
};
console.log(JSON.stringify(report, null, 2));

if (!firstResize || !rotationResize || report.maxRoundTripError > 1e-9 ||
  portraitPixels.dpr !== global.PythagoraLab.CONFIG.dprCap ||
  portraitPixels.width !== Math.round(390 * portraitPixels.dpr) ||
  landscapePixels.width !== Math.round(844 * landscapePixels.dpr)) {
  process.exitCode = 1;
}
