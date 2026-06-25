"use strict";

// 個体数と遺伝的アルゴリズムの基本ルール。能力値はすべて1〜100に収める。
const POPULATION_SIZE = 64;
const PARENT_COUNT = 16;
const MUTATION_RATE = 0.05;
const MAX_TURNS = 50;
const AUTO_INTERVAL_MS = 1700;
const ANIMATION_STEP_MS = 150;
const GENES = ["hp", "attack", "defense", "speed", "range"];
const GENE_INFO = {
  hp: ["HP", "#c8ff35"],
  attack: ["攻撃", "#ff6b35"],
  defense: ["防御", "#5c8cff"],
  speed: ["速度", "#42efd8"],
  range: ["射程", "#ff4f92"]
};
const NAME_FIRST = ["グラ", "ヴォル", "ネオ", "ガル", "ゼノ", "モル", "ラグ", "キュ", "バル", "ルク", "ギガ", "アル"];
const NAME_LAST = ["ドン", "ザウルス", "ビースト", "ファング", "ロア", "ゴン", "クス", "レックス", "バイト", "ゲイル"];
const TITLES = ["原初の王", "闘技場の覇者", "不屈の暴君", "疾風の牙", "鋼殻の王", "破壊の進化体", "進化の頂点"];
const $ = (selector) => document.querySelector(selector);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const elements = {
  generation: $("#generation"),
  population: $("#population"),
  roundLabel: $("#round-label"),
  matchTitle: $("#match-title"),
  arena: $("#arena"),
  fighterA: $("#fighter-a"),
  fighterB: $("#fighter-b"),
  fighterAName: $("#fighter-a-name"),
  fighterBName: $("#fighter-b-name"),
  monsterA: $("#monster-a"),
  monsterB: $("#monster-b"),
  hpA: $("#hp-a"),
  hpB: $("#hp-b"),
  projectile: $("#projectile"),
  crown: $("#winner-crown"),
  packGrid: $("#pack-grid"),
  bestName: $("#best-name"),
  bestCode: $("#best-code"),
  creatureTitle: $("#creature-title"),
  championMonster: $("#champion-monster"),
  bestStats: $("#best-stats"),
  averageStats: $("#average-stats"),
  averageScore: $("#average-score"),
  battleLog: $("#battle-log"),
  progress: $("#progress"),
  next: $("#next-generation"),
  nextTen: $("#next-ten"),
  auto: $("#auto-evolve"),
  reset: $("#reset")
};

let generation = 1;
let population = [];
let history = [];
let latestLogs = [];
let lastRankedIds = new Set();
let lastChampion = null;
let idCounter = 1;
let isRunning = false;
let autoTimer = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function randomName() {
  return NAME_FIRST[randomInt(0, NAME_FIRST.length - 1)] + NAME_LAST[randomInt(0, NAME_LAST.length - 1)];
}

function createCreature(genes = null, name = randomName(), parents = []) {
  const creature = { id: idCounter++, name, wins: 0, parents };
  GENES.forEach((gene) => {
    creature[gene] = genes ? genes[gene] : randomInt(30, 75);
  });
  return creature;
}

function power(creature) {
  return GENES.reduce((sum, gene) => sum + creature[gene], 0);
}

function getStrongest(creatures) {
  return creatures.reduce((best, current) => power(current) > power(best) ? current : best);
}

function geneColor(creature) {
  const hue = Math.round((creature.attack * 2.3 + creature.speed * 1.4 + creature.range * 1.8) % 360);
  const saturation = 70 + Math.round(creature.defense * 0.18);
  const light = 48 + Math.round(creature.hp * 0.08);
  return `hsl(${hue} ${saturation}% ${light}%)`;
}

// 遺伝子を見た目に反映する。HP=大きさ、攻撃=トゲ、防御=枠、速度=横長、射程=尻尾。
function monsterStyle(creature, small = false) {
  const size = small ? 16 + creature.hp * 0.09 : 46 + creature.hp * 0.34;
  const outline = small ? 1 + creature.defense / 60 : 2 + creature.defense / 18;
  const stretch = 0.86 + creature.speed / 160;
  const tail = small ? 4 + creature.range / 15 : 9 + creature.range / 3.8;
  const spikeSets = [
    "polygon(0 100%, 18% 18%, 34% 100%, 55% 12%, 73% 100%, 100% 22%, 100% 100%, 0 100%)",
    "polygon(0 100%, 10% 16%, 21% 100%, 34% 10%, 48% 100%, 62% 15%, 76% 100%, 91% 18%, 100% 100%, 0 100%)",
    "polygon(0 100%, 7% 10%, 15% 100%, 25% 12%, 36% 100%, 49% 8%, 61% 100%, 74% 12%, 86% 100%, 96% 15%, 100% 100%, 0 100%)"
  ];
  const spikeIndex = creature.attack > 78 ? 2 : creature.attack > 55 ? 1 : 0;
  return `--body:${geneColor(creature)};--size:${size}px;--outline:${outline}px;--stretch:${stretch};--tail:${tail}px;--spikes:${spikeSets[spikeIndex]};`;
}

function monsterMarkup(creature, small = false) {
  return `<div class="${small ? "pack-creature" : "monster"}" style="${monsterStyle(creature, small)}"><span class="eye-dot"></span><span class="mouth-line"></span></div>`;
}

function applyMonster(target, creature, small = false) {
  target.setAttribute("style", monsterStyle(creature, small));
  target.innerHTML = '<span class="eye-dot"></span><span class="mouth-line"></span>';
}

// 速度順に攻撃し、各攻撃イベントをアリーナ演出用に残す。
function battle(first, second) {
  let hpA = first.hp;
  let hpB = second.hp;
  const fastest = first.speed === second.speed ? (Math.random() < 0.5 ? first : second) : (first.speed > second.speed ? first : second);
  const order = fastest === first ? [first, second] : [second, first];
  const events = [];
  let turn = 0;

  while (turn < MAX_TURNS && hpA > 0 && hpB > 0) {
    turn += 1;
    for (const attacker of order) {
      if (hpA <= 0 || hpB <= 0) break;
      const defender = attacker === first ? second : first;
      const damage = Math.max(1, attacker.attack - defender.defense * 0.5);
      if (defender === first) hpA -= damage; else hpB -= damage;
      events.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        hpA: Math.max(0, hpA),
        hpB: Math.max(0, hpB),
        damage: Math.round(damage)
      });
    }
  }

  let winner;
  if (hpA === hpB) {
    winner = power(first) === power(second) ? (Math.random() < 0.5 ? first : second) : (power(first) > power(second) ? first : second);
  } else {
    winner = hpA > hpB ? first : second;
  }

  return { winner, turn, events: events.slice(0, 8), finalHpA: Math.max(0, hpA), finalHpB: Math.max(0, hpB) };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 64体のシングルエリミネーション。アリーナには代表的な対戦と決勝を見せる。
function runTournament() {
  population.forEach((creature) => { creature.wins = 0; });
  let contenders = shuffle(population);
  let round = 1;
  const logs = [];
  const visualMatches = [];

  while (contenders.length > 1) {
    const winners = [];
    const roundName = contenders.length === 2 ? "Final" : contenders.length === 4 ? "Semi Final" : `Round ${round}`;
    for (let i = 0; i < contenders.length; i += 2) {
      const a = contenders[i];
      const b = contenders[i + 1];
      const result = battle(a, b);
      result.winner.wins += 1;
      winners.push(result.winner);

      if (visualMatches.length < 2 || contenders.length <= 4) {
        visualMatches.push({ roundName, first: a, second: b, result });
      }
      if (contenders.length <= 4) {
        logs.push({ text: `${roundName}: ${a.name} vs ${b.name} → ${result.winner.name}` });
      }
    }
    contenders = winners;
    round += 1;
  }

  const ranked = [...population].sort((a, b) => b.wins - a.wins || power(b) - power(a));
  return { champion: contenders[0], ranked, logs, visualMatches };
}

function mutate(value) {
  if (Math.random() >= MUTATION_RATE) return value;
  return clamp(value * (Math.random() < 0.5 ? 0.9 : 1.1));
}

function breed(parentA, parentB) {
  const genes = {};
  GENES.forEach((gene) => {
    genes[gene] = mutate(Math.random() < 0.5 ? parentA[gene] : parentB[gene]);
  });
  return createCreature(genes, randomName(), [parentA.id, parentB.id]);
}

function createNextPopulation(ranked) {
  const parents = ranked.slice(0, PARENT_COUNT);
  const next = parents.map((parent) => createCreature(parent, parent.name, [parent.id]));

  while (next.length < POPULATION_SIZE) {
    const parentA = parents[randomInt(0, parents.length - 1)];
    let parentB = parents[randomInt(0, parents.length - 1)];
    while (parentA === parentB) parentB = parents[randomInt(0, parents.length - 1)];
    next.push(breed(parentA, parentB));
  }
  return next;
}

function statMarkup(creature) {
  return GENES.map((gene) => {
    const value = Number(creature[gene].toFixed ? creature[gene].toFixed(1) : creature[gene]);
    return `<div class="stat-row"><span class="stat-label">${GENE_INFO[gene][0]}</span><span class="stat-track"><span class="stat-fill" style="--stat-color:${GENE_INFO[gene][1]};width:${value}%"></span></span><span class="stat-value">${value}</span></div>`;
  }).join("");
}

function getAverages() {
  const averages = {};
  GENES.forEach((gene) => {
    averages[gene] = population.reduce((sum, creature) => sum + creature[gene], 0) / population.length;
  });
  return averages;
}

function renderPack(phase = "current") {
  elements.packGrid.innerHTML = population.map((creature, index) => {
    const isParent = lastRankedIds.has(creature.id);
    const phaseClass = phase === "result" ? (isParent ? "parent" : "faded") : (phase === "birth" ? "newborn" : "");
    const delay = phase === "birth" ? `animation-delay:${Math.min(index * 8, 260)}ms` : "";
    return `<div class="pack-slot ${phaseClass}" style="${delay}" title="${creature.name}">${monsterMarkup(creature, true)}</div>`;
  }).join("");
}

function renderLogs() {
  if (!latestLogs.length) return;
  elements.battleLog.innerHTML = latestLogs.slice(-5).map((log) => `<li>${log.text}</li>`).join("");
  elements.battleLog.scrollTop = elements.battleLog.scrollHeight;
}

function render() {
  const best = lastChampion || getStrongest(population);
  const averages = getAverages();
  elements.generation.textContent = generation;
  elements.population.textContent = population.length;
  elements.bestName.textContent = best.name;
  elements.bestCode.textContent = `ID: CR-${String(best.id).padStart(4, "0")} · 総合 ${power(best)}`;
  elements.creatureTitle.textContent = TITLES[Math.min(history.length, TITLES.length - 1)];
  elements.bestStats.innerHTML = statMarkup(best);
  elements.averageStats.innerHTML = statMarkup(averages);
  elements.averageScore.textContent = (power(averages) / GENES.length).toFixed(1);
  applyMonster(elements.championMonster, best);
  renderLogs();
}

function resetArena() {
  [elements.fighterA, elements.fighterB].forEach((node) => {
    node.classList.remove("attack", "hit", "win");
  });
  elements.projectile.className = "projectile";
  elements.crown.className = "winner-crown";
  elements.arena.classList.remove("final-flash");
}

async function playMatch(match) {
  const { first, second, result, roundName } = match;
  resetArena();
  elements.roundLabel.textContent = roundName;
  elements.matchTitle.textContent = `${first.name} vs ${second.name}`;
  elements.fighterAName.textContent = first.name;
  elements.fighterBName.textContent = second.name;
  elements.hpA.style.width = "100%";
  elements.hpB.style.width = "100%";
  applyMonster(elements.monsterA, first);
  applyMonster(elements.monsterB, second);
  if (roundName === "Final") elements.arena.classList.add("final-flash");
  await sleep(ANIMATION_STEP_MS);

  const events = result.events.length ? result.events : [{ attackerId: first.id, defenderId: second.id, hpA: result.finalHpA, hpB: result.finalHpB }];
  for (const event of events) {
    const attackerSide = event.attackerId === first.id ? "left" : "right";
    const attacker = attackerSide === "left" ? elements.fighterA : elements.fighterB;
    const defender = attackerSide === "left" ? elements.fighterB : elements.fighterA;

    attacker.classList.add("attack");
    elements.projectile.className = `projectile fire-${attackerSide}`;
    await sleep(ANIMATION_STEP_MS);
    defender.classList.add("hit");
    elements.hpA.style.width = `${Math.max(0, event.hpA / first.hp * 100)}%`;
    elements.hpB.style.width = `${Math.max(0, event.hpB / second.hp * 100)}%`;
    await sleep(ANIMATION_STEP_MS);
    attacker.classList.remove("attack");
    defender.classList.remove("hit");
    elements.projectile.className = "projectile";
  }

  const winnerSide = result.winner.id === first.id ? "left" : "right";
  (winnerSide === "left" ? elements.fighterA : elements.fighterB).classList.add("win");
  elements.crown.className = `winner-crown show-${winnerSide}`;
  elements.matchTitle.textContent = `WINNER ${result.winner.name}`;
  await sleep(roundName === "Final" ? 520 : 300);
}

async function visualizeTournament(result) {
  const matches = result.visualMatches.slice(-4);
  for (const match of matches) {
    await playMatch(match);
  }
}

async function advanceOneGeneration(visual = true) {
  const result = runTournament();
  const parents = result.ranked.slice(0, PARENT_COUNT);
  lastRankedIds = new Set(parents.map((creature) => creature.id));
  lastChampion = result.champion;
  history.push({ generation, name: result.champion.name, power: power(result.champion) });
  latestLogs = [
    ...result.logs,
    { text: `優勝: <strong>${result.champion.name}</strong> / 総合 ${power(result.champion)}` },
    { text: `上位${PARENT_COUNT}体が親になり、次世代が誕生` }
  ];

  renderPack("result");
  render();
  if (visual) await visualizeTournament(result);
  await sleep(visual ? 220 : 0);

  population = createNextPopulation(result.ranked);
  generation += 1;
  lastRankedIds = new Set(population.slice(0, PARENT_COUNT).map((creature) => creature.id));
  lastChampion = getStrongest(population);
  renderPack("birth");
  render();
}

function setRunning(running) {
  isRunning = running;
  [elements.next, elements.nextTen, elements.reset].forEach((button) => {
    button.disabled = running;
  });
  elements.auto.disabled = false;
}

async function advance(count, visualFirst = true) {
  if (isRunning) return;
  setRunning(true);
  for (let i = 0; i < count; i += 1) {
    elements.progress.textContent = `${i + 1} / ${count} 世代を進化中`;
    await advanceOneGeneration(visualFirst && i === 0);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  elements.progress.textContent = `第${generation}世代が誕生`;
  setRunning(false);
}

function stopAuto() {
  if (!autoTimer) return;
  clearInterval(autoTimer);
  autoTimer = null;
  elements.auto.textContent = "自動進化";
  elements.auto.classList.remove("is-running");
  elements.progress.textContent = "自動進化を停止";
}

function toggleAuto() {
  if (autoTimer) {
    stopAuto();
    return;
  }
  elements.auto.textContent = "停止";
  elements.auto.classList.add("is-running");
  elements.progress.textContent = "自動進化中";
  advance(1, true);
  autoTimer = setInterval(() => {
    if (!isRunning) advance(1, false);
  }, AUTO_INTERVAL_MS);
}

function resetGame() {
  if (isRunning) return;
  stopAuto();
  generation = 1;
  history = [];
  latestLogs = [];
  lastRankedIds = new Set();
  lastChampion = null;
  idCounter = 1;
  population = Array.from({ length: POPULATION_SIZE }, () => createCreature());
  elements.roundLabel.textContent = "READY";
  elements.matchTitle.textContent = "進化を開始";
  elements.fighterAName.textContent = "---";
  elements.fighterBName.textContent = "---";
  elements.hpA.style.width = "100%";
  elements.hpB.style.width = "100%";
  elements.battleLog.innerHTML = '<li class="empty-message">1世代目、64体が待機中</li>';
  elements.progress.textContent = "";
  resetArena();
  renderPack("current");
  render();
}

elements.next.addEventListener("click", () => advance(1, true));
elements.nextTen.addEventListener("click", () => advance(10, true));
elements.auto.addEventListener("click", toggleAuto);
elements.reset.addEventListener("click", resetGame);
resetGame();
