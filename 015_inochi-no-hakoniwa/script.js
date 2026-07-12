"use strict";

const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const ui = {
  time: document.getElementById("time"),
  generation: document.getElementById("generation"),
  grass: document.getElementById("grass-count"),
  herbs: document.getElementById("herb-count"),
  preds: document.getElementById("pred-count"),
  herbAvg: document.getElementById("herb-avg"),
  predAvg: document.getElementById("pred-avg"),
  comment: document.getElementById("comment"),
  reset: document.getElementById("reset"),
  pause: document.getElementById("pause"),
  addGrass: document.getElementById("add-grass"),
  addHerb: document.getElementById("add-herb"),
  addPredator: document.getElementById("add-predator"),
  speedButtons: Array.from(document.querySelectorAll(".speed")),
  worldWrap: document.getElementById("world-wrap"),
  setup: document.getElementById("setup"),
  setupForm: document.getElementById("setup-form"),
  setupWidth: document.getElementById("setup-width"),
  setupHeight: document.getElementById("setup-height"),
  setupGrass: document.getElementById("setup-grass"),
  setupHerbs: document.getElementById("setup-herbs"),
  setupPredators: document.getElementById("setup-predators")
};

const LIMITS = { grass: 400, herbs: 120, predators: 50, deaths: 80, effects: 140 };
const DEFAULT_SETTINGS = { width: 390, height: 500, grass: 150, herbs: 25, predators: 6 };
const RANGES = {
  herb: {
    speed: [32, 82],
    vision: [50, 135],
    size: [3.2, 7.2],
    maxEnergy: [70, 160],
    metabolism: [1.2, 3.8],
    reproduceThreshold: [62, 112],
    lifespan: [85, 210],
    colorHue: [170, 235]
  },
  predator: {
    speed: [20, 48],
    vision: [48, 105],
    size: [4.8, 9.5],
    maxEnergy: [90, 210],
    metabolism: [3.4, 6.4],
    reproduceThreshold: [175, 275],
    lifespan: [95, 230],
    colorHue: [350, 382]
  }
};

let settings = { ...DEFAULT_SETTINGS };
let world = { width: 0, height: 0, dpr: 1 };
let grass = [];
let herbs = [];
let predators = [];
let deaths = [];
let effects = [];
let elapsed = 0;
let nextId = 1;
let paused = true;
let started = false;
let speedMultiplier = 1;
let lastFrame = performance.now();
let grassTimer = 0;
let uiTimer = 0;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

function setInitialInputs() {
  const availableWidth = Math.max(280, Math.min(window.innerWidth - 20, 520));
  ui.setupWidth.value = Math.round(availableWidth);
  ui.setupHeight.value = DEFAULT_SETTINGS.height;
}

function readSettings() {
  return {
    width: clamp(Number(ui.setupWidth.value) || DEFAULT_SETTINGS.width, 280, 900),
    height: clamp(Number(ui.setupHeight.value) || DEFAULT_SETTINGS.height, 320, 1200),
    grass: clamp(Number(ui.setupGrass.value) || 0, 0, LIMITS.grass),
    herbs: clamp(Number(ui.setupHerbs.value) || 0, 0, LIMITS.herbs),
    predators: clamp(Number(ui.setupPredators.value) || 0, 0, LIMITS.predators)
  };
}

function applyWorldSize() {
  ui.worldWrap.style.setProperty("--canvas-width", `${settings.width}px`);
  ui.worldWrap.style.setProperty("--canvas-height", `${settings.height}px`);
  resizeCanvas();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  world.dpr = Math.min(window.devicePixelRatio || 1, 2);
  world.width = Math.max(280, rect.width);
  world.height = Math.max(280, rect.height);
  canvas.width = Math.floor(world.width * world.dpr);
  canvas.height = Math.floor(world.height * world.dpr);
  ctx.setTransform(world.dpr, 0, 0, world.dpr, 0, 0);
}

function randomGenes(type) {
  const genes = {};
  Object.entries(RANGES[type]).forEach(([key, range]) => {
    genes[key] = rand(range[0], range[1]);
  });
  return genes;
}

