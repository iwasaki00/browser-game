"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9341;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "qwop-phase1c-"));
const output = path.join(os.tmpdir(), "qwop-phase1c-browser-test");
const root = path.resolve(__dirname, "../..");
const server = http.createServer((request, response) => {
  let file = path.resolve(root, "." + decodeURIComponent(request.url.split("?")[0]));
  if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
  response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(response);
});
fs.mkdirSync(output, { recursive: true });
let browser;
let socket;
let nextId = 1;
const pending = new Map();
const errors = [];
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function retry(task, attempts = 60) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try { return await task(); } catch (error) { lastError = error; await wait(100); }
  }
  throw lastError;
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result.result.value;
}

async function screenshot(name) {
  const response = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  fs.writeFileSync(path.join(output, name), Buffer.from(response.result.data, "base64"));
}

async function viewport(name, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 900 });
  await wait(250);
  const layout = await evaluate(`(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    return {
      width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
      training: box("#trainingButton"), controls: box(".controls"), canvas: box("#gameCanvas"),
      q: box('.controls [data-key="q"]'), p: box('.controls [data-key="p"]')
    };
  })()`);
  assert.equal(layout.scrollWidth > layout.width, false, `${name}: horizontal overflow`);
  for (const key of ["training", "q", "p"]) {
    const box = layout[key];
    assert(box.x >= 0 && box.y >= 0 && box.right <= width + 1 && box.bottom <= height + 1, `${name}: ${key} outside viewport`);
  }
  assert(layout.canvas.height > 200, `${name}: canvas too short`);
  await screenshot(`${name}.png`);
}

(async () => {
  assert(fs.existsSync(chrome), "Chrome is required");
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const gameUrl = `http://127.0.0.1:${server.address().port}/029_qwop-runner/`;
  browser = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-default-apps",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    gameUrl
  ], { stdio: "ignore" });
  const target = await retry(async () => {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    const page = pages.find(item => item.type === "page" && item.url.includes("029_qwop-runner"));
    if (!page) throw new Error("page not ready");
    return page;
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message);
    }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await retry(async () => {
    if (!await evaluate("document.readyState === 'complete' && Boolean(window.QWOPTraining)")) throw new Error("scripts not ready");
    return true;
  });

  await viewport("portrait-390x844", 390, 844);
  assert.equal(await evaluate("document.querySelector('#trainingPanel').hidden"), true);
  await evaluate("document.querySelector('#trainingButton').click()");
  assert.deepEqual(await evaluate(`({
    hidden: document.querySelector("#trainingPanel").hidden,
    now: document.querySelector("#trainingNow").textContent,
    next: document.querySelector("#trainingNext").textContent,
    guided: [...document.querySelectorAll(".controls .guide")].map(node => node.dataset.key)
  })`), { hidden: false, now: "Q + O", next: "Q", guided: ["q", "o"] });

  await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "o", bubbles: true }))`);
  await wait(260);
  assert((await evaluate("document.querySelector('#trainingHistory').textContent")).includes("GOOD"));
  await evaluate("document.dispatchEvent(new KeyboardEvent('keyup', { key: 'o', bubbles: true }))");
  await wait(160);
  assert((await evaluate("document.querySelectorAll('#trainingHistory span').length")) >= 2);
  await evaluate(`document.dispatchEvent(new KeyboardEvent("keyup", { key: "q", bubbles: true }));
    document.querySelector("#demoSpeed").click();
    document.querySelector("#watchDemo").click()`);
  assert.equal(await evaluate("document.querySelector('#demoSpeed').textContent"), "SLOW");
  await retry(async () => {
    if (!await evaluate("!document.querySelector('#watchDemo').disabled")) throw new Error("demo still running");
    return true;
  }, 70);
  assert.equal(await evaluate("document.querySelector('#trainingFeedback').textContent"), "YOUR TURN");
  await evaluate(`document.querySelector("#retryButton").click()`);
  const manualDistance = await evaluate(`(async () => {
    const key = (type, value) => document.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true }));
    const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    for (let cycle = 0; cycle < 8; cycle += 1) {
      key("keydown", "q"); key("keydown", "o"); await sleep(220);
      key("keyup", "o"); await sleep(160); key("keyup", "q");
      key("keydown", "w"); key("keydown", "p"); await sleep(220);
      key("keyup", "p"); await sleep(160); key("keyup", "w");
    }
    await sleep(100);
    return Number.parseFloat(document.querySelector("#distance").textContent);
  })()`);
  assert(manualDistance > 0.5, `manual sequence did not move forward: ${manualDistance}m`);
  console.log(`Manual Q+O → Q → W+P → W: ${manualDistance.toFixed(2)}m forward`);
  await screenshot("portrait-training.png");

  await viewport("landscape-844x390", 844, 390);
  await evaluate("document.querySelector('#debugButton').click()");
  assert.equal(await evaluate("document.querySelector('#debugPanel').hidden"), false);
  await screenshot("landscape-debug.png");
  assert.deepEqual(errors, []);
  console.log("Phase 1C browser smoke tests passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try { socket?.close(); } catch {}
  try { browser?.kill(); } catch {}
  server.close();
});
