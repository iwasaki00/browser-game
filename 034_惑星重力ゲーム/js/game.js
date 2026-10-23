import { DEFAULT_PHYSICS, createSimulation, stepSimulation, gravitationalAcceleration } from "./physics.js";
import { PreviewController, loadPreviewEnabled, savePreviewEnabled } from './preview.js';
import { getStage } from "./stages.js";
import { loadGameMode, saveGameMode, stepLiveFlight } from './live-gravity.js';
import { configurePlanet, placementAllowed, addPlanet, MAX_PLANETS } from './planets.js';
import { loadLaunchMode, saveLaunchMode, velocityFromAngleSpeed, slingshotLaunch, classifyDragTarget } from "./launch.js";

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
let selectedPlanetId = stage.planets[0]?.id;
const planetType = document.querySelector('#planetType');
const planetSize = document.querySelector('#planetSize');
const addPlanetButton = document.querySelector('#addPlanet');
const deletePlanetButton = document.querySelector('#deletePlanet');
let simulation = null;
let trail = [];
let mode = "editing";
let accumulator = 0;
let physicsStepCount = 0;
let lastTime = performance.now();
let gesture = null;
let aim = null;
const pointers = new Set();
let storage;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let launchMode = loadLaunchMode(storage);
let gameMode = loadGameMode(storage);
let launchSnapshot = null;
let moveTargets = {};
const gameModeInput = document.querySelector('#gameMode');
const preview = new PreviewController(loadPreviewEnabled(storage));
const previewButton = document.querySelector('#previewToggle');
const gravityButton = document.querySelector('#gravityToggle');
let showGravity = false;
const modeButtons = [...document.querySelectorAll('[data-launch-mode]')];
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
  if (planet.id === selectedPlanetId && (mode === 'editing' || gameMode === 'live')) {
    ctx.strokeStyle = '#fff1a6'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius+7, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
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
    ? (aim && !aim.cancelled ? aim.angleDeg : Number(angleInput.value)) * Math.PI / 180
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

  if (editing && (launchMode === 'precision' || (aim && !aim.cancelled))) {
    const length = 34 + ((aim?.speed ?? Number(speedInput.value)) - 120) * .22;
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
  drawGravity();
  drawPrediction();
  drawGoal(time);
  drawTrail();
  for (const planet of stage.planets) drawPlanet(planet);
  if (mode === 'flying' && gameMode === 'live') for(const planet of stage.planets) {
    const target=moveTargets[planet.id];if(!target)continue;
    ctx.strokeStyle='#ffdb80';ctx.lineWidth=1;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(planet.x,planet.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(target.x,target.y,6,0,Math.PI*2);ctx.stroke();
  }
  const rocket = simulation?.rocket ?? {
    position: stage.launch.position,
    velocity: { x: 0, y: 0 },
  };
  drawRocket(rocket, mode === "editing");
  if (mode === 'editing' && launchMode === 'slingshot') {
    const origin = stage.launch.position;
    ctx.strokeStyle = aim?.cancelled ? '#ffb66f' : '#65e1ff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 28, 0, Math.PI * 2); ctx.stroke();
    if (gesture?.type === 'rocket') {
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(gesture.point.x, gesture.point.y); ctx.stroke();
      ctx.fillStyle = '#c6f3ff'; ctx.font = '700 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(aim.cancelled ? 'CANCEL' : `POWER ${Math.round(aim.speed)}`, 12, 36);
    }
  }

  if (mode === "flying") {
    ctx.fillStyle = "rgba(3, 9, 18, .8)";
    roundRect(286, 466, 78, 22, 5); ctx.fill();
    ctx.fillStyle = "#a8bed0";
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`T+${simulation.elapsed.toFixed(1)}s`, 325, 480);
  }
}

function drawGravity() {
  if (!showGravity || mode !== 'editing') return;
  const planet = stage.planets.find(p => p.id === selectedPlanetId);
  if (!planet) return;
  const gradient = ctx.createRadialGradient(planet.x, planet.y, planet.radius, planet.x, planet.y, 200);
  for (const fraction of [0, .2, .5, 1]) {
    const radius = planet.radius + (200 - planet.radius) * fraction;
    const acceleration = gravitationalAcceleration({x:planet.x+radius,y:planet.y},[planet]);
    const strength = Math.min(1, Math.hypot(acceleration.x,acceleration.y)/250);
    const hue = 220 * (1-strength);
    gradient.addColorStop(fraction, `hsla(${hue},95%,60%,${.08 + strength*.18})`);
  }
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(planet.x,planet.y,200,0,Math.PI*2); ctx.fill();
}

function drawPrediction() {
  const velocity = aim && !aim.cancelled ? aim.velocity : velocityFromAngleSpeed(Number(angleInput.value),Number(speedInput.value));
  const job = preview.update(stage, velocity, mode === 'editing');
  if (!job || job.points.length < 2) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,stage.world.width,stage.world.height); ctx.clip();
  ctx.strokeStyle = job.state.status === 'cleared' ? '#75f5af' : '#69dfff';
  ctx.lineWidth = 1.4; ctx.setLineDash([3,5]);
  ctx.beginPath(); ctx.moveTo(job.points[0].x,job.points[0].y);
  // Keep every fourth sample and always the terminal point (at most 362 points).
  for(let i=4;i<job.points.length-1;i+=4) ctx.lineTo(job.points[i].x,job.points[i].y);
  const end = job.points.at(-1); ctx.lineTo(end.x,end.y); ctx.stroke(); ctx.setLineDash([]);
  if(job.state.status === 'crashed') {
    ctx.strokeStyle='#ff6d77'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(end.x-5,end.y-5);ctx.lineTo(end.x+5,end.y+5);ctx.moveTo(end.x+5,end.y-5);ctx.lineTo(end.x-5,end.y+5);ctx.stroke();
  }
  ctx.restore();
}

function setEditingControls(enabled) {
  angleInput.disabled = !enabled;
  speedInput.disabled = !enabled;
  launchButton.disabled = !enabled;
  editHint.hidden = !enabled;
  modeButtons.forEach(button => { button.disabled = !enabled; });
  updatePlanetEditor();
  gameModeInput.disabled = !enabled;
  previewButton.disabled = !enabled;
  updateGameMode();
}

function launch(velocity = velocityFromAngleSpeed(Number(angleInput.value), Number(speedInput.value))) {
  if (mode !== "editing") return;
  cancelGesture();
  launchSnapshot = structuredClone(stage);
  moveTargets = {};
  simulation = createSimulation(stage, { velocity });
  trail = [{ ...simulation.rocket.position }];
  mode = "flying";
  preview.clear();
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
  if (gameMode === 'live' && launchSnapshot) stage = structuredClone(launchSnapshot);
  moveTargets = {};
  preview.clear();
  cancelGesture();
  simulation = null;
  trail = [];
  mode = "editing";
  result.hidden = true;
  setEditingControls(true);
  statusText.textContent = "惑星を動かして、軌道をつくれ。";
}

function reset() {
  stage = launchSnapshot ? structuredClone(launchSnapshot) : getStage(initialStage.id);
  selectedPlanetId = stage.planets[0]?.id;
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
      simulation = stepLiveFlight(simulation, moveTargets, stage, gameMode, dt);
      if (gameMode === 'live') stage.planets = simulation.planets.map(p=>({...p}));
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

function cancelGesture() {
  const previous = gesture;
  if(previous?.type === 'planet') delete moveTargets[previous.id];
  gesture = null;
  aim = null;
  if (previous && canvas.hasPointerCapture(previous.pointerId)) canvas.releasePointerCapture(previous.pointerId);
}

function updateMode() {
  cancelGesture();
  const sling = launchMode === 'slingshot';
  document.querySelector('.controls').classList.toggle('is-slingshot', sling);
  document.querySelector('#precisionSettings').hidden = sling;
  document.querySelector('#slingshotGuide').hidden = !sling;
  launchButton.hidden = sling;
  document.querySelector('#editHintText').textContent = sling ? 'ロケットを引いて離す / 惑星はドラッグ' : '惑星をドラッグ';
  modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.launchMode === launchMode)));
}

window.addEventListener('pointerdown', event => {
  pointers.add(event.pointerId);
  if (pointers.size > 1) cancelGesture();
}, true);
canvas.addEventListener("pointerdown", (event) => {
  if ((mode !== 'editing' && !(mode === 'flying' && gameMode === 'live')) || pointers.size !== 1 || event.button !== 0) return;
  const point = worldPoint(event);
  const target = classifyDragTarget(point, stage.launch.position, stage.planets, mode === 'flying' ? 'precision' : launchMode,
    { rocketTouchRadius: Math.max(28,22/view.scale), minimumPlanetTouchRadius: 22/view.scale });
  if (!target) return;
  if (target.type === 'planet') { selectedPlanetId = target.id; updatePlanetEditor(); }
  gesture = { ...target, pointerId: event.pointerId, point };
  if (target.type === 'rocket') aim = slingshotLaunch(stage.launch.position, point);
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId || (mode !== 'editing' && !(mode === 'flying' && gameMode === 'live'))) return;
  const point = worldPoint(event);
  gesture.point = point;
  if (gesture.type === 'rocket') {
    aim = slingshotLaunch(stage.launch.position, point);
  } else {
    const planet = stage.planets.find(item => item.id === gesture.id);
    if(mode === 'flying') { moveTargets[planet.id] = point; event.preventDefault(); return; }
    const candidate = { ...planet, x: Math.max(planet.radius, Math.min(stage.world.width-planet.radius,point.x)), y: Math.max(planet.radius, Math.min(stage.world.height-planet.radius,point.y)) };
    if (placementAllowed(candidate, stage)) Object.assign(planet, candidate);
  }
  event.preventDefault();
});

