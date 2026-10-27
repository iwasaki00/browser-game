import test from "node:test";
import assert from "node:assert/strict";
import { createGame, createInitialState, SAVE_KEY } from "../js/game-state.js";
import { createTurnTracker, TURN_ANGLE } from "../js/handle.js";
import { ITEMS, MACHINE, FIRST_COLLECTION_BONUS } from "../js/data.js";
import { createToyAudio } from "../js/audio.js";

function setup(raw, rng = () => .45) {
  const data = new Map(raw ? [[SAVE_KEY, JSON.stringify(raw)]] : []);
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const game = createGame({ storage, rng, now: () => 1000 });
  game.load();
  return { game, storage };
}

test("ハンドルは境界をまたぐ時計回り240度で一度だけ完了する", () => {
  const turn = createTurnTracker();
  assert.equal(turn.begin(1, 150), true);
  const moves = [180, -150, -120, -90, -60, -30, 0, 30].map((angle) => turn.move(1, angle));
  assert.equal(moves.filter((move) => move.complete).length, 1);
  assert.equal(moves.at(-1).progress, TURN_ANGLE);
  assert.equal(turn.move(1, 60), null);
  assert.equal(turn.end(1).complete, true);
});

test("ハンドルは逆回転・途中離脱・キャンセルで確定しない", () => {
  const turn = createTurnTracker();
  turn.begin(1, 0);
  assert.equal(turn.move(1, -30).progress, 0);
  turn.move(1, 0); turn.move(1, 30);
  assert.equal(turn.end(1).complete, false);
  turn.begin(2, 0); turn.move(2, 60); turn.cancel();
  assert.equal(turn.active, false);
  assert.equal(turn.move(2, 90), null);
  turn.begin(3, 0);
  assert.equal(turn.move(3, 120).progress, 0);
});

test("別の指が回転に割り込めず、段階音のタイミングを返す", () => {
  const turn = createTurnTracker();
  turn.begin(1, 0);
  assert.equal(turn.begin(2, 90), false);
  assert.equal(turn.move(2, 120), null);
  assert.equal(turn.end(2), null);
  assert.equal(turn.move(1, 10).tick, false);
  assert.equal(turn.move(1, 20).tick, true);
});

test("抽選確定時に料金・入手品・未表示結果を同時保存し連打を拒否する", () => {
  const { game, storage } = setup();
  const result = game.beginDraw();
  assert.equal(result.ok, true);
  const saved = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(saved.coins, 1000 - MACHINE.cost + FIRST_COLLECTION_BONUS);
  assert.equal(saved.inventory.length, 1);
  assert.equal(saved.pendingDraw.uid, result.owned.uid);
  assert.equal(saved.pendingDraw.revealed, false);
  assert.deepEqual(game.beginDraw(), { ok: false, reason: "pending" });
  assert.deepEqual(game.draw(), { ok: false, reason: "pending" });
  assert.equal(game.getState().stats.draws, 1);
});

test("排出途中の再読み込みで同じ未開封結果を復元し再課金しない", () => {
  const { game, storage } = setup();
  game.beginDraw();
  const before = game.getState();
  const restored = createGame({ storage, rng: () => .99 });
  restored.load();
  assert.deepEqual(restored.getState().pendingDraw, before.pendingDraw);
  assert.equal(restored.getState().coins, before.coins);
  assert.deepEqual(restored.getState().inventory, before.inventory);
  assert.equal(restored.beginDraw().reason, "pending");
  assert.equal(restored.revealPendingDraw(), true);
  assert.equal(restored.revealPendingDraw(), false);
  restored.load();
  assert.equal(restored.getState().pendingDraw.revealed, true);
});

test("10回連続で開封・投稿・売却しても二重獲得せず図鑑と履歴が整合する", () => {
  const { game } = setup();
  const ids = new Set();
  for (let index = 0; index < 10; index++) {
    const result = game.beginDraw();
    assert.equal(result.ok, true);
    ids.add(result.owned.uid);
    assert.equal(result.isNew, index === 0);
    game.revealPendingDraw();
    assert.equal(game.postItem(result.owned.uid).ok, true);
    assert.equal(game.postItem(result.owned.uid).reason, "duplicate");
    assert.equal(game.quickSell(result.owned.uid).ok, true);
    assert.equal(game.quickSell(result.owned.uid).reason, "missing");
    game.finishPendingDraw();
  }
  const state = game.getState();
  assert.equal(ids.size, 10);
  assert.equal(state.stats.draws, 10);
  assert.equal(state.posts.length, 10);
  assert.equal(state.inventory.length, 0);
  assert.equal(game.collectionCount(), 0);
  assert.deepEqual(state.discovered, [ITEMS[3].id]);
  assert.equal(state.coins, 1000 + FIRST_COLLECTION_BONUS + (ITEMS[3].value - MACHINE.cost) * 10);
});

test("資金不足では未表示結果も料金変動も発生しない", () => {
  const raw = createInitialState(); raw.coins = MACHINE.cost - 1;
  const { game } = setup(raw);
  assert.deepEqual(game.beginDraw(), { ok: false, reason: "funds" });
  assert.equal(game.getState().coins, raw.coins);
  assert.equal(game.getState().pendingDraw, null);
  assert.equal(game.getState().inventory.length, 0);
});

test("結果画面で未投稿のまま売却して再読み込みしても売却済み結果を復元する", () => {
  const { game, storage } = setup();
  const result = game.beginDraw();
  game.revealPendingDraw(); game.quickSell(result.owned.uid);
  const before = game.getState();
  const restored = createGame({ storage }); restored.load();
  assert.equal(restored.getState().pendingDraw.uid, result.owned.uid);
  assert.equal(restored.getState().pendingDraw.revealed, true);
  assert.equal(restored.getState().coins, before.coins);
  assert.equal(restored.getState().inventory.length, 0);
  assert.equal(restored.quickSell(result.owned.uid).reason, "missing");
  restored.finishPendingDraw();
  assert.equal(restored.beginDraw().ok, true);
});

test("旧0.1.2セーブに操作設定を補完し、設定と王冠を周回継承する", () => {
  const raw = createInitialState();
  delete raw.pendingDraw;
  raw.settings = { reducedMotion: true };
  raw.coins = 3500; raw.crowns.money = 2; raw.discovered = [ITEMS[0].id];
  const { game, storage } = setup(raw);
  assert.equal(game.getState().pendingDraw, null);
  assert.equal(game.getState().settings.playMode, "normal");
  game.setPlayMode("careful"); game.setMuted(true);
  game.load();
  assert.equal(game.getState().settings.playMode, "careful");
  assert.equal(game.getState().settings.muted, true);
  assert.equal(game.claimCrown("money").ok, true);
  assert.equal(game.getState().crowns.money, 3);
  assert.equal(game.getState().settings.playMode, "careful");
  assert.equal(game.getState().settings.muted, true);
  assert.deepEqual(game.getState().discovered, [ITEMS[0].id]);
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).pendingDraw, null);
});

test("音声APIなし・ミュート環境でも例外なく進行できる", async () => {
  const audio = createToyAudio();
  await assert.doesNotReject(() => audio.unlock());
  assert.doesNotThrow(() => ["coin", "tick", "roll", "drop", "open", "reward"].forEach((name) => audio.play(name, 5)));
  const muted = createToyAudio({ isMuted: () => true });
  await muted.unlock();
  assert.doesNotThrow(() => muted.play("reward", 5));
});
