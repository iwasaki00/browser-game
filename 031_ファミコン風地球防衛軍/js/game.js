import {VERSION,SAVE_KEY,WORLD,VIEW,BATTLE_CAMERA,DENSITY_MODES,INVASION,MISSIONS,WEAPONS,WEAPON_BY_ID,WEAPON_CATEGORIES,ENEMY_TYPES,MISSION_AREAS,DEFAULT_SAVE,DESTRUCTION_LEVELS,PLAYER_CLASSES,normalizeClass,normalizeDestructionLevel,clamp,distance,sanitizeSave,pickReward,missionStatus,canPlayMission,recordMissionClear} from "./data.js?v=0.2.2";
import {WEAPON_LIMITS,createArsenal,clearArsenal,mineCount,fireExpanded,detonateMines,updateExpanded,drawExpanded,terrainContact,segmentEntry} from "./weapons.js?v=0.2.2";
import {applyPlayerClass,moveClassPlayer,movePlayerBody,classPlayerFrame} from "./player.js?v=0.2.2";
import {worldToScreen,clientToScreen,viewBounds,aimTarget,createBattleCamera,updateBattleCamera} from "./camera.js?v=0.2.2";
import {SpawnDirector,SpatialGrid,AttackDirector,prepareSeparation,nearestEnemy,isMob,variation} from "./invasion.js?v=0.2.2";
import {FrameProfiler,LiveProfiler} from "./profiler.js?v=0.1.5";
import {PLAYER_PRESETS,LAB_ENEMIES,LAB_COUNTS,createLabState,landLabPlayer,moveFlightPlayer,fixedLabCamera,labSpawnPosition} from "./playground.js?v=0.2.2";
import {IMPACT,REACTIONS,impactLevel,createImpactState,pushImpactEffect,hitVisual,beginDeath,updateDeath,updateParticles,advanceImpact,impactShake} from "./impact.js?v=0.2.2";
import {M02,NEST,ABYSS,isBoss,createM02Geometry,ceilingAt,floorAt,validEnemyPosition,updateNests,moveTunnelEnemy,weakCore,queenDamage,updateQueen} from "./mission02.js?v=0.2.2";

const canvas=document.querySelector("#game"),ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;
const screens=[...document.querySelectorAll(".screen")],weaponGrid=document.querySelector("#weaponGrid");
const equipMessage=document.querySelector("#equipMessage"),touchControls=document.querySelector("#touchControls");
const gameShell=document.querySelector("#gameShell");
const images={};
const imageFiles={bg:"assets/backgrounds/city.png",player:"assets/sprites/player/player.png",classes:"assets/sprites/player/classes.png?v=0.1.8",enemies:"assets/sprites/enemies/enemies.png",boss:"assets/sprites/bosses/mother_crawler.png",weapons:"assets/sprites/weapons/weapon_icons.png?v=0.2.0",shots:"assets/sprites/weapons/projectiles.png?v=0.2.0",heldWeapons:"assets/sprites/weapons/equipped.png?v=0.2.0",weaponFx:"assets/effects/weapon_fx.png?v=0.2.0",explosion:"assets/effects/explosion.png",items:"assets/sprites/ui/items.png",tiles:"assets/tiles/city_tiles.png"};
Object.assign(imageFiles,{underground:'assets/backgrounds/underground.png',undergroundTiles:'assets/tiles/underground_tiles.png',worm:'assets/sprites/enemies/tunnel_worm.png',spitter:'assets/sprites/enemies/ceiling_spitter.png',nest:'assets/sprites/enemies/spawn_nest.png',queen:'assets/sprites/bosses/abyss_queen.png',acid:'assets/effects/acid.png',wave:'assets/effects/ground_wave.png',nestBreak:'assets/effects/nest_break.png',bossBreak:'assets/effects/boss_break.png'});
let save=loadSave(),state="title",last=0,acc=0,assetsReady=false,audio=null;
let game=null,selected=[...save.equipped],selectedMissionId="M01",returnState="play",settingsReturn="title";
let weaponFilter="ALL",activeEquipSlot=0,remoteTimer=null,remoteHeld=false;
let labWeaponPickerOpen=false,labEditingSlot=0,labWeaponQuery="";
const weaponAPI={damage:damageEnemy,blast:explode,effect:pushEffect};
const missionTimers=new Set();
const deferredMissionCallbacks=[];
const DEBUG=new URLSearchParams(location.search).get("debug")==="1";
const profiler=DEBUG?new FrameProfiler():null;
const liveProfiler=DEBUG?new LiveProfiler():null;
const view={mode:"landscape",zoom:BATTLE_CAMERA.idleZoom,width:VIEW.canvasWidth/BATTLE_CAMERA.idleZoom,renderOffset:0};

function syncCameraView(){
  view.zoom=game?.battleCamera.zoom??BATTLE_CAMERA.idleZoom;
  view.width=VIEW.canvasWidth/view.zoom;
  if(game)game.camera=game.battleCamera.x;
  canvas.dataset.viewZoom=view.zoom.toFixed(3);
  canvas.dataset.visibleWorldWidth=view.width.toFixed(2);
  canvas.dataset.targetZoom=(game?.battleCamera.targetZoom??BATTLE_CAMERA.idleZoom).toFixed(3);
  canvas.dataset.cameraX=(game?.camera??0).toFixed(2);
  canvas.dataset.cameraMode=game?.battleCamera.mode??"idle";
}

function updateViewport(){
  const viewport=window.visualViewport;
  const viewportHeight=Math.round(viewport?.height||window.innerHeight);
  document.documentElement.style.setProperty("--app-height",`${viewportHeight}px`);
  view.mode=matchMedia("(orientation: portrait)").matches?"portrait":"landscape";
  const touchDevice=matchMedia("(any-pointer: coarse)").matches||navigator.maxTouchPoints>0;
  document.documentElement.dataset.touchDevice=String(touchDevice);
  document.documentElement.dataset.layout=view.mode;
  gameShell.dataset.layout=view.mode;
  syncCameraView();
}
updateViewport();
window.addEventListener("resize",updateViewport,{passive:true});
window.addEventListener("orientationchange",()=>requestAnimationFrame(updateViewport),{passive:true});
window.visualViewport?.addEventListener("resize",updateViewport,{passive:true});
window.visualViewport?.addEventListener("scroll",updateViewport,{passive:true});

function loadSave(){try{return sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY)))}catch{return sanitizeSave(DEFAULT_SAVE)}}
function storeSave(){if(game?.lab)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}}
// Keep the original storage key so v1 records migrate in place.
storeSave();
function loadAssets(){return Promise.all(Object.entries(imageFiles).map(([key,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=reject;im.src=src}))).then(()=>assetsReady=true)}
function show(name){if(name!=="lab")closeLabWeaponPicker(false);if(name==="mission")renderMissionList();screens.forEach(s=>s.classList.toggle("is-active",s.id===`screen${name[0].toUpperCase()+name.slice(1)}`));state=name;gameShell.classList.toggle("is-playing",name==="play"||name==="lab");touchControls.style.visibility=name==="play"?"visible":"hidden";canvas.dataset.gameState=name;canvas.setAttribute("aria-label",name==="play"?game?.lab?"TEST LABを進行中":`ゲーム画面。${game.missionId} 市街地防衛線を進行中`:`${name}画面`);syncLabUI()}
function scheduleMission(callback,delay){const current=game;const timer=setTimeout(()=>{missionTimers.delete(timer);if(game!==current)return;if(state==="confirm")deferredMissionCallbacks.push({current,callback});else callback()},delay);missionTimers.add(timer)}
function missionScreen(name){if(state==="confirm")returnState=name;else show(name)}
function discardMission(){for(const timer of missionTimers)clearTimeout(timer);missionTimers.clear();deferredMissionCallbacks.length=0;if(profiler)profiler.running=false;liveProfiler?.reset();game=null;acc=0;resetInput();syncCameraView();gameShell.dataset.flight="false";document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;delete canvas.dataset.playerX;delete canvas.dataset.playerHp;delete canvas.dataset.enemies;delete canvas.dataset.boss;delete canvas.dataset.density;delete canvas.dataset.enemyLimit}
function cancelTitle(){resetInput();show(returnState);for(const entry of deferredMissionCallbacks.splice(0))if(entry.current===game)entry.callback();if(state==="play")canvas.focus()}
function requestTitle(){
  if(state==="confirm")return;
  if(game&&!game.clear&&["play","pause","lab","settings"].includes(state)){returnState=state;resetInput();show("confirm");document.querySelector('[data-action="cancel-title"]').focus();return}
  discardMission();show("title");document.querySelector('[data-action="start"]').focus();
}
function renderMissionList(){
  const list=document.querySelector("#missionList");list.replaceChildren();
  for(const mission of MISSIONS){const status=missionStatus(mission,save),button=document.createElement("button");button.className="mission-card";button.dataset.action="select-mission";button.dataset.mission=mission.id;button.dataset.status=status;button.disabled=!canPlayMission(mission.id,save);button.innerHTML=`<span>${mission.id}</span><strong>${mission.name}</strong><b class="mission-status">${status}</b><small>${mission.description}</small>`;list.append(button)}
}
function weapon(id){return WEAPON_BY_ID.get(id)}
function activeEquipment(){return game?.lab?.equipped??save.equipped}
function activeSettings(){return game?.lab?.settings??save.settings}
function formalClass(){return !game?.lab||Object.hasOwn(PLAYER_CLASSES,game.lab.preset)}
function syncClassControls(){
  const id=game?.player.classId??"RANGER";
  gameShell.dataset.playerClass=id;
  gameShell.dataset.flight=String(game?.lab?.preset==="FLIGHT");
  gameShell.dataset.wing=String(!!game&&formalClass()&&id==="WING");
  gameShell.dataset.scout=String(!!game&&formalClass()&&id==="SCOUT");
}
function renderClassGrid(){
  const grid=document.querySelector("#classGrid");grid.replaceChildren();
  for(const c of Object.values(PLAYER_CLASSES)){
    const button=document.createElement("button");button.className=`class-card ${save.selectedClass===c.id?"selected":""}`;button.dataset.action="select-class";button.dataset.playerClass=c.id;button.setAttribute("aria-pressed",String(save.selectedClass===c.id));
    button.innerHTML=`<span class="class-pic" style="--class-row:${c.row};background-position:0 ${-64*c.row}px" aria-hidden="true"></span><span><strong>${c.id}</strong><small>HP ${c.hp} / ${c.speed}px/s</small><small>${c.ability}</small></span>`;grid.append(button);
  }
}
function syncSettings(){document.querySelector("#destructionSelect").value=String(save.settings.destructionLevel);document.querySelector("#shakeToggle").checked=save.settings.shake}
function openSettings(){
  if(game?.lab){show("play");openLabPanel();return}
  settingsReturn=state;resetInput();syncSettings();show("settings");document.querySelector('[data-action="settings-close"]').focus();
}
function closeSettings(){if(state!=="settings")return;resetInput();acc=0;show(settingsReturn);if(state==="play")canvas.focus()}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*100)%100;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(2,"0")}`}

function initAudio(){if(audio||!activeSettings().sound)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}
function tone(freq=.05,duration=.04,type="square",volume=.025){if(!activeSettings().sound||profiler?.running)return;initAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(volume*activeSettings().volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration)}

function renderWeaponGrid(){
  renderClassGrid();
  const densitySelect=document.querySelector("#densitySelect");if(densitySelect)densitySelect.value=save.settings.enemyDensity;
  weaponGrid.replaceChildren();
  document.querySelector("#weaponFilter").value=weaponFilter;
  for(let slot=0;slot<2;slot++){const button=document.querySelector(`#equipSlot${slot+1}`);button.textContent=`${slot+1}: ${selected[slot]||"未装備"}`;button.setAttribute("aria-pressed",String(activeEquipSlot===slot))}
  for(const w of WEAPONS){if(weaponFilter!=="ALL"&&w.category!==weaponFilter)continue;
    const unlocked=save.unlocked.includes(w.id),b=document.createElement("button");b.className=`weapon-card ${selected.includes(w.id)?"selected":""} ${unlocked?"":"locked"}`;b.disabled=!unlocked;b.dataset.weapon=w.id;
    b.innerHTML=`<span class="weapon-pic" style="background-position:${w.assetIndex*-32}px 0"></span><span><strong>${w.id} ${w.name}</strong><small>DMG ${w.damage} / ${w.interval}s · ${WEAPON_CATEGORIES[w.category]}</small><small>${w.detail}</small><small>${unlocked?selected.includes(w.id)?`SLOT ${selected.indexOf(w.id)+1}`:"OPEN":"LOCKED"}</small></span>`;
    b.addEventListener("click",()=>{if(!save.unlocked.includes(w.id))return;const other=selected.indexOf(w.id);if(other>=0)activeEquipSlot=other;else selected[activeEquipSlot]=w.id;renderWeaponGrid()});weaponGrid.append(b);
  }
  equipMessage.textContent=`${save.unlocked.length}/${WEAPONS.length} 解放 · 枠を選んで武器を指定`;
}

const input={left:false,right:false,jump:false,up:false,down:false,hover:false,special:false,fire:false,switch:false,aimX:260,aimY:90,aimMode:"mouse",touchDx:1,touchDy:0};
function resetInput(){input.left=input.right=input.jump=input.up=input.down=input.hover=input.special=input.fire=input.switch=false;if(remoteTimer!==null)clearTimeout(remoteTimer);remoteTimer=null;remoteHeld=false}
window.addEventListener("keydown",e=>{
  if(labWeaponPickerOpen){handleLabWeaponKey(e);return}
  if(state==="settings"){if(e.key==="Escape")closeSettings();return}
  if(game?.lab&&state==="lab"){if(e.key==="Escape")closeLabPanel();return}
  if(game?.lab&&(e.key==="F2")){e.preventDefault();if(state==="play")openLabPanel();return}
  if(state==="confirm"){if(e.key==="Escape")cancelTitle();return}
  if(e.target?.matches?.("input,select,button,textarea")&&state!=="play")return;
  if(["ArrowLeft","ArrowRight","ArrowUp"," "].includes(e.key)||((game?.lab||game?.player.classId==="WING")&&e.key==="ArrowDown"))e.preventDefault();
  if((state==="title")&&(e.key==="Enter"||e.key===" ")){show("mission");tone(660,.06)}
  if(e.key==="a"||e.key==="ArrowLeft")input.left=true;if(e.key==="d"||e.key==="ArrowRight")input.right=true;
  if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=true;
  if(e.key==="w"||e.key==="ArrowUp")input.up=true;if(e.key==="s"||e.key==="ArrowDown")input.down=true;
  if(e.key===" ")input.hover=true;if(e.key.toLowerCase()==="c")input.special=true;
  if(e.key.toLowerCase()==="v"&&!e.repeat&&state==="play"&&game){detonateMines(game,weaponAPI);syncRemoteControl()}
  if((e.key==="q"||e.key==="e"||e.key==="Shift")&&!e.repeat)switchWeapon();
  if((e.key==="Escape"||e.key==="p")&&state==="play")pause();else if((e.key==="Escape"||e.key==="p")&&state==="pause")resume();
});
window.addEventListener("keyup",e=>{if(e.key==="a"||e.key==="ArrowLeft")input.left=false;if(e.key==="d"||e.key==="ArrowRight")input.right=false;if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=false;if(e.key==="w"||e.key==="ArrowUp")input.up=false;if(e.key==="s"||e.key==="ArrowDown")input.down=false;if(e.key===" ")input.hover=false;if(e.key.toLowerCase()==="c")input.special=false});
function mouseAim(e){const p=clientToScreen({x:e.clientX,y:e.clientY},canvas.getBoundingClientRect());input.aimX=p.x;input.aimY=p.y;input.aimMode="mouse"}
canvas.addEventListener("pointermove",e=>{if(e.pointerType!=="touch")mouseAim(e)});
canvas.addEventListener("pointerdown",e=>{if(state==="play"&&e.pointerType!=="touch"){mouseAim(e);input.fire=true;initAudio()}});window.addEventListener("pointerup",e=>{if(e.pointerType!=="touch")input.fire=false});
window.addEventListener("blur",()=>{resetInput();liveProfiler?.reset();if(state==="play")pause()});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="play")pause()});

document.querySelectorAll("#touchControls [data-touch]").forEach(b=>{const key=b.dataset.touch;if(key==="switch"){
  b.addEventListener("pointerdown",e=>{e.preventDefault();if(state!=="play")return;b.setPointerCapture(e.pointerId);if(!mineCount(game)){switchWeapon();return}remoteHeld=false;const current=game;remoteTimer=setTimeout(()=>{remoteTimer=null;if(game===current&&state==="play"){remoteHeld=true;detonateMines(game,weaponAPI);syncRemoteControl()}},WEAPON_LIMITS.remoteHoldMs)});
  b.addEventListener("pointerup",e=>{e.preventDefault();if(remoteTimer!==null){clearTimeout(remoteTimer);remoteTimer=null;if(!remoteHeld)switchWeapon()}remoteHeld=false});
  for(const ev of ["pointercancel","lostpointercapture"])b.addEventListener(ev,()=>{if(remoteTimer!==null)clearTimeout(remoteTimer);remoteTimer=null;remoteHeld=false});return;
}b.addEventListener("pointerdown",e=>{e.preventDefault();if(state!=="play")return;b.setPointerCapture(e.pointerId);input[key]=true});for(const ev of ["pointerup","pointercancel","pointerleave"])b.addEventListener(ev,e=>{e.preventDefault();input[key]=false})});
function syncRemoteControl(){const count=mineCount(game);if(game?.arsenal.lastMineCount===count)return;if(game)game.arsenal.lastMineCount=count;gameShell.dataset.mines=String(count);document.querySelector(".switch-button small").textContent=count?`HOLD ${count}`:"WEAPON";document.querySelector(".switch-button").setAttribute("aria-label",count?`武器切替。長押しでマイン${count}個を起爆`:"武器切替")}
const aimPad=document.querySelector("#aimPad");function touchAim(e){if(state!=="play"||!game)return;const r=aimPad.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y);input.aimMode="touch";if(len>8){input.touchDx=x/len;input.touchDy=y/len}else{input.touchDx=game.player.face;input.touchDy=0}input.fire=true}
aimPad.addEventListener("pointerdown",e=>{e.preventDefault();aimPad.setPointerCapture(e.pointerId);touchAim(e);initAudio()});aimPad.addEventListener("pointermove",e=>{if(e.buttons)touchAim(e)});for(const ev of ["pointerup","pointercancel"])aimPad.addEventListener(ev,()=>input.fire=false);

document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;initAudio();tone(620,.05);const action=a.dataset.action;
  if(labWeaponPickerOpen)return;
  if(action==="lab-weapons"){openLabWeaponPicker(Number(a.dataset.slot));return}
  if(action==="title"||action==="quit"||action==="back-title"){requestTitle();return}
  if(action==="confirm-title"){discardMission();show("title");document.querySelector('[data-action="start"]').focus();return}
  if(action==="cancel-title"){cancelTitle();return}
  if(action==="settings"){openSettings();return}
  if(action==="settings-close"){closeSettings();return}
  if(action==="test-lab"){if(DEBUG)startLab();return}
  if(action==="lab-open"){openLabPanel();return}
  if(action==="lab-close"){closeLabPanel();return}
  if(action==="lab-spawn"){if(game?.lab)spawnLabEnemies();return}
  if(action==="lab-blast"){labBlast();return}
  if(action==="lab-test"){labTestShot();return}
  if(action==="lab-clear"){if(game?.lab)clearLabEnemies();return}
  if(action==="lab-reset"){if(game?.lab)startLab();return}
  if(action==="lab-exit"){if(game?.lab){discardMission();show("title")}return}
  if(action==="start"||action==="continue")show("mission");
  if(action==="howto")show("howto");if(action==="close-howto"){resetInput();show("title")}
  if(action==="select-mission"){if(!canPlayMission(a.dataset.mission,save))return;selectedMissionId=a.dataset.mission;selected=[...save.equipped];renderWeaponGrid();show("equip")}
  if(action==="select-class"&&state==="equip"&&!game?.lab&&Object.hasOwn(PLAYER_CLASSES,a.dataset.playerClass)){save.selectedClass=a.dataset.playerClass;storeSave();renderClassGrid()}
  if(action==="equip-slot"&&state==="equip"){activeEquipSlot=Number(a.dataset.slot)===1?1:0;renderWeaponGrid()}
  if(action==="mission-select"){discardMission();show("mission")}
  if(action==="back-mission")show("mission");
  if(action==="deploy"){if(selected.length!==2||selected.some(id=>!save.unlocked.includes(id))){equipMessage.textContent="解放済みの武器を2つ選んでください";return}save.equipped=[...selected];storeSave();startMission()}
  if(action==="resume")resume();if(action==="retry"){if(game?.lab)startLab();else startMission()}
});
document.querySelector("#soundToggle").addEventListener("click",e=>{const settings=activeSettings();settings.sound=!settings.sound;e.currentTarget.textContent=`SOUND: ${settings.sound?"ON":"OFF"}`;storeSave();if(settings.sound)tone(700,.06)});
document.addEventListener("change",e=>{
  if(game?.lab){changeLabSetting(e.target);return}
  if(e.target.id==="weaponFilter"&&(e.target.value==="ALL"||Object.hasOwn(WEAPON_CATEGORIES,e.target.value))){weaponFilter=e.target.value;renderWeaponGrid();return}
  if(e.target.id==="destructionSelect"&&state==="settings"){save.settings.destructionLevel=normalizeDestructionLevel(e.target.value);storeSave();syncSettings();return}
  if(e.target.id==="shakeToggle"&&state==="settings"){save.settings.shake=e.target.checked;if(game&&!e.target.checked){game.shake=0;game.impact.shakeUntil=0}storeSave();return}
  if(e.target.id!=="densitySelect"||!Object.hasOwn(DENSITY_MODES,e.target.value))return;save.settings.enemyDensity=e.target.value;storeSave();
});

function startMission(id=selectedMissionId,labOnly=false){
  if(!canPlayMission(id,save)&&!(labOnly&&DEBUG&&id==='M02'))return false;
  discardMission();view.renderOffset=0;selectedMissionId=id;
  game={missionId:id,time:0,score:0,kills:0,crates:0,camera:0,shake:0,area:-1,areaText:"",areaTimer:0,nextEnemyId:1,bossStarted:false,midbossAlive:false,clear:false,
    density:save.settings.enemyDensity,enemyLimit:DENSITY_MODES[save.settings.enemyDensity].limit,liveEnemies:0,liveMobs:0,
    director:new SpawnDirector(save.settings.enemyDensity),grid:new SpatialGrid(),attacks:new AttackDirector(),
    shotCandidates:[],blastCandidates:[],chainCandidates:[],separationCandidates:[],impact:createImpactState(),arsenal:createArsenal(),settings:save.settings,
    player:{x:64,y:WORLD.ground-32,vx:0,vy:0,w:14,h:27,hp:100,maxHp:100,onGround:true,face:1,invuln:0,shotCd:0,switchCd:0,shootPose:0,weaponSlot:0,anim:0,dead:false},
    enemies:[],shots:[],enemyShots:[],effects:[],items:[{x:2050,y:WORLD.ground-25,type:"crate",alive:true}],platforms:[{x:520,y:120,w:80},{x:1220,y:105,w:96},{x:2700,y:116,w:72},{x:3500,y:100,w:90}]};
  applyPlayerClass(game.player,save.selectedClass);syncClassControls();syncRemoteControl();
  game.world=id==='M02'?M02.world:WORLD;game.player.world=game.world;game.areas=id==='M02'?M02.areas:MISSION_AREAS;
  if(id==='M02'){
    game.platforms=createM02Geometry();game.grid=new SpatialGrid(INVASION.gridSize,game.world);game.director=new SpawnDirector(game.density,M02.encounters);game.items=[{x:1950,y:123,type:'crate',alive:true},{x:3370,y:123,type:'crate',alive:true}];
    initializeUndergroundObjects();
  }
  game.battleCamera=createBattleCamera(game.player);syncCameraView();
  show("play");touchControls.style.visibility="visible";canvas.focus();announceArea(0);
  canvas.setAttribute('aria-label',`ゲーム画面。${id} ${MISSIONS.find(m=>m.id===id).name}を進行中`);
}
function pause(){if(state!=="play")return;show("pause");resetInput()}
function resume(){if(!game)return;show("play");canvas.focus()}
function switchWeapon(){if(state!=="play"||!game||game.player.switchCd>0)return;game.player.weaponSlot=1-game.player.weaponSlot;game.player.switchCd=.25;game.player.shotCd=.25;tone(440,.05)}
function announceArea(i){game.area=i;game.areaText=`AREA ${i+1}  ${(game.areas??MISSION_AREAS)[i].name}`;game.areaTimer=2.2;tone(520,.1)}

function initializeUndergroundObjects(){
  for(const n of M02.nests)spawnEnemy('nest',n.x,n.y);
  for(const b of M02.barriers){const platform={...b,x:b.x-b.w/2,solid:true,active:true,kind:'barrier'};game.platforms.push(platform);const e=spawnEnemy('barrier',b.x,b.y);if(e)e.platform=platform}
}

function spawnEnemy(type,x,y=null){
  if(game.liveEnemies>=game.enemyLimit)return null;
  if(game.bossStarted&&!['boss','queen'].includes(type)&&game.liveMobs>=INVASION.bossMinions[game.density])return null;
  if(game.missionId==='M02'){const pos=validEnemyPosition(game,type,x,y);x=pos.x;y=pos.y}
  const t=ENEMY_TYPES[type],uid=game.nextEnemyId++,v=variation(uid),baseY=y??(type==="needle"?45+v*40:type==="spider"?34:WORLD.ground-t.h);
  if(game.missionId==='M02'&&['worm','crawler'].includes(type))for(const pl of game.platforms)if(pl.active!==false&&x+t.w/2>pl.x&&x-t.w/2<pl.x+pl.w&&baseY+t.h>pl.y&&baseY<pl.y+(pl.h??8))x=clamp(pl.x+pl.w+t.w/2+1,24,game.world.width-24);
  const e={uid,type,x,y:baseY,baseY,w:t.w,h:t.h,hp:t.hp,maxHp:t.hp,dead:false,death:0,phase:"move",timer:v,anim:v*8,attackFlash:0,face:-1,
    speedScale:isMob({type})?1+(v*2-1)*INVASION.speedVariation:1,shotCd:.7+v*1.6,vx:0,vy:0,separateX:0,separateY:0,thinkTime:0,diveCd:v*INVASION.diveCooldown,diveTimer:0,diveOffset:0,active:true};
  game.enemies.push(e);game.liveEnemies++;if(isMob(e))game.liveMobs++;if(type==="beetle")game.midbossAlive=true;return e;
}
function startBoss(){game.bossStarted=true;game.midbossAlive=false;game.director.stopped=true;game.enemies.length=0;game.impact=createImpactState();game.liveEnemies=game.liveMobs=0;game.enemyShots.length=0;
  if(game.missionId==='M02'){spawnEnemy('queen',M02.bossSpawnX,WORLD.ground-96);game.areaText='WARNING  B-02 ABYSS QUEEN'}else{spawnEnemy("boss",4420,WORLD.ground-58);game.areaText="WARNING  B-01 マザークロウラー"}game.areaTimer=3;tone(90,.6,"sawtooth",.04)}
function spawnBossMinion(boss,index){const p=game.player,side=boss.x>=p.x?1:-1;const x=clamp(boss.x+side*(30+index*25),24,WORLD.width-24);if(Math.abs(x-p.x)>=90)spawnEnemy("crawler",x)}
function pushEffect(effect){
  pushImpactEffect(game,effect);
}

function shoot(){const p=game.player,w=weapon(activeEquipment()[p.weaponSlot]);if(p.shotCd>0||p.switchCd>0||p.dead)return;let px=p.x+(p.face>0?18:-3);const py=p.y+13;
  const offset=activeSettings().shake?view.renderOffset:0,aimInput=input.aimMode==="mouse"&&offset?{...input,aimX:input.aimX-offset,aimY:input.aimY-offset}:input;
  const target=aimTarget(aimInput,{x:px,y:py},game.camera,view.zoom);let dx=target.x-px,dy=target.y-py,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;p.face=dx>=0?1:-1;p.shotCd=w.interval;
  if(w.expanded){px=p.x+(p.face>0?18:-18);if(!fireExpanded(game,w,{x:px,y:py},target,weaponAPI)){p.shotCd=.12;return}p.shootPose=.11;pushEffect({x:px,y:py,kind:"muzzle",life:.09,max:.09});syncRemoteControl();tone(110+w.damage*3,.05);return}
  const make=(ang=0,offset=0)=>{const ca=Math.cos(ang),sa=Math.sin(ang),vx=(dx*ca-dy*sa)*w.speed,vy=(dx*sa+dy*ca)*w.speed;game.shots.push({x:px,y:py+offset,originX:px,originY:py,vx,vy,w:7,h:4,life:w.range/w.speed,type:w.type,damage:w.damage,pierce:w.pierce||0,radius:w.radius||0,rehit:{},weapon:w})};
  if(w.type==="spread")[-.34,-.17,0,.17,.34].forEach(a=>make(a));else if(w.type==="homing"){make(-.1,-2);make(.1,3)}else make();
  p.shootPose=.11;pushEffect({x:px,y:py,kind:"muzzle",life:.09,max:.09});tone(w.type==="rocket"||w.type==="grenade"?95:220+w.damage*8,.04,w.type==="laser"?"sawtooth":"square",.018);
}

function update(dt){if(state!=="play"||!game)return;const g=game,p=g.player;
  if(advanceImpact(g,dt)){let write=0;for(const e of g.enemies){if(e.dead)updateDeath(g,e,dt);if(!e.dead||e.death>0)g.enemies[write++]=e}g.enemies.length=write;updateEffects(dt);return}
  g.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.switchCd=Math.max(0,p.switchCd-dt);p.shootPose=Math.max(0,p.shootPose-dt);g.areaTimer=Math.max(0,g.areaTimer-dt);g.shake=Math.max(0,g.shake-dt*16);
  if(!formalClass())p.hitPose=Math.max(0,p.hitPose-dt);
  if(formalClass()){const grounded=p.onGround;moveClassPlayer(p,input,g.platforms,dt);if(grounded&&!p.onGround&&p.vy<0&&p.classId!=="WING")tone(330,.06)}
  else if(g.lab?.preset==="FLIGHT")moveFlightPlayer(p,input,g.platforms,dt);else{
  const preset=g.lab?PLAYER_PRESETS[g.lab.preset]:PLAYER_PRESETS.STANDARD;
  const move=(input.right?1:0)-(input.left?1:0);p.vx=move*preset.speed;if(move)p.face=move;if(input.jump&&p.onGround){p.vy=-preset.jump;p.onGround=false;tone(330,.06)}p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);p.x=clamp(p.x+p.vx*dt,8,WORLD.width-25);p.y+=p.vy*dt;
  let floor=WORLD.ground-32;for(const pl of g.platforms){if(p.x+7>pl.x&&p.x-7<pl.x+pl.w&&p.y+32<=pl.y+8&&p.y+32+p.vy*dt>=pl.y)floor=Math.min(floor,pl.y-32)}if(p.y>=floor){p.y=floor;p.vy=0;p.onGround=true}else p.onGround=false;
  }
  if(!g.lab){if(g.missionId==='M01'&&g.midbossAlive&&p.x>2150)p.x=2150;if(g.bossStarted)p.x=g.missionId==='M02'?clamp(p.x,M02.bossX,5560):clamp(p.x,4100,4760)}
  if(g.lab?.cameraMode==="FIXED")fixedLabCamera(g.battleCamera,p,g.lab.fixedZoom);else updateBattleCamera(g.battleCamera,p,g.enemies,g,dt);syncCameraView();p.anim+=dt*(Math.abs(p.vx)>0?10:4);
  if(input.fire)shoot();
  if(!g.lab){g.director.update(dt,g,spawnEnemy,viewBounds(g.camera,view.zoom));
  for(let i=g.area+1;i<g.areas.length;i++)if(p.x>=g.areas[i].x)announceArea(i);
  if(p.x>(g.missionId==='M02'?M02.bossX:4100)&&!g.bossStarted)startBoss();
  }
  if(g.missionId==='M02')updateNests(g,dt,spawnEnemy);
  g.grid.rebuild(g.enemies);updateShots(dt);updateExpanded(g,dt,weaponAPI);syncRemoteControl();updateEnemies(dt);updateEnemyShots(dt);updateItems(dt);updateEffects(dt);
  canvas.dataset.gameState=state;canvas.dataset.playerX=Math.round(p.x);canvas.dataset.playerHp=Math.ceil(p.hp);canvas.dataset.enemies=g.liveEnemies;canvas.dataset.boss=g.bossStarted?"1":"0";canvas.dataset.density=g.density;canvas.dataset.enemyLimit=g.enemyLimit;
  canvas.dataset.playerClass=p.classId;canvas.dataset.flightEnergy=p.energy.toFixed(1);canvas.dataset.missionId=g.missionId;canvas.dataset.area=String(g.area+1);
  if(p.hp<=0&&!p.dead){p.dead=true;scheduleMission(()=>{document.querySelector("#gameoverStats").textContent=`SCORE ${g.score} / TIME ${formatTime(g.time)}`;missionScreen("gameover")},650)}
}

function hitRect(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function damageEnemy(e,dmg,source={}){
  if(e.dead)return;if(e.type==='queen')dmg=queenDamage(e,dmg,source);e.hp-=dmg;game.score+=Math.max(1,Math.round(dmg));e.hitFlash=.07;hitVisual(game,e,source);
  if(e.hp>0)return;
  e.dead=true;beginDeath(game,e,source,viewBounds(game.camera,view.zoom));game.liveEnemies--;if(isMob(e))game.liveMobs--;game.kills++;game.score+=ENEMY_TYPES[e.type].score;
  if(e.type==="beetle")game.midbossAlive=false;
  if(e.platform)e.platform.active=false;
  if(e.type==='nest'){pushEffect({kind:'nestBreak',x:e.x,y:e.y+24,life:.65,max:.65});impactShake(game)}
  if(e.type==='queen')for(let i=0;i<5;i++)scheduleMission(()=>{if(game)pushEffect({kind:'bossBreak',x:e.x+(i%3-1)*32,y:e.y+24+i*8,life:.7,max:.7})},i*130);
  if(isBoss(e)&&!game.lab){
    game.score+=Math.max(0,Math.floor(3000-game.time*8));game.enemies.length=0;game.enemies.push(e);game.liveEnemies=game.liveMobs=0;
    game.impact.corpses=1;
    game.enemyShots.length=0;game.shots.length=0;game.player.invuln=99;scheduleMission(completeMission,900);
  }else if(Math.random()<.06)game.items.push({x:e.x,y:e.y+e.h/2,type:"heal",alive:true});
  else if(Math.random()<.02)game.items.push({x:e.x,y:e.y+e.h/2,type:"crate",alive:true});
  if(game.time>=(game.nextDeathSound||0)){tone(80,.12,"sawtooth",.025);game.nextDeathSound=game.time+.05}
}
function explode(s){
  pushEffect({x:s.x,y:s.y,kind:"explosion",life:.45,max:.45,r:s.radius});
  const candidates=game.grid.query(s.x-s.radius-48,s.y-s.radius-32,s.x+s.radius+48,s.y+s.radius+32,game.blastCandidates);
  const source={type:s.type??s.weapon?.type??"rocket",effectType:s.effectType,assetIndex:s.assetIndex,radial:true,x:s.x,y:s.y,radius:s.radius};
  for(let i=0;i<candidates.length;i++){const e=candidates[i];if(!e.dead&&Math.hypot(s.x-e.x,s.y-e.y-e.h/2)<s.radius){damageEnemy(e,s.damage,source);if(e.dead)s.onKill?.(e)}}
  if(s.assetIndex>=8)pushEffect({x:s.x,y:s.y,kind:"weaponBurst",assetIndex:s.assetIndex,life:.35,max:.35,r:s.radius});
  impactShake(game);tone(65,.18,"sawtooth",.04);
}
function updateShots(dt){for(const s of game.shots){if(s.expanded)continue;const oldX=s.x,oldY=s.y;s.life-=dt;if(s.type==="grenade")s.vy+=330*dt;if(s.type==="homing"){const target=nearestEnemy(game.enemies,s.x,s.y,Infinity,null,true);if(target){const a=Math.atan2(target.y-s.y,target.x-s.x),speed=Math.hypot(s.vx,s.vy),desired={x:Math.cos(a)*speed,y:Math.sin(a)*speed};s.vx+=(desired.x-s.vx)*Math.min(1,3.8*dt);s.vy+=(desired.y-s.vy)*Math.min(1,3.8*dt)}}s.x+=s.vx*dt;s.y+=s.vy*dt;
    const terrain=game.missionId==='M02'?terrainContact(oldX,oldY,s.x,s.y,game.platforms,s.w/2,false,game.world):null;if(terrain){s.x=terrain.x;s.y=terrain.y}
    if((s.type==="grenade"&&s.y>WORLD.ground-3)||s.life<=0){if(s.radius)explode(s);s.dead=true;continue}
    const candidates=game.grid.query(s.x-s.w/2-48,s.y-s.h/2-32,s.x+s.w/2+48,s.y+s.h/2+32,game.shotCandidates);
    for(const e of candidates){if(e.dead||s.dead||(s.rehit[e.uid]??0)>game.time)continue;const box={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(game.missionId==='M02'?segmentEntry(oldX,oldY,s.x,s.y,e.x-e.w/2-s.w/2,e.y-s.h/2,e.x+e.w/2+s.w/2,e.y+e.h+s.h/2):hitRect({x:s.x,y:s.y,w:s.w,h:s.h},box)){s.rehit[e.uid]=game.time+(s.weapon.rehit??999);damageEnemy(e,s.damage,s);if(s.type==="thunder"){const seen=new Set([e]);let from=e;for(let c=0;c<3;c++){const nearby=game.grid.query(from.x-133,from.y-117,from.x+133,from.y+117,game.chainCandidates);const next=nearestEnemy(nearby,from.x,from.y,85,seen);if(!next)break;seen.add(next);damageEnemy(next,s.damage*.75,{type:"thunder",vx:next.x-from.x,vy:next.y-from.y});pushEffect({x:from.x,y:from.y,x2:next.x,y2:next.y,kind:"lightning",life:.16,max:.16});from=next}}
      if(s.radius){explode(s);s.dead=true}else if(s.pierce>0){s.pierce--}else s.dead=true}}
    if(terrain&&!s.dead){if(s.radius)explode(s);s.dead=true}
  }let write=0;for(const s of game.shots)if(!s.dead&&s.x>-64&&s.x<(game.world??WORLD).width+64&&s.y>-600&&s.y<260)game.shots[write++]=s;game.shots.length=write}

function updateEnemies(dt){const p=game.player;game.grid.rebuild(game.enemies);prepareSeparation(game.enemies,game.grid,game.separationCandidates);game.attacks.begin(game.time,game.enemies,game.enemyShots);
  for(const e of game.enemies){e.anim+=dt*7;e.attackFlash=Math.max(0,e.attackFlash-dt);e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);if(e.dead){updateDeath(game,e,dt);continue}const t=ENEMY_TYPES[e.type];e.shotCd-=dt;e.face=p.x>=e.x?1:-1;
    if(game.missionId==='M02'&&(e.type==='nest'||e.type==='barrier')){e.active=Math.abs(e.x-p.x)<NEST.activationDistance;continue}
    const dx=p.x-e.x,far=Math.abs(dx)>INVASION.farDistance;e.thinkTime+=dt;const think=!far||e.thinkTime>=INVASION.farThinkInterval;if(think)e.thinkTime=0;
    if(e.type==="crawler"){const standOff=(e.uid%INVASION.contactLanes)*INVASION.contactSpacing,approach=clamp((Math.abs(dx)-standOff)/INVASION.approachRange,0,1);e.x+=Math.sign(dx)*t.speed*e.speedScale*approach*dt;e.y=WORLD.ground-e.h}
    if(e.type==="spider"){if(think)e.y=e.baseY+Math.sin(e.anim*.7)*9;e.x+=Math.sign(dx)*t.speed*.28*e.speedScale*dt;if(e.shotCd<=0&&Math.abs(dx)<230){if(game.attacks.ranged(game.time)){enemyFire(e,115);e.shotCd=1.65+variation(e.uid)*.6}else e.shotCd=.1+variation(e.uid)*.18}}
    if(e.type==="needle"){
      e.x+=Math.sign(dx)*t.speed*.75*e.speedScale*dt;e.diveCd-=dt;e.diveTimer=Math.max(0,e.diveTimer-dt);
      if(Math.abs(dx)<85&&e.diveCd<=0&&game.attacks.dive(game.time)){e.diveTimer=INVASION.diveDuration;e.diveCd=INVASION.diveCooldown+variation(e.uid)}
      if(e.diveTimer>0)e.diveOffset+=clamp((p.y-e.baseY-e.diveOffset)*dt*2.2,-3,3);else e.diveOffset=Math.max(0,e.diveOffset-dt*35);
      if(think)e.y=clamp(e.baseY+Math.sin(e.anim*.9)*19+e.diveOffset,12,WORLD.ground-e.h);
    }
    if(e.type==="beetle"){if(Math.abs(e.x-p.x)>150)e.x+=Math.sign(p.x-e.x)*t.speed*dt;if(e.shotCd<=0){enemyBurst(e,3,155);e.shotCd=1.8}}
    if(e.type==="boss")updateBoss(e,dt);
    if(e.type==='queen')updateQueen(game,e,dt,enemyFire,spawnEnemy,pushEffect);
    if(e.type==='worm'){e.vx=Math.sign(dx)*t.speed*e.speedScale+e.separateX;moveTunnelEnemy(game,e,dt)}
    if(e.type==='spitter'&&e.shotCd<=0&&Math.abs(dx)<300){if(game.attacks.ranged(game.time)){enemyFire(e,125);e.shotCd=2+variation(e.uid)}else e.shotCd=.2}
    if(isMob(e)&&e.type!=='worm'){e.x=clamp(e.x+e.separateX*dt,8,(game.world??WORLD).width-8);if(e.type==="needle")e.y=clamp(e.y+e.separateY*dt,12,WORLD.ground-e.h)}
    if(game.missionId==='M02'&&['needle','spider'].includes(e.type)){const safe=validEnemyPosition(game,'needle',e.x,e.y);e.y=safe.y}
    const pb={x:p.x,y:p.y+16,w:p.w,h:p.h},eb={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect(pb,eb))hurtPlayer(t.damage,e.x)
  }let write=0;for(const e of game.enemies)if(!e.dead||e.death>0)game.enemies[write++]=e;game.enemies.length=write}
function updateBoss(e,dt){const p=game.player;e.timer+=dt;const phase=e.hp>800?0:e.hp>400?1:2;if(e.phase==="charge"){e.x+=e.vx*dt;if(e.x<4130||e.x>4720){e.x=clamp(e.x,4130,4720);e.vx*=-1;e.phase="move";e.timer=0}}else{e.x+=Math.sign((phase===2?p.x:4540)-e.x)*ENEMY_TYPES.boss.speed*(phase===2?.45:.18)*dt;if(e.timer>2.2-phase*.3){e.timer=0;const action=Math.floor(Math.random()*3);if(action===0)enemyBurst(e,5,130);else if(action===1){for(let i=0;i<2+phase;i++)spawnBossMinion(e,i)}else{e.phase="charge";e.vx=Math.sign(p.x-e.x)*(100+phase*25)}}}}
function enemyFire(e,speed,angleOffset=0){e.attackFlash=.18;const p=game.player,ex=e.x,ey=e.y+e.h/2,a=Math.atan2(p.y+15-ey,p.x-ex)+angleOffset;game.enemyShots.push({kind:e.type==='spitter'||e.type==='queen'?'acid':null,x:ex,y:ey,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,w:5,h:5,life:4,damage:e.type==='spitter'?12:ENEMY_TYPES[e.type].damage*.6,normal:isMob(e)})}
function enemyBurst(e,count,speed){for(let i=0;i<count;i++)enemyFire(e,speed,(i-(count-1)/2)*.15);tone(120,.08)}
function hurtPlayer(amount,sourceX){const p=game.player;if(game.lab?.invincible||p.invuln>0||p.dead||game.clear)return;const c=PLAYER_CLASSES[p.classId],scale=formalClass()?c.damageScale:1,kick=formalClass()?c.knockback:1;p.hp=Math.max(0,p.hp-amount*scale);p.invuln=1;p.hitPose=.16;p.vx=(sourceX<p.x?60:-60)*kick;p.vy=-90*kick;game.shake=4;tone(55,.15,"sawtooth",.04)}
function updateEnemyShots(dt){const p=game.player;for(const s of game.enemyShots){const x=s.x,y=s.y;s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(game.missionId==='M02'&&terrainContact(x,y,s.x,s.y,game.platforms,s.kind==='wave'?0:2,false,game.world))s.dead=true;if(!s.dead&&hitRect({x:s.x,y:s.y,w:s.w,h:s.h},{x:p.x,y:p.y+16,w:p.w,h:p.h})){hurtPlayer(s.damage,s.x);s.dead=true}}let write=0;for(const s of game.enemyShots)if(!s.dead&&s.life>0&&s.x>-64&&s.x<(game.world??WORLD).width+64&&s.y>-600&&s.y<260)game.enemyShots[write++]=s;game.enemyShots.length=write}
function updateItems(){const p=game.player;for(const it of game.items){if(!it.alive)continue;if(Math.abs(it.x-p.x)<20&&Math.abs(it.y-(p.y+16))<26){it.alive=false;if(it.type==="heal")p.hp=Math.min(p.maxHp,p.hp+25);else gCrate();tone(880,.12)}}}
function gCrate(){game.crates++;game.score+=500;game.areaText="WEAPON BOX ACQUIRED";game.areaTimer=1.6;if(game.lab)return;const reward=pickReward(save.unlocked,Math.random,false);if(reward){save.unlocked.push(reward);game.areaText=`UNLOCK ${reward}`}else game.areaText="ARSENAL COMPLETE / SCORE +500";storeSave()}
function updateEffects(dt){let write=0;for(const f of game.effects){f.life-=dt;if(f.life>0)game.effects[write++]=f}game.effects.length=write;updateParticles(game,dt)}

function completeMission(){if(!game||game.clear||game.lab)return;game.clear=true;
  const firstClear=!save.clearedMissions.includes(game.missionId);
  const reward=game.missionId==='M02'?pickReward(save.unlocked,Math.random,false):game.missionId==="M01"&&firstClear&&!save.unlocked.includes("L-03")?"L-03":null;
  if(game.missionId==='M02'){game.crates++;if(!reward)game.score+=500}
  if(reward)save.unlocked.push(reward);save=recordMissionClear(save,game.missionId);save.highScore=Math.max(save.highScore,game.score);save.bestTime=save.bestTime===null?game.time:Math.min(save.bestTime,game.time);storeSave();clearArsenal(game);
  const previous=save.missionStats[game.missionId];save.missionStats[game.missionId]={highScore:Math.max(previous?.highScore??0,game.score),bestTime:Math.min(previous?.bestTime??Infinity,game.time)};storeSave();
  const w=reward?weapon(reward):null;document.querySelector("#resultStats").innerHTML=`<div>TIME<b>${formatTime(game.time)}</b></div><div>SCORE<b>${game.score}</b></div><div>ENEMIES<b>${game.kills}</b></div><div>BOXES<b>${game.crates}</b></div>`;
  document.querySelector("#rewardBox").innerHTML=w?`<span>${game.missionId==='M02'?(firstClear?'FIRST CLEAR / WEAPON BOX':'MISSION WEAPON BOX'):'WEAPON UNLOCKED'}</span><strong>${w.id} ${w.name}</strong>`:`<span>ARSENAL ${save.unlocked.length}/${WEAPONS.length}</span><strong>${save.unlocked.length===WEAPONS.length?game.missionId==='M02'?"全武器取得済み / SCORE +500":"全武器取得済み":"武器箱の解放記録を保存"}</strong>`;scheduleMission(()=>show("result"),500)
}

function draw(){
  view.renderOffset=0;
  if(!assetsReady){ctx.fillStyle="#050915";ctx.fillRect(0,0,320,180);return}
  if(!game||!["play","pause","confirm","lab","settings"].includes(state)){ctx.drawImage(images.bg,0,0);return}
  const g=game,shake=g.shake&&activeSettings().shake?(Math.random()-.5)*g.shake:0;
  view.renderOffset=Math.round(shake);
  ctx.save();
  const origin=worldToScreen({x:0,y:0},g.camera,view.zoom);
  ctx.translate(Math.round(shake)+origin.x,Math.round(shake)+origin.y);
  ctx.scale(view.zoom,view.zoom);
  drawBackdrop(g);drawWorld(g);drawItems(g);drawEnemies(g);drawShots(g);drawPlayer(g.player);drawEffects(g);
  ctx.restore();drawHud(g);if(g.missionId==='M02')drawUndergroundHud(g);drawClassHud(g);drawImpactHud(g);
}
function drawUndergroundHud(g){
  ctx.fillStyle='#071522';ctx.fillRect(225,4,91,10);ctx.fillStyle='#e4fff6';ctx.font='7px monospace';ctx.fillText(`${g.lab?'LAB':g.missionId} ${formatTime(g.time)}`,232,12);
  const boss=g.enemies.find(e=>e.type==='queen'&&!e.dead);if(!boss)return;
  ctx.fillStyle='#02060dcc';ctx.fillRect(42,158,236,15);ctx.fillStyle='#ff4f6d';ctx.fillRect(47,166,226*boss.hp/boss.maxHp,4);ctx.fillStyle='#ffe05c';ctx.fillText('B-02 ABYSS QUEEN',94,164);
}
function drawBackdrop(g){
  const bounds=viewBounds(g.camera,view.zoom),start=g.camera-(g.camera*.18%320);
  // The zoom reveals sky above the original artwork. Fill it and repeat the city horizontally.
  ctx.fillStyle="#040a16";ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,bounds.bottom-bounds.top+20);
  for(let x=start-320;x<bounds.right+320;x+=320)ctx.drawImage(g.missionId==='M02'?images.underground:images.bg,x,0);
  if(g.missionId==='M02'){ctx.fillStyle='#081321';ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,Math.max(0,-bounds.top));for(let x=Math.floor(bounds.left/96)*96;x<bounds.right+96;x+=96){ctx.fillStyle='#17353d';ctx.fillRect(x,bounds.top,5,Math.max(0,-bounds.top+8));ctx.fillStyle='#3c665e';ctx.fillRect(x+2,0,2,6)}}
}
function drawWorld(g){
  const bounds=viewBounds(g.camera,view.zoom);
  if(g.missionId==='M02'){drawUnderground(g,bounds);return}
  ctx.fillStyle="#0b1825";ctx.fillRect(bounds.left-10,WORLD.ground,view.width+20,bounds.bottom-WORLD.ground+10);
  for(let x=Math.floor(bounds.left/16)*16-16;x<bounds.right+16;x+=16)ctx.drawImage(images.tiles,((Math.floor(x/16)%8+8)%8)*16,0,16,16,x,WORLD.ground,16,16);
  ctx.fillStyle="#d4b944";for(let x=Math.floor(bounds.left/40)*40;x<bounds.right;x+=40)ctx.fillRect(x,168,19,2);
  for(const pl of g.platforms)if(pl.x+pl.w>bounds.left&&pl.x<bounds.right){ctx.fillStyle="#203e4a";ctx.fillRect(pl.x,pl.y,pl.w,8);ctx.fillStyle="#57a1a0";ctx.fillRect(pl.x,pl.y,pl.w,2)}
  for(const a of MISSION_AREAS)if(a.x>bounds.left&&a.x<bounds.right){ctx.fillStyle="#37e8df44";ctx.fillRect(a.x,30,1,118)}
}
function drawUnderground(g,bounds){
  const tile=(index,x,y,height=16,width=16)=>ctx.drawImage(images.undergroundTiles,index%8*16,Math.floor(index/8)*16,width,height,x,y,width,height);
  ctx.fillStyle='#0d202a';ctx.fillRect(bounds.left-10,WORLD.ground,view.width+20,bounds.bottom-WORLD.ground+10);
  for(let x=Math.floor(bounds.left/16)*16;x<bounds.right+16;x+=16)tile(0,x,WORLD.ground);
  for(const p of g.platforms){if(p.active===false||p.kind==='barrier'||p.x+p.w<bounds.left||p.x>bounds.right)continue;
    ctx.fillStyle=p.kind==='pipe'?'#315d61':p.kind==='metal'?'#263e4e':'#152a38';ctx.fillRect(p.x,p.y,p.w,p.h??8);
    ctx.fillStyle=p.kind==='metal'?'#a0c6ab':'#517985';ctx.fillRect(p.x,p.y,p.w,2);
    for(let x=Math.max(p.x,Math.floor(bounds.left/16)*16);x<p.x+p.w&&x<bounds.right;x+=16)tile(p.kind==='pipe'?3:p.kind==='cave'?8:p.kind==='wall'?2:0,x,p.y,Math.min(16,p.h??8),Math.min(16,p.x+p.w-x));
  }
  ctx.font='8px monospace';ctx.fillStyle='#8fe2ac';
  for(const [x,y,label] of [[2020,58,'UPPER →'],[2290,106,'LOWER →'],[3180,46,'MERGE →']])if(x>bounds.left&&x<bounds.right)ctx.fillText(label,x,y);
}
function drawPlayer(p){if(p.invuln>0&&!p.hitPose&&Math.floor(p.invuln*12)%2)return;const frame=classPlayerFrame(p),row=PLAYER_CLASSES[p.spriteClass||p.classId].row;const x=Math.round(p.x-12),y=Math.round(p.y);ctx.save();if(p.face<0){ctx.translate(x+24,0);ctx.scale(-1,1);ctx.drawImage(images.classes,frame*24,row*32,24,32,0,y,24,32)}else ctx.drawImage(images.classes,frame*24,row*32,24,32,x,y,24,32);const w=weapon(activeEquipment()[p.weaponSlot]);if(w.expanded)ctx.drawImage(images.heldWeapons,w.assetIndex*16,0,16,16,(p.face<0?0:x)+14,y+5,16,16);ctx.restore()}
function drawClassHud(g){
  const p=g.player,c=PLAYER_CLASSES[p.classId];ctx.font="6px monospace";ctx.fillStyle="#071522dd";ctx.fillRect(4,46,80,16);ctx.fillStyle="#e4fff6";
  ctx.fillText(g.lab&&!formalClass()?`${g.lab.preset} / TEST`:c.id,8,53);
  if(c.id==="WING"&&formalClass()){ctx.fillStyle=p.energy<20?"#ff4f6d":"#37e8df";ctx.fillRect(8,56,50*p.energy/c.energyMax,3);ctx.fillText(`${Math.ceil(p.energy)}`,61,60)}
  else if(c.id==="SCOUT"&&formalClass())ctx.fillText(p.dashCd>0?`DASH ${p.dashCd.toFixed(1)}s`:"DASH READY",8,60);
}
function drawEnemies(g){let deaths=0,trails=0;for(const e of g.enemies){const x=Math.round(e.x);if(x<g.camera-110||x>g.camera+view.width+110||e.dead&&e.death<=0)continue;
    const frame=e.dead?3:e.phase==="charge"?2:e.attackFlash>0?2:Math.floor(e.anim)%2;
    if(e.dead&&e.deathTrail){const profile=DESTRUCTION_LEVELS[e.deathLevel];
      for(let n=0;n<Math.min(e.trailCount,profile.trails)&&trails<IMPACT.maxTrailDraws;n++){
        const i=((e.trailCursor-1-n+IMPACT.trailSlots)%IMPACT.trailSlots)*4,age=e.deathAge-e.deathTrail[i+3];if(age>IMPACT.trailLife)continue;
        drawDeathGhost(e,e.deathTrail[i],e.deathTrail[i+1],e.deathTrail[i+2],profile.trailAlpha*(1-age/IMPACT.trailLife)*clamp(e.death/.12,0,1),deaths<INVASION.maxDeathSprites);trails++;
      }
    }
    if(e.dead){ctx.globalAlpha=clamp(e.death/.12,0,1);if(deaths>=INVASION.maxDeathSprites){ctx.fillStyle=e.deathColor||"#ff4f6d";ctx.fillRect(x-3,Math.round(e.y+e.h/2),6,2);ctx.fillRect(x-1,Math.round(e.y+e.h/2)-2,2,5);ctx.globalAlpha=1;continue}deaths++;ctx.save();ctx.translate(x,Math.round(e.y+e.h/2));ctx.rotate(e.deathAngle||0)}
    const localX=e.dead?0:x,localY=e.dead?-e.h/2:e.y;
    if(['worm','spitter','nest','queen','barrier'].includes(e.type))drawUndergroundEnemy(e,frame,localX,localY);
    else if(e.type==="boss")ctx.drawImage(images.boss,frame*96,0,96,64,localX-48,Math.round(localY),96,64);else{const t=ENEMY_TYPES[e.type],size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,frame*48,t.row*48,48,48,localX-size/2,Math.round(localY+e.h-size),size,size)}
    if(e.dead){if(e.deathType==="flame"||e.deathDelay>0){ctx.fillStyle=e.deathType==="flame"?"#ff8b42":"#b88cff";ctx.fillRect(-8,-3,4,2);ctx.fillRect(5,1,4,3)}ctx.restore();ctx.globalAlpha=1}
    else{if(e.hitFlash>0){ctx.fillStyle="#fff7d5";ctx.fillRect(x-6,Math.round(e.y+e.h/2),12,2)}if(e.type==='nest'){ctx.fillStyle='#09121e';ctx.fillRect(x-24,e.y-8,48,5);ctx.fillStyle='#aef046';ctx.fillRect(x-24,e.y-8,48*e.hp/e.maxHp,5)}if(e.type==='queen'&&weakCore(e).open){const core=weakCore(e);ctx.strokeStyle='#fff08b';ctx.lineWidth=2;ctx.strokeRect(core.x-12,core.y-10,24,20)}}
  }}
