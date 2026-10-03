(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DiceCellState = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STATES = Object.freeze({
    REAL: "REAL_DICE",
    DUMMY: "DUMMY_DICE",
    REST: "REST_BEAT",
    EMPTY: "EMPTY_SLOT",
    COUNT_IN: "COUNT_IN_SLOT"
  });
  const VALUES = Object.freeze({ COUNT_IN: -2, DUMMY: -1, REST: 0, EMPTY: null });

  function stateForValue(value) {
    if (value === VALUES.COUNT_IN) return STATES.COUNT_IN;
    if (value === VALUES.DUMMY) return STATES.DUMMY;
    if (value === VALUES.REST) return STATES.REST;
    if (value === VALUES.EMPTY || value === undefined) return STATES.EMPTY;
    return STATES.REAL;
  }

  function classify(cell) {
    const objectCell = cell && typeof cell === "object" && !Array.isArray(cell) ? cell : null;
    const value = objectCell ? objectCell.value : cell;
    const state = objectCell?.state || stateForValue(value);
    const playValue = state === STATES.DUMMY ? 1 : state === STATES.REAL ? Number(value) || 0 : 0;
    return {
      state,
      value,
      playValue,
      inputTarget: state === STATES.REAL || state === STATES.DUMMY,
      label: state === STATES.REST ? "REST" : state === STATES.EMPTY ? "END" : state === STATES.COUNT_IN ? "COUNT" : state === STATES.DUMMY ? "D" : String(playValue),
      className: state.toLowerCase().replaceAll("_", "-"),
      sourcePattern: objectCell?.sourcePattern ?? (state === STATES.REST ? "REST" : state === STATES.EMPTY ? "EMPTY" : state === STATES.COUNT_IN ? "COUNT_IN" : state === STATES.DUMMY ? "OTHER" : "NORMAL"),
      isQuantized: Boolean(objectCell?.isQuantized),
      isDummy: state === STATES.DUMMY,
      measure: objectCell?.measure ?? null,
      beat: objectCell?.beat ?? null,
      gameRowIndex: objectCell?.gameRowIndex ?? null,
      slotIndex: objectCell?.slotIndex ?? null
    };
  }

  function countInCell(slotIndex) {
    return { value: VALUES.COUNT_IN, state: STATES.COUNT_IN, slotIndex, sourcePattern: "COUNT_IN" };
  }

  function fromGameBeat(beat, gameRowIndex, slotIndex) {
    if (!beat) return { value: VALUES.EMPTY, state: STATES.EMPTY, gameRowIndex, slotIndex, sourcePattern: "EMPTY" };
    const state = beat.isDummy ? STATES.DUMMY : beat.isRest || beat.isFallback ? STATES.REST : STATES.REAL;
    const value = state === STATES.DUMMY ? VALUES.DUMMY : state === STATES.REST ? VALUES.REST : beat.playDice;
    return {
      value, state, gameRowIndex, slotIndex,
      sourcePattern: beat.sourcePattern,
      playDice: beat.playDice,
      isQuantized: Boolean(beat.isQuantized),
      isDummy: Boolean(beat.isDummy),
      measure: beat.measure,
      beat: beat.beat
    };
  }

  return Object.freeze({ STATES, VALUES, stateForValue, classify, countInCell, fromGameBeat });
});