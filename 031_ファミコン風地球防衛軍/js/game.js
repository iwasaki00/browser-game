import {VERSION,SAVE_KEY,WORLD,VIEW,BATTLE_CAMERA,DENSITY_MODES,INVASION,MISSIONS,WEAPONS,WEAPON_BY_ID,WEAPON_CATEGORIES,ENEMY_TYPES,MISSION_AREAS,DEFAULT_SAVE,DESTRUCTION_LEVELS,PLAYER_CLASSES,normalizeClass,normalizeDestructionLevel,clamp,distance,sanitizeSave,pickReward,missionStatus,canPlayMission,recordMissionClear} from "./data.js?v=0.3.3";
import {WEAPON_LIMITS,createArsenal,clearArsenal,mineCount,fireExpanded,detonateMines,updateExpanded,drawExpanded,terrainContact,segmentEntry} from "./weapons.js?v=0.2.3-C";
import {ArtPreview,artStyleLabel,drawStudyIcon,drawStudyProjectile,drawStudyPlayer,drawStudyEnemy,drawStudyTile,drawUnifiedTile,studyTileVariant,studyEffectWeapon,drawStudyEffect,drawStudyLightning,drawUnifiedSpecial,drawUnifiedEnvironmentalEffect,drawUnifiedTrail} from "./art-preview.js?v=0.2.3-C";
import {applyPlayerClass,moveClassPlayer,movePlayerBody,classPlayerFrame} from "./player.js?v=0.2.2";
import {worldToScreen,clientToScreen,viewBounds,aimTarget,createBattleCamera,updateBattleCamera} from "./camera.js?v=0.3.3";
import {SpawnDirector,SpatialGrid,AttackDirector,prepareSeparation,nearestEnemy,isMob,variation} from "./invasion.js?v=0.3.3";
import {FrameProfiler,LiveProfiler,RunProfiler} from "./profiler.js?v=0.3.3";
import {LAB_CHECKPOINTS,VALIDATION_MODES,findCheckpoint,validationClass,MissionLabRun} from "./mission-lab.js?v=0.3.3";
import {PLAYER_PRESETS,LAB_ENEMIES,LAB_COUNTS,createLabState,landLabPlayer,moveFlightPlayer,fixedLabCamera,labSpawnPosition} from "./playground.js?v=0.3.3";
import {IMPACT,REACTIONS,reducedImpact,impactLevel,createImpactState,pushImpactEffect,hitVisual,feedbackCategory,drawFeedbackAccent,beginDeath,updateDeath,updateParticles,advanceImpact,impactShake} from "./impact.js?v=0.3.3";
import {M02,NEST,ABYSS,isBoss,createM02Geometry,ceilingAt,floorAt,validEnemyPosition,updateNests,moveTunnelEnemy,weakCore,queenDamage,updateQueen} from "./mission02.js?v=0.3.3";
import {M03,COAST,createM03Geometry,createCoastalState,coastalFloor,recoverCoastalPlayer,advanceCoastalFormations,updateCoastalEnemy,updateCoastalDevices,coastalWeakCore,coastalDamage,resetCoastalBossPhase} from './mission03.js?v=0.3.3';
import {COAST_FILES,loadCoastalArt,drawCoastalEnemy,drawCoastTile,drawCoastalWorld,drawCoastalFX,drawCoastalWarnings} from './coastal-art.js?v=0.3.3';

import {CombatAudio,AUDIO_LIMITS} from './combat-audio.js?v=0.3.3';
import {outcomeData,combatHudText,drawCombatHud,drawBossHud,drawCoreMarker} from './gameplay-ui.js?v=0.3.3';
import {MobilePlaytest,MOBILE_QA_ITEMS,createMobileQA,setMobileQA,mobileReportText,mobileChecklistText} from './mobile-playtest.js?v=0.3.3';

const audioBus=new CombatAudio(()=>{const AC=window.AudioContext||window.webkitAudioContext;return AC?new AC():null});
const touchPointers=new Map(),pressedControls=new Set();let aimPointer=null,remotePointer=null,viewportOrientation=null;
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
// UI-only state: never stored in game/save, and never advances the simulation.
const LAB_TABS=['stage','loadout','enemies','visual','metrics'];
let labTab='stage',labTabScroll={},labTerrainChoice=null,labMessage='設定を選んでください。';
const LAB_UI_PRESETS={
  art:'カメラFIXED 0.50・揺れOFF → 見た目。アート・解像度・HP・戦闘は維持。',
  boss:'開始候補をAREA05に変更 → ステージ。ボス開始ボタンを押すまで再開始しません。',
  mass:'生成候補をE-01・200体・密集に変更 → 敵・ボス。生成するまで現在の敵は維持。',
  normal:'QA区分D・無敵OFF → ステージ。兵科と武器は維持。開始時に正式兵科・解放済み装備を検証。',
  gameplay:'通常攻略QA：正式兵科・無敵OFF・A-01/S-02・STANDARD密度 → ステージ。HPは通常値へ補充。開始候補のみで再開始せず、通常保存も行いません。'
};
const labRunHistory=[],labBenchmarkHistory=[];
const weaponAPI={damage:damageEnemy,blast:explode,effect:pushEffect};
const missionTimers=new Set();
const deferredMissionCallbacks=[];
const DEBUG=new URLSearchParams(location.search).get("debug")==="1";
const mobilePlaytest=DEBUG?new MobilePlaytest():null,mobileQA=DEBUG?createMobileQA():null;
let mobileSelectedId=null,mobileEnvironment='',mobileMemo='',mobilePublishAt=0;
const artPreview=DEBUG?new ArtPreview():null;
// Release art and LAB comparison own independent selection / loading tokens.
// Both use the same validated, per-resource fallback loader and render adapters.
const releaseArt=new ArtPreview();
let coastalArt=null;
loadCoastalArt().then(pack=>coastalArt=pack);
let previewRenderScale=1,artComparison=false;
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
  if(viewportOrientation!==null&&viewportOrientation!==view.mode){resetInput();mobilePlaytest?.interrupt("画面の向きが変わりました");syncMobileUI()}viewportOrientation=view.mode;
  const touchDevice=matchMedia("(any-pointer: coarse)").matches||navigator.maxTouchPoints>0;
  document.documentElement.dataset.touchDevice=String(touchDevice);
  document.documentElement.dataset.layout=view.mode;
  gameShell.dataset.layout=view.mode;
  syncCameraView();
}
updateViewport();
window.addEventListener("resize",updateViewport,{passive:true});
window.addEventListener("orientationchange",()=>{resetInput();mobilePlaytest?.interrupt("画面回転");syncMobileUI();requestAnimationFrame(updateViewport)},{passive:true});
window.visualViewport?.addEventListener("resize",updateViewport,{passive:true});
window.visualViewport?.addEventListener("scroll",updateViewport,{passive:true});

function loadSave(){try{return sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY)))}catch{return sanitizeSave(DEFAULT_SAVE)}}
function storeSave(){if(game?.lab)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}}
// Keep the original storage key so v1 records migrate in place.
storeSave();
function loadAssets(){return Promise.all(Object.entries(imageFiles).map(([key,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=reject;im.src=src}))).then(()=>assetsReady=true)}
function show(name){if(name!=='play')mobilePlaytest?.interrupt(`画面切替：${name}（継ぎ足しせず終了）`);if(name==="result"||name==="gameover")document.querySelector(`#screen${name==="result"?"Result":"Gameover"}`).classList.toggle("skip-intro",false);if(name!=='pause')artComparison=false;document.querySelector('#screenPause').classList.toggle('is-art-comparison',artComparison);if(name!=="lab")closeLabWeaponPicker(false);if(name==="mission")renderMissionList();screens.forEach(s=>s.classList.toggle("is-active",s.id===`screen${name[0].toUpperCase()+name.slice(1)}`));state=name;gameShell.classList.toggle("is-playing",name==="play"||name==="lab"||artComparison);touchControls.style.visibility=name==="play"?"visible":"hidden";canvas.dataset.gameState=name;canvas.setAttribute("aria-label",name==="play"?game?.lab?"TEST LABを進行中":`ゲーム画面。${game.missionId} ${MISSIONS.find(m=>m.id===game.missionId)?.name??''}を進行中`:`${name}画面`);syncLabUI()}
function scheduleMission(callback,delay){const current=game;const timer=setTimeout(()=>{missionTimers.delete(timer);if(game!==current)return;if(state==="confirm")deferredMissionCallbacks.push({current,callback});else callback()},delay);missionTimers.add(timer)}
function missionScreen(name){if(state==="confirm")returnState=name;else show(name)}
function discardMission(){mobilePlaytest?.interrupt('LAB終了・ミッション破棄');archiveLabRun();for(const timer of missionTimers)clearTimeout(timer);missionTimers.clear();deferredMissionCallbacks.length=0;if(profiler)profiler.running=false;liveProfiler?.reset();game=null;acc=0;resetInput();syncCameraView();gameShell.dataset.flight="false";document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;delete canvas.dataset.playerX;delete canvas.dataset.playerHp;delete canvas.dataset.enemies;delete canvas.dataset.boss;delete canvas.dataset.density;delete canvas.dataset.enemyLimit;delete canvas.dataset.checkpoint;delete canvas.dataset.validationMode}
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
  if(game)document.querySelector('#combatStatus').textContent=combatHudText(game,activeEquipment());
  gameShell.dataset.playerClass=id;
  gameShell.dataset.flight=String(game?.lab?.preset==="FLIGHT");
  gameShell.dataset.wing=String(!!game&&formalClass()&&id==="WING");
  gameShell.dataset.scout=String(!!game&&formalClass()&&id==="SCOUT");
}
function renderClassGrid(){
  const grid=document.querySelector("#classGrid");grid.replaceChildren();
  for(const c of Object.values(PLAYER_CLASSES)){
    const button=document.createElement("button");button.className=`class-card ${save.selectedClass===c.id?"selected":""}`;button.dataset.action="select-class";button.dataset.playerClass=c.id;button.setAttribute("aria-pressed",String(save.selectedClass===c.id));
    const portrait=activeStudy()?._u?.[c.id.toLowerCase()]?activeStudy()[c.id.toLowerCase()]:null;
    button.innerHTML=`${portrait?'':`<span class="class-pic" style="--class-row:${c.row};background-position:0 ${-64*c.row}px" aria-hidden="true"></span>`}<span><strong>${c.id}</strong><small>HP ${c.hp} / ${c.speed}px/s</small><small>${c.ability}</small></span>`;
    if(portrait){const pic=document.createElement('canvas');pic.className='class-pic';pic.width=48;pic.height=64;pic.style.background='none';pic.style.order=-1;pic.setAttribute('aria-hidden','true');const c=pic.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(portrait,0,0,48,64,0,0,48,64);button.append(pic)}grid.append(button);
  }
}
function syncSettings(){document.querySelector("#destructionSelect").value=String(save.settings.destructionLevel);document.querySelector("#shakeToggle").checked=save.settings.shake}
function openSettings(){
  if(game?.lab){show("play");openLabPanel();return}
  settingsReturn=state;resetInput();syncSettings();show("settings");document.querySelector('[data-action="settings-close"]').focus();
}
function closeSettings(){if(state!=="settings")return;resetInput();acc=0;show(settingsReturn);if(state==="play")canvas.focus()}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*100)%100;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(2,"0")}`}

function initAudio(){if(activeSettings().sound){audioBus.unlock();audio=audioBus.context}}
function tone(freq=.05,duration=.04,type="square",volume=.025,event='generic'){const settings=activeSettings(),level=Number.isFinite(settings.volume)?clamp(settings.volume,0,1):.65;if(!settings.sound||level===0||profiler?.running)return;audioBus.play(freq,duration,type,volume*level,event)}
function feedbackSound(category){const sound=category==='WEAK POINT'?[780,.06,'sine',.016,'weak']:category==='ARMOR HIT'?[180,.045,'triangle',.012,'armor']:[320,.035,'square',.008,'hit'];tone(...sound)}

function renderWeaponGrid(){
  renderClassGrid();
  const densitySelect=document.querySelector("#densitySelect");if(densitySelect)densitySelect.value=save.settings.enemyDensity;
  weaponGrid.replaceChildren();
  document.querySelector("#weaponFilter").value=weaponFilter;
  for(let slot=0;slot<2;slot++){const button=document.querySelector(`#equipSlot${slot+1}`);button.textContent=`${slot+1}: ${selected[slot]||"未装備"}`;button.setAttribute("aria-pressed",String(activeEquipSlot===slot))}
  for(const w of WEAPONS){if(weaponFilter!=="ALL"&&w.category!==weaponFilter)continue;
    const unlocked=save.unlocked.includes(w.id),b=document.createElement("button");b.className=`weapon-card ${selected.includes(w.id)?"selected":""} ${unlocked?"":"locked"}`;b.disabled=!unlocked;b.dataset.weapon=w.id;
    const icon=document.createElement('canvas');icon.width=icon.height=32;const iconCtx=icon.getContext('2d');iconCtx.imageSmoothingEnabled=false;const unifiedIcon=drawStudyIcon(iconCtx,activeStudy(),w.id,0,0,32,32);
    b.innerHTML=`${unifiedIcon?'':`<span class="weapon-pic" style="background-position:${w.assetIndex*-32}px 0"></span>`}<span><strong>${w.id} ${w.name}</strong><small>DMG ${w.damage} / ${w.interval}s · ${WEAPON_CATEGORIES[w.category]}</small><small>${w.detail}</small><small>${unlocked?selected.includes(w.id)?`SLOT ${selected.indexOf(w.id)+1}`:"OPEN":"LOCKED"}</small></span>`;
    if(unifiedIcon){icon.className='weapon-pic';icon.style.background='none';icon.style.order=-1;icon.setAttribute('aria-hidden','true');b.append(icon)}
    b.addEventListener("click",()=>{if(!save.unlocked.includes(w.id))return;const other=selected.indexOf(w.id);if(other>=0)activeEquipSlot=other;else selected[activeEquipSlot]=w.id;renderWeaponGrid()});weaponGrid.append(b);
  }
  equipMessage.textContent=`${save.unlocked.length}/${WEAPONS.length} 解放 · 枠を選んで武器を指定`;
}

const input={left:false,right:false,jump:false,up:false,down:false,hover:false,special:false,fire:false,switch:false,aimX:260,aimY:90,aimMode:"mouse",touchDx:1,touchDy:0};
function setPressed(el,on){el.classList.toggle('is-pressed',on);el.setAttribute('aria-pressed',String(on));if(on)pressedControls.add(el);else pressedControls.delete(el)}
function releaseTouch(e,cancel=false){
  const owned=touchPointers.get(e.pointerId);if(!owned)return;touchPointers.delete(e.pointerId);
  input[owned.key]=[...touchPointers.values()].some(p=>p.key===owned.key);
  if(![...touchPointers.values()].some(p=>p.element===owned.element))setPressed(owned.element,false);
}
function resetInput(){for(const el of pressedControls){el.classList.toggle('is-pressed',false);el.setAttribute('aria-pressed','false')}pressedControls.clear();touchPointers.clear();aimPointer=remotePointer=null;input.left=input.right=input.jump=input.up=input.down=input.hover=input.special=input.fire=input.switch=false;if(remoteTimer!==null)clearTimeout(remoteTimer);remoteTimer=null;remoteHeld=false}
window.addEventListener("keydown",e=>{
  if(state==="play"||state==="title")initAudio();
  if(state==="result"||state==="gameover"){document.querySelector(`#screen${state==="result"?"Result":"Gameover"}`).classList.toggle("skip-intro",true);return}
  if(labWeaponPickerOpen){handleLabWeaponKey(e);return}
  if(artComparison&&state==='pause'){if(e.key==='Escape'||e.key==='F2'){e.preventDefault();show('play');openLabPanel()}return}
  if(state==="settings"){if(e.key==="Escape")closeSettings();return}
  if(game?.lab&&state==="lab"){handleLabKey(e);return}
  if(game?.lab&&(e.key==="F2")){e.preventDefault();if(state==="play"||state==="gameover")openLabPanel();return}
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
window.addEventListener("blur",()=>{resetInput();if(state==="play")pause('ウィンドウのフォーカス喪失');else liveProfiler?.pause('ウィンドウのフォーカス喪失')});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="play")pause('タブ非表示')});

document.querySelectorAll("#touchControls [data-touch]").forEach(b=>{const key=b.dataset.touch;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='play'||!game||game.player.dead)return;initAudio();
    if(key==='switch'){if(remotePointer!==null)return;remotePointer=e.pointerId;setPressed(b,true);b.setPointerCapture(e.pointerId);
      if(!mineCount(game)){switchWeapon();return}
      remoteHeld=false;const current=game;remoteTimer=setTimeout(()=>{remoteTimer=null;if(game===current&&state==='play'&&remotePointer!==null){remoteHeld=true;detonateMines(game,weaponAPI);syncRemoteControl()}},WEAPON_LIMITS.remoteHoldMs);return;
    }
    touchPointers.set(e.pointerId,{key,element:b});setPressed(b,true);b.setPointerCapture(e.pointerId);input[key]=true;
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>{e.preventDefault();
    if(key!=='switch'){releaseTouch(e);return}if(remotePointer!==e.pointerId)return;
    if(remoteTimer!==null){clearTimeout(remoteTimer);remoteTimer=null;if(ev==='pointerup'&&!remoteHeld)switchWeapon()}remotePointer=null;remoteHeld=false;setPressed(b,false);
  });
});
function syncRemoteControl(){const count=mineCount(game);if(game?.arsenal.lastMineCount===count)return;if(game)game.arsenal.lastMineCount=count;gameShell.dataset.mines=String(count);document.querySelector(".switch-button small").textContent=count?`HOLD ${count}`:"WEAPON";document.querySelector(".switch-button").setAttribute("aria-label",count?`武器切替。長押しでマイン${count}個を起爆`:"武器切替")}
const aimPad=document.querySelector("#aimPad");function touchAim(e){if(state!=="play"||!game)return;const r=aimPad.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y);input.aimMode="touch";if(len>8){input.touchDx=x/len;input.touchDy=y/len}else{input.touchDx=game.player.face;input.touchDy=0}input.fire=true}
aimPad.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='play'||!game||game.player.dead||aimPointer!==null)return;aimPointer=e.pointerId;setPressed(aimPad,true);aimPad.setPointerCapture(e.pointerId);touchAim(e);initAudio()});
aimPad.addEventListener('pointermove',e=>{if(e.pointerId===aimPointer)touchAim(e)});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])aimPad.addEventListener(ev,e=>{if(e.pointerId!==aimPointer)return;aimPointer=null;input.fire=false;setPressed(aimPad,false)});

document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;initAudio();tone(620,.05);const action=a.dataset.action;
  if(action==='mobile-start'||action==='mobile-restart'){startMobileMeasurement();return}
  if(action==='mobile-copy'||action==='mobile-json'||action==='mobile-qa-copy'){copyMobileResult(action);return}
  if(labWeaponPickerOpen)return;
  if(action==='lab-tab'){switchLabTab(a.dataset.labTab);return}
  if(action==='lab-boss-tab'){switchLabTab('stage',true);return}
  if(action==='lab-preset-apply'){applyLabUIPreset();return}
  if(action==='lab-terrain-apply'){if(applyLabTerrain(true))setLabMessage('検証地形を適用。位置・敵・弾・FX・時間等を初期化しました。');return}
  if(action==="lab-weapons"){openLabWeaponPicker(Number(a.dataset.slot));return}
  if(action==="title"||action==="quit"||action==="back-title"){requestTitle();return}
  if(action==="confirm-title"){discardMission();show("title");document.querySelector('[data-action="start"]').focus();return}
  if(action==="cancel-title"){cancelTitle();return}
  if(action==="settings"){openSettings();return}
  if(action==="settings-close"){closeSettings();return}
  if(action==="test-lab"){if(DEBUG)startLab();return}
  if(action==="lab-open"){openLabPanel();return}
  if(action==="lab-close"){closeLabPanel();return}
  if(action==="lab-spawn"){if(game?.lab){applyLabTerrain();spawnLabEnemies();setLabMessage(`${game.liveEnemies}体を再配置。位置・HP・時間・弾・FX・設置を初期化。`)}return}
  if(action==="lab-blast"){labBlast();return}
  if(action==="lab-test"){labTestShot();return}
  if(action==="lab-clear"){if(game?.lab){clearLabEnemies();syncLabUI();setLabMessage('敵・弾・FX・設置・アイテム・攻略計測を消去。位置・地形は維持。')}return}
  if(action==='lab-stage-start'){runLabStart();return}
  if(action==='lab-boss-1'){runLabStart('M01');return}
  if(action==='lab-boss-2'){runLabStart('M02');return}
  if(action==='lab-boss-3'){runLabStart('M03');return}
  if(action==='lab-coast-turrets'){if(game?.coast){game.coast.turretsEnabled=!game.coast.turretsEnabled;setLabMessage(`対空砲台 ${game.coast.turretsEnabled?'ON':'OFF'}（LABのみ）`)}else if(game?.lab)setLabMessage('M03の指定開始または検証地形を適用してから操作してください。');return}
  if(action==='lab-coast-invasion'){if(game?.lab){changeLabSetting({id:'labTerrain',value:'M03'});game.lab.enemy='shorecrab';game.lab.count=30;spawnLabEnemies();for(const e of game.enemies)e.landingLeft=COAST.landingTime;setLabMessage('海上侵攻30体を再配置。閉じてプレイで上陸を確認。')}return}
  if(action==='lab-copy'){copyLabReport();return}
  if(action==='art-compare'){beginArtComparison();return}
  if(action==='art-lab'){if(game?.lab){show('play');openLabPanel()}return}
  if(action==="lab-reset"){if(game?.lab?.run)startLabCheckpoint(null,game.lab.run.checkpoint.id);else if(game?.lab)startLab(true,game.lab.terrain);return}
  if(action==="lab-exit"){if(game?.lab){discardMission();show("title")}return}
  if(action==="start"||action==="continue")show("mission");
  if(action==="howto")show("howto");if(action==="close-howto"){resetInput();show("title")}
  if(action==="select-mission"){if(!canPlayMission(a.dataset.mission,save))return;selectedMissionId=a.dataset.mission;selected=[...save.equipped];renderWeaponGrid();show("equip")}
  if(action==="select-class"&&state==="equip"&&!game?.lab&&Object.hasOwn(PLAYER_CLASSES,a.dataset.playerClass)){save.selectedClass=a.dataset.playerClass;storeSave();renderClassGrid()}
  if(action==="equip-slot"&&state==="equip"){activeEquipSlot=Number(a.dataset.slot)===1?1:0;renderWeaponGrid()}
  if(action==="mission-select"){discardMission();show("mission")}
  if(action==="back-mission")show("mission");
  if(action==="deploy"){if(selected.length!==2||selected.some(id=>!save.unlocked.includes(id))){equipMessage.textContent="解放済みの武器を2つ選んでください";return}save.equipped=[...selected];storeSave();startMission()}
  if(action==="resume")resume();if(action==="retry"){if(game?.lab?.run)startLabCheckpoint(null,game.lab.run.checkpoint.id);else if(game?.lab)startLab(true,game.lab.terrain);else startMission()}
});
document.querySelector("#soundToggle").addEventListener("click",e=>{const settings=activeSettings();settings.sound=!settings.sound;e.currentTarget.textContent=`SOUND: ${settings.sound?"ON":"OFF"}`;storeSave();if(settings.sound){initAudio();tone(700,.06)}else audioBus.stop()});
document.addEventListener("change",e=>{
  if(handleMobileField(e.target))return;
  if(game?.lab&&state==='lab'&&e.target.id==='labTerrain'){
    if(['M01','M02','M03'].includes(e.target.value)){labTerrainChoice=e.target.value;setLabMessage('地形は保留中。「生成」または「地形だけ適用」で初期化します。');syncLabWorkbench()}return;
  }
  if(game?.lab&&state==='lab'&&e.target.id==='labUIPreset'){syncLabWorkbench();return}
  if(['labArtStyle','pauseArtStyle'].includes(e.target.id)){setArtStyle(e.target.value);return}
  if(['labRenderScale','pauseRenderScale'].includes(e.target.id)){setPreviewResolution(e.target.value);return}
  if(game?.lab){changeLabSetting(e.target);if(state==='lab')setLabMessage(['labBossPhase','labStageMission','labStageArea','labStageRoute','labStageDensity','labEnemy','labCount','labPlacement'].includes(e.target.id)?'候補を更新しました。開始／生成ボタンを押すまで現在の戦闘は維持。':e.target.id==='labValidation'?'QA候補を更新。B/Dは無敵OFF・CはONに即時連動。':'LAB設定を即時反映しました。');return}
  if(e.target.id==="weaponFilter"&&(e.target.value==="ALL"||Object.hasOwn(WEAPON_CATEGORIES,e.target.value))){weaponFilter=e.target.value;renderWeaponGrid();return}
  if(e.target.id==="destructionSelect"&&state==="settings"){save.settings.destructionLevel=normalizeDestructionLevel(e.target.value);storeSave();syncSettings();return}
  if(e.target.id==="shakeToggle"&&state==="settings"){save.settings.shake=e.target.checked;if(game&&!e.target.checked){game.shake=0;game.impact.shakeUntil=0}storeSave();return}
  if(e.target.id!=="densitySelect"||!Object.hasOwn(DENSITY_MODES,e.target.value))return;save.settings.enemyDensity=e.target.value;storeSave();
});