function stopDragging(event) {
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const shot = gesture.type === 'rocket' && event.type === 'pointerup' && pointers.size === 1
    ? slingshotLaunch(stage.launch.position, worldPoint(event)) : null;
  cancelGesture();
  if (shot && !shot.cancelled && mode === 'editing') launch(shot.velocity);
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener('lostpointercapture', cancelGesture);
window.addEventListener('pointerup', event => pointers.delete(event.pointerId));
window.addEventListener('pointercancel', event => pointers.delete(event.pointerId));
window.addEventListener('blur', () => { cancelGesture(); pointers.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelGesture(); pointers.clear(); } });
modeButtons.forEach(button => button.addEventListener('click', () => {
  if (mode !== 'editing') return;
  launchMode = saveLaunchMode(storage, button.dataset.launchMode);
  updateMode();
}));
angleInput.addEventListener("input", updateOutputs);
speedInput.addEventListener("input", updateOutputs);
launchButton.addEventListener("click", () => { if (launchMode === 'precision') launch(); });
resetButton.addEventListener("click", reset);
retryButton.addEventListener("click", retry);
new ResizeObserver(resizeCanvas).observe(frame);

function updatePlanetEditor() {
  const planet = stage.planets.find(p=>p.id===selectedPlanetId);
  planetType.value = planet?.type ?? 'earth';
  planetSize.value = planet?.size ?? 'medium';
  planetType.disabled = planetSize.disabled = mode !== 'editing' || !planet;
  addPlanetButton.disabled = mode !== 'editing' || stage.planets.length >= MAX_PLANETS;
  deletePlanetButton.disabled = mode !== 'editing' || !planet;
  document.querySelector('#planetSelection').textContent = planet ? `選択 ${stage.planets.indexOf(planet)+1} / ${stage.planets.length} · M ${planet.mass}` : `惑星 ${stage.planets.length} / 3`;
}
addPlanetButton.addEventListener('click', () => {
  if (mode !== 'editing') return;
  cancelGesture();
  const planet = addPlanet(stage);
  if (planet) selectedPlanetId = planet.id;
  else statusText.textContent = '追加できる空間がありません。';
  updatePlanetEditor();
});
deletePlanetButton.addEventListener('click', () => {
  if (mode !== 'editing') return;
  cancelGesture();
  stage.planets = stage.planets.filter(p=>p.id!==selectedPlanetId);
  selectedPlanetId = stage.planets[0]?.id;
  updatePlanetEditor();
});
function changePlanet() {
  if (mode !== 'editing') return;
  cancelGesture();
  const planet = stage.planets.find(p=>p.id===selectedPlanetId);
  if (!planet) return;
  const candidate = configurePlanet(planet, planetType.value, planetSize.value);
  if (placementAllowed(candidate,stage)) Object.assign(planet,candidate);
  else statusText.textContent = '周囲から離してから種類・サイズを変更してください。';
  updatePlanetEditor();
}
planetType.addEventListener('change',changePlanet);
planetSize.addEventListener('change',changePlanet);
function updatePreviewButton() {
  previewButton.textContent = `予測 ${preview.enabled ? 'ON' : 'OFF'}`;
  previewButton.setAttribute('aria-pressed',String(preview.enabled));
}
previewButton.addEventListener('click',()=>{
  preview.enabled=!preview.enabled; preview.clear();
  savePreviewEnabled(storage,preview.enabled); updatePreviewButton();
});
gravityButton.addEventListener('click',()=>{
  showGravity=!showGravity;
  gravityButton.textContent=`重力目安 ${showGravity ? 'ON' : 'OFF'}`;
  gravityButton.setAttribute('aria-pressed',String(showGravity));
});
updatePreviewButton();
function updateGameMode() {
  gameModeInput.value=gameMode;
  document.querySelector('#gameModeHelp').textContent=gameMode==='live'?'重力操作：発射後も惑星をドラッグして誘導':'軌道設計：発射後は惑星固定';
}
gameModeInput.addEventListener('change',()=>{
  if(mode!=='editing')return;
  cancelGesture();gameMode=saveGameMode(storage,gameModeInput.value);updateGameMode();
});
updateGameMode();
updatePlanetEditor();
updateOutputs();
updateMode();
resizeCanvas();
requestAnimationFrame(tick);
