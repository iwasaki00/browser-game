/* MidiCommon v0.1.0 timing utilities. Extracted from the verified MIDI Lab timing implementation. */
(function (global) {
  "use strict";

  const DEFAULT_BPM = 120;
  const DEFAULT_SIGNATURE = { numerator: 4, denominator: 4 };

  function dedupeByTick(events) {
    const byTick = new Map();
    events.sort((a, b) => a.tick - b.tick).forEach((event) => byTick.set(event.tick, event));
    return [...byTick.values()].sort((a, b) => a.tick - b.tick);
  }

  function buildTempoMap(events, ppq, defaultBpm = DEFAULT_BPM) {
    const source = (events || []).map((event) => {
      const microsecondsPerQuarter = Number(event.microsecondsPerQuarter ?? event.microseconds) || 60000000 / (Number(event.bpm) || defaultBpm);
      return { tick: Math.max(0, Number(event.tick) || 0), bpm: 60000000 / microsecondsPerQuarter, microsecondsPerQuarter, microseconds: microsecondsPerQuarter };
    });
    if (!source.some((event) => event.tick === 0)) source.push({ tick: 0, bpm: defaultBpm, microsecondsPerQuarter: 60000000 / defaultBpm, microseconds: 60000000 / defaultBpm });
    const map = dedupeByTick(source);
    let elapsed = 0;
    map.forEach((event, index) => {
      if (index) elapsed += (event.tick - map[index - 1].tick) * map[index - 1].microsecondsPerQuarter / 1000000 / ppq;
      event.time = elapsed;
    });
    return map;
  }

  function ticksPerBeat(ppq, signature) { return Number(ppq) * 4 / Number(signature.denominator); }
  function ticksPerBar(ppq, signature) { return ticksPerBeat(ppq, signature) * Number(signature.numerator); }

  function buildTimeSignatureMap(events, ppq, defaultSignature = DEFAULT_SIGNATURE) {
    const source = (events || []).map((event) => ({ tick: Math.max(0, Number(event.tick) || 0), numerator: Math.max(1, Number(event.numerator) || defaultSignature.numerator), denominator: Math.max(1, Number(event.denominator) || defaultSignature.denominator) }));
    if (!source.some((event) => event.tick === 0)) source.push({ tick: 0, ...defaultSignature });
    const map = dedupeByTick(source); map[0].bar = 1;
    for (let index = 1; index < map.length; index++) {
      const previous = map[index - 1], coveredTicks = map[index].tick - previous.tick;
      map[index].bar = previous.bar + Math.ceil(coveredTicks / ticksPerBar(ppq, previous));
    }
    return map;
  }

  function timing(song) {
    const ppq = Number(song?.ppq) || 480;
    return { ppq, tempoMap: buildTempoMap(song?.tempoMap, ppq, Number(song?.bpm) || DEFAULT_BPM), signatureMap: buildTimeSignatureMap(song?.timeSignatureMap, ppq, song?.timeSignature || DEFAULT_SIGNATURE) };
  }

  function tempoAtTick(song, tick) { const context = timing(song); let current = context.tempoMap[0]; for (let index = 1; index < context.tempoMap.length && context.tempoMap[index].tick <= tick; index++) current = context.tempoMap[index]; return current; }
  function signatureAtTick(song, tick) { const context = timing(song); let current = context.signatureMap[0]; for (let index = 1; index < context.signatureMap.length && context.signatureMap[index].tick <= tick; index++) current = context.signatureMap[index]; return current; }

  function tickToSeconds(song, tick) {
    const context = timing(song), target = Math.max(0, Number(tick) || 0); let tempo = context.tempoMap[0];
    for (let index = 1; index < context.tempoMap.length && context.tempoMap[index].tick <= target; index++) tempo = context.tempoMap[index];
    return tempo.time + (target - tempo.tick) * tempo.microsecondsPerQuarter / 1000000 / context.ppq;
  }

  function secondsToTick(song, seconds) {
    const context = timing(song), target = Math.max(0, Number(seconds) || 0); let tempo = context.tempoMap[0];
    for (let index = 1; index < context.tempoMap.length && context.tempoMap[index].time <= target; index++) tempo = context.tempoMap[index];
    return tempo.tick + (target - tempo.time) * 1000000 * context.ppq / tempo.microsecondsPerQuarter;
  }

  function tickToBarBeat(song, tick) {
    const context = timing(song), target = Math.max(0, Number(tick) || 0); let signature = context.signatureMap[0];
    for (let index = 1; index < context.signatureMap.length && context.signatureMap[index].tick <= target; index++) signature = context.signatureMap[index];
    const beatTicks = ticksPerBeat(context.ppq, signature), barLength = beatTicks * signature.numerator;
    const localTick = target - signature.tick, barOffset = Math.floor(localTick / barLength), tickInBar = localTick - barOffset * barLength, beatOffset = Math.floor(tickInBar / beatTicks);
    return { bar: signature.bar + barOffset, beat: beatOffset + 1, beatFraction: (tickInBar - beatOffset * beatTicks) / beatTicks, numerator: signature.numerator, denominator: signature.denominator };
  }

  function barBeatToTick(song, bar, beat = 1, fraction = 0) {
    const context = timing(song), targetBar = Math.max(1, Number(bar) || 1); let signature = context.signatureMap[0];
    for (let index = 1; index < context.signatureMap.length && context.signatureMap[index].bar <= targetBar; index++) signature = context.signatureMap[index];
    const beatTicks = ticksPerBeat(context.ppq, signature), barLength = beatTicks * signature.numerator;
    return signature.tick + (targetBar - signature.bar) * barLength + (Math.max(1, Number(beat) || 1) - 1 + Math.max(0, Number(fraction) || 0)) * beatTicks;
  }

  function totalBars(song, endTick = song?.endTick || 0) { return Math.max(1, tickToBarBeat(song, Math.max(0, Number(endTick) - 1)).bar); }

  global.MidiCommonTiming = { buildTempoMap, buildTimeSignatureMap, timing, tempoAtTick, signatureAtTick, tickToSeconds, secondsToTick, tickToBarBeat, barBeatToTick, ticksPerBeat, ticksPerBar, totalBars };
})(window);
