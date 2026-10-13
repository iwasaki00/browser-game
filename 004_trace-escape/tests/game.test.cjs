const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the shipped inline logic without adding test hooks to the game.
function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', style: {}, clientWidth: 376, clientHeight: 556,
      classList: { add() {}, remove() {} }, addEventListener() {},
      getContext: () => ({}), hasPointerCapture: () => false,
      releasePointerCapture() {}, setPointerCapture() {},
      getBoundingClientRect: () => ({left: 20, top: 30, width: 180, height: 270})
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    document: { getElementById: element, querySelector: element },
    ResizeObserver: class { observe() {} }, requestAnimationFrame() {}
  });
  vm.runInContext(script.replace(/\}\)\(\);\s*$/, 
    'globalThis.game = { hasReachedGoal, update, resetGame, getCanvasPoint, beginStroke, extendStroke, endStroke, getGroundY, get state() { return state; }, setSegments(value) { segments = value; }, get stroke() { return currentStroke; }, get length() { return currentStrokeLength; } }; })();'), context);
  return {game: context.game, elements};
}
const standing = { x: 302, y: 406, radius: 14, vy: 0, grounded: true };

test('goal accepts a supported character touching the flag', () => {
  const {game} = loadGame();
  assert.equal(game.hasReachedGoal(standing, 420), true);
  assert.equal(game.hasReachedGoal({...standing, y: 386}, 400), true);
});
test('goal rejects airborne and falling characters even at goal X', () => {
  const {game} = loadGame();
  for (const player of [
    {...standing, grounded: false}, {...standing, vy: 90},
    {...standing, y: 500, grounded: false, vy: 900}
  ]) assert.equal(game.hasReachedGoal(player, 420), false);
});
test('goal requires current support, matching feet and flag position', () => {
  const {game} = loadGame();
  assert.equal(game.hasReachedGoal(standing, null), false);
  assert.equal(game.hasReachedGoal(standing, 410), false);
  assert.equal(game.hasReachedGoal({...standing, x: 301}, 420), false);
  assert.equal(game.hasReachedGoal({...standing, x: 351}, 420), false);
  assert.equal(game.hasReachedGoal({...standing, y: 280}, 294), false);
  assert.equal(game.hasReachedGoal({...standing, y: 450}, 464), false);
});
test('normal bridge clears with the original movement and collision logic', () => {
  for (const bridgeY of [420, 410]) {
    const {game} = loadGame();
    game.setSegments([
      {a: {x: 122, y: 420}, b: {x: 187, y: bridgeY}},
      {a: {x: 187, y: bridgeY}, b: {x: 252, y: 420}}
    ]);
    for (let i = 0; i < 200 && !game.state.cleared; i++) game.update(0.02);
    assert.equal(game.state.cleared, true);
    assert.equal(game.state.player.grounded, true);
  }
});
test('falling at goal X does not clear through updatePlayer', () => {
  const {game} = loadGame();
  Object.assign(game.state.player, {x: 304, y: 470, vy: 400});
  game.update(0.02);
  assert.equal(game.state.cleared, false);
  assert.equal(game.state.player.grounded, false);
});
test('missing bridge falls and automatically retries', () => {
  const {game, elements} = loadGame();
  for (let i = 0; i < 200 && !game.state.failed; i++) game.update(0.02);
  assert.equal(game.state.failed, true);
  assert.equal(game.state.cleared, false);
  assert.match(elements.get('statusText').textContent, /落下/);
  game.update(0.46);
  assert.equal(game.state.failed, false);
  assert.equal(game.state.player.x, 40);
});
