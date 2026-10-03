"use strict";

const Cell = require("./dice-cell-state.js");
const MidiGameChart = require("./midi-game-chart.js");
let assertions = 0;
function check(value, message) { assertions += 1; if (!value) throw new Error(message); }

const rest = Cell.classify(0);
const empty = Cell.classify(null);
const dummy = Cell.classify(-1);
const realOne = Cell.classify(1);
const countIn = Cell.classify(-2);
check(rest.state === "REST_BEAT" && rest.label === "REST" && rest.state !== empty.state, "1. REST state differs from EMPTY");
check(empty.state === "EMPTY_SLOT" && empty.label === "END" && empty.className !== rest.className, "2. EMPTY state differs from REST");
check(dummy.state === "DUMMY_DICE" && dummy.label === "D" && dummy.className !== realOne.className, "3. DUMMY differs from REAL Dice 1");
check(countIn.state === "COUNT_IN_SLOT" && countIn.label === "COUNT" && countIn.state !== empty.state, "4. COUNT IN differs from EMPTY");
check(Array.from({ length: 4 }, () => Cell.classify(0)).every((cell) => cell.label === "REST"), "5. all-REST row is never blank");
const partial = [Cell.fromGameBeat({ playDice: 1, sourcePattern: "SINGLE", measure: 1, beat: 1 }, 0, 0), Cell.fromGameBeat(null, 0, 1)];
check(Cell.classify(partial[1]).state === "EMPTY_SLOT" && Cell.classify(partial[1]).label === "END", "6. missing final slots become EMPTY");
check(!rest.inputTarget && rest.playValue === 0 && !MidiGameChart.judgeRest(0).miss, "7. REST remains a no-input target");
check(!empty.inputTarget && empty.playValue === 0, "8. EMPTY remains outside input judgment");
check(dummy.inputTarget && MidiGameChart.judgeDummy(1, false).assist, "9. DUMMY remains ASSIST");
check(realOne.inputTarget && realOne.playValue === 1 && Cell.classify(4).playValue === 4, "10. REAL Dice values and judgment inputs are unchanged");
console.log(JSON.stringify({ tests: 10, assertions, result: "PASS" }));