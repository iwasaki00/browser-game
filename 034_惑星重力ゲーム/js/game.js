import { DEFAULT_PHYSICS, createSimulation, stepSimulation, gravitationalAcceleration } from "./physics.js";
import { PreviewController, loadPreviewEnabled, savePreviewEnabled } from './preview.js';
import { getStage } from "./stages.js";
import {createFlightRecorder}from'./flight-record.js';
import {createGallery}from'./gallery-ui.js';
import {SpaceExperience, loadExperience, saveExperience, failureKind} from './space-experience.js';
import {SpaceAudio} from './space-audio.js';
import {createSettingsUI} from './settings-ui.js';
import {Camera} from './camera.js';
import {CinematicCamera} from './cinematic-camera.js';
import {ENCOUNTER_TYPES,MAX_ENCOUNTERS,createEncounter,addEncounter,encounterBodies,encounterPlacementAllowed} from './encounters.js';
import {getEncounterSample} from './encounter-samples.js';
import {drawEncounters} from './encounter-render.js';
import {FlightClock} from './flight-clock.js';
import {Starfield} from './starfield.js';
import {createFreeWorld,getHugeSample} from './worlds.js';
import {getHomewardSector,getHomewardDefinition} from './homeward-data.js';
import {newMission,observeMission,missionSatisfied,MISSION_HINT} from './homeward-mission.js';
let missionEvidence=newMission(),flightChoice=null;
import {HomewardProgress,homewardDistance,sectorUnlocked} from './homeward-progress.js';
import {createHomewardUI} from './homeward-ui.js';
import {DESTINATIONS,destination,normalizeVoyage,departurePosition,voyageTargetDistance} from './open-voyage.js';
import {HomewardArchive,migrateHomewardRecords} from './homeward-archive.js';
import {GalleryStore} from './gallery-store.js';
import {TUTORIAL_STEPS,tutorialEntry,tutorialTransition} from './homeward-tutorial.js';
import { CHALLENGES, getChallenge } from './challenges.js';
import {launchAllowed}from'./special-challenges.js';
import {loadProgress,isUnlocked,rateClear,recordClear} from './progress.js';
import { loadGameMode, saveGameMode, stepLiveFlight } from './live-gravity.js';
import { placementAllowed, addPlanet, MAX_PLANETS, PLANET_TYPES,planetExtent } from './planets.js';
import {getSpecialSample} from './special-samples.js';
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
let selectedPlanetId = null;
let selectedEncounterId=null;
const planetType = document.querySelector('#planetType');
const planetSize = document.querySelector('#planetSize');
const addPlanetButton = document.querySelector('#addPlanet');
const deletePlanetButton = document.querySelector('#deletePlanet');
let simulation = null;
let recorder=null;
let trail = [];
let mode = "editing";
const flightClock = new FlightClock({dt:DEFAULT_PHYSICS.fixedTimeStep});
const flightRate = document.querySelector('#flightRate');
function resetFlightRate(){flightClock.reset();lastTime=performance.now();flightRate.value='1';document.querySelector('#flightSpeed').hidden=mode!=='flying';document.querySelector('#effectiveRate').textContent='実効 1×';}
flightRate.addEventListener('change',()=>{if(mode==='flying')flightClock.setRate(flightRate.value);});
let physicsStepCount = 0;
let lastTime = performance.now();
let gesture = null;
let aim = null;
const pointers = new Set();
let storage;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
const homewardProgress=new HomewardProgress(storage);
const homewardArchive=new HomewardArchive(),standardGallery=new GalleryStore();
let experienceSettings = loadExperience(storage);
const audio = new SpaceAudio(experienceSettings.sound, window);
const experience = new SpaceExperience(experienceSettings.quality, kind => audio.play(kind));
const soundButton = document.querySelector('#soundToggle');
const qualityInput = document.querySelector('#effectQuality');
const experienceCue = document.querySelector('#experienceCue');
const settingsUI = createSettingsUI({onOpen:()=>{cancelGesture();clearCameraGesture();}});
const testSoundButton = document.querySelector('#testSound');
let launchMode = loadLaunchMode(storage);
let progress=loadProgress(storage);
let playType='free';
let challengeId=null;
let freeSnapshot=null;
let movement=0;
let gameMode = loadGameMode(storage);
let launchSnapshot = null;
let moveTargets = {};
const gameModeInput = document.querySelector('#gameMode');
const preview = new PreviewController(loadPreviewEnabled(storage));
const previewButton = document.querySelector('#previewToggle');
const gravityButton = document.querySelector('#gravityToggle');
let showGravity = false;
let showMinimap=true;
let tutorialKey='',tutorialTarget='';
const modeButtons = [...document.querySelectorAll('[data-launch-mode]')];
let view = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1 };
const camera=new Camera();
const cinematic=new CinematicCamera();
camera.fit(stage);
const cameraPointers=new Map();
let cameraActive=false;
function syncCamera(){view={...view,...camera.transform};document.querySelector('#cameraZoom').textContent=`${camera.zoom.toFixed(2)}×`;document.querySelector('#cameraMode').value=camera.mode??'fixed';const badge=document.querySelector('#cameraModeBadge'),text=(camera.mode??'fixed').toUpperCase();if(badge.textContent!==text)badge.textContent=text;}
function fitCamera(){const automatic=camera.mode==='cinematic';camera.fit(stage);if(automatic)camera.setMode('cinematic',stage);cinematic.reset();syncCamera();}
function screenPoint(event){const b=canvas.getBoundingClientRect();return {x:event.clientX-b.left,y:event.clientY-b.top};}
function clearCameraGesture(){cameraPointers.clear();cameraActive=false;camera.endGesture();}
function zoomCamera(factor){cancelGesture();if(camera.mode!=='follow')camera.mode='fixed';camera.zoomAt(camera.zoom*factor);syncCamera();}
document.querySelector('#zoomIn').addEventListener('click',()=>zoomCamera(1.25));
document.querySelector('#zoomOut').addEventListener('click',()=>zoomCamera(.8));
document.querySelector('#fitCamera').addEventListener('click',()=>{cancelGesture();camera.fit(stage);cinematic.reset();syncCamera();});
document.querySelector('#cameraMode').addEventListener('change',event=>{cancelGesture();camera.setMode(event.target.value,stage);cinematic.reset();if(simulation)camera.follow(simulation.rocket.position);syncCamera();});
document.querySelector('#minimapToggle').addEventListener('click',event=>{showMinimap=!showMinimap;event.target.textContent=`ミニマップ ${showMinimap?'ON':'OFF'}`;event.target.setAttribute('aria-pressed',String(showMinimap));});
function loadFreeWorld(next){if(playType!=='free'||mode!=='editing')return;stage=next;launchSnapshot=structuredClone(stage);selectedPlanetId=null;syncLaunchControls();angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);retry();updateOutputs();document.querySelector('.mission strong').textContent=stage.name;settingsUI.closeAll();fitCamera();}
document.querySelector('#worldSize').addEventListener('change',event=>loadFreeWorld(createFreeWorld(event.target.value)));
document.querySelector('#hugeSample').addEventListener('change',event=>{if(event.target.value)loadFreeWorld(getHugeSample(event.target.value));event.target.value='';});

const starfield = new Starfield();

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(bounds.width * dpr));
  canvas.height = Math.max(1, Math.round(bounds.height * dpr));
  view.dpr=dpr;camera.resize(bounds.width,bounds.height);if(camera.mode==='overview')camera.fit(stage);syncCamera();
}

function worldPoint(event) {
  return camera.toWorld(screenPoint(event));
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawBackground(time) {
  ctx.fillStyle = "#030713";
  ctx.fillRect(0, 0, stage.world.width, stage.world.height);
  const light = experience.quality === 'light';
  const viewport={a:camera.toWorld({x:0,y:0}),b:camera.toWorld({x:camera.width,y:camera.height})};
  for (const star of starfield.visible(viewport.a,viewport.b,stage.world,view.scale,light)) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius*Math.max(.55,Math.min(1.2,Math.sqrt(view.scale)))/view.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

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
  ctx.font = `700 ${view.scale<.3?9/view.scale:8}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillText(stage.openVoyage?stage.goal.name:"GATE", 0, view.scale<.3?-radius-5/view.scale:3);
  ctx.restore();
}

function drawPlanet(planet, time) {
  const render=planet.render??PLANET_TYPES[planet.type??'earth'].render;
  const animated = experience.quality === 'standard';
  if(animated && render.style!=='solid') {
    // Two procedural rings per special planet; no texture allocation or particles.
    ctx.save();ctx.strokeStyle=render.glow;ctx.lineWidth=1.2;
    for(let i=0;i<2;i++){
      const phase=(time*.0004+i*.5)%1;
      const inward=render.style==='blackhole';
      const radius=planet.radius+4+(render.style==='dense'?8:22)*(inward?1-phase:phase);
      ctx.globalAlpha=(1-phase)*.42;
      const ripple=render.style==='star'?1+Math.sin(time*.003+i)*.035:1;
      ctx.beginPath();ctx.ellipse(planet.x,planet.y,radius,radius*(render.style==='blackhole'?.65:ripple),-.3,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  for(const hazard of planet.hazards??[]){
    ctx.fillStyle=hazard.reason==='overheated'?'#ff883322':'#a67dff22';
    ctx.strokeStyle=hazard.reason==='overheated'?'#ff9b45':'#bd9dff';
    ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(planet.x,planet.y,hazard.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  }
  if(render.style==='repulsor'||render.style==='blackhole'){
    ctx.strokeStyle=render.glow;ctx.lineWidth=2;
    for(const extra of [5,12]){ctx.beginPath();ctx.ellipse(planet.x,planet.y,planet.radius+extra,(planet.radius+extra)*.65,-.3,0,Math.PI*2);ctx.stroke();}
  }
  if(render.style==='repulsor'){
    ctx.save();ctx.translate(planet.x,planet.y);ctx.strokeStyle=render.glow;
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(planet.radius+8,-3);ctx.lineTo(planet.radius+14,0);ctx.lineTo(planet.radius+8,3);ctx.stroke();}
    ctx.restore();
  }
  if (planet.id === selectedPlanetId) {
    ctx.strokeStyle = '#fff1a6'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(planet.x, planet.y, Math.max(planet.radius+7,9/view.scale), 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  if(animated) {
  const glow = ctx.createRadialGradient(planet.x, planet.y, planet.radius * .5, planet.x, planet.y, planet.radius * 1.7);
  glow.addColorStop(0, render.style==='solid'?"rgba(70, 203, 255, .23)":`${render.glow}55`);
  glow.addColorStop(1, "rgba(70, 203, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius * 1.7, 0, Math.PI * 2); ctx.fill();
  }

  const body = ctx.createRadialGradient(planet.x - planet.radius * .35, planet.y - planet.radius * .4, 2, planet.x, planet.y, planet.radius);
  body.addColorStop(0, render.style==='blackhole'?'#030107':render.style==='star'?'#fff5ae':render.style==='dense'?'#8190a6':"#d8faff");
  body.addColorStop(.32, planet.color);
  body.addColorStop(1, render.style==='blackhole'?'#030107':render.style==='star'?'#dc571c':render.style==='dense'?'#222b3d':"#155477");
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(219, 250, 255, .55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "rgba(114, 225, 255, .2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.radius + 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = render.style==='blackhole'?'#030107':"rgba(220, 250, 255, .25)";
  ctx.beginPath(); ctx.arc(planet.x - 9, planet.y + 7, 8, 0, Math.PI * 2); ctx.fill();
  for(const hazard of planet.hazards??[])if(hazard.radius<=planet.radius){
    ctx.strokeStyle=render.glow;ctx.lineWidth=1;ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.arc(planet.x,planet.y,hazard.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }
}

function drawTrail() {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  const proximity = experience.observer.proximity;
  const color = proximity > .15 ? experience.observer.tint : '#7ce7ff';
  for (let i = 1; i < trail.length; i += 1) {
    ctx.globalAlpha = .12 + .7 * (i / trail.length);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8 + proximity * 1.4,1.2/view.scale);
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  if(experience.quality==='standard') {
    ctx.shadowBlur=4+proximity*5;ctx.shadowColor=color;ctx.globalAlpha=.65;ctx.lineWidth=1.4;
    const start=Math.max(0,trail.length-65);ctx.beginPath();ctx.moveTo(trail[start].x,trail[start].y);
    for(let i=start+1;i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRocket(rocket, editing = false) {
  if(view.scale<.3){ctx.fillStyle='#fff4c4';ctx.beginPath();ctx.arc(rocket.position.x,rocket.position.y,3/view.scale,0,Math.PI*2);ctx.fill();}
  const angle = editing
    ? (aim && !aim.cancelled ? aim.angleDeg : Number(angleInput.value)) * Math.PI / 180
    : Math.atan2(rocket.velocity.y, rocket.velocity.x);
  ctx.save();
  ctx.translate(rocket.position.x, rocket.position.y);
  ctx.rotate(angle);
  if (mode === "flying") {
    statusText.textContent=`T+${simulation.elapsed.toFixed(1)}s · (${Math.round(rocket.position.x)}, ${Math.round(rocket.position.y)}) · ${camera.mode.toUpperCase()}`;
    const flicker = 12 + Math.sin(performance.now() * .03) * 4 + Math.max(0,1-experience.age/.45)*9;
    ctx.fillStyle = "#ff9f43";
    ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-flicker, 0); ctx.lineTo(-8, 3); ctx.fill();
    ctx.fillStyle = '#fff0bb';
    ctx.beginPath();ctx.moveTo(-8,-1.7);ctx.lineTo(-flicker*.8,0);ctx.lineTo(-8,1.7);ctx.fill();
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
  drawBackground(time);
  drawGravity();
  drawPrediction();
  drawGoal(time);
  if(stage.openVoyage){
    const visited=homewardProgress.state.voyage?.visited??[];
    for(const d of DESTINATIONS){if(d.id===stage.goal.id)continue;
      ctx.save();ctx.strokeStyle=d.color;ctx.fillStyle=d.color;ctx.lineWidth=1/view.scale;ctx.setLineDash(visited.includes(d.id)?[]:[3/view.scale,4/view.scale]);
      ctx.beginPath();ctx.arc(d.x,d.y,d.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font=`${9/view.scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(`${visited.includes(d.id)?'✓ ':''}${d.name}`,d.x,d.y-d.radius-6/view.scale);ctx.restore();
    }
    const button=document.querySelector('#openDestinations');button.hidden=false;
    const text=`目的地：${stage.goal.name} · ${Math.round(voyageTargetDistance(homewardProgress.state.voyage,simulation?.rocket.position??stage.launch.position)).toLocaleString()} `;
    if(button.textContent!==text)button.textContent=text;
  }else document.querySelector('#openDestinations').hidden=true;
  drawTrail();
  for (const planet of stage.planets){const p=camera.toScreen(planet),r=planetExtent(planet)*1.8*view.scale;if(p.x+r>=0&&p.y+r>=0&&p.x-r<=camera.width&&p.y-r<=camera.height)drawPlanet(planet,time);}
  if(stage.encounters?.length)drawEncounters(ctx,stage.encounters,simulation?.elapsed??0,simulation?.rocket.position??stage.launch.position,view.scale,selectedEncounterId,camera);
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
  drawTutorialTarget();
  experience.draw(ctx);
  const cue = result.hidden ? experience.notice : null;
  if(experienceCue.textContent !== (cue?.text??'')) experienceCue.textContent=cue?.text??'';
  experienceCue.style.color=cue?.color??'';
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
  drawMinimap(rocket.position);
  const log=playType==='homeward'&&mode==='flying'&&simulation.elapsed<3?getHomewardDefinition(stage.id).departure:'';
  if(document.querySelector('#voyageLog').textContent!==log)document.querySelector('#voyageLog').textContent=log;
  const event=simulation?.encounterEvents?.at(-1),sectorLog=playType==='homeward'&&simulation&&stage.mission&&missionEvidence.encounters.length?getHomewardDefinition(stage.id):null;
  const encounterLog=sectorLog?(missionSatisfied(stage,missionEvidence,flightChoice)?sectorLog.discovery:sectorLog.encounterLog):event?(event.type==='station'?'発見：宇宙ステーション。航路情報を記録しました。':'未知の物体が反応。重力異常を観測しました。'):'';
  if(document.querySelector('#encounterLog').textContent!==encounterLog)document.querySelector('#encounterLog').textContent=encounterLog;
}

function drawMinimap(rocket){
 const map=document.querySelector('#minimap');map.hidden=!showMinimap||!stage.worldPreset;if(map.hidden)return;
 const c=map.getContext('2d'),w=map.width,h=map.height,s=Math.min((w-8)/stage.world.width,(h-8)/stage.world.height),ox=(w-stage.world.width*s)/2,oy=(h-stage.world.height*s)/2;
 c.clearRect(0,0,w,h);c.fillStyle='#061122e8';c.fillRect(0,0,w,h);c.strokeStyle='#526a87';c.strokeRect(ox,oy,stage.world.width*s,stage.world.height*s);
 for(const [p,color,r]of [...stage.planets.map(p=>[p,p.render?.glow??p.color,2]),...(stage.encounters??[]).map(e=>[encounterBodies(e,simulation?.elapsed??0)[0],ENCOUNTER_TYPES[e.type].color,2]),[stage.goal,'#72ffb3',3],[rocket,'#fff4c4',2]]){c.fillStyle=color;c.beginPath();c.arc(ox+p.x*s,oy+p.y*s,r,0,Math.PI*2);c.fill();}
 const a=camera.toWorld({x:0,y:0}),b=camera.toWorld({x:camera.width,y:camera.height});c.strokeStyle='#7bdcff';c.strokeRect(ox+Math.max(0,a.x)*s,oy+Math.max(0,a.y)*s,(Math.min(stage.world.width,b.x)-Math.max(0,a.x))*s,(Math.min(stage.world.height,b.y)-Math.max(0,a.y))*s);
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
  const job = preview.update(stage, velocity, mode === 'editing'&&launchAllowed(stage,velocity,launchMode));
  document.querySelector('#previewStatus').textContent=!job?'':!job.done?'予測計算中…':job.state.status==='flying'?`予測${Math.round(job.state.elapsed)}秒まで（この先は未予測）`:job.state.status==='timeout'?'飛行時間上限までの予測：到達なし':job.state.status==='cleared'?'ゴール到達予測':'';
  if (!job || job.points.length < 2) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0,0,stage.world.width,stage.world.height); ctx.clip();
  ctx.strokeStyle = job.state.status === 'cleared' ? '#75f5af' : '#69dfff';
  ctx.lineWidth = Math.max(1.4,(tutorialTarget==='preview'?1.7:1)/view.scale); ctx.setLineDash([3/view.scale,5/view.scale]);
  ctx.beginPath(); ctx.moveTo(job.points[0].x,job.points[0].y);
  // Keep every fourth sample and always the terminal point (at most 362 points).
  const stride=Math.max(4,Math.ceil(job.points.length/1000));
  for(let i=stride;i<job.points.length-1;i+=stride) ctx.lineTo(job.points[i].x,job.points[i].y);
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
  document.querySelector('#openStages').disabled=!enabled;
  document.querySelector('#openGallery').disabled=mode==='flying';
  updatePlanetEditor();
  gameModeInput.disabled = !enabled;
  previewButton.disabled = !enabled;
  updateGameMode();
  updateHomewardControls();
}

function launch(velocity = velocityFromAngleSpeed(Number(angleInput.value), Number(speedInput.value))) {
  if (mode !== "editing") return;
  if(stage.openVoyage&&homewardProgress.state.voyage?.checkpoint===stage.goal.id){homewardUI.open();statusText.textContent='寄港中です。次の目的地を選んでください。';return;}
  if(playType==='homeward'&&getHomewardDefinition(stage.id).choices&&!homewardProgress.state.choices[stage.id]){homewardUI.briefing(stage.id);statusText.textContent='出航前に追跡／回避を選択してください。';return;}
  if(!launchAllowed(stage,velocity,launchMode)){statusText.textContent='角度・推力が発射条件外です。メニュー内のステージ条件を確認してください。';return;}
  cancelGesture();
  launchSnapshot = structuredClone(stage);
  movement=0;
  moveTargets = {};
  simulation = createSimulation(stage, { velocity });
  missionEvidence=newMission();flightChoice=playType==='homeward'?homewardProgress.state.choices[stage.id]??null:null;
  cinematic.reset();
  notifyTutorial('launch');
  experience.launch(simulation);
  try{recorder=createFlightRecorder(stage,simulation,{gameMode,launchMode,playType,fixedTimeStep:DEFAULT_PHYSICS.fixedTimeStep});}catch{recorder=null;gallery.notify('飛行記録を開始できません。ゲームは続けられます。');}
  trail = [{ ...simulation.rocket.position }];
  mode = "flying";
  preview.clear();
  resetFlightRate();
  physicsStepCount = 0;
  setEditingControls(false);
  statusText.textContent = "飛行中 — 重力航路を計測しています。";
}

function showResult(status) {
  const missionFailed=playType==='homeward'&&status==='cleared'&&!missionSatisfied(stage,missionEvidence,flightChoice);
  if(missionFailed)status='incomplete';
  resetFlightRate();
  experience.finish(simulation);
  result.dataset.effect = status === 'cleared' ? 'cleared' : failureKind(simulation);
  finalizeRecording(missionFailed?'mission-incomplete':undefined);
  document.querySelector('#openGallery').disabled=false;
  const messages = {
    crashed: ["MISSION FAILED", "惑星に衝突"],
    escaped: ["MISSION FAILED", "航行エリアを逸脱"],
    timeout: ["MISSION FAILED", "飛行時間を超過"],
    cleared: ["CLEAR", "ゲート到達！"],
    incomplete: ["MISSION FAILED", "遭遇条件が未達成"],
  };
  const [label, reason] = messages[status];
  resultLabel.textContent = label;
  const hazardReason=simulation?.reason==='absorbed'?'ブラックホールに吸収':simulation?.reason==='overheated'?'恒星の熱領域へ侵入':null;
  const encounterReason={'encounter-meteor':'隕石に接触','encounter-comet':'彗星本体に接触','encounter-ufo':'UFOに接触','encounter-unknown':'未知の物体に接触'}[simulation?.reason];
  resultReason.textContent = encounterReason??hazardReason??reason;
  if(missionFailed)resultReason.textContent=MISSION_HINT;
  result.classList.toggle("success", status === "cleared");
  result.hidden = false;
  document.querySelector('#clearStars').textContent='';
  document.querySelector('#nextStage').hidden=true;
  if(status==='cleared'&&playType==='challenge'){
    const stars=rateClear(stage,status,{elapsed:simulation.elapsed,movement},gameMode);
    progress=recordClear(progress,storage,stage.id,gameMode,stars);
    document.querySelector('#clearStars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
    document.querySelector('#nextStage').hidden=CHALLENGES.findIndex(s=>s.id===challengeId)===CHALLENGES.length-1;
  }
  if(status==='cleared'&&playType==='homeward'){
    if(stage.openVoyage)homewardProgress.dock(simulation);else homewardProgress.clear(stage.id,missionEvidence);
    const sector=getHomewardDefinition(stage.id);
    resultReason.textContent=stage.openVoyage?destination(simulation.goal.id).log:sector.arrival;
    if(stage.openVoyage)resultLabel.textContent=simulation.goal.id==='gate'?'CLEAR':'寄港しました';
    document.querySelector('#nextStage').textContent=sector.next?'次のセクターへ':'宇宙マップへ';
    document.querySelector('#nextStage').hidden=false;
    if(stage.openVoyage)document.querySelector('#nextStage').textContent='次の目的地を選ぶ';
  }
  updateHomewardControls();
  statusText.textContent = status === "cleared" ? "軌道確立。ミッション成功。" : `${reason}。配置を調整して再挑戦。`;
}

function retry() {
  cinematic.reset();
  experience.reset();
  experienceCue.textContent='';
  audio.silence();
  finalizeRecording('reset');
  if(stage.openVoyage&&simulation?.status==='cleared'){stage=getHomewardSector(stage.id,homewardProgress.state.voyage);launchSnapshot=null;syncLaunchControls();angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);updateOutputs();fitCamera();}
  if (gameMode === 'live' && launchSnapshot) stage = structuredClone(launchSnapshot);
  moveTargets = {};
  preview.clear();
  cancelGesture();
  simulation = null;
  trail = [];
  mode = "editing";
  resetFlightRate();
  result.hidden = true;
  setEditingControls(true);
  statusText.textContent = "惑星を動かして、軌道をつくれ。";
}

function reset() {
  if(playType==='homeward'){
    stage=getHomewardSector(stage.id,homewardProgress.state.voyage);launchSnapshot=null;selectedPlanetId=null;
    angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);
    updateOutputs();retry();notifyTutorial('retry');fitCamera();return;
  }
  if(playType==='challenge') {
    stage=getChallenge(challengeId);launchSnapshot=null;selectedPlanetId=stage.planets[0]?.id;
    retry();fitCamera();return;
  }
  stage = launchSnapshot ? structuredClone(launchSnapshot) : getStage(initialStage.id);
  selectedPlanetId = stage.planets[0]?.id;
  angleInput.value = String(stage.launch.angleDeg);
  speedInput.value = String(stage.launch.speed);
  updateOutputs();
  retry();
  fitCamera();
}

function updateOutputs() {
  angleOutput.value = `${Number(angleInput.value) < 0 ? "−" : ""}${Math.abs(Number(angleInput.value))}°`;
  speedOutput.value = speedInput.value;
}

function tick(time) {
  const frameSeconds = Math.max(0,(time - lastTime) / 1000);
  lastTime = time;
  renderTutorial();
  if(document.hidden||gallery.isOpen()||settingsUI.isOpen()||homewardUI.isOpen()){requestAnimationFrame(tick);return;}
  experience.update(Math.min(frameSeconds,.1));
  if (mode === "flying") {
    flightClock.advance(frameSeconds,dt=>{
      const previousState=simulation;
      const previousPlanets=simulation.planets;
      simulation = stepLiveFlight(simulation, moveTargets, stage, gameMode, dt);
      if(playType==='homeward'){
        const old=missionEvidence;missionEvidence=observeMission(old,previousState,simulation);
        if(stage.mission&&(old.encounters.length!==missionEvidence.encounters.length||!missionSatisfied(stage,old,flightChoice)&&missionSatisfied(stage,missionEvidence,flightChoice))){
          const definition=getHomewardDefinition(stage.id);
          homewardProgress.log(stage.id,{departure:definition.departure,encounter:definition.encounterLog,encounters:missionEvidence.encounters,...(missionSatisfied(stage,missionEvidence,flightChoice)?{discovery:definition.discovery}:{})});
        }
      }
      experience.observe(previousState,simulation);
      try{recorder?.capture(simulation);}catch{recorder=null;gallery.notify('飛行記録を中断しました。ゲームは続けられます。');}
      movement+=simulation.planets.reduce((sum,p,i)=>sum+Math.hypot(p.x-previousPlanets[i].x,p.y-previousPlanets[i].y),0);
      if (gameMode === 'live') stage.planets = simulation.planets.map(p=>({...p}));
      physicsStepCount += 1;
      if (physicsStepCount % 3 === 0) {trail.push({ ...simulation.rocket.position });if(trail.length>3600)trail=trail.filter((_,i)=>i===0||i%2===1);}
      return simulation.status==='flying';
    });
    document.querySelector('#effectiveRate').textContent=flightClock.effective>0?`実効 ${flightClock.effective.toFixed(1)}×`:'実効 計測中';
    if (simulation.status !== "flying") {
      trail.push({ ...simulation.rocket.position });
      mode = simulation.status;
      showResult(simulation.status);
    }
  }
  if(mode==='flying'&&camera.mode==='follow'){camera.follow(simulation.rocket.position);syncCamera();}
  if(camera.mode==='cinematic'){
    const snapshot=simulation??{status:'ready',elapsed:0,world:stage.world,goal:stage.goal,planets:stage.planets,rocket:{position:stage.launch.position,velocity:velocityFromAngleSpeed(Number(angleInput.value),Number(speedInput.value)),radius:stage.rocketRadius}};
    cinematic.update(camera,snapshot,frameSeconds,mode==='flying'?flightClock.rate:1);syncCamera();
  }
  draw(time);
  requestAnimationFrame(tick);
}

function cancelGesture() {
  const previous = gesture;
  if(previous?.type === 'planet') delete moveTargets[previous.id];
  gesture = null;
  camera.endPan();
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
  document.querySelector('#editHintText').textContent = '惑星をドラッグ';
  modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.launchMode === launchMode)));
  syncModeLabel();
}

window.addEventListener('pointerdown', event => {
  if(!event.target?.closest?.('#soundToggle, #testSound'))void audio.unlock();
  pointers.add(event.pointerId);
  if (pointers.size > 1) cancelGesture();
}, true);
canvas.addEventListener("pointerdown", (event) => {
  if(event.button!==0)return;
  cameraPointers.set(event.pointerId,screenPoint(event));
  canvas.setPointerCapture(event.pointerId);
  if(cameraPointers.size>=2){
    cancelGesture();cameraActive=true;camera.mode='fixed';syncCamera();
    for(const id of cameraPointers.keys())canvas.setPointerCapture(id);
    if(cameraPointers.size===2)camera.beginGesture([...cameraPointers.values()]);
    event.preventDefault();return;
  }
  if(cameraActive)return;
  if (pointers.size !== 1) return;
  const point = worldPoint(event);
  let target = classifyDragTarget(point, stage.launch.position, stage.planets, mode !== 'editing' ? 'precision' : launchMode,
    { rocketTouchRadius: Math.max(28,22/view.scale), minimumPlanetTouchRadius: 22/view.scale });
  if(!target&&mode==='editing'&&playType==='free'&&stage.worldPreset&&Math.hypot(point.x-stage.goal.x,point.y-stage.goal.y)<=Math.max(stage.goal.radius,22/view.scale))target={type:'goal'};
  if(!target&&playType==='free'){
    const e=(stage.encounters??[]).map(e=>({e,d:Math.min(...encounterBodies(e,simulation?.elapsed??0).map(p=>Math.hypot(point.x-p.x,point.y-p.y)))})).filter(hit=>hit.d<=Math.max(hit.e.radius+8,22/view.scale)).sort((a,b)=>a.d-b.d)[0]?.e;
    if(e)target={type:'encounter',id:e.id,offset:{x:point.x-e.x,y:point.y-e.y}};
  }
  if (!target) {
    selectedPlanetId=null;selectedEncounterId=null;updatePlanetEditor();
    const screen=screenPoint(event);camera.beginPan(screen);
    gesture={type:'pan',pointerId:event.pointerId,start:screen,dragging:false};event.preventDefault();return;
  }
  if (target.type === 'planet') { selectedEncounterId=null;selectedPlanetId = target.id; updatePlanetEditor();if(stage.planets.find(p=>p.id===target.id)?.type==='repulsor')notifyTutorial('select'); }
  if(target.type==='encounter'){
    selectedEncounterId=target.id;selectedPlanetId=null;const e=stage.encounters.find(e=>e.id===target.id);
    for(const [id,value]of [['encounterType',e.type],['encounterSpeed',e.speed],['encounterCount',e.count],['encounterStrength',e.strength],['encounterTailMode',e.tailMode]])document.querySelector('#'+id).value=String(value);
    updatePlanetEditor();
  }
  gesture = { ...target, pointerId: event.pointerId, point };
  if (target.type === 'rocket') aim = slingshotLaunch(stage.launch.position, point);
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if(cameraPointers.has(event.pointerId))cameraPointers.set(event.pointerId,screenPoint(event));
  if(cameraActive){
    if(cameraPointers.size===2){camera.moveGesture([...cameraPointers.values()]);syncCamera();}
    event.preventDefault();return;
  }
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if(gesture.type==='pan'){
    const screen=screenPoint(event);
    if(Math.hypot(screen.x-gesture.start.x,screen.y-gesture.start.y)>=6)gesture.dragging=true;
    if(gesture.dragging){camera.movePan(screen);syncCamera();}
    event.preventDefault();return;
  }
  if(mode !== 'editing' && !(mode === 'flying' && gameMode === 'live'))return;
  const point = worldPoint(event);
  gesture.point = point;
  if(gesture.type==='encounter'){
    const e=stage.encounters?.find(e=>e.id===gesture.id);
    if(mode==='editing'&&playType==='free'&&e&&!e.fixed){const candidate={...e,x:point.x-gesture.offset.x,y:point.y-gesture.offset.y};if(encounterPlacementAllowed(candidate,stage))Object.assign(e,candidate);}
    event.preventDefault();return;
  }
  if (gesture.type === 'rocket') {
    aim = slingshotLaunch(stage.launch.position, point);
  } else if(gesture.type==='goal'){
    const goal={...stage.goal,x:Math.max(stage.goal.radius,Math.min(stage.world.width-stage.goal.radius,point.x)),y:Math.max(stage.goal.radius,Math.min(stage.world.height-stage.goal.radius,point.y))};
    if(stage.planets.every(p=>Math.hypot(p.x-goal.x,p.y-goal.y)>planetExtent(p)+goal.radius+12)&&Math.hypot(goal.x-stage.launch.position.x,goal.y-stage.launch.position.y)>goal.radius+28)Object.assign(stage.goal,goal);
  } else {
    const planet = stage.planets.find(item => item.id === gesture.id);
    if(mode === 'flying') { moveTargets[planet.id] = point; event.preventDefault(); return; }
    const candidate = { ...planet, x: Math.max(planet.radius, Math.min(stage.world.width-planet.radius,point.x)), y: Math.max(planet.radius, Math.min(stage.world.height-planet.radius,point.y)) };
    if (placementAllowed(candidate, stage)) Object.assign(planet, candidate);
  }
  event.preventDefault();
});

function stopDragging(event) {
  cameraPointers.delete(event.pointerId);
  if(cameraActive){
    if(cameraPointers.size===2)camera.beginGesture([...cameraPointers.values()]);
    else camera.endGesture();
    if(!cameraPointers.size)cameraActive=false;
    cancelGesture();return;
  }
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  const shot = gesture.type === 'rocket' && event.type === 'pointerup' && pointers.size === 1
    ? slingshotLaunch(stage.launch.position, worldPoint(event)) : null;
  cancelGesture();
  if (shot && !shot.cancelled && mode === 'editing') launch(shot.velocity);
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener('lostpointercapture', event=>{if(gesture?.pointerId===event.pointerId)cancelGesture();});
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>{
  if(cameraPointers.has(event.pointerId))stopDragging({...event,type,pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY});
  pointers.delete(event.pointerId);
});
window.addEventListener('blur', () => { cancelGesture(); pointers.clear();clearCameraGesture(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelGesture(); pointers.clear();clearCameraGesture(); audio.backgrounded(); }
  else {lastTime=performance.now();audio.foregrounded();}
});
window.addEventListener('pageshow',()=>{lastTime=performance.now();audio.foregrounded();});
modeButtons.forEach(button => button.addEventListener('click', () => {
  if (mode !== 'editing') return;
  launchMode = saveLaunchMode(storage, button.dataset.launchMode);
  updateMode();
}));
angleInput.addEventListener("input",()=>{updateOutputs();notifyTutorial('angle');});
speedInput.addEventListener("input",()=>{updateOutputs();notifyTutorial('thrust');});
for(const input of [angleInput,speedInput])input.addEventListener('change',()=>notifyTutorial('settings'));
launchButton.addEventListener("click", () => { if (launchMode === 'precision') launch(); });
resetButton.addEventListener("click", reset);
retryButton.addEventListener("click",()=>{retry();notifyTutorial('retry');});
new ResizeObserver(resizeCanvas).observe(frame);

function updatePlanetEditor() {
  updateEncounterControls();
  const planet = stage.planets.find(p=>p.id===selectedPlanetId);
  const fixed=Boolean(stage.rules?.fixedPlanets);
  planetType.disabled = planetSize.disabled = mode !== 'editing'||fixed;
  addPlanetButton.disabled = mode !== 'editing' || fixed || stage.planets.length >= (stage.rules?.maxPlanets??MAX_PLANETS);
  for(const option of planetType.options??[])option.disabled=Boolean(stage.rules&&!stage.rules.types.includes(option.value));
  for(const option of planetSize.options??[])option.disabled=Boolean(stage.rules&&!stage.rules.sizes.includes(option.value));
  if(!planetType.value||stage.rules&&!stage.rules.types.includes(planetType.value))planetType.value=stage.rules?.types[0]??'earth';
  if(!planetSize.value||stage.rules&&!stage.rules.sizes.includes(planetSize.value))planetSize.value=stage.rules?.sizes[0]??'medium';
  document.querySelector('#planetFeature').textContent=PLANET_TYPES[planetType.value]?.description??'引力でロケットの航路を曲げます。';
  document.querySelector('#specialSample').disabled=playType!=='free'||mode!=='editing';
  document.querySelector('#worldSize').disabled=document.querySelector('#hugeSample').disabled=playType!=='free'||mode!=='editing';
  document.querySelector('#worldSize').value=stage.worldPreset??'standard';
  deletePlanetButton.disabled = mode !== 'editing' || fixed || !planet || stage.planets.length<=(stage.rules?.minPlanets??0);
  document.querySelector('#selectionBar').hidden=!planet;
  document.querySelector('#deleteReason').textContent=deletePlanetButton.disabled?(mode!=='editing'?'飛行後は削除できません':'ステージの個数・種類は固定です'):'';
  document.querySelector('#addReason').textContent=addPlanetButton.disabled?(mode!=='editing'?'飛行後は追加できません':fixed?'このステージは惑星の種類・サイズ・個数が固定です':`惑星は${stage.rules?.maxPlanets??MAX_PLANETS}個までです`):'惑星・発射地点・ゲートを避けて配置します。';
  document.querySelector('#openPlanetSettings').disabled=mode!=='editing';
  document.querySelector('#openPlanetSettings').textContent=addPlanetButton.disabled?'＋惑星（制限）':'＋惑星';
  document.querySelector('#challengeConditions').textContent=stage.rules?.fixedPlanets?`種類・個数固定／各惑星は初期位置から±12まで。ANGLE ${stage.launchConditions.precisionAngleRange.join('〜')}°／THRUST ${stage.launchConditions.speedRange.join('〜')}`:'';
  if(stage.mission){document.querySelector('#challengeConditions').textContent=`${stage.description}。惑星・遭遇対象は固定。ANGLE ${stage.launch.angleRange.join('〜')}°、THRUST 120〜220。詳細はHOMEWARDの攻略ヒントへ。`;document.querySelector('#addReason').textContent='この宙域は配置固定です。ANGLE・THRUSTを調整してください。';}
  if(stage.openVoyage)document.querySelector('#challengeConditions').textContent='Sector09：惑星の種類・個数は固定、ドラッグ移動は可能。目的地は宇宙マップで選択し、飛行中も変更できます。寄港後は次の目的地を選んで再発射。';
  document.querySelector('#planetSelection').textContent = planet ? `選択 ${stage.planets.indexOf(planet)+1} / ${stage.planets.length} · ${PLANET_TYPES[planet.type??'earth'].name}` : `惑星 ${stage.planets.length} / 3`;
}
addPlanetButton.addEventListener('click', () => {
  if (mode !== 'editing'||addPlanetButton.disabled) return;
  cancelGesture();
  const planet = addPlanet(stage,planetType.value,planetSize.value);
  if (planet) {selectedPlanetId = planet.id;settingsUI.closeAll();statusText.textContent='追加した惑星を選択中。ドラッグで移動できます。';}
  else {statusText.textContent = '追加できる空間がありません。';document.querySelector('#addReason').textContent=statusText.textContent;return;}
  updatePlanetEditor();
});
deletePlanetButton.addEventListener('click', () => {
  if (mode !== 'editing'||deletePlanetButton.disabled) return;
  if(stage.planets.length<=(stage.rules?.minPlanets??0))return;
  cancelGesture();
  stage.planets = stage.planets.filter(p=>p.id!==selectedPlanetId);
  selectedPlanetId = null;
  updatePlanetEditor();
});
planetType.addEventListener('change',updatePlanetEditor);
planetSize.addEventListener('change',updatePlanetEditor);
document.querySelector('#specialSample').addEventListener('change',event=>{
  if(playType!=='free'||mode!=='editing'||!event.target.value)return;
  cancelGesture();stage=getSpecialSample(event.target.value);launchSnapshot=structuredClone(stage);
  selectedPlanetId=stage.planets[0].id;
  angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);
  retry();updateOutputs();document.querySelector('.mission strong').textContent=stage.name;
  event.target.value='';
  settingsUI.closeAll();fitCamera();
});
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
function updateExperienceControls() {
  qualityInput.value=experienceSettings.quality;
  soundButton.textContent=`サウンド ${experienceSettings.sound?'ON':'OFF'}`;
  soundButton.setAttribute('aria-pressed',String(experienceSettings.sound));
}
soundButton.addEventListener('click',()=>{
  experienceSettings=saveExperience(storage,{...experienceSettings,sound:!experienceSettings.sound});
  audio.setEnabled(experienceSettings.sound);updateExperienceControls();
  if(experienceSettings.sound)void audio.testSound();
});
testSoundButton.addEventListener('click',()=>{void audio.testSound();});
function updateAudioStatus() {
  const info=audio.diagnostics();
  testSoundButton.disabled=!info.enabled||info.pending;
  const help=!info.enabled?'サウンドをONにすると短い確認音を送ります。'
    :info.pending?'音声を開始しています…'
    :info.lastTest==='failed'||info.clockAdvancing===false?'音声を開始できません。テスト音をもう一度タップしてください。診断情報も確認できます。'
    :info.lastTest==='sent'?'テスト音を出力経路へ送りました。実際に聞こえるか確認してください。'
    :info.needsGesture?'音声の再開は、テスト音または次の操作で行います。':'サウンドON。テスト音で出力を確認できます。';
  document.querySelector('#soundHelp').textContent=help;
  document.querySelector('#audioDiagnostics').textContent=`AudioContext: ${info.state}\n開始待ち: ${info.pending?'あり':'なし'} / 再開試行: ${info.resumeAttempts}\nテスト音: ${info.lastTest} / 出力要求: ${info.sent}\n音声時計: ${info.clockAdvancing===null?'未計測':info.clockAdvancing?'進行':'停止'}\nAudioSession: ${info.sessionType}\nエラー: ${info.lastError||'なし'}`;
}
audio.onChange=updateAudioStatus;
qualityInput.addEventListener('change',()=>{
  experienceSettings=saveExperience(storage,{...experienceSettings,quality:qualityInput.value});
  experience.setQuality(experienceSettings.quality);updateExperienceControls();
});
// Capture also handles keyboard activation. Sound synthesis never unlocks audio.
document.addEventListener('click',event=>{
  if(event.target?.closest?.('#soundToggle, #testSound'))return;
  if(event.target?.closest?.('button, select, summary')){void audio.unlock();audio.play('ui');}
},true);
updateExperienceControls();
updateAudioStatus();
function updateGameMode() {
  gameModeInput.value=gameMode;
  document.querySelector('#gameModeHelp').textContent=gameMode==='live'?'重力操作：発射後も惑星をドラッグして誘導':'軌道設計：発射後は惑星固定';
  syncModeLabel();
}
function syncModeLabel(){document.querySelector('#modeSummary').textContent=`${gameMode==='live'?'重力操作':'軌道設計'} / ${launchMode==='precision'?'精密':'スリング'}`;}
gameModeInput.addEventListener('change',()=>{
  if(mode!=='editing')return;
  cancelGesture();gameMode=saveGameMode(storage,gameModeInput.value);updateGameMode();
});
updateGameMode();
function enterChallenge(id){
  const index=CHALLENGES.findIndex(s=>s.id===id);
  if(index<0||!isUnlocked(progress,index,CHALLENGES))return;
  homewardProgress.leave();document.querySelector('#nextStage').textContent='次ステージ';
  if(playType==='free')freeSnapshot={stage:structuredClone(stage),angle:angleInput.value,speed:speedInput.value,snapshot:launchSnapshot};
  cancelGesture();playType='challenge';challengeId=id;stage=getChallenge(id);launchSnapshot=null;
  selectedPlanetId=stage.planets[0]?.id;
  syncLaunchControls();
  document.querySelector('.mission strong').textContent=`${id.slice(-2)} ${stage.name}`;
  retry();statusText.textContent=stage.description;
  document.querySelector('#stageDialog').close();resizeCanvas();fitCamera();
}
function renderStages(){
  const list=document.querySelector('#stageList');list.innerHTML='';
  CHALLENGES.forEach((s,i)=>{
    const button=document.createElement('button');button.type='button';button.disabled=!isUnlocked(progress,i,CHALLENGES);
    const best=progress[gameMode][s.id]??0;
    button.textContent=`${button.disabled?'🔒 ':best?'✓ ':''}${String(i+1).padStart(2,'0')} ${s.name} ${'★'.repeat(best)}${'☆'.repeat(3-best)}`;
    const info=document.createElement('small');
    info.textContent=`${s.description} 惑星${s.rules.maxPlanets}個まで / ★2 ${s.rating.two.maxTime}秒 / ★3 ${s.rating.three.maxTime}秒${gameMode==='live'?'・移動30以内':''}`;
    button.append(info);button.addEventListener('click',()=>enterChallenge(s.id));list.append(button);
  });
}
document.querySelector('#openStages').addEventListener('click',()=>{
  if(mode!=='editing')return;cancelGesture();renderStages();document.querySelector('#stageDialog').showModal();
});
document.querySelector('#closeStages').addEventListener('click',()=>document.querySelector('#stageDialog').close());
document.querySelector('#freePlay').addEventListener('click',()=>{
  if(mode==='flying')return;
  homewardProgress.leave();settingsUI.closeAll();homewardUI.close();
  cancelGesture();playType='free';challengeId=null;
  stage=freeSnapshot?structuredClone(freeSnapshot.stage):getStage();
  launchSnapshot=freeSnapshot?.snapshot??null;selectedPlanetId=stage.planets[0]?.id;
  syncLaunchControls();
  if(freeSnapshot){angleInput.value=freeSnapshot.angle;speedInput.value=freeSnapshot.speed;}
  document.querySelector('.mission strong').textContent=stage.name;
  retry();updateOutputs();document.querySelector('#stageDialog').close();resizeCanvas();fitCamera();
});
document.querySelector('#nextStage').addEventListener('click',()=>{
  if(playType==='homeward'&&mode==='cleared'){
    const next=getHomewardDefinition(stage.id).next;
    if(next)enterHomeward(next);else homewardUI.open();return;
  }
  if(playType!=='challenge'||mode!=='cleared')return;
  const next=CHALLENGES[CHALLENGES.findIndex(s=>s.id===challengeId)+1];if(next)enterChallenge(next.id);
});
updatePlanetEditor();
function syncLaunchControls(){
  const [amin,amax]=stage.launch.angleRange,[smin,smax]=stage.launch.speedRange;
  const oldAngle=Number(angleInput.value),oldSpeed=Number(speedInput.value);
  angleInput.min=String(amin);angleInput.max=String(amax);speedInput.min=String(smin);speedInput.max=String(smax);
  angleInput.value=String(oldAngle<amin||oldAngle>amax?stage.launch.angleDeg:oldAngle);
  speedInput.value=String(oldSpeed<smin||oldSpeed>smax?stage.launch.speed:oldSpeed);updateOutputs();
}
updateOutputs();
updateMode();
resizeCanvas();
requestAnimationFrame(tick);
const gallery=createGallery({store:standardGallery,archive:homewardArchive,canOpen:()=>mode!=='flying',onOpen:cancelGesture});
const homewardUI=createHomewardUI({progress:homewardProgress,onEnter:enterHomeward,onChange:updateHomewardControls,onDestination:changeDestination,getNavigation:()=>({active:playType==='homeward'&&Boolean(stage.openVoyage),position:simulation?.rocket.position??stage.launch.position,flying:mode==='flying'}),canEnter:()=>mode!=='flying',onRecord:id=>{homewardUI.close();void gallery.openRecord(id);},onOpen:()=>{cancelGesture();clearCameraGesture();settingsUI.closeAll();}});
void migrateHomewardRecords(homewardProgress,standardGallery,homewardArchive).then(({migrated,missing})=>{if(migrated||missing.length)gallery.notify(`HOMEWARD記録：${migrated}件を専用保護。${missing.length}件は元記録がなく復元できません。`);}).catch(()=>gallery.notify('HOMEWARDの重要記録を保護・確認できませんでした。元の記録は変更していません。'));
function notifyTutorial(event){
  if(playType!=='homeward')return;
  const old=tutorialEntry(homewardProgress.state,stage.id),values={angleDeg:Number(angleInput.value),speed:Number(speedInput.value)};
  const next=tutorialTransition(old,stage.id,event,values,getHomewardDefinition(stage.id).initial);
  if(JSON.stringify(old)!==JSON.stringify(next)){homewardProgress.setTutorial(stage.id,next);updateHomewardControls();}
}
function renderTutorial(){
  const entry=playType==='homeward'?tutorialEntry(homewardProgress.state,stage.id):null;
  const visible=entry?.status==='active'&&(mode==='editing'||mode==='flying')&&!homewardUI.isOpen()&&!settingsUI.isOpen()&&!gallery.isOpen();
  const key=JSON.stringify([playType,stage.id,entry?.status,entry?.step,visible,mode,launchMode,preview.enabled]);if(key===tutorialKey)return;tutorialKey=key;
  const coach=document.querySelector('#homewardCoach');coach.hidden=!visible;frame.classList.toggle('tutorial-active',Boolean(visible));
  for(const selector of ['#launchButton','#angleInput','#speedInput','#openMenuSettings'])document.querySelector(selector).classList.toggle('tutorial-target',false);
  tutorialTarget='';if(!visible)return;
  const steps=TUTORIAL_STEPS[stage.id],step=steps[entry.step];tutorialTarget=step.target;
  const sling=launchMode==='slingshot',needsPrecision=sling&&['angle','thrust'].includes(step.target);
  const needsPreview=step.target==='preview'&&!preview.enabled;
  const text=needsPrecision?'メニューで精密発射を選ぶと数値を調整できます。スリングで試す場合はスキップも可能です。':needsPreview?'予測はOFFです。メニュー→表示・音でONにするか、そのまま次へ進めます。':sling&&step.id==='launch'?'ロケットを引いて離し、自分の航路を発射しよう。':step.text;
  document.querySelector('#tutorialTitle').textContent=`航法ガイド ${entry.step+1}/${steps.length}`;
  document.querySelector('#tutorialText').textContent=text;document.querySelector('#tutorialNext').hidden=!step.manual;
  document.querySelector('#tutorialHintText').hidden=true;document.querySelector('#tutorialHintText').textContent=getHomewardDefinition(stage.id).hint;
  document.querySelector('#tutorialHint').textContent='ヒント';document.querySelector('#tutorialHint').setAttribute('aria-expanded','false');
  const selector=needsPrecision||needsPreview?'#openMenuSettings':{launch:sling?null:'#launchButton',angle:'#angleInput',thrust:'#speedInput'}[step.target];
  if(selector)document.querySelector(selector).classList.toggle('tutorial-target',true);
  if(sling&&step.id==='launch')tutorialTarget='rocket';
}
function drawTutorialTarget(){
  if(!['planet','rocket'].includes(tutorialTarget)||document.querySelector('#homewardCoach').hidden)return;
  const p=tutorialTarget==='rocket'?stage.launch.position:stage.planets[0];
  ctx.save();ctx.strokeStyle='#ffe6a1';ctx.lineWidth=2/view.scale;ctx.setLineDash([3/view.scale,3/view.scale]);
  ctx.beginPath();ctx.arc(p.x,p.y,Math.max((p.radius??6)+8,18/view.scale),0,Math.PI*2);ctx.stroke();ctx.restore();
}
document.querySelector('#tutorialSkip').addEventListener('click',()=>notifyTutorial('skip'));
document.querySelector('#tutorialNext').addEventListener('click',()=>notifyTutorial('next'));
document.querySelector('#tutorialHint').addEventListener('click',event=>{const hint=document.querySelector('#tutorialHintText');hint.hidden=!hint.hidden;event.currentTarget.textContent=hint.hidden?'ヒント':'閉じる';event.currentTarget.setAttribute('aria-expanded',String(!hint.hidden));});
function updateHomewardControls(){
  frame.classList.toggle('open-voyage',playType==='homeward'&&Boolean(stage.openVoyage));
  document.querySelector('#chooseFreeSpace').disabled=document.querySelector('#chooseClassic').disabled=mode==='flying';
  document.querySelector('#openHomeward').disabled=mode==='flying'&&!stage.openVoyage;
  for(const [selector,type]of [['#openHomeward','homeward'],['#chooseFreeSpace','free'],['#chooseClassic','challenge']])document.querySelector(selector).setAttribute('aria-pressed',String(playType===type));
  const hud=document.querySelector('#homewardProgress');hud.hidden=playType!=='homeward';
  const d=homewardDistance(homewardProgress.state);
  hud.textContent=playType==='homeward'?`地球まで ${d.remaining.toLocaleString('ja-JP')} · 帰還 ${d.percent.toFixed(1)}%${homewardProgress.notice?' · 保存注意':''}`:'';
}
function enterHomeward(id,{restoring=false}={}){
  if(mode==='flying'||!sectorUnlocked(homewardProgress.state,id))return;
  if(playType==='free')freeSnapshot={stage:structuredClone(stage),angle:angleInput.value,speed:speedInput.value,snapshot:launchSnapshot};
  if(!restoring&&!homewardProgress.enter(id))return;
  cancelGesture();clearCameraGesture();settingsUI.closeAll();document.querySelector('#stageDialog').close();
  playType='homeward';challengeId=null;stage=getHomewardSector(id,homewardProgress.state.voyage);launchSnapshot=null;selectedPlanetId=null;
  syncLaunchControls();angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);updateOutputs();
  const guide=tutorialEntry(homewardProgress.state,id);
  if(guide.status==='active'){angleInput.value=String(guide.angleDeg??stage.launch.angleDeg);speedInput.value=String(guide.speed??stage.launch.speed);updateOutputs();}
  document.querySelector('.mission strong').textContent=stage.name;
  retry();notifyTutorial('restore');resizeCanvas();fitCamera();homewardUI.briefing(id);
}
document.querySelector('#openHomeward').addEventListener('click',()=>{if(mode!=='flying'||stage.openVoyage)homewardUI.open();});
document.querySelector('#openDestinations').addEventListener('click',()=>{if(stage.openVoyage)homewardUI.open();});
function changeDestination(id){
  if(!stage.openVoyage||!homewardProgress.selectDestination(id))return;
  cancelGesture();clearCameraGesture();
  if(mode==='flying'){
    stage.goal={...destination(id)};stage.destinationId=id;simulation={...simulation,goal:{...stage.goal}};cinematic.reset();preview.clear();
  }else{
    finalizeRecording('reset');stage=getHomewardSector('homeward-09',homewardProgress.state.voyage);launchSnapshot=null;selectedPlanetId=null;syncLaunchControls();angleInput.value=String(stage.launch.angleDeg);speedInput.value=String(stage.launch.speed);retry();updateOutputs();fitCamera();
  }
  updateHomewardControls();
}
document.querySelector('#chooseClassic').addEventListener('click',()=>{if(mode!=='flying')document.querySelector('#openStages').click();});
document.querySelector('#chooseFreeSpace').addEventListener('click',()=>{if(mode!=='flying')document.querySelector('#freePlay').click();});
updateHomewardControls();
if(homewardProgress.state.active&&homewardProgress.state.openingSeen){
  enterHomeward(homewardProgress.state.currentSector,{restoring:true});
  if(homewardProgress.state.cleared.includes(homewardProgress.state.currentSector))homewardUI.open();
}
function finalizeRecording(reason){
  if(!recorder||!simulation)return;
  const current=recorder;recorder=null;
  const homewardId=playType==='homeward'?stage.id:null,state=simulation,evidence=structuredClone(missionEvidence),choice=flightChoice;
  try{
    let record=current.finish(reason==='mission-incomplete'?{...state,status:'mission-incomplete'}:state,reason);
    const open=Boolean(stage.openVoyage),success=state.status==='cleared'&&(!homewardId||missionSatisfied(getHomewardSector(homewardId),evidence,choice));
    if(record&&open)record={...record,stageName:record.stageName+' / '+state.goal.name,goal:{...state.goal},destinationId:state.goal.id,destinations:structuredClone(DESTINATIONS),departureCheckpoint:homewardProgress.state.voyage?.checkpoint??'origin'};
    if(homewardId){if(open)homewardProgress.log(homewardId,{flightToken:record?.id});else homewardProgress.recordFlight(homewardId,state,evidence,choice,null,record?.id);}
    if(record)void (async()=>{
      let protectionFailed=false;
      if(homewardId&&success){
        try{
          if(open){const reference=await homewardArchive.saveFirst(`dock:homeward-09:${state.goal.id}:first`,record);homewardProgress.attachDock(state.goal.id,reference);}
          if(!open||state.goal.id==='gate'){const reference=await homewardArchive.saveFirst(`sector:${homewardId}:first`,record);homewardProgress.log(homewardId,{importantFlightId:reference});}
        }catch{protectionFailed=true;}
      }
      const saved=await gallery.save(record);if(saved&&homewardId)homewardProgress.attachFlight(homewardId,record.id,success&&(!open||state.goal.id==='gate'));
      if(protectionFailed){const message='HOMEWARDの重要航行記録を保存できませんでした。容量・Safariの保存設定を確認してください。既存の重要記録は削除していません。';document.querySelector('#homewardArchiveNotice').textContent=message;gallery.notify(message);}
    })();
  }catch{gallery.notify('飛行記録を保存できませんでした。ゲームは続けられます。');}
}

