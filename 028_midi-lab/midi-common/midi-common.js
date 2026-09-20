/* MidiCommon v0.1.0 read-only Standard MIDI File parser. Extracted from MIDI Lab. */
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
      let tick = 0, runningStatus = null, name = "", noteCount = 0, eventOrder = 0;
      const active = new Map(), notes = [], rawEvents = [], channels = new Set(), programs = new Set();
      while (r.pos < end) {
        tick += r.vlq();
        const order = eventOrder++;
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
          if (![0x2f, 0x51, 0x58].includes(type)) rawEvents.push({ type: type === 0x01 ? "text" : type === 0x02 ? "copyright" : type === 0x03 ? "trackName" : type === 0x05 ? "lyrics" : type === 0x06 ? "marker" : type === 0x07 ? "cuePoint" : "meta", tick, order, metaType: type, text: [0x01, 0x02, 0x03, 0x05, 0x06, 0x07].includes(type) ? decodeText(data) : undefined, data });
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { const len = r.vlq(), data = []; for (let i = 0; i < len; i++) data.push(r.u8()); rawEvents.push({ type: "sysEx", tick, order, status, data }); unsupportedEvents.sysex++; runningStatus = null; continue; }
        if (status >= 0xf0) throw new Error(`未対応のSystem Event: 0x${status.toString(16)}`);

        const kind = status >> 4, channel = status & 0x0f;
        channels.add(channel);
        const d1 = firstData === null ? r.u8() : firstData;
        const d2 = (kind === 0x0c || kind === 0x0d) ? null : r.u8();
        if (kind === 0x0b) rawEvents.push({ type: "controlChange", tick, order, channel, controller: d1, value: d2 });
        else if (kind === 0x0e) rawEvents.push({ type: "pitchBend", tick, order, channel, value: d1 | (d2 << 7) });
        else if (kind === 0x0a) rawEvents.push({ type: "polyAftertouch", tick, order, channel, noteNumber: d1, value: d2 });
        else if (kind === 0x0d) rawEvents.push({ type: "channelAftertouch", tick, order, channel, value: d1 });
        if (kind === 0x0c) { programs.add(d1); rawEvents.push({ type: "programChange", tick, order, channel, program: d1 }); }
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
      rawTracks.push({ id: ti, name: name || `Track ${ti + 1}`, channels: [...channels], programs: [...programs], notes, rawEvents, endTick: tick, noteCount });
    }

    const tempoMap = global.MidiCommonTiming.buildTempoMap(tempos, ppq);
    const timeSignatureMap = global.MidiCommonTiming.buildTimeSignatureMap(signatures, ppq);
    const timingSong = { ppq, tempoMap, timeSignatureMap };
    const tickToSeconds = (tick) => global.MidiCommonTiming.tickToSeconds(timingSong, tick);

    const tracks = rawTracks.map((track, index) => {
      const channel = track.channels.length === 1 ? track.channels[0] : (track.channels.length ? track.channels.join(", ") : "—");
      const program = track.programs.length ? track.programs[0] : 0;
      const drum = track.channels.includes(9);
      return {
        id: track.id, index, name: track.name, channel, channels: track.channels, program,
        programs: track.programs, instrumentName: drum ? "Drum Kit" : (GM_INSTRUMENTS[program] || "Unknown"), rawEvents: track.rawEvents, endTick: track.endTick,
        notes: track.notes.map((n) => ({
          noteNumber: n.noteNumber, noteName: noteName(n.noteNumber), channel: n.channel,
          startTick: n.tick, endTick: n.endTick, durationTicks: n.durationTicks, startTime: tickToSeconds(n.tick), endTime: tickToSeconds(n.endTick),
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

  const VERSION = "0.1.0";
  function publicParse(arrayBuffer, options = {}) {
    const fileName = typeof options === "string" ? options : options?.fileName;
    return parse(arrayBuffer, fileName);
  }
  function getTracks(song) { return Array.isArray(song?.tracks) ? song.tracks : []; }
  function getTrack(song, trackId) { return getTracks(song).find((track) => track.id === trackId); }
  function getNotes(song, trackId) {
    if (trackId === undefined || trackId === null) return getTracks(song).flatMap((track) => track.notes || []);
    return getTrack(song, trackId)?.notes || [];
  }

  global.MidiCommon = {
    VERSION,
    parse: publicParse,
    getTracks,
    getTrack,
    getNotes,
    noteName,
    tickToSeconds: (song, tick) => global.MidiCommonTiming.tickToSeconds(song, tick),
    secondsToTick: (song, seconds) => global.MidiCommonTiming.secondsToTick(song, seconds),
    tickToBarBeat: (song, tick) => global.MidiCommonTiming.tickToBarBeat(song, tick),
    barBeatToTick: (song, bar, beat, fraction) => global.MidiCommonTiming.barBeatToTick(song, bar, beat, fraction)
  };
})(window);