import { createGame } from "../js/game-state.js";
import { FIRST_COLLECTION_BONUS, GOALS, ITEMS, MACHINE, VERSION } from "../js/data.js";

const RUNS = Number(process.env.SIM_RUNS || 1000);
const MAX_DRAWS = Number(process.env.SIM_MAX_DRAWS || 200);
const STYLE_NAMES = ["money", "collection", "popularity", "balanced"];
if (process.env.SIM_MONEY_TARGET) GOALS.money.target = Number(process.env.SIM_MONEY_TARGET);
if (process.env.SIM_COLLECTION_TARGET) GOALS.collection.target = Number(process.env.SIM_COLLECTION_TARGET);
if (process.env.SIM_POPULARITY_TARGET) GOALS.popularity.target = Number(process.env.SIM_POPULARITY_TARGET);

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function summarize(values) {
  if (!values.length) return { mean: null, median: null, p90: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
  return {
    mean: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    median: at(.5),
    p90: at(.9)
  };
}

function lowestValueOwned(state) {
  return [...state.inventory].sort((a, b) => {
    const left = ITEMS.find((item) => item.id === a.itemId)?.value || 0;
    const right = ITEMS.find((item) => item.id === b.itemId)?.value || 0;
    return left - right;
  })[0];
}

function runOnce(style, seed) {
  let clock = 1_000_000;
  const storage = memoryStorage();
  const game = createGame({ storage, rng: mulberry32(seed), now: () => clock });
  game.load();
  const seen = new Set();
  let duplicateDraws = 0;
  let shortageEvents = 0;
  let marketUses = 0;
  let marketBonus = 0;
  let stalled = false;
  let firstCrown = null;

  const targetReached = () => {
    const achieved = game.achievements();
    if (style === "balanced") {
      firstCrown ||= Object.keys(achieved).find((key) => achieved[key]) || null;
      return Boolean(firstCrown);
    }
    return achieved[style === "popularity" ? "popularity" : style];
  };

  while (game.getState().stats.draws < MAX_DRAWS && !targetReached()) {
    let state = game.getState();
    if (state.coins < MACHINE.cost) {
      shortageEvents += 1;
      if (style === "balanced" && state.inventory.length) {
        const sacrifice = lowestValueOwned(state);
        game.quickSell(sacrifice.uid);
        continue;
      }
      const rescued = game.rescue();
      if (!rescued.ok) {
        stalled = true;
        break;
      }
      continue;
    }

    const result = game.draw();
    if (!result.ok) continue;
    const wasDuplicate = seen.has(result.item.id);
    if (wasDuplicate) duplicateDraws += 1;
    seen.add(result.item.id);
    if (style === "money") {
      const listed = game.listItem(result.owned.uid);
      if (listed.ok) {
        marketUses += 1;
        marketBonus += listed.listing.price - result.item.value;
        clock = listed.listing.completesAt;
        game.settleListings();
      }
    } else if (style === "popularity") {
      game.postItem(result.owned.uid);
      game.quickSell(result.owned.uid);
    } else if (style === "collection") {
      if (wasDuplicate) {
        const listed = game.listItem(result.owned.uid);
        if (listed.ok) {
          marketUses += 1;
          marketBonus += listed.listing.price - result.item.value;
          clock = listed.listing.completesAt;
          game.settleListings();
        }
      }
    } else {
      game.postItem(result.owned.uid);
      const duplicateOwned = game.getState().inventory.filter((owned) => owned.itemId === result.item.id).length > 1;
      if (duplicateOwned) {
        const listed = game.listItem(result.owned.uid);
        if (listed.ok) {
          marketUses += 1;
          marketBonus += listed.listing.price - result.item.value;
          clock = listed.listing.completesAt;
          game.settleListings();
        }
      }
    }
  }

  const state = game.getState();
  const achieved = game.achievements();
  const success = style === "balanced" ? Boolean(firstCrown) : achieved[style === "popularity" ? "popularity" : style];
  return {
    success,
    draws: state.stats.draws,
    shortageEvents,
    rescueUses: state.stats.rescues,
    duplicateDraws,
    marketUses,
    marketBonus,
    followers: state.followers,
    coins: state.coins,
    moneyProgress: game.moneyProgress(),
    collection: game.collectionCount(),
    stalled,
    firstCrown,
    achieved
  };
}

function aggregate(style, runs) {
  const successful = runs.filter((run) => run.success);
  const totalDraws = runs.reduce((sum, run) => sum + run.draws, 0);
  const firstCrowns = { money: 0, collection: 0, popularity: 0 };
  runs.forEach((run) => { if (run.firstCrown) firstCrowns[run.firstCrown] += 1; });
  return {
    style,
    runs: runs.length,
    successRatePct: Number((successful.length / runs.length * 100).toFixed(1)),
    drawsToCrown: summarize(successful.map((run) => run.draws)),
    shortageRunRatePct: Number((runs.filter((run) => run.shortageEvents > 0).length / runs.length * 100).toFixed(1)),
    meanShortageEvents: summarize(runs.map((run) => run.shortageEvents)).mean,
    meanRescueUses: summarize(runs.map((run) => run.rescueUses)).mean,
    duplicateRatePct: Number((runs.reduce((sum, run) => sum + run.duplicateDraws, 0) / Math.max(1, totalDraws) * 100).toFixed(1)),
    meanMarketUses: summarize(runs.map((run) => run.marketUses)).mean,
    meanMarketBonus: summarize(runs.map((run) => run.marketBonus)).mean,
    meanFollowers: summarize(runs.map((run) => run.followers)).mean,
    meanFinalCoins: summarize(runs.map((run) => run.coins)).mean,
    meanFinalMoneyProgress: summarize(runs.map((run) => run.moneyProgress)).mean,
    stalledRatePct: Number((runs.filter((run) => run.stalled).length / runs.length * 100).toFixed(1)),
    firstCrowns
  };
}

const report = {
  version: VERSION,
  runsPerStyle: RUNS,
  maxDraws: MAX_DRAWS,
  note: "Market waits advance a virtual clock by 8 seconds; no real-time duration is estimated.",
  firstCollectionBonus: FIRST_COLLECTION_BONUS,
  goals: Object.fromEntries(Object.entries(GOALS).map(([key, goal]) => [key, goal.target])),
  styles: STYLE_NAMES.map((style, styleIndex) => {
    const runs = Array.from({ length: RUNS }, (_, index) => runOnce(style, 100_003 + styleIndex * 1_000_003 + index * 97));
    return aggregate(style, runs);
  })
};

console.log(JSON.stringify(report, null, 2));
