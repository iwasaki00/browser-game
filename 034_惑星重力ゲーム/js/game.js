import { DEFAULT_PHYSICS, createSimulation, stepSimulation } from "./physics.js";
import { getStage } from "./stages.js";

const canvas = document.querySelector("#gameCanvas");
const frame = document.querySelector("#spaceFrame");
const ctx = canvas.getContext("2d");
const launchButton = document.querySelector("#launchButton");
const resetButton = document.querySelector("#resetButton");
const retryButton = document.querySelector("#retryButton");
const angleInput = document.querySelector("#angleInput");
const speedInput = document.querySelector("#speedInput");
const angleOutput = document.querySelector("#angleOutput");
const speedOutput = document.querySelector("#speedOutput");
const statusText = document.querySelector("#statusText");
const result = document.querySelector("#result");
const resultLabel = document.querySelector("#resultLabel");
const resultReason = document.querySelector("#resultReason");
const editHint = document.querySelector("#editHint");

const initialStage = getStage();
let stage = getStage();
let simulation = null;
let trail = [];
let mode = "editing";
let accumulator = 0;
let physicsStepCount = 0;
let lastTime = performance.now();
let draggingPlanet = null;
let view = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };

const stars = Array.from({ length: 76 }, (_, i) => ({
  x: (i * 137.5 + 29) % stage.world.width,
  y: (i * 83.7 + 17) % stage.world.height,
  radius: i % 9 === 0 ? 1.1 : i % 3 === 0 ? .7 : .42,
  alpha: .22 + (i % 7) * .08,
}));

function resizeCanvas() {
  const bounds = frame.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(bounds.width * dpr));
  canvas.height = Math.max(1, Math.round(bounds.height * dpr));
  const scale = Math.min(bounds.width / stage.world.width, bounds.height / stage.world.height);
  view = {
    scale,
    offsetX: (bounds.width - stage.world.width * scale) / 2,
    offsetY: (bounds.height - stage.world.height * scale) / 2,
    dpr,
  };
}

function worldPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left - view.offsetX) / view.scale,
    y: (event.clientY - bounds.top - view.offsetY) / view.scale,
  };
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawBackground() {
  ctx.fillStyle = "#030713";
  ctx.fillRect(0, 0, stage.world.width, stage.world.height);
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d9eeff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(57, 104, 145, .11)";
  ctx.lineWidth = .65;
  for (let x = 0; x <= stage.world.width; x += 25) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, stage.world.height); ctx.stroke();
  }
  for (let y = 0; y <= stage.world.height; y += 25) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(stage.world.width, y); ctx.stroke();
  }
}

function drawGoal(time) {
  const { x, y, radius } = stage.goal;
  const pulse = 1 + Math.sin(time * .004) * .07;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(104, 255, 183, .22)";
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#6df5b4";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#96ffd0";
  ctx.font = "700 8px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("GATE", 0, 3);
  ctx.restore();
}

