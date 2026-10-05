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
  mobile: path.join(os.tmpdir(), "mine-seq-mobile.png"),
  sixteenStep: path.join(os.tmpdir(), "mine-seq-16-step.png")
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

    async function applySettings(values) {
      await evaluate(`(() => {
        const values = ${JSON.stringify(values)};
        document.querySelector("#settingsButton").click();
        Object.entries(values).forEach(([id, value]) => {
          const control = document.querySelector("#" + id);
          if (typeof value === "boolean") control.checked = value;
          else control.value = value;
          control.dispatchEvent(new Event("change", { bubbles: true }));
        });
        document.querySelector("#settingsForm").requestSubmit();
      })()`);
      await delay(90);
    }

    await applySettings({
      settingPreset: "WIDE",
      settingDifficulty: "NORMAL",
      settingBoardView: "SCROLL"
    });
    const wideBoard = await evaluate(`({
      cells: document.querySelectorAll(".cell").length,
      steps: document.querySelectorAll(".step-label").length,
      tracks: document.querySelectorAll(".instrument-label").length,
      summary: document.querySelector("#boardSummary").textContent,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      internalScroll: document.querySelector("#boardWrap").scrollWidth > document.querySelector("#boardWrap").clientWidth
    })`);
    assert.deepEqual(wideBoard, {
      cells: 96, steps: 12, tracks: 8, summary: "8 × 12 / 15 MINES",
      pageWidth: 390, viewportWidth: 390, internalScroll: true
    });

    await applySettings({
      settingPreset: "16 STEP",
      settingDifficulty: "NORMAL",
      settingBoardView: "SCROLL",
      settingRandomBpm: false,
      settingFixedBpm: 150,
      settingFollowPlayhead: true
    });
    const sixteenBoard = await evaluate(`({
      cells: document.querySelectorAll(".cell").length,
      steps: document.querySelectorAll(".step-label").length,
      summary: document.querySelector("#boardSummary").textContent,
      tempo: document.querySelector("#tempoReadout").textContent,
      pageWidth: document.documentElement.scrollWidth,
      internalScroll: document.querySelector("#boardWrap").scrollWidth > document.querySelector("#boardWrap").clientWidth,
      cellWidth: document.querySelector(".cell").getBoundingClientRect().width
    })`);
    assert.equal(sixteenBoard.cells, 128);
    assert.equal(sixteenBoard.steps, 16);
    assert.equal(sixteenBoard.summary, "8 × 16 / 20 MINES");
    assert.equal(sixteenBoard.tempo, "BPM 150 / FAST");
    assert.equal(sixteenBoard.pageWidth, 390);
    assert.equal(sixteenBoard.internalScroll, true);
    assert.ok(sixteenBoard.cellWidth >= 39);
    const sixteenCapture = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(screenshots.sixteenStep, Buffer.from(sixteenCapture.data, "base64"));

    await evaluate(`(() => {
      const cell = document.querySelector(".cell");
      cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
      cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      document.querySelector("#playButton").click();
    })()`);
    await delay(1900);
    const followed = await evaluate(`({
      scrollLeft: document.querySelector("#boardWrap").scrollLeft,
      current: document.querySelectorAll(".cell.is-current").length,
      step: document.querySelector("#stepReadout").textContent
    })`);
    assert.ok(followed.scrollLeft > 0);
    assert.equal(followed.current, 8);
    const manualScroll = await evaluate(`(async () => {
      const wrap = document.querySelector("#boardWrap");
      wrap.scrollLeft = 25;
      wrap.dispatchEvent(new Event("scroll"));
      const before = wrap.scrollLeft;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { before, after: wrap.scrollLeft };
    })()`);
    assert.ok(Math.abs(manualScroll.after - manualScroll.before) < 3);
    await evaluate('document.querySelector("#stopButton").click()');
    await evaluate('document.querySelector("#forceClearButton").click()');
    await delay(100);
    const sixteenCompletion = await evaluate(`({
      status: document.querySelector("#gameStatus").textContent,
      playing: document.querySelector("#playButton").getAttribute("aria-pressed"),
      steps: document.querySelectorAll(".step-label").length,
      banner: document.querySelector("#completionTitle").textContent
    })`);
    assert.deepEqual(sixteenCompletion, {
      status: "COMPLETE", playing: "true", steps: 16, banner: "COMPLETE SEQUENCE"
    });
    await evaluate('document.querySelector("#stopButton").click()');

    const touchModes = await evaluate(`(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const mode = (value) => {
        const select = document.querySelector("#quickTouchMode");
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const tap = (cell, x = 100, y = 100) => {
        cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch", clientX: x, clientY: y }));
        cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch", clientX: x, clientY: y }));
      };
      const fresh = () => [...document.querySelectorAll(".cell")].find((cell) => !cell.classList.contains("open") && !cell.classList.contains("flagged"));
      const result = {};

      document.querySelector("#newGameButton").click();
      mode("STANDARD");
      tap(document.querySelector(".cell"));
      await wait(50);
      const standardFlag = fresh();
      standardFlag.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch", clientX: 100, clientY: 100 }));
      await wait(550);
      standardFlag.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch", clientX: 100, clientY: 100 }));
      await wait(30);
      result.standard = document.querySelectorAll(".cell.open").length > 0 && standardFlag.classList.contains("flagged");

      document.querySelector("#newGameButton").click();
      mode("SWITCH");
      document.querySelector('[data-switch-action="FLAG"]').click();
      const switchFlag = fresh();
      tap(switchFlag);
      await wait(25);
      document.querySelector('[data-switch-action="OPEN"]').click();
      const switchOpen = fresh();
      tap(switchOpen);
      await wait(45);
      result.switchMode = switchFlag.classList.contains("flagged") && switchOpen.classList.contains("open");

      document.querySelector("#newGameButton").click();
      mode("TWO HAND");
      const modifier = document.querySelector('[data-modifier="FLAG"]');
      modifier.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      const twoFlag = fresh();
      tap(twoFlag);
      await wait(25);
      modifier.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }));
      const twoOpen = fresh();
      tap(twoOpen);
      await wait(45);
      result.twoHand = twoFlag.classList.contains("flagged") && twoOpen.classList.contains("open");

      document.querySelector("#newGameButton").click();
      mode("DOUBLE TAP");
      const doubleFlag = fresh();
      tap(doubleFlag); await wait(60); tap(doubleFlag); await wait(400);
      const singleOpen = fresh();
      tap(singleOpen); await wait(450);
      result.doubleTap = doubleFlag.classList.contains("flagged") && !doubleFlag.classList.contains("open") && singleOpen.classList.contains("open");

      document.querySelector("#newGameButton").click();
      mode("FLICK");
      const flickFlag = fresh();
      flickFlag.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch", clientX: 100, clientY: 110 }));
      flickFlag.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch", clientX: 103, clientY: 75 }));
      await wait(25);
      const set = flickFlag.classList.contains("flagged");
      flickFlag.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch", clientX: 100, clientY: 80 }));
      flickFlag.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch", clientX: 102, clientY: 116 }));
      await wait(25);
      const removed = !flickFlag.classList.contains("flagged");
      const flickOpen = fresh();
      tap(flickOpen); await wait(45);
      const horizontal = fresh();
      horizontal.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch", clientX: 90, clientY: 100 }));
      horizontal.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch", clientX: 130, clientY: 105 }));
      await wait(25);
      result.flick = set && removed && flickOpen.classList.contains("open") && !horizontal.classList.contains("open") && !horizontal.classList.contains("flagged");
      return result;
    })()`);
    assert.deepEqual(touchModes, { standard: true, switchMode: true, twoHand: true, doubleTap: true, flick: true });

    await evaluate('document.querySelector("#newGameButton").click(); document.querySelector("#testChordButton").click()');
    await delay(180);
    const chord = await evaluate(`({
      open: document.querySelectorAll(".cell.open").length,
      accents: document.querySelectorAll(".cell.mine-accent").length,
      miss: document.querySelector("#missCount").textContent
    })`);
    assert.ok(chord.open > 1);
    assert.ok(chord.accents >= 1);
    assert.equal(chord.miss, "0 / 3");

    await applySettings({
      settingPreset: "LARGE",
      settingDifficulty: "NORMAL",
      settingBoardView: "COMPACT"
    });
    const largeBoard = await evaluate(`({
      cells: document.querySelectorAll(".cell").length,
      tracks: [...document.querySelectorAll(".instrument-label")].map((item) => item.textContent.trim()),
      summary: document.querySelector("#boardSummary").textContent
    })`);
    assert.equal(largeBoard.cells, 120);
    assert.deepEqual(largeBoard.tracks.slice(-2), ["CLAP", "PERC"]);
    assert.equal(largeBoard.summary, "10 × 12 / 19 MINES");

    await call("Page.navigate", { url: GAME_URL + "?debug=1&restore=1" });
    await retry(async () => {
      const count = await evaluate("document.readyState === 'complete' ? document.querySelectorAll('.cell').length : 0");
      if (count !== 120) throw new Error(`Saved settings did not restore: ${count} cells`);
    });
    const restored = await evaluate(`({
      summary: document.querySelector("#boardSummary").textContent,
      view: document.querySelector("#boardWrap").className,
      touch: document.querySelector("#quickTouchMode").value
    })`);
    assert.equal(restored.summary, "10 × 12 / 19 MINES");
    assert.match(restored.view, /view-compact/);
    assert.equal(restored.touch, "FLICK");

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
    console.log(JSON.stringify({ ok: true, initial, firstOpen, playing, stopped, mobile, reset, accent, glitchStarted, gameOver, cleared, completionStopped, perfect, wideBoard, sixteenBoard, followed, manualScroll, sixteenCompletion, touchModes, chord, largeBoard, restored, menu, screenshots }, null, 2));
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
