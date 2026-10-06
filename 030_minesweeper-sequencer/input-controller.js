(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MinesweeperInput = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const ACTIONS = { OPEN: "OPEN", TOGGLE_FLAG: "TOGGLE_FLAG", WAIT_FOR_DOUBLE: "WAIT_FOR_DOUBLE", NONE: "NONE" };
  function tapAction(mode, state = {}) {
    if (state.pointerType === "mouse") return ACTIONS.OPEN;
    if (mode === "SWITCH") return state.switchAction === "FLAG" ? ACTIONS.TOGGLE_FLAG : ACTIONS.OPEN;
    if (mode === "TWO HAND") return state.modifier === "FLAG" ? ACTIONS.TOGGLE_FLAG : ACTIONS.OPEN;
    if (mode === "DOUBLE TAP") return ACTIONS.WAIT_FOR_DOUBLE;
    return ACTIONS.OPEN;
  }
  function doubleTapAction(mode) { return mode === "DOUBLE TAP" ? ACTIONS.TOGGLE_FLAG : ACTIONS.NONE; }
  function longPressAction(mode) { return mode === "STANDARD" ? ACTIONS.TOGGLE_FLAG : ACTIONS.NONE; }
  return { ACTIONS, tapAction, doubleTapAction, longPressAction };
});
