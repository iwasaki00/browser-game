"use strict";

// 個体数と遺伝ルール。能力値はすべて1〜100に収める。
const POPULATION_SIZE = 64;
const PARENT_COUNT = 16;
const MUTATION_RATE = 0.05;
const MAX_TURNS = 50;
const GENES = ["hp", "attack", "defense", "speed", "range"];
const GENE_INFO = {
  hp: ["HP", "#c7ff38"], attack: ["攻撃", "#ff6b35"], defense: ["防御", "#5c8cff"],
  speed: ["速度", "#31d9c5"], range: ["射程", "#ef5da8"]
};
const NAME_FIRST = ["グラ", "ヴォル", "ネオ", "ガル", "ゼノ", "モル", "ラグ", "キバ", "バル", "ルク", "ギガ", "アル"];
const NAME_LAST = ["ドン", "ザウルス", "ビースト", "ファング", "ロア", "ゴン", "クス", "レックス", "バイト", "ゲイル"];
const TITLES = ["原初の王", "闘技場の覇者", "不屈の暴君", "疾風の牙", "鋼殻の王", "破壊の化身", "進化の頂点"];
const $ = (selector) => document.querySelector(selector);
const elements = {
  generation: $("#generation"), population: $("#population"), bestName: $("#best-name"),
  bestCode: $("#best-code"), creatureTitle: $("#creature-title"), bestStats: $("#best-stats"),
  averageStats: $("#average-stats"), averageScore: $("#average-score"), historyChart: $("#history-chart"),
  historyList: $("#history-list"), battleLog: $("#battle-log"), progress: $("#progress"),
  next: $("#next-generation"), nextTen: $("#next-ten"), reset: $("#reset")
};

let generation = 1;
let population = [];
let history = [];
let latestLogs = [];
let idCounter = 1;
let isRunning = false;

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value) { return Math.max(1, Math.min(100, Math.round(value))); }
function randomName() { return NAME_FIRST[randomInt(0, NAME_FIRST.length - 1)] + NAME_LAST[randomInt(0, NAME_LAST.length - 1)]; }

function createCreature(genes = null, name = randomName()) {
  const creature = { id: idCounter++, name, wins: 0 };
  GENES.forEach((gene) => { creature[gene] = genes ? genes[gene] : randomInt(30, 75); });
  return creature;
}

function power(creature) { return GENES.reduce((sum, gene) => sum + creature[gene], 0); }
function getStrongest(creatures) { return creatures.reduce((best, current) => power(current) > power(best) ? current : best); }

