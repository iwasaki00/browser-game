/* MIDI parsing/writing kept independent from the UI and Web Audio layer. */
(function (global) {
  "use strict";

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const GM_INSTRUMENTS = [
    "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavinet",
    "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
    "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
    "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)", "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
    "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
    "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
    "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
    "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
    "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
    "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
    "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass + lead)",
    "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
    "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)",
    "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bag Pipe", "Fiddle", "Shanai",
    "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
    "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot"
  ];

  function noteName(number) {
    return NOTE_NAMES[number % 12] + (Math.floor(number / 12) - 1);
  }

  class Reader {
    constructor(buffer) { this.bytes = new Uint8Array(buffer); this.pos = 0; }
    u8() { if (this.pos >= this.bytes.length) throw new Error("Unexpected end of MIDI data"); return this.bytes[this.pos++]; }
    u16() { return (this.u8() << 8) | this.u8(); }
    u32() { return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0; }
    str(n) { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; }
    vlq() { let value = 0, b, count = 0; do { b = this.u8(); value = (value << 7) | (b & 0x7f); if (++count > 4) throw new Error("Invalid variable-length value"); } while (b & 0x80); return value; }
    skip(n) { this.pos += n; if (this.pos > this.bytes.length) throw new Error("Truncated MIDI event"); }
  }

  function decodeText(bytes) {
    try { return new TextDecoder("utf-8").decode(new Uint8Array(bytes)); }
    catch (_) { return bytes.map((b) => String.fromCharCode(b)).join(""); }
  }

  function parse(arrayBuffer, fileName) {
    const r = new Reader(arrayBuffer);
    if (r.str(4) !== "MThd") throw new Error("Standard MIDI Fileではありません（MThdがありません）。");
    const headerLength = r.u32();
    const format = r.u16();
    const trackCount = r.u16();
    const division = r.u16();
    if (division & 0x8000) throw new Error("SMPTE time divisionは現在未対応です。");
    const ppq = division;
    if (headerLength > 6) r.skip(headerLength - 6);

    const rawTracks = [];
    const tempos = [{ tick: 0, microseconds: 500000 }];
    const signatures = [{ tick: 0, numerator: 4, denominator: 4 }];
    let maxTick = 0;
    const unsupportedEvents = { controlChange: 0, pitchBend: 0, aftertouch: 0, sysex: 0, lyrics: 0, otherMeta: 0 };

    for (let ti = 0; ti < trackCount; ti++) {
      if (r.str(4) !== "MTrk") throw new Error(`Track ${ti + 1} のMTrkヘッダーがありません。`);
      const trackLength = r.u32();
      const end = r.pos + trackLength;
      let tick = 0, runningStatus = null, name = "", noteCount = 0;
      const active = new Map(), notes = [], channels = new Set(), programs = new Set();
      while (r.pos < end) {
        tick += r.vlq();
        let status = r.u8(), firstData = null;
        if (status < 0x80) {
          if (runningStatus === null) throw new Error("Invalid running status");
          firstData = status; status = runningStatus;
        } else if (status < 0xf0) runningStatus = status;

        if (status === 0xff) {
          const type = r.u8(), len = r.vlq(), data = [];
          for (let i = 0; i < len; i++) data.push(r.u8());
          if (type === 0x03) name = decodeText(data);
          else if (type === 0x51 && len === 3) tempos.push({ tick, microseconds: (data[0] << 16) | (data[1] << 8) | data[2] });
          else if (type === 0x58 && len >= 2) signatures.push({ tick, numerator: data[0], denominator: Math.pow(2, data[1]) });
          else if (type === 0x05) unsupportedEvents.lyrics++;
          else if (type !== 0x2f) unsupportedEvents.otherMeta++;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { unsupportedEvents.sysex++; r.skip(r.vlq()); runningStatus = null; continue; }
        if (status >= 0xf0) throw new Error(`未対応のSystem Event: 0x${status.toString(16)}`);

        const kind = status >> 4, channel = status & 0x0f;
        channels.add(channel);
        const d1 = firstData === null ? r.u8() : firstData;
        const d2 = (kind === 0x0c || kind === 0x0d) ? null : r.u8();
        if (kind === 0x0b) unsupportedEvents.controlChange++;
        else if (kind === 0x0e) unsupportedEvents.pitchBend++;
        else if (kind === 0x0a || kind === 0x0d) unsupportedEvents.aftertouch++;
        if (kind === 0x0c) programs.add(d1);
        if (kind === 0x09 && d2 > 0) {
          const key = `${channel}:${d1}`;
          if (!active.has(key)) active.set(key, []);
          active.get(key).push({ tick, velocity: d2, channel, noteNumber: d1 });
        } else if (kind === 0x08 || (kind === 0x09 && d2 === 0)) {
          const key = `${channel}:${d1}`, stack = active.get(key);
          if (stack && stack.length) {
            const on = stack.shift();
            notes.push({ ...on, endTick: tick, durationTicks: Math.max(0, tick - on.tick) });
            noteCount++;
          }
        }
      }
      r.pos = end;
      maxTick = Math.max(maxTick, tick);
      rawTracks.push({ id: ti, name: name || `Track ${ti + 1}`, channels: [...channels], programs: [...programs], notes, endTick: tick, noteCount });
    }

    const uniqByTick = (items) => {
      const map = new Map(); items.sort((a, b) => a.tick - b.tick).forEach((v) => map.set(v.tick, v)); return [...map.values()].sort((a, b) => a.tick - b.tick);
    };
    const tempoMap = uniqByTick(tempos);
    let elapsed = 0;
    tempoMap.forEach((tempo, i) => {
      if (i) elapsed += (tempo.tick - tempoMap[i - 1].tick) * tempoMap[i - 1].microseconds / 1000000 / ppq;
      tempo.time = elapsed;
      tempo.bpm = 60000000 / tempo.microseconds;
    });
    const timeSignatureMap = uniqByTick(signatures);

    function tickToSeconds(tick) {
      let t = tempoMap[0];
      for (let i = 1; i < tempoMap.length && tempoMap[i].tick <= tick; i++) t = tempoMap[i];
      return t.time + (tick - t.tick) * t.microseconds / 1000000 / ppq;
    }

    const tracks = rawTracks.map((track) => {
      const channel = track.channels.length === 1 ? track.channels[0] : (track.channels.length ? track.channels.join(", ") : "—");
      const program = track.programs.length ? track.programs[0] : 0;
      const drum = track.channels.includes(9);
      return {
        id: track.id, name: track.name, channel, channels: track.channels, program,
        programs: track.programs, instrumentName: drum ? "Drum Kit" : (GM_INSTRUMENTS[program] || "Unknown"), enabled: true,
        notes: track.notes.map((n) => ({
          noteNumber: n.noteNumber, noteName: noteName(n.noteNumber), channel: n.channel,
          startTick: n.tick, endTick: n.endTick, durationTicks: n.durationTicks, startTime: tickToSeconds(n.tick),
          duration: tickToSeconds(n.endTick) - tickToSeconds(n.tick), velocity: n.velocity
        })).sort((a, b) => a.startTime - b.startTime)
      };
    });
    const duration = Math.max(tickToSeconds(maxTick), ...tracks.flatMap((t) => t.notes.map((n) => n.startTime + n.duration)), 0);
    return {
      title: (fileName || "Untitled").replace(/\.(mid|midi)$/i, ""), fileName: fileName || "—", format, ppq, duration, endTick: maxTick,
      bpm: tempoMap[0].bpm, timeSignature: timeSignatureMap[0], tempoMap, timeSignatureMap, tracks, unsupportedEvents,
      hasUnsupportedEvents: Object.values(unsupportedEvents).some((count) => count > 0),
      totalNotes: tracks.reduce((sum, t) => sum + t.notes.length, 0)
    };
  }

  function vlq(value) {
    let buffer = value & 0x7f, out = [];
    while ((value >>= 7)) { buffer <<= 8; buffer |= ((value & 0x7f) | 0x80); }
    while (true) { out.push(buffer & 0xff); if (buffer & 0x80) buffer >>= 8; else break; }
    return out;
  }
  function u16(v) { return [(v >> 8) & 255, v & 255]; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function ascii(s) { return [...s].map((c) => c.charCodeAt(0)); }
  function chunk(type, bytes) { return [...ascii(type), ...u32(bytes.length), ...bytes]; }

  function write(song) {
    const ppq = song.ppq || 480;
    const bpm = Number(song.bpm) || 120;
    const micro = Math.round(60000000 / bpm);
    const sig = song.timeSignature || { numerator: 4, denominator: 4 };
    const denomPow = Math.round(Math.log2(sig.denominator || 4));
    const metaEvents = [];
    (song.tempoMap?.length ? song.tempoMap : [{ tick: 0, microseconds: micro }]).forEach((tempo) => {
      const value = Math.round(tempo.microseconds || 60000000 / (tempo.bpm || bpm));
      metaEvents.push({ tick: Math.max(0, Math.round(tempo.tick || 0)), order: 0, bytes: [0xff, 0x51, 3, (value >> 16) & 255, (value >> 8) & 255, value & 255] });
    });
    (song.timeSignatureMap?.length ? song.timeSignatureMap : [{ tick: 0, ...sig }]).forEach((signature) => {
      metaEvents.push({ tick: Math.max(0, Math.round(signature.tick || 0)), order: 1, bytes: [0xff, 0x58, 4, signature.numerator || 4, Math.round(Math.log2(signature.denominator || 4)), 24, 8] });
    });
    metaEvents.sort((a, b) => a.tick - b.tick || a.order - b.order);
    let metaTick = 0, meta = [];
    metaEvents.forEach((event) => { meta.push(...vlq(event.tick - metaTick), ...event.bytes); metaTick = event.tick; });
    const declaredEndTick = song.keepTicks && Number.isFinite(song.endTick) ? song.endTick : 0;
    const metaEndTick = Math.max(metaTick, declaredEndTick);
    meta.push(...vlq(metaEndTick - metaTick), 0xff, 0x2f, 0);
    const trackChunks = [chunk("MTrk", meta)];
    const secondsToTicks = (seconds) => Math.max(0, Math.round(seconds * bpm * ppq / 60));
    const writableTracks = song.tracks.filter((track) => track.notes.length || track.channels?.length || track.programs?.length);
    writableTracks.forEach((track) => {
      const events = [];
      const channel = Number.isInteger(track.channel) ? track.channel : (track.channels && track.channels[0]) || 0;
      const nameBytes = new TextEncoder().encode(track.name || "Track");
      events.push({ tick: 0, order: 0, bytes: [0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes] });
      if (channel !== 9) events.push({ tick: 0, order: 1, bytes: [0xc0 | channel, track.program || 0] });
      track.notes.forEach((note) => {
        const start = Number.isFinite(note.startTick) && song.keepTicks ? note.startTick : secondsToTicks(note.startTime);
        const end = Number.isFinite(note.endTick) && song.keepTicks ? note.endTick : secondsToTicks(note.startTime + note.duration);
        events.push({ tick: start, order: 2, bytes: [0x90 | (note.channel ?? channel), note.noteNumber, note.velocity] });
        events.push({ tick: Math.max(start + 1, end), order: 1, bytes: [0x80 | (note.channel ?? channel), note.noteNumber, 0] });
      });
      events.sort((a, b) => a.tick - b.tick || a.order - b.order);
      let lastTick = 0, bytes = [];
      events.forEach((event) => { bytes.push(...vlq(event.tick - lastTick), ...event.bytes); lastTick = event.tick; });
      const trackEndTick = Math.max(lastTick, declaredEndTick || secondsToTicks(song.duration || 0));
      bytes.push(...vlq(trackEndTick - lastTick), 0xff, 0x2f, 0);
      trackChunks.push(chunk("MTrk", bytes));
    });
    const header = chunk("MThd", [...u16(1), ...u16(trackChunks.length), ...u16(ppq)]);
    return new Uint8Array([...header, ...trackChunks.flat()]).buffer;
  }

  function stepUnitToBeats(noteUnit) {
    const unit = Number(noteUnit) || 8;
    return 4 / unit;
  }

  function stepIndexToTime(stepIndex, bpm, noteUnit) {
    const musicalTime = Number(stepIndex) * stepUnitToBeats(noteUnit);
    return { musicalTime, seconds: musicalTime * 60 / (Number(bpm) || 120) };
  }

  function createStepSong(options) {
    const bpm = Number(options.bpm) || 120, steps = Number(options.steps) || 16;
    const stepBeats = stepUnitToBeats(options.noteUnit);
    const notes = [];
    options.grid.forEach((row, rowIndex) => row.forEach((on, step) => {
      if (!on) return;
      const { seconds: startTime } = stepIndexToTime(step, bpm, options.noteUnit);
      notes.push({ noteNumber: options.pitches[rowIndex], noteName: noteName(options.pitches[rowIndex]), channel: 0, startTime, duration: stepBeats * 60 / bpm * 0.9, velocity: Number(options.velocity) || 100 });
    }));
    return {
      title: options.title || "midi-lab-test-001", fileName: "（作成中）", format: 1, ppq: 480, bpm,
      timeSignature: { numerator: Number(options.numerator) || 4, denominator: Number(options.denominator) || 4 },
      tempoMap: [{ tick: 0, time: 0, bpm, microseconds: 60000000 / bpm }],
      timeSignatureMap: [{ tick: 0, numerator: Number(options.numerator) || 4, denominator: Number(options.denominator) || 4 }],
      duration: steps * stepBeats * 60 / bpm,
      totalNotes: notes.length,
      tracks: [{ id: 0, name: "Step Sequence", channel: 0, channels: [0], program: 0, programs: [0], instrumentName: GM_INSTRUMENTS[0], enabled: true, notes }]
    };
  }

  global.MidiCore = { parse, write, createStepSong, stepUnitToBeats, stepIndexToTime, noteName, GM_INSTRUMENTS };
})(window);
