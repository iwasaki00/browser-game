import { createTurnTracker, TURN_ANGLE } from "./handle.js";
import { createToyAudio } from "./audio.js";
import { MACHINE } from "./data.js";

export function createGachaExperience({ game, showResult, notify }) {
  const $ = (selector) => document.querySelector(selector);
  const machine = $("#gacha-machine");
  const handle = $("#handle");
  const dialog = $("#result-dialog");
  const tracker = createTurnTracker();
  const audio = createToyAudio({ isMuted: () => game.getState().settings.muted });
  let phase = "idle";
  let timers = [];
  let pointer = null;
  let swipe = null;
  let lastTouch = 0;
  let autoOpen = null;
  const reduced = () => game.getState().settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const quick = () => game.getState().settings.playMode === "quick";
  const later = (callback, ms) => { const id = setTimeout(callback, ms); timers.push(id); return id; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; clearTimeout(autoOpen); autoOpen = null; }
  function setPhase(next) { phase = next; machine.dataset.phase = next; sync(); }
  function setAngle(angle, returning = false) {
    handle.classList.toggle("returning", returning);
    handle.style.setProperty("--turn", `${angle}deg`);
  }
  function releasePointer() {
    if (pointer !== null && handle.hasPointerCapture?.(pointer)) handle.releasePointerCapture(pointer);
    pointer = null;
  }
  function cancelTurn() {
    if (phase !== "turning") return;
    clearTimers();
    tracker.cancel(); releasePointer(); setAngle(0, true); setPhase("idle");
  }
  function sync() {
    const state = game.getState();
    const busy = phase !== "idle" && phase !== "turning";
    handle.disabled = busy || state.coins < MACHINE.cost;
    $("#draw-button").disabled = phase !== "idle" || state.coins < MACHINE.cost;
    $("#dispense-skip").hidden = phase !== "dispensing";
    $("#mode-label").textContent = { normal: "通常モード", careful: "じっくりモード", quick: "サクサクモード" }[state.settings.playMode];
    $("#draw-button").innerHTML = `${quick() ? "ワンタップで回す" : "タップで回す"} <span>${MACHINE.cost} G</span>`;
    $("#machine-hint").textContent = phase === "turning" ? "カリ、カリ… そのまま時計回り！"
      : phase === "dispensing" ? "コロン… カプセルが出てくるよ"
      : state.coins < MACHINE.cost ? "コインが足りません。所持品を売って続けよう"
      : quick() ? "ボタンをタップして、すぐ次の出会いへ" : "ハンドルを時計回りにぐるっと回そう";
  }
  function presentCapsule({ restored = false } = {}) {
    const pending = game.getState().pendingDraw;
    if (!pending) return;
    setPhase("capsule");
    dialog.className = "modal result-modal capsule-waiting";
    $("#capsule-stage").hidden = false;
    $("#capsule-stage").classList.remove("opened");
    $("#result-card").hidden = true;
    $("#result-card").innerHTML = "";
    dialog.querySelector("[data-skip]").hidden = false;
    $("#open-hint").textContent = restored ? "受け取り途中のカプセルです。タップで開封"
      : game.getState().settings.playMode === "careful" ? "タップ、または上にスワイプして開封" : "まもなく開封… タップでも開けられます";
    if (!dialog.open) dialog.showModal();
    $("#open-capsule").focus({ preventScroll: true });
    if (game.getState().settings.playMode !== "careful") autoOpen = later(() => open(), quick() || reduced() ? 180 : 750);
  }
  function commit() {
    if (phase !== "turning") return;
    tracker.cancel(); releasePointer();
    // This synchronous call persists coins, inventory and pending result together.
    const result = game.beginDraw();
    if (!result.ok) {
      setAngle(0, true); setPhase("idle");
      notify(result.reason === "pending" ? "受け取り中のカプセルを先に開封しよう" : "コインが足りません");
      if (result.reason === "pending") restore();
      return;
    }
    setPhase("dispensing"); audio.play("coin");
    const short = quick() || reduced();
    later(() => audio.play("roll"), short ? 50 : 180);
    later(() => audio.play("drop"), short ? 150 : 820);
    later(() => { setAngle(0, true); presentCapsule(); }, short ? 300 : 1350);
  }
  function tapTurn() {
    if (phase !== "idle") return;
    if (game.getState().coins < MACHINE.cost) { notify("所持品を売るか、王様支援で続けよう"); return; }
    audio.unlock();
    setPhase("turning"); setAngle(0);
    // The phase lock is set before animation, so repeated taps cannot buy twice.
    setAngle(TURN_ANGLE, true);
    later(commit, quick() || reduced() ? 70 : 300);
  }
  function reveal() {
    const pending = game.getState().pendingDraw;
    if (!pending) return;
    game.revealPendingDraw();
    $("#capsule-stage").hidden = true;
    dialog.classList.remove("capsule-waiting");
    dialog.querySelector("[data-skip]").hidden = true;
    setPhase("result");
    showResult(game.getState().pendingDraw);
  }
  function open({ skip = false } = {}) {
    if (!["capsule", "dispensing"].includes(phase)) return;
    clearTimers();
    if (!dialog.open) presentCapsule();
    clearTimers();
    setPhase("opening");
    $("#capsule-stage").classList.add("opened");
    audio.unlock(); audio.play("open");
    later(reveal, skip || reduced() ? 0 : quick() ? 120 : 320);
  }
  function finish() {
    if (phase !== "result") return;
    clearTimers(); game.finishPendingDraw();
    dialog.close(); tracker.cancel(); releasePointer(); setAngle(0, true); setPhase("idle");
  }
  function restore() {
    clearTimers(); tracker.cancel(); releasePointer(); setAngle(0, true);
    const pending = game.getState().pendingDraw;
    if (!pending) { setPhase("idle"); return; }
    if (pending.revealed) {
      if (!dialog.open) dialog.showModal();
      $("#capsule-stage").hidden = true;
      dialog.querySelector("[data-skip]").hidden = true;
      setPhase("result"); showResult(pending, false);
    } else presentCapsule({ restored: true });
  }
  function coordinates(event) {
    const rect = handle.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    return { angle: Math.atan2(dy, dx) * 180 / Math.PI, radius: Math.hypot(dx, dy) };
  }
  handle.addEventListener("pointerdown", (event) => {
    if (phase !== "idle" || (event.pointerType === "mouse" && event.button !== 0)) return;
    const point = coordinates(event);
    if (point.radius < 16 || !tracker.begin(event.pointerId, point.angle)) return;
    event.preventDefault(); audio.unlock();
    pointer = event.pointerId;
    handle.setPointerCapture(pointer); setAngle(0); setPhase("turning"); lastTouch = performance.now();
  });
  handle.addEventListener("pointermove", (event) => {
    if (pointer !== event.pointerId || phase !== "turning") return;
    event.preventDefault();
    const point = coordinates(event);
    if (point.radius < 16) { cancelTurn(); return; }
    const turn = tracker.move(event.pointerId, point.angle);
    if (!turn) return;
    setAngle(Math.floor(turn.progress / 6) * 6);
    if (turn.tick) audio.play("tick");
    if (turn.complete) commit();
  });
  handle.addEventListener("pointerup", (event) => { if (pointer === event.pointerId) cancelTurn(); });
  handle.addEventListener("pointercancel", cancelTurn);
  handle.addEventListener("lostpointercapture", () => { if (tracker.active) cancelTurn(); });
  handle.addEventListener("click", (event) => { if (event.detail === 0 && performance.now() - lastTouch > 400) tapTurn(); });
  $("#open-capsule").addEventListener("click", () => open());
  $("#open-capsule").addEventListener("pointerdown", (event) => {
    if (phase !== "capsule" || swipe) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  });
  $("#open-capsule").addEventListener("pointermove", (event) => {
    if (swipe?.id !== event.pointerId) return;
    if (swipe.y - event.clientY > 40 && Math.abs(swipe.x - event.clientX) < 90) { swipe = null; open(); }
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => $("#open-capsule").addEventListener(name, () => { swipe = null; }));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (phase === "result") finish(); else open({ skip: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelTurn(); audio.suspend();
      if (game.getState().pendingDraw) clearTimers();
    } else if (game.getState().pendingDraw && phase !== "result") restore();
  });
  window.addEventListener("blur", cancelTurn);
  window.addEventListener("pagehide", () => { cancelTurn(); game.save(); });
  return {
    sync, tapTurn, open, finish, restore, cancelTurn,
    get busy() { return !["idle", "turning"].includes(phase); },
    reward(stars) { audio.play("reward", stars); }
  };
}
