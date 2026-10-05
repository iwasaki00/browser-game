const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DEBUG_PORT = 9230;
const GAME_URL = "http://127.0.0.1:8030/030_minesweeper-sequencer/index.html";
const MENU_URL = "http://127.0.0.1:8030/index.html";
const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mine-seq-edge-"));
const screenshots = {
  desktop: path.join(os.tmpdir(), "mine-seq-desktop.png"),
  mobile: path.join(os.tmpdir(), "mine-seq-mobile.png")
};

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(operation, attempts = 40) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) { lastError = error; await delay(100); }
  }
  throw lastError;
}

async function main() {
  const edge = spawn(EDGE, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  try {
    await retry(async () => {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (!response.ok) throw new Error("DevTools is not ready");
    });

    const targetResponse = await fetch(
      `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(GAME_URL)}`,
      { method: "PUT" }
    );
    const target = await targetResponse.json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    let callId = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });

    function call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++callId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const result = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }

    await call("Runtime.enable");
    await call("Page.enable");
    await retry(async () => {
      const ready = await evaluate("document.readyState === 'complete' && document.querySelectorAll('.cell').length === 64");
      if (!ready) throw new Error("Game UI is not ready");
    });

    const initial = await evaluate(`({
      cells: document.querySelectorAll(".cell").length,
      steps: document.querySelectorAll(".step-label").length,
      tracks: document.querySelectorAll(".instrument-label").length,
      status: document.querySelector("#gameStatus").textContent,
      tempo: document.querySelector("#tempoReadout").textContent,
      errors: document.querySelector("#audioNotice").hidden
    })`);
    assert.equal(initial.cells, 64);
    assert.equal(initial.steps, 8);
    assert.equal(initial.tracks, 8);
    assert.equal(initial.status, "READY");
    assert.match(initial.tempo, /^BPM (9[0-9]|10[0-5]) \/ SLOW$|^BPM (11[0-9]|12[0-5]) \/ MID$|^BPM (13[0-9]|14[0-9]|150) \/ FAST$/);
    assert.equal(initial.errors, true);

    const firstOpen = await evaluate(`(async () => {
      window.__previewCount = 0;
      const original = window.MinesweeperAudio.playCellNote;
      window.MinesweeperAudio.playCellNote = (...args) => {
        if (args[2] && args[2].preview) window.__previewCount += 1;
        return original(...args);
      };
      const cell = document.querySelector('.cell[data-row="3"][data-column="3"]');
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        open: cell.classList.contains("open"),
        mine: cell.classList.contains("mine"),
        status: document.querySelector("#gameStatus").textContent,
        previews: window.__previewCount
      };
    })()`);
    assert.equal(firstOpen.open, true);
    assert.equal(firstOpen.mine, false);
    assert.equal(firstOpen.status, "DIGGING");
    assert.ok(firstOpen.previews >= 1);

    const flagResult = await evaluate(`(async () => {
      const cell = [...document.querySelectorAll(".cell")].find((item) => !item.classList.contains("open"));
      cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2 }));
      await new Promise((resolve) => setTimeout(resolve, 30));
      return cell.classList.contains("flagged");
    })()`);
    assert.equal(flagResult, true);

    await evaluate('document.querySelector("#playButton").click()');
    await delay(430);
    const playing = await evaluate(`({
      pressed: document.querySelector("#playButton").getAttribute("aria-pressed"),
      highlighted: document.querySelectorAll(".cell.is-current").length,
      step: document.querySelector("#stepReadout").textContent
    })`);
    assert.equal(playing.pressed, "true");
    assert.equal(playing.highlighted, 8);
    assert.match(playing.step, /^STEP [1-8]$/);

    await evaluate('document.querySelector("#stopButton").click()');
    const stopped = await evaluate(`({
      pressed: document.querySelector("#playButton").getAttribute("aria-pressed"),
      highlighted: document.querySelectorAll(".cell.is-current").length,
      step: document.querySelector("#stepReadout").textContent
    })`);
    assert.deepEqual(stopped, { pressed: "false", highlighted: 0, step: "STEP 1" });

    const desktopCapture = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(screenshots.desktop, Buffer.from(desktopCapture.data, "base64"));

    await call("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await delay(150);
    const mobile = await evaluate(`({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cellWidth: document.querySelector(".cell").getBoundingClientRect().width,
      boardWidth: document.querySelector(".board").getBoundingClientRect().width
    })`);
    assert.equal(mobile.viewport, 390);
    assert.ok(mobile.scrollWidth <= 390, `horizontal overflow: ${mobile.scrollWidth}`);
    assert.ok(mobile.cellWidth >= 30, `cell too small: ${mobile.cellWidth}`);
    assert.ok(mobile.boardWidth <= 372, `board too wide: ${mobile.boardWidth}`);

    const mobileCapture = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(screenshots.mobile, Buffer.from(mobileCapture.data, "base64"));

    await evaluate('document.querySelector("#newGameButton").click()');
    const reset = await evaluate(`({
      miss: document.querySelector("#missCount").textContent,
      status: document.querySelector("#gameStatus").textContent,
      open: document.querySelectorAll(".cell.open").length,
      flagged: document.querySelectorAll(".cell.flagged").length
    })`);
    assert.deepEqual(reset, { miss: "0 / 3", status: "READY", open: 0, flagged: 0 });

    await call("Page.navigate", { url: GAME_URL + "?debug=1" });
    await retry(async () => {
      const ready = await evaluate("document.readyState === 'complete' && !document.querySelector('#debugPanel').hidden");
      if (!ready) throw new Error("Debug UI is not ready");
    });
    const accent = await evaluate(`(async () => {
      const tap = (cell) => {
        cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
        cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      };
      tap(document.querySelector('.cell[data-row="3"][data-column="3"]'));
      await new Promise((resolve) => setTimeout(resolve, 70));
      window.__accentPreviewCount = 0;
      const originalAccent = window.MinesweeperAudio.playMineAccent;
      window.MinesweeperAudio.playMineAccent = (...args) => {
        if (args[2] && args[2].preview) window.__accentPreviewCount += 1;
        return originalAccent(...args);
      };
      const mine = document.querySelector(".cell.debug-mine");
      mine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2 }));
      await new Promise((resolve) => setTimeout(resolve, 40));
      const enabled = mine.classList.contains("mine-accent");
      mine.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, button: 2 }));
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        enabled,
        previewed: window.__accentPreviewCount === 1,
        removed: !mine.classList.contains("mine-accent")
      };
    })()`);
    assert.deepEqual(accent, { enabled: true, previewed: true, removed: true });

    const glitchStarted = await evaluate(`(async () => {
      const mine = document.querySelector(".cell.debug-mine");
      mine.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      mine.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        miss: document.querySelector("#missCount").textContent,
        visual: document.body.classList.contains("glitching"),
        debug: document.querySelector("#debugState").textContent.includes("glitch=true")
      };
    })()`);
    assert.deepEqual(glitchStarted, { miss: "1 / 3", visual: true, debug: true });
    await delay(780);
    assert.equal(await evaluate('document.body.classList.contains("glitching")'), false);

    await evaluate(`(async () => {
      const tap = (cell) => {
        cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
        cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      };
      for (const mine of [...document.querySelectorAll(".cell.debug-mine:not(.open)")].slice(0, 2)) {
        tap(mine);
        await new Promise((resolve) => setTimeout(resolve, 35));
      }
    })()`);
    const gameOver = await evaluate(`({
      status: document.querySelector("#gameStatus").textContent,
      miss: document.querySelector("#missCount").textContent,
      result: document.querySelector("#resultTitle").textContent,
      overlayVisible: !document.querySelector("#resultOverlay").hidden,
      disabledCells: document.querySelectorAll(".cell:disabled").length
    })`);
    assert.deepEqual(gameOver, {
      status: "GAME OVER",
      miss: "3 / 3",
      result: "GAME OVER",
      overlayVisible: true,
      disabledCells: 64
    });

    await evaluate('document.querySelector("#overlayNewGame").click()');
    await evaluate(`(async () => {
      const tap = (cell) => {
        cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
        cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      };
      tap(document.querySelector('.cell[data-row="3"][data-column="3"]'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      [...document.querySelectorAll(".cell:not(.debug-mine)")].forEach((cell) => {
        if (!cell.classList.contains("open")) tap(cell);
      });
      await new Promise((resolve) => setTimeout(resolve, 120));
    })()`);
    const cleared = await evaluate(`({
      status: document.querySelector("#gameStatus").textContent,
      title: document.querySelector("#completionTitle").textContent,
      bannerVisible: !document.querySelector("#completionBanner").hidden,
      playing: document.querySelector("#playButton").getAttribute("aria-pressed"),
      openSafe: document.querySelectorAll(".cell.open:not(.mine)").length
    })`);
    assert.deepEqual(cleared, {
      status: "COMPLETE",
      title: "COMPLETE SEQUENCE",
      bannerVisible: true,
      playing: "true",
      openSafe: 54
    });

    await delay(500);
    await evaluate('document.querySelector("#stopButton").click()');
    const completionStopped = await evaluate(`({
      status: document.querySelector("#gameStatus").textContent,
      playing: document.querySelector("#playButton").getAttribute("aria-pressed"),
      progress: document.querySelector("#completionProgress").textContent
    })`);
    assert.deepEqual(completionStopped, { status: "CLEAR", playing: "false", progress: "PLAY TO REPEAT" });

    await evaluate('document.querySelector("#newGameButton").click(); document.querySelector("#forcePerfectButton").click()');
    await delay(100);
    const perfect = await evaluate(`({
      title: document.querySelector("#completionTitle").textContent,
      bannerPerfect: document.querySelector("#completionBanner").classList.contains("perfect"),
      accents: document.querySelectorAll(".cell.mine-accent").length,
      playing: document.querySelector("#playButton").getAttribute("aria-pressed")
    })`);
    assert.deepEqual(perfect, { title: "PERFECT SWEEP", bannerPerfect: true, accents: 10, playing: "true" });
    await evaluate('document.querySelector("#stopButton").click()');

    await call("Page.navigate", { url: MENU_URL });
    await retry(async () => {
      const ready = await evaluate("document.readyState === 'complete' && document.querySelectorAll('.game-card').length === 30");
      if (!ready) throw new Error("Top menu did not render 30 cards");
    });
    const menu = await evaluate(`({
      cards: document.querySelectorAll(".game-card").length,
      firstTitle: document.querySelector(".game-card h2").textContent,
      firstHref: document.querySelector(".game-card").getAttribute("href"),
      count: document.querySelector(".game-count strong").textContent
    })`);
    assert.deepEqual(menu, {
      cards: 30,
      firstTitle: "マインスイーパシーケンサ",
      firstHref: "./030_minesweeper-sequencer/index.html",
      count: "30"
    });
    socket.close();
    console.log(JSON.stringify({ ok: true, initial, firstOpen, playing, stopped, mobile, reset, accent, glitchStarted, gameOver, cleared, completionStopped, perfect, menu, screenshots }, null, 2));
  } finally {
    const edgeExited = new Promise((resolve) => edge.once("exit", resolve));
    edge.kill();
    await Promise.race([edgeExited, delay(1000)]);
    await delay(250);
    const resolvedProfile = path.resolve(profileDirectory);
    const resolvedTemp = path.resolve(os.tmpdir()) + path.sep;
    if (resolvedProfile.startsWith(resolvedTemp)) {
      try {
        fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
      } catch (error) {
        console.warn(`Temporary Edge profile could not be removed: ${error.code}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