function drawPlanet(planet) {
  const glow = ctx.createRadialGradient(planet.x, planet.y, planet.radius * .5, planet.x, planet.y, planet.radius * 1.7);
  glow.addColorStop(0, "rgba(70, 203, 255, .23)");
  glow.addColorStop(1, "rgba(70, 203, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius * 1.7, 0, Math.PI * 2); ctx.fill();

  const body = ctx.createRadialGradient(planet.x - planet.radius * .35, planet.y - planet.radius * .4, 2, planet.x, planet.y, planet.radius);
  body.addColorStop(0, "#d8faff");
  body.addColorStop(.32, planet.color);
  body.addColorStop(1, "#155477");
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(219, 250, 255, .55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "rgba(114, 225, 255, .2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius + 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(220, 250, 255, .25)";
  ctx.beginPath(); ctx.arc(planet.x - 9, planet.y + 7, 8, 0, Math.PI * 2); ctx.fill();
}

function drawTrail() {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 1; i < trail.length; i += 1) {
    ctx.globalAlpha = .12 + .7 * (i / trail.length);
    ctx.strokeStyle = "#7ce7ff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRocket(rocket, editing = false) {
  const angle = editing
    ? Number(angleInput.value) * Math.PI / 180
    : Math.atan2(rocket.velocity.y, rocket.velocity.x);
  ctx.save();
  ctx.translate(rocket.position.x, rocket.position.y);
  ctx.rotate(angle);
  if (mode === "flying") {
    const flicker = 12 + Math.sin(performance.now() * .03) * 4;
    ctx.fillStyle = "#ff9f43";
    ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-flicker, 0); ctx.lineTo(-8, 3); ctx.fill();
  }
  ctx.fillStyle = "#f6fbff";
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-8, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#47d8ff";
  ctx.beginPath(); ctx.arc(1, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#dc5368";
  ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-9, -8); ctx.lineTo(-7, -1); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(-9, 8); ctx.lineTo(-7, 1); ctx.fill();
  ctx.restore();

  if (editing) {
    const length = 34 + (Number(speedInput.value) - 120) * .22;
    ctx.save();
    ctx.translate(rocket.position.x, rocket.position.y);
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(111, 225, 255, .65)";
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(length, 0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#6fe1ff";
    ctx.beginPath(); ctx.moveTo(length + 5, 0); ctx.lineTo(length - 2, -4); ctx.lineTo(length - 2, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function draw(time) {
  const { dpr, scale, offsetX, offsetY } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  drawBackground();
  drawGoal(time);
  drawTrail();
  for (const planet of stage.planets) drawPlanet(planet);
  const rocket = simulation?.rocket ?? {
    position: stage.launch.position,
    velocity: { x: 0, y: 0 },
  };
  drawRocket(rocket, mode === "editing");

  if (mode === "flying") {
    ctx.fillStyle = "rgba(3, 9, 18, .8)";
    roundRect(286, 466, 78, 22, 5); ctx.fill();
    ctx.fillStyle = "#a8bed0";
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`T+${simulation.elapsed.toFixed(1)}s`, 325, 480);
  }
}

function setEditingControls(enabled) {
  angleInput.disabled = !enabled;
  speedInput.disabled = !enabled;
  launchButton.disabled = !enabled;
  editHint.hidden = !enabled;
}

function launch() {
  if (mode !== "editing") return;
  simulation = createSimulation(stage, {
    angleDeg: Number(angleInput.value),
    speed: Number(speedInput.value),
  });
  trail = [{ ...simulation.rocket.position }];
  mode = "flying";
  accumulator = 0;
  physicsStepCount = 0;
  setEditingControls(false);
  statusText.textContent = "飛行中 — 重力航路を計測しています。";
}

function showResult(status) {
  const messages = {
    crashed: ["MISSION FAILED", "惑星に衝突"],
    escaped: ["MISSION FAILED", "航行エリアを逸脱"],
    timeout: ["MISSION FAILED", "飛行時間を超過"],
    cleared: ["ORBIT LOCKED", "ゲート到達！"],
  };
  const [label, reason] = messages[status];
  resultLabel.textContent = label;
  resultReason.textContent = reason;
  result.classList.toggle("success", status === "cleared");
  result.hidden = false;
  statusText.textContent = status === "cleared" ? "軌道確立。ミッション成功。" : `${reason}。配置を調整して再挑戦。`;
}

function retry() {
  simulation = null;
  trail = [];
  mode = "editing";
  result.hidden = true;
  setEditingControls(true);
  statusText.textContent = "惑星を動かして、軌道をつくれ。";
}

function reset() {
  stage = getStage(initialStage.id);
  angleInput.value = String(stage.launch.angleDeg);
  speedInput.value = String(stage.launch.speed);
  updateOutputs();
  retry();
}

function updateOutputs() {
  angleOutput.value = `${Number(angleInput.value) < 0 ? "−" : ""}${Math.abs(Number(angleInput.value))}°`;
  speedOutput.value = speedInput.value;
}

function tick(time) {
  const frameSeconds = Math.min((time - lastTime) / 1000, .1);
  lastTime = time;
  if (mode === "flying") {
    accumulator += frameSeconds;
    const dt = DEFAULT_PHYSICS.fixedTimeStep;
    while (accumulator >= dt && simulation.status === "flying") {
      simulation = stepSimulation(simulation, dt, DEFAULT_PHYSICS);
      accumulator -= dt;
      physicsStepCount += 1;
      if (physicsStepCount % 3 === 0) trail.push({ ...simulation.rocket.position });
    }
    if (simulation.status !== "flying") {
      trail.push({ ...simulation.rocket.position });
      mode = simulation.status;
      showResult(simulation.status);
    }
  }
  draw(time);
  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", (event) => {
  if (mode !== "editing") return;
  const point = worldPoint(event);
  const planet = stage.planets.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.radius + 12);
  if (!planet) return;
  draggingPlanet = planet;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!draggingPlanet || mode !== "editing") return;
  const point = worldPoint(event);
  draggingPlanet.x = Math.max(draggingPlanet.radius, Math.min(stage.world.width - draggingPlanet.radius, point.x));
  draggingPlanet.y = Math.max(draggingPlanet.radius, Math.min(stage.world.height - draggingPlanet.radius, point.y));
  event.preventDefault();
});

function stopDragging(event) {
  if (!draggingPlanet) return;
  draggingPlanet = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
angleInput.addEventListener("input", updateOutputs);
speedInput.addEventListener("input", updateOutputs);
launchButton.addEventListener("click", launch);
resetButton.addEventListener("click", reset);
retryButton.addEventListener("click", retry);
new ResizeObserver(resizeCanvas).observe(frame);

updateOutputs();
resizeCanvas();
requestAnimationFrame(tick);
