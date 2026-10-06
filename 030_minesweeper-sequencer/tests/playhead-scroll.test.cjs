const test = require("node:test");
const assert = require("node:assert/strict");
const Scroll = require("../playhead-scroll.js");

const base = {
  followEnabled: true,
  followSuspended: false,
  scrollLeft: 0,
  clientWidth: 360,
  scrollWidth: 680,
  stepLeft: 210,
  stepWidth: 36,
  leadingInset: 46,
  margin: 2
};

test("FOLLOW OFF and suspended interaction never request scrolling", () => {
  assert.equal(Scroll.getFollowScrollLeft({ ...base, followEnabled: false }), null);
  assert.equal(Scroll.getFollowScrollLeft({ ...base, followSuspended: true }), null);
});

test("a fully visible step does not request scrolling", () => {
  assert.equal(Scroll.isStepVisible(base), true);
  assert.equal(Scroll.getFollowScrollLeft(base), null);
});

test("a clipped right step requests only enough rightward movement", () => {
  const options = { ...base, stepLeft: 430 };
  assert.equal(Scroll.isStepVisible(options), false);
  assert.equal(Scroll.getFollowScrollLeft(options), 108);
});

test("a clipped left step requests only enough leftward movement", () => {
  const options = { ...base, scrollLeft: 220, stepLeft: 190 };
  assert.equal(Scroll.isStepVisible(options), false);
  assert.equal(Scroll.getFollowScrollLeft(options), 142);
});

test("requested scrolling is clamped to the viewport range", () => {
  assert.equal(Scroll.getFollowScrollLeft({ ...base, scrollLeft: 200, stepLeft: -50 }), 0);
  assert.equal(Scroll.getFollowScrollLeft({ ...base, stepLeft: 900 }), 320);
});

test("STEP 1 already visible at the left edge does not move on PLAY", () => {
  const options = { ...base, stepLeft: 50, leadingInset: 46, margin: 2 };
  assert.equal(Scroll.isStepVisible(options), true);
  assert.equal(Scroll.getFollowScrollLeft(options), null);
});
