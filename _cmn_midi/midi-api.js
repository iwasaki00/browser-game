/* Compatibility facade for the current MIDI Lab modules. */
(function (global) {
  "use strict";

  function requireModule(name) {
    const value = global[name];
    if (!value) throw new Error(`${name} is not loaded.`);
    return value;
  }

  const timing = {
    tickToSeconds: (song, tick) => requireModule("MidiTiming").tickToSeconds(song, tick),
    secondsToTick: (song, seconds) => requireModule("MidiTiming").secondsToTick(song, seconds),
    tickToBarBeat: (song, tick) => requireModule("MidiTiming").tickToBarBeat(song, tick),
    barBeatToTick: (song, bar, beat, fraction) => requireModule("MidiTiming").barBeatToTick(song, bar, beat, fraction)
  };

  const editor = {
    createWorkspace: (song) => requireModule("MidiEdit").createWorkspace(song),
    createSession: (workspace, trackIndex, noteUnit, sectionBars) => requireModule("MidiEdit").createSession(workspace, trackIndex, noteUnit, sectionBars),
    workspaceStates: (workspace) => requireModule("MidiEdit").workspaceStates(workspace)
  };

  const transport = {
    create: (synth, onStateChange) => new (requireModule("MidiAudio").AudioClockPlayer)(synth, onStateChange)
  };

  global.MidiApi = {
    parse(arrayBuffer, options = {}) {
      const fileName = typeof options === "string" ? options : options?.fileName;
      return requireModule("MidiCore").parse(arrayBuffer, fileName);
    },
    write: (song) => requireModule("MidiCore").write(song),
    timing,
    editor,
    transport
  };
})(window);
