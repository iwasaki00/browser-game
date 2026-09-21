(function () {
  "use strict";

  const PHASES = Object.freeze([
    Object.freeze({ name: "Q + O", keys: Object.freeze(["q", "o"]), min: 200, max: 450, normal: 220, slow: 400 }),
    Object.freeze({ name: "Q", keys: Object.freeze(["q"]), min: 100, max: 350, normal: 160, slow: 280 }),
    Object.freeze({ name: "W + P", keys: Object.freeze(["w", "p"]), min: 200, max: 450, normal: 220, slow: 400 }),
    Object.freeze({ name: "W", keys: Object.freeze(["w"]), min: 100, max: 350, normal: 160, slow: 280 })
  ]);

  function classifyInput(expectedKeys, pressedKeys) {
    const expected = new Set(expectedKeys);
    const pressed = new Set(pressedKeys);
    if (expected.size === pressed.size && [...expected].every(key => pressed.has(key))) return "GOOD";
    if ([...pressed].some(key => expected.has(key)) || [...expected].every(key => pressed.has(key))) return "OK";
    return "MISS";
  }

  function pressedKeys(inputState) {
    return Object.keys(inputState).filter(key => inputState[key]);
  }

  window.QWOPTraining = { PHASES, classifyInput, pressedKeys };
})();
