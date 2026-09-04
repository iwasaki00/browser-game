const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "interaction-fixes.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const preview = app.slice(app.indexOf("function recordingPreviewGain"), app.indexOf("function beginLibraryRecording"));
for (const token of ["getChannelData(0)", "Math.min(4, safePeakGain", "createGain()", "recordingPreviewGain(buffer)", "source.connect(gain).connect(sound.master)"]) {
  if (!preview.includes(token)) throw new Error(`Recording preview gain correction is missing: ${token}`);
}
if (!html.includes('id="assetDetailVolume" type="range" min="0.1" max="4"')) throw new Error("Recorded sound volume control must support quiet recordings up to 4x");


if (!css.includes("grid-template-columns: repeat(6, minmax(0, 1fr))")) throw new Error("Bottom navigation must use six columns");
if (!css.includes("white-space: nowrap") || !css.includes("font-size: .48rem")) throw new Error("Bottom navigation labels must remain on one compact row");
const nav = html.slice(html.indexOf('<nav id="bottomNav"'), html.indexOf("</nav>", html.indexOf('<nav id="bottomNav"')));
if ((nav.match(/data-nav=/g) || []).length !== 6) throw new Error("Bottom navigation must contain exactly six items");

console.log("Recording preview and mobile layout passed: auto gain preview and six-item single-row navigation.");