function startMission(id=selectedMissionId,labOnly=false){
  if(!canPlayMission(id,save)&&!(labOnly&&DEBUG&&['M02','M03'].includes(id)))return false;mobilePlaytest?.interrupt('ミッション初期化');
  discardMission();view.renderOffset=0;selectedMissionId=id;
  game={missionId:id,time:0,score:0,kills:0,crates:0,weaponRewards:[],camera:0,shake:0,area:-1,areaText:"",areaTimer:0,nextEnemyId:1,bossStarted:false,midbossAlive:false,clear:false,
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
  if(id==='M03'){game.world=M03.world;game.player.world=game.world;game.areas=M03.areas;game.platforms=createM03Geometry();game.coast=createCoastalState();game.grid=new SpatialGrid(INVASION.gridSize,game.world);game.director=new SpawnDirector(game.density,M03.encounters);game.items=[{x:2220,y:123,type:'crate',alive:true},{x:4950,y:123,type:'crate',alive:true},{x:3600,y:123,type:'heal',alive:true}]}
  game.battleCamera=createBattleCamera(game.player);syncCameraView();
  show("play");touchControls.style.visibility="visible";canvas.focus();announceArea(0);
  canvas.setAttribute('aria-label',`ゲーム画面。${id} ${MISSIONS.find(m=>m.id===id).name}を進行中`);
}
function pause(reason){if(state!=="play")return;pauseLabMeasurement(reason);show("pause");resetInput()}
function resume(){if(!game)return;show("play");canvas.focus()}
function switchWeapon(){if(state!=="play"||!game||game.player.switchCd>0)return;game.player.weaponSlot=1-game.player.weaponSlot;game.player.switchCd=.25;game.player.shotCd=.25;tone(440,.05)}
function announceArea(i){game.area=i;game.lab?.run?.arrive(i,game);game.areaText=`AREA ${i+1}  ${(game.areas??MISSION_AREAS)[i].name}`;game.areaTimer=2.2;tone(520,.1)}

function initializeUndergroundObjects(){
  for(const n of M02.nests)spawnEnemy('nest',n.x,n.y);
  for(const b of M02.barriers){const platform={...b,x:b.x-b.w/2,solid:true,active:true,kind:'barrier'};game.platforms.push(platform);const e=spawnEnemy('barrier',b.x,b.y);if(e)e.platform=platform}
}

function spawnEnemy(type,x,y=null){
  if(game.liveEnemies>=game.enemyLimit)return null;
  if(game.bossStarted&&!['boss','queen','leviathan'].includes(type)&&game.liveMobs>=INVASION.bossMinions[game.density])return null;
  if(game.missionId==='M02'){const pos=validEnemyPosition(game,type,x,y);x=pos.x;y=pos.y}
  const t=ENEMY_TYPES[type],uid=game.nextEnemyId++,v=variation(uid),baseY=y??(type==='skyray'?40:type==="needle"?45+v*40:type==="spider"||type==='spitter'?34:WORLD.ground-t.h);
  if(game.missionId==='M02'&&['worm','crawler'].includes(type))for(const pl of game.platforms)if(pl.active!==false&&x+t.w/2>pl.x&&x-t.w/2<pl.x+pl.w&&baseY+t.h>pl.y&&baseY<pl.y+(pl.h??8))x=clamp(pl.x+pl.w+t.w/2+1,24,game.world.width-24);
  const e={uid,type,x,y:baseY,baseY,w:t.w,h:t.h,hp:t.hp,maxHp:t.hp,dead:false,death:0,phase:"move",timer:v,anim:v*8,attackFlash:0,face:-1,
    speedScale:isMob({type})?1+(v*2-1)*INVASION.speedVariation:1,shotCd:.7+v*1.6,vx:0,vy:0,separateX:0,separateY:0,thinkTime:0,diveCd:v*INVASION.diveCooldown,diveTimer:0,diveOffset:0,active:true};
  if(type==='shorecrab'&&game.coast){e.landingLeft=COAST.landingTime;pushEffect({kind:'coastSplash',x:e.x,y:148,life:.4,max:.4})}
  game.enemies.push(e);game.liveEnemies++;if(isMob(e))game.liveMobs++;if(type==="beetle")game.midbossAlive=true;return e;
}
function startBoss(){game.bossStarted=true;game.midbossAlive=false;game.director.stopped=true;game.enemies.length=0;game.impact=createImpactState();game.liveEnemies=game.liveMobs=0;game.enemyShots.length=0;
  if(game.missionId==='M03'){game.coast.hazards.length=game.coast.aaShots.length=0;spawnEnemy('leviathan',M03.bossSpawnX,48);game.areaText='WARNING  B-03 LEVIATHAN'}else if(game.missionId==='M02'){spawnEnemy('queen',M02.bossSpawnX,WORLD.ground-96);game.areaText='WARNING  B-02 ABYSS QUEEN'}else{spawnEnemy("boss",4420,WORLD.ground-58);game.areaText="WARNING  B-01 マザークロウラー"}game.areaTimer=3;tone(90,.6,"sawtooth",.04)}
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

function update(dt){if(state!=="play"||!game)return;const g=game,p=g.player,missionRun=g.lab?.run,progression=!g.lab||!!missionRun,combat=missionRun?.mode!=='A';
  if(advanceImpact(g,dt)){let write=0;for(const e of g.enemies){if(e.dead)updateDeath(g,e,dt);if(!e.dead||e.death>0)g.enemies[write++]=e}g.enemies.length=write;updateEffects(dt);return}
  g.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.switchCd=Math.max(0,p.switchCd-dt);p.shootPose=Math.max(0,p.shootPose-dt);g.areaTimer=Math.max(0,g.areaTimer-dt);g.shake=Math.max(0,g.shake-dt*16);
  if(!formalClass())p.hitPose=Math.max(0,p.hitPose-dt);
  if(formalClass()){const grounded=p.onGround;moveClassPlayer(p,input,g.platforms,dt);if(grounded&&!p.onGround&&p.vy<0&&p.classId!=="WING")tone(330,.06)}
  else if(g.lab?.preset==="FLIGHT")moveFlightPlayer(p,input,g.platforms,dt);else{
  const preset=g.lab?PLAYER_PRESETS[g.lab.preset]:PLAYER_PRESETS.STANDARD;
  const move=(input.right?1:0)-(input.left?1:0);p.vx=move*preset.speed;if(move)p.face=move;if(input.jump&&p.onGround){p.vy=-preset.jump;p.onGround=false;tone(330,.06)}p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);
  if(g.missionId==='M02'||g.missionId==='M03')movePlayerBody(p,g.platforms,dt,true);else{
  p.x=clamp(p.x+p.vx*dt,8,WORLD.width-25);p.y+=p.vy*dt;
  let floor=WORLD.ground-32;for(const pl of g.platforms){if(p.x+7>pl.x&&p.x-7<pl.x+pl.w&&p.y+32<=pl.y+8&&p.y+32+p.vy*dt>=pl.y)floor=Math.min(floor,pl.y-32)}if(p.y>=floor){p.y=floor;p.vy=0;p.onGround=true}else p.onGround=false;
  }
  }
  if(g.coast)recoverCoastalPlayer(g,dt,hurtPlayer,pushEffect);
  if(progression){if(g.missionId==='M01'&&g.midbossAlive&&p.x>2150)p.x=2150;if(g.bossStarted)p.x=g.missionId==='M03'?clamp(p.x,5480,6350):g.missionId==='M02'?clamp(p.x,M02.bossX,5560):clamp(p.x,4100,4760)}
  if(g.lab?.cameraMode==="FIXED")fixedLabCamera(g.battleCamera,p,g.lab.fixedZoom);else updateBattleCamera(g.battleCamera,p,g.enemies,g,dt);syncCameraView();p.anim+=dt*(Math.abs(p.vx)>0?10:4);
  if(input.fire)shoot();
  if(progression){if(combat)g.director.update(dt,g,spawnEnemy,viewBounds(g.camera,view.zoom));
  for(let i=g.area+1;i<g.areas.length;i++)if(p.x>=g.areas[i].x)announceArea(i);
  if(p.x>(g.missionId==='M03'?M03.bossX:g.missionId==='M02'?M02.bossX:4100)&&!g.bossStarted&&!g.clear){if(missionRun?.mode==='A')finishLabRun('TERRAIN_REACHED');else startBoss()}
  }
  if(g.missionId==='M02'&&combat)updateNests(g,dt,spawnEnemy);
  g.grid.rebuild(g.enemies);updateShots(dt);updateExpanded(g,dt,weaponAPI);syncRemoteControl();updateEnemies(dt);updateEnemyShots(dt);updateItems(dt);updateEffects(dt);
  if(g.coast&&combat&&!g.clear&&!p.dead&&(!g.lab?.run||g.lab.run.outcome==='RUNNING'))updateCoastalDevices(g,dt,damageEnemy,hurtPlayer,pushEffect);
  canvas.dataset.gameState=state;canvas.dataset.playerX=Math.round(p.x);canvas.dataset.playerHp=Math.ceil(p.hp);canvas.dataset.enemies=g.liveEnemies;canvas.dataset.boss=g.bossStarted?"1":"0";canvas.dataset.density=g.density;canvas.dataset.enemyLimit=g.enemyLimit;
  canvas.dataset.playerClass=p.classId;canvas.dataset.flightEnergy=p.energy.toFixed(1);canvas.dataset.missionId=g.missionId;canvas.dataset.area=String(g.area+1);if(g.time>=(g.nextHudStatus??0)){document.querySelector("#combatStatus").textContent=combatHudText(g,activeEquipment());g.nextHudStatus=g.time+.25}if(g.coast){const b=g.enemies.find(e=>e.type==='leviathan'&&!e.dead);canvas.dataset.bossPhase=String(b?.coastPhase??0);canvas.dataset.bossHp=String(b?.hp??0)}
  if(missionRun&&missionRun.outcome==='RUNNING')missionRun.tick(g,input,dt);
  if(p.hp<=0&&!p.dead){p.dead=true;if(missionRun){missionRun.gameOver={time:g.time,x:p.x,y:p.y};missionRun.elapsed=g.time;missionRun.finalHp=p.hp;missionRun.outcome='GAME_OVER'}scheduleMission(()=>{renderGameover();missionScreen("gameover")},650)}
}