// 速度順で交互に攻撃し、50ターン時は残HPで判定する。
function battle(first, second) {
  let hpA = first.hp;
  let hpB = second.hp;
  const fastest = first.speed === second.speed ? (Math.random() < 0.5 ? first : second) : (first.speed > second.speed ? first : second);
  const order = fastest === first ? [first, second] : [second, first];
  let turn = 0;
  while (turn < MAX_TURNS && hpA > 0 && hpB > 0) {
    turn += 1;
    for (const attacker of order) {
      if (hpA <= 0 || hpB <= 0) break;
      const defender = attacker === first ? second : first;
      const damage = Math.max(1, attacker.attack - defender.defense * 0.5);
      if (defender === first) hpA -= damage; else hpB -= damage;
    }
  }
  let winner;
  if (hpA === hpB) winner = power(first) === power(second) ? (Math.random() < 0.5 ? first : second) : (power(first) > power(second) ? first : second);
  else winner = hpA > hpB ? first : second;
  return { winner, turn };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 64体のシングルエリミネーション。勝利数を選抜順位として使う。
function runTournament() {
  population.forEach((creature) => { creature.wins = 0; });
  let contenders = shuffle(population);
  let round = 1;
  const logs = [];
  while (contenders.length > 1) {
    const winners = [];
    const roundName = contenders.length === 2 ? "決勝" : contenders.length === 4 ? "準決勝" : `ROUND ${round}`;
    logs.push({ type: "heading", text: `${roundName} — ${contenders.length}体` });
    for (let i = 0; i < contenders.length; i += 2) {
      const result = battle(contenders[i], contenders[i + 1]);
      result.winner.wins += 1;
      winners.push(result.winner);
      logs.push({ type: "battle", text: `${contenders[i].name} vs ${contenders[i + 1].name} → <strong>${result.winner.name}</strong> (${result.turn}T)` });
    }
    contenders = winners;
    round += 1;
  }
  return { champion: contenders[0], ranked: [...population].sort((a, b) => b.wins - a.wins || power(b) - power(a)), logs };
}

function mutate(value) {
  if (Math.random() >= MUTATION_RATE) return value;
  return clamp(value * (Math.random() < 0.5 ? 0.9 : 1.1));
}

function breed(parentA, parentB) {
  const genes = {};
  GENES.forEach((gene) => { genes[gene] = mutate(Math.random() < 0.5 ? parentA[gene] : parentB[gene]); });
  return createCreature(genes);
}

function createNextPopulation(ranked) {
  const parents = ranked.slice(0, PARENT_COUNT);
  // 上位25%を残し、残り48体を異なる親同士の交配で生成する。
  const next = parents.map((parent) => createCreature(parent, parent.name));
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
  GENES.forEach((gene) => { averages[gene] = population.reduce((sum, creature) => sum + creature[gene], 0) / population.length; });
  return averages;
}

function renderHistory() {
  if (!history.length) {
    elements.historyChart.innerHTML = '<p class="empty-message">トーナメントを開始すると記録されます</p>';
    elements.historyList.innerHTML = "";
    return;
  }
  const visible = history.slice(-16);
  const scores = visible.map((item) => item.power);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  elements.historyChart.innerHTML = visible.map((item) => {
    const height = max === min ? 65 : 30 + ((item.power - min) / (max - min)) * 55;
    return `<div class="chart-column" style="--bar-height:${height}%" title="第${item.generation}世代: ${item.power}"><span>${item.generation}</span></div>`;
  }).join("");
  elements.historyList.innerHTML = history.slice(-5).reverse().map((item) => `<div class="history-item"><span class="history-generation">GEN ${item.generation}</span><span class="history-name">${item.name}</span><span class="history-power">総合 ${item.power}</span></div>`).join("");
}

function renderLogs() {
  if (!latestLogs.length) return;
  // 決勝を含む末尾18件に絞り、スマホでも追いやすくする。
  elements.battleLog.innerHTML = latestLogs.slice(-18).map((log) => `<li class="${log.type === "heading" ? "round-heading" : ""}">${log.text}</li>`).join("");
  elements.battleLog.scrollTop = elements.battleLog.scrollHeight;
}

function render() {
  const best = getStrongest(population);
  const averages = getAverages();
  elements.generation.textContent = generation;
  elements.population.textContent = population.length;
  elements.bestName.textContent = best.name;
  elements.bestCode.textContent = `ID: CR-${String(best.id).padStart(4, "0")} · 総合 ${power(best)}`;
  elements.creatureTitle.textContent = TITLES[Math.min(history.length, TITLES.length - 1)];
  elements.bestStats.innerHTML = statMarkup(best);
  elements.averageStats.innerHTML = statMarkup(averages);
  elements.averageScore.textContent = (power(averages) / GENES.length).toFixed(1);
  renderHistory();
  renderLogs();
}

function advanceOneGeneration() {
  const result = runTournament();
  history.push({ generation, name: result.champion.name, power: power(result.champion) });
  latestLogs = [{ type: "heading", text: `第${generation}世代 トーナメント` }, ...result.logs, { type: "battle", text: `🏆 優勝 <strong>${result.champion.name}</strong> ／ 総合 ${power(result.champion)}` }];
  population = createNextPopulation(result.ranked);
  generation += 1;
}

function setRunning(running) {
  isRunning = running;
  [elements.next, elements.nextTen, elements.reset].forEach((button) => { button.disabled = running; });
}

async function advance(count) {
  if (isRunning) return;
  setRunning(true);
  for (let i = 0; i < count; i += 1) {
    elements.progress.textContent = `${i + 1} / ${count} 世代をシミュレート中…`;
    // Safariに描画機会を渡し、10世代処理中のフリーズ感を防ぐ。
    await new Promise((resolve) => requestAnimationFrame(resolve));
    advanceOneGeneration();
    render();
  }
  elements.progress.textContent = `第${generation}世代が誕生しました`;
  setRunning(false);
}

function resetGame() {
  if (isRunning) return;
  generation = 1; history = []; latestLogs = []; idCounter = 1;
  population = Array.from({ length: POPULATION_SIZE }, () => createCreature());
  elements.battleLog.innerHTML = '<li class="empty-message">第1世代、64体が待機中…</li>';
  elements.progress.textContent = "";
  render();
}

elements.next.addEventListener("click", () => advance(1));
elements.nextTen.addEventListener("click", () => advance(10));
elements.reset.addEventListener("click", resetGame);
resetGame();
