"use strict";

const endpoint = process.argv[2] || "http://127.0.0.1:9231";
const pageUrl = process.argv[3] || "http://127.0.0.1:8047/index.html";

async function main() {
  const targets = await (await fetch(`${endpoint}/json`)).json();
  const target = targets.find((item) => item.type === "page" && item.url.startsWith(pageUrl));
  if (!target) throw new Error("Dice Rhythm Challenge tab was not found.");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call("Page.reload", { ignoreCache: true });
  const expression = `(async () => {
    const waitFor = async (predicate, timeout = 15000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error("UI wait timed out");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    try {
      await waitFor(() => document.querySelectorAll("#midiLibrary option").length >= 14 && !document.getElementById("midiLibrary").disabled, 30000);
    } catch (error) {
      return {
        preflightError: error.message,
        libraryCount: document.querySelectorAll("#midiLibrary option").length,
        libraryDisabled: document.getElementById("midiLibrary").disabled,
        midiStatus: document.getElementById("midiStatus").textContent,
        progress: document.querySelector(".midi-progress-head")?.textContent,
        version: document.querySelector(".version")?.textContent,
      viewport: { width: innerWidth, height: innerHeight }, globals: { common: Boolean(window.MidiCommon), audio: Boolean(window.MidiAudio), analyzer: Boolean(window.MidiRhythmAnalyzer), generator: Boolean(window.MidiDiceChartGenerator), gameChart: Boolean(window.MidiGameChart), diagnostics: Boolean(window.MidiChartDiagnostics), integration: Boolean(window.MidiIntegration) }
      };
    }
    const midiMode = document.querySelector('input[name="playMode"][value="midi"]');
    midiMode.checked = true;
    midiMode.dispatchEvent(new Event("change", { bubbles: true }));
    const library = document.getElementById("midiLibrary");
    library.value = "Movie_Themes_-_Addams_Family.mid";
    library.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => !library.disabled && document.getElementById("midiName").textContent.includes("Addams_Family"), 20000);
    const analysisTrack = document.getElementById("analysisTrack");
    analysisTrack.value = "5";
    analysisTrack.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    const addamsDice3PreviewCount = document.querySelectorAll(".chart-die.value-3").length;
    const addamsSignature = document.getElementById("midiSignature").textContent;
    const buttons = [...document.querySelectorAll(".dice-button")];
    const rects = buttons.map((button) => { const rect = button.getBoundingClientRect(); return { value: Number(button.dataset.value), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; });
    const gameTrack = document.getElementById("gameTrack");
    gameTrack.value = "5";
    gameTrack.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("testMode").checked = true;
    document.getElementById("startButton").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    await waitFor(() => document.getElementById("startScreen").hidden, 5000);
    const greenButton = document.querySelector('.dice-button[data-value="3"]');
    await new Promise((resolve, reject) => {
      const deadline = performance.now() + 22000;
      const poll = () => {
        if (greenButton.classList.contains("test-target")) resolve();
        else if (performance.now() >= deadline) reject(new Error("Dice 3 target wait timed out"));
        else requestAnimationFrame(poll);
      };
      poll();
    });
    const scoreBefore = Number(document.getElementById("score").textContent);
    const beatDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--beat-duration"));
    const targetStarted = performance.now();
    let guidePulses = 0;
    let previousCue = false;
    let tapsSent = 0;
    while (greenButton.classList.contains("test-target") && performance.now() - targetStarted < beatDuration + 250) {
      const elapsed = performance.now() - targetStarted;
      if (tapsSent < 3 && elapsed >= tapsSent * beatDuration / 3 + 8) {
        greenButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        tapsSent += 1;
      }
      const cue = greenButton.classList.contains("guide-cue");
      if (cue && !previousCue) guidePulses += 1;
      previousCue = cue;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    const dice3Gameplay = { guidePulses, tapsSent, beatDuration, scoreGain: Number(document.getElementById("score").textContent) - scoreBefore };
    await waitFor(() => !document.getElementById("grid").classList.contains("row-shift"), 1500);
    const activeOnSecondRow = Boolean(document.querySelector("#grid > .dice-row:nth-child(2) .die.active"));
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => !document.getElementById("pauseScreen").hidden, 2000);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.getElementById("resumeButton").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    await waitFor(() => document.getElementById("pauseScreen").hidden, 3000);
    const pauseResume = { paused: true, resumed: document.getElementById("pauseScreen").hidden };
    document.getElementById("stageMenu").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    document.getElementById("testMode").dispatchEvent(new Event("change", { bubbles: true }));
    library.value = "Disney_Themes_-_Tiki_Room.mid";
    library.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => !library.disabled && document.getElementById("midiName").textContent.includes("Tiki_Room"), 20000);
    const tikiAnalysisTrack = document.getElementById("analysisTrack");
    tikiAnalysisTrack.value = "1";
    tikiAnalysisTrack.dispatchEvent(new Event("change", { bubbles: true }));
    const quantizeToggle = document.getElementById("quantizeToggle");
    const quantizeControlVisible = !document.getElementById("quantizeControl").hidden;
    const qOnText = [...document.getElementById("gameTrack").options].find((option) => option.value === "1")?.textContent || "";
    quantizeToggle.checked = false;
    quantizeToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => ([...document.getElementById("gameTrack").options].find((option) => option.value === "1")?.textContent || "").includes("Q 0"), 5000);
    const qOffText = [...document.getElementById("gameTrack").options].find((option) => option.value === "1")?.textContent || "";
    const offDiagnostics = document.getElementById("diagnosticsStatus").textContent;
    quantizeToggle.checked = true;
    quantizeToggle.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => !([...document.getElementById("gameTrack").options].find((option) => option.value === "1")?.textContent || "").includes("Q 0"), 5000);
    const qRestoredText = [...document.getElementById("gameTrack").options].find((option) => option.value === "1")?.textContent || "";
    const quantizeAB = { quantizeControlVisible, qOnText, qOffText, offDiagnostics, qRestoredText };
    library.value = "Disney_Themes_-_Hakuna_Matata.mid";
    library.dispatchEvent(new Event("change", { bubbles: true }));
    await waitFor(() => !library.disabled && document.getElementById("midiName").textContent.includes("Hakuna_Matata"), 20000);
    const hakunaSignature = document.getElementById("midiSignature").textContent;
    document.getElementById("testMode").checked = true;
    document.getElementById("startButton").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    await waitFor(() => document.getElementById("startScreen").hidden, 5000);
    await new Promise((resolve) => setTimeout(resolve, 1250));
    const nonFourFour = {
      signature: hakunaSignature,
      started: document.getElementById("startScreen").hidden,
      dummyPreviewCount: document.querySelectorAll(".chart-die.dummy").length,
      activeGameTrack: document.getElementById("gameTrack").value,
      message: document.getElementById("midiStatus").textContent
    };
    document.getElementById("stageMenu").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    const normalModeInput = document.querySelector('input[name="playMode"][value="normal"]');
    normalModeInput.checked = true;
    normalModeInput.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("testMode").checked = false;
    document.getElementById("startButton").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    await waitFor(() => document.getElementById("startScreen").hidden, 5000);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const normalMode = {
      midiPanelHidden: document.getElementById("midiPanel").hidden,
      debugHidden: document.getElementById("debugButton").hidden,
      activeDice: [...document.querySelectorAll(".die.active")].map((die) => [...die.classList].find((name) => name.startsWith("value-")))
    };
    document.getElementById("stageMenu").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
    return {
      version: document.querySelector(".version")?.textContent,
      viewport: { width: innerWidth, height: innerHeight },
      libraryCount: library.options.length,
      midiName: document.getElementById("midiName").textContent,
      gameTrackCount: document.getElementById("gameTrack").options.length,
      diagnosticsStatus: document.getElementById("diagnosticsStatus").textContent,
      exportButtons: [document.getElementById("exportDiagnosticsJson")?.textContent, document.getElementById("exportDiagnosticsCsv")?.textContent],
      diceButtons: rects,
      diceButtonOrder: buttons.map((button) => Number(button.dataset.value)),
      controlsFitViewport: rects.every((rect) => rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight),
      chartDice3Count: addamsDice3PreviewCount,
      addamsSignature,
      activeOnSecondRow,
      pauseResume,
      chartStatistics: document.getElementById("chartStatistics").textContent,
      dice3Gameplay,
      nonFourFour,
      quantizeAB,
      normalMode,
      errors: [...document.querySelectorAll(".error")].map((node) => node.textContent)
    };
  })()`;
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  socket.close();
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  const value = result.result.value;
  if (value.preflightError) {
    console.log(JSON.stringify({ tests: 1, result: "FAIL", failed: ["library preflight"], value }, null, 2));
    process.exitCode = 1;
    return;
  }
  const assertions = [
    [!value.preflightError, "library preflight"],
    [value.version === "VERSION 3.1.0 MIDI QUANTIZE", "version"],
    [value.libraryCount === 14, "library count"],
    [value.diceButtonOrder.join(",") === "1,2,3,4", "button order"],
    [value.controlsFitViewport, "mobile controls fit"],
    [value.chartDice3Count > 0, "Dice 3 preview"],
    [value.addamsSignature === "4/4", "4/4 MIDI starts"],
    [value.activeOnSecondRow, "active beat remains on second row"],
    [value.pauseResume.paused && value.pauseResume.resumed, "pause and resume"],
    [value.diagnosticsStatus.includes("BEFORE REAL") && value.diagnosticsStatus.includes("AFTER REAL"), "diagnostics summary"],
    [value.exportButtons.every(Boolean), "diagnostic exports"],
    [value.dice3Gameplay.guidePulses === 3, "Dice 3 guide pulses"],
    [value.dice3Gameplay.tapsSent === 3 && value.dice3Gameplay.scoreGain >= 300, "Dice 3 three-tap success"],
    [value.nonFourFour.signature !== "4/4" && value.nonFourFour.started, "non-4/4 MIDI starts"],
    [value.nonFourFour.dummyPreviewCount > 0, "DUMMY preview"],
    [value.quantizeAB.quantizeControlVisible && /Q [1-9]/.test(value.quantizeAB.qOnText), "Quantize ON metrics"],
    [value.quantizeAB.qOffText.includes("Q 0") && value.quantizeAB.offDiagnostics.includes("Q 0"), "Quantize OFF restores Phase 4E"],
    [/Q [1-9]/.test(value.quantizeAB.qRestoredText), "Quantize ON restored"],
    [value.normalMode.midiPanelHidden && value.normalMode.debugHidden && value.normalMode.activeDice.every((name) => name !== "value-3"), "normal mode unchanged"],
    [value.errors.length === 0, "no visible errors"]
  ];
  const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
  console.log(JSON.stringify({ tests: assertions.length, result: failed.length ? "FAIL" : "PASS", failed, value }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
