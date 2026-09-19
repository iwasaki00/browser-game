/* MIDI-to-grid conversion and editable whole-song state, independent from the UI. */
(function (global) {
  "use strict";

  const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const stepTicks = (ppq, noteUnit) => Number(ppq) * 4 / Number(noteUnit);
  const barTicks = (ppq, signature) => Number(ppq) * 4 / Number(signature.denominator) * Number(signature.numerator);

  function tickToSeconds(song, tick) {
    const map = song.tempoMap?.length ? song.tempoMap : [{ tick: 0, time: 0, microseconds: 60000000 / (song.bpm || 120) }];
    let tempo = map[0];
    for (let i = 1; i < map.length && map[i].tick <= tick; i++) tempo = map[i];
    const baseTime = Number.isFinite(tempo.time) ? tempo.time : 0;
    const microseconds = tempo.microseconds || 60000000 / (tempo.bpm || song.bpm || 120);
    return baseTime + (tick - tempo.tick) * microseconds / 1000000 / song.ppq;
  }

  function choosePitchRange(notes, maxSpan = 24) {
    if (!notes.length) return { pitches: [72, 71, 69, 67, 65, 64, 62, 60], min: 60, max: 72, omitted: 0 };
    const counts = new Map();
    notes.forEach((note) => counts.set(note.noteNumber, (counts.get(note.noteNumber) || 0) + 1));
    const values = [...counts.keys()].sort((a, b) => a - b);
    const min = values[0], max = values[values.length - 1];
    let low = min, high = max;
    if (max - min > maxSpan) {
      let bestScore = -1;
      for (let start = min; start <= max - maxSpan; start++) {
        let score = 0;
        counts.forEach((count, pitch) => { if (pitch >= start && pitch <= start + maxSpan) score += count; });
        if (score > bestScore) { bestScore = score; low = start; }
      }
      high = low + maxSpan;
    }
    const pitches = [];
    for (let pitch = high; pitch >= low; pitch--) pitches.push(pitch);
    const omitted = notes.filter((note) => note.noteNumber < low || note.noteNumber > high).length;
    return { pitches, min, max, visibleMin: low, visibleMax: high, omitted };
  }

  function createSession(sourceSong, trackIndex, noteUnit = 8, sectionBars = 2) {
    const originalSong = clone(sourceSong);
    const song = clone(sourceSong);
    const track = song.tracks[trackIndex];
    if (!track) throw new Error("編集対象トラックが見つかりません。");
    const signature = song.timeSignature || { numerator: 4, denominator: 4 };
    const ticksPerStep = stepTicks(song.ppq, noteUnit);
    const ticksPerBar = barTicks(song.ppq, signature);
    const stepsPerBar = Math.round(ticksPerBar / ticksPerStep);
    track.notes.forEach((note, index) => {
      const sourceTick = Number.isFinite(note.startTick) ? note.startTick : Math.round(note.startTime * (song.bpm || 120) * song.ppq / 60);
      const durationTicks = Number.isFinite(note.durationTicks) ? note.durationTicks : Math.max(1, Math.round(note.duration * (song.bpm || 120) * song.ppq / 60));
      note._sourceId = `source-${index}`;
      note._editStep = Math.max(0, Math.round(sourceTick / ticksPerStep));
      note._durationTicks = Math.max(1, durationTicks);
      note.startTick = Math.round(note._editStep * ticksPerStep);
      note.endTick = note.startTick + note._durationTicks;
      note.startTime = tickToSeconds(song, note.startTick);
      note.duration = Math.max(0.001, tickToSeconds(song, note.endTick) - note.startTime);
      note.noteName = global.MidiCore.noteName(note.noteNumber);
    });
    track.notes.sort((a, b) => a.startTick - b.startTick || a.noteNumber - b.noteNumber);
    const pitchRange = choosePitchRange(track.notes);
    const lastStep = track.notes.reduce((max, note) => Math.max(max, note._editStep + 1), 1);
    const declaredEndTick = Number(song.endTick) || 0;
    const totalBars = Math.max(1, Math.ceil(lastStep / stepsPerBar), Math.ceil(declaredEndTick / ticksPerBar));
    song.keepTicks = true;
    song.endTick = Math.max(Number(song.endTick) || 0, totalBars * ticksPerBar);
    return {
      mode: "midi", originalSong, song, trackIndex, noteUnit: Number(noteUnit), sectionBars,
      ticksPerStep, ticksPerBar, stepsPerBar, sectionSteps: stepsPerBar * sectionBars,
      totalBars, sectionStartBar: 0, pitches: pitchRange.pitches, pitchRange,
      originalTrackNotes: track.notes.length, originalTotalNotes: sourceSong.totalNotes, dirty: false, saved: false
    };
  }

  function sectionBounds(session) {
    const startStep = session.sectionStartBar * session.stepsPerBar;
    return { startStep, endStep: startStep + session.sectionSteps };
  }

  function gridForSection(session) {
    const { startStep, endStep } = sectionBounds(session);
    const grid = session.pitches.map(() => Array(session.sectionSteps).fill(false));
    const rowByPitch = new Map(session.pitches.map((pitch, row) => [pitch, row]));
    const track = session.song.tracks[session.trackIndex];
    track.notes.forEach((note) => {
      if (note._editStep < startStep || note._editStep >= endStep) return;
      const row = rowByPitch.get(note.noteNumber);
      if (row === undefined) return;
      const localStep = note._editStep - startStep;
      if (!grid[row][localStep]) grid[row][localStep] = { notes: [] };
      grid[row][localStep].notes.push(note);
    });
    return grid;
  }

  function notesAtCell(session, pitch, localStep) {
    const globalStep = sectionBounds(session).startStep + localStep;
    return session.song.tracks[session.trackIndex].notes.filter((note) => note.noteNumber === pitch && note._editStep === globalStep);
  }

  function toggleCell(session, pitch, localStep, velocity) {
    const track = session.song.tracks[session.trackIndex];
    const existing = notesAtCell(session, pitch, localStep);
    if (existing.length) {
      const remove = new Set(existing);
      track.notes = track.notes.filter((note) => !remove.has(note));
      session.dirty = true; session.saved = false; refreshSong(session);
      return false;
    }
    const globalStep = sectionBounds(session).startStep + localStep;
    const startTick = Math.round(globalStep * session.ticksPerStep);
    const durationTicks = Math.max(1, Math.round(session.ticksPerStep * 0.9));
    const channel = Number.isInteger(track.channel) ? track.channel : (track.channels?.[0] || 0);
    track.notes.push({
      noteNumber: pitch, noteName: global.MidiCore.noteName(pitch), channel,
      startTick, endTick: startTick + durationTicks, durationTicks,
      startTime: tickToSeconds(session.song, startTick),
      duration: Math.max(0.001, tickToSeconds(session.song, startTick + durationTicks) - tickToSeconds(session.song, startTick)),
      velocity: Number(velocity) || 100, _sourceId: null, _editStep: globalStep, _durationTicks: durationTicks
    });
    session.dirty = true; session.saved = false; refreshSong(session);
    return true;
  }

  function removeWhere(session, predicate) {
    const track = session.song.tracks[session.trackIndex];
    const before = track.notes.length;
    track.notes = track.notes.filter((note) => !predicate(note));
    if (track.notes.length !== before) { session.dirty = true; session.saved = false; refreshSong(session); }
    return before - track.notes.length;
  }

  function clearStep(session, localStep) {
    const globalStep = sectionBounds(session).startStep + localStep;
    const visible = new Set(session.pitches);
    return removeWhere(session, (note) => note._editStep === globalStep && visible.has(note.noteNumber));
  }

  function clearPitch(session, pitch) {
    const { startStep, endStep } = sectionBounds(session);
    return removeWhere(session, (note) => note.noteNumber === pitch && note._editStep >= startStep && note._editStep < endStep);
  }

  function clearSection(session) {
    const { startStep, endStep } = sectionBounds(session);
    const visible = new Set(session.pitches);
    return removeWhere(session, (note) => note._editStep >= startStep && note._editStep < endStep && visible.has(note.noteNumber));
  }

  function refreshSong(session) {
    const track = session.song.tracks[session.trackIndex];
    track.notes.sort((a, b) => a.startTick - b.startTick || a.noteNumber - b.noteNumber);
    track.notes.forEach((note) => {
      note.durationTicks = note._durationTicks || Math.max(1, note.endTick - note.startTick);
      note.endTick = note.startTick + note.durationTicks;
      note.startTime = tickToSeconds(session.song, note.startTick);
      note.duration = Math.max(0.001, tickToSeconds(session.song, note.endTick) - note.startTime);
      note.noteName = global.MidiCore.noteName(note.noteNumber);
    });
    session.song.totalNotes = session.song.tracks.reduce((sum, item) => sum + item.notes.length, 0);
    const lastTick = session.song.tracks.flatMap((item) => item.notes).reduce((max, note) => Math.max(max, note.endTick || 0), 0);
    session.song.endTick = Math.max(Number(session.originalSong.endTick) || 0, lastTick);
    session.song.duration = Math.max(Number(session.originalSong.duration) || 0, tickToSeconds(session.song, session.song.endTick));
  }

  function sectionSong(session) {
    const { startStep, endStep } = sectionBounds(session);
    const sourceTrack = session.song.tracks[session.trackIndex];
    const bpm = session.song.bpm || 120;
    const stepSeconds = global.MidiCore.stepUnitToBeats(session.noteUnit) * 60 / bpm;
    const notes = sourceTrack.notes.filter((note) => note._editStep >= startStep && note._editStep < endStep).map((note) => ({
      noteNumber: note.noteNumber, noteName: note.noteName, channel: note.channel,
      stepIndex: note._editStep - startStep,
      startTime: (note._editStep - startStep) * stepSeconds,
      duration: Math.max(0.001, note.duration), velocity: note.velocity
    }));
    const duration = session.sectionSteps * stepSeconds;
    return {
      title: `${session.song.title} Bars ${session.sectionStartBar + 1}-${Math.min(session.totalBars, session.sectionStartBar + session.sectionBars)}`,
      fileName: session.song.fileName, format: 1, ppq: session.song.ppq, bpm,
      timeSignature: session.song.timeSignature, tempoMap: [{ tick: 0, time: 0, bpm, microseconds: 60000000 / bpm }],
      timeSignatureMap: [{ tick: 0, ...session.song.timeSignature }], duration, totalNotes: notes.length,
      tracks: [{ ...sourceTrack, id: 0, enabled: true, notes }]
    };
  }

  function comparison(session) {
    const notes = session.song.tracks[session.trackIndex].notes;
    const surviving = new Set(notes.map((note) => note._sourceId).filter(Boolean));
    const added = notes.filter((note) => !note._sourceId).length;
    const deleted = session.originalTrackNotes - surviving.size;
    return { original: session.originalTrackNotes, edited: notes.length, added, deleted };
  }

  function warnings(song) {
    const warnings = [];
    const unsupported = song.unsupportedEvents || {};
    const unsupportedCount = Object.values(unsupported).reduce((sum, count) => sum + count, 0);
    if (unsupportedCount) warnings.push(`未対応イベント ${unsupportedCount}件は保存時に失われる可能性があります。`);
    if (song.tracks?.some((track) => (track.programs?.length || 0) > 1)) warnings.push("トラック途中のProgram Changeは、保存時に先頭のProgramへ統合されます。");
    if ((song.tempoMap?.length || 0) > 1) warnings.push("テンポ変更は保持しますが、区間試聴は先頭BPMで再生します。");
    if ((song.timeSignatureMap?.length || 0) > 1) warnings.push("途中の拍子変更はグリッド編集に反映されません。");
    return warnings;
  }

  global.MidiEdit = { clone, stepTicks, barTicks, tickToSeconds, choosePitchRange, createSession, gridForSection, notesAtCell, toggleCell, clearStep, clearPitch, clearSection, refreshSong, sectionSong, sectionBounds, comparison, warnings };
})(window);
