import test from "node:test";
import assert from "node:assert/strict";
import { createGame, createInitialState, SAVE_KEY } from "../js/game-state.js";
import { GOALS, ITEMS, MACHINE } from "../js/data.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

function makeGame({ rolls = [0], time = 1000, storage = memoryStorage() } = {}) {
  let index = 0; let clock = time;
  const game = createGame({ storage, rng: () => rolls[index++] ?? rolls.at(-1), now: () => clock });
  game.load();
  return { game, storage, advance: (ms) => { clock += ms; } };
}

test("固定乱数で全レア度の境界を抽選できる", () => {
  const rolls = [0, .45, .75, .90, .98];
  const { game } = makeGame({ rolls });
  const rarities = rolls.map(() => game.draw().item.rarity);
  assert.deepEqual(rarities, ["common", "rare", "epic", "legendary", "mythic"]);
  assert.equal(game.getState().coins, 0);
});

test("即売りは所持品を除き資金を増加する", () => {
  const { game } = makeGame(); const result = game.draw();
  const before = game.getState().coins;
  game.quickSell(result.owned.uid);
  assert.equal(game.getState().inventory.length, 0);
  assert.equal(game.getState().coins, before + ITEMS[0].value);
});

test("フリマは待機後に割増価格で成約する", () => {
  const ctx = makeGame(); const drawn = ctx.game.draw(); const listed = ctx.game.listItem(drawn.owned.uid);
  assert.equal(ctx.game.getState().coins, 800);
  ctx.advance(8000); ctx.game.settleListings();
  assert.equal(ctx.game.getState().listings.length, 0);
  assert.equal(ctx.game.getState().coins, 800 + listed.listing.price);
});

test("同じ所持アイテムのSNS重複投稿を拒否し履歴は売却後も残る", () => {
  const { game } = makeGame(); const drawn = game.draw();
  assert.equal(game.postItem(drawn.owned.uid).ok, true);
  assert.equal(game.postItem(drawn.owned.uid).reason, "duplicate");
  game.quickSell(drawn.owned.uid);
  assert.equal(game.getState().posts.length, 1);
  assert.equal(game.getState().stats.posts, 1);
});

test("3種類の王冠達成判定を行う", () => {
  const uniqueRolls = ITEMS.slice(0, GOALS.collection.target).map((item) => {
    const before = ITEMS.slice(0, ITEMS.indexOf(item)).reduce((sum, value) => sum + value.weight, 0);
    return (before + 1) / 10000;
  });
  const funded = createInitialState(); funded.coins = MACHINE.cost * GOALS.collection.target;
  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(funded) });
  const { game } = makeGame({ rolls: uniqueRolls, storage });
  for (let i = 0; i < GOALS.collection.target; i++) game.draw();
  assert.equal(game.achievements().collection, true);
  const raw = game.getState(); raw.coins = GOALS.money.target; raw.followers = GOALS.popularity.target;
  const achievedStorage = memoryStorage({ [SAVE_KEY]: JSON.stringify(raw) }); const loaded = createGame({ storage: achievedStorage }); loaded.load();
  assert.deepEqual(loaded.achievements(), { money: true, collection: true, popularity: true });
});

test("セーブ・ロードと周回で王冠・図鑑・設定を継承する", () => {
  const { game, storage } = makeGame(); game.draw(); game.setReducedMotion(true);
  const raw = game.getState(); raw.coins = GOALS.money.target; storage.setItem(SAVE_KEY, JSON.stringify(raw));
  const loaded = createGame({ storage, now: () => 2000 }); loaded.load();
  assert.equal(loaded.claimCrown("money").ok, true);
  const next = loaded.getState();
  assert.equal(next.cycle, 2); assert.equal(next.crowns.money, 1); assert.equal(next.discovered.length, 1);
  assert.equal(next.settings.reducedMotion, true); assert.equal(next.inventory.length, 0); assert.equal(next.coins, 1000);
});

test("資金・所持品・出品がない時だけ救済を受け取れる", () => {
  const { game } = makeGame();
  for (let i = 0; i < 5; i++) game.draw();
  for (const owned of game.getState().inventory) game.quickSell(owned.uid);
  const state = game.getState(); state.coins = 0; const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(state) });
  const stranded = createGame({ storage }); stranded.load();
  assert.deepEqual(stranded.rescue(), { ok: true, amount: 600 });
  assert.equal(stranded.rescue().reason, "not-needed");
});
