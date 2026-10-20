import {VERSION,SAVE_KEY,WORLD,VIEW,BATTLE_CAMERA,DENSITY_MODES,INVASION,MISSIONS,WEAPONS,ENEMY_TYPES,MISSION_AREAS,DEFAULT_SAVE,clamp,distance,sanitizeSave,pickReward,missionStatus,canPlayMission,recordMissionClear} from "./data.js";
import {worldToScreen,clientToScreen,viewBounds,aimTarget,createBattleCamera,updateBattleCamera} from "./camera.js";
import {SpawnDirector,SpatialGrid,AttackDirector,prepareSeparation,nearestEnemy,isMob,variation} from "./invasion.js";
import {FrameProfiler} from "./profiler.js";

const canvas=document.querySelector("#game"),ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;
const screens=[...document.querySelectorAll(".screen")],weaponGrid=document.querySelector("#weaponGrid");
const equipMessage=document.querySelector("#equipMessage"),touchControls=document.querySelector("#touchControls");
const gameShell=document.querySelector("#gameShell");
const images={};
const imageFiles={bg:"assets/backgrounds/city.png",player:"assets/sprites/player/player.png",enemies:"assets/sprites/enemies/enemies.png",boss:"assets/sprites/bosses/mother_crawler.png",weapons:"assets/sprites/weapons/weapon_icons.png",shots:"assets/sprites/weapons/projectiles.png",explosion:"assets/effects/explosion.png",items:"assets/sprites/ui/items.png",tiles:"assets/tiles/city_tiles.png"};
let save=loadSave(),state="title",last=0,acc=0,assetsReady=false,audio=null;
let game=null,selected=[...save.equipped],selectedMissionId="M01",returnState="play";
const missionTimers=new Set();
const deferredMissionCallbacks=[];
const DEBUG=new URLSearchParams(location.search).has("debug");
const profiler=DEBUG?new FrameProfiler():null;
const view={mode:"landscape",zoom:BATTLE_CAMERA.idleZoom,width:VIEW.canvasWidth/BATTLE_CAMERA.idleZoom};

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
function storeSave(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}}
// Keep the original storage key so v1 records migrate in place.
storeSave();
function loadAssets(){return Promise.all(Object.entries(imageFiles).map(([key,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=reject;im.src=src}))).then(()=>assetsReady=true)}
function show(name){if(name==="mission")renderMissionList();screens.forEach(s=>s.classList.toggle("is-active",s.id===`screen${name[0].toUpperCase()+name.slice(1)}`));state=name;gameShell.classList.toggle("is-playing",name==="play");touchControls.style.visibility=name==="play"?"visible":"hidden";canvas.dataset.gameState=name;canvas.setAttribute("aria-label",name==="play"?`ゲーム画面。${game.missionId} 市街地防衛線を進行中`:`${name}画面`)}
function scheduleMission(callback,delay){const current=game;const timer=setTimeout(()=>{missionTimers.delete(timer);if(game!==current)return;if(state==="confirm")deferredMissionCallbacks.push({current,callback});else callback()},delay);missionTimers.add(timer)}
function missionScreen(name){if(state==="confirm")returnState=name;else show(name)}
function discardMission(){for(const timer of missionTimers)clearTimeout(timer);missionTimers.clear();deferredMissionCallbacks.length=0;if(profiler)profiler.running=false;game=null;acc=0;resetInput();syncCameraView();delete canvas.dataset.playerX;delete canvas.dataset.playerHp;delete canvas.dataset.enemies;delete canvas.dataset.boss;delete canvas.dataset.density;delete canvas.dataset.enemyLimit}
function cancelTitle(){resetInput();show(returnState);for(const entry of deferredMissionCallbacks.splice(0))if(entry.current===game)entry.callback();if(state==="play")canvas.focus()}
function requestTitle(){
  if(state==="confirm")return;
  if(game&&!game.clear&&(state==="play"||state==="pause")){returnState=state;resetInput();show("confirm");document.querySelector('[data-action="cancel-title"]').focus();return}
  discardMission();show("title");document.querySelector('[data-action="start"]').focus();
}
function renderMissionList(){
  const list=document.querySelector("#missionList");list.replaceChildren();
  for(const mission of MISSIONS){const status=missionStatus(mission,save),button=document.createElement("button");button.className="mission-card";button.dataset.action="select-mission";button.dataset.mission=mission.id;button.dataset.status=status;button.disabled=!canPlayMission(mission.id,save);button.innerHTML=`<span>${mission.id}</span><strong>${mission.name}</strong><b class="mission-status">${status}</b><small>${mission.description}</small>`;list.append(button)}
}
function weapon(id){return WEAPONS.find(w=>w.id===id)}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*100)%100;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(2,"0")}`}

function initAudio(){if(audio||!save.settings.sound)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}
function tone(freq=.05,duration=.04,type="square",volume=.025){if(!save.settings.sound||profiler?.running)return;initAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(volume*save.settings.volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration)}

function renderWeaponGrid(){
  const densitySelect=document.querySelector("#densitySelect");if(densitySelect)densitySelect.value=save.settings.enemyDensity;
  weaponGrid.replaceChildren();
  WEAPONS.forEach((w,i)=>{const b=document.createElement("button");b.className=`weapon-card ${selected.includes(w.id)?"selected":""} ${save.unlocked.includes(w.id)?"":"locked"}`;b.disabled=!save.unlocked.includes(w.id);b.innerHTML=`<span class="weapon-pic" style="background-position:${i*-32}px 0"></span><span><strong>${w.id} ${w.name}</strong><small>DMG ${w.damage} / ${w.detail}</small></span>`;b.addEventListener("click",()=>{if(selected.includes(w.id)){if(selected.length>1)selected=selected.filter(x=>x!==w.id)}else{if(selected.length>=2)selected.shift();selected.push(w.id)}renderWeaponGrid();equipMessage.textContent=selected.length===2?`${selected.join(" / ")} を装備`:"武器を2つ選んでください"});weaponGrid.append(b)});
}

const input={left:false,right:false,jump:false,fire:false,switch:false,aimX:260,aimY:90,aimMode:"mouse",touchDx:1,touchDy:0};
function resetInput(){input.left=input.right=input.jump=input.fire=input.switch=false}
window.addEventListener("keydown",e=>{
  if(state==="confirm"){if(e.key==="Escape")cancelTitle();return}
  if(["ArrowLeft","ArrowRight","ArrowUp"," "].includes(e.key))e.preventDefault();
  if((state==="title")&&(e.key==="Enter"||e.key===" ")){show("mission");tone(660,.06)}
  if(e.key==="a"||e.key==="ArrowLeft")input.left=true;if(e.key==="d"||e.key==="ArrowRight")input.right=true;
  if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=true;
  if((e.key==="q"||e.key==="e"||e.key==="Shift")&&!e.repeat)switchWeapon();
  if((e.key==="Escape"||e.key==="p")&&state==="play")pause();else if((e.key==="Escape"||e.key==="p")&&state==="pause")resume();
});
window.addEventListener("keyup",e=>{if(e.key==="a"||e.key==="ArrowLeft")input.left=false;if(e.key==="d"||e.key==="ArrowRight")input.right=false;if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=false});
function mouseAim(e){const p=clientToScreen({x:e.clientX,y:e.clientY},canvas.getBoundingClientRect());input.aimX=p.x;input.aimY=p.y;input.aimMode="mouse"}
canvas.addEventListener("pointermove",e=>{if(e.pointerType!=="touch")mouseAim(e)});
canvas.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch"){mouseAim(e);input.fire=true;initAudio()}});window.addEventListener("pointerup",e=>{if(e.pointerType!=="touch")input.fire=false});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="play")pause()});

document.querySelectorAll("#touchControls [data-touch]").forEach(b=>{const key=b.dataset.touch;if(key==="switch"){b.addEventListener("pointerdown",e=>{e.preventDefault();switchWeapon()});return}b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input[key]=true});for(const ev of ["pointerup","pointercancel","pointerleave"])b.addEventListener(ev,e=>{e.preventDefault();input[key]=false})});
const aimPad=document.querySelector("#aimPad");function touchAim(e){if(state!=="play"||!game)return;const r=aimPad.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y);input.aimMode="touch";if(len>8){input.touchDx=x/len;input.touchDy=y/len}else{input.touchDx=game.player.face;input.touchDy=0}input.fire=true}
aimPad.addEventListener("pointerdown",e=>{e.preventDefault();aimPad.setPointerCapture(e.pointerId);touchAim(e);initAudio()});aimPad.addEventListener("pointermove",e=>{if(e.buttons)touchAim(e)});for(const ev of ["pointerup","pointercancel"])aimPad.addEventListener(ev,()=>input.fire=false);

document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;initAudio();tone(620,.05);const action=a.dataset.action;
  if(action==="title"||action==="quit"||action==="back-title"){requestTitle();return}
  if(action==="confirm-title"){discardMission();show("title");document.querySelector('[data-action="start"]').focus();return}
  if(action==="cancel-title"){cancelTitle();return}
  if(action==="start"||action==="continue")show("mission");
  if(action==="howto")show("howto");if(action==="close-howto"){resetInput();show("title")}
  if(action==="select-mission"){if(!canPlayMission(a.dataset.mission,save))return;selectedMissionId=a.dataset.mission;selected=[...save.equipped];renderWeaponGrid();show("equip")}
  if(action==="mission-select"){discardMission();show("mission")}
  if(action==="back-mission")show("mission");
  if(action==="deploy"){if(selected.length!==2){equipMessage.textContent="武器を2つ選んでください";return}save.equipped=[...selected];storeSave();startMission()}
  if(action==="resume")resume();if(action==="retry")startMission();
});
document.querySelector("#soundToggle").addEventListener("click",e=>{save.settings.sound=!save.settings.sound;e.currentTarget.textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;storeSave();if(save.settings.sound)tone(700,.06)});
document.addEventListener("change",e=>{if(e.target.id!=="densitySelect"||!Object.hasOwn(DENSITY_MODES,e.target.value))return;save.settings.enemyDensity=e.target.value;storeSave()});

function startMission(id=selectedMissionId){
  if(!canPlayMission(id,save))return false;
  discardMission();selectedMissionId=id;
  game={missionId:id,time:0,score:0,kills:0,crates:0,camera:0,shake:0,area:-1,areaText:"",areaTimer:0,nextEnemyId:1,bossStarted:false,midbossAlive:false,clear:false,
    density:save.settings.enemyDensity,enemyLimit:DENSITY_MODES[save.settings.enemyDensity].limit,liveEnemies:0,liveMobs:0,
    director:new SpawnDirector(save.settings.enemyDensity),grid:new SpatialGrid(),attacks:new AttackDirector(),
    shotCandidates:[],blastCandidates:[],chainCandidates:[],separationCandidates:[],
    player:{x:64,y:WORLD.ground-32,vx:0,vy:0,w:14,h:27,hp:100,maxHp:100,onGround:true,face:1,invuln:0,shotCd:0,switchCd:0,shootPose:0,weaponSlot:0,anim:0,dead:false},
    enemies:[],shots:[],enemyShots:[],effects:[],items:[{x:2050,y:WORLD.ground-25,type:"crate",alive:true}],platforms:[{x:520,y:120,w:80},{x:1220,y:105,w:96},{x:2700,y:116,w:72},{x:3500,y:100,w:90}]};
  game.battleCamera=createBattleCamera(game.player);syncCameraView();
  show("play");touchControls.style.visibility="visible";canvas.focus();announceArea(0);
}
function pause(){if(state!=="play")return;show("pause");resetInput()}
function resume(){if(!game)return;show("play");canvas.focus()}
function switchWeapon(){if(state!=="play"||!game||game.player.switchCd>0)return;game.player.weaponSlot=1-game.player.weaponSlot;game.player.switchCd=.25;game.player.shotCd=.25;tone(440,.05)}
function announceArea(i){game.area=i;game.areaText=`AREA ${i+1}  ${MISSION_AREAS[i].name}`;game.areaTimer=2.2;tone(520,.1)}

function spawnEnemy(type,x,y=null){
  if(game.liveEnemies>=game.enemyLimit)return null;
  if(game.bossStarted&&type!=="boss"&&game.liveMobs>=INVASION.bossMinions[game.density])return null;
  const t=ENEMY_TYPES[type],uid=game.nextEnemyId++,v=variation(uid),baseY=y??(type==="needle"?45+v*40:type==="spider"?34:WORLD.ground-t.h);
  const e={uid,type,x,y:baseY,baseY,w:t.w,h:t.h,hp:t.hp,maxHp:t.hp,dead:false,death:0,phase:"move",timer:v,anim:v*8,attackFlash:0,face:-1,
    speedScale:isMob({type})?1+(v*2-1)*INVASION.speedVariation:1,shotCd:.7+v*1.6,vx:0,vy:0,separateX:0,separateY:0,thinkTime:0,diveCd:v*INVASION.diveCooldown,diveTimer:0,diveOffset:0};
  game.enemies.push(e);game.liveEnemies++;if(isMob(e))game.liveMobs++;if(type==="beetle")game.midbossAlive=true;return e;
}
function startBoss(){game.bossStarted=true;game.midbossAlive=false;game.director.stopped=true;game.enemies.length=0;game.liveEnemies=game.liveMobs=0;game.enemyShots.length=0;spawnEnemy("boss",4420,WORLD.ground-58);game.areaText="WARNING  B-01 マザークロウラー";game.areaTimer=3;tone(90,.6,"sawtooth",.04)}
function spawnBossMinion(boss,index){const p=game.player,side=boss.x>=p.x?1:-1;const x=clamp(boss.x+side*(30+index*25),24,WORLD.width-24);if(Math.abs(x-p.x)>=90)spawnEnemy("crawler",x)}
function pushEffect(effect){
  if(game.effects.length<INVASION.maxEffects){game.effects.push(effect);return}
  if(effect.kind==="explosion"){for(let i=0;i<game.effects.length;i++)if(game.effects[i].kind==="spark"){game.effects[i]=effect;break}}
}

function shoot(){const p=game.player,w=weapon(save.equipped[p.weaponSlot]);if(p.shotCd>0||p.switchCd>0)return;const px=p.x+(p.face>0?18:-3),py=p.y+13,target=aimTarget(input,{x:px,y:py},game.camera,view.zoom);let dx=target.x-px,dy=target.y-py,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;p.face=dx>=0?1:-1;p.shotCd=w.interval;
  const make=(ang=0,offset=0)=>{const ca=Math.cos(ang),sa=Math.sin(ang),vx=(dx*ca-dy*sa)*w.speed,vy=(dx*sa+dy*ca)*w.speed;game.shots.push({x:px,y:py+offset,vx,vy,w:7,h:4,life:w.range/w.speed,type:w.type,damage:w.damage,pierce:w.pierce||0,radius:w.radius||0,rehit:{},weapon:w})};
  if(w.type==="spread")[-.34,-.17,0,.17,.34].forEach(a=>make(a));else if(w.type==="homing"){make(-.1,-2);make(.1,3)}else make();
  p.shootPose=.11;pushEffect({x:px,y:py,kind:"muzzle",life:.09,max:.09});tone(w.type==="rocket"||w.type==="grenade"?95:220+w.damage*8,.04,w.type==="laser"?"sawtooth":"square",.018);
}

function update(dt){if(state!=="play"||!game)return;const g=game,p=g.player;g.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.switchCd=Math.max(0,p.switchCd-dt);p.shootPose=Math.max(0,p.shootPose-dt);g.areaTimer=Math.max(0,g.areaTimer-dt);g.shake=Math.max(0,g.shake-dt*16);
  const move=(input.right?1:0)-(input.left?1:0);p.vx=move*95;if(move)p.face=move;if(input.jump&&p.onGround){p.vy=-220;p.onGround=false;tone(330,.06)}p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);p.x=clamp(p.x+p.vx*dt,8,WORLD.width-25);p.y+=p.vy*dt;
  let floor=WORLD.ground-32;for(const pl of g.platforms){if(p.x+7>pl.x&&p.x-7<pl.x+pl.w&&p.y+32<=pl.y+8&&p.y+32+p.vy*dt>=pl.y)floor=Math.min(floor,pl.y-32)}if(p.y>=floor){p.y=floor;p.vy=0;p.onGround=true}else p.onGround=false;
  if(g.midbossAlive&&p.x>2150)p.x=2150;if(g.bossStarted)p.x=clamp(p.x,4100,4760);
  updateBattleCamera(g.battleCamera,p,g.enemies,g,dt);syncCameraView();p.anim+=dt*(Math.abs(p.vx)>0?10:4);
  if(input.fire)shoot();
  g.director.update(dt,g,spawnEnemy,viewBounds(g.camera,view.zoom));
  for(let i=g.area+1;i<MISSION_AREAS.length;i++)if(p.x>=MISSION_AREAS[i].x)announceArea(i);
  if(p.x>4100&&!g.bossStarted)startBoss();
  g.grid.rebuild(g.enemies);updateShots(dt);updateEnemies(dt);updateEnemyShots(dt);updateItems(dt);updateEffects(dt);
  canvas.dataset.gameState=state;canvas.dataset.playerX=Math.round(p.x);canvas.dataset.playerHp=Math.ceil(p.hp);canvas.dataset.enemies=g.liveEnemies;canvas.dataset.boss=g.bossStarted?"1":"0";canvas.dataset.density=g.density;canvas.dataset.enemyLimit=g.enemyLimit;
  if(p.hp<=0&&!p.dead){p.dead=true;scheduleMission(()=>{document.querySelector("#gameoverStats").textContent=`SCORE ${g.score} / TIME ${formatTime(g.time)}`;missionScreen("gameover")},650)}
}

function hitRect(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function damageEnemy(e,dmg){
  if(e.dead)return;e.hp-=dmg;game.score+=Math.max(1,Math.round(dmg));pushEffect({x:e.x,y:e.y+e.h/2,kind:"spark",life:.12,max:.12});
  if(e.hp>0)return;
  e.dead=true;e.death=.45;game.liveEnemies--;if(isMob(e))game.liveMobs--;game.kills++;game.score+=ENEMY_TYPES[e.type].score;
  if(e.type==="beetle")game.midbossAlive=false;
  if(e.type==="boss"){
    game.score+=Math.max(0,Math.floor(3000-game.time*8));game.enemies.length=0;game.enemies.push(e);game.liveEnemies=game.liveMobs=0;
    game.enemyShots.length=0;game.shots.length=0;game.player.invuln=99;scheduleMission(completeMission,900);
  }else if(Math.random()<.06)game.items.push({x:e.x,y:e.y+e.h/2,type:"heal",alive:true});
  else if(Math.random()<.02)game.items.push({x:e.x,y:e.y+e.h/2,type:"crate",alive:true});
  if(game.time>=(game.nextDeathSound||0)){tone(80,.12,"sawtooth",.025);game.nextDeathSound=game.time+.05}
}
function explode(s){
  pushEffect({x:s.x,y:s.y,kind:"explosion",life:.45,max:.45,r:s.radius});
  const candidates=game.grid.query(s.x-s.radius-48,s.y-s.radius-32,s.x+s.radius+48,s.y+s.radius+32,game.blastCandidates);
  for(let i=0;i<candidates.length;i++){const e=candidates[i];if(!e.dead&&Math.hypot(s.x-e.x,s.y-e.y-e.h/2)<s.radius)damageEnemy(e,s.damage)}
  game.shake=Math.max(game.shake,4);tone(65,.18,"sawtooth",.04);
}
function updateShots(dt){for(const s of game.shots){s.life-=dt;if(s.type==="grenade")s.vy+=330*dt;if(s.type==="homing"){const target=nearestEnemy(game.enemies,s.x,s.y,Infinity,null,true);if(target){const a=Math.atan2(target.y-s.y,target.x-s.x),speed=Math.hypot(s.vx,s.vy),desired={x:Math.cos(a)*speed,y:Math.sin(a)*speed};s.vx+=(desired.x-s.vx)*Math.min(1,3.8*dt);s.vy+=(desired.y-s.vy)*Math.min(1,3.8*dt)}}s.x+=s.vx*dt;s.y+=s.vy*dt;
    if((s.type==="grenade"&&s.y>WORLD.ground-3)||s.life<=0){if(s.radius)explode(s);s.dead=true;continue}
    const candidates=game.grid.query(s.x-s.w/2-48,s.y-s.h/2-32,s.x+s.w/2+48,s.y+s.h/2+32,game.shotCandidates);
    for(const e of candidates){if(e.dead||s.dead||(s.rehit[e.uid]??0)>game.time)continue;const box={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect({x:s.x,y:s.y,w:s.w,h:s.h},box)){s.rehit[e.uid]=game.time+(s.weapon.rehit??999);damageEnemy(e,s.damage);if(s.type==="thunder"){const seen=new Set([e]);let from=e;for(let c=0;c<3;c++){const nearby=game.grid.query(from.x-133,from.y-117,from.x+133,from.y+117,game.chainCandidates);const next=nearestEnemy(nearby,from.x,from.y,85,seen);if(!next)break;seen.add(next);damageEnemy(next,s.damage*.75);pushEffect({x:from.x,y:from.y,x2:next.x,y2:next.y,kind:"lightning",life:.16,max:.16});from=next}}
      if(s.radius){explode(s);s.dead=true}else if(s.pierce>0){s.pierce--}else s.dead=true}}
  }let write=0;for(const s of game.shots)if(!s.dead&&s.x>-64&&s.x<WORLD.width+64&&s.y>-600&&s.y<260)game.shots[write++]=s;game.shots.length=write}

function updateEnemies(dt){const p=game.player;game.grid.rebuild(game.enemies);prepareSeparation(game.enemies,game.grid,game.separationCandidates);game.attacks.begin(game.time,game.enemies,game.enemyShots);
  for(const e of game.enemies){e.anim+=dt*7;e.attackFlash=Math.max(0,e.attackFlash-dt);if(e.dead){e.death-=dt;continue}const t=ENEMY_TYPES[e.type];e.shotCd-=dt;e.face=p.x>=e.x?1:-1;
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
    if(isMob(e)){e.x=clamp(e.x+e.separateX*dt,8,WORLD.width-8);if(e.type==="needle")e.y=clamp(e.y+e.separateY*dt,12,WORLD.ground-e.h)}
    const pb={x:p.x,y:p.y+16,w:p.w,h:p.h},eb={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect(pb,eb))hurtPlayer(t.damage,e.x)
  }let write=0;for(const e of game.enemies)if(!e.dead||e.death>0)game.enemies[write++]=e;game.enemies.length=write}
function updateBoss(e,dt){const p=game.player;e.timer+=dt;const phase=e.hp>800?0:e.hp>400?1:2;if(e.phase==="charge"){e.x+=e.vx*dt;if(e.x<4130||e.x>4720){e.x=clamp(e.x,4130,4720);e.vx*=-1;e.phase="move";e.timer=0}}else{e.x+=Math.sign((phase===2?p.x:4540)-e.x)*ENEMY_TYPES.boss.speed*(phase===2?.45:.18)*dt;if(e.timer>2.2-phase*.3){e.timer=0;const action=Math.floor(Math.random()*3);if(action===0)enemyBurst(e,5,130);else if(action===1){for(let i=0;i<2+phase;i++)spawnBossMinion(e,i)}else{e.phase="charge";e.vx=Math.sign(p.x-e.x)*(100+phase*25)}}}}
function enemyFire(e,speed,angleOffset=0){e.attackFlash=.18;const p=game.player,ex=e.x,ey=e.y+e.h/2,a=Math.atan2(p.y+15-ey,p.x-ex)+angleOffset;game.enemyShots.push({x:ex,y:ey,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,w:5,h:5,life:4,damage:ENEMY_TYPES[e.type].damage*.6,normal:isMob(e)})}
function enemyBurst(e,count,speed){for(let i=0;i<count;i++)enemyFire(e,speed,(i-(count-1)/2)*.15);tone(120,.08)}
function hurtPlayer(amount,sourceX){const p=game.player;if(p.invuln>0||p.dead||game.clear)return;p.hp=Math.max(0,p.hp-amount);p.invuln=1;p.vx=sourceX<p.x?60:-60;p.vy=-90;game.shake=4;tone(55,.15,"sawtooth",.04)}
function updateEnemyShots(dt){const p=game.player;for(const s of game.enemyShots){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(hitRect({x:s.x,y:s.y,w:s.w,h:s.h},{x:p.x,y:p.y+16,w:p.w,h:p.h})){hurtPlayer(s.damage,s.x);s.dead=true}}let write=0;for(const s of game.enemyShots)if(!s.dead&&s.life>0&&s.x>-64&&s.x<WORLD.width+64&&s.y>-600&&s.y<260)game.enemyShots[write++]=s;game.enemyShots.length=write}
function updateItems(){const p=game.player;for(const it of game.items){if(!it.alive)continue;if(Math.abs(it.x-p.x)<20&&Math.abs(it.y-(p.y+16))<26){it.alive=false;if(it.type==="heal")p.hp=Math.min(100,p.hp+25);else gCrate();tone(880,.12)}}}
function gCrate(){game.crates++;game.score+=500;game.areaText="WEAPON BOX ACQUIRED";game.areaTimer=1.6}
function updateEffects(dt){let write=0;for(const f of game.effects){f.life-=dt;if(f.life>0)game.effects[write++]=f}game.effects.length=write}

function completeMission(){if(!game||game.clear)return;game.clear=true;const reward=pickReward(save.unlocked);if(reward)save.unlocked.push(reward);save=recordMissionClear(save,game.missionId);save.highScore=Math.max(save.highScore,game.score);save.bestTime=save.bestTime===null?game.time:Math.min(save.bestTime,game.time);storeSave();const w=reward?weapon(reward):null;document.querySelector("#resultStats").innerHTML=`<div>TIME<b>${formatTime(game.time)}</b></div><div>SCORE<b>${game.score}</b></div><div>ENEMIES<b>${game.kills}</b></div><div>BOXES<b>${game.crates}</b></div>`;document.querySelector("#rewardBox").innerHTML=w?`<span>WEAPON UNLOCKED</span><strong>${w.id} ${w.name}</strong>`:`<span>ARSENAL COMPLETE</span><strong>全武器取得済み</strong>`;scheduleMission(()=>show("result"),500)}

function draw(){
  if(!assetsReady){ctx.fillStyle="#050915";ctx.fillRect(0,0,320,180);return}
  if(!game||!["play","pause","confirm"].includes(state)){ctx.drawImage(images.bg,0,0);return}
  const g=game,shake=g.shake&&save.settings.shake?(Math.random()-.5)*g.shake:0;
  ctx.save();
  const origin=worldToScreen({x:0,y:0},g.camera,view.zoom);
  ctx.translate(Math.round(shake)+origin.x,Math.round(shake)+origin.y);
  ctx.scale(view.zoom,view.zoom);
  drawBackdrop(g);drawWorld(g);drawItems(g);drawEnemies(g);drawShots(g);drawPlayer(g.player);drawEffects(g);
  ctx.restore();drawHud(g);
}
function drawBackdrop(g){
  const bounds=viewBounds(g.camera,view.zoom),start=g.camera-(g.camera*.18%320);
  // The zoom reveals sky above the original artwork. Fill it and repeat the city horizontally.
  ctx.fillStyle="#040a16";ctx.fillRect(bounds.left-10,bounds.top-10,view.width+20,bounds.bottom-bounds.top+20);
  for(let x=start-320;x<bounds.right+320;x+=320)ctx.drawImage(images.bg,x,0);
}
function drawWorld(g){
  const bounds=viewBounds(g.camera,view.zoom);
  ctx.fillStyle="#0b1825";ctx.fillRect(bounds.left-10,WORLD.ground,view.width+20,bounds.bottom-WORLD.ground+10);
  for(let x=Math.floor(bounds.left/16)*16-16;x<bounds.right+16;x+=16)ctx.drawImage(images.tiles,((Math.floor(x/16)%8+8)%8)*16,0,16,16,x,WORLD.ground,16,16);
  ctx.fillStyle="#d4b944";for(let x=Math.floor(bounds.left/40)*40;x<bounds.right;x+=40)ctx.fillRect(x,168,19,2);
  for(const pl of g.platforms)if(pl.x+pl.w>bounds.left&&pl.x<bounds.right){ctx.fillStyle="#203e4a";ctx.fillRect(pl.x,pl.y,pl.w,8);ctx.fillStyle="#57a1a0";ctx.fillRect(pl.x,pl.y,pl.w,2)}
  for(const a of MISSION_AREAS)if(a.x>bounds.left&&a.x<bounds.right){ctx.fillStyle="#37e8df44";ctx.fillRect(a.x,30,1,118)}
}
function drawPlayer(p){if(p.invuln>0&&Math.floor(p.invuln*12)%2)return;const frame=p.dead?7:p.shootPose>0?6:!p.onGround?(p.vy<0?4:5):Math.abs(p.vx)>0?Math.floor(p.anim)%4:0;const x=Math.round(p.x-12),y=Math.round(p.y);ctx.save();if(p.face<0){ctx.translate(x+24,0);ctx.scale(-1,1);ctx.drawImage(images.player,frame*24,0,24,32,0,y,24,32)}else ctx.drawImage(images.player,frame*24,0,24,32,x,y,24,32);ctx.restore()}
function drawEnemies(g){let deaths=0;for(const e of g.enemies){const x=Math.round(e.x);if(x<g.camera-110||x>g.camera+view.width+110)continue;const frame=e.dead?3:e.phase==="charge"?2:e.attackFlash>0?2:Math.floor(e.anim)%2;if(e.dead){if(Math.floor(e.death*20)%2||deaths>=INVASION.maxDeathSprites)continue;deaths++}if(e.type==="boss")ctx.drawImage(images.boss,frame*96,0,96,64,x-48,Math.round(e.y),96,64);else{const t=ENEMY_TYPES[e.type],size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,frame*48,t.row*48,48,48,x-size/2,Math.round(e.y+e.h-size),size,size)}}}
function drawShots(g){for(const s of g.shots){if(s.x<g.camera-16||s.x>g.camera+view.width+16)continue;const i=WEAPONS.findIndex(w=>w.type===s.type),x=Math.round(s.x),y=Math.round(s.y);ctx.drawImage(images.shots,Math.max(0,i)*16,0,16,16,x-8,y-8,16,16)}for(const s of g.enemyShots){if(s.x<g.camera-8||s.x>g.camera+view.width+8)continue;ctx.fillStyle="#b5ef48";ctx.fillRect(Math.round(s.x)-3,Math.round(s.y)-3,6,6);ctx.fillStyle="#fff08b";ctx.fillRect(Math.round(s.x)-1,Math.round(s.y)-1,2,2)}}
function drawItems(g){for(const it of g.items){if(!it.alive||it.x<g.camera-24||it.x>g.camera+view.width+24)continue;ctx.drawImage(images.items,it.type==="heal"?0:32,0,32,32,Math.round(it.x)-12,it.y-16,24,24)}}
function drawEffects(g){for(const f of g.effects){if(Math.max(f.x,f.x2??f.x)<g.camera-100||Math.min(f.x,f.x2??f.x)>g.camera+view.width+100)continue;const x=f.x,a=f.life/f.max;if(f.kind==="explosion"){const fr=Math.min(7,Math.floor((1-a)*8));const sz=Math.max(24,(f.r||24)*2);ctx.drawImage(images.explosion,fr*32,0,32,32,x-sz/2,f.y-sz/2,sz,sz)}else if(f.kind==="lightning"){ctx.strokeStyle="#c8a8ff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke()}else{ctx.fillStyle=f.kind==="muzzle"?"#fff08b":"#fff";ctx.fillRect(x-4,f.y-3,8,6)}}}
function drawHud(g){const p=g.player;ctx.fillStyle="#03101ddd";ctx.fillRect(4,4,125,20);ctx.fillStyle="#3a1f2b";ctx.fillRect(8,9,92,7);ctx.fillStyle=p.hp<25?"#ff4f6d":"#37e8df";ctx.fillRect(8,9,92*p.hp/p.maxHp,7);ctx.fillStyle="#e4fff6";ctx.font="7px monospace";ctx.fillText(`HP ${Math.ceil(p.hp)}`,9,15);const w=weapon(save.equipped[p.weaponSlot]);ctx.fillStyle="#071522dd";ctx.fillRect(4,28,99,16);ctx.drawImage(images.weapons,WEAPONS.indexOf(w)*32,0,32,32,6,28,16,16);ctx.fillStyle="#ffe05c";ctx.fillText(`${w.id} ${w.name}`,25,38);ctx.fillStyle="#071522dd";ctx.fillRect(225,4,91,20);ctx.fillStyle="#e4fff6";ctx.fillText(`M01 ${formatTime(g.time)}`,232,12);ctx.fillText(`SCORE ${String(g.score).padStart(6,"0")}`,232,20);ctx.fillStyle="#071522dd";ctx.fillRect(133,4,86,20);ctx.fillStyle="#7fa6a8";ctx.font="6px monospace";ctx.fillText(g.density,138,12);ctx.fillText(`HOSTILES ${g.liveEnemies}/${g.enemyLimit}`,138,20);ctx.font="7px monospace";const boss=g.enemies.find(e=>e.type==="boss"&&!e.dead);if(boss){ctx.fillStyle="#02060dcc";ctx.fillRect(42,158,236,15);ctx.fillStyle="#ff4f6d";ctx.fillRect(47,166,226*boss.hp/boss.maxHp,4);ctx.fillStyle="#ffe05c";ctx.fillText("B-01 MOTHER CRAWLER",94,164)}if(g.areaTimer>0){ctx.fillStyle="#020611dd";ctx.fillRect(55,67,210,28);ctx.fillStyle=g.bossStarted?"#ff4f6d":"#ffe05c";ctx.textAlign="center";ctx.font="bold 9px monospace";ctx.fillText(g.areaText,160,84);ctx.textAlign="left"}}

function loop(ts){
  const begin=DEBUG?performance.now():0,dt=Math.min(.1,(ts-last)/1000||0);last=ts;acc+=dt;
  while(acc>=1/60){update(1/60);acc-=1/60}
  if(profiler?.running&&game&&state==="play")fillBenchmarkPopulation();
  draw();
  if(profiler?.running&&game){profiler.record(ts,performance.now()-begin,game.liveEnemies);if(profiler.result){canvas.dataset.benchmark=JSON.stringify(profiler.result);document.querySelector("#qaResult").textContent=`${profiler.result.limit}: ${profiler.result.averageFps} FPS / p95 ${profiler.result.p95CpuMs}ms`;input.fire=false}}
  requestAnimationFrame(loop);
}

function fillBenchmarkPopulation(){
  while(game.liveEnemies<game.enemyLimit){const n=game.nextEnemyId,type=n%10<2?"needle":n%10===2?"spider":"crawler";spawnEnemy(type,game.player.x+130+(n%18)*18)}
}
function startBenchmark(mode){
  startMission();game.density=mode;game.enemyLimit=DENSITY_MODES[mode].limit;game.director.stopped=true;game.player.x=3200;game.player.invuln=999;
  fillBenchmarkPopulation();input.aimMode="touch";input.touchDx=1;input.touchDy=0;input.fire=true;profiler.start(game.enemyLimit);
  delete canvas.dataset.benchmark;document.querySelector("#qaResult").textContent=`MEASURING ${game.enemyLimit}...`;
}

loadAssets().catch(()=>{document.querySelector("#screenTitle h1").textContent="ASSET LOAD ERROR"});
renderWeaponGrid();document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;requestAnimationFrame(loop);

// Test/QA hooks intentionally read-only except the explicit debug commands.
window.__PDF_GAME__={version:VERSION,getState:()=>({state,time:game?.time||0,score:game?.score||0,playerHp:game?.player.hp??null,enemies:game?.enemies.length||0,boss:!!game?.bossStarted,unlocked:[...save.unlocked]}),start:startMission,spawnBoss:()=>{if(game&&!game.bossStarted){game.player.x=4200;startBoss()}},complete:()=>game&&completeMission()};

if(DEBUG){
  const panel=document.createElement("div");panel.className="debug-panel";panel.innerHTML='<b>QA</b><button data-debug="god">GOD</button><button data-debug="boss">WARP BOSS</button><button data-debug="win">DEFEAT BOSS</button><button data-debug="hurt">DAMAGE</button><button data-debug="bench-LIGHT">BENCH 30</button><button data-debug="bench-STANDARD">BENCH 50</button><button data-debug="bench-MASSIVE">BENCH 100</button><span id="qaResult"></span>';
  document.body.append(panel);panel.addEventListener("click",e=>{const cmd=e.target.dataset.debug;if(!cmd)return;if(cmd.startsWith("bench-")){startBenchmark(cmd.slice(6));return}if(!game)startMission();if(cmd==="god")game.player.invuln=999;if(cmd==="boss"){game.player.x=4300;if(!game.bossStarted)startBoss()}if(cmd==="win"){const boss=game.enemies.find(x=>x.type==="boss");if(boss)damageEnemy(boss,boss.hp+1)}if(cmd==="hurt")hurtPlayer(25,game.player.x+20)});
}
