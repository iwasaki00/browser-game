import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createGame, createInitialState, SAVE_KEY } from "../js/game-state.js";
import { GOALS, ITEMS, MACHINE, VERSION } from "../js/data.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

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

test("Version 0.1.0セーブを初期化せず0.1.1へ移行する", () => {
  const legacy = createInitialState();
  legacy.version = "0.1.0";
  legacy.coins = 4321;
  legacy.followers = 87;
  legacy.discovered = [ITEMS[0].id, ITEMS[8].id];
  legacy.inventory = [{ uid: "i44", itemId: ITEMS[8].id, acquiredAt: 100, posted: false }];
  legacy.crowns = { money: 2, collection: 1, popularity: 3 };
  const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(legacy) });
  const migrated = createGame({ storage });
  migrated.load();
  const state = migrated.getState();
  assert.equal(state.version, VERSION);
  assert.equal(state.coins, 4321);
  assert.equal(state.followers, 87);
  assert.deepEqual(state.discovered, legacy.discovered);
  assert.deepEqual(state.inventory, legacy.inventory);
  assert.deepEqual(state.crowns, legacy.crowns);
});

test("正式画像12種と既存IDの対応が一意で、PNGは512×512", () => {
  const manifest = JSON.parse(readFileSync(`${projectRoot}/assets/items/henteko-vol01/manifest.json`, "utf8"));
  assert.equal(ITEMS.length, 12);
  assert.equal(manifest.items.length, 12);
  assert.equal(new Set(ITEMS.map((item) => item.id)).size, 12);
  assert.equal(new Set(ITEMS.map((item) => item.assetId)).size, 12);
  assert.equal(new Set(ITEMS.map((item) => item.image)).size, 12);
  for (const item of ITEMS) {
    const mapped = manifest.items.find((entry) => entry.gameId === item.id);
    assert.ok(mapped, `${item.id} mapping`);
    assert.equal(mapped.assetId, item.assetId);
    assert.equal(mapped.name, item.name);
    assert.equal(mapped.gameRarity, item.rarity);
    const imagePath = `${projectRoot}/${item.image.replace(/^\.\//, "")}`;
    assert.equal(existsSync(imagePath), true, item.image);
    const png = readFileSync(imagePath);
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 512);
    assert.equal(png.readUInt32BE(20), 512);
  }
});

test("0.1.0の価格・weight・レア度別排出率を維持する", () => {
  assert.deepEqual(ITEMS.map(({ rarity, weight, value }) => [rarity, weight, value]), [
    ["common", 1500, 100], ["common", 1500, 110], ["common", 1500, 120],
    ["rare", 1000, 220], ["rare", 1000, 240], ["rare", 1000, 260],
    ["epic", 750, 480], ["epic", 750, 520],
    ["legendary", 400, 950], ["legendary", 400, 1050],
    ["mythic", 100, 2400], ["mythic", 100, 2800]
  ]);
  assert.deepEqual(MACHINE.rates, [["common", 45], ["rare", 30], ["epic", 15], ["legendary", 8], ["mythic", 2]]);
  assert.equal(ITEMS.reduce((sum, item) => sum + item.weight, 0), 10000);
});

test("画像エラー時の代替表示処理を備える", () => {
  const appSource = readFileSync(`${projectRoot}/js/app.js`, "utf8");
  const cssSource = readFileSync(`${projectRoot}/styles.css`, "utf8");
  assert.match(appSource, /data-item-image/);
  assert.match(appSource, /classList\.add\("image-error"\)/);
  assert.match(cssSource, /\.item-art\.image-error img\{display:none\}/);
  assert.match(cssSource, /\.item-art\.image-error \.image-fallback\{display:grid/);
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
