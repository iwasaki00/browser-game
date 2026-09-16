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

  function createEmptyGrid(steps) { return pitches.map(() => Array(steps).fill(false)); }
  function formatTime(seconds) {
    const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
    const minutes = Math.floor(ms / 60000), secs = Math.floor((ms % 60000) / 1000), millis = ms % 1000;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  function fixed(value, digits = 3) { return Number(value).toFixed(digits); }
  function setMessage(text, isError = false) { $("message").textContent = text; $("message").classList.toggle("error", isError); }

  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("is-active", el.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((el) => el.classList.toggle("is-active", el.id === `tab-${name}`));
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
    } catch (error) { console.error(error); setMessage(`読み込みエラー: ${error.message}`, true); }
  }

  function loadSong(song, message) {
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
    try { await player.play(); } catch (error) { setMessage(error.message, true); selectTab(currentSong ? "play" : "load"); }
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
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  }, { passive: false });
  $("volume").addEventListener("input", (event) => { synth.setVolume(event.target.value); $("volumeValue").textContent = `${Math.round(event.target.value * 100)}%`; });
  $("seekBar").addEventListener("pointerdown", () => { isSeeking = true; });
  $("seekBar").addEventListener("input", (event) => { isSeeking = true; $("currentTime").textContent = formatTime(event.target.value); updateMonitor(Number(event.target.value)); });
  $("seekBar").addEventListener("change", (event) => { player.seek(event.target.value); isSeeking = false; });

  function updateTransportState() { $("playButton").textContent = player.playing ? "▶ 再生中" : "▶ 再生"; }

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
    updateMonitor(seconds); requestAnimationFrame(animationFrame);
  }

  $("debugToggle").addEventListener("change", (event) => { debugVisible = event.target.checked; $("debugConsole").classList.toggle("is-hidden", !debugVisible); });

  function renderSequencer() {
    const steps = Number($("stepCount").value);
    if (grid[0].length !== steps) grid = pitches.map((_, row) => Array.from({ length: steps }, (_, i) => grid[row]?.[i] || false));
    const seq = $("sequencer"); seq.style.gridTemplateColumns = `42px repeat(${steps}, var(--step-width, 50px))`; seq.style.gridTemplateRows = `26px repeat(${pitches.length}, 44px)`; seq.replaceChildren();
    const corner = document.createElement("span"); corner.className = "pitch-corner"; seq.append(corner);
    for (let step = 0; step < steps; step++) { const label = document.createElement("span"); label.className = "step-index"; label.textContent = step + 1; seq.append(label); }
    pitches.forEach((pitch, row) => {
      const label = document.createElement("span"); label.className = "pitch-label"; label.textContent = MidiCore.noteName(pitch); seq.append(label);
      for (let step = 0; step < steps; step++) {
        const cell = document.createElement("button"); cell.type = "button"; cell.className = `step-cell${grid[row][step] ? " is-on" : ""}`;
        cell.setAttribute("role", "gridcell"); cell.setAttribute("aria-label", `${MidiCore.noteName(pitch)} ステップ${step + 1}`); cell.setAttribute("aria-pressed", grid[row][step]);
        cell.addEventListener("click", () => { grid[row][step] = !grid[row][step]; cell.classList.toggle("is-on", grid[row][step]); cell.setAttribute("aria-pressed", grid[row][step]); });
        seq.append(cell);
      }
    });
  }

  function creationSong(title = "midi-lab-test-001") {
    const [numerator, denominator] = $("createSignature").value.split("/").map(Number);
    return MidiCore.createStepSong({ title, bpm: $("createBpm").value, numerator, denominator, noteUnit: Number($("noteUnit").value), velocity: $("createVelocity").value, steps: Number($("stepCount").value), pitches, grid });
  }

  $("stepCount").addEventListener("change", renderSequencer);
  $("sampleButton").addEventListener("click", () => {
    $("createBpm").value = 120; $("createSignature").value = "4/4"; $("noteUnit").value = "8"; $("createVelocity").value = 100; $("stepCount").value = "8";
    grid = createEmptyGrid(8);
    const ascendingRows = [7, 6, 5, 4, 3, 2, 1, 0]; ascendingRows.forEach((row, step) => { grid[row][step] = true; });
    renderSequencer(); const song = creationSong("C-major-scale"); song.fileName = "C-major-scale.mid（内部生成）";
    loadSong(song, "120 BPMのCメジャースケールを生成しました。再生・解析・保存を試せます。");
  });
  $("previewButton").addEventListener("click", async () => {
    try { const song = creationSong(); currentSong = song; player.setSong(song); renderSong(); await player.play(); }
    catch (error) { setMessage(error.message, true); }
  });
  $("loadCreationButton").addEventListener("click", () => { loadSong(creationSong(), "ステップ入力を再生・解析に送りました。"); selectTab("play"); });
  $("saveButton").addEventListener("click", () => {
    const song = creationSong();
    if (!song.totalNotes) { setMessage("保存するノートがありません。ステップを1つ以上ONにしてください。", true); selectTab("load"); return; }
    const blob = new Blob([MidiCore.write(song)], { type: "audio/midi" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "midi-lab-test-001.mid"; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  renderSequencer(); animationFrame();
})();
