const assert = require("node:assert/strict");

module.exports = async function (call, evaluate) {
  const nativeAudio = await evaluate(`(async () => {
    document.querySelector('#playButton').click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const running = document.querySelector('#playButton').getAttribute('aria-pressed') === 'true';
    document.querySelector('#stopButton').click();
    return running && document.querySelector('#audioState').textContent === 'AUDIO STOPPED';
  })()`);
  assert.equal(nativeAudio, true, 'native Web Audio PLAY/STOP');
  const results = await evaluate(`(async () => {
    const $ = (s) => document.querySelector(s);
    const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
    const click = (s) => $(s).click();
    const audio = window.MinesweeperAudio;
    let resumes = 0, clearEffects = 0, stopped = 0, active = 0, maximum = 0;
    const interval = window.setInterval, clearInterval = window.clearInterval;
    const ids = new Set();
    window.setInterval = (...args) => {
      const id = interval(...args); ids.add(id); active++; maximum = Math.max(maximum, active); return id;
    };
    window.clearInterval = (id) => { if (ids.delete(id)) active--; clearInterval(id); };
    let resolveAudio;
    const defer = () => { audio.resume = () => { resumes++; return new Promise((resolve) => { resolveAudio = resolve; }); }; };
    const playing = () => $('#playButton').getAttribute('aria-pressed') === 'true';
    const busy = () => $('#playButton').getAttribute('aria-busy') === 'true';
    audio.stopAll = () => { stopped++; };
    audio.playClearEffect = () => { clearEffects++; };
    for (const name of ['playCellNote', 'playMineAccent', 'playMissEffect', 'playGlitchTick']) audio[name] = () => {};
    defer();
    click('#playButton'); click('#playButton'); click('#playButton');
    const singlePending = resumes === 1 && busy();
    click('#stopButton'); resolveAudio({}); await wait();
    const cancelled = !playing() && !busy() && active === 0;
    click('#playButton'); const oldResolve = resolveAudio;
    click('#newGameButton'); click('#playButton'); const newResolve = resolveAudio;
    oldResolve({}); await wait();
    const staleIgnored = busy() && !playing();
    newResolve({}); await wait();
    const singleScheduler = playing() && active === 1 && maximum === 1;
    click('#stopButton');
    click('#forceClearButton'); const oldCompletion = resolveAudio;
    click('#forceClearButton');
    const completionPending = busy();
    click('#newGameButton'); oldCompletion({}); await wait();
    const completionCancelled = !playing() && clearEffects === 0;
    click('#forceClearButton'); click('#stopButton'); resolveAudio({}); await wait();
    const completionStopped = !playing() && clearEffects === 0;
    click('#newGameButton');
    audio.resume = async () => { throw new Error('resume denied'); };
    click('#playButton'); await wait();
    const failed = !playing() && !busy() && !$('#audioNotice').hidden;
    click('#testOpenButton'); await wait();
    const failedAudioPlayable = Boolean($('.cell.open'));
    click('#newGameButton');
    audio.resume = async () => ({});
    const pointer = (el, type, id, x = 0) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', button: 0, clientX: x }));
    const mode = (value) => { $('#quickTouchMode').value = value; $('#quickTouchMode').dispatchEvent(new Event('change')); };
    let cell = $('.cell');
    pointer(cell, 'pointerdown', 1); pointer(cell, 'pointerdown', 2); pointer(cell, 'pointerup', 2); await wait();
    const foreignUpIgnored = !cell.classList.contains('open');
    pointer(cell, 'pointerup', 1); await wait();
    const ownerOpened = cell.classList.contains('open');
    click('#newGameButton'); cell = $('.cell');
    pointer(cell, 'pointerdown', 3); pointer(cell, 'pointermove', 3, 11); await wait(550); pointer(cell, 'pointerup', 3, 11); await wait();
    const movedCancelled = !cell.classList.contains('flagged') && !cell.classList.contains('open');
    pointer(cell, 'pointerdown', 4); await wait(550); pointer(cell, 'pointerup', 4); await wait();
    const longFlag = cell.classList.contains('flagged');
    click('#newGameButton'); cell = $('.cell');
    pointer(cell, 'pointerdown', 5); pointer(cell, 'pointercancel', 5); await wait(550);
    const cancelCleared = !cell.classList.contains('flagged');
    mode('TWO HAND');
    const hold = $('[data-modifier="FLAG"]');
    pointer(hold, 'pointerdown', 10); pointer(hold, 'pointerup', 11);
    pointer(cell, 'pointerdown', 12); pointer(cell, 'pointerup', 12); await wait();
    const twoHand = hold.classList.contains('active') && cell.classList.contains('flagged');
    pointer(hold, 'lostpointercapture', 10);
    const holdReleased = !hold.classList.contains('active');
    mode('DOUBLE TAP'); click('#newGameButton'); cell = $('.cell');
    for (const id of [20, 21]) { pointer(cell, 'pointerdown', id); pointer(cell, 'pointerup', id); }
    await wait(260);
    const doubleFlag = cell.classList.contains('flagged') && !cell.classList.contains('open');
    click('#newGameButton'); cell = $('.cell');
    pointer(cell, 'pointerdown', 24); pointer(cell, 'pointerup', 24); click('#stopButton'); await wait(260);
    const stopClearsTap = !cell.classList.contains('open');
    mode('SWITCH'); click('#newGameButton'); cell = $('.cell'); click('[data-switch-action="FLAG"]');
    pointer(cell, 'pointerdown', 22); pointer(cell, 'pointerup', 22); await wait();
    const switchFlag = cell.classList.contains('flagged');
    // A pending old-board cell action must not modify the replacement board.
    mode('STANDARD'); click('#newGameButton'); defer(); cell = $('.cell');
    pointer(cell, 'pointerdown', 23); pointer(cell, 'pointerup', 23);
    click('#newGameButton'); resolveAudio({}); await wait();
    const oldCellIgnored = !$('.cell').classList.contains('open');
    audio.resume = async () => ({});
    // Advance the scheduler clock without changing the sequencer's step/loop rules.
    const started = performance.now();
    audio.currentTime = () => (performance.now() - started) / 100;
    click('#forcePerfectButton'); await wait(2600);
    const fourLoops = !playing() && $('#completionProgress').textContent === 'PLAY TO REPEAT' && $('#debugState').textContent.includes('4/4') && $('#completionTitle').textContent === 'PERFECT SWEEP';
    click('#newGameButton'); defer(); click('#playButton'); window.dispatchEvent(new Event('blur')); resolveAudio({}); await wait();
    const blurCancelled = !playing() && !busy() && active === 0;
    click('#playButton');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange')); resolveAudio({}); await wait();
    const hiddenCancelled = !playing() && !busy();
    delete document.hidden;
    click('#playButton');
    click('#settingsButton'); $('#settingsForm').dispatchEvent(new Event('submit', { cancelable: true }));
    resolveAudio({}); await wait();
    const applyCancelled = !playing() && !busy();
    return { singlePending, cancelled, staleIgnored, singleScheduler, completionPending, completionCancelled, completionStopped, failed, failedAudioPlayable, foreignUpIgnored, ownerOpened, movedCancelled, longFlag, cancelCleared, twoHand, holdReleased, doubleFlag, stopClearsTap, switchFlag, oldCellIgnored, fourLoops, blurCancelled, hiddenCancelled, applyCancelled, stopped: stopped > 0 };
  })()`);
  for (const [name, value] of Object.entries(results)) assert.equal(value, true, name);

  const layouts = [];
  for (const [width, height] of [[320,568], [375,667], [390,844], [430,932], [844,390]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
    const layout = await evaluate(`(() => {
      document.querySelector('#settingsButton').click();
      document.querySelector('#settingPreset').value = '16 STEP';
      document.querySelector('#settingPreset').dispatchEvent(new Event('change'));
      document.querySelector('#settingBoardView').value = 'SCROLL';
      document.querySelector('#settingsForm').dispatchEvent(new Event('submit', { cancelable: true }));
      const wrap = document.querySelector('#boardWrap');
      wrap.scrollLeft = 100;
      const buttons = ['settingsButton','playButton','stopButton','newGameButton'].every((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && r.height >= 40;
      });
      const readable = ['gameStatus','missCount','tempoReadout','stepReadout'].every((id) => {
        const el = document.getElementById(id); return el.scrollWidth <= el.clientWidth;
      });
      document.querySelector('#settingsButton').click();
      const dialog = document.querySelector('#settingsDialog');
      const dialogFits = dialog.getBoundingClientRect().height <= innerHeight && getComputedStyle(dialog).overflowY === 'auto';
      dialog.close();
      return { buttons, readable, dialogFits, scroll: wrap.scrollLeft > 0, overflow: document.documentElement.scrollWidth > innerWidth, linkRemoved: !document.querySelector('.back-link'), zoomAllowed: !document.querySelector('meta[name=viewport]').content.includes('user-scalable=no') };
    })()`);
    for (const [name, value] of Object.entries(layout)) assert.equal(value, name === "overflow" ? false : true, `${width}x${height}: ${name}`);
    layouts.push({ width, height, ...layout });
    if (width === 320 || width === 844) {
      const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(), `mine-seq-focused-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const pcInput = await evaluate(`(async () => {
    window.MinesweeperAudio.resume = async () => ({});
    document.querySelector('#newGameButton').click();
    const cell = document.querySelector('.cell');
    for (const type of ['pointerdown', 'pointerup']) cell.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 30, pointerType: 'mouse', button: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const flag = [...document.querySelectorAll('.cell')].find((el) => !el.classList.contains('open'));
    flag.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return cell.classList.contains('open') && flag.classList.contains('flagged') && document.documentElement.scrollWidth <= innerWidth;
  })()`);
  assert.equal(pcInput, true, 'PC left OPEN / right FLAG');
  console.log(JSON.stringify({ ok: true, nativeAudio, results, layouts, pcInput }, null, 2));
};
