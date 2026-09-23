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
  await retry(async () => {
    if (!(await evaluate("document.querySelector('#trainingHistory').textContent")).includes("GOOD")) throw new Error("training result pending");
    return true;
  }, 12);
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
  assert.equal(await evaluate(`(() => {
    const select = document.querySelector(".arm-swing-preset");
    select.value = "1";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return select.value;
  })()`), "1");
  await wait(120);
  const debugText = await evaluate("document.querySelector('.control-diagnostics').textContent");
  assert(debugText.includes("R SHOULDER") && debugText.includes("L ELBOW"), "arm joint diagnostics missing");
  assert(debugText.includes("ARMS swing 100% amplitude 35° mass NORMAL"), "arm experiment diagnostics missing");
  assert(debugText.includes("LEFT HAND") && debugText.includes("RIGHT HAND") && debugText.includes("POSTURE"), "hand or posture diagnostics missing");
  assert(debugText.includes("SHOULDER HUMAN") && debugText.includes("ELBOW HUMAN") && debugText.includes("FOREARM SCREEN") && debugText.includes("ARM ROLE FRONT"), "Phase 1G arm diagnostics missing");
  assert(debugText.includes("ARM SKELETON") && debugText.includes("GAP shoulder") && debugText.includes("upper-A") && debugText.includes("A-B"), "Phase 1I connection diagnostics missing");
  assert(debugText.includes("LEFT ELBOW STATE") && debugText.includes("HUMAN TARGET") && debugText.includes("TARGET TRACE 2s"), "Phase 1K elbow state diagnostics missing");
  assert(await evaluate("Boolean(document.querySelector('.joint-dots')) && Boolean(document.querySelector('.arm-skeleton-debug')) && Boolean(document.querySelector('.arm-connection-test')) && Boolean(document.querySelector('.elbow-matrix-test'))"));
  assert.deepEqual(await evaluate("[...document.querySelector('.arm-mass-preset').options].map(option => option.textContent)"), ["Light", "Normal", "Heavy"]);
  assert.deepEqual(await evaluate("[...document.querySelector('.arm-amplitude').options].map(option => option.value)"), ["20", "25", "30", "35", "40", "42"]);
  assert.deepEqual(await evaluate("[...document.querySelector('.hand-friction').options].map(option => option.textContent)"), ["Low", "Normal", "High"]);
  assert(await evaluate("Boolean(document.querySelector('.recovery-test'))"));
  await evaluate("document.querySelector('.recovery-test').click()");
  await wait(180);

  await evaluate("document.querySelector('.drift-test').click()");
  assert.equal(await evaluate("document.querySelector('.start-demo').disabled && document.querySelector('.recovery-test').disabled"), true);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }))");
  assert.equal(await evaluate("document.querySelector('.controls [data-key=q]').classList.contains('active')"), false, "DRIFT TEST must reject input");
  await wait(5300);
  const driftResult = await evaluate("document.querySelector('.physics-test-result').textContent");
  assert(driftResult.includes("DRIFT TEST: COMPLETE") && driftResult.includes("Foot ground"), "DRIFT TEST result missing");
  const driftMeters = Number.parseFloat(driftResult.match(/Drift Distance ([+-]?[0-9.]+) m/)[1]);
  assert(Math.abs(driftMeters) <= 0.05, `browser drift exceeded target: ${driftMeters}m`);

  await evaluate("document.querySelector('.fall-test').click()");
  await wait(1250);
  const fallDuring = await evaluate("document.querySelector('.physics-test-result').textContent");
  assert(fallDuring.includes("DOWN") && fallDuring.includes("First body contact"), "FALL TEST contact report missing");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }))");
  assert.equal(await evaluate("document.querySelector('.controls [data-key=q]').classList.contains('active')"), true, "Q input must remain enabled while DOWN");
  await evaluate("document.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', bubbles: true }))");
  await wait(900);
  assert((await evaluate("document.querySelector('.physics-test-result').textContent")).includes("FALL TEST: COMPLETE"));

  const browserPresets = await evaluate(`(async () => {
    const presets = [{ name: "A", balance: "1", arms: "1" }, { name: "B", balance: ".75", arms: ".7" }, { name: "C", balance: ".6", arms: ".7" }, { name: "D", balance: ".5", arms: ".7" }];
    const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const key = (type, value) => document.dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true }));
    const results = [];
    for (const preset of presets) {
      document.querySelector("#retryButton").click();
      const balance = document.querySelector(".balance-preset");
      const arms = document.querySelector(".arm-swing-preset");
      balance.value = preset.balance; balance.dispatchEvent(new Event("change", { bubbles: true }));
      arms.value = preset.arms; arms.dispatchEvent(new Event("change", { bubbles: true }));
      for (let cycle = 0; cycle < 4; cycle += 1) {
        key("keydown", "q"); key("keydown", "o"); await sleep(220);
        key("keyup", "o"); await sleep(160); key("keyup", "q");
        key("keydown", "w"); key("keydown", "p"); await sleep(220);
        key("keyup", "p"); await sleep(160); key("keyup", "w");
      }
      await sleep(100);
      const diagnostic = document.querySelector(".control-diagnostics").textContent;
      results.push({ name: preset.name, distance: Number.parseFloat(document.querySelector("#distance").textContent), posture: diagnostic.match(/POSTURE (STABLE|LEANING|FALLING|DOWN)/)?.[1] });
    }
    return results;
  })()`);
  browserPresets.forEach(result => {
    assert(result.distance > 0.2, `browser preset ${result.name} did not advance: ${result.distance}m`);
    assert.notEqual(result.posture, "DOWN", `browser preset ${result.name} fell during controlled input`);
  });
  console.log("Browser preset control comparison", JSON.stringify(browserPresets));
  await evaluate("if (!document.querySelector('#debugPanel').hidden) document.querySelector('#debugButton').click()");
  await wait(120);
  await screenshot("phase1h-running.png");

  await evaluate("if (document.querySelector('#trainingButton').classList.contains('active')) document.querySelector('#trainingButton').click(); document.querySelector('#retryButton').click()");
  await wait(300);
  await screenshot("phase1h-neutral.png");
  await evaluate("(() => { const toggle = document.querySelector('.joint-dots'); toggle.checked = false; toggle.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(120);
  await screenshot("phase1i-joint-dots-off.png");
  await evaluate("(() => { const toggle = document.querySelector('.joint-dots'); toggle.checked = true; toggle.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await evaluate("document.querySelector('.arm-form-test').click()");
  await wait(700);
  assert((await evaluate("document.querySelector('.arm-form-status').textContent")).includes("LEFT FRONT / RIGHT REAR"));
  await screenshot("phase1j-left-front-right-rear.png");
  await wait(1800);
  assert((await evaluate("document.querySelector('.arm-form-status').textContent")).includes("RIGHT FRONT / LEFT REAR"));
  await screenshot("phase1j-right-front-left-rear.png");
  await wait(1800);
  assert((await evaluate("document.querySelector('.arm-form-status').textContent")).includes("LEFT FRONT HOLD"));
  await screenshot("phase1j-left-front-hold.png");
  await wait(1800);
  assert((await evaluate("document.querySelector('.arm-form-status').textContent")).includes("RIGHT FRONT HOLD"));
  await screenshot("phase1j-right-front-hold.png");
  await wait(1800);
  assert.equal(await evaluate("document.querySelector('.arm-form-status').textContent"), "ARM FORM: COMPLETE");

  await evaluate("document.querySelector('#retryButton').click(); if (document.querySelector('#debugPanel').hidden) document.querySelector('#debugButton').click()");
  await wait(3000);
  const neutralElbows = await evaluate(`(() => {
    const text = document.querySelector(".control-diagnostics").textContent;
    return {
      left: Number.parseFloat(text.match(/LEFT ELBOW STATE .*?HUMAN CURRENT ([0-9.]+)°/)?.[1]),
      right: Number.parseFloat(text.match(/RIGHT ELBOW STATE .*?HUMAN CURRENT ([0-9.]+)°/)?.[1]),
      leftCorrect: /LEFT ARM ROLE .*DIRECTION CORRECT/.test(text),
      rightCorrect: /RIGHT ARM ROLE .*DIRECTION CORRECT/.test(text)
    };
  })()`);
  assert(neutralElbows.left >= 80 && neutralElbows.left <= 110 && neutralElbows.right >= 80 && neutralElbows.right <= 110, `neutral elbow angles invalid: ${JSON.stringify(neutralElbows)}`);
  assert(neutralElbows.leftCorrect && neutralElbows.rightCorrect, "neutral elbow direction is not correct");
  await screenshot("phase1k-none-3s.png");

  const inputMatrix = [
    ["Q", ["q"]], ["W", ["w"]], ["O", ["o"]], ["P", ["p"]],
    ["Q+O", ["q", "o"]], ["Q+P", ["q", "p"]], ["W+O", ["w", "o"]], ["W+P", ["w", "p"]]
  ];
  const browserMatrix = [];
  for (const [name, keys] of inputMatrix) {
    await evaluate(`(() => {
      document.querySelector("#retryButton").click();
      for (const key of ${JSON.stringify(keys)}) document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    })()`);
    await wait(1200);
    const result = await evaluate(`(() => {
      const text = document.querySelector(".control-diagnostics").textContent;
      return {
        left: /LEFT ARM ROLE .*DIRECTION CORRECT/.test(text),
        right: /RIGHT ARM ROLE .*DIRECTION CORRECT/.test(text)
      };
    })()`);
    assert(result.left && result.right, `${name}: browser elbow direction incorrect`);
    browserMatrix.push({ name, ...result });
    await screenshot(`phase1k-${name.toLowerCase().replaceAll("+", "-")}.png`);
    await evaluate(`for (const key of ${JSON.stringify(keys)}) document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }))`);
  }
  console.log("Phase 1K browser input matrix", JSON.stringify(browserMatrix));

  await evaluate("document.querySelector('#retryButton').click(); document.querySelector('.elbow-matrix-test').click()");
  await wait(11500);
  const matrixResult = await evaluate("document.querySelector('.physics-test-result').textContent");
  assert(matrixResult.includes("ELBOW MATRIX TEST: COMPLETE"), "ELBOW MATRIX TEST did not complete");
  assert((matrixResult.match(/CORRECT/g) || []).length === 18, `ELBOW MATRIX TEST did not report 18 correct directions: ${matrixResult}`);

  await evaluate("document.querySelector('.arm-connection-test').click()");
  await wait(9300);
  const connectionResult = await evaluate("document.querySelector('.physics-test-result').textContent");
  assert(connectionResult.includes("ARM CONNECTION TEST: COMPLETE"), "ARM CONNECTION TEST did not complete");
  const connectionGaps = [...connectionResult.matchAll(/(?:shoulder|elbow|wrist) ([0-9.]+)px/g)].map(match => Number.parseFloat(match[1]));
  assert(connectionGaps.length === 6 && connectionGaps.every(gap => gap <= 2), `connection gap exceeded 2px: ${connectionResult}`);

  await evaluate("document.querySelector('#debugButton').click(); document.querySelector('#retryButton').click(); document.querySelector('.fall-test').click(); document.querySelector('#debugButton').click()");
  await wait(500);
  const fallingCapture = await evaluate("document.querySelector('.physics-test-result').textContent");
  assert(fallingCapture.includes("FALLING") || fallingCapture.includes("DOWN"), "falling capture did not reach FALLING");
  await screenshot("phase1h-falling.png");
  await evaluate("document.querySelector('#debugButton').click()");
  await screenshot("landscape-debug.png");
  assert.deepEqual(errors, []);
  console.log(`Phase 1K browser smoke tests passed; drift ${driftMeters.toFixed(4)}m`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  try { socket?.close(); } catch {}
  try { browser?.kill(); } catch {}
  server.close();
});
