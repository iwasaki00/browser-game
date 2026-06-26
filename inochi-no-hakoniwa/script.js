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
  speedButtons: Array.from(document.querySelectorAll(".speed"))
};

const LIMITS = { grass: 400, herbs: 120, predators: 50, deaths: 80 };
const INITIAL = { grass: 150, herbs: 25, predators: 6 };
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

let world = { width: 0, height: 0, dpr: 1 };
let grass = [];
let herbs = [];
let predators = [];
let deaths = [];
let elapsed = 0;
let nextId = 1;
let paused = false;
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
    elite: false
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

function reset() {
  grass = [];
  herbs = [];
  predators = [];
  deaths = [];
  elapsed = 0;
  nextId = 1;
  grassTimer = 0;
  paused = false;
  ui.pause.textContent = "一時停止";
  addGrass(INITIAL.grass, false);
  for (let i = 0; i < INITIAL.herbs; i += 1) herbs.push(makeAnimal("herb"));
  for (let i = 0; i < INITIAL.predators; i += 1) predators.push(makeAnimal("predator"));
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

function moveAnimal(animal, dt) {
  const len = Math.hypot(animal.vx, animal.vy) || 1;
  animal.vx = (animal.vx / len) * animal.genes.speed;
  animal.vy = (animal.vy / len) * animal.genes.speed;
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

function killAnimal(animal) {
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
}

function reproduce(animal, collection, limit) {
  if (collection.length >= limit) return;
  const pressure = collection.length / limit;
  const threshold = animal.genes.reproduceThreshold * (1 + Math.max(0, pressure - 0.72) * 1.8);
  if (animal.energy < threshold) return;

  animal.energy *= 0.55;
  animal.births += 1;
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
}

function updateHerbivores(dt) {
  for (let i = herbs.length - 1; i >= 0; i -= 1) {
    const herb = herbs[i];
    herb.age += dt;
    herb.energy -= herb.genes.metabolism * dt;

    const threat = findNearest(herb, predators, herb.genes.vision * 1.15);
    if (threat) {
      steer(herb, herb.x + (herb.x - threat.x), herb.y + (herb.y - threat.y), 2.15);
    } else {
      const food = findNearest(herb, grass, herb.genes.vision);
      if (food) steer(herb, food.x, food.y, 1.1);
      else wander(herb, dt);
    }

    moveAnimal(herb, dt);

    for (let g = grass.length - 1; g >= 0; g -= 1) {
      const blade = grass[g];
      const eatDistance = herb.genes.size + 3.2;
      if (distSq(herb, blade) < eatDistance * eatDistance) {
        grass.splice(g, 1);
        herb.energy = Math.min(herb.genes.maxEnergy, herb.energy + 30);
        break;
      }
    }

    reproduce(herb, herbs, LIMITS.herbs);
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

    const prey = findNearest(predator, herbs, predator.genes.vision);
    if (prey) steer(predator, prey.x, prey.y, 1.18);
    else wander(predator, dt);

    moveAnimal(predator, dt);

    for (let h = herbs.length - 1; h >= 0; h -= 1) {
      const target = herbs[h];
      const catchDistance = predator.genes.size + target.genes.size * 0.45;
      if (distSq(predator, target) < catchDistance * catchDistance) {
        killAnimal(target);
        herbs.splice(h, 1);
        predator.energy = Math.min(predator.genes.maxEnergy, predator.energy + 44);
        break;
      }
    }

    reproduce(predator, predators, LIMITS.predators);
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
}

function average(items, key) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.genes[key], 0) / items.length;
}

function ecosystemComment() {
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

function drawGrass() {
  for (const blade of grass) {
    const sway = Math.sin(elapsed * 2.2 + blade.seed * 10) * 0.7;
    ctx.fillStyle = blade.seed > 0.55 ? "#64bf45" : "#4ea33d";
    ctx.beginPath();
    ctx.ellipse(blade.x + sway, blade.y, 1.5, 2.4, sway * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnimal(animal) {
  const g = animal.genes;
  const hue = ((g.colorHue % 360) + 360) % 360;
  const sat = animal.type === "herb" ? 62 : 72;
  const light = animal.type === "herb" ? 50 : 48;
  const pulse = animal.elite ? Math.sin(elapsed * 5) * 0.12 + 1 : 1;

  if (animal.elite) {
    ctx.strokeStyle = "rgba(242, 201, 76, 0.36)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(animal.x, animal.y, g.vision * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 232, 130, 0.8)";
    ctx.beginPath();
    ctx.arc(animal.x, animal.y, g.size + 5 + pulse * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
  ctx.strokeStyle = "rgba(12, 18, 12, 0.34)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (animal.type === "herb") {
    ctx.arc(animal.x, animal.y, g.size * pulse, 0, Math.PI * 2);
  } else {
    const angle = Math.atan2(animal.vy, animal.vx);
    const size = g.size * pulse;
    ctx.moveTo(animal.x + Math.cos(angle) * size * 1.55, animal.y + Math.sin(angle) * size * 1.55);
    ctx.lineTo(animal.x + Math.cos(angle + 2.45) * size, animal.y + Math.sin(angle + 2.45) * size);
    ctx.lineTo(animal.x + Math.cos(angle - 2.45) * size, animal.y + Math.sin(angle - 2.45) * size);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  const energyRatio = clamp(animal.energy / animal.genes.maxEnergy, 0, 1);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + energyRatio * 0.34})`;
  ctx.beginPath();
  ctx.arc(animal.x - g.size * 0.25, animal.y - g.size * 0.35, Math.max(1, g.size * 0.22), 0, Math.PI * 2);
  ctx.fill();
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

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#263425";
  ctx.fillRect(0, 0, world.width, world.height);
  drawGrass();
  drawDeaths();
  herbs.forEach(drawAnimal);
  predators.forEach(drawAnimal);
}

function loop(now) {
  const realDt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (!paused) {
    for (let i = 0; i < speedMultiplier; i += 1) step(realDt);
  }

  uiTimer += realDt;
  if (uiTimer > 0.25) {
    uiTimer = 0;
    updateStats();
  }
  render();
  requestAnimationFrame(loop);
}

ui.reset.addEventListener("click", reset);
ui.pause.addEventListener("click", () => {
  paused = !paused;
  ui.pause.textContent = paused ? "再開" : "一時停止";
});
ui.addGrass.addEventListener("click", () => addGrass(35, true));
ui.speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    speedMultiplier = Number(button.dataset.speed);
    ui.speedButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

window.addEventListener("resize", () => {
  resizeCanvas();
  grass.forEach((blade) => {
    blade.x = clamp(blade.x, 4, world.width - 4);
    blade.y = clamp(blade.y, 4, world.height - 4);
  });
  herbs.concat(predators).forEach((animal) => {
    animal.x = clamp(animal.x, 8, world.width - 8);
    animal.y = clamp(animal.y, 8, world.height - 8);
  });
});

resizeCanvas();
reset();
requestAnimationFrame((now) => {
  lastFrame = now;
  requestAnimationFrame(loop);
});