function mutateGenes(type, source) {
  const genes = {};
  Object.entries(RANGES[type]).forEach(([key, range]) => {
    const change = key === "colorHue" ? rand(-8, 8) : source[key] * rand(-0.1, 0.1);
    genes[key] = clamp(source[key] + change, range[0], range[1]);
  });
  return genes;
}

function makeAnimal(type, x = rand(20, world.width - 20), y = rand(20, world.height - 20), genes = randomGenes(type), generation = 1) {
  return {
    id: nextId++,
    type,
    x,
    y,
    vx: rand(-1, 1),
    vy: rand(-1, 1),
    wander: rand(0, Math.PI * 2),
    wanderTimer: rand(0, 2),
    genes,
    energy: genes.maxEnergy * rand(0.45, 0.78),
    age: 0,
    generation,
    births: 0,
    elite: false,
    breeding: false,
    breedingTimer: 0,
    breedingDuration: 0
  };
}

function addGrass(count, clustered = true) {
  for (let i = 0; i < count && grass.length < LIMITS.grass; i += 1) {
    let x = rand(5, world.width - 5);
    let y = rand(5, world.height - 5);
    if (clustered && grass.length && Math.random() < 0.72) {
      const base = grass[Math.floor(Math.random() * grass.length)];
      const angle = rand(0, Math.PI * 2);
      const radius = rand(4, 42);
      x = clamp(base.x + Math.cos(angle) * radius, 4, world.width - 4);
      y = clamp(base.y + Math.sin(angle) * radius, 4, world.height - 4);
    }
    grass.push({ x, y, seed: Math.random() });
  }
}

function addAnimals(type, count) {
  const collection = type === "herb" ? herbs : predators;
  const limit = type === "herb" ? LIMITS.herbs : LIMITS.predators;
  for (let i = 0; i < count && collection.length < limit; i += 1) {
    collection.push(makeAnimal(type));
  }
  updateStats();
}

function addEffect(x, y, kind, hue = 110, size = 8) {
  const colors = {
    grass: ["#78e05b", "#b5ff78"],
    prey: ["#ff6b35", "#ffd166"],
    remove: ["#f7f1c9", "#ffffff"],
    birth: ["#f2c94c", "#fff2a6"]
  };
  const palette = colors[kind] || colors.remove;
  effects.push({ type: "ring", x, y, hue, size, life: 0.42, total: 0.42, color: palette[0] });
  const count = kind === "grass" ? 7 : 11;
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(18, kind === "prey" ? 72 : 48);
    effects.push({
      type: "particle",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: rand(1.2, 2.8),
      life: rand(0.32, 0.62),
      total: 0.62,
      color: palette[Math.floor(Math.random() * palette.length)]
    });
  }
  if (effects.length > LIMITS.effects) effects.splice(0, effects.length - LIMITS.effects);
}

function reset() {
  grass = [];
  herbs = [];
  predators = [];
  deaths = [];
  effects = [];
  elapsed = 0;
  nextId = 1;
  grassTimer = 0;
  paused = false;
  started = true;
  ui.pause.textContent = "一時停止";
  applyWorldSize();
  addGrass(settings.grass, false);
  for (let i = 0; i < settings.herbs; i += 1) herbs.push(makeAnimal("herb"));
  for (let i = 0; i < settings.predators; i += 1) predators.push(makeAnimal("predator"));
  updateElite();
  updateStats();
}

function findNearest(source, items, vision) {
  let nearest = null;
  let nearestDistance = vision * vision;
  for (let i = 0; i < items.length; i += 1) {
    const d = distSq(source, items[i]);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = items[i];
    }
  }
  return nearest;
}

function steer(animal, targetX, targetY, strength) {
  const dx = targetX - animal.x;
  const dy = targetY - animal.y;
  const len = Math.hypot(dx, dy) || 1;
  animal.vx += (dx / len) * strength;
  animal.vy += (dy / len) * strength;
}

