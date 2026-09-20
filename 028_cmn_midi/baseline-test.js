const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { FIXTURES, buildBaselines } = require("./generate-baseline.js");

const baselineDirectory = path.join(__dirname, "baseline");
const current = buildBaselines();
const checked = [];

for (const [name, actual] of Object.entries(current)) {
  const file = path.join(baselineDirectory, name);
  assert(fs.existsSync(file), `Missing baseline: ${name}`);
  const expected = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepStrictEqual(actual, expected, `Baseline changed: ${name}`);
  checked.push(name);
}

const songdata = current["songdata-baseline.json"];
for (const fixture of FIXTURES) {
  assert(songdata[fixture], `Missing fixture baseline: ${fixture}`);
  assert(songdata[fixture].written.sha256, `Missing writer hash: ${fixture}`);
  assert.deepStrictEqual(songdata[fixture].reparsed.tempoMap, songdata[fixture].parsed.tempoMap, `Tempo map changed after round-trip: ${fixture}`);
  assert.deepStrictEqual(songdata[fixture].reparsed.timeSignatureMap, songdata[fixture].parsed.timeSignatureMap, `Time signature map changed after round-trip: ${fixture}`);
}

const sample = current["songdata-sample.json"];
assert.strictEqual(sample.keepTicks, true, "SongData sample must record keepTicks");
assert(sample.tracks.every((track) => Object.prototype.hasOwnProperty.call(track, "enabled")), "SongData sample must record track.enabled");
const temporaryFields = current["edit-baseline.json"].temporaryNoteFields;
for (const field of ["_sourceId", "_gridTick", "_editStep", "_durationTicks"]) assert(temporaryFields.includes(field), `Missing temporary field baseline: ${field}`);

console.log(JSON.stringify({ baselineFiles: checked.length, fixtures: FIXTURES.length, fixtureNames: FIXTURES, temporaryFields }));
