(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const synth = new MidiAudio.MidiSynth();
  const player = new MidiAudio.AudioClockPlayer(synth, updateTransportState);
  const pitches = [72, 71, 69, 67, 65, 64, 62, 60];
  let grid = createEmptyGrid(16);
  let currentSong = null;
  let isSeeking = false;
  let debugVisible = false;
  let isCreationPreview = false;
  let activePlayheadStep = -1;
  let confirmAction = null;
  let confirmCancelAction = null;
  let lastSavedSnapshot = null;

  function createEmptyGrid(steps) { return pitches.map(() => Array(steps).fill(false)); }
  function formatTime(seconds) {
    const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
    const minutes = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000), millis = ms % 1000;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  function fixed(value, digits = 3) { return Number(value).toFixed(digits); }
  function setMessage(text, isError = false) { $("message").textContent = text; $("message").classList.toggle("error", isError); }
  function noteCount() { return grid.reduce((total, row) => total + row.filter(Boolean).length, 0); }

  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("is-active", el.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.toggle("is-active", el.id === `tab-${name}`));
    if (name === "create") updateCreationInfo();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0]; if (file) readFile(file);
    event.target.value = "";
  });
  ["dragenter", "dragover"].forEach((type) => $("dropZone").addEventListener(type, (event) => { event.preventDefault(); $("dropZone").classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((type) => $("dropZone").addEventListener(type, (event) => { event.preventDefault(); $("dropZone").classList.remove("is-dragging"); }));
  $("dropZone").addEventListener("drop", (event) => { const file = event.dataTransfer.files[0]; if (file) readFile(file); });

  async function readFile(file) {
    if (!/\.(mid|midi)$/i.test(file.name)) { setMessage(".mid または .midi ファイルを選択してください。", true); return; }
    try {
      setMessage("MIDIを解析しています…");
      const song = MidiCore.parse(await file.arrayBuffer(), file.name);
      loadSong(song, `${file.name} を読み込みました。`);
      compareLoadedSong(song);
    } catch (error) { console.error(error); setMessage(`読み込みエラー: ${error.message}`, true); }
  }

  function loadSong(song, message) {
    isCreationPreview = false; clearPlayhead();
    currentSong = song; player.setSong(song); renderSong();
    $("statusDot").classList.add("ready"); $("headerStatus").textContent = `${song.totalNotes} notes ready`;
    setMessage(message || "MIDIデータを準備しました。");
  }

  function renderSong() {
    if (!currentSong) return;
    $("sumFile").textContent = currentSong.fileName;
    $("sumFormat").textContent = `Type ${currentSong.format}`;
    $("sumTracks").textContent = currentSong.tracks.length;
    $("sumBpm").textContent = formatBpm(currentSong.bpm);
    $("sumTimeSig").textContent = `${currentSong.timeSignature.numerator} / ${currentSong.timeSignature.denominator}`;
    $("sumLength").textContent = formatTime(currentSong.duration);
    $("sumNotes").textContent = currentSong.totalNotes.toLocaleString("ja-JP");
    $("totalTime").textContent = formatTime(currentSong.duration);
    $("seekBar").max = Math.max(0.001, currentSong.duration);
    renderTrackToggles(); renderTrackTable(); renderNoteTable(); updateMonitor(0);
  }

  function formatBpm(bpm) { return Math.abs(bpm - Math.round(bpm)) < 0.005 ? String(Math.round(bpm)) : bpm.toFixed(2); }
  function channelText(track) { return track.channels.length ? track.channels.map((c) => c + 1).join(", ") : "—"; }
  function programText(track) { return track.programs.length ? track.programs.join(", ") : "—"; }

  function renderTrackToggles() {
    $("trackToggles").classList.remove("empty-state"); $("trackToggles").replaceChildren();
    currentSong.tracks.forEach((track, index) => {
      const label = document.createElement("label"); label.className = "track-toggle";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = track.enabled;
      checkbox.addEventListener("change", () => { track.enabled = checkbox.checked; updateTrackBulkButtons(); });
      const text = document.createElement("span");
      const strong = document.createElement("strong"); strong.textContent = `Track ${index + 1} · ${track.name}`;
      const small = document.createElement("small"); small.textContent = `${track.instrumentName} / ${track.notes.length} notes`;
      text.append(strong, small); label.append(checkbox, text); $("trackToggles").append(label);
    });
    updateTrackBulkButtons();
  }

  function setAllTracks(enabled) {
    if (!currentSong) return;
    currentSong.tracks.forEach((track) => { track.enabled = enabled; });
    $("trackToggles").querySelectorAll('input[type="checkbox"]').forEach((checkbox) => { checkbox.checked = enabled; });
    updateTrackBulkButtons();
  }

  function updateTrackBulkButtons() {
    const hasTracks = Boolean(currentSong?.tracks.length);
    $("tracksOnButton").disabled = !hasTracks || currentSong.tracks.every((track) => track.enabled);
    $("tracksOffButton").disabled = !hasTracks || currentSong.tracks.every((track) => !track.enabled);
  }

  function renderTrackTable() {
    $("trackTable").replaceChildren();
    currentSong.tracks.forEach((track, i) => {
      const tr = document.createElement("tr");
      [i + 1, track.name, channelText(track), programText(track), track.instrumentName, track.notes.length].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); });
      $("trackTable").append(tr);
    });
  }

  function renderNoteTable() {
    const notes = currentSong.tracks.flatMap((track, ti) => track.notes.map((note) => ({ track: ti + 1, ...note }))).sort((a, b) => a.startTime - b.startTime);
    const shown = notes.slice(0, 200); $("noteTable").replaceChildren();
    shown.forEach((note) => {
      const tr = document.createElement("tr");
      [note.track, note.channel + 1, note.noteNumber, note.noteName, fixed(note.startTime), fixed(note.startTime + note.duration), fixed(note.duration), note.velocity].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); });
      $("noteTable").append(tr);
    });
    if (!shown.length) { const tr = document.createElement("tr"), td = document.createElement("td"); td.colSpan = 8; td.className = "empty-cell"; td.textContent = "ノートイベントがありません。"; tr.append(td); $("noteTable").append(tr); }
    $("noteLimitLabel").textContent = notes.length > 200 ? `先頭200件を表示（全${notes.length.toLocaleString("ja-JP")}件）` : `${notes.length}件を表示`;
  }

  $("playButton").addEventListener("click", async () => {
    try { isCreationPreview = false; player.setLoop(false); await player.play(); }
    catch (error) { setMessage(error.message, true); selectTab(currentSong ? "play" : "load"); }
  });
  $("pauseButton").addEventListener("click", () => player.pause());
  $("stopButton").addEventListener("click", () => player.stop());
  $("rewindButton").addEventListener("click", () => player.rewind());
  $("tracksOnButton").addEventListener("click", () => setAllTracks(true));
  $("tracksOffButton").addEventListener("click", () => setAllTracks(false));
  document.querySelectorAll(".scroll-button").forEach((button) => button.addEventListener("click", () => {
    const container = $(button.dataset.scrollTarget);
    container.scrollBy({ left: Number(button.dataset.scrollDirection) * Math.max(180, container.clientWidth * 0.55), behavior: "smooth" });
  }));
  $("trackTableWrap").addEventListener("wheel", (event) => {
    const container = event.currentTarget;
    if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || container.scrollWidth <= container.clientWidth) return;
    event.preventDefault(); container.scrollLeft += event.deltaY;
  }, { passive: false });
  $("volume").addEventListener("input", (event) => { synth.setVolume(event.target.value); $("volumeValue").textContent = `${Math.round(event.target.value * 100)}%`; });
  $("seekBar").addEventListener("pointerdown", () => { isSeeking = true; });
  $("seekBar").addEventListener("input", (event) => { isSeeking = true; $("currentTime").textContent = formatTime(event.target.value); updateMonitor(Number(event.target.value)); });
  $("seekBar").addEventListener("change", (event) => { player.seek(event.target.value); isSeeking = false; });

  function updateTransportState() {
    $("playButton").textContent = player.playing && !isCreationPreview ? "▶ 再生中" : "▶ 再生";
    $("previewButton").textContent = player.playing && isCreationPreview ? "▶ 試聴中" : "▶ 試聴";
    $("previewStopButton").disabled = !(player.playing && isCreationPreview);
    if (!player.playing) {
      const wasPreview = isCreationPreview;
      isCreationPreview = false; clearPlayhead();
      if (wasPreview) $("creatorFeedback").textContent = "試聴を停止しました。";
    }
  }

  function positionInfo(song, seconds) {
    if (!song) return { tick: 0, bpm: 0, bar: 0, beat: 0, beatInBar: 0, denominator: 4 };
    let tempo = song.tempoMap[0];
    for (let i = 1; i < song.tempoMap.length && song.tempoMap[i].time <= seconds; i++) tempo = song.tempoMap[i];
    const tick = tempo.tick + (seconds - tempo.time) * tempo.bpm * song.ppq / 60;
    let sig = song.timeSignatureMap[0];
    for (let i = 1; i < song.timeSignatureMap.length && song.timeSignatureMap[i].tick <= tick; i++) sig = song.timeSignatureMap[i];
    const ticksPerBeat = song.ppq * 4 / sig.denominator;
    const localBeats = Math.max(0, (tick - sig.tick) / ticksPerBeat);
    let barsBefore = 0;
    for (let i = 0; i < song.timeSignatureMap.length; i++) {
      const here = song.timeSignatureMap[i], next = song.timeSignatureMap[i + 1];
      if (here.tick >= sig.tick) break;
      const end = Math.min(sig.tick, next ? next.tick : sig.tick);
      barsBefore += Math.floor((end - here.tick) / (song.ppq * 4 / here.denominator) / here.numerator);
    }
    return { tick, bpm: tempo.bpm, bar: barsBefore + Math.floor(localBeats / sig.numerator) + 1, beat: Math.floor(tick / ticksPerBeat) + 1, beatInBar: Math.floor(localBeats % sig.numerator) + 1, denominator: sig.numerator };
  }

  function nextNoteDelay(song, seconds) {
    if (!song) return null;
    let next = Infinity;
    song.tracks.forEach((track) => { if (track.enabled) track.notes.forEach((note) => { if (note.startTime > seconds + 0.0005) next = Math.min(next, note.startTime); }); });
    return Number.isFinite(next) ? next - seconds : null;
  }

  function updateMonitor(seconds) {
    const info = positionInfo(currentSong, seconds), next = nextNoteDelay(currentSong, seconds);
    $("monTime").textContent = fixed(seconds); $("monBpm").textContent = currentSong ? formatBpm(info.bpm) : "—";
    $("monBar").textContent = currentSong ? info.bar : "—"; $("monBeat").textContent = currentSong ? `${info.beatInBar} / ${info.denominator}` : "—";
    $("monNext").textContent = next === null ? "—" : `${fixed(next)} sec後`;
    if (debugVisible) updateDebug(info, next);
  }

  function updateDebug(info, next) {
    const ctx = synth.context;
    $("dbgState").textContent = ctx ? ctx.state : "not-created";
    $("dbgAudioTime").textContent = ctx ? fixed(ctx.currentTime, 6) : "0.000000";
    $("dbgTick").textContent = Math.round(info.tick); $("dbgPpq").textContent = currentSong?.ppq ?? "—";
    $("dbgBpm").textContent = currentSong ? formatBpm(info.bpm) : "—"; $("dbgBeat").textContent = currentSong ? info.beat : "—"; $("dbgBar").textContent = currentSong ? info.bar : "—";
    $("dbgNotes").textContent = synth.activeNoteNames().join(", ") || "—";
    $("dbgNext").textContent = next === null || !ctx ? "—" : `${fixed(ctx.currentTime + next, 6)} sec`;
    $("dbgDelay").textContent = `${fixed(player.lastSchedulerDelay)} ms`;
  }

  function animationFrame() {
    const seconds = player.currentTime();
    if (!isSeeking) { $("currentTime").textContent = formatTime(seconds); $("seekBar").value = seconds; }
    updateMonitor(seconds); updateCreationPlayhead(seconds); requestAnimationFrame(animationFrame);
  }

  $("debugToggle").addEventListener("change", (event) => { debugVisible = event.target.checked; $("debugConsole").classList.toggle("is-hidden", !debugVisible); });

  function creationSettings() {
    const [numerator, denominator] = $("createSignature").value.split("/").map(Number);
    return { bpm: Number($("createBpm").value) || 120, numerator, denominator, noteUnit: Number($("noteUnit").value), velocity: Number($("createVelocity").value) || 100, steps: grid[0].length };
  }

  function creationTiming() {
    const settings = creationSettings();
    const beatsPerStep = MidiCore.stepUnitToBeats(settings.noteUnit);
    const beatsPerBar = settings.numerator * 4 / settings.denominator;
    const stepsPerBeat = settings.noteUnit / settings.denominator;
    const stepsPerBar = settings.numerator * stepsPerBeat;
    const bars = settings.steps * beatsPerStep / beatsPerBar;
    const stepSeconds = beatsPerStep * 60 / settings.bpm;
    return { ...settings, beatsPerStep, beatsPerBar, stepsPerBeat, stepsPerBar, bars, stepSeconds, duration: settings.steps * stepSeconds };
  }

  function boundaryClass(step, timing) {
    if (step <= 0) return "";
    if (Number.isInteger(timing.stepsPerBar) && step % timing.stepsPerBar === 0) return " is-bar-start";
    if (Number.isInteger(timing.stepsPerBeat) && step % timing.stepsPerBeat === 0) return " is-beat-start";
    return "";
  }

  function renderSequencer() {
    const steps = grid[0].length, timing = creationTiming();
    $("stepCount").value = String(steps);
    const seq = $("sequencer"); seq.style.gridTemplateColumns = `54px repeat(${steps}, var(--step-width, 50px))`; seq.style.gridTemplateRows = `34px repeat(${pitches.length}, 44px)`; seq.replaceChildren();
    const corner = document.createElement("span"); corner.className = "pitch-corner"; seq.append(corner);
    for (let step = 0; step < steps; step++) {
      const header = document.createElement("div"); header.className = `step-header${boundaryClass(step, timing)}`; header.dataset.step = step;
      const number = document.createElement("span"); number.textContent = step + 1;
      const clear = document.createElement("button"); clear.type = "button"; clear.className = "step-clear"; clear.textContent = "×"; clear.setAttribute("aria-label", `ステップ${step + 1}を消去`);
      clear.addEventListener("click", () => clearStep(step)); header.append(number, clear); seq.append(header);
    }
    pitches.forEach((pitch, row) => {
      const label = document.createElement("div"); label.className = "pitch-label"; label.dataset.row = row;
      const audition = document.createElement("button"); audition.type = "button"; audition.className = "pitch-audition"; audition.textContent = MidiCore.noteName(pitch); audition.setAttribute("aria-label", `${MidiCore.noteName(pitch)}を試聴`);
      audition.addEventListener("click", () => auditionPitch(pitch));
      const clearRow = document.createElement("button"); clearRow.type = "button"; clearRow.className = "row-clear"; clearRow.textContent = "×"; clearRow.setAttribute("aria-label", `${MidiCore.noteName(pitch)}の行を消去`);
      clearRow.addEventListener("click", () => clearPitchRow(row)); label.append(audition, clearRow); seq.append(label);
      for (let step = 0; step < steps; step++) {
        const cell = document.createElement("button"); cell.type = "button"; cell.className = `step-cell${boundaryClass(step, timing)}${grid[row][step] ? " is-on" : ""}`; cell.dataset.step = step; cell.dataset.row = row;
        cell.setAttribute("role", "gridcell"); cell.setAttribute("aria-label", `${MidiCore.noteName(pitch)} ステップ${step + 1}`); cell.setAttribute("aria-pressed", grid[row][step]);
        cell.addEventListener("click", () => { grid[row][step] = !grid[row][step]; cell.classList.toggle("is-on", grid[row][step]); cell.setAttribute("aria-pressed", grid[row][step]); updateCreationInfo(); });
        seq.append(cell);
      }
    });
    updateCreationInfo();
  }

  function resizeGrid(steps) {
    grid = pitches.map((_, row) => Array.from({ length: steps }, (_, index) => Boolean(grid[row]?.[index])));
    renderSequencer();
  }

  function clearStep(step) {
    grid.forEach((row) => { row[step] = false; }); renderSequencer();
    $("creatorFeedback").textContent = `ステップ${step + 1}を消去しました。`;
  }

  function clearPitchRow(row) {
    grid[row].fill(false); renderSequencer();
    $("creatorFeedback").textContent = `${MidiCore.noteName(pitches[row])}の行を消去しました。`;
  }

  async function auditionPitch(noteNumber) {
    try {
      const ctx = await synth.ensureContext();
      synth.schedule({ noteNumber, velocity: creationSettings().velocity }, ctx.currentTime + 0.005, 0.38);
      $("creatorFeedback").textContent = `${MidiCore.noteName(noteNumber)}を試聴中`;
    } catch (error) { $("creatorFeedback").textContent = error.message; }
  }

  function updateCreationInfo() {
    const timing = creationTiming();
    const barsText = Number.isInteger(timing.bars) ? String(timing.bars) : timing.bars.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    $("infoBpm").textContent = formatBpm(timing.bpm); $("infoSignature").textContent = `${timing.numerator} / ${timing.denominator}`;
    $("infoSteps").textContent = timing.steps; $("infoResolution").textContent = `1 / ${timing.noteUnit}`; $("infoBars").textContent = barsText; $("infoNotes").textContent = noteCount();
    $("clearAllButton").disabled = noteCount() === 0;
    if (!isCreationPreview) $("creatorFeedback").textContent = `${timing.steps}ステップ・1/${timing.noteUnit}・${barsText}小節・${fixed(timing.duration)}秒`;
  }

  function updateCreationPlayhead(seconds) {
    if (!isCreationPreview || !player.playing) { clearPlayhead(); return; }
    const timing = creationTiming();
    const step = Math.min(timing.steps - 1, Math.floor(seconds / timing.stepSeconds));
    if (step === activePlayheadStep) return;
    clearPlayhead(); activePlayheadStep = step;
    document.querySelectorAll(`[data-step="${step}"]`).forEach((element) => element.classList.add("is-playhead"));
    $("creatorFeedback").textContent = `再生中：ステップ ${step + 1} / ${timing.steps}${player.loop ? "（ループ）" : ""}`;
  }

  function clearPlayhead() {
    if (activePlayheadStep < 0) return;
    document.querySelectorAll(".is-playhead").forEach((element) => element.classList.remove("is-playhead")); activePlayheadStep = -1;
  }

  function creationSong(title = "midi-lab-test-001") {
    const settings = creationSettings();
    return MidiCore.createStepSong({ title, ...settings, pitches, grid });
  }

  function stopCreationPreview(message) {
    if (isCreationPreview || player.playing) player.stop();
    isCreationPreview = false; clearPlayhead();
    if (message) $("creatorFeedback").textContent = message;
  }

  function openConfirm(message, action, cancelAction) {
    confirmAction = action; confirmCancelAction = cancelAction || null; $("confirmMessage").textContent = message;
    if (typeof $("confirmDialog").showModal === "function") $("confirmDialog").showModal();
    else if (window.confirm(message)) { const callback = confirmAction; confirmAction = null; callback?.(); }
  }

  function closeConfirm(confirmed) {
    const action = confirmed ? confirmAction : confirmCancelAction; confirmAction = null; confirmCancelAction = null;
    if ($("confirmDialog").open) $("confirmDialog").close(); action?.();
  }

  $("confirmCancelButton").addEventListener("click", () => closeConfirm(false));
  $("confirmDeleteButton").addEventListener("click", () => closeConfirm(true));
  $("confirmDialog").addEventListener("cancel", (event) => { event.preventDefault(); closeConfirm(false); });

  $("stepCount").addEventListener("change", (event) => {
    const previous = grid[0].length, next = Number(event.target.value);
    stopCreationPreview();
    const hasTrimmedNotes = next < previous && grid.some((row) => row.slice(next).some(Boolean));
    if (hasTrimmedNotes) {
      openConfirm(`${next + 1}～${previous}ステップにノートがあります。\n${next}ステップへ変更すると削除されます。`, () => resizeGrid(next), () => { $("stepCount").value = previous; });
    } else resizeGrid(next);
  });
  $("createBpm").addEventListener("input", () => { stopCreationPreview(); updateCreationInfo(); });
  $("createVelocity").addEventListener("input", updateCreationInfo);
  $("createSignature").addEventListener("change", () => { stopCreationPreview(); renderSequencer(); });
  $("noteUnit").addEventListener("change", () => { stopCreationPreview(); renderSequencer(); });
  $("loopToggle").addEventListener("change", () => { if (isCreationPreview && player.playing) stopCreationPreview("ループ設定を変更しました。もう一度試聴してください。"); });

  $("clearAllButton").addEventListener("click", () => {
    if (!noteCount()) return;
    openConfirm("作成中のノートをすべて削除しますか？", () => { grid.forEach((row) => row.fill(false)); renderSequencer(); $("creatorFeedback").textContent = "すべてのノートを削除しました。"; });
  });

  $("sampleButton").addEventListener("click", () => {
    stopCreationPreview(); $("createBpm").value = 120; $("createSignature").value = "4/4"; $("noteUnit").value = "8"; $("createVelocity").value = 100; $("stepCount").value = "8";
    grid = createEmptyGrid(8); [7, 6, 5, 4, 3, 2, 1, 0].forEach((row, step) => { grid[row][step] = true; });
    renderSequencer(); const song = creationSong("C-major-scale"); song.fileName = "C-major-scale.mid（内部生成）";
    loadSong(song, "120 BPMのCメジャースケールを生成しました。再生・解析・保存を試せます。");
  });
  $("previewButton").addEventListener("click", async () => {
    try {
      player.stop(); const song = creationSong(); currentSong = song; player.setSong(song); player.setLoop($("loopToggle").checked); isCreationPreview = true; renderSong(); await player.play();
    } catch (error) { isCreationPreview = false; clearPlayhead(); $("creatorFeedback").textContent = error.message; }
  });
  $("previewStopButton").addEventListener("click", () => stopCreationPreview("試聴を停止しました。"));
  $("loadCreationButton").addEventListener("click", () => { stopCreationPreview(); loadSong(creationSong(), "ステップ入力を再生・解析に送りました。"); selectTab("play"); });
  $("saveButton").addEventListener("click", () => {
    const song = creationSong();
    if (!song.totalNotes) { $("creatorFeedback").textContent = "保存するノートがありません。"; return; }
    const blob = new Blob([MidiCore.write(song)], { type: "audio/midi" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "midi-lab-test-001.mid"; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    lastSavedSnapshot = { notes: song.totalNotes, bpm: song.bpm, duration: song.duration };
    $("dbgOriginalNotes").textContent = song.totalNotes; $("dbgLoadedNotes").textContent = "—"; $("dbgCompareBpm").textContent = `${formatBpm(song.bpm)} → —`; $("dbgCompareDuration").textContent = `${fixed(song.duration)} → — sec`;
    $("creatorFeedback").textContent = `保存しました：${song.totalNotes}ノート / ${fixed(song.duration)}秒`;
  });

  function compareLoadedSong(song) {
    if (!lastSavedSnapshot) return;
    $("dbgOriginalNotes").textContent = lastSavedSnapshot.notes; $("dbgLoadedNotes").textContent = song.totalNotes;
    $("dbgCompareBpm").textContent = `${formatBpm(lastSavedSnapshot.bpm)} → ${formatBpm(song.bpm)}`;
    $("dbgCompareDuration").textContent = `${fixed(lastSavedSnapshot.duration)} → ${fixed(song.duration)} sec`;
  }

  renderSequencer(); updateTransportState(); animationFrame();
})();