function hitRect(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function damageEnemy(e,dmg,source={}){
  if(e.dead)return;const baseDamage=dmg;if(e.type==='queen')dmg=queenDamage(e,dmg,source);if(e.type==='leviathan')dmg=coastalDamage(e,dmg,source);
  if(game.lab?.run?.outcome==='RUNNING'){const id=source.weapon?.id??source.weaponId??WEAPONS[source.assetIndex]?.id??WEAPONS.find(w=>w.type===source.type)?.id;game.lab.run.damage(id,Math.min(Math.max(0,e.hp),Math.max(0,dmg)))}
  e.hp-=dmg;game.score+=Math.max(1,Math.round(dmg));const category=feedbackCategory(e,baseDamage,dmg,e.hp<=0),core=dmg>baseDamage?(e.type==='queen'?weakCore(e):e.type==='leviathan'?coastalWeakCore(e):null):null;
  if(hitVisual(game,e,source,category,core)&&e.hp>0)feedbackSound(category);if(core)e.coreHitUntil=game.impact.clock+.16;
  if(e.hp>0)return;
  e.dead=true;beginDeath(game,e,source,viewBounds(game.camera,view.zoom));game.liveEnemies--;if(isMob(e))game.liveMobs--;game.kills++;game.score+=ENEMY_TYPES[e.type].score;
  if(game.lab?.run?.outcome==='RUNNING')game.lab.run.kills++;
  if(e.type==="beetle")game.midbossAlive=false;
  if(e.platform)e.platform.active=false;
  if(e.type==='nest'){pushEffect({kind:'nestBreak',x:e.x,y:e.y+24,life:.65,max:.65});impactShake(game)}
  if(e.type==='queen')for(let i=0;i<5;i++)scheduleMission(()=>{if(game)pushEffect({kind:'bossBreak',x:e.x+(i%3-1)*32,y:e.y+24+i*8,life:.7,max:.7})},i*130);
  if(e.type==='leviathan'){game.coast.hazards.length=0;for(let i=0;i<6;i++)scheduleMission(()=>{if(game)pushEffect({kind:'coastBreak',x:e.x+(i%3-1)*40,y:e.y+40,life:.65,max:.65})},i*120)}
  if(isBoss(e)&&(!game.lab||game.lab.run)){
    if(game.lab?.run)game.lab.run.bossDefeatedAt=game.time;else game.score+=Math.max(0,Math.floor(3000-game.time*8));game.enemies.length=0;game.enemies.push(e);game.liveEnemies=game.liveMobs=0;
    game.impact.corpses=1;
    game.enemyShots.length=0;game.shots.length=0;game.player.invuln=99;scheduleMission(()=>game?.lab?.run?finishLabRun('BOSS_DEFEATED'):completeMission(),900);
  }else if(Math.random()<.06)game.items.push({x:e.x,y:e.y+e.h/2,type:"heal",alive:true});
  else if(Math.random()<.02)game.items.push({x:e.x,y:e.y+e.h/2,type:"crate",alive:true});
  if(game.time>=(game.nextDeathSound||0)){tone(isBoss(e)||e.type==='beetle'?65:80,isBoss(e)?.22:.12,"sawtooth",.025,isBoss(e)||e.type==='beetle'?'large':'finish');game.nextDeathSound=game.time+.05}
}
function explode(s){
  pushEffect({x:s.x,y:s.y,kind:"explosion",life:.45,max:.45,r:s.radius,artWeaponId:s.weapon?.id??WEAPONS[s.assetIndex]?.id??(s.type==='rocket'?'R-04':null)});
  const candidates=game.grid.query(s.x-s.radius-48,s.y-s.radius-32,s.x+s.radius+48,s.y+s.radius+32,game.blastCandidates);
  const source={type:s.type??s.weapon?.type??"rocket",effectType:s.effectType,assetIndex:s.assetIndex,radial:true,x:s.x,y:s.y,radius:s.radius};
  for(let i=0;i<candidates.length;i++){const e=candidates[i];
    const distance=['M02','M03'].includes(game.missionId)?Math.hypot(s.x-clamp(s.x,e.x-e.w/2,e.x+e.w/2),s.y-clamp(s.y,e.y,e.y+e.h)):Math.hypot(s.x-e.x,s.y-e.y-e.h/2);
    if(!e.dead&&distance<s.radius){damageEnemy(e,s.damage,source);if(e.dead)s.onKill?.(e)}
  }
  if(s.assetIndex>=8)pushEffect({x:s.x,y:s.y,kind:"weaponBurst",assetIndex:s.assetIndex,life:.35,max:.35,r:s.radius});
  impactShake(game);tone(65,.18,"sawtooth",.04);
}
function updateShots(dt){for(const s of game.shots){if(s.expanded)continue;const oldX=s.x,oldY=s.y;s.life-=dt;if(s.type==="grenade")s.vy+=330*dt;if(s.type==="homing"){const target=nearestEnemy(game.enemies,s.x,s.y,Infinity,null,true);if(target){const a=Math.atan2(target.y-s.y,target.x-s.x),speed=Math.hypot(s.vx,s.vy),desired={x:Math.cos(a)*speed,y:Math.sin(a)*speed};s.vx+=(desired.x-s.vx)*Math.min(1,3.8*dt);s.vy+=(desired.y-s.vy)*Math.min(1,3.8*dt)}}s.x+=s.vx*dt;s.y+=s.vy*dt;
    const terrain=['M02','M03'].includes(game.missionId)?terrainContact(oldX,oldY,s.x,s.y,game.platforms,s.w/2,false,game.world):null;if(terrain){s.x=terrain.x;s.y=terrain.y}
    if((s.type==="grenade"&&s.y>WORLD.ground-3)||s.life<=0){if(s.radius)explode(s);s.dead=true;continue}
    const candidates=game.grid.query(s.x-s.w/2-(game.missionId==='M03'?96:48),s.y-s.h/2-(game.missionId==='M03'?96:32),s.x+s.w/2+(game.missionId==='M03'?96:48),s.y+s.h/2+(game.missionId==='M03'?96:32),game.shotCandidates);
    for(const e of candidates){if(e.dead||s.dead||(s.rehit[e.uid]??0)>game.time)continue;const box={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(['M02','M03'].includes(game.missionId)?segmentEntry(oldX,oldY,s.x,s.y,e.x-e.w/2-s.w/2,e.y-s.h/2,e.x+e.w/2+s.w/2,e.y+e.h+s.h/2):hitRect({x:s.x,y:s.y,w:s.w,h:s.h},box)){s.rehit[e.uid]=game.time+(s.weapon.rehit??999);damageEnemy(e,s.damage,s);if(s.type==="thunder"){const seen=new Set([e]);let from=e;for(let c=0;c<3;c++){const nearby=game.grid.query(from.x-133,from.y-117,from.x+133,from.y+117,game.chainCandidates);const next=nearestEnemy(nearby,from.x,from.y,85,seen);if(!next)break;seen.add(next);damageEnemy(next,s.damage*.75,{type:"thunder",vx:next.x-from.x,vy:next.y-from.y});pushEffect({x:from.x,y:from.y,x2:next.x,y2:next.y,kind:"lightning",life:.16,max:.16});from=next}}
      if(s.radius){explode(s);s.dead=true}else if(s.pierce>0){s.pierce--}else s.dead=true}}
    if(terrain&&!s.dead){if(s.radius)explode(s);s.dead=true}
  }let write=0;for(const s of game.shots)if(!s.dead&&s.x>-64&&s.x<(game.world??WORLD).width+64&&s.y>-600&&s.y<260)game.shots[write++]=s;game.shots.length=write}

function updateEnemies(dt){const p=game.player;game.grid.rebuild(game.enemies);prepareSeparation(game.enemies,game.grid,game.separationCandidates);game.attacks.begin(game.time,game.enemies,game.enemyShots);if(game.coast)advanceCoastalFormations(game,dt);
  for(const e of game.enemies){e.anim+=dt*7;e.attackFlash=Math.max(0,e.attackFlash-dt);e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);if(e.dead){updateDeath(game,e,dt);continue}const t=ENEMY_TYPES[e.type];e.shotCd-=dt;e.face=p.x>=e.x?1:-1;
    if(game.lab?.run?.mode==='A')continue;
    if(game.coast&&['shorecrab','skyray','siegebeetle','leviathan'].includes(e.type))updateCoastalEnemy(game,e,dt,spawnEnemy,pushEffect);
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
    if(isMob(e)&&!['worm','shorecrab','skyray'].includes(e.type)){e.x=clamp(e.x+e.separateX*dt,8,(game.world??WORLD).width-8);if(e.type==="needle")e.y=clamp(e.y+e.separateY*dt,12,WORLD.ground-e.h)}
    if(game.missionId==='M02'&&['needle','spider'].includes(e.type)){const safe=validEnemyPosition(game,'needle',e.x,e.y);e.y=safe.y}
    if(game.missionId==='M02'&&e.type==='spitter')e.y=ceilingAt(game.platforms,e.x);
    const pb={x:p.x,y:p.y+16,w:p.w,h:p.h},eb={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect(pb,eb))hurtPlayer(t.damage,e.x)
  }let write=0;for(const e of game.enemies)if(!e.dead||e.death>0)game.enemies[write++]=e;game.enemies.length=write}
function updateBoss(e,dt){const p=game.player;e.timer+=dt;const phase=e.hp>800?0:e.hp>400?1:2;if(e.phase==="charge"){e.x+=e.vx*dt;if(e.x<4130||e.x>4720){e.x=clamp(e.x,4130,4720);e.vx*=-1;e.phase="move";e.timer=0}}else{e.x+=Math.sign((phase===2?p.x:4540)-e.x)*ENEMY_TYPES.boss.speed*(phase===2?.45:.18)*dt;if(e.timer>2.2-phase*.3){e.timer=0;const action=Math.floor(Math.random()*3);if(action===0)enemyBurst(e,5,130);else if(action===1){for(let i=0;i<2+phase;i++)spawnBossMinion(e,i)}else{e.phase="charge";e.vx=Math.sign(p.x-e.x)*(100+phase*25)}}}}
function enemyFire(e,speed,angleOffset=0){e.attackFlash=.18;const p=game.player,ex=e.x,ey=e.y+e.h/2,a=Math.atan2(p.y+15-ey,p.x-ex)+angleOffset;game.enemyShots.push({kind:e.type==='spitter'||e.type==='queen'?'acid':null,x:ex,y:ey,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,w:5,h:5,life:4,damage:e.type==='spitter'?12:ENEMY_TYPES[e.type].damage*.6,normal:isMob(e)})}
function enemyBurst(e,count,speed){for(let i=0;i<count;i++)enemyFire(e,speed,(i-(count-1)/2)*.15);tone(120,.08)}
function hurtPlayer(amount,sourceX){const p=game.player;if(game.lab?.run?.mode==='A'||game.lab?.invincible||p.invuln>0||p.dead||game.clear)return;const c=PLAYER_CLASSES[p.classId],scale=formalClass()?c.damageScale:1,kick=formalClass()?c.knockback:1;const before=p.hp;p.hp=Math.max(0,p.hp-amount*scale);if(game.lab?.run?.outcome==='RUNNING')game.lab.run.damageTaken+=before-p.hp;p.invuln=1;p.hitPose=.16;p.vx=(sourceX<p.x?60:-60)*kick;p.vy=-90*kick;game.shake=4;tone(55,.15,"sawtooth",.04)}
function updateEnemyShots(dt){const p=game.player;for(const s of game.enemyShots){const x=s.x,y=s.y;s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(['M02','M03'].includes(game.missionId)&&terrainContact(x,y,s.x,s.y,game.platforms,s.kind==='wave'?0:2,false,game.world))s.dead=true;if(!s.dead&&game.coast)for(const t of game.coast.turrets)if(t.hp>0&&Math.abs(s.x-t.x)<16&&s.y>=t.y&&s.y<=148){t.hp=Math.max(0,t.hp-s.damage);s.dead=true;break}if(!s.dead&&hitRect({x:s.x,y:s.y,w:s.w,h:s.h},{x:p.x,y:p.y+16,w:p.w,h:p.h})){hurtPlayer(s.damage,s.x);s.dead=true}}let write=0;for(const s of game.enemyShots)if(!s.dead&&s.life>0&&s.x>-64&&s.x<(game.world??WORLD).width+64&&s.y>-600&&s.y<260)game.enemyShots[write++]=s;game.enemyShots.length=write}
function updateItems(){const p=game.player;for(const it of game.items){if(!it.alive)continue;if(Math.abs(it.x-p.x)<20&&Math.abs(it.y-(p.y+16))<26){it.alive=false;if(it.type==="heal")p.hp=Math.min(p.maxHp,p.hp+25);else gCrate();tone(880,.12)}}}
function gCrate(){game.crates++;game.score+=500;game.areaText="WEAPON BOX ACQUIRED";game.areaTimer=1.6;if(game.lab)return;const reward=pickReward(save.unlocked,Math.random,false);if(reward){save.unlocked.push(reward);game.weaponRewards.push(reward);game.areaText=`UNLOCK ${reward}`}else game.areaText="ARSENAL COMPLETE / SCORE +500";storeSave()}
function updateEffects(dt){let write=0;for(const f of game.effects){f.life-=dt;if(f.life>0)game.effects[write++]=f}game.effects.length=write;updateParticles(game,dt)}

function statCards(entries){return entries.map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}
function renderGameover(){
  const d=outcomeData(game);document.querySelector('#gameoverMode').textContent=d.qa?'TEST LAB / QA / NO SAVE':'通常ミッション';document.querySelector('#gameoverStats').innerHTML=statCards([
    ['MISSION',d.missionId],['兵科',d.classId],['到達エリア',`AREA ${String(d.area).padStart(2,'0')} ${d.areaName}`],['プレイ時間',formatTime(d.time)],['撃破数',d.kills],['SCORE',d.score]
  ]);
  document.querySelector('#gameoverStats').setAttribute('aria-label',`${d.qa?'QA / NO SAVE / ':''}${d.missionName} / ${d.areaName}`);
}
for(const id of ['screenResult','screenGameover'])document.querySelector('#'+id).addEventListener('pointerdown',()=>document.querySelector('#'+id).classList.toggle('skip-intro',true));
function completeMission(){if(!game||game.clear||game.lab)return;game.clear=true;
  const firstClear=!save.clearedMissions.includes(game.missionId),playableBefore=new Set(MISSIONS.filter(m=>canPlayMission(m.id,save)).map(m=>m.id));
  const reward=['M02','M03'].includes(game.missionId)?pickReward(save.unlocked,Math.random,false):game.missionId==="M01"&&firstClear&&!save.unlocked.includes("L-03")?"L-03":null;
  if(['M02','M03'].includes(game.missionId)){game.crates++;if(!reward)game.score+=500}
  if(reward){save.unlocked.push(reward);game.weaponRewards.push(reward)}save=recordMissionClear(save,game.missionId);save.highScore=Math.max(save.highScore,game.score);save.bestTime=save.bestTime===null?game.time:Math.min(save.bestTime,game.time);storeSave();clearArsenal(game);
  const previous=save.missionStats[game.missionId];save.missionStats[game.missionId]={highScore:Math.max(previous?.highScore??0,game.score),bestTime:Math.min(previous?.bestTime??Infinity,game.time)};storeSave();
  const w=reward?weapon(reward):null,d=outcomeData(game);
  document.querySelector('#resultTitle').textContent=`${d.missionId} ${d.missionName}`;
  document.querySelector('#resultClass').textContent=`兵科 ${d.classId}`;
  document.querySelector('#resultStats').innerHTML=statCards([['クリア時間',formatTime(d.time)],['SCORE',d.score],['撃破数',d.kills],['武器箱',game.crates]]);
  document.querySelector("#rewardBox").innerHTML=w?`<span>${['M02','M03'].includes(game.missionId)?(firstClear?'FIRST CLEAR / WEAPON BOX':'MISSION WEAPON BOX'):'WEAPON UNLOCKED'}</span><strong>${w.id} ${w.name}</strong>`:`<span>ARSENAL ${save.unlocked.length}/${WEAPONS.length}</span><strong>${save.unlocked.length===WEAPONS.length?['M02','M03'].includes(game.missionId)?"全武器取得済み / SCORE +500":"全武器取得済み":"武器箱の解放記録を保存"}</strong>`;const opened=MISSIONS.filter(m=>canPlayMission(m.id,save)&&!playableBefore.has(m.id)).map(m=>`${m.id} ${m.name}`);
  document.querySelector('#resultUnlock').textContent=opened.length?`NEXT MISSION OPEN / ${opened.join('・')}`:'次のミッション解放：なし';
  document.querySelector('#resultWeapons').textContent=game.weaponRewards.length?`新規武器：${game.weaponRewards.join(' / ')}`:'新規武器：なし';
  game.resultSummary={...d,reward:reward??null,newWeapons:[...game.weaponRewards],openedMissions:opened};
  tone(660,.18,'triangle',.025,'clear');scheduleMission(()=>show("result"),500)
}

function activeArt(){return game?.lab?artPreview:releaseArt}
function activeStudy(){const art=activeArt();return art&&art.style!=='ORIGINAL'?art.pack:null}
async function loadReleaseArt(loader){
  const result=await releaseArt.select('UNIFIED_01',loader);
  applyPreviewResolution();if(state==='equip'&&!game?.lab)renderWeaponGrid();return result;
}
function applyPreviewResolution(){
  const scale=DEBUG&&game?.lab?previewRenderScale:1,width=VIEW.canvasWidth*scale,height=VIEW.canvasHeight*scale;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;ctx.imageSmoothingEnabled=false}
  canvas.dataset.artStyle=activeStudy()?activeArt().style:'ORIGINAL';canvas.dataset.artLoading=String(!!activeArt()?.loading);canvas.dataset.artFallbacks=(activeStudy()?.fallbacks??[]).join(',');canvas.dataset.renderResolution=`${width}x${height}`;return scale;
}
async function setArtStyle(value){
  if(!DEBUG||!game?.lab||!['lab','pause','play'].includes(state))return false;
  const promise=artPreview.select(value);syncLabUI();const result=await promise;syncLabUI();if(labWeaponPickerOpen)renderLabWeaponList();return result;
}
function setPreviewResolution(value){if(!DEBUG||!game?.lab||!['lab','pause','play'].includes(state)||!['1','2'].includes(String(value)))return false;previewRenderScale=Number(value);applyPreviewResolution();syncLabUI();return true}
function beginArtComparison(){if(!DEBUG||!game?.lab||game.player.dead)return;artComparison=true;pauseLabMeasurement();resetInput();show('pause')}
function draw(){
  const renderScale=applyPreviewResolution();ctx.setTransform(renderScale,0,0,renderScale,0,0);ctx.imageSmoothingEnabled=false;
  view.renderOffset=0;
  if(!assetsReady){ctx.fillStyle="#050915";ctx.fillRect(0,0,320,180);return}
  if(!game||!["play","pause","confirm","lab","settings"].includes(state)){const backdrop=activeStudy()?.city;if(backdrop)ctx.drawImage(backdrop,0,0,640,360,0,0,320,180);else ctx.drawImage(images.bg,0,0);return}
  const g=game,shake=!artComparison&&g.shake&&activeSettings().shake?(Math.random()-.5)*g.shake:0;
  view.renderOffset=Math.round(shake);
  ctx.save();
  const origin=worldToScreen({x:0,y:0},g.camera,view.zoom);
  ctx.translate(Math.round(shake)+origin.x,Math.round(shake)+origin.y);
  ctx.scale(view.zoom,view.zoom);
  activeArt()?.prepare(view.zoom);
  drawBackdrop(g);drawWorld(g);drawItems(g);drawEnemies(g);if(g.coast)drawCoastalWarnings(ctx,g);drawShots(g);drawPlayer(g.player);drawEffects(g);
  ctx.restore();drawHud(g);drawImpactHud(g);
}
function drawBackdrop(g){
  const bounds=viewBounds(g.camera,view.zoom),start=g.camera-(g.camera*.18%320),study=activeStudy();
  if(g.missionId==='M03'){ctx.fillStyle='#091e30';ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,bounds.bottom-bounds.top+20);for(let x=start-320;x<bounds.right+320;x+=320)if(coastalArt?.coast)ctx.drawImage(coastalArt.coast,0,0,640,360,x,0,320,180);return}
  // The zoom reveals sky above the original artwork. Fill it and repeat the city horizontally.
  ctx.fillStyle="#040a16";ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,bounds.bottom-bounds.top+20);
  for(let x=start-320;x<bounds.right+320;x+=320)if(study?.[g.missionId==='M02'?'underground':'city'])ctx.drawImage(g.missionId==='M02'?study.underground:study.city,0,0,640,360,x,0,320,180);else ctx.drawImage(g.missionId==='M02'?images.underground:images.bg,x,0);
  if(g.missionId==='M02'){ctx.fillStyle='#081321';ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,Math.max(0,-bounds.top));for(let x=Math.floor(bounds.left/96)*96;x<bounds.right+96;x+=96){ctx.fillStyle='#17353d';ctx.fillRect(x,bounds.top,5,Math.max(0,-bounds.top+8));ctx.fillStyle='#3c665e';ctx.fillRect(x+2,0,2,6)}}
}
function drawWorld(g){
  const bounds=viewBounds(g.camera,view.zoom),study=activeStudy();
  if(g.missionId==='M03'){drawCoastalWorld(ctx,coastalArt,g,bounds);return}
  if(g.missionId==='M02'){drawUnderground(g,bounds);return}
  ctx.fillStyle="#0b1825";ctx.fillRect(bounds.left-10,WORLD.ground,view.width+20,bounds.bottom-WORLD.ground+10);
  for(let x=Math.floor(bounds.left/16)*16-16;x<bounds.right+16;x+=16)if(!drawStudyTile(ctx,study,'M01',studyTileVariant(x),x,WORLD.ground))ctx.drawImage(images.tiles,((Math.floor(x/16)%8+8)%8)*16,0,16,16,x,WORLD.ground,16,16);
  ctx.fillStyle="#d4b944";for(let x=Math.floor(bounds.left/40)*40;x<bounds.right;x+=40)ctx.fillRect(x,168,19,2);
  for(const pl of g.platforms)if(pl.x+pl.w>bounds.left&&pl.x<bounds.right){ctx.fillStyle="#203e4a";ctx.fillRect(pl.x,pl.y,pl.w,8);ctx.fillStyle="#57a1a0";ctx.fillRect(pl.x,pl.y,pl.w,2);if(study)for(let x=Math.max(pl.x,Math.floor(bounds.left/16)*16);x<pl.x+pl.w&&x<bounds.right;x+=16)drawStudyTile(ctx,study,'M01',x===pl.x?4:x+16>=pl.x+pl.w?6:5,x,pl.y,Math.min(16,pl.x+pl.w-x),8)}
  for(const a of MISSION_AREAS)if(a.x>bounds.left&&a.x<bounds.right){ctx.fillStyle="#37e8df44";ctx.fillRect(a.x,30,1,118)}
}
function drawUnderground(g,bounds){
  const study=activeStudy(),tile=(index,x,y,height=16,width=16,studyIndex=null)=>{if(drawUnifiedTile(ctx,study,'M02',index,x,y,width,height))return;if(studyIndex!==null&&drawStudyTile(ctx,study,'M02',studyIndex,x,y,width,height))return;ctx.drawImage(images.undergroundTiles,index%8*16,Math.floor(index/8)*16,width,height,x,y,width,height)};
  // The final chamber is organic rather than another copy of the subway hall.
  if(bounds.right>4500){
    ctx.fillStyle='#160e28';ctx.fillRect(Math.max(4500,bounds.left),0,bounds.right-Math.max(4500,bounds.left)+16,WORLD.ground);
    for(let x=Math.max(4500,Math.floor(bounds.left/80)*80);x<bounds.right+80;x+=80){ctx.strokeStyle='#50325e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+20,38);ctx.lineTo(x+6,66);ctx.lineTo(x+28,116);ctx.lineTo(x+18,148);ctx.stroke();tile(11,x+26,12);tile(8,x+48,124)}
  }
  ctx.fillStyle='#0d202a';ctx.fillRect(bounds.left-10,WORLD.ground,view.width+20,bounds.bottom-WORLD.ground+10);
  for(let x=Math.floor(bounds.left/16)*16;x<bounds.right+16;x+=16)tile(x>=3300?9:0,x,WORLD.ground,16,16,x<3300?studyTileVariant(x):null);
  for(const p of g.platforms){if(p.active===false||p.kind==='barrier'||p.x+p.w<bounds.left||p.x>bounds.right)continue;
    ctx.fillStyle=p.kind==='pipe'?'#315d61':p.kind==='metal'?'#263e4e':'#152a38';ctx.fillRect(p.x,p.y,p.w,p.h??8);
    ctx.fillStyle=p.kind==='metal'?'#a0c6ab':'#517985';ctx.fillRect(p.x,p.y,p.w,2);
    for(let x=Math.max(p.x,Math.floor(bounds.left/16)*16);x<p.x+p.w&&x<bounds.right;x+=16){
      const height=p.h??8,width=Math.min(16,p.x+p.w-x),index=p.kind==='pipe'?3:p.kind==='cave'?10:p.kind==='wall'?2:p.kind==='ceiling'?1:0;
      if(study?._u?.underTiles)for(let y=p.y;y<p.y+height;y+=16)tile(index,x,y,Math.min(16,p.y+height-y),width);
      else tile(index,x,p.y,Math.min(16,height),width,p.kind==='metal'?0:p.kind==='pipe'&&p.w>=16&&height<=16?4:null);
    }
  }
  ctx.font='8px monospace';ctx.fillStyle='#8fe2ac';
  for(const [x,y,label] of [[2020,58,'UPPER →'],[2290,106,'LOWER →'],[3180,46,'MERGE →']])if(x>bounds.left&&x<bounds.right)ctx.fillText(label,x,y);
}
function drawPlayer(p){if(p.invuln>0&&!p.hitPose&&Math.floor(p.invuln*12)%2)return;if(drawStudyPlayer(ctx,activeStudy(),p,weapon(activeEquipment()[p.weaponSlot]),images.heldWeapons))return;const frame=classPlayerFrame(p),row=PLAYER_CLASSES[p.spriteClass||p.classId].row;const x=Math.round(p.x-12),y=Math.round(p.y);ctx.save();if(p.face<0){ctx.translate(x+24,0);ctx.scale(-1,1);ctx.drawImage(images.classes,frame*24,row*32,24,32,0,y,24,32)}else ctx.drawImage(images.classes,frame*24,row*32,24,32,x,y,24,32);const w=weapon(activeEquipment()[p.weaponSlot]);if(w.expanded)ctx.drawImage(images.heldWeapons,w.assetIndex*16,0,16,16,(p.face<0?0:x)+14,y+5,16,16);ctx.restore()}
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
    if(drawCoastalEnemy(ctx,coastalArt,e,localX,localY,activeArt()?.far)){}
    else if(drawStudyEnemy(ctx,activeStudy(),e,localX,localY)){}
    else if(['worm','spitter','nest','queen','barrier'].includes(e.type))drawUndergroundEnemy(e,frame,localX,localY);
    else if(e.type==="boss")ctx.drawImage(images.boss,frame*96,0,96,64,localX-48,Math.round(localY),96,64);else{const t=ENEMY_TYPES[e.type],size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,frame*48,t.row*48,48,48,localX-size/2,Math.round(localY+e.h-size),size,size)}
    if(e.dead){if(e.deathType==="flame"||e.deathDelay>0){ctx.fillStyle=e.deathType==="flame"?"#ff8b42":"#b88cff";ctx.fillRect(-8,-3,4,2);ctx.fillRect(5,1,4,3)}ctx.restore();ctx.globalAlpha=1}
    else{if(e.hitFlash>0){ctx.fillStyle="#fff7d5";ctx.fillRect(x-6,Math.round(e.y+e.h/2),12,2)}if(e.type==='nest'){ctx.fillStyle='#09121e';ctx.fillRect(x-24,e.y-8,48,5);ctx.fillStyle='#aef046';ctx.fillRect(x-24,e.y-8,48*e.hp/e.maxHp,5)}if(e.type==='queen'&&weakCore(e).open){const core=weakCore(e);ctx.strokeStyle='#fff08b';ctx.lineWidth=2;ctx.strokeRect(core.x-12,core.y-10,24,20)}if(e.type==='leviathan'&&coastalWeakCore(e).open){const core=coastalWeakCore(e);ctx.strokeStyle='#ffdf8b';ctx.lineWidth=1;ctx.strokeRect(core.x-15,core.y-15,30,30)}}
  }}
