"use strict";

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const loader = fs.readFileSync(path.join(root, "js", "main.js"), "utf8");
const style = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app-final.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "js", "renderer.js"), "utf8");
const release = fs.readFileSync(path.join(root, "js", "release.js"), "utf8");
const menu = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

const requiredIds = [
  "homeScreen", "gameScreen", "stageList", "newFreeButton", "gameCanvas",
  "startButton", "stopButton", "resetButton", "undoButton", "redoButton",
  "speedSelect", "partsPalette", "settingsOverlay", "tutorialOverlay",
  "clearOverlay", "saveOverlay", "fatalError"
];
const missingIds = requiredIds.filter((id) => !html.includes(`id="${id}"`));

const refs = new Set();
for (const source of [html, loader]) {
  for (const match of source.matchAll(/(?:src|href|content)?\s*[:=]?\s*["'](\.\/[^"'?#]+)["']/g)) {
    refs.add(match[1]);
  }
}
const missingFiles = [...refs].filter((ref) => {
  if (ref === "./assets/og.png" || ref.startsWith("./css/") || ref.startsWith("./js/") || ref.startsWith("./vendor/")) {
    return !fs.existsSync(path.resolve(root, ref));
  }
  return false;
});

const png = fs.readFileSync(path.join(root, "assets", "og.png"));
const pngSignature = png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const socialImage = {
  png: pngSignature,
  width: pngSignature ? png.readUInt32BE(16) : 0,
  height: pngSignature ? png.readUInt32BE(20) : 0,
  bytes: png.length
};

const checks = {
  missingIds,
  missingFiles,
  localMatter: html.includes('src="./vendor/matter.min.js"') && !html.includes("cdn.jsdelivr.net"),
  viewportSafeArea: html.includes("viewport-fit=cover") && html.includes("user-scalable=no"),
  socialMetadata: html.includes('property="og:image"') && html.includes('name="twitter:card"'),
  menuCard: menu.includes("./022_pythagora-lab/index.html") && menu.includes("コロコロ工作所"),
  touchLockedCanvas: style.includes("touch-action: none"),
  responsiveLandscape: style.includes("@media (orientation: landscape)") &&
    release.includes('grid-template-areas: "home heading stats settings"'),
  rotationResize: app.includes('addEventListener("orientationchange"') && app.includes("visualViewport"),
  retinaCanvas: renderer.includes("devicePixelRatio") && renderer.includes("getBoundingClientRect"),
  socialImage
};
console.log(JSON.stringify(checks, null, 2));

const passed = missingIds.length === 0 && missingFiles.length === 0 &&
  Object.entries(checks).every(([key, value]) => key === "missingIds" || key === "missingFiles" ||
    key === "socialImage" || value === true) &&
  socialImage.png && socialImage.width >= 1200 && socialImage.height >= 630;
if (!passed) process.exitCode = 1;