function wander(animal, dt) {
  animal.wanderTimer -= dt;
  if (animal.wanderTimer <= 0) {
    animal.wander += rand(-1.8, 1.8);
    animal.wanderTimer = rand(0.45, 1.4);
  }
  animal.vx += Math.cos(animal.wander) * 0.34;
  animal.vy += Math.sin(animal.wander) * 0.34;
}

function moveAnimal(animal, dt, speedScale = 1) {
  const len = Math.hypot(animal.vx, animal.vy) || 1;
  animal.vx = (animal.vx / len) * animal.genes.speed * speedScale;
  animal.vy = (animal.vy / len) * animal.genes.speed * speedScale;
  animal.x += animal.vx * dt;
  animal.y += animal.vy * dt;
  animal.vx *= 0.78;
  animal.vy *= 0.78;

  const pad = animal.genes.size + 2;
  if (animal.x < pad || animal.x > world.width - pad) {
    animal.x = clamp(animal.x, pad, world.width - pad);
    animal.vx *= -0.45;
    animal.wander = Math.PI - animal.wander;
  }
  if (animal.y < pad || animal.y > world.height - pad) {
    animal.y = clamp(animal.y, pad, world.height - pad);
    animal.vy *= -0.45;
    animal.wander = -animal.wander;
  }
}

function killAnimal(animal, effectKind = null) {
  deaths.push({
    x: animal.x,
    y: animal.y,
    hue: animal.genes.colorHue,
    size: animal.genes.size,
    life: 0.75,
    total: 0.75,
    type: animal.type
  });
  if (deaths.length > LIMITS.deaths) deaths.shift();
  if (effectKind) addEffect(animal.x, animal.y, effectKind, animal.genes.colorHue, animal.genes.size);
}

function startBreeding(animal, collection, limit) {
  if (animal.breeding || collection.length >= limit) return;
  const pressure = collection.length / limit;
  const threshold = animal.genes.reproduceThreshold * (1 + Math.max(0, pressure - 0.72) * 1.8);
  if (animal.energy < threshold) return;
  animal.breeding = true;
  animal.breedingDuration = rand(0.5, 1);
  animal.breedingTimer = animal.breedingDuration;
}

function finishBreeding(animal, collection, limit) {
  animal.breeding = false;
  if (collection.length >= limit || animal.energy <= 0) return;
  const angle = rand(0, Math.PI * 2);
  const child = makeAnimal(
    animal.type,
    clamp(animal.x + Math.cos(angle) * 12, 8, world.width - 8),
    clamp(animal.y + Math.sin(angle) * 12, 8, world.height - 8),
    mutateGenes(animal.type, animal.genes),
    animal.generation + 1
  );
  child.energy = child.genes.maxEnergy * 0.44;
  collection.push(child);
  animal.energy *= 0.55;
  animal.births += 1;
  addEffect(animal.x, animal.y, "birth", animal.genes.colorHue, animal.genes.size + 5);
}

function updateBreeding(animal, dt, collection, limit) {
  if (!animal.breeding) return false;
  animal.breedingTimer -= dt;
  if (animal.breedingTimer <= 0) finishBreeding(animal, collection, limit);
  return true;
}

function updateHerbivores(dt) {
  for (let i = herbs.length - 1; i >= 0; i -= 1) {
    const herb = herbs[i];
    herb.age += dt;
    herb.energy -= herb.genes.metabolism * dt;

    const isBreeding = updateBreeding(herb, dt, herbs, LIMITS.herbs);
    if (!isBreeding) {
      const threat = findNearest(herb, predators, herb.genes.vision * 1.15);
      if (threat) {
        steer(herb, herb.x + (herb.x - threat.x), herb.y + (herb.y - threat.y), 2.15);
      } else {
        const food = findNearest(herb, grass, herb.genes.vision);
        if (food) steer(herb, food.x, food.y, 1.1);
        else wander(herb, dt);
      }
    }

    moveAnimal(herb, dt, isBreeding ? 0.14 : 1);

    if (!isBreeding) {
      for (let g = grass.length - 1; g >= 0; g -= 1) {
        const blade = grass[g];
        const eatDistance = herb.genes.size + 3.2;
        if (distSq(herb, blade) < eatDistance * eatDistance) {
          grass.splice(g, 1);
          herb.energy = Math.min(herb.genes.maxEnergy, herb.energy + 30);
          addEffect(blade.x, blade.y, "grass", 110, 5);
          break;
        }
      }
    }

    startBreeding(herb, herbs, LIMITS.herbs);
    if (herb.energy <= 0 || herb.age > herb.genes.lifespan) {
      killAnimal(herb);
      herbs.splice(i, 1);
    }
  }
}

