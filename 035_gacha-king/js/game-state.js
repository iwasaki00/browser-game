import { GOALS, ITEMS, MACHINE, VERSION, itemById } from "./data.js";

export const SAVE_KEY = "gacha-king-save-v1";
const COMPATIBLE_VERSIONS = new Set(["0.1.0", VERSION]);

export function createInitialState(legacy = {}) {
  return {
    version: VERSION,
    coins: 1000,
    followers: 0,
    inventory: [],
    listings: [],
    posts: [],
    discovered: [...new Set(legacy.discovered || [])],
    crowns: { money: 0, collection: 0, popularity: 0, ...(legacy.crowns || {}) },
    cycle: Math.max(1, legacy.cycle || 1),
    settings: { reducedMotion: false, ...(legacy.settings || {}) },
    stats: { draws: 0, sales: 0, posts: 0, rescues: 0 },
    nextId: 1,
    updatedAt: Date.now()
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(raw) {
  const base = createInitialState({
    discovered: Array.isArray(raw?.discovered) ? raw.discovered.filter((id) => itemById(id)) : [],
    crowns: raw?.crowns,
    cycle: raw?.cycle,
    settings: raw?.settings
  });
  if (!raw || !COMPATIBLE_VERSIONS.has(raw.version)) return base;
  const state = { ...base, ...raw };
  state.version = VERSION;
  state.coins = Math.max(0, Number(state.coins) || 0);
  state.followers = Math.max(0, Number(state.followers) || 0);
  state.inventory = Array.isArray(state.inventory) ? state.inventory.filter((entry) => itemById(entry.itemId)) : [];
  state.listings = Array.isArray(state.listings) ? state.listings.filter((entry) => itemById(entry.itemId)) : [];
  state.posts = Array.isArray(state.posts) ? state.posts : [];
  state.stats = { ...base.stats, ...(state.stats || {}) };
  state.nextId = Math.max(1, Number(state.nextId) || 1);
  return state;
}

export function createGame({ storage = globalThis.localStorage, rng = Math.random, now = Date.now } = {}) {
  let state = createInitialState();
  const listeners = new Set();

  function emit() {
    state.updatedAt = now();
    save();
    listeners.forEach((listener) => listener(getState()));
  }

  function save() {
    try { storage?.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private browsing/quota */ }
  }

  function load() {
    try {
      const value = storage?.getItem(SAVE_KEY);
      if (value) state = normalizeState(JSON.parse(value));
    } catch { state = createInitialState(); }
    settleListings(false);
    return getState();
  }

  function getState() { return clone(state); }
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

  function draw() {
    if (state.coins < MACHINE.cost) return { ok: false, reason: "funds" };
    state.coins -= MACHINE.cost;
    const roll = Math.min(0.999999999, Math.max(0, rng())) * 10000;
    let cursor = 0;
    const item = ITEMS.find((candidate) => (cursor += candidate.weight) > roll) || ITEMS.at(-1);
    const isNew = !state.discovered.includes(item.id);
    const owned = { uid: `i${state.nextId++}`, itemId: item.id, acquiredAt: now(), posted: false };
    state.inventory.unshift(owned);
    if (!state.discovered.includes(item.id)) state.discovered.push(item.id);
    state.stats.draws += 1;
    emit();
    return { ok: true, item: clone(item), owned: clone(owned), isNew };
  }

  function findOwned(uid) { return state.inventory.find((entry) => entry.uid === uid); }
  function removeOwned(uid) {
    const index = state.inventory.findIndex((entry) => entry.uid === uid);
    if (index < 0) return null;
    return state.inventory.splice(index, 1)[0];
  }

  function quickSell(uid) {
    const owned = findOwned(uid);
    if (!owned) return { ok: false, reason: "missing" };
    const item = itemById(owned.itemId);
    removeOwned(uid);
    state.coins += item.value;
    state.stats.sales += 1;
    emit();
    return { ok: true, amount: item.value };
  }

  function listItem(uid) {
    const owned = findOwned(uid);
    if (!owned) return { ok: false, reason: "missing" };
    const item = itemById(owned.itemId);
    removeOwned(uid);
    const listing = {
      uid: `m${state.nextId++}`,
      sourceUid: uid,
      itemId: item.id,
      price: Math.round(item.value * 1.45),
      completesAt: now() + 8000
    };
    state.listings.unshift(listing);
    emit();
    return { ok: true, listing: clone(listing) };
  }

  function settleListings(shouldEmit = true) {
    const time = now();
    const sold = state.listings.filter((entry) => entry.completesAt <= time);
    if (!sold.length) return [];
    state.listings = state.listings.filter((entry) => entry.completesAt > time);
    state.coins += sold.reduce((sum, entry) => sum + entry.price, 0);
    state.stats.sales += sold.length;
    if (shouldEmit) emit(); else save();
    return clone(sold);
  }

  function postItem(uid) {
    const owned = findOwned(uid);
    if (!owned) return { ok: false, reason: "missing" };
    if (owned.posted || state.posts.some((post) => post.sourceUid === uid)) return { ok: false, reason: "duplicate" };
    const item = itemById(owned.itemId);
    const gain = 8 + item.value / 40 + [0, 3, 10, 24, 55][["common", "rare", "epic", "legendary", "mythic"].indexOf(item.rarity)];
    const followers = Math.round(gain);
    owned.posted = true;
    state.followers += followers;
    state.posts.unshift({ uid: `p${state.nextId++}`, sourceUid: uid, itemId: item.id, followers, createdAt: now() });
    state.stats.posts += 1;
    emit();
    return { ok: true, followers };
  }

  function collectionCount() { return new Set(state.inventory.map((entry) => entry.itemId)).size; }
  function achievements() {
    return {
      money: state.coins >= GOALS.money.target,
      collection: collectionCount() >= GOALS.collection.target,
      popularity: state.followers >= GOALS.popularity.target
    };
  }

  function claimCrown(type) {
    if (!GOALS[type] || !achievements()[type]) return { ok: false, reason: "locked" };
    const inherited = {
      discovered: state.discovered,
      crowns: { ...state.crowns, [type]: state.crowns[type] + 1 },
      cycle: state.cycle + 1,
      settings: state.settings
    };
    state = createInitialState(inherited);
    emit();
    return { ok: true, type };
  }

  function rescue() {
    if (state.coins >= MACHINE.cost || state.inventory.length || state.listings.length) return { ok: false, reason: "not-needed" };
    state.coins += 600;
    state.stats.rescues += 1;
    emit();
    return { ok: true, amount: 600 };
  }

  function setReducedMotion(value) { state.settings.reducedMotion = Boolean(value); emit(); }

  return { load, save, getState, subscribe, draw, quickSell, listItem, settleListings, postItem, achievements, collectionCount, claimCrown, rescue, setReducedMotion };
}