function drawUndergroundEnemy(e,frame,x,y){
  if(e.type==='barrier'){ctx.drawImage(images.undergroundTiles,e.dead?96:e.hp<e.maxHp/2?80:64,16,16,16,x-e.w/2,y,e.w,e.h);return}
  ctx.drawImage(images[e.type],frame*e.w,0,e.w,e.h,x-e.w/2,Math.round(y),e.w,e.h);
}
function drawDeathGhost(e,x,y,angle,alpha,full){
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y+e.h/2));ctx.rotate(angle);
  if(!full){ctx.fillStyle=e.deathColor;ctx.fillRect(-3,0,6,2)}
  else if(drawCoastalEnemy(ctx,coastalArt,e,0,-e.h/2,activeArt()?.far)){}
  else if((activeStudy()?._u?.[e.type]||activeStudy()?._b?.[e.type])&&drawStudyEnemy(ctx,activeStudy(),e,0,-e.h/2)){}
  else if(['worm','spitter','nest','queen','barrier'].includes(e.type))drawUndergroundEnemy(e,3,0,-e.h/2);
  else if(e.type==="boss")ctx.drawImage(images.boss,288,0,96,64,-48,-e.h/2,96,64);
  else{const size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,144,ENEMY_TYPES[e.type].row*48,48,48,-size/2,e.h/2-size,size,size)}
  ctx.restore();ctx.globalAlpha=1;
}
function drawShots(g){
  const study=activeStudy();
  drawExpanded(ctx,g,images,viewBounds(g.camera,view.zoom),study?{projectile:(c,s,x,y,size)=>drawStudyProjectile(c,study,s.weapon.id,x,y,size,size),installation:(c,i)=>(study._u?.icons||i.weapon.id==='D-19')&&drawStudyIcon(c,study,i.weapon.id,Math.round(i.x)-12,i.y-(study._u?.icons&&i.weapon.type==='mine'?21:22.5),24,24),storm:(c,j)=>drawUnifiedSpecial(c,study,j.weapon.id,(g.time%1),j.x,j.y-48,64,32),trail:(c,s)=>drawUnifiedTrail(c,study,s)}:null);
  for(const s of g.shots){if(s.expanded||s.x<g.camera-16||s.x>g.camera+view.width+16)continue;const i=s.weapon.assetIndex,x=Math.round(s.x),y=Math.round(s.y);if(study){ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(s.vy,s.vx));const drawn=drawStudyProjectile(ctx,study,s.weapon.id,-8,-8);ctx.restore();if(drawn)continue}ctx.drawImage(images.shots,i*16,0,16,16,x-8,y-8,16,16)}
  for(const s of g.enemyShots){if(s.x<g.camera-32||s.x>g.camera+view.width+32)continue;
    if(['artillery','coastOrb'].includes(s.kind)&&coastalArt?.coastAA){ctx.drawImage(coastalArt.coastAA,Math.floor(g.time*12)%4*32,0,32,32,Math.round(s.x)-s.w/2,Math.round(s.y)-s.h/2,s.w,s.h);continue}
    if(s.kind==='acid'){if(!drawUnifiedEnvironmentalEffect(ctx,study,'acid',g.time*2%1,s.x,s.y,16,16))ctx.drawImage(images.acid,Math.floor(g.time*8)%4*16,0,16,16,s.x-8,s.y-8,16,16)}
    else if(s.kind==='wave'){if(!drawUnifiedEnvironmentalEffect(ctx,study,'wave',g.time*2%1,s.x,s.y-6,32,24))ctx.drawImage(images.wave,Math.floor(g.time*8)%4*32,0,32,24,s.x-16,s.y-18,32,24)}
    else{ctx.fillStyle='#b5ef48';ctx.fillRect(Math.round(s.x)-3,Math.round(s.y)-3,6,6);ctx.fillStyle='#fff08b';ctx.fillRect(Math.round(s.x)-1,Math.round(s.y)-1,2,2)}
  }
}
function drawItems(g){for(const it of g.items){if(!it.alive||it.x<g.camera-24||it.x>g.camera+view.width+24)continue;ctx.drawImage(images.items,it.type==="heal"?0:32,0,32,32,Math.round(it.x)-12,it.y-16,24,24)}}
function drawEffects(g){for(const f of g.effects){const margin=f.kind==="explosion"?Math.max(100,(f.r||24)*1.6*(f.visualScale||1)):100;if(Math.max(f.x,f.x2??f.x)<g.camera-margin||Math.min(f.x,f.x2??f.x)>g.camera+view.width+margin)continue;const x=f.x,a=f.life/f.max;
    if(drawCoastalFX(ctx,coastalArt,f,1-a))continue;
    if(f.kind==="explosion"){
      const scale=f.visualScale||1,fr=Math.min(7,Math.floor((1-a)*8)),sz=Math.max(30,(f.r||24)*2.6)*scale,radius=(f.r||24)*(.3+(1-a)*1.3)*scale;
      if(!drawStudyEffect(ctx,activeStudy(),f.artWeaponId,1-a,x,f.y,sz))ctx.drawImage(images.explosion,fr*32,0,32,32,x-sz/2,f.y-sz/2,sz,sz);
      ctx.globalAlpha=a;ctx.strokeStyle=a>.65?"#fff7d5":"#ffab56";ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<=8;i++){const angle=i*Math.PI/4,px=Math.round(x+Math.cos(angle)*radius),py=Math.round(f.y+Math.sin(angle)*radius);if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.stroke();
      ctx.fillStyle="#fff1a8";if(a>.8)ctx.fillRect(x-8*scale,f.y-7*scale,16*scale,14*scale);
      for(let i=0;i<6;i++){const angle=i*Math.PI/3;ctx.fillRect(Math.round(x+Math.cos(angle)*radius*1.1),Math.round(f.y+Math.sin(angle)*radius*1.1),3,2)}ctx.globalAlpha=1;
    }else if(f.kind==='nestBreak'||f.kind==='bossBreak'){
      const boss=f.kind==='bossBreak',width=boss?128:64,height=boss?96:64;if(!drawUnifiedEnvironmentalEffect(ctx,activeStudy(),f.kind,1-a,x,f.y,width,height))ctx.drawImage(boss?images.bossBreak:images.nestBreak,Math.min(7,Math.floor((1-a)*8))*width,0,width,height,x-width/2,f.y-height/2,width,height);
    }else if(f.kind==="weaponBurst"){
      const size=Math.max(32,(f.r||24)*2)*(f.visualScale||1);if(!drawUnifiedSpecial(ctx,activeStudy(),WEAPONS[f.assetIndex]?.id,1-a,x,f.y,size))ctx.drawImage(images.weaponFx,(4+Math.min(3,Math.floor((1-a)*4)))*32,(f.assetIndex-8)*32,32,32,x-size/2,f.y-size/2,size,size);
    }else if(f.kind==="hit"){drawHitEffect(f,g.enemyLimit>100?2:4);drawFeedbackAccent(ctx,f)}
    else if(f.kind==="lightning"){if(!drawStudyLightning(ctx,activeStudy(),f)){ctx.strokeStyle="#c8a8ff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke()}}
    else{ctx.fillStyle=f.kind==="muzzle"?"#fff08b":"#fff";ctx.fillRect(x-4,f.y-3,8,6)}
  }
  for(const f of g.impact.particles){if(f.x<g.camera-8||f.x>g.camera+view.width+8)continue;ctx.globalAlpha=Math.min(1,f.life/.1);ctx.fillStyle=f.color;ctx.fillRect(Math.round(f.x),Math.round(f.y),f.size,f.flame?f.size+2:f.size)}ctx.globalAlpha=1;
}
function drawHitEffect(f,rays){
  const a=f.life/f.max,progress=1-a,angle=Math.atan2(f.vy,f.vx),burn=f.type==="flame";
  if(drawStudyEffect(ctx,activeStudy(),studyEffectWeapon(f),progress,f.x,f.y))return;
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
  ctx.save();ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.fillStyle="#020911df";ctx.fillRect(106,59,144,13);ctx.fillStyle="#ffe05c";ctx.fillText(`${text} ×${Math.min(999,a.chainCount)}`,178,68);ctx.restore();
}
function drawHud(g){
  drawCombatHud(ctx,g,activeEquipment(),weapon,(w,x,y,size)=>{if(!drawStudyIcon(ctx,activeStudy(),w.id,x,y,size,size))ctx.drawImage(images.weapons,w.assetIndex*32,0,32,32,x,y,size,size)},formatTime(g.time).slice(0,5));
  const boss=g.enemies.find(e=>isBoss(e)&&!e.dead),core=boss?.type==='queen'?weakCore(boss):boss?.type==='leviathan'?coastalWeakCore(boss):null;
  drawBossHud(ctx,boss,core);if(core){const point=worldToScreen(core,g.camera,view.zoom);point.x+=view.renderOffset;point.y+=view.renderOffset;drawCoreMarker(ctx,point,core,view.zoom,(boss.coreHitUntil??0)-g.impact.clock)}
  if(g.areaTimer>0){ctx.save();ctx.fillStyle='#020611c9';ctx.fillRect(51,77,218,17);ctx.fillStyle=g.bossStarted?'#ffab9d':'#ffe59b';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(g.areaText,160,89);ctx.restore()}
}

function loop(ts){
  const focused=document.hasFocus?.()??true,frameActive=!document.hidden&&focused&&state==='play'&&!game?.player.dead,frameReason=document.hidden?'タブ非表示':!focused?'ブラウザにフォーカスがありません':'LAB・ポーズ操作';
  const begin=DEBUG?performance.now():0,dt=Math.min(.1,(ts-last)/1000||0);last=ts;acc+=dt;
  while(acc>=1/60){update(1/60);acc-=1/60}
  if(profiler?.running&&game&&state==="play")fillBenchmarkPopulation();
  const updateEnd=DEBUG?performance.now():0;draw();const drawEnd=DEBUG?performance.now():0;
  if(game?.lab){
    sampleCombatResources(game);
    const counts={enemies:game.liveEnemies,shots:game.shots.length+game.enemyShots.length,effects:game.effects.length+game.impact.particles.length},active=frameActive;
    if(mobilePlaytest?.active){
      const was=mobilePlaytest.run.status;
      const endFocused=document.hasFocus?.()??true;
      mobilePlaytest.record(ts,updateEnd-begin,drawEnd-updateEnd,counts,active&&!document.hidden&&endFocused&&state==='play'&&!game.player.dead&&!game.clear,game.player.dead?'GAME OVER':game.clear?'ミッション／QA終了':document.hidden?'タブ非表示':!endFocused?'フォーカス喪失':frameReason);
      if(ts>=mobilePublishAt||mobilePlaytest.run.status!==was){mobilePublishAt=ts+500;syncMobileUI()}
    }
    if(game.lab.run?.outcome==='RUNNING')game.lab.run.profile.record(ts,updateEnd-begin,drawEnd-updateEnd,counts,active,frameReason);
    if(profiler?.running)game.lab.benchmarkPerformance?.record(ts,updateEnd-begin,drawEnd-updateEnd,counts,active,frameReason);
  }
  if(game?.lab&&liveProfiler){const result=liveProfiler.record(ts,updateEnd-begin,drawEnd-updateEnd,frameActive,frameReason);if(result&&game.lab.showFps)publishLabPerformance(result)}
  if(profiler?.running&&game){profiler.record(ts,performance.now()-begin,game.liveEnemies,frameActive,frameReason);if(profiler.result){const clean=game.lab?.benchmarkPerformance?.finish(),result={...profiler.result,destructionLevel:impactLevel(game).id,acceptedPerformance:clean,rawIntervalsIncludeInterruptions:false};canvas.dataset.benchmark=JSON.stringify(result);if(clean){labBenchmarkHistory.push({limit:result.limit,missionId:game.missionId,class:game.lab.preset,weapons:[...game.lab.equipped],density:game.density,destructionLevel:result.destructionLevel,validationMode:'C',performance:clean});if(labBenchmarkHistory.length>12)labBenchmarkHistory.shift()}document.querySelector("#qaResult").textContent=`${clean?.statusLabel??'有効サンプル不足'} / LEVEL ${result.destructionLevel} / ${result.limit}: ${clean?.fps?.toFixed(1)??'計測不足'} FPS（中断除外）/ p95 FRAME ${clean?.p95FrameMs??'—'}ms / UPDATE ${clean?.updateCpuMs?.toFixed(2)??'—'}ms DRAW ${clean?.drawCpuMs?.toFixed(2)??'—'}ms / 中断 ${clean?.excludedInterruptions??0}`;input.fire=false}}
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
  game.lab.benchmarkPerformance=new RunProfiler();
  delete canvas.dataset.benchmark;document.querySelector("#qaResult").textContent=`ウォームアップ / ${game.enemyLimit}体：前景で連続6秒。中断時は再計測`;
}

loadAssets().catch(()=>{document.querySelector("#screenTitle h1").textContent="ASSET LOAD ERROR"});
// Do not block the existing fallback art / game startup on optional new images.
loadReleaseArt();
renderWeaponGrid();document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;requestAnimationFrame(loop);

// Test/QA hooks intentionally read-only except the explicit debug commands.
window.__PDF_GAME__={version:VERSION,getState:()=>({state,time:game?.time||0,score:game?.score||0,playerHp:game?.player.hp??null,enemies:game?.enemies.length||0,boss:!!game?.bossStarted,unlocked:[...save.unlocked]}),start:startMission,spawnBoss:()=>{if(game&&!game.bossStarted){game.player.x=4200;startBoss()}},complete:()=>game&&completeMission()};

function archiveLabRun(){
  const run=game?.lab?.run;if(!run||run.archived)return;
  if(run.outcome==='RUNNING')run.outcome='ABORTED';run.archived=true;labRunHistory.push(run.snapshot(game));if(labRunHistory.length>20)labRunHistory.shift();
}
function pauseLabMeasurement(reason=document.hidden?'タブ非表示':'LAB・ポーズ操作'){mobilePlaytest?.interrupt(reason);liveProfiler?.pause(reason);game?.lab?.run?.profile.pause(reason);game?.lab?.benchmarkPerformance?.pause(reason)}
function startLabCheckpoint(bossMission=null,checkpointId=null){
  if(!DEBUG||!game?.lab||!['lab','gameover'].includes(state))return false;
  const previous=game.lab,cp=checkpointId?LAB_CHECKPOINTS.find(c=>c.id===checkpointId):findCheckpoint(bossMission??previous.stageMission,bossMission?4:previous.stageArea,previous.stageRoute,!!bossMission);
  let mode;try{if(!cp)throw new Error('開始地点を選択してください');mode=validationClass(previous.validationMode,previous,save);if(cp.boss.state==='active'&&mode==='A')throw new Error('ボス戦はB / C / Dを選択してください')}catch(error){document.querySelector('#labStageStatus').textContent=error.message;return false}
  const settings={...previous.settings},equipped=[...previous.equipped],preserved={...previous,settings,equipped};delete preserved.run;delete preserved.benchmarkPerformance;
  startMission(cp.missionId,true);game.lab={...createLabState(equipped,settings),...preserved,terrain:cp.missionId,stageMission:cp.missionId,stageArea:cp.areaIndex,cameraMode:cp.camera.mode};
  const g=game;g.density=previous.stageDensity;g.enemyLimit=DENSITY_MODES[g.density].limit;g.director=cp.missionId==='M03'?new SpawnDirector(g.density,M03.encounters):cp.missionId==='M02'?new SpawnDirector(g.density,M02.encounters):new SpawnDirector(g.density);
  g.director.progress=cp.x;g.director.midbossSpawned=cp.progression.midbossCleared;g.director.stopped=mode==='A';
  for(const entry of g.director.entries)if(entry.definition.x<cp.progression.completedBeforeX||entry.definition.midbossOnly&&cp.progression.midbossCleared){entry.done=true;entry.spawned=entry.total;entry.wait=0}
  let write=0;for(const e of g.enemies){const remove=e.x<cp.nests.destroyedBeforeX||mode==='A'&&e.type!=='barrier';if(remove){if(e.platform)e.platform.active=false}else g.enemies[write++]=e}g.enemies.length=write;g.liveEnemies=g.enemies.length;g.liveMobs=g.enemies.filter(isMob).length;
  g.items=g.items.filter(it=>it.x>=cp.x);configureLabPlayer();Object.assign(g.player,{x:cp.x,y:cp.y,vx:0,vy:0,onGround:true,dead:false,invuln:0,shotCd:0,switchCd:0,face:1});
  g.area=cp.areaIndex;g.time=g.score=g.kills=g.crates=0;g.areaText=`${mode} QA / ${cp.missionId} ${cp.areaId} ${cp.route}`;g.areaTimer=3;
  if(cp.boss.state==='active'){startBoss();for(const e of g.enemies)if(isBoss(e))Object.assign(e,{hp:e.maxHp,timer:0,phase:'move',actionIndex:0,actionWait:1.5,chargeTime:0,vx:0,vy:0})}
  if(g.coast){g.coast.safeX=cp.x;g.coast.safeY=cp.y;if(cp.boss.state==='active'){const boss=g.enemies.find(e=>e.type==='leviathan');if(boss)resetCoastalBossPhase(boss,previous.bossPhase)}}
  g.battleCamera=createBattleCamera(g.player);g.battleCamera.x=cp.camera.x;g.battleCamera.zoom=g.battleCamera.targetZoom=cp.camera.zoom;if(g.bossStarted)updateBattleCamera(g.battleCamera,g.player,g.enemies,g,1);
  g.lab.run=new MissionLabRun(g,cp,mode);g.lab.run.gameplayQA=!!g.lab.gameplayQA;g.lab.run.bossStartPhase=cp.missionId==='M03'&&cp.boss.state==='active'?g.lab.bossPhase:null;g.grid.rebuild(g.enemies);acc=0;resetInput();liveProfiler.reset();syncCameraView();syncLabUI();
  canvas.dataset.checkpoint=cp.id;canvas.dataset.validationMode=mode;document.querySelector('#labStageStatus').textContent=`${mode} ${VALIDATION_MODES[mode]} / ${cp.id} / NO SAVE`;
  show('play');canvas.focus();return true;
}
function finishLabRun(outcome){
  const run=game?.lab?.run;if(!run||run.outcome!=='RUNNING')return;
  run.outcome=outcome;run.elapsed=game.time;run.resultAt=game.time;run.finalHp=game.player.hp;game.clear=true;game.director.stopped=true;resetInput();clearArsenal(game);pauseLabMeasurement();
  document.querySelector('#labStageStatus').textContent=`RESULT: ${run.mode} ${VALIDATION_MODES[run.mode]} / ${outcome} / 通常報酬なし`;
  show('lab');switchLabTab('metrics');renderLabReport();document.querySelector('#labJSON').open=true;document.querySelector('#labRunReport').focus();document.querySelector('#labRunReport').scrollIntoView?.({block:'nearest'});
}
function labExport(){return {version:VERSION,mobile:mobileExport(),current:game?.lab?.run?.snapshot(game)??null,resources:game?.lab?sampleCombatResources(game):null,recentRuns:labRunHistory,benchmarks:labBenchmarkHistory,notice:'A/B/CはDの攻略成功ではありません。途中開始は全編攻略ではありません。通常セーブには保存しません。'}}
function renderLabReport(){
  const data=labExport(),run=data.current;document.querySelector('#labRunSummary').textContent=run?`${run.validationMode} ${run.validationLabel} / ${run.coverage} / ${run.outcome}\n${run.missionId} ${run.areaId} ${run.route} / ${run.class} / ${run.weapons.join(' + ')}\nTIME ${run.elapsed.toFixed(2)}s / DAMAGE ${run.damageTaken.toFixed(1)} / KILL ${run.kills} / HP ${run.remainingHp.toFixed(1)}\nBOSS ${run.bossDefeatTime?.toFixed(2)??'—'}s / MAX ENEMY ${run.maxLiveEnemies} / 診断疑い ${run.diagnostics.length}\nFPS ${run.performance.fps?.toFixed(1)??'—'} / p95 FRAME ${run.performance.p95FrameMs??'—'}ms / UPDATE ${run.performance.updateCpuMs?.toFixed(2)??'—'}ms DRAW ${run.performance.drawCpuMs?.toFixed(2)??'—'}ms`:'エリア開始後に攻略データを収集します。';
  document.querySelector('#labRunReport').value=JSON.stringify(data,null,2);
  document.querySelector('#labBenchmarkSummary').textContent=labBenchmarkHistory.length?labBenchmarkHistory.map(b=>`${b.limit}体: ${b.performance.fps?.toFixed(1)??'—'} FPS / p95 ${b.performance.p95FrameMs??'—'}ms / CPU U${b.performance.updateCpuMs?.toFixed(2)??'—'} D${b.performance.drawCpuMs?.toFixed(2)??'—'}ms / 中断${b.performance.excludedInterruptions}`).join('\n'):'BENCH 50 / 100 / 200の有効区間をここで比較します。';
}
async function copyLabReport(){
  if(!game?.lab||state!=='lab')return;renderLabReport();const output=document.querySelector('#labRunReport'),status=document.querySelector('#labCopyStatus');
  try{if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(output.value);status.textContent='JSONをコピーしました（通常セーブなし）';setLabMessage(status.textContent)}catch{switchLabTab('metrics');document.querySelector('#labJSON').open=true;output.focus();output.select?.();status.textContent='自動コピーできません。下のJSONを選択して手動コピーしてください。';setLabMessage(status.textContent)}
}

function startLab(openPanel=true,terrain='M01'){
  if(!DEBUG)return false;if(!game?.lab){artPreview.reset();previewRenderScale=1;labTab='stage';labTabScroll={}}labTerrainChoice=null;startMission(terrain,true);
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
  syncMobileUI();
  syncClassControls();
  applyPreviewResolution();document.querySelector('#pauseArtControls').hidden=!DEBUG||!game?.lab;
  if(artPreview)for(const prefix of ['lab','pause']){
    document.querySelector(`#${prefix}ArtStyle`).value=artPreview.requested;
    document.querySelector(`#${prefix}RenderScale`).value=String(game?.lab?previewRenderScale:1);
    document.querySelector(`#${prefix}ArtStatus`).textContent=artPreview.loading?'アート読み込み中（現在の表示を維持）':artPreview.error||`${activeStudy()?artStyleLabel(artPreview.style):'ORIGINAL'} / ${canvas.width}×${canvas.height} / NO SAVE${activeStudy()?.fallbacks?.length?` / 代替素材: ${activeStudy().fallbacks.join(', ')}`:''}`;
  }
  document.querySelector('#labGameoverReport').hidden=!game?.lab?.run||state!=='gameover';
  document.querySelector("#labToggle").hidden=!game?.lab||state!=="play";
  document.querySelector("#labLevelBadge").hidden=!game?.lab||state!=="play";
  document.querySelector("#labPerformance").hidden=!game?.lab?.showFps||state!=="play";
  if(!game?.lab)return;const lab=game.lab;
  for(let slot=0;slot<2;slot++){const button=document.querySelector(`#labWeaponSlot${slot+1}`),w=weapon(lab.equipped[slot]);button.textContent=`SLOT ${slot+1}: ${w.id} ${w.name}`;button.setAttribute("aria-expanded",String(labWeaponPickerOpen&&labEditingSlot===slot))}
  syncLabStageOptions();
  const values={labSlot:String(game.player.weaponSlot),labPreset:lab.preset,labTerrain:labTerrainChoice??lab.terrain,labEnemy:lab.enemy,labCount:String(lab.count),labPlacement:lab.placement,labCamera:lab.cameraMode,labZoom:String(lab.fixedZoom),labStageMission:lab.stageMission,labStageArea:String(lab.stageArea),labStageRoute:lab.stageRoute,labValidation:lab.validationMode,labStageDensity:lab.stageDensity,labBossPhase:String(lab.bossPhase)};
  for(const [id,value] of Object.entries(values))document.querySelector(`#${id}`).value=value;
  document.querySelector("#labInvincible").checked=lab.invincible;document.querySelector("#labFps").checked=lab.showFps;
  document.querySelector("#labDestruction").value=String(normalizeDestructionLevel(lab.settings.destructionLevel));document.querySelector("#labShake").checked=lab.settings.shake;
  document.querySelector("#labLevelBadge").textContent=`${lab.run?`${lab.run.mode} QA · `:''}LEVEL ${impactLevel(game).id} · ${impactLevel(game).name}`;
  document.querySelector("#labZoom").disabled=lab.cameraMode!=="FIXED";
  document.querySelector("#labCount").disabled=['beetle','boss','queen','leviathan','nest'].includes(lab.enemy);
  document.querySelector("#labBlast").disabled=!["rocket","grenade"].includes(weapon(activeEquipment()[game.player.weaponSlot]).type);
  document.querySelector("#labZoomValue").textContent=`${view.zoom.toFixed(2)}× / FIXED ${lab.fixedZoom.toFixed(2)}×`;
  renderLabReport();syncLabWorkbench();
}
function setLabMessage(text){labMessage=text;const el=document.querySelector('#labNotice');el.textContent=text;el.title=text;syncLabWorkbench()}
function switchLabTab(name,focus=false){
  if(!game?.lab||state!=='lab'||!LAB_TABS.includes(name)||labWeaponPickerOpen)return false;
  const content=document.querySelector('#labContent');labTabScroll[labTab]=content.scrollTop||0;labTab=name;resetInput();syncLabWorkbench();content.scrollTop=labTabScroll[name]||0;
  if(focus)document.querySelector(`#labTab-${name}`).focus();return true;
}
function syncLabWorkbench(){
  if(!game?.lab)return;const lab=game.lab;
  document.querySelector('#labTerrain').value=labTerrainChoice??lab.terrain;
  for(const name of LAB_TABS){const active=labTab===name,button=document.querySelector(`#labTab-${name}`);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.querySelector(`#labPanel-${name}`).hidden=!active}
  document.querySelector('#labStartButton').hidden=labTab!=='stage';
  const effectiveQA=['A','D'].includes(lab.validationMode)?lab.validationMode:lab.invincible?'C':'B';
  const locationLabel=lab.run?`AREA${String((game.area??0)+1).padStart(2,'0')} QA:${lab.run.mode}`:lab.benchmarkPerformance?`BENCH${profiler?.running?'計測中':'終了'}`:'自由配置';
  const rows={labCurrentSummary:`現在 ${game.missionId} / ${locationLabel} / ${lab.preset} / ${game.density}（上限${game.enemyLimit}）`,labVisualSummary:`${activeStudy()?artStyleLabel(artPreview.style):'ORIGINAL'} / ${canvas.width}×${canvas.height} / CAMERA ${lab.cameraMode} ${view.zoom.toFixed(2)}×`,labNextSummary:`次の開始 ${lab.stageMission} / AREA${String(lab.stageArea+1).padStart(2,'0')}${lab.stageMission==='M02'&&lab.stageArea===2?lab.stageRoute==='UPPER'?' 上':' 下':''} / ${lab.stageDensity} / QA:${lab.validationMode}${effectiveQA!==lab.validationMode?`→${effectiveQA}`:''}`};
  for(const [id,text] of Object.entries(rows)){const el=document.querySelector(`#${id}`);el.textContent=text;el.title=text}
  document.querySelector('#labNextSummary').hidden=labTab!=='stage';
  const metrics=liveProfiler?.result??liveProfiler?.lastValid;
  document.querySelector('#labMetrics').textContent=`${metrics?`直近の有効区間：FPS ${metrics.fps.toFixed(1)} / 平均${metrics.frameMs.toFixed(1)}ms / p95 ${metrics.p95FrameMs.toFixed(1)}ms / 最大${metrics.maxFrameMs.toFixed(1)}ms\nCPU 更新${metrics.updateMs.toFixed(2)}ms / 描画${metrics.drawMs.toFixed(2)}ms / 有効${metrics.samples}・中断除外${metrics.excluded}区間`:'FPS / CPU：有効な前景プレイ区間は未計測（または中断）'}\n敵${game.liveEnemies} / 弾${game.shots.length+game.enemyShots.length} / FX${game.effects.length+game.impact.particles.length} / 死亡${game.impact.corpses} / ${view.zoom.toFixed(2)}×\n粒子${game.impact.particles.length}/${reducedImpact(game)?IMPACT.reducedParticles:IMPACT.maxParticles} / 揺れ${game.shake.toFixed(1)} / 音${audioBus.voices.size}/${AUDIO_LIMITS.voices} / 音省略${audioBus.dropped} / HIT省略${game.impact.feedbackDropped}`;
  const measurement=lab.benchmarkPerformance?.snapshot()??liveProfiler.state();document.querySelector('#labMeasureStatus').textContent=`${measurement.statusLabel} / ${measurement.reason} / 有効${measurement.samples} / 保留${measurement.pendingSamples??0} / 短区間破棄${measurement.discardedShortSamples??0} / 準備除外${measurement.warmupExcluded??0} / 中断除外${measurement.excludedInterruptions??measurement.excluded??0}`;
  const damage=game.lab.run?.snapshot(game)?.weaponDamage;
  document.querySelector('#labDamageSummary').textContent=`武器別ダメージ：${damage&&Object.keys(damage).length?Object.entries(damage).map(([id,n])=>`${id} ${Number(n).toFixed(1)}`).join(' / '):'未記録'}`;
  const preset=document.querySelector('#labUIPreset').value||'art';document.querySelector('#labUIPresetDescription').textContent=LAB_UI_PRESETS[preset]||'';
  const notice=artPreview?.loading?'アート読み込み中。現在の描画を維持しています。':artPreview?.error||labMessage;document.querySelector('#labNotice').textContent=notice;document.querySelector('#labNotice').title=notice;
}
function applyLabTerrain(force=false){
  if(!game?.lab||state!=='lab')return false;
  const terrain=labTerrainChoice??game.lab.terrain;labTerrainChoice=null;
  if(force||terrain!==game.lab.terrain)changeLabSetting({id:'labTerrain',value:terrain});
  syncLabUI();return true;
}
function runLabStart(mission=null){
  const ok=startLabCheckpoint(mission);if(ok)labTerrainChoice=null;
  setLabMessage(ok?'指定地点から開始しました。HP・位置・敵・弾・時間等を初期化。':`開始不可：${document.querySelector('#labStageStatus').textContent}`);return ok;
}
function applyLabUIPreset(){
  if(!game?.lab||state!=='lab')return false;
  const preset=document.querySelector('#labUIPreset').value;if(!Object.hasOwn(LAB_UI_PRESETS,preset))return false;
  if(preset==='art'){changeLabSetting({id:'labCamera',value:'FIXED'});changeLabSetting({id:'labZoom',value:'.5'});changeLabSetting({id:'labShake',checked:false});switchLabTab('visual')}
  if(preset==='boss'){changeLabSetting({id:'labStageArea',value:'4'});switchLabTab('stage')}
  if(preset==='mass'){for(const [id,value] of [['labEnemy','crawler'],['labCount','200'],['labPlacement','dense']])changeLabSetting({id,value});switchLabTab('enemies')}
  if(preset==='gameplay'){
    const classId=Object.hasOwn(PLAYER_CLASSES,game.lab.preset)?game.lab.preset:'RANGER';
    for(const [id,value] of [['labPreset',classId],['labWeapon1','A-01'],['labWeapon2','S-02'],['labSlot','0'],['labStageDensity','STANDARD'],['labValidation','B']])changeLabSetting({id,value});
    game.lab.gameplayQA=true;switchLabTab('stage');
  }
  if(preset==='normal'){changeLabSetting({id:'labValidation',value:'D'});switchLabTab('stage')}
  setLabMessage(`適用済み：${LAB_UI_PRESETS[preset]}`);return true;
}
function handleLabKey(e){
  if(e.key==='Escape'||e.key==='F2'){e.preventDefault();closeLabPanel();return}
  const target=e.target??document.activeElement,tab=target?.dataset?.labTab;
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const i=LAB_TABS.indexOf(tab),n=e.key==='Home'?0:e.key==='End'?4:(i+(e.key==='ArrowRight'?1:4))%5;switchLabTab(LAB_TABS[n],true);return}
  if(e.key!=='Tab')return;
  const elements=[...document.querySelectorAll('#screenLab button, #screenLab select, #screenLab input, #screenLab textarea, #screenLab summary')].filter(el=>!el.disabled&&el.tabIndex!==-1&&!el.closest?.('[hidden]')&&(!el.getClientRects||el.getClientRects().length));
  const first=elements[0],last=elements.at(-1);if(!first)return;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}
function syncLabStageOptions(){
  const lab=game.lab,select=document.querySelector('#labStageArea');if(select.dataset.mission!==lab.stageMission){select.replaceChildren();const areas=lab.stageMission==='M03'?M03.areas:lab.stageMission==='M02'?M02.areas:MISSION_AREAS;areas.forEach((a,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`AREA ${String(i+1).padStart(2,'0')} ${a.name}`;select.append(option)});select.dataset.mission=lab.stageMission}
  document.querySelector('#labStageRoute').disabled=lab.stageMission!=='M02'||lab.stageArea!==2;
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
    if(activeStudy()?._u?.icons){
      button.className+=' has-art';
      const icon=document.createElement('canvas');icon.width=icon.height=32;icon.className='lab-weapon-art';icon.setAttribute('aria-hidden','true');
      const c=icon.getContext('2d');c.imageSmoothingEnabled=false;drawStudyIcon(c,activeStudy(),w.id,0,0,32,32);button.append(icon);
    }
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
function openLabPanel(){if(!game?.lab||!['play','gameover'].includes(state))return;pauseLabMeasurement();resetInput();if(profiler)profiler.running=false;show("lab");document.querySelector(`#labTab-${labTab}`).focus()}
function closeLabPanel(){if(!game?.lab||state!=="lab")return;resetInput();acc=0;liveProfiler.reset();if(game.lab.run?.outcome==='GAME_OVER'){show('gameover');return}document.querySelector("#labPerformance").textContent="FPS: 計測中…";show("play");canvas.focus()}
function changeLabSetting(target){
  const lab=game?.lab;if(!lab||state!=="lab")return;
  const value=target.value;
  if(target.id==='labBossPhase'&&['1','2','3'].includes(value))lab.bossPhase=Number(value);
  if(target.id==='labStageMission'&&['M01','M02','M03'].includes(value))lab.stageMission=value;
  if(target.id==='labStageArea'&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<5)lab.stageArea=Number(value);
  if(target.id==='labStageRoute'&&['LOWER','UPPER'].includes(value))lab.stageRoute=value;
  if(target.id==='labValidation'&&Object.hasOwn(VALIDATION_MODES,value)){lab.validationMode=value;if(value!=='A')lab.invincible=value==='C'}
  if(target.id==='labStageDensity'&&Object.hasOwn(DENSITY_MODES,value))lab.stageDensity=value;
  if(target.id==='labTerrain'&&['M01','M02','M03'].includes(value)){
    const previous={...lab,settings:{...lab.settings},equipped:[...lab.equipped]};delete previous.run;delete previous.benchmarkPerformance;startLab(true,value);Object.assign(game.lab,previous,{terrain:value});configureLabPlayer();syncLabUI();return;
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
  if(lab.run&&['labWeapon1','labWeapon2','labInvincible','labPreset','labDestruction','labCamera','labZoom','labValidation'].includes(target.id))lab.run.change(target.id,game);
  if(lab.run&&target.id==='labInvincible')lab.run.mode=lab.run.mode==='A'?'A':lab.invincible?'C':'B';
  if(lab.cameraMode==="FIXED")fixedLabCamera(game.battleCamera,game.player,lab.fixedZoom);
  syncCameraView();syncLabUI();
}
function clearLabEnemies(){
  if(!game?.lab)return;if(game.lab.run){archiveLabRun();delete game.lab.run;game.clear=false;game.director.stopped=true}game.enemies.length=game.shots.length=game.enemyShots.length=game.effects.length=game.items.length=0;
  game.liveEnemies=game.liveMobs=0;game.bossStarted=game.midbossAlive=false;game.attacks=new AttackDirector();game.grid.rebuild(game.enemies);
  if(game.coast)game.coast=createCoastalState();game.impact=createImpactState();game.shake=0;clearArsenal(game);syncRemoteControl();
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
  if(['shorecrab','skyray','siegebeetle','leviathan'].includes(game.lab.enemy)&&game.lab.terrain!=='M03')changeLabSetting({id:'labTerrain',value:'M03'});
  if(['nest','queen'].includes(game.lab.enemy)&&game.lab.terrain!=='M02')changeLabSetting({id:'labTerrain',value:'M02'});
  const lab=game.lab;clearLabEnemies();
  for(const timer of missionTimers)clearTimeout(timer);missionTimers.clear();deferredMissionCallbacks.length=0;
  if(profiler)profiler.running=false;game.density="MASSIVE";game.enemyLimit=Math.max(100,lab.count);
  configureLabPlayer();game.player.x=lab.enemy==='leviathan'?5500:lab.enemy==='queen'?M02.bossX:lab.enemy==="boss"?4100:lab.anchorX;game.player.y=lab.anchorY;game.player.dead=false;game.player.invuln=0;game.player.onGround=true;
  game.nextEnemyId=1;game.time=game.kills=game.score=game.crates=0;game.player.shotCd=game.player.switchCd=0;resetInput();
  const leader=['boss','beetle','queen','leviathan','nest'].includes(lab.enemy),count=leader?1:lab.count;
  game.area=0;game.areaTimer=0;game.areaText='';delete canvas.dataset.checkpoint;delete canvas.dataset.validationMode;if(game.coast){game.coast.safeX=game.player.x;game.coast.safeY=game.player.y}
  for(let i=0;i<count;i++){const pos=lab.enemy==='leviathan'?{x:M03.bossSpawnX,y:48}:lab.enemy==='queen'?{x:M02.bossSpawnX,y:52}:lab.enemy==="boss"?{x:4420,y:WORLD.ground-58}:labSpawnPosition(game.director,lab.enemy,i,count,lab.placement,game);if(pos)spawnEnemy(lab.enemy,pos.x,pos.y)}
  game.bossStarted=lab.enemy==="boss"||lab.enemy==='queen'||lab.enemy==='leviathan';game.battleCamera=createBattleCamera(game.player);
  if(lab.cameraMode==="FIXED")fixedLabCamera(game.battleCamera,game.player,lab.fixedZoom);else updateBattleCamera(game.battleCamera,game.player,game.enemies,game,1);
  syncCameraView();syncLabUI();document.querySelector("#labSpawnResult").textContent=`${game.liveEnemies}体を再配置（プレイヤーも開始位置へ復帰）`;
}
function mobileExport(){return mobilePlaytest?{current:mobilePlaytest.snapshot(),results:[...mobilePlaytest.history],qa:JSON.parse(JSON.stringify(mobileQA)),environment:mobileEnvironment,memo:mobileMemo,normalProgressSaved:false}:null}
function selectedMobileResult(){return mobilePlaytest?.result(mobileSelectedId)??mobilePlaytest?.snapshot()??null}
function startMobileMeasurement(){
  if(!DEBUG||!game?.lab||state!=='lab'||labWeaponPickerOpen)return false;
  if(game.player.dead||game.clear){setLabMessage('計測不可：ステージ指定開始／再配置で、動ける戦闘を準備してください。');return false}
  mobilePlaytest.interrupt('新しい計測を開始');
  const scenario=document.querySelector('#mobileScenario').value||'CURRENT';
  if(!['CURRENT','50','100','200'].includes(scenario))return false;
  if(scenario!=='CURRENT'){
    const lab=game.lab;lab.enemy=lab.terrain==='M03'?'shorecrab':lab.terrain==='M02'?'worm':'crawler';lab.count=Number(scenario);spawnLabEnemies();
  }
  const p=game.player;
  const result=mobilePlaytest.start({version:VERSION,environment:mobileEnvironment,missionId:game.missionId,area:Math.max(1,game.area+1),playerClass:game.lab.preset,
    weapons:[...activeEquipment()],density:game.density,enemyLimit:game.enemyLimit,initialEnemies:game.liveEnemies,scenario,artStyle:activeStudy()?artStyleLabel(artPreview.style):'ORIGINAL',
    resolution:`${canvas.width}×${canvas.height}`,cameraMode:game.lab.cameraMode,cameraZoom:view.zoom,invincible:game.lab.invincible,
    validationMode:game.lab.run?.mode??'自由配置',destructionLevel:impactLevel(game).id,viewport:`${window.innerWidth??0}×${window.innerHeight}`,hp:p.hp});
  mobileSelectedId=result.id;mobilePublishAt=0;profiler.running=false;delete game.lab.benchmarkPerformance;closeLabPanel();syncMobileUI();return true;
}
function handleMobileField(target){
  if(!DEBUG||!game?.lab||state!=='lab'||labWeaponPickerOpen||!target.id?.startsWith('mobile'))return false;
  if(target.id==='mobileEnvironment')mobileEnvironment=String(target.value).slice(0,120);
  else if(target.id==='mobileMemo')mobileMemo=String(target.value).slice(0,500);
  else if(target.id==='mobileResult')mobileSelectedId=Number(target.value);
  else if(target.id.startsWith('mobileQA-'))setMobileQA(mobileQA,target.id.slice(9),target.value);
  else if(target.id.startsWith('mobileNote-'))setMobileQA(mobileQA,target.id.slice(11),target.value,true);
  else if(target.id!=='mobileScenario')return false;
  if(target.id.startsWith('mobileQA-')){const id=target.id.slice(9);document.querySelector(`#mobileNote-${id}`).disabled=mobileQA[id].status!=='NG'}
  if(target.id==='mobileResult')syncMobileUI();return true;
}
document.addEventListener('input',e=>handleMobileField(e.target));
function syncMobileUI(){
  const badge=document.querySelector('#mobileMeasureBadge');if(!DEBUG){badge.hidden=true;return}
  const current=mobilePlaytest.snapshot(),inLab=!!game?.lab;
  badge.hidden=!inLab||state!=='play'||!current;
  if(current){const remaining=Math.ceil(current.remainingMs/1000);badge.textContent=current.status==='RECORDING'?`実機計測 あと${remaining}秒`:current.status==='WARMUP'?'実機計測 準備1秒':current.status==='ARMED'?'実機計測 ゲーム更新待ち':`${current.statusLabel} → LABで確認`}
  if(!inLab)return;
  document.querySelector('#mobileMeasureStatus').textContent=current?`${current.statusLabel} / あと${Math.ceil(current.remainingMs/1000)}秒 / ${current.samples}フレーム / ${current.reason}`:'未計測：条件を設定し「30秒計測開始」を押してください。';
  const rows=[...mobilePlaytest.history];if(current&&!rows.some(r=>r.id===current.id))rows.push(current);const visible=rows.slice(-8),select=document.querySelector('#mobileResult');
  const signature=visible.map(r=>`${r.id}:${r.status}`).join(',');
  if(select.dataset.results!==signature){select.replaceChildren();if(!visible.length){const option=document.createElement('option');option.value='';option.textContent='未計測';select.append(option)}for(const r of visible){const option=document.createElement('option');option.value=String(r.id);option.textContent=`#${r.id} ${r.metadata.missionId} / ${r.statusLabel}`;select.append(option)}select.dataset.results=signature}
  select.disabled=visible.length===0;if(!visible.some(r=>r.id===mobileSelectedId))mobileSelectedId=visible.at(-1)?.id??null;select.value=mobileSelectedId===null?'':String(mobileSelectedId);
  const r=selectedMobileResult(),fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'未計測';
  document.querySelector('#mobileResultSummary').textContent=r?`${r.statusLabel}（${r.valid?'有効':'未完了／部分記録'}） / ${r.reason}\n${r.metadata.missionId} AREA${r.metadata.area} / ${r.metadata.playerClass} / ${r.metadata.weapons.join(' + ')}\n有効${fmt(r.acceptedDurationMs/1000,3)}秒 / ${r.samples}フレーム / 中断${r.interruptions}\n観測RAF FPS ${fmt(r.observedRafFps)} / 最低1秒 ${fmt(r.minimumOneSecondFps)}\nP50 ${fmt(r.p50FrameMs,2)} / P95 ${fmt(r.p95FrameMs,2)} / P99 ${fmt(r.p99FrameMs,2)}ms\nCPU 更新${fmt(r.updateCpuMs,2)} / 描画${fmt(r.drawCpuMs,2)}ms\n最大 敵${r.maxEnemies} / 弾${r.maxShots} / FX${r.maxEffects}`:'未計測の値は推定しません。';
}
async function copyMobileResult(action){
  if(!DEBUG||!game?.lab||state!=='lab'||labWeaponPickerOpen)return false;
  const text=action==='mobile-json'?JSON.stringify(mobileExport(),null,2):action==='mobile-qa-copy'?mobileChecklistText(mobileQA,mobileEnvironment,mobileMemo,VERSION):mobileReportText(selectedMobileResult(),mobileMemo);
  const output=document.querySelector('#mobileCopyText'),status=document.querySelector('#mobileCopyStatus');output.value=text;
  try{if(!navigator.clipboard?.writeText)throw new Error('unavailable');await navigator.clipboard.writeText(text);status.textContent='コピーしました。通常セーブには保存していません。';return true}
  catch{document.querySelector('#mobileCopyBox').open=true;output.focus();output.select?.();status.textContent='自動コピーできません。下のテキストを長押し・選択して手動コピーしてください。';return false}
}
function initMobileQAUI(){
  if(!DEBUG)return;const list=document.querySelector('#mobileQAList');
  for(const [id,label] of MOBILE_QA_ITEMS){const row=document.createElement('div');row.className='mobile-qa-row';row.innerHTML=`<label for="mobileQA-${id}">${id} ${label}<select id="mobileQA-${id}"><option>未確認</option><option>OK</option><option>NG</option></select></label><label for="mobileNote-${id}">NGメモ<textarea id="mobileNote-${id}" rows="2" maxlength="200" placeholder="NGの状況を短く記入" disabled></textarea></label>`;list.append(row)}
}
initMobileQAUI();
function sampleCombatResources(g){
  if(!g.lab)return null;
  const audio=audioBus.snapshot(),current={effects:g.effects.length,particles:g.impact.particles.length,shake:g.shake,voices:audio.voices};
  const peaks=g.lab.resourcePeaks??={effects:0,particles:0,shake:0,voices:0};
  for(const key of Object.keys(current))peaks[key]=Math.max(peaks[key],current[key]);
  return {current,peaks:{...peaks},audio,feedbackDropped:g.impact.feedbackDropped};
}
function publishLabPerformance(result){
  if(!Number.isFinite(result.fps)){const output=document.querySelector("#labPerformance");output.textContent=`${result.statusLabel} / FPS —\n${result.reason}\n中断除外=${result.excluded} 有効サンプル=${result.samples}`;output.dataset.metrics=JSON.stringify(result);return}
  const g=game;const data={...result,particles:g.impact.particles.length,shake:g.shake,audio:audioBus.snapshot(),feedback:{...g.impact.feedbackCounts,dropped:g.impact.feedbackDropped},enemies:g.liveEnemies,shots:g.shots.length+g.enemyShots.length,effects:g.effects.length+g.impact.particles.length,corpses:g.impact.corpses,zoom:view.zoom,destructionLevel:impactLevel(g).id};
  document.querySelector("#labPerformance").textContent=`FPS ${data.fps.toFixed(1)} | FRAME ${data.frameMs.toFixed(1)}ms MAX ${data.maxFrameMs.toFixed(1)}ms\nCPU UPDATE ${data.updateMs.toFixed(2)}ms / DRAW ${data.drawMs.toFixed(2)}ms\nENEMY ${data.enemies} SHOT ${data.shots} FX ${data.effects} BODY ${data.corpses} ZOOM ${data.zoom.toFixed(2)}×\nN=${data.samples} 中断除外=${data.excluded}`;
  document.querySelector("#labPerformance").dataset.metrics=JSON.stringify(data);
}
if(DEBUG){
  document.querySelector("#testLabButton").hidden=false;
  document.querySelectorAll("[data-benchmark]").forEach(button=>button.addEventListener("click",()=>{if(game?.lab){setLabMessage('BENCH開始：M01・実験STANDARD・アサルト・自動射撃へ初期化。');startBenchmark(button.dataset.benchmark)}}));
}