function updatePredators(dt) {
  for (let i = predators.length - 1; i >= 0; i -= 1) {
    const predator = predators[i];
    predator.age += dt;
    predator.energy -= predator.genes.metabolism * dt;

    const isBreeding = updateBreeding(predator, dt, predators, LIMITS.predators);
    if (!isBreeding) {
      const prey = findNearest(predator, herbs, predator.genes.vision);
      if (prey) steer(predator, prey.x, prey.y, 1.18);
      else wander(predator, dt);
    }

    moveAnimal(predator, dt, isBreeding ? 0.12 : 1);

    if (!isBreeding) {
      for (let h = herbs.length - 1; h >= 0; h -= 1) {
        const target = herbs[h];
        const catchDistance = predator.genes.size + target.genes.size * 0.45;
        if (distSq(predator, target) < catchDistance * catchDistance) {
          killAnimal(target, "prey");
          herbs.splice(h, 1);
          predator.energy = Math.min(predator.genes.maxEnergy, predator.energy + 44);
          break;
        }
      }
    }

    startBreeding(predator, predators, LIMITS.predators);
    if (predator.energy <= 0 || predator.age > predator.genes.lifespan) {
      killAnimal(predator);
      predators.splice(i, 1);
    }
  }
}

function updateGrass(dt) {
  grassTimer += dt;
  const scarceBonus = grass.length < 70 ? 3.6 : grass.length < 130 ? 1.7 : 1;
  const interval = 0.18 / scarceBonus;
  while (grassTimer >= interval) {
    grassTimer -= interval;
    addGrass(grass.length < 35 ? 3 : 1, true);
  }
}

function updateDeaths(dt) {
  for (let i = deaths.length - 1; i >= 0; i -= 1) {
    deaths[i].life -= dt;
    if (deaths[i].life <= 0) deaths.splice(i, 1);
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i -= 1) {
    const effect = effects[i];
    effect.life -= dt;
    if (effect.type === "particle") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vx *= 0.92;
      effect.vy *= 0.92;
    }
    if (effect.life <= 0) effects.splice(i, 1);
  }
}

function updateElite() {
  const all = herbs.concat(predators);
  all.forEach((animal) => {
    animal.elite = false;
  });
  all
    .filter((animal) => animal.age > 18 || animal.births > 0)
    .sort((a, b) => (b.age + b.births * 36 + b.generation * 4) - (a.age + a.births * 36 + a.generation * 4))
    .slice(0, 6)
    .forEach((animal) => {
      animal.elite = true;
    });
}

function step(dt) {
  elapsed += dt;
  updateGrass(dt);
  updateHerbivores(dt);
  updatePredators(dt);
  updateDeaths(dt);
  updateEffects(dt);
}

function average(items, key) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.genes[key], 0) / items.length;
}

function ecosystemComment() {
  if (!started) return "開始設定を選んでください";
  if (!herbs.length && !predators.length) return "生態系が途絶えました";
  if (grass.length < 45 || (!grass.length && herbs.length)) return "草が不足しています";
  if (herbs.length < 8 && predators.length > 5) return "生態系が崩壊しそうです";
  if (predators.length > herbs.length * 0.35 && predators.length > 8) return "肉食動物が優勢です";
  if (herbs.length > 55 && grass.length < 120) return "草食動物が増えています";
  if (grass.length > 260) return "草が豊富です";
  return "新しいバランスに落ち着いています";
}

