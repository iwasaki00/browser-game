global.window = global;
const fs = require("fs");
const path = require("path");
eval(fs.readFileSync(path.join(__dirname, "midi-timing.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "midi-core.js"), "utf8"));

const textData = (text) => Array.from(new TextEncoder().encode(text));
function createEventSong() {
  const ppq = 480, endTick = 5760;
  const song = { title: "event-preservation-test", fileName: "event-preservation-test.mid", format: 1, ppq, bpm: 120, timeSignature: { numerator: 4, denominator: 4 }, tempoMap: MidiTiming.buildTempoMap([{ tick: 0, bpm: 120 }], ppq), timeSignatureMap: MidiTiming.buildTimeSignatureMap([{ tick: 0, numerator: 4, denominator: 4 }], ppq), keepTicks: true, endTick };
  const notes = [0, 960, 1920, 2880, 3840].map((startTick, index) => ({ noteNumber: 60 + index, noteName: MidiCore.noteName(60 + index), channel: 0, startTick, endTick: startTick + 360, durationTicks: 360, velocity: 90 }));
  notes.forEach((note) => { note.startTime = MidiTiming.tickToSeconds(song, note.startTick); note.duration = MidiTiming.tickToSeconds(song, note.endTick) - note.startTime; });
  const rawEvents = [
    { type: "trackName", metaType: 0x03, tick: 0, order: 0, text: "Event Track", data: textData("Event Track") },
    { type: "copyright", metaType: 0x02, tick: 0, order: 1, text: "MIDI Lab", data: textData("MIDI Lab") },
    { type: "programChange", tick: 0, order: 2, channel: 0, program: 0 },
    { type: "controlChange", tick: 120, order: 3, channel: 0, controller: 7, value: 100 },
    { type: "controlChange", tick: 240, order: 4, channel: 0, controller: 10, value: 32 },
    { type: "controlChange", tick: 360, order: 5, channel: 0, controller: 11, value: 96 },
    { type: "controlChange", tick: 480, order: 6, channel: 0, controller: 1, value: 45 },
    { type: "controlChange", tick: 1000, order: 7, channel: 0, controller: 64, value: 127 },
    { type: "controlChange", tick: 3000, order: 8, channel: 0, controller: 64, value: 0 },
    { type: "pitchBend", tick: 720, order: 9, channel: 0, value: 8192 },
    { type: "pitchBend", tick: 1440, order: 10, channel: 0, value: 12288 },
    { type: "pitchBend", tick: 2160, order: 11, channel: 0, value: 4096 },
    { type: "polyAftertouch", tick: 1500, order: 12, channel: 0, noteNumber: 64, value: 70 },
    { type: "channelAftertouch", tick: 1560, order: 13, channel: 0, value: 65 },
    { type: "programChange", tick: 1920, order: 14, channel: 0, program: 48 },
    { type: "programChange", tick: 3840, order: 15, channel: 0, program: 61 },
    { type: "text", metaType: 0x01, tick: 100, order: 16, text: "Intro", data: textData("Intro") },
    { type: "lyrics", metaType: 0x05, tick: 960, order: 17, text: "Hello", data: textData("Hello") },
    { type: "lyrics", metaType: 0x05, tick: 1920, order: 18, text: "World", data: textData("World") },
    { type: "marker", metaType: 0x06, tick: 2880, order: 19, text: "Verse", data: textData("Verse") },
    { type: "cuePoint", metaType: 0x07, tick: 3840, order: 20, text: "Cue", data: textData("Cue") },
    { type: "meta", metaType: 0x7f, tick: 4000, order: 21, data: [1, 2, 3] },
    { type: "sysEx", tick: 4200, order: 22, status: 0xf0, data: [0x7d, 1, 2, 0xf7] }
  ];
  song.tracks = [{ id: 0, name: "Event Track", channel: 0, channels: [0], program: 0, programs: [0, 48, 61], instrumentName: "Acoustic Grand Piano", enabled: true, notes, rawEvents, endTick }];
  song.totalNotes = notes.length; song.duration = MidiTiming.tickToSeconds(song, endTick); return song;
}

if (require.main === module) {
  const output = path.join(__dirname, "test-data", "event-preservation-test.mid"); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, Buffer.from(MidiCore.write(createEventSong()))); console.log(JSON.stringify({ output }));
}
module.exports = { createEventSong };
