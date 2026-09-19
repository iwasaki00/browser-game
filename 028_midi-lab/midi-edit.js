/* MIDI-to-grid conversion and editable whole-song state, independent from the UI. */
(function (global) {
  "use strict";

  const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const stepTicks = (ppq, noteUnit) => Number(ppq) * 4 / Number(noteUnit);
  const barTicks = (ppq, signature) => global.MidiTiming.ticksPerBar(ppq, signature);
  const tickToSeconds = (song, tick) => global.MidiTiming.tickToSeconds(song, tick);

  function choosePitchRange(notes, maxSpan = 24) {
    if (!notes.length) return { pitches: [72, 71, 69, 67, 65, 64, 62, 60], min: 60, max: 72, omitted: 0 };
    const counts = new Map();
    notes.forEach((note) => counts.set(note.noteNumber, (counts.get(note.noteNumber) || 0) + 1));
    const values = [...counts.keys()].sort((a, b) => a - b), min = values[0], max = values[values.length - 1];
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
    return { pitches, min, max, visibleMin: low, visibleMax: high, omitted: notes.filter((note) => note.noteNumber < low || note.noteNumber > high).length };
  }

  function sectionBounds(session) {
    const startBar = session.sectionStartBar + 1, endBar = startBar + session.sectionBars;
    const startTick = Math.round(global.MidiTiming.barBeatToTick(session.song, startBar, 1, 0));
    const endTick = Math.round(global.MidiTiming.barBeatToTick(session.song, endBar, 1, 0));
    const stepTicksList = [];
    for (let tick = startTick; tick < endTick - 0.5; tick += session.ticksPerStep) stepTicksList.push(Math.round(tick));
    return {
      startBar, endBar, startTick, endTick, stepTicks: stepTicksList,
      startSeconds: tickToSeconds(session.song, startTick), endSeconds: tickToSeconds(session.song, endTick)
    };
  }

  function updateSectionMetrics(session) {
    const bounds = sectionBounds(session);
    session.sectionStartTick = bounds.startTick;
    session.sectionEndTick = bounds.endTick;
    session.sectionSteps = bounds.stepTicks.length;
    const signature = global.MidiTiming.signatureAtTick(session.song, bounds.startTick);
    session.ticksPerBar = barTicks(session.song.ppq, signature);
    session.stepsPerBar = session.sectionSteps / session.sectionBars;
    return bounds;
  }

  function createSession(sourceSong, trackIndex, noteUnit = 8, sectionBars = 2) {
    const originalSong = clone(sourceSong), song = clone(sourceSong), track = song.tracks[trackIndex];
    if (!track) throw new Error("編集対象トラックが見つかりません。");
    song.tempoMap = global.MidiTiming.buildTempoMap(song.tempoMap, song.ppq, song.bpm || 120);
    song.timeSignatureMap = global.MidiTiming.buildTimeSignatureMap(song.timeSignatureMap, song.ppq, song.timeSignature || { numerator: 4, denominator: 4 });
    song.bpm = song.tempoMap[0].bpm; song.timeSignature = song.timeSignatureMap[0];
    const ticksPerStep = stepTicks(song.ppq, noteUnit);
    track.notes.forEach((note, index) => {
      const sourceTick = Number.isFinite(note.startTick) ? note.startTick : global.MidiTiming.secondsToTick(song, note.startTime);
      const sourceEndTick = Number.isFinite(note.endTick) ? note.endTick : global.MidiTiming.secondsToTick(song, note.startTime + note.duration);
      const durationTicks = Number.isFinite(note.durationTicks) ? note.durationTicks : Math.max(1, Math.round(sourceEndTick - sourceTick));
      note._sourceId = `source-${index}`;
      note._gridTick = Math.max(0, Math.round(sourceTick / ticksPerStep) * ticksPerStep);
      note._editStep = Math.round(note._gridTick / ticksPerStep);
      note._durationTicks = Math.max(1, durationTicks);
      note.startTick = note._gridTick; note.endTick = note.startTick + note._durationTicks;
      note.startTime = tickToSeconds(song, note.startTick);
      note.duration = Math.max(0.001, tickToSeconds(song, note.endTick) - note.startTime);
      note.noteName = global.MidiCore.noteName(note.noteNumber);
    });
    track.notes.sort((a, b) => a.startTick - b.startTick || a.noteNumber - b.noteNumber);
    const pitchRange = choosePitchRange(track.notes);
    const lastTick = Math.max(Number(song.endTick) || 0, ...song.tracks.flatMap((item) => item.notes.map((note) => note.endTick || 0)), 1);
    const session = {
      mode: "midi", originalSong, song, trackIndex, noteUnit: Number(noteUnit), sectionBars,
      ticksPerStep, totalBars: global.MidiTiming.totalBars(song, lastTick), sectionStartBar: 0,
      pitches: pitchRange.pitches, pitchRange, originalTrackNotes: track.notes.length,
      originalTotalNotes: sourceSong.totalNotes, dirty: false, saved: false
    };
    song.keepTicks = true; song.endTick = Math.max(Number(song.endTick) || 0, lastTick);
    updateSectionMetrics(session);
    return session;
  }

  function gridForSection(session) {
    const bounds = updateSectionMetrics(session), grid = session.pitches.map(() => Array(bounds.stepTicks.length).fill(false));
    const rowByPitch = new Map(session.pitches.map((pitch, row) => [pitch, row]));
    session.song.tracks[session.trackIndex].notes.forEach((note) => {
      if (note.startTick < bounds.startTick || note.startTick >= bounds.endTick) return;
      const row = rowByPitch.get(note.noteNumber); if (row === undefined) return;
      const localStep = Math.round((note.startTick - bounds.startTick) / session.ticksPerStep);
      if (localStep < 0 || localStep >= grid[row].length) return;
      if (!grid[row][localStep]) grid[row][localStep] = { notes: [], tick: bounds.stepTicks[localStep] };
      grid[row][localStep].notes.push(note);
    });
    return grid;
  }

  function cellTick(session, localStep) { return sectionBounds(session).stepTicks[localStep]; }
  function notesAtCell(session, pitch, localStep) { const tick = cellTick(session, localStep); return session.song.tracks[session.trackIndex].notes.filter((note) => note.noteNumber === pitch && note.startTick === tick); }

  function toggleCell(session, pitch, localStep, velocity) {
    const track = session.song.tracks[session.trackIndex], existing = notesAtCell(session, pitch, localStep);
    if (existing.length) { const remove = new Set(existing); track.notes = track.notes.filter((note) => !remove.has(note)); session.dirty = true; session.saved = false; refreshSong(session); return false; }
    const startTick = cellTick(session, localStep); if (!Number.isFinite(startTick)) return false;
    const durationTicks = Math.max(1, Math.round(session.ticksPerStep * 0.9)), channel = Number.isInteger(track.channel) ? track.channel : (track.channels?.[0] || 0);
    track.notes.push({
      noteNumber: pitch, noteName: global.MidiCore.noteName(pitch), channel,
      startTick, endTick: startTick + durationTicks, durationTicks, startTime: tickToSeconds(session.song, startTick),
      duration: Math.max(0.001, tickToSeconds(session.song, startTick + durationTicks) - tickToSeconds(session.song, startTick)),
      velocity: Number(velocity) || 100, _sourceId: null, _gridTick: startTick, _editStep: Math.round(startTick / session.ticksPerStep), _durationTicks: durationTicks
    });
    session.dirty = true; session.saved = false; refreshSong(session); return true;
  }

  function removeWhere(session, predicate) {
    const track = session.song.tracks[session.trackIndex], before = track.notes.length;
    track.notes = track.notes.filter((note) => !predicate(note));
    if (track.notes.length !== before) { session.dirty = true; session.saved = false; refreshSong(session); }
    return before - track.notes.length;
  }
  function clearStep(session, localStep) { const tick = cellTick(session, localStep), visible = new Set(session.pitches); return removeWhere(session, (note) => note.startTick === tick && visible.has(note.noteNumber)); }
  function clearPitch(session, pitch) { const { startTick, endTick } = sectionBounds(session); return removeWhere(session, (note) => note.noteNumber === pitch && note.startTick >= startTick && note.startTick < endTick); }
  function clearSection(session) { const { startTick, endTick } = sectionBounds(session), visible = new Set(session.pitches); return removeWhere(session, (note) => note.startTick >= startTick && note.startTick < endTick && visible.has(note.noteNumber)); }

  function refreshSong(session) {
    const track = session.song.tracks[session.trackIndex];
    track.notes.sort((a, b) => a.startTick - b.startTick || a.noteNumber - b.noteNumber);
    track.notes.forEach((note) => {
      note.durationTicks = note._durationTicks || Math.max(1, note.endTick - note.startTick); note.endTick = note.startTick + note.durationTicks;
      note.startTime = tickToSeconds(session.song, note.startTick); note.duration = Math.max(0.001, tickToSeconds(session.song, note.endTick) - note.startTime); note.noteName = global.MidiCore.noteName(note.noteNumber);
    });
    session.song.totalNotes = session.song.tracks.reduce((sum, item) => sum + item.notes.length, 0);
    const lastTick = session.song.tracks.flatMap((item) => item.notes).reduce((max, note) => Math.max(max, note.endTick || 0), 0);
    session.song.endTick = Math.max(Number(session.originalSong.endTick) || 0, lastTick);
    session.song.duration = Math.max(Number(session.originalSong.duration) || 0, tickToSeconds(session.song, session.song.endTick));
    session.totalBars = global.MidiTiming.totalBars(session.song, session.song.endTick);
  }

  function sectionSong(session) {
    const bounds = updateSectionMetrics(session), sourceTrack = session.song.tracks[session.trackIndex];
    const activeTempo = global.MidiTiming.tempoAtTick(session.song, bounds.startTick), activeSignature = global.MidiTiming.signatureAtTick(session.song, bounds.startTick);
    const tempoRaw = [{ ...activeTempo, tick: 0 }, ...session.song.tempoMap.filter((event) => event.tick > bounds.startTick && event.tick < bounds.endTick).map((event) => ({ ...event, tick: event.tick - bounds.startTick }))];
    const signatureRaw = [{ ...activeSignature, tick: 0 }, ...session.song.timeSignatureMap.filter((event) => event.tick > bounds.startTick && event.tick < bounds.endTick).map((event) => ({ ...event, tick: event.tick - bounds.startTick }))];
    const localSong = { ppq: session.song.ppq, bpm: activeTempo.bpm, timeSignature: activeSignature, tempoMap: global.MidiTiming.buildTempoMap(tempoRaw, session.song.ppq, activeTempo.bpm), timeSignatureMap: global.MidiTiming.buildTimeSignatureMap(signatureRaw, session.song.ppq, activeSignature) };
    const notes = sourceTrack.notes.filter((note) => note.startTick >= bounds.startTick && note.startTick < bounds.endTick).map((note) => {
      const localTick = note.startTick - bounds.startTick, localEndTick = Math.max(localTick + 1, Math.min(bounds.endTick, note.endTick) - bounds.startTick);
      return { noteNumber: note.noteNumber, noteName: note.noteName, channel: note.channel, stepIndex: Math.round(localTick / session.ticksPerStep), tick: localTick, absoluteTick: note.startTick, startTick: localTick, endTick: localEndTick, startTime: global.MidiTiming.tickToSeconds(localSong, localTick), duration: Math.max(0.001, global.MidiTiming.tickToSeconds(localSong, localEndTick) - global.MidiTiming.tickToSeconds(localSong, localTick)), velocity: note.velocity };
    });
    const durationTicks = bounds.endTick - bounds.startTick, duration = global.MidiTiming.tickToSeconds(localSong, durationTicks);
    return {
      title: `${session.song.title} Bars ${bounds.startBar}-${Math.min(session.totalBars, bounds.endBar - 1)}`, fileName: session.song.fileName,
      format: 1, ppq: session.song.ppq, bpm: localSong.tempoMap[0].bpm, timeSignature: localSong.timeSignatureMap[0],
      tempoMap: localSong.tempoMap, timeSignatureMap: localSong.timeSignatureMap, duration, endTick: durationTicks, keepTicks: true,
      sectionStartTick: bounds.startTick, sectionStartBar: bounds.startBar, sectionEndTick: bounds.endTick,
      totalNotes: notes.length, tracks: [{ ...sourceTrack, id: 0, enabled: true, notes }]
    };
  }

  function comparison(session) { const notes = session.song.tracks[session.trackIndex].notes, surviving = new Set(notes.map((note) => note._sourceId).filter(Boolean)); return { original: session.originalTrackNotes, edited: notes.length, added: notes.filter((note) => !note._sourceId).length, deleted: session.originalTrackNotes - surviving.size }; }
  function warnings(song) {
    const warnings = [], unsupportedCount = Object.values(song.unsupportedEvents || {}).reduce((sum, count) => sum + count, 0);
    if (unsupportedCount) warnings.push(`未対応イベント ${unsupportedCount}件は保存時に失われる可能性があります。`);
    if (song.tracks?.some((track) => (track.programs?.length || 0) > 1)) warnings.push("トラック途中のProgram Changeは、保存時に先頭のProgramへ統合されます。");
    return warnings;
  }

  global.MidiEdit = { clone, stepTicks, barTicks, tickToSeconds, choosePitchRange, createSession, updateSectionMetrics, gridForSection, notesAtCell, toggleCell, clearStep, clearPitch, clearSection, refreshSong, sectionSong, sectionBounds, cellTick, comparison, warnings };
})(window);