function encounterSettings(){return {speed:Number(document.querySelector('#encounterSpeed').value),count:Number(document.querySelector('#encounterCount').value),strength:Number(document.querySelector('#encounterStrength').value),tailMode:document.querySelector('#encounterTailMode').value};}
function updateEncounterControls(){
 const editable=playType==='free'&&mode==='editing',type=document.querySelector('#encounterType').value||'meteor';
 const e=stage.encounters?.find(e=>e.id===selectedEncounterId),fixed=Boolean(e?.fixed);
 document.querySelector('#openEncounterSettings').disabled=!editable;
 document.querySelector('#addEncounter').disabled=!editable||(stage.encounters?.length??0)>=MAX_ENCOUNTERS;
 document.querySelector('#applyEncounter').disabled=!editable||!e||fixed||e.type!==type;
 document.querySelector('#deleteEncounter').disabled=!editable||!e||fixed;
 document.querySelector('#encounterSelectionBar').hidden=!e;
 document.querySelector('#encounterSelected').textContent=e?`${ENCOUNTER_TYPES[e.type].name}${fixed?'（固定）':''}`:'';
 document.querySelector('#encounterFeature').textContent=ENCOUNTER_TYPES[type]?.description??'';
 document.querySelector('#encounterReason').textContent=!editable?'FREE SPACEの発射前のみ編集できます。':fixed?'選択中の物体は固定です。':`配置 ${stage.encounters?.length??0} / ${MAX_ENCOUNTERS}。追加後は盤面で選択・移動・削除できます。`;
 document.querySelector('#encounterCount').disabled=type!=='meteor';
 document.querySelector('#encounterSpeed').disabled=['unknown','station'].includes(type);
 document.querySelector('#encounterStrength').disabled=!['unknown','comet'].includes(type);
 document.querySelector('#encounterTailMode').disabled=type!=='comet';
 document.querySelector('#encounterSample').disabled=!editable;
}
document.querySelector('#encounterType').addEventListener('change',updateEncounterControls);
document.querySelector('#addEncounter').addEventListener('click',()=>{
 if(playType!=='free'||mode!=='editing')return;
 const e=addEncounter(stage,document.querySelector('#encounterType').value,encounterSettings());
 if(!e){document.querySelector('#encounterReason').textContent='上限または空き領域がなく、追加できません。';return;}
 selectedEncounterId=e.id;selectedPlanetId=null;settingsUI.closeAll();updatePlanetEditor();
});
document.querySelector('#applyEncounter').addEventListener('click',()=>{
 const e=stage.encounters?.find(e=>e.id===selectedEncounterId);
 if(playType!=='free'||mode!=='editing'||!e||e.fixed||document.querySelector('#encounterType').value!==e.type)return;
 const candidate=createEncounter(e.type,e.id,e.x,e.y,encounterSettings());
 if(e.route)candidate.route=structuredClone(e.route);
 if(!encounterPlacementAllowed(candidate,stage)){document.querySelector('#encounterReason').textContent='設定後の大きさでは配置できません。数量を減らすか移動してください。';return;}
 Object.assign(e,candidate);settingsUI.closeAll();updatePlanetEditor();
});
document.querySelector('#deleteEncounter').addEventListener('click',()=>{
 const e=stage.encounters?.find(e=>e.id===selectedEncounterId);
 if(playType!=='free'||mode!=='editing'||!e||e.fixed)return;
 stage.encounters=stage.encounters.filter(e=>e.id!==selectedEncounterId);selectedEncounterId=null;updatePlanetEditor();
});
document.querySelector('#encounterSample').addEventListener('change',event=>{
 if(playType!=='free'||mode!=='editing'||!event.target.value)return;
 selectedEncounterId=null;loadFreeWorld(getEncounterSample(event.target.value));event.target.value='';
});