function drawUndergroundEnemy(e,frame,x,y){
  if(e.type==='barrier'){ctx.drawImage(images.undergroundTiles,e.hp<e.maxHp/2?80:64,16,16,16,x-e.w/2,y,e.w,e.h);return}
  ctx.drawImage(images[e.type],frame*e.w,0,e.w,e.h,x-e.w/2,Math.round(y),e.w,e.h);
}
function drawDeathGhost(e,x,y,angle,alpha,full){
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y+e.h/2));ctx.rotate(angle);
  if(!full){ctx.fillStyle=e.deathColor;ctx.fillRect(-3,0,6,2)}
  else if(['worm','spitter','nest','queen','barrier'].includes(e.type))drawUndergroundEnemy(e,3,0,-e.h/2);
  else if(e.type==="boss")ctx.drawImage(images.boss,288,0,96,64,-48,-e.h/2,96,64);
  else{const size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,144,ENEMY_TYPES[e.type].row*48,48,48,-size/2,e.h/2-size,size,size)}
  ctx.restore();ctx.globalAlpha=1;
}
function drawShots(g){
  drawExpanded(ctx,g,images,viewBounds(g.camera,view.zoom));
  for(const s of g.shots){if(s.expanded||s.x<g.camera-16||s.x>g.camera+view.width+16)continue;const i=s.weapon.assetIndex,x=Math.round(s.x),y=Math.round(s.y);ctx.drawImage(images.shots,i*16,0,16,16,x-8,y-8,16,16)}
  for(const s of g.enemyShots){if(s.x<g.camera-32||s.x>g.camera+view.width+32)continue;
    if(s.kind==='acid')ctx.drawImage(images.acid,Math.floor(g.time*8)%4*16,0,16,16,s.x-8,s.y-8,16,16);
    else if(s.kind==='wave')ctx.drawImage(images.wave,Math.floor(g.time*8)%4*32,0,32,24,s.x-16,s.y-18,32,24);
    else{ctx.fillStyle='#b5ef48';ctx.fillRect(Math.round(s.x)-3,Math.round(s.y)-3,6,6);ctx.fillStyle='#fff08b';ctx.fillRect(Math.round(s.x)-1,Math.round(s.y)-1,2,2)}
  }
}
function drawItems(g){for(const it of g.items){if(!it.alive||it.x<g.camera-24||it.x>g.camera+view.width+24)continue;ctx.drawImage(images.items,it.type==="heal"?0:32,0,32,32,Math.round(it.x)-12,it.y-16,24,24)}}
function drawEffects(g){for(const f of g.effects){const margin=f.kind==="explosion"?Math.max(100,(f.r||24)*1.6*(f.visualScale||1)):100;if(Math.max(f.x,f.x2??f.x)<g.camera-margin||Math.min(f.x,f.x2??f.x)>g.camera+view.width+margin)continue;const x=f.x,a=f.life/f.max;
    if(f.kind==="explosion"){
      const scale=f.visualScale||1,fr=Math.min(7,Math.floor((1-a)*8)),sz=Math.max(30,(f.r||24)*2.6)*scale,radius=(f.r||24)*(.3+(1-a)*1.3)*scale;
      ctx.drawImage(images.explosion,fr*32,0,32,32,x-sz/2,f.y-sz/2,sz,sz);
      ctx.globalAlpha=a;ctx.strokeStyle=a>.65?"#fff7d5":"#ffab56";ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<=8;i++){const angle=i*Math.PI/4,px=Math.round(x+Math.cos(angle)*radius),py=Math.round(f.y+Math.sin(angle)*radius);if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.stroke();
      ctx.fillStyle="#fff1a8";if(a>.8)ctx.fillRect(x-8*scale,f.y-7*scale,16*scale,14*scale);
      for(let i=0;i<6;i++){const angle=i*Math.PI/3;ctx.fillRect(Math.round(x+Math.cos(angle)*radius*1.1),Math.round(f.y+Math.sin(angle)*radius*1.1),3,2)}ctx.globalAlpha=1;
    }else if(f.kind==='nestBreak'||f.kind==='bossBreak'){
      const boss=f.kind==='bossBreak',width=boss?128:64,height=boss?96:64;ctx.drawImage(boss?images.bossBreak:images.nestBreak,Math.min(7,Math.floor((1-a)*8))*width,0,width,height,x-width/2,f.y-height/2,width,height);
    }else if(f.kind==="weaponBurst"){
      const size=Math.max(32,(f.r||24)*2)*(f.visualScale||1);ctx.drawImage(images.weaponFx,(4+Math.min(3,Math.floor((1-a)*4)))*32,(f.assetIndex-8)*32,32,32,x-size/2,f.y-size/2,size,size);
    }else if(f.kind==="hit")drawHitEffect(f,g.enemyLimit>100?2:4);
    else if(f.kind==="lightning"){ctx.strokeStyle="#c8a8ff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke()}
    else{ctx.fillStyle=f.kind==="muzzle"?"#fff08b":"#fff";ctx.fillRect(x-4,f.y-3,8,6)}
  }
  for(const f of g.impact.particles){if(f.x<g.camera-8||f.x>g.camera+view.width+8)continue;ctx.globalAlpha=Math.min(1,f.life/.1);ctx.fillStyle=f.color;ctx.fillRect(Math.round(f.x),Math.round(f.y),f.size,f.flame?f.size+2:f.size)}ctx.globalAlpha=1;
}
function drawHitEffect(f,rays){
  const a=f.life/f.max,progress=1-a,angle=Math.atan2(f.vy,f.vx),burn=f.type==="flame";
  if(f.assetIndex>=8)ctx.drawImage(images.weaponFx,Math.min(3,Math.floor(progress*4))*32,(f.assetIndex-8)*32,32,32,f.x-16,f.y-16,32,32);
  ctx.globalAlpha=a;ctx.strokeStyle=f.color;ctx.fillStyle=a>.6?"#fff7d5":f.color;ctx.lineWidth=f.type==="laser"?2:1;
  for(let i=0;i<rays;i++){const direction=angle+(i-rays/2)*.8+(f.seed%3)*.2,reach=(f.type==="spread"?18:f.type==="laser"?16:10)*progress+3;
    const x=Math.round(f.x+Math.cos(direction)*reach),y=Math.round(f.y+Math.sin(direction)*reach-(burn?progress*10:0));
    if(burn)ctx.fillRect(x,y,2,4);else{ctx.beginPath();ctx.moveTo(Math.round(f.x),Math.round(f.y));if(f.type==="thunder")ctx.lineTo(x+3,y-4);ctx.lineTo(x,y);ctx.stroke()}
  }
  ctx.fillRect(Math.round(f.x)-2,Math.round(f.y)-2,4,4);ctx.globalAlpha=1;
}
function drawImpactHud(g){
  const a=g.impact;if(a.chainCount<3||a.clock>=a.labelUntil)return;
  const text=a.chainCount>=10?"MASS KILL":a.chainCount>=4?"MULTI BREAK":"TRIPLE HIT";
  ctx.save();ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.fillStyle="#020911df";ctx.fillRect(91,49,138,14);ctx.fillStyle="#ffe05c";ctx.fillText(`${text} ×${Math.min(999,a.chainCount)}`,160,59);ctx.restore();
}
function drawHud(g){const p=g.player;ctx.fillStyle="#03101ddd";ctx.fillRect(4,4,125,20);ctx.fillStyle="#3a1f2b";ctx.fillRect(8,9,92,7);ctx.fillStyle=p.hp<25?"#ff4f6d":"#37e8df";ctx.fillRect(8,9,92*p.hp/p.maxHp,7);ctx.fillStyle="#e4fff6";ctx.font="7px monospace";ctx.fillText(`HP ${Math.ceil(p.hp)}`,9,15);const w=weapon(activeEquipment()[p.weaponSlot]);ctx.fillStyle="#071522dd";ctx.fillRect(4,28,99,16);ctx.drawImage(images.weapons,WEAPONS.indexOf(w)*32,0,32,32,6,28,16,16);ctx.fillStyle="#ffe05c";ctx.fillText(`${w.id} ${w.name}`,25,38);ctx.fillStyle="#071522dd";ctx.fillRect(225,4,91,20);ctx.fillStyle="#e4fff6";ctx.fillText(`${g.lab?"LAB":"M01"} ${formatTime(g.time)}`,232,12);ctx.fillText(`SCORE ${String(g.score).padStart(6,"0")}`,232,20);ctx.fillStyle="#071522dd";ctx.fillRect(133,4,86,20);ctx.fillStyle="#7fa6a8";ctx.font="6px monospace";ctx.fillText(g.lab?"TEST ONLY":g.density,138,12);ctx.fillText(`HOSTILES ${g.liveEnemies}/${g.enemyLimit}`,138,20);ctx.font="7px monospace";const boss=g.enemies.find(e=>e.type==="boss"&&!e.dead);if(boss){ctx.fillStyle="#02060dcc";ctx.fillRect(42,158,236,15);ctx.fillStyle="#ff4f6d";ctx.fillRect(47,166,226*boss.hp/boss.maxHp,4);ctx.fillStyle="#ffe05c";ctx.fillText("B-01 MOTHER CRAWLER",94,164)}if(g.areaTimer>0){ctx.fillStyle="#020611dd";ctx.fillRect(55,67,210,28);ctx.fillStyle=g.bossStarted?"#ff4f6d":"#ffe05c";ctx.textAlign="center";ctx.font="bold 9px monospace";ctx.fillText(g.areaText,160,84);ctx.textAlign="left"}}

function loop(ts){
  const begin=DEBUG?performance.now():0,dt=Math.min(.1,(ts-last)/1000||0);last=ts;acc+=dt;
  while(acc>=1/60){update(1/60);acc-=1/60}
  if(profiler?.running&&game&&state==="play")fillBenchmarkPopulation();
  const updateEnd=DEBUG?performance.now():0;draw();const drawEnd=DEBUG?performance.now():0;
  if(game?.lab&&liveProfiler){const result=liveProfiler.record(ts,updateEnd-begin,drawEnd-updateEnd,!document.hidden&&state==="play"&&!game.player.dead);if(result&&game.lab.showFps)publishLabPerformance(result)}
  if(profiler?.running&&game){profiler.record(ts,performance.now()-begin,game.liveEnemies);if(profiler.result){const result={...profiler.result,destructionLevel:impactLevel(game).id};canvas.dataset.benchmark=JSON.stringify(result);document.querySelector("#qaResult").textContent=`LEVEL ${result.destructionLevel} / ${result.limit}: ${result.averageFps} FPS / p95 ${result.p95CpuMs}ms`;input.fire=false}}
  requestAnimationFrame(loop);
}

function fillBenchmarkPopulation(){
  while(game.liveEnemies<game.enemyLimit){const n=game.nextEnemyId,type=n%10<2?"needle":n%10===2?"spider":"crawler";spawnEnemy(type,game.player.x+130+(n%18)*18)}
}
function startBenchmark(mode){
  const limit=mode==="LAB200"?200:DENSITY_MODES[mode]?.limit;
  if(!DEBUG||!limit)return;const settings=game?.lab?{...game.lab.settings}:null;startLab(false);if(settings)game.lab.settings=settings;
  game.density=mode==="LAB200"?"MASSIVE":mode;game.enemyLimit=limit;game.player.x=3200;syncLabUI();
  fillBenchmarkPopulation();input.aimMode="touch";input.touchDx=1;input.touchDy=0;input.fire=true;profiler.start(game.enemyLimit);
  delete canvas.dataset.benchmark;document.querySelector("#qaResult").textContent=`MEASURING ${game.enemyLimit}...`;
}

loadAssets().catch(()=>{document.querySelector("#screenTitle h1").textContent="ASSET LOAD ERROR"});
renderWeaponGrid();document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;requestAnimationFrame(loop);

// Test/QA hooks intentionally read-only except the explicit debug commands.
window.__PDF_GAME__={version:VERSION,getState:()=>({state,time:game?.time||0,score:game?.score||0,playerHp:game?.player.hp??null,enemies:game?.enemies.length||0,boss:!!game?.bossStarted,unlocked:[...save.unlocked]}),start:startMission,spawnBoss:()=>{if(game&&!game.bossStarted){game.player.x=4200;startBoss()}},complete:()=>game&&completeMission()};

function startLab(openPanel=true,terrain='M01'){
  if(!DEBUG)return false;startMission(terrain,true);
  game.lab=createLabState(save.equipped,save.settings);game.density="MASSIVE";game.enemyLimit=200;game.director.stopped=true;game.items.length=0;
  game.lab.terrain=terrain;game.enemies.length=0;game.liveEnemies=game.liveMobs=0;if(terrain==='M02')game.platforms=createM02Geometry();
  configureLabPlayer();
  game.player.x=game.lab.anchorX;game.areaText="TEST LAB / NO SAVE";game.areaTimer=1.5;
  document.querySelector("#labSpawnResult").textContent="生成は開始位置へ復帰して行います。ボスは専用アリーナ。";
  document.querySelector("#labPerformance").textContent="FPS: 計測中…";delete document.querySelector("#labPerformance").dataset.metrics;
  updateBattleCamera(game.battleCamera,game.player,[],game,1);syncCameraView();show("play");
  if(openPanel)openLabPanel();return true;
}
function syncLabUI(){
  syncClassControls();
  document.querySelector("#labToggle").hidden=!game?.lab||state!=="play";
  document.querySelector("#labLevelBadge").hidden=!game?.lab||state!=="play";
  document.querySelector("#labPerformance").hidden=!game?.lab?.showFps||state!=="play";
  if(!game?.lab)return;const lab=game.lab;
  for(let slot=0;slot<2;slot++){const button=document.querySelector(`#labWeaponSlot${slot+1}`),w=weapon(lab.equipped[slot]);button.textContent=`SLOT ${slot+1}: ${w.id} ${w.name}`;button.setAttribute("aria-expanded",String(labWeaponPickerOpen&&labEditingSlot===slot))}
  const values={labSlot:String(game.player.weaponSlot),labPreset:lab.preset,labTerrain:lab.terrain,labEnemy:lab.enemy,labCount:String(lab.count),labPlacement:lab.placement,labCamera:lab.cameraMode,labZoom:String(lab.fixedZoom)};
  for(const [id,value] of Object.entries(values))document.querySelector(`#${id}`).value=value;
  document.querySelector("#labInvincible").checked=lab.invincible;document.querySelector("#labFps").checked=lab.showFps;
  document.querySelector("#labDestruction").value=String(normalizeDestructionLevel(lab.settings.destructionLevel));document.querySelector("#labShake").checked=lab.settings.shake;
  document.querySelector("#labLevelBadge").textContent=`LEVEL ${impactLevel(game).id} · ${impactLevel(game).name}`;
  document.querySelector("#labZoom").disabled=lab.cameraMode!=="FIXED";
  document.querySelector("#labCount").disabled=['beetle','boss','queen','nest'].includes(lab.enemy);
  document.querySelector("#labBlast").disabled=!["rocket","grenade"].includes(weapon(activeEquipment()[game.player.weaponSlot]).type);
  document.querySelector("#labZoomValue").textContent=`${view.zoom.toFixed(2)}× / FIXED ${lab.fixedZoom.toFixed(2)}×`;
}
const weaponSearchKey=text=>String(text).normalize("NFKC").toLowerCase().replace(/[\s-]/g,"");
function renderLabWeaponList(focusId=null){
  if(!game?.lab)return;
  const list=document.querySelector("#labWeaponList"),scrollTop=list.scrollTop,query=weaponSearchKey(labWeaponQuery);list.replaceChildren();let count=0,focused=null;
  for(let slot=0;slot<2;slot++){const button=document.querySelector(`#labPickerSlot${slot+1}`),w=weapon(game.lab.equipped[slot]);button.textContent=`SLOT ${slot+1}: ${w.id} ${w.name}`;button.setAttribute("aria-pressed",String(labEditingSlot===slot))}
  for(const w of WEAPONS){
    if(query&&!weaponSearchKey(`${w.id} ${w.name}`).includes(query))continue;count++;
    const selected=game.lab.equipped[labEditingSlot]===w.id,button=document.createElement("button");button.type="button";button.className="lab-weapon-option";button.dataset.weapon=w.id;button.setAttribute("aria-pressed",String(selected));
    button.innerHTML=`<strong>${w.id}</strong><span>${w.name}</span><small>${selected?"選択中":"選択"}</small>`;
    button.addEventListener("click",()=>selectLabWeapon(w.id));list.append(button);if(w.id===focusId)focused=button;
  }
  if(!count){const empty=document.createElement("p");empty.className="lab-weapon-empty";empty.textContent="一致する武器がありません";list.append(empty)}
  document.querySelector("#labWeaponCount").textContent=`SLOT ${labEditingSlot+1} を編集中 · ${count} / ${WEAPONS.length} 武器（未解放も選択可）`;
  list.scrollTop=scrollTop;focused?.focus({preventScroll:true});
}
function openLabWeaponPicker(slot=0){
  if(!game?.lab||state!=="lab")return;
  resetInput();labEditingSlot=slot===1?1:0;labWeaponQuery="";labWeaponPickerOpen=true;
  document.querySelector("#labWeaponSearch").value="";document.querySelector("#labWeaponList").scrollTop=0;
  document.querySelector("#labWeaponPicker").hidden=false;document.querySelector("#screenLab").inert=true;document.querySelector("#screenLab").setAttribute("aria-hidden","true");
  renderLabWeaponList();syncLabUI();document.querySelector(`#labPickerSlot${labEditingSlot+1}`).focus();
}
function closeLabWeaponPicker(restoreFocus=true){
  if(!labWeaponPickerOpen)return;
  labWeaponPickerOpen=false;document.querySelector("#labWeaponPicker").hidden=true;document.querySelector("#screenLab").inert=false;document.querySelector("#screenLab").removeAttribute("aria-hidden");
  if(game?.lab&&state==="lab"){syncLabUI();if(restoreFocus)document.querySelector(`#labWeaponSlot${labEditingSlot+1}`).focus()}
}
function selectLabWeapon(id){
  if(!labWeaponPickerOpen||!game?.lab||state!=="lab"||!weapon(id))return;
  changeLabSetting({id:`labWeapon${labEditingSlot+1}`,value:id});renderLabWeaponList(id);
}
function handleLabWeaponKey(e){
  if(e.key==="Escape"){e.preventDefault();closeLabWeaponPicker();return}
  if(e.key!=="Tab")return;
  const focusable=[...document.querySelectorAll("#labWeaponPicker button, #labWeaponPicker input")].filter(element=>!element.disabled),first=focusable[0],last=focusable.at(-1);
  if(!first)return;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}
document.querySelector("#labWeaponSearch").addEventListener("input",e=>{if(!labWeaponPickerOpen)return;labWeaponQuery=e.target.value;document.querySelector("#labWeaponList").scrollTop=0;renderLabWeaponList()});
document.querySelector("#labWeaponPickerClose").addEventListener("click",()=>closeLabWeaponPicker());
for(let slot=0;slot<2;slot++)document.querySelector(`#labPickerSlot${slot+1}`).addEventListener("click",()=>{labEditingSlot=slot;renderLabWeaponList()});
for(const event of ["click","pointerdown","pointermove","pointerup","pointercancel","wheel","touchstart","touchmove","touchend"])document.querySelector("#labWeaponPicker").addEventListener(event,e=>e.stopPropagation(),{passive:true});
function openLabPanel(){if(!game?.lab||state!=="play")return;resetInput();if(profiler)profiler.running=false;show("lab");document.querySelector('[data-action="lab-close"]').focus()}
function closeLabPanel(){if(!game?.lab||state!=="lab")return;resetInput();acc=0;liveProfiler.reset();document.querySelector("#labPerformance").textContent="FPS: 計測中…";show("play");canvas.focus()}
function changeLabSetting(target){
  const lab=game?.lab;if(!lab||state!=="lab")return;
  const value=target.value;
  if(target.id==='labTerrain'&&['M01','M02'].includes(value)){
    const previous={...lab,settings:{...lab.settings},equipped:[...lab.equipped]};startLab(true,value);Object.assign(game.lab,previous,{terrain:value});configureLabPlayer();syncLabUI();return;
  }
  if(target.id==="labWeapon1"||target.id==="labWeapon2"){if(weapon(value)){lab.equipped[target.id==="labWeapon1"?0:1]=value;game.player.shotCd=game.player.switchCd=0}}
  if(target.id==="labSlot"&&(value==="0"||value==="1")){game.player.weaponSlot=Number(value);game.player.shotCd=game.player.switchCd=0}
  if(target.id==="labInvincible"){lab.invincible=target.checked;game.player.invuln=0}
  if(target.id==="labFps"){lab.showFps=target.checked;liveProfiler.reset()}
  if(target.id==="labDestruction")lab.settings.destructionLevel=normalizeDestructionLevel(value);
  if(target.id==="labShake"){lab.settings.shake=target.checked;if(!target.checked){game.shake=0;game.impact.shakeUntil=0}}
  if(target.id==="labPreset"&&(Object.hasOwn(PLAYER_PRESETS,value)||Object.hasOwn(PLAYER_CLASSES,value))){const flying=lab.preset==="FLIGHT"||lab.preset==="WING";lab.preset=value;if(flying&&value!=="FLIGHT"&&value!=="WING")landLabPlayer(game.player,game.platforms);configureLabPlayer();resetInput()}
  if(target.id==="labEnemy"&&Object.values(LAB_ENEMIES).includes(value))lab.enemy=value;
  if(target.id==="labCount"&&LAB_COUNTS.includes(Number(value)))lab.count=Number(value);
  if(target.id==="labPlacement"&&["dense","spread"].includes(value))lab.placement=value;
  if(target.id==="labCamera"&&["AUTO","FIXED"].includes(value)){lab.cameraMode=value;if(value==="AUTO")game.battleCamera=createBattleCamera(game.player)}
  if(target.id==="labZoom"&&Number.isFinite(Number(value)))lab.fixedZoom=clamp(Number(value),.35,.85);
  if(lab.cameraMode==="FIXED")fixedLabCamera(game.battleCamera,game.player,lab.fixedZoom);
  syncCameraView();syncLabUI();
}
function clearLabEnemies(){
  if(!game?.lab)return;game.enemies.length=game.shots.length=game.enemyShots.length=game.effects.length=game.items.length=0;
  game.liveEnemies=game.liveMobs=0;game.bossStarted=game.midbossAlive=false;game.attacks=new AttackDirector();game.grid.rebuild(game.enemies);
  game.impact=createImpactState();game.shake=0;clearArsenal(game);syncRemoteControl();
}
function labTestShot(){
  if(!game?.lab||state!=="lab")return;
  if(!game.liveEnemies)spawnLabEnemies();const enemy=game.enemies.find(e=>!e.dead);if(!enemy)return;
  const p=game.player,dx=enemy.x-p.x,dy=enemy.y+enemy.h/2-p.y-13,len=Math.hypot(dx,dy)||1;
  closeLabPanel();input.aimMode="touch";input.touchDx=dx/len;input.touchDy=dy/len;p.shotCd=p.switchCd=0;shoot();
}
function configureLabPlayer(){
  const preset=game.lab.preset;applyPlayerClass(game.player,Object.hasOwn(PLAYER_CLASSES,preset)?preset:"RANGER");
  game.player.spriteClass=PLAYER_PRESETS[preset]?.id||game.player.classId;
}
function labBlast(){
  if(!game?.lab||state!=="lab")return;
  const w=weapon(activeEquipment()[game.player.weaponSlot]);if(!["rocket","grenade"].includes(w.type))return;
  let target=game.enemies.find(e=>!e.dead);if(!target){spawnLabEnemies();target=game.enemies.find(e=>!e.dead)}if(!target)return;
  game.grid.rebuild(game.enemies);closeLabPanel();explode({x:target.x,y:target.y+target.h/2,type:w.type,damage:w.damage,radius:w.radius});
}
function spawnLabEnemies(){
  if(!game?.lab)return;
  if(game.lab.enemy==='queen'&&game.lab.terrain!=='M02')changeLabSetting({id:'labTerrain',value:'M02'});
  const lab=game.lab;clearLabEnemies();
  for(const timer of missionTimers)clearTimeout(timer);missionTimers.clear();deferredMissionCallbacks.length=0;
  if(profiler)profiler.running=false;game.density="MASSIVE";game.enemyLimit=Math.max(100,lab.count);
  configureLabPlayer();game.player.x=lab.enemy==='queen'?M02.bossX:lab.enemy==="boss"?4100:lab.anchorX;game.player.y=lab.anchorY;game.player.dead=false;game.player.invuln=0;game.player.onGround=true;
  game.nextEnemyId=1;game.time=game.kills=game.score=game.crates=0;game.player.shotCd=game.player.switchCd=0;resetInput();
  const leader=['boss','beetle','queen','nest'].includes(lab.enemy),count=leader?1:lab.count;
  for(let i=0;i<count;i++){const pos=lab.enemy==='queen'?{x:M02.bossSpawnX,y:52}:lab.enemy==="boss"?{x:4420,y:WORLD.ground-58}:labSpawnPosition(game.director,lab.enemy,i,count,lab.placement,game);if(pos)spawnEnemy(lab.enemy,pos.x,pos.y)}
  game.bossStarted=lab.enemy==="boss"||lab.enemy==='queen';game.battleCamera=createBattleCamera(game.player);
  if(lab.cameraMode==="FIXED")fixedLabCamera(game.battleCamera,game.player,lab.fixedZoom);else updateBattleCamera(game.battleCamera,game.player,game.enemies,game,1);
  syncCameraView();syncLabUI();document.querySelector("#labSpawnResult").textContent=`${game.liveEnemies}体を再配置（プレイヤーも開始位置へ復帰）`;
}
function publishLabPerformance(result){
  if(result.interrupted){const output=document.querySelector("#labPerformance");output.textContent=`FPS: 中断区間を除外 (${result.gapMs.toFixed(0)}ms)\n中断除外=${result.excluded} 有効サンプル=${result.samples}\n計測再開待ち / 全体FPSではありません`;output.dataset.metrics=JSON.stringify(result);return}
  const g=game;const data={...result,enemies:g.liveEnemies,shots:g.shots.length+g.enemyShots.length,effects:g.effects.length+g.impact.particles.length,corpses:g.impact.corpses,zoom:view.zoom,destructionLevel:impactLevel(g).id};
  document.querySelector("#labPerformance").textContent=`FPS ${data.fps.toFixed(1)} | FRAME ${data.frameMs.toFixed(1)}ms MAX ${data.maxFrameMs.toFixed(1)}ms\nCPU UPDATE ${data.updateMs.toFixed(2)}ms / DRAW ${data.drawMs.toFixed(2)}ms\nENEMY ${data.enemies} SHOT ${data.shots} FX ${data.effects} BODY ${data.corpses} ZOOM ${data.zoom.toFixed(2)}×\nN=${data.samples} 中断除外=${data.excluded}`;
  document.querySelector("#labPerformance").dataset.metrics=JSON.stringify(data);
}
if(DEBUG){
  document.querySelector("#testLabButton").hidden=false;
  document.querySelectorAll("[data-benchmark]").forEach(button=>button.addEventListener("click",()=>{if(game?.lab)startBenchmark(button.dataset.benchmark)}));
}
