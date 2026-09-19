global.window = global;
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/synth.js", "utf8"));

global.setInterval = () => 1;
global.clearInterval = () => {};

const context = { currentTime: 0 };
const scheduled = [];
const synth = {
  context,
  ensureContext: async () => context,
  schedule: (note, when, duration) => scheduled.push({ noteNumber: note.noteNumber, when, duration }),
  stopAll: () => {}
};
const track = { id: "live", enabled: true };
let notes = [{ stepIndex: 0, noteNumber: 60, channel: 0, startTime: 0, duration: 0.09, velocity: 100 }];
const snapshot = () => ({ duration: 0.8, events: notes.map((note) => ({ track, note })) });
const player = new MidiAudio.AudioClockPlayer(synth);
player.setSong({ duration: 0.8, totalNotes: 1, tracks: [{ ...track, notes }] });
player.setLoop(true);
player.setLiveEventProvider(snapshot);

(async () => {
  await player.play();
  const initialCount = scheduled.length;

  context.currentTime = 0.2;
  notes = [...notes, { stepIndex: 3, noteNumber: 64, channel: 0, startTime: 0.3, duration: 0.09, velocity: 100 }];
  player.schedule();
  const futureAdded = scheduled.some((event) => event.noteNumber === 64 && Math.abs(event.when - 0.3) < 0.0001);
  const afterFutureCount = scheduled.length;
  player.schedule();
  const noDuplicate = scheduled.length === afterFutureCount;

  notes = [...notes, { stepIndex: 1, noteNumber: 62, channel: 0, startTime: 0.1, duration: 0.09, velocity: 100 }];
  player.schedule();
  const pastNotCurrentLoop = !scheduled.some((event) => event.noteNumber === 62);

  notes = [...notes, { stepIndex: 6, noteNumber: 65, channel: 0, startTime: 0.6, duration: 0.09, velocity: 100 }];
  context.currentTime = 0.4;
  player.schedule();
  notes = notes.filter((note) => note.noteNumber !== 65);
  context.currentTime = 0.5;
  player.schedule();
  const futureDeleted = !scheduled.some((event) => event.noteNumber === 65);

  notes = notes.concat([
    { stepIndex: 7, noteNumber: 60, channel: 0, startTime: 0.7, duration: 0.09, velocity: 100 },
    { stepIndex: 7, noteNumber: 64, channel: 0, startTime: 0.7, duration: 0.09, velocity: 100 },
    { stepIndex: 7, noteNumber: 67, channel: 0, startTime: 0.7, duration: 0.09, velocity: 100 }
  ]);
  context.currentTime = 0.6;
  player.schedule();
  const chord = scheduled.filter((event) => Math.abs(event.when - 0.7) < 0.0001).map((event) => event.noteNumber).sort((a, b) => a - b);

  context.currentTime = 0.79;
  player.schedule();
  const boundaryCount = scheduled.filter((event) => event.noteNumber === 60 && Math.abs(event.when - 0.8) < 0.0001).length;
  context.currentTime = 0.99;
  player.schedule();
  const pastNextLoop = scheduled.some((event) => event.noteNumber === 62 && Math.abs(event.when - 0.9) < 0.0001);

  const assertions = [
    [initialCount === 1, "initial"],
    [futureAdded, "future addition"],
    [noDuplicate, "duplicate prevention"],
    [pastNotCurrentLoop, "past addition waits"],
    [futureDeleted, "future deletion"],
    [chord.join(",") === "60,64,67", "chord"],
    [boundaryCount === 1, "loop boundary"],
    [pastNextLoop, "past addition next loop"]
  ];
  const failed = assertions.filter(([ok]) => !ok).map(([, name]) => name);
  if (failed.length) throw new Error(`Live scheduler failed: ${failed.join(", ")}`);
  player.stop();
  console.log(JSON.stringify({ scheduled: scheduled.length, futureAdded, futureDeleted, chord, boundaryCount, pastNextLoop }));
})().catch((error) => { console.error(error); process.exit(1); });
