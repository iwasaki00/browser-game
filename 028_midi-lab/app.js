(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const synth = new MidiAudio.MidiSynth();
  const player = new MidiAudio.AudioClockPlayer(synth, updateTransportState);
  const DEFAULT_PITCHES = [72, 71, 69, 67, 65, 64, 62, 60];
  let pitches = [...DEFAULT_PITCHES], grid = createEmptyGrid(16), currentSong = null, loadedMidiSong = null, editSession = null;
  let isSeeking = false, debugVisible = false, isCreationPreview = false, activePlayheadStep = -1;
  let confirmAction = null, confirmCancelAction = null, lastSavedSnapshot = null;

  function createEmptyGrid(steps) { return pitches.map(() => Array(steps).fill(false)); }
  function cellNoteCount(cell) { return cell?.notes ? cell.notes.length : (cell ? 1 : 0); }
  function noteCount() { return grid.reduce((total, row) => total + row.reduce((sum, cell) => sum + cellNoteCount(cell), 0), 0); }
  function formatTime(seconds) { const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000)); return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`; }
  function fixed(value, digits = 3) { return Number(value).toFixed(digits); }
  function formatBpm(bpm) { return Math.abs(bpm - Math.round(bpm)) < 0.005 ? String(Math.round(bpm)) : bpm.toFixed(2); }
  function setMessage(text, isError = false) { $("message").textContent = text; $("message").classList.toggle("error", isError); }

  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("is-active", el.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.toggle("is-active", el.id === `tab-${name}`));
    if (name === "create") { updateImportPreview(); updateCreationInfo(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("fileInput").addEventListener("change", (event) => { const file = event.target.files[0]; if (file) readFile(file); event.target.value = ""; });
  ["dragenter", "dragover"].forEach((type) => $("dropZone").addEventListener(type, (event) => { event.preventDefault(); $("dropZone").classList.add("is-dragging"); }));
  ["dragleave", "drop"].forEach((type) => $("dropZone").addEventListener(type, (event) => { event.preventDefault(); $("dropZone").classList.remove("is-dragging"); }));
  $("dropZone").addEventListener("drop", (event) => { const file = event.dataTransfer.files[0]; if (file) readFile(file); });
  async function readFile(file) {
    if (!/\.(mid|midi)$/i.test(file.name)) { setMessage(".mid または .midi ファイルを選択してください。", true); return; }
    try {
      setMessage("MIDIを解析しています…"); const song = MidiCore.parse(await file.arrayBuffer(), file.name);
      loadedMidiSong = song; populateEditTracks(); loadSong(song, `${file.name} を読み込みました。MIDI作成タブから編集できます。`); compareLoadedSong(song);
    } catch (error) { console.error(error); setMessage(`読み込みエラー: ${error.message}`, true); }
  }
  function loadSong(song, message) {
    isCreationPreview = false; clearPlayhead(); currentSong = song; player.setSong(song); renderSong();
    $("statusDot").classList.add("ready"); $("headerStatus").textContent = `${song.totalNotes} notes ready`; setMessage(message || "MIDIデータを準備しました。");
  }
  function renderSong() {
    if (!currentSong) return;
    $("sumFile").textContent = currentSong.fileName; $("sumFormat").textContent = `Type ${currentSong.format}`; $("sumTracks").textContent = currentSong.tracks.length;
    $("sumBpm").textContent = formatBpm(currentSong.bpm); $("sumTimeSig").textContent = `${currentSong.timeSignature.numerator} / ${currentSong.timeSignature.denominator}`;
    $("sumLength").textContent = formatTime(currentSong.duration); $("sumNotes").textContent = currentSong.totalNotes.toLocaleString("ja-JP");
    $("totalTime").textContent = formatTime(currentSong.duration); $("seekBar").max = Math.max(0.001, currentSong.duration);
    renderTrackToggles(); renderTrackTable(); renderNoteTable(); renderTimingMaps(); updateMonitor(0);
  }
  function channelText(track) { return track.channels.length ? track.channels.map((c) => c + 1).join(", ") : "—"; }
  function programText(track) { return track.programs.length ? track.programs.join(", ") : "—"; }
  function renderTrackToggles() {
    $("trackToggles").classList.remove("empty-state"); $("trackToggles").replaceChildren();
    currentSong.tracks.forEach((track, index) => {
      const label = document.createElement("label"); label.className = "track-toggle";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = track.enabled;
      checkbox.addEventListener("change", () => { track.enabled = checkbox.checked; updateTrackBulkButtons(); });
      const text = document.createElement("span"), strong = document.createElement("strong"), small = document.createElement("small");
      strong.textContent = `Track ${index + 1} · ${track.name}`; small.textContent = `${track.instrumentName} / ${track.notes.length} notes`;
      text.append(strong, small); label.append(checkbox, text); $("trackToggles").append(label);
    }); updateTrackBulkButtons();
  }
  function setAllTracks(enabled) { if (!currentSong) return; currentSong.tracks.forEach((track) => { track.enabled = enabled; }); $("trackToggles").querySelectorAll('input[type="checkbox"]').forEach((box) => { box.checked = enabled; }); updateTrackBulkButtons(); }
  function updateTrackBulkButtons() { const hasTracks = Boolean(currentSong?.tracks.length); $("tracksOnButton").disabled = !hasTracks || currentSong.tracks.every((track) => track.enabled); $("tracksOffButton").disabled = !hasTracks || currentSong.tracks.every((track) => !track.enabled); }
  function renderTrackTable() {
    $("trackTable").replaceChildren(); currentSong.tracks.forEach((track, i) => { const tr = document.createElement("tr"); [i + 1, track.name, channelText(track), programText(track), track.instrumentName, track.notes.length].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); $("trackTable").append(tr); });
  }
  function renderNoteTable() {
    const notes = currentSong.tracks.flatMap((track, ti) => track.notes.map((note) => ({ track: ti + 1, ...note }))).sort((a, b) => a.startTime - b.startTime), shown = notes.slice(0, 200); $("noteTable").replaceChildren();
    shown.forEach((note) => { const tr = document.createElement("tr"); [note.track, note.channel + 1, note.noteNumber, note.noteName, fixed(note.startTime), fixed(note.startTime + note.duration), fixed(note.duration), note.velocity].forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); $("noteTable").append(tr); });
    if (!shown.length) { const tr = document.createElement("tr"), td = document.createElement("td"); td.colSpan = 8; td.className = "empty-cell"; td.textContent = "ノートイベントがありません。"; tr.append(td); $("noteTable").append(tr); }
    $("noteLimitLabel").textContent = notes.length > 200 ? `先頭200件を表示（全${notes.length.toLocaleString("ja-JP")}件）` : `${notes.length}件を表示`;
  }
  function renderTimingMaps() {
    const renderRows = (id, rows) => { const body = $(id); body.replaceChildren(); rows.forEach((values) => { const tr = document.createElement("tr"); values.forEach((value) => { const td = document.createElement("td"); td.textContent = value; tr.append(td); }); body.append(tr); }); };
    renderRows("tempoMapTable", currentSong.tempoMap.map((tempo) => [tempo.tick, MidiTiming.tickToBarBeat(currentSong, tempo.tick).bar, formatBpm(tempo.bpm)]));
    renderRows("signatureMapTable", currentSong.timeSignatureMap.map((signature) => [signature.tick, MidiTiming.tickToBarBeat(currentSong, signature.tick).bar, `${signature.numerator} / ${signature.denominator}`]));
  }

  $("playButton").addEventListener("click", async () => { try { isCreationPreview = false; player.setLoop(false); await player.play(); } catch (error) { setMessage(error.message, true); selectTab(currentSong ? "play" : "load"); } });
  $("pauseButton").addEventListener("click", () => player.pause()); $("stopButton").addEventListener("click", () => player.stop()); $("rewindButton").addEventListener("click", () => player.rewind());
  $("tracksOnButton").addEventListener("click", () => setAllTracks(true)); $("tracksOffButton").addEventListener("click", () => setAllTracks(false));
  document.querySelectorAll(".scroll-button").forEach((button) => button.addEventListener("click", () => { const container = $(button.dataset.scrollTarget); container.scrollBy({ left: Number(button.dataset.scrollDirection) * Math.max(180, container.clientWidth * 0.55), behavior: "smooth" }); }));
  $("trackTableWrap").addEventListener("wheel", (event) => { const container = event.currentTarget; if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || container.scrollWidth <= container.clientWidth) return; event.preventDefault(); container.scrollLeft += event.deltaY; }, { passive: false });
  $("volume").addEventListener("input", (event) => { synth.setVolume(event.target.value); $("volumeValue").textContent = `${Math.round(event.target.value * 100)}%`; });
  $("seekBar").addEventListener("pointerdown", () => { isSeeking = true; }); $("seekBar").addEventListener("input", (event) => { isSeeking = true; $("currentTime").textContent = formatTime(event.target.value); updateMonitor(Number(event.target.value)); }); $("seekBar").addEventListener("change", (event) => { player.seek(event.target.value); isSeeking = false; });
  function updateTransportState() {
    $("playButton").textContent = player.playing && !isCreationPreview ? "▶ 再生中" : "▶ 再生"; $("previewButton").textContent = player.playing && isCreationPreview ? "▶ 試聴中" : "▶ 試聴"; $("previewStopButton").disabled = !(player.playing && isCreationPreview);
    if (!player.playing) { const wasPreview = isCreationPreview; isCreationPreview = false; clearPlayhead(); if (wasPreview) $("creatorFeedback").textContent = "試聴を停止しました。"; }
  }
  function positionInfo(song, seconds) {
    if (!song) return { tick: 0, bpm: 0, bar: 0, beat: 0, beatInBar: 0, numerator: 4, denominator: 4 };
    const tick = MidiTiming.secondsToTick(song, seconds), tempo = MidiTiming.tempoAtTick(song, tick), position = MidiTiming.tickToBarBeat(song, tick);
    const barOffset = Number(song.sectionStartBar) ? song.sectionStartBar - 1 : 0;
    return { tick, bpm: tempo.bpm, bar: position.bar + barOffset, beat: position.beat, beatInBar: position.beat, beatFraction: position.beatFraction, numerator: position.numerator, denominator: position.denominator };
  }
  function nextNoteDelay(song, seconds) { if (!song) return null; let next = Infinity; song.tracks.forEach((track) => { if (track.enabled) track.notes.forEach((note) => { if (note.startTime > seconds + 0.0005) next = Math.min(next, note.startTime); }); }); return Number.isFinite(next) ? next - seconds : null; }
  function updateMonitor(seconds) { const info = positionInfo(currentSong, seconds), next = nextNoteDelay(currentSong, seconds); $("monTime").textContent = fixed(seconds); $("monBpm").textContent = currentSong ? formatBpm(info.bpm) : "—"; $("monSignature").textContent = currentSong ? `${info.numerator} / ${info.denominator}` : "—"; $("monTempoChanges").textContent = currentSong ? `${currentSong.tempoMap.length}箇所` : "—"; $("monBar").textContent = currentSong ? info.bar : "—"; $("monBeat").textContent = currentSong ? `${info.beatInBar} / ${info.numerator}` : "—"; $("monNext").textContent = next === null ? "—" : `${fixed(next)} sec後`; if (debugVisible) updateDebug(info, next); }
  function updateDebug(info, next) { const ctx = synth.context; $("dbgState").textContent = ctx ? ctx.state : "not-created"; $("dbgAudioTime").textContent = ctx ? fixed(ctx.currentTime, 6) : "0.000000"; $("dbgTick").textContent = Math.round(info.tick); $("dbgPpq").textContent = currentSong?.ppq ?? "—"; $("dbgBpm").textContent = currentSong ? formatBpm(info.bpm) : "—"; $("dbgSignature").textContent = currentSong ? `${info.numerator}/${info.denominator}` : "—"; $("dbgBeat").textContent = currentSong ? `${info.beat}${info.beatFraction ? ` + ${fixed(info.beatFraction)}` : ""}` : "—"; $("dbgBar").textContent = currentSong ? info.bar : "—"; $("dbgNotes").textContent = synth.activeNoteNames().join(", ") || "—"; $("dbgNext").textContent = next === null || !ctx ? "—" : `${fixed(ctx.currentTime + next, 6)} sec`; $("dbgDelay").textContent = `${fixed(player.lastSchedulerDelay)} ms`; }
  function animationFrame() { const seconds = player.currentTime(); if (!isSeeking) { $("currentTime").textContent = formatTime(seconds); $("seekBar").value = seconds; } updateMonitor(seconds); updateCreationPlayhead(seconds); requestAnimationFrame(animationFrame); }
  $("debugToggle").addEventListener("change", (event) => { debugVisible = event.target.checked; $("debugConsole").classList.toggle("is-hidden", !debugVisible); });
  function populateEditTracks() {
    const select = $("editTrackSelect"); select.replaceChildren();
    if (!loadedMidiSong) { const option = document.createElement("option"); option.value = ""; option.textContent = "MIDIを読み込んでください"; select.append(option); select.disabled = true; $("expandMidiButton").disabled = true; updateImportPreview(); return; }
    loadedMidiSong.tracks.forEach((track, index) => { if (!track.notes.length) return; const option = document.createElement("option"); option.value = index; option.textContent = `Track ${index + 1} · ${track.name} (${track.notes.length})`; select.append(option); });
    select.disabled = !select.options.length; $("expandMidiButton").disabled = !select.options.length; updateImportPreview();
  }
  function selectedEditTrack() { if (!loadedMidiSong || $("editTrackSelect").value === "") return null; const index = Number($("editTrackSelect").value); return { index, track: loadedMidiSong.tracks[index] }; }
  function updateImportPreview() {
    const selected = selectedEditTrack();
    if (!selected) { ["importNoteCount", "importPitchRange", "importDuration", "importBpm", "importSteps"].forEach((id) => { $(id).textContent = "—"; }); $("importWarning").classList.add("is-hidden"); return; }
    const unit = Number($("editQuantize").value), ticks = MidiEdit.stepTicks(loadedMidiSong.ppq, unit);
    const maxStep = selected.track.notes.reduce((max, note) => Math.max(max, Math.round((note.startTick || 0) / ticks) + 1), 0), range = MidiEdit.choosePitchRange(selected.track.notes);
    $("importNoteCount").textContent = selected.track.notes.length; $("importPitchRange").textContent = `${MidiCore.noteName(range.min)} ～ ${MidiCore.noteName(range.max)}`;
    $("importDuration").textContent = formatTime(loadedMidiSong.duration); $("importBpm").textContent = `${formatBpm(loadedMidiSong.bpm)}（${loadedMidiSong.tempoMap.length}箇所）`; $("importSteps").textContent = maxStep;
    const warnings = MidiEdit.warnings(loadedMidiSong); $("importWarning").textContent = warnings.join(" "); $("importWarning").classList.toggle("is-hidden", !warnings.length);
  }
  function setCreationControlsForMode() {
    const editing = Boolean(editSession); ["createBpm", "createSignature", "noteUnit", "stepCount"].forEach((id) => { $(id).disabled = editing; });
    $("editTrackSelect").disabled = editing || !loadedMidiSong; $("editQuantize").disabled = editing; $("expandMidiButton").disabled = editing || !selectedEditTrack();
    $("sectionNav").classList.toggle("is-hidden", !editing); $("saveButton").classList.toggle("is-hidden", editing); $("saveEditedButton").classList.toggle("is-hidden", !editing);
    $("clearAllButton").textContent = editing ? "表示範囲を全消去" : "全消去";
  }
  function updateModeDisplay() {
    if (!editSession) { $("creatorMode").textContent = "NEW MIDI"; $("creatorTarget").textContent = "新規作成"; $("creatorRange").textContent = `全${grid[0].length}ステップ`; $("editState").textContent = "新規"; $("editState").className = "edit-state"; return; }
    const track = editSession.song.tracks[editSession.trackIndex], endBar = Math.min(editSession.totalBars, editSession.sectionStartBar + editSession.sectionBars);
    $("creatorMode").textContent = "EDIT MIDI"; $("creatorTarget").textContent = `Track ${editSession.trackIndex + 1} · ${track.name}`; $("creatorRange").textContent = `Bars ${editSession.sectionStartBar + 1}-${endBar}`;
    $("editState").textContent = editSession.dirty ? "● 編集あり" : (editSession.saved ? "保存済み" : "展開済み"); $("editState").className = `edit-state${editSession.dirty ? " is-dirty" : editSession.saved ? " is-saved" : ""}`;
  }
  function setStepCountValue(steps) {
    const select = $("stepCount"); select.querySelectorAll("option[data-import]").forEach((option) => option.remove());
    if (![...select.options].some((option) => Number(option.value) === steps)) { const option = document.createElement("option"); option.value = steps; option.textContent = steps; option.dataset.import = "true"; select.append(option); }
    select.value = String(steps);
  }
  function enterNewMode(reset = true) {
    stopCreationPreview(); editSession = null; pitches = [...DEFAULT_PITCHES];
    if (reset) { grid = createEmptyGrid(16); $("createBpm").value = 120; $("createSignature").value = "4/4"; $("noteUnit").value = "8"; setStepCountValue(16); }
    setCreationControlsForMode(); renderSequencer(); updateModeDisplay(); updateEditComparison();
  }
  function expandSelectedTrack() {
    const selected = selectedEditTrack(); if (!selected) return; stopCreationPreview();
    editSession = MidiEdit.createSession(loadedMidiSong, selected.index, Number($("editQuantize").value), 2); pitches = [...editSession.pitches];
    $("createBpm").value = editSession.song.bpm; $("createSignature").value = `${editSession.song.timeSignature.numerator}/${editSession.song.timeSignature.denominator}`;
    if (!$("createSignature").value) $("createSignature").value = "4/4"; $("noteUnit").value = String(editSession.noteUnit); setStepCountValue(editSession.sectionSteps);
    setCreationControlsForMode(); showEditorSection();
    const warnings = MidiEdit.warnings(editSession.song); if (editSession.pitchRange.omitted) warnings.push(`表示音域外の${editSession.pitchRange.omitted}ノートは内部データに保持されています。`);
    $("importWarning").textContent = warnings.join(" "); $("importWarning").classList.toggle("is-hidden", !warnings.length); $("creatorFeedback").textContent = `${selected.track.name}を1/${editSession.noteUnit}へクオンタイズして展開しました。`;
  }
  function showEditorSection() {
    if (!editSession) return;
    const bounds = MidiEdit.updateSectionMetrics(editSession), tempo = MidiTiming.tempoAtTick(editSession.song, bounds.startTick), signature = MidiTiming.signatureAtTick(editSession.song, bounds.startTick);
    grid = MidiEdit.gridForSection(editSession); setStepCountValue(editSession.sectionSteps); $("createBpm").value = Math.round(tempo.bpm * 100) / 100;
    const signatureValue = `${signature.numerator}/${signature.denominator}`; if (![...$("createSignature").options].some((option) => option.value === signatureValue)) { const option = document.createElement("option"); option.value = signatureValue; option.textContent = `${signature.numerator} / ${signature.denominator}`; option.dataset.import = "true"; $("createSignature").append(option); } $("createSignature").value = signatureValue;
    const start = bounds.startBar, end = Math.min(editSession.totalBars, bounds.endBar - 1);
    $("sectionRange").textContent = `小節 ${start}～${end} / ${editSession.totalBars}（Tick ${bounds.startTick}–${bounds.endTick}）`; $("previousSectionButton").disabled = editSession.sectionStartBar === 0; $("nextSectionButton").disabled = editSession.sectionStartBar + editSession.sectionBars >= editSession.totalBars;
    renderSequencer(); updateModeDisplay(); updateEditComparison();
  }
  function moveEditorSection(direction) { if (!editSession) return; stopCreationPreview(); const maxStart = Math.max(0, Math.floor((editSession.totalBars - 1) / editSession.sectionBars) * editSession.sectionBars); editSession.sectionStartBar = Math.max(0, Math.min(maxStart, editSession.sectionStartBar + direction * editSession.sectionBars)); showEditorSection(); }
  function updateEditComparison() {
    if (!editSession) { $("dbgEditOriginal").textContent = "—"; $("dbgEditCurrent").textContent = "—"; $("dbgEditDelta").textContent = "—"; return; }
    const value = MidiEdit.comparison(editSession); $("dbgEditOriginal").textContent = value.original; $("dbgEditCurrent").textContent = value.edited; $("dbgEditDelta").textContent = `+${value.added} / -${value.deleted}`;
  }
  function markEdited(message) { if (!editSession) return; grid = MidiEdit.gridForSection(editSession); updateModeDisplay(); updateEditComparison(); updateCreationInfo(); if (message) $("creatorFeedback").textContent = message; }

  function creationSettings() { const [numerator, denominator] = $("createSignature").value.split("/").map(Number); return { bpm: Number($("createBpm").value) || 120, numerator, denominator, noteUnit: Number($("noteUnit").value), velocity: Number($("createVelocity").value) || 100, steps: grid[0].length }; }
  function creationTiming() {
    const settings = creationSettings(), beatsPerStep = MidiCore.stepUnitToBeats(settings.noteUnit);
    if (editSession) { const bounds = MidiEdit.sectionBounds(editSession), tempo = MidiTiming.tempoAtTick(editSession.song, bounds.startTick), signature = MidiTiming.signatureAtTick(editSession.song, bounds.startTick); return { ...settings, bpm: tempo.bpm, numerator: signature.numerator, denominator: signature.denominator, steps: bounds.stepTicks.length, beatsPerStep, bars: editSession.sectionBars, duration: bounds.endSeconds - bounds.startSeconds, bounds }; }
    const beatsPerBar = settings.numerator * 4 / settings.denominator, stepsPerBeat = settings.noteUnit / settings.denominator, stepsPerBar = settings.numerator * stepsPerBeat, bars = settings.steps * beatsPerStep / beatsPerBar, stepSeconds = beatsPerStep * 60 / settings.bpm;
    return { ...settings, beatsPerStep, beatsPerBar, stepsPerBeat, stepsPerBar, bars, stepSeconds, duration: settings.steps * stepSeconds };
  }
  function boundaryClass(step, timing) { if (step <= 0) return ""; if (editSession) { const tick = timing.bounds.stepTicks[step], position = MidiTiming.tickToBarBeat(editSession.song, tick); if (position.beat === 1 && Math.abs(position.beatFraction) < 0.000001) return " is-bar-start"; if (Math.abs(position.beatFraction) < 0.000001) return " is-beat-start"; return ""; } if (Number.isInteger(timing.stepsPerBar) && step % timing.stepsPerBar === 0) return " is-bar-start"; if (Number.isInteger(timing.stepsPerBeat) && step % timing.stepsPerBeat === 0) return " is-beat-start"; return ""; }
  function renderSequencer() {
    const steps = grid[0].length, timing = creationTiming(); setStepCountValue(steps);
    const seq = $("sequencer"); seq.style.gridTemplateColumns = `54px repeat(${steps}, var(--step-width, 50px))`; seq.style.gridTemplateRows = `34px repeat(${pitches.length}, 44px)`; seq.replaceChildren();
    const corner = document.createElement("span"); corner.className = "pitch-corner"; seq.append(corner);
    for (let step = 0; step < steps; step++) {
      const absoluteTick = editSession ? timing.bounds.stepTicks[step] : step * MidiEdit.stepTicks(480, timing.noteUnit), displayStep = Math.round(absoluteTick / (editSession ? editSession.ticksPerStep : MidiEdit.stepTicks(480, timing.noteUnit))) + 1;
      const header = document.createElement("div"); header.className = `step-header${boundaryClass(step, timing)}`; header.dataset.step = step; header.dataset.tick = absoluteTick;
      const number = document.createElement("span"); number.textContent = displayStep; const clear = document.createElement("button"); clear.type = "button"; clear.className = "step-clear"; clear.textContent = "×"; clear.setAttribute("aria-label", `ステップ${displayStep}を消去`); clear.addEventListener("click", () => clearStep(step)); header.append(number, clear); seq.append(header);
    }
    pitches.forEach((pitch, row) => {
      const label = document.createElement("div"); label.className = "pitch-label"; label.dataset.row = row;
      const audition = document.createElement("button"); audition.type = "button"; audition.className = "pitch-audition"; audition.textContent = MidiCore.noteName(pitch); audition.setAttribute("aria-label", `${MidiCore.noteName(pitch)}を試聴`); audition.addEventListener("click", () => auditionPitch(pitch));
      const clearRow = document.createElement("button"); clearRow.type = "button"; clearRow.className = "row-clear"; clearRow.textContent = "×"; clearRow.setAttribute("aria-label", `${MidiCore.noteName(pitch)}の行を消去`); clearRow.addEventListener("click", () => clearPitchRow(row)); label.append(audition, clearRow); seq.append(label);
      for (let step = 0; step < steps; step++) { const on = Boolean(grid[row][step]), cell = document.createElement("button"), absoluteTick = editSession ? timing.bounds.stepTicks[step] : step * MidiEdit.stepTicks(480, timing.noteUnit); cell.type = "button"; cell.className = `step-cell${boundaryClass(step, timing)}${on ? " is-on" : ""}`; cell.dataset.step = step; cell.dataset.tick = absoluteTick; cell.dataset.row = row; cell.setAttribute("role", "gridcell"); cell.setAttribute("aria-label", `${MidiCore.noteName(pitch)} Tick ${absoluteTick}`); cell.setAttribute("aria-pressed", on); cell.addEventListener("click", () => toggleGridCell(row, step, cell)); seq.append(cell); }
    });
    updateCreationInfo(); if (isCreationPreview && player.playing && activePlayheadStep >= 0) document.querySelectorAll(`[data-step="${activePlayheadStep}"]`).forEach((element) => element.classList.add("is-playhead"));
  }
  function toggleGridCell(row, step, cell) {
    let on;
    if (editSession) { const tick = MidiEdit.cellTick(editSession, step); on = MidiEdit.toggleCell(editSession, pitches[row], step, creationSettings().velocity); grid = MidiEdit.gridForSection(editSession); markEdited(`${MidiCore.noteName(pitches[row])} / Tick ${tick}を${on ? "追加" : "削除"}しました。`); }
    else { grid[row][step] = !grid[row][step]; on = grid[row][step]; updateCreationInfo(); }
    cell.classList.toggle("is-on", Boolean(on)); cell.setAttribute("aria-pressed", Boolean(on));
  }
  function resizeGrid(steps) { grid = pitches.map((_, row) => Array.from({ length: steps }, (_, index) => Boolean(grid[row]?.[index]))); renderSequencer(); updateModeDisplay(); }
  function clearStep(step) {
    let message;
    if (editSession) { const tick = MidiEdit.cellTick(editSession, step), removed = MidiEdit.clearStep(editSession, step); grid = MidiEdit.gridForSection(editSession); message = `Tick ${tick}から${removed}ノート削除しました。`; }
    else { grid.forEach((row) => { row[step] = false; }); message = `ステップ${step + 1}を消去しました。`; }
    renderSequencer(); if (editSession) markEdited(message); else $("creatorFeedback").textContent = message;
  }
  function clearPitchRow(row) {
    let message;
    if (editSession) { const removed = MidiEdit.clearPitch(editSession, pitches[row]); grid = MidiEdit.gridForSection(editSession); message = `${MidiCore.noteName(pitches[row])}を表示範囲から${removed}ノート削除しました。`; }
    else { grid[row].fill(false); message = `${MidiCore.noteName(pitches[row])}の行を消去しました。`; }
    renderSequencer(); if (editSession) markEdited(message); else $("creatorFeedback").textContent = message;
  }
  async function auditionPitch(noteNumber) { try { const ctx = await synth.ensureContext(); synth.schedule({ noteNumber, velocity: creationSettings().velocity }, ctx.currentTime + 0.005, 0.38); $("creatorFeedback").textContent = `${MidiCore.noteName(noteNumber)}を試聴中`; } catch (error) { $("creatorFeedback").textContent = error.message; } }
  function updateCreationInfo() {
    const timing = creationTiming(), barsText = Number.isInteger(timing.bars) ? String(timing.bars) : timing.bars.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    $("infoBpm").textContent = editSession ? `${formatBpm(timing.bpm)}（区間開始）` : formatBpm(timing.bpm); $("infoSignature").textContent = `${timing.numerator} / ${timing.denominator}`; $("infoSteps").textContent = timing.steps; $("infoResolution").textContent = `1 / ${timing.noteUnit}`; $("infoBars").textContent = barsText;
    $("infoNotes").textContent = editSession ? editSession.song.tracks[editSession.trackIndex].notes.length : noteCount(); $("clearAllButton").disabled = noteCount() === 0;
    if (!isCreationPreview) $("creatorFeedback").textContent = editSession ? `小節 ${editSession.sectionStartBar + 1}～${Math.min(editSession.totalBars, editSession.sectionStartBar + editSession.sectionBars)}・${timing.steps}ステップ・${fixed(timing.duration)}秒` : `${timing.steps}ステップ・1/${timing.noteUnit}・${barsText}小節・${fixed(timing.duration)}秒`;
    updateModeDisplay();
  }
  function updateCreationPlayhead(seconds) {
    if (!isCreationPreview || !player.playing) { clearPlayhead(); return; }
    const timing = creationTiming(); let step;
    if (editSession) { const localTick = MidiTiming.secondsToTick(player.song, seconds); step = Math.max(0, Math.min(timing.steps - 1, Math.floor(localTick / editSession.ticksPerStep + 0.000001))); }
    else step = Math.min(timing.steps - 1, Math.floor(seconds / timing.stepSeconds));
    if (step === activePlayheadStep) return; clearPlayhead(); activePlayheadStep = step; document.querySelectorAll(`[data-step="${step}"]`).forEach((element) => element.classList.add("is-playhead")); $("creatorFeedback").textContent = `再生中：ステップ ${step + 1} / ${timing.steps}${player.loop ? "（ループ）" : ""}`;
  }
  function clearPlayhead() { if (activePlayheadStep < 0) return; document.querySelectorAll(".is-playhead").forEach((element) => element.classList.remove("is-playhead")); activePlayheadStep = -1; }
  function creationSong(title = "midi-lab-test-001") { if (editSession) return MidiEdit.sectionSong(editSession); return MidiCore.createStepSong({ title, ...creationSettings(), pitches, grid }); }
  function liveCreationSnapshot() { const song = creationSong(); return { duration: song.duration, events: song.tracks.flatMap((track) => track.notes.map((note) => ({ track, note }))) }; }
  function stopCreationPreview(message) { if (isCreationPreview || player.playing) player.stop(); isCreationPreview = false; clearPlayhead(); if (message) $("creatorFeedback").textContent = message; }
  function openConfirm(message, action, cancelAction) { confirmAction = action; confirmCancelAction = cancelAction || null; $("confirmMessage").textContent = message; if (typeof $("confirmDialog").showModal === "function") $("confirmDialog").showModal(); else if (window.confirm(message)) { const callback = confirmAction; confirmAction = null; callback?.(); } }
  function closeConfirm(confirmed) { const action = confirmed ? confirmAction : confirmCancelAction; confirmAction = null; confirmCancelAction = null; if ($("confirmDialog").open) $("confirmDialog").close(); action?.(); }

  $("confirmCancelButton").addEventListener("click", () => closeConfirm(false)); $("confirmDeleteButton").addEventListener("click", () => closeConfirm(true)); $("confirmDialog").addEventListener("cancel", (event) => { event.preventDefault(); closeConfirm(false); });
  $("editTrackSelect").addEventListener("change", updateImportPreview); $("editQuantize").addEventListener("change", updateImportPreview);
  $("expandMidiButton").addEventListener("click", () => { if (editSession?.dirty) openConfirm("現在の編集内容を破棄して、選択トラックを展開し直しますか？", expandSelectedTrack); else expandSelectedTrack(); });
  $("newModeButton").addEventListener("click", () => { if (editSession?.dirty) openConfirm("読み込みMIDIの未保存編集を破棄して新規作成へ戻りますか？", () => enterNewMode(true)); else enterNewMode(true); });
  $("previousSectionButton").addEventListener("click", () => moveEditorSection(-1)); $("nextSectionButton").addEventListener("click", () => moveEditorSection(1));
  $("stepCount").addEventListener("change", (event) => {
    if (editSession) return; const previous = grid[0].length, next = Number(event.target.value); stopCreationPreview(); const hasTrimmedNotes = next < previous && grid.some((row) => row.slice(next).some(Boolean));
    if (hasTrimmedNotes) openConfirm(`${next + 1}～${previous}ステップにノートがあります。\n${next}ステップへ変更すると削除されます。`, () => resizeGrid(next), () => { $("stepCount").value = previous; }); else resizeGrid(next);
  });
  $("createBpm").addEventListener("input", () => { stopCreationPreview(); updateCreationInfo(); }); $("createVelocity").addEventListener("input", updateCreationInfo);
  $("createSignature").addEventListener("change", () => { stopCreationPreview(); renderSequencer(); }); $("noteUnit").addEventListener("change", () => { stopCreationPreview(); renderSequencer(); });
  $("loopToggle").addEventListener("change", () => { if (isCreationPreview && player.playing) stopCreationPreview("ループ設定を変更しました。もう一度試聴してください。"); });
  $("clearAllButton").addEventListener("click", () => {
    if (!noteCount()) return; const message = editSession ? "現在表示している2小節のノートをすべて削除しますか？" : "作成中のノートをすべて削除しますか？";
    openConfirm(message, () => { let feedback; if (editSession) { const removed = MidiEdit.clearSection(editSession); grid = MidiEdit.gridForSection(editSession); feedback = `表示範囲から${removed}ノート削除しました。`; } else { grid.forEach((row) => row.fill(false)); feedback = "すべてのノートを削除しました。"; } renderSequencer(); if (editSession) markEdited(feedback); else $("creatorFeedback").textContent = feedback; });
  });
  $("sampleButton").addEventListener("click", () => {
    enterNewMode(false); $("createBpm").value = 120; $("createSignature").value = "4/4"; $("noteUnit").value = "8"; $("createVelocity").value = 100; setStepCountValue(8);
    grid = createEmptyGrid(8); [7, 6, 5, 4, 3, 2, 1, 0].forEach((row, step) => { grid[row][step] = true; }); renderSequencer();
    const song = creationSong("C-major-scale"); song.fileName = "C-major-scale.mid（内部生成）"; loadedMidiSong = song; populateEditTracks(); loadSong(song, "120 BPMのCメジャースケールを生成しました。再生・解析・編集・保存を試せます。");
  });
  $("previewButton").addEventListener("click", async () => {
    try { player.stop(); const song = creationSong(), looping = $("loopToggle").checked; currentSong = song; player.setSong(song); player.setLoop(looping); if (looping) player.setLiveEventProvider(liveCreationSnapshot); isCreationPreview = true; renderSong(); await player.play(); }
    catch (error) { isCreationPreview = false; clearPlayhead(); $("creatorFeedback").textContent = error.message; }
  });
  $("previewStopButton").addEventListener("click", () => stopCreationPreview("試聴を停止しました。"));
  $("loadCreationButton").addEventListener("click", () => { stopCreationPreview(); const song = editSession ? MidiEdit.clone(editSession.song) : creationSong(); loadSong(song, editSession ? "編集した全曲データを再生・解析へ送りました。" : "ステップ入力を再生・解析に送りました。"); selectTab("play"); });
  function downloadSong(song, filename) { const blob = new Blob([MidiCore.write(song)], { type: "audio/midi" }), link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  $("saveButton").addEventListener("click", () => {
    const song = creationSong(); if (!song.totalNotes) { $("creatorFeedback").textContent = "保存するノートがありません。"; return; } downloadSong(song, "midi-lab-test-001.mid"); lastSavedSnapshot = { notes: song.totalNotes, bpm: song.bpm, duration: song.duration };
    $("dbgOriginalNotes").textContent = song.totalNotes; $("dbgLoadedNotes").textContent = "—"; $("dbgCompareBpm").textContent = `${formatBpm(song.bpm)} → —`; $("dbgCompareDuration").textContent = `${fixed(song.duration)} → — sec`; $("creatorFeedback").textContent = `保存しました：${song.totalNotes}ノート / ${fixed(song.duration)}秒`;
  });
  $("saveEditedButton").addEventListener("click", () => {
    if (!editSession) return; MidiEdit.refreshSong(editSession); const song = editSession.song; downloadSong(song, `${song.title || "midi-lab"}-edited.mid`); editSession.dirty = false; editSession.saved = true; updateModeDisplay(); updateEditComparison();
    lastSavedSnapshot = { notes: song.totalNotes, bpm: song.bpm, duration: song.duration }; $("dbgOriginalNotes").textContent = editSession.originalTotalNotes; $("dbgLoadedNotes").textContent = song.totalNotes; $("dbgCompareBpm").textContent = `${formatBpm(editSession.originalSong.bpm)} → ${formatBpm(song.bpm)}`; $("dbgCompareDuration").textContent = `${fixed(editSession.originalSong.duration)} → ${fixed(song.duration)} sec`;
    $("creatorFeedback").textContent = `全曲を保存しました：${song.totalNotes}ノート${MidiEdit.warnings(song).length ? "（未対応イベントの警告あり）" : ""}`;
  });
  function compareLoadedSong(song) { if (!lastSavedSnapshot) return; $("dbgOriginalNotes").textContent = lastSavedSnapshot.notes; $("dbgLoadedNotes").textContent = song.totalNotes; $("dbgCompareBpm").textContent = `${formatBpm(lastSavedSnapshot.bpm)} → ${formatBpm(song.bpm)}`; $("dbgCompareDuration").textContent = `${fixed(lastSavedSnapshot.duration)} → ${fixed(song.duration)} sec`; }

  populateEditTracks(); setCreationControlsForMode(); renderSequencer(); updateModeDisplay(); updateEditComparison(); updateTransportState(); animationFrame();
})();