function updateStats() {
  updateElite();
  const maxGeneration = herbs.concat(predators).reduce((max, animal) => Math.max(max, animal.generation), 1);
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60).toString().padStart(2, "0");
  ui.time.textContent = `${minutes}:${seconds}`;
  ui.generation.textContent = maxGeneration;
  ui.grass.textContent = grass.length;
  ui.herbs.textContent = herbs.length;
  ui.preds.textContent = predators.length;
  ui.herbAvg.textContent = herbs.length ? `${average(herbs, "speed").toFixed(1)} / ${average(herbs, "vision").toFixed(0)}` : "-- / --";
  ui.predAvg.textContent = predators.length ? `${average(predators, "speed").toFixed(1)} / ${average(predators, "vision").toFixed(0)}` : "-- / --";
  ui.comment.textContent = ecosystemComment();
}

function energyLook(animal) {
  const ratio = clamp(animal.energy / animal.genes.maxEnergy, 0, 1);
  return {
    ratio,
    alpha: 0.34 + ratio * 0.66,
    saturation: animal.type === "herb" ? 42 + ratio * 38 : 48 + ratio * 40,
    light: animal.type === "herb" ? 68 - ratio * 18 : 72 - ratio * 24
  };
}

function drawGrass() {
  ctx.save();
  ctx.lineWidth = 1.35;
  for (const blade of grass) {
    const sway = Math.sin(elapsed * 2.2 + blade.seed * 10) * 0.7;
    const x = blade.x + sway;
    const y = blade.y;
    ctx.strokeStyle = blade.seed > 0.55 ? "#78d957" : "#55b945";
    ctx.fillStyle = blade.seed > 0.55 ? "#76d958" : "#4ea83d";
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y - 3.5);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 3.2, y - 3, x - 5, y - 1);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3.2, y - 3, x + 5, y - 1);
    ctx.stroke();
    if (blade.seed > 0.72) {
      ctx.beginPath();
      ctx.ellipse(x - 2, y - 1.5, 1.5, 2.6, -0.7, 0, Math.PI * 2);
      ctx.ellipse(x + 2, y - 1.5, 1.5, 2.6, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBreedingRing(animal) {
  if (!animal.breeding) return;
  const progress = 1 - clamp(animal.breedingTimer / animal.breedingDuration, 0, 1);
  ctx.strokeStyle = `rgba(242, 201, 76, ${0.75 - progress * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(animal.x, animal.y, animal.genes.size + 8 + progress * 7, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAnimal(animal) {
  const g = animal.genes;
  const hue = ((g.colorHue % 360) + 360) % 360;
  const look = energyLook(animal);
  const pulse = animal.elite ? Math.sin(elapsed * 5) * 0.12 + 1 : 1;
  const angle = Math.atan2(animal.vy, animal.vx);

  if (animal.elite) {
    ctx.strokeStyle = "rgba(242, 201, 76, 0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(animal.x, animal.y, g.vision * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 232, 130, 0.78)";
    ctx.beginPath();
    ctx.arc(animal.x, animal.y, g.size + 5 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawBreedingRing(animal);

  ctx.save();
  ctx.globalAlpha = look.alpha;
  ctx.translate(animal.x, animal.y);
  ctx.rotate(angle);
  ctx.fillStyle = `hsl(${hue} ${look.saturation}% ${look.light}%)`;
  ctx.strokeStyle = `rgba(8, 13, 8, ${0.24 + look.ratio * 0.2})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (animal.type === "herb") {
    ctx.ellipse(0, 0, g.size * 1.45 * pulse, g.size * 0.92 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.22 + look.ratio * 0.32})`;
    ctx.beginPath();
    ctx.arc(-g.size * 0.35, -g.size * 0.22, Math.max(1, g.size * 0.22), 0, Math.PI * 2);
    ctx.fill();
    if (look.ratio < 0.28) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.52)";
      ctx.beginPath();
      ctx.moveTo(-g.size, g.size * 1.15);
      ctx.lineTo(g.size, g.size * 1.15);
      ctx.stroke();
    }
  } else {
    const size = g.size * pulse;
    ctx.moveTo(size * 1.75, 0);
    ctx.lineTo(-size * 0.75, size * 1.1);
    ctx.lineTo(-size * 0.35, size * 0.22);
    ctx.lineTo(-size * 1.45, 0);
    ctx.lineTo(-size * 0.35, -size * 0.22);
    ctx.lineTo(-size * 0.75, -size * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 245, 210, ${0.18 + look.ratio * 0.36})`;
    ctx.beginPath();
    ctx.arc(size * 0.48, -size * 0.28, Math.max(1, size * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDeaths() {
  for (const death of deaths) {
    const ratio = death.life / death.total;
    ctx.strokeStyle = `hsla(${death.hue} 70% 62% / ${ratio * 0.38})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(death.x, death.y, death.size + (1 - ratio) * 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEffects() {
  for (const effect of effects) {
    const ratio = clamp(effect.life / effect.total, 0, 1);
    if (effect.type === "ring") {
      ctx.strokeStyle = effect.color.replace(")", ` / ${ratio})`).replace("rgb", "rgba");
      ctx.globalAlpha = ratio;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size + (1 - ratio) * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = ratio;
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#263425";
  ctx.fillRect(0, 0, world.width, world.height);
  drawGrass();
  drawDeaths();
  herbs.forEach(drawAnimal);
  predators.forEach(drawAnimal);
  drawEffects();
}

function removeNearestAt(x, y) {
  const tap = { x, y };
  let best = { type: null, index: -1, distance: 26 * 26 };
  const check = (type, items, radiusBonus = 0) => {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const radius = type === "grass" ? 12 : item.genes.size + radiusBonus + 12;
      const d = distSq(tap, item);
      if (d < best.distance && d < radius * radius) best = { type, index: i, distance: d };
    }
  };
  check("grass", grass);
  check("herb", herbs, 4);
  check("predator", predators, 4);

  if (best.index < 0) return;
  if (best.type === "grass") {
    const [removed] = grass.splice(best.index, 1);
    addEffect(removed.x, removed.y, "remove", 90, 5);
  } else if (best.type === "herb") {
    const [removed] = herbs.splice(best.index, 1);
    killAnimal(removed, "remove");
  } else {
    const [removed] = predators.splice(best.index, 1);
    killAnimal(removed, "remove");
  }
  updateStats();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  return {
    x: (point.clientX - rect.left) * (world.width / rect.width),
    y: (point.clientY - rect.top) * (world.height / rect.height)
  };
}

function loop(now) {
  const realDt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!paused && started) {
    step(realDt * speedMultiplier);
  } else {
    updateEffects(realDt);
    updateDeaths(realDt);
  }

  uiTimer += realDt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    updateStats();
  }
  render();
  requestAnimationFrame(loop);
}

ui.setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  settings = readSettings();
  ui.setup.classList.add("is-hidden");
  reset();
});

ui.reset.addEventListener("click", reset);
ui.pause.addEventListener("click", () => {
  if (!started) return;
  paused = !paused;
  ui.pause.textContent = paused ? "再開" : "一時停止";
});
ui.addGrass.addEventListener("click", () => {
  addGrass(20, false);
  updateStats();
});
ui.addHerb.addEventListener("click", () => addAnimals("herb", 5));
ui.addPredator.addEventListener("click", () => addAnimals("predator", 2));
ui.speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    speedMultiplier = Number(button.dataset.speed);
    ui.speedButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

canvas.addEventListener("pointerdown", (event) => {
  if (!started) return;
  const point = canvasPoint(event);
  removeNearestAt(point.x, point.y);
});

window.addEventListener("resize", () => {
  applyWorldSize();
  grass.forEach((blade) => {
    blade.x = clamp(blade.x, 4, world.width - 4);
    blade.y = clamp(blade.y, 4, world.height - 4);
  });
  herbs.concat(predators).forEach((animal) => {
    animal.x = clamp(animal.x, 8, world.width - 8);
    animal.y = clamp(animal.y, 8, world.height - 8);
  });
});

setInitialInputs();
settings = readSettings();
applyWorldSize();
updateStats();
requestAnimationFrame((now) => {
  lastFrame = now;
  requestAnimationFrame(loop);
});
