const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const build = "20260830-1";

for (const id of ["appVersion", "startupPanel", "startupState", "startupDetail"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing startup display: #${id}`);
}
if (!html.includes("2026.08.30-1")) throw new Error("Visible app version is missing");
if (!html.includes("window.ORE_BOOT") || !html.includes('addEventListener("error"')) throw new Error("Early boot errors must be visible");

const assets = [...html.matchAll(/(?:src|href)="(\.\/(?:css|js|games)\/[^"#]+)"/g)].map((match) => match[1]);
if (!assets.length || assets.some((ref) => !ref.endsWith(`?v=${build}`))) throw new Error("Every CSS and JavaScript asset must use the current cache-busting build");

for (const status of ["保存領域に接続中", "保存データを読み込み中", "録音音声を読み込み中", "起動完了・操作できます"]) {
  if (!app.includes(status)) throw new Error(`Missing startup status: ${status}`);
}
if (!app.includes("startupStatus(")) throw new Error("Application startup status helper is missing");

console.log(`Startup status passed: visible version 2026.08.30-1 and ${assets.length} cache-busted assets.`);
