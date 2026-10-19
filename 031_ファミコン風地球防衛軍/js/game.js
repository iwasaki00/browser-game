import {VERSION,SAVE_KEY,WORLD,WEAPONS,ENEMY_TYPES,MISSION_AREAS,SPAWNS,DEFAULT_SAVE,clamp,distance,sanitizeSave,pickReward} from "./data.js";

const canvas=document.querySelector("#game"),ctx=canvas.getContext("2d",{alpha:false});
ctx.imageSmoothingEnabled=false;
const screens=[...document.querySelectorAll(".screen")],weaponGrid=document.querySelector("#weaponGrid");
const equipMessage=document.querySelector("#equipMessage"),touchControls=document.querySelector("#touchControls");
const images={};
const imageFiles={bg:"assets/backgrounds/city.png",player:"assets/sprites/player/player.png",enemies:"assets/sprites/enemies/enemies.png",boss:"assets/sprites/bosses/mother_crawler.png",weapons:"assets/sprites/weapons/weapon_icons.png",shots:"assets/sprites/weapons/projectiles.png",explosion:"assets/effects/explosion.png",items:"assets/sprites/ui/items.png",tiles:"assets/tiles/city_tiles.png"};
let save=loadSave(),state="title",last=0,acc=0,assetsReady=false,audio=null;
let game=null,selected=[...save.equipped];

function loadSave(){try{return sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY)))}catch{return sanitizeSave(DEFAULT_SAVE)}}
function storeSave(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}}
function loadAssets(){return Promise.all(Object.entries(imageFiles).map(([key,src])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=reject;im.src=src}))).then(()=>assetsReady=true)}
function show(name){screens.forEach(s=>s.classList.toggle("is-active",s.id===`screen${name[0].toUpperCase()+name.slice(1)}`));state=name;touchControls.style.visibility=name==="play"?"visible":"hidden";canvas.setAttribute("aria-label",name==="play"?"ゲーム画面。M01 市街地防衛線を進行中":`${name}画面`)}
function weapon(id){return WEAPONS.find(w=>w.id===id)}
function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t*100)%100;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(2,"0")}`}

function initAudio(){if(audio||!save.settings.sound)return;const AC=window.AudioContext||window.webkitAudioContext;if(AC)audio=new AC()}
function tone(freq=.05,duration=.04,type="square",volume=.025){if(!save.settings.sound)return;initAudio();if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(volume*save.settings.volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration)}

function renderWeaponGrid(){
  weaponGrid.replaceChildren();
  WEAPONS.forEach((w,i)=>{const b=document.createElement("button");b.className=`weapon-card ${selected.includes(w.id)?"selected":""} ${save.unlocked.includes(w.id)?"":"locked"}`;b.disabled=!save.unlocked.includes(w.id);b.innerHTML=`<span class="weapon-pic" style="background-position:${i*-32}px 0"></span><span><strong>${w.id} ${w.name}</strong><small>DMG ${w.damage} / ${w.detail}</small></span>`;b.addEventListener("click",()=>{if(selected.includes(w.id)){if(selected.length>1)selected=selected.filter(x=>x!==w.id)}else{if(selected.length>=2)selected.shift();selected.push(w.id)}renderWeaponGrid();equipMessage.textContent=selected.length===2?`${selected.join(" / ")} を装備`:"武器を2つ選んでください"});weaponGrid.append(b)});
}

const input={left:false,right:false,jump:false,fire:false,switch:false,aimX:260,aimY:90};
function resetInput(){input.left=input.right=input.jump=input.fire=input.switch=false}
window.addEventListener("keydown",e=>{
  if(["ArrowLeft","ArrowRight","ArrowUp"," "].includes(e.key))e.preventDefault();
  if((state==="title")&&(e.key==="Enter"||e.key===" ")){show("mission");tone(660,.06)}
  if(e.key==="a"||e.key==="ArrowLeft")input.left=true;if(e.key==="d"||e.key==="ArrowRight")input.right=true;
  if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=true;
  if((e.key==="q"||e.key==="e"||e.key==="Shift")&&!e.repeat)switchWeapon();
  if((e.key==="Escape"||e.key==="p")&&state==="play")pause();else if((e.key==="Escape"||e.key==="p")&&state==="pause")resume();
});
window.addEventListener("keyup",e=>{if(e.key==="a"||e.key==="ArrowLeft")input.left=false;if(e.key==="d"||e.key==="ArrowRight")input.right=false;if(e.key==="w"||e.key==="ArrowUp"||e.key===" ")input.jump=false});
canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();input.aimX=(e.clientX-r.left)*320/r.width;input.aimY=(e.clientY-r.top)*180/r.height});
canvas.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch"){input.fire=true;initAudio()}});window.addEventListener("pointerup",e=>{if(e.pointerType!=="touch")input.fire=false});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="play")pause()});

document.querySelectorAll("[data-touch]").forEach(b=>{const key=b.dataset.touch;if(key==="switch"){b.addEventListener("pointerdown",e=>{e.preventDefault();switchWeapon()});return}b.addEventListener("pointerdown",e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input[key]=true});for(const ev of ["pointerup","pointercancel","pointerleave"])b.addEventListener(ev,e=>{e.preventDefault();input[key]=false})});
const aimPad=document.querySelector("#aimPad");function touchAim(e){const r=aimPad.getBoundingClientRect(),x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2),len=Math.hypot(x,y)||1;input.aimX=160+x/len*130;input.aimY=90+y/len*80;input.fire=true}
aimPad.addEventListener("pointerdown",e=>{e.preventDefault();aimPad.setPointerCapture(e.pointerId);touchAim(e);initAudio()});aimPad.addEventListener("pointermove",e=>{if(e.buttons)touchAim(e)});for(const ev of ["pointerup","pointercancel"])aimPad.addEventListener(ev,()=>input.fire=false);

document.addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(!a)return;initAudio();tone(620,.05);const action=a.dataset.action;
  if(action==="start"||action==="continue")show("mission");
  if(action==="howto")show("howto");if(action==="close-howto"||action==="back-title"||action==="quit"){resetInput();show("title")}
  if(action==="select-m01"){selected=[...save.equipped];renderWeaponGrid();show("equip")}
  if(action==="back-mission")show("mission");
  if(action==="deploy"){if(selected.length!==2){equipMessage.textContent="武器を2つ選んでください";return}save.equipped=[...selected];storeSave();startMission()}
  if(action==="resume")resume();if(action==="retry")startMission();if(action==="result-next"){selected=[...save.equipped];renderWeaponGrid();show("equip")}
});
document.querySelector("#soundToggle").addEventListener("click",e=>{save.settings.sound=!save.settings.sound;e.currentTarget.textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;storeSave();if(save.settings.sound)tone(700,.06)});

function startMission(){
  resetInput();
  game={time:0,score:0,kills:0,crates:0,camera:0,shake:0,area:-1,areaText:"",areaTimer:0,spawnIndex:0,nextEnemyId:1,bossStarted:false,midbossAlive:false,clear:false,
    player:{x:64,y:WORLD.ground-32,vx:0,vy:0,w:14,h:27,hp:100,maxHp:100,onGround:true,face:1,invuln:0,shotCd:0,switchCd:0,shootPose:0,weaponSlot:0,anim:0,dead:false},
    enemies:[],shots:[],enemyShots:[],effects:[],items:[{x:2050,y:WORLD.ground-25,type:"crate",alive:true}],platforms:[{x:520,y:120,w:80},{x:1220,y:105,w:96},{x:2700,y:116,w:72},{x:3500,y:100,w:90}]};
  show("play");touchControls.style.visibility="visible";canvas.focus();announceArea(0);
}
function pause(){if(state!=="play")return;show("pause");resetInput()}
function resume(){show("play");canvas.focus()}
function switchWeapon(){if(state!=="play"||!game||game.player.switchCd>0)return;game.player.weaponSlot=1-game.player.weaponSlot;game.player.switchCd=.25;game.player.shotCd=.25;tone(440,.05)}
function announceArea(i){game.area=i;game.areaText=`AREA ${i+1}  ${MISSION_AREAS[i].name}`;game.areaTimer=2.2;tone(520,.1)}

function spawnEnemy(type,x,y=null){if(type!=="boss"&&game.enemies.filter(e=>!e.dead&&e.type!=="boss").length>=24)return null;const t=ENEMY_TYPES[type];const e={uid:game.nextEnemyId++,type,x,y:y??(type==="needle"?58:type==="spider"?34:WORLD.ground-t.h),baseY:y??58,w:t.w,h:t.h,hp:t.hp,maxHp:t.hp,dead:false,death:0,phase:"move",timer:Math.random(),anim:0,attackFlash:0,face:-1,shotCd:.7+Math.random(),vx:0,vy:0};game.enemies.push(e);if(type==="beetle")game.midbossAlive=true;return e}
function spawnGroup(entry){const [x,type,count,gap]=entry;for(let i=0;i<count;i++)spawnEnemy(type,x+200+i*gap)}
function startBoss(){game.bossStarted=true;game.enemies.length=0;game.enemyShots.length=0;spawnEnemy("boss",4420,WORLD.ground-58);game.areaText="WARNING  B-01 マザークロウラー";game.areaTimer=3;tone(90,.6,"sawtooth",.04)}

function shoot(){const p=game.player,w=weapon(save.equipped[p.weaponSlot]);if(p.shotCd>0||p.switchCd>0)return;const px=p.x+(p.face>0?18:-3),py=p.y+13,worldAimX=input.aimX+game.camera,worldAimY=input.aimY;let dx=worldAimX-px,dy=worldAimY-py,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;p.face=dx>=0?1:-1;p.shotCd=w.interval;
  const make=(ang=0,offset=0)=>{const ca=Math.cos(ang),sa=Math.sin(ang),vx=(dx*ca-dy*sa)*w.speed,vy=(dx*sa+dy*ca)*w.speed;game.shots.push({x:px,y:py+offset,vx,vy,w:7,h:4,life:w.range/w.speed,type:w.type,damage:w.damage,pierce:w.pierce||0,radius:w.radius||0,rehit:{},weapon:w})};
  if(w.type==="spread")[-.34,-.17,0,.17,.34].forEach(a=>make(a));else if(w.type==="homing"){make(-.1,-2);make(.1,3)}else make();
  p.shootPose=.11;game.effects.push({x:px,y:py,kind:"muzzle",life:.09,max:.09});tone(w.type==="rocket"||w.type==="grenade"?95:220+w.damage*8,.04,w.type==="laser"?"sawtooth":"square",.018);
}

function update(dt){if(state!=="play"||!game)return;const g=game,p=g.player;g.time+=dt;p.invuln=Math.max(0,p.invuln-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.switchCd=Math.max(0,p.switchCd-dt);p.shootPose=Math.max(0,p.shootPose-dt);g.areaTimer=Math.max(0,g.areaTimer-dt);g.shake=Math.max(0,g.shake-dt*16);
  const move=(input.right?1:0)-(input.left?1:0);p.vx=move*95;if(move)p.face=move;if(input.jump&&p.onGround){p.vy=-220;p.onGround=false;tone(330,.06)}p.vy=Math.min(WORLD.maxFall,p.vy+WORLD.gravity*dt);p.x=clamp(p.x+p.vx*dt,8,WORLD.width-25);p.y+=p.vy*dt;
  let floor=WORLD.ground-32;for(const pl of g.platforms){if(p.x+7>pl.x&&p.x-7<pl.x+pl.w&&p.y+32<=pl.y+8&&p.y+32+p.vy*dt>=pl.y)floor=Math.min(floor,pl.y-32)}if(p.y>=floor){p.y=floor;p.vy=0;p.onGround=true}else p.onGround=false;
  if(g.midbossAlive&&p.x>2150)p.x=2150;if(g.bossStarted)p.x=clamp(p.x,4100,4760);
  g.camera=clamp(p.x-105,0,WORLD.width-320);p.anim+=dt*(Math.abs(p.vx)>0?10:4);
  if(input.fire)shoot();
  while(g.spawnIndex<SPAWNS.length&&p.x>SPAWNS[g.spawnIndex][0])spawnGroup(SPAWNS[g.spawnIndex++]);
  for(let i=g.area+1;i<MISSION_AREAS.length;i++)if(p.x>=MISSION_AREAS[i].x)announceArea(i);
  if(p.x>4100&&!g.bossStarted)startBoss();
  updateShots(dt);updateEnemies(dt);updateEnemyShots(dt);updateItems(dt);updateEffects(dt);
  canvas.dataset.gameState=state;canvas.dataset.playerX=Math.round(p.x);canvas.dataset.playerHp=Math.ceil(p.hp);canvas.dataset.enemies=g.enemies.filter(e=>!e.dead).length;canvas.dataset.boss=g.bossStarted?"1":"0";
  if(p.hp<=0&&!p.dead){p.dead=true;setTimeout(()=>{if(state==="play"){document.querySelector("#gameoverStats").textContent=`SCORE ${g.score} / TIME ${formatTime(g.time)}`;show("gameover")}},650)}
}

function hitRect(a,b){return a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2}
function damageEnemy(e,dmg){if(e.dead)return;e.hp-=dmg;game.score+=Math.max(1,Math.round(dmg));game.effects.push({x:e.x,y:e.y+e.h/2,kind:"spark",life:.12,max:.12});if(e.hp<=0){e.dead=true;e.death=.45;game.kills++;game.score+=ENEMY_TYPES[e.type].score;if(e.type==="beetle")game.midbossAlive=false;if(e.type==="boss"){game.score+=Math.max(0,Math.floor(3000-game.time*8));game.enemies=game.enemies.filter(x=>x===e);game.enemyShots.length=0;game.shots.length=0;game.player.invuln=99;setTimeout(completeMission,900)}else if(Math.random()<.06)game.items.push({x:e.x,y:e.y+e.h/2,type:"heal",alive:true});else if(Math.random()<.02)game.items.push({x:e.x,y:e.y+e.h/2,type:"crate",alive:true});tone(80,.12,"sawtooth",.025)}}
function explode(s){game.effects.push({x:s.x,y:s.y,kind:"explosion",life:.45,max:.45,r:s.radius});for(const e of game.enemies)if(!e.dead&&distance(s,{x:e.x,y:e.y+e.h/2})<s.radius)damageEnemy(e,s.damage);game.shake=Math.max(game.shake,4);tone(65,.18,"sawtooth",.04)}
function updateShots(dt){for(const s of game.shots){s.life-=dt;if(s.type==="grenade")s.vy+=330*dt;if(s.type==="homing"){const target=game.enemies.filter(e=>!e.dead).sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];if(target){const a=Math.atan2(target.y-s.y,target.x-s.x),speed=Math.hypot(s.vx,s.vy),desired={x:Math.cos(a)*speed,y:Math.sin(a)*speed};s.vx+=(desired.x-s.vx)*Math.min(1,3.8*dt);s.vy+=(desired.y-s.vy)*Math.min(1,3.8*dt)}}s.x+=s.vx*dt;s.y+=s.vy*dt;
    if((s.type==="grenade"&&s.y>WORLD.ground-3)||s.life<=0){if(s.radius)explode(s);s.dead=true;continue}
    for(const e of game.enemies){if(e.dead||s.dead||(s.rehit[e.uid]??0)>game.time)continue;const box={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect({x:s.x,y:s.y,w:s.w,h:s.h},box)){s.rehit[e.uid]=game.time+(s.weapon.rehit??999);damageEnemy(e,s.damage);if(s.type==="thunder"){const seen=new Set([e]);let from=e;for(let c=0;c<3;c++){const next=game.enemies.filter(n=>!n.dead&&!seen.has(n)&&distance(from,n)<85).sort((a,b)=>distance(from,a)-distance(from,b))[0];if(!next)break;seen.add(next);damageEnemy(next,s.damage*.75);game.effects.push({x:from.x,y:from.y,x2:next.x,y2:next.y,kind:"lightning",life:.16,max:.16});from=next}}
      if(s.radius){explode(s);s.dead=true}else if(s.pierce>0){s.pierce--}else s.dead=true}}
  }game.shots=game.shots.filter(s=>!s.dead&&s.x>game.camera-30&&s.x<game.camera+380&&s.y>-30&&s.y<200)}

function updateEnemies(dt){const p=game.player;for(const e of game.enemies){e.anim+=dt*7;e.attackFlash=Math.max(0,e.attackFlash-dt);if(e.dead){e.death-=dt;continue}const t=ENEMY_TYPES[e.type];e.shotCd-=dt;e.face=p.x>=e.x?1:-1;
    if(e.type==="crawler"){e.x+=Math.sign(p.x-e.x)*t.speed*dt}
    if(e.type==="spider"){e.y=30+Math.sin(e.anim*.7)*9;e.x+=Math.sign(p.x-e.x)*t.speed*.28*dt;if(e.shotCd<=0&&Math.abs(e.x-p.x)<230){enemyFire(e,115);e.shotCd=1.65}}
    if(e.type==="needle"){e.x+=Math.sign(p.x-e.x)*t.speed*.75*dt;e.y=e.baseY+Math.sin(e.anim*.9)*19;if(Math.abs(e.x-p.x)<85)e.y+=clamp((p.y-e.y)*dt*2.2,-3,3)}
    if(e.type==="beetle"){if(Math.abs(e.x-p.x)>150)e.x+=Math.sign(p.x-e.x)*t.speed*dt;if(e.shotCd<=0){enemyBurst(e,3,155);e.shotCd=1.8}}
    if(e.type==="boss")updateBoss(e,dt);
    if(e.x<game.camera-80&&e.type!=="boss")e.x=game.camera+360;
    const pb={x:p.x,y:p.y+16,w:p.w,h:p.h},eb={x:e.x,y:e.y+e.h/2,w:e.w,h:e.h};if(hitRect(pb,eb))hurtPlayer(t.damage,e.x)
  }game.enemies=game.enemies.filter(e=>!e.dead||e.death>0)}
function updateBoss(e,dt){const p=game.player;e.timer+=dt;const phase=e.hp>800?0:e.hp>400?1:2;if(e.phase==="charge"){e.x+=e.vx*dt;if(e.x<4130||e.x>4720){e.x=clamp(e.x,4130,4720);e.vx*=-1;e.phase="move";e.timer=0}}else{e.x+=Math.sign((phase===2?p.x:4540)-e.x)*ENEMY_TYPES.boss.speed*(phase===2?.45:.18)*dt;if(e.timer>2.2-phase*.3){e.timer=0;const action=Math.floor(Math.random()*3);if(action===0)enemyBurst(e,5,130);else if(action===1){for(let i=0;i<2+phase;i++)spawnEnemy("crawler",e.x+30+i*25)}else{e.phase="charge";e.vx=Math.sign(p.x-e.x)*(100+phase*25)}}}}
function enemyFire(e,speed,angleOffset=0){e.attackFlash=.18;const p=game.player,ex=e.x,ey=e.y+e.h/2,a=Math.atan2(p.y+15-ey,p.x-ex)+angleOffset;game.enemyShots.push({x:ex,y:ey,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,w:5,h:5,life:4,damage:ENEMY_TYPES[e.type].damage*.6})}
function enemyBurst(e,count,speed){for(let i=0;i<count;i++)enemyFire(e,speed,(i-(count-1)/2)*.15);tone(120,.08)}
function hurtPlayer(amount,sourceX){const p=game.player;if(p.invuln>0||p.dead||game.clear)return;p.hp=Math.max(0,p.hp-amount);p.invuln=1;p.vx=sourceX<p.x?60:-60;p.vy=-90;game.shake=4;tone(55,.15,"sawtooth",.04)}
function updateEnemyShots(dt){const p=game.player;for(const s of game.enemyShots){s.life-=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(hitRect({x:s.x,y:s.y,w:s.w,h:s.h},{x:p.x,y:p.y+16,w:p.w,h:p.h})){hurtPlayer(s.damage,s.x);s.dead=true}}game.enemyShots=game.enemyShots.filter(s=>!s.dead&&s.life>0&&s.x>game.camera-20&&s.x<game.camera+340&&s.y>-20&&s.y<200)}
function updateItems(){const p=game.player;for(const it of game.items){if(!it.alive)continue;if(Math.abs(it.x-p.x)<20&&Math.abs(it.y-(p.y+16))<26){it.alive=false;if(it.type==="heal")p.hp=Math.min(100,p.hp+25);else gCrate();tone(880,.12)}}}
function gCrate(){game.crates++;game.score+=500;game.areaText="WEAPON BOX ACQUIRED";game.areaTimer=1.6}
function updateEffects(dt){for(const f of game.effects)f.life-=dt;game.effects=game.effects.filter(f=>f.life>0)}

function completeMission(){if(!game||game.clear)return;game.clear=true;const reward=pickReward(save.unlocked);if(reward)save.unlocked.push(reward);if(!save.cleared.includes("M01"))save.cleared.push("M01");save.highScore=Math.max(save.highScore,game.score);save.bestTime=save.bestTime===null?game.time:Math.min(save.bestTime,game.time);storeSave();const w=reward?weapon(reward):null;document.querySelector("#resultStats").innerHTML=`<div>TIME<b>${formatTime(game.time)}</b></div><div>SCORE<b>${game.score}</b></div><div>ENEMIES<b>${game.kills}</b></div><div>BOXES<b>${game.crates}</b></div>`;document.querySelector("#rewardBox").innerHTML=w?`<span>WEAPON UNLOCKED</span><strong>${w.id} ${w.name}</strong>`:`<span>ARSENAL COMPLETE</span><strong>全武器取得済み</strong>`;setTimeout(()=>show("result"),500)}

function draw(){if(!assetsReady){ctx.fillStyle="#050915";ctx.fillRect(0,0,320,180);return}if(!game||state!=="play"&&state!=="pause"){ctx.drawImage(images.bg,0,0);return}const g=game,p=g.player,shake=g.shake&&save.settings.shake?(Math.random()-.5)*g.shake:0;ctx.save();ctx.translate(Math.round(shake),Math.round(shake));drawWorld(g);drawItems(g);drawEnemies(g);drawShots(g);drawPlayer(p,g.camera);drawEffects(g);ctx.restore();drawHud(g)}
function drawWorld(g){ctx.drawImage(images.bg,0,0);const par=-Math.floor(g.camera*.18)%320;ctx.globalAlpha=.45;ctx.drawImage(images.bg,par,0);ctx.drawImage(images.bg,par+320,0);ctx.globalAlpha=1;ctx.fillStyle="#0b1825";ctx.fillRect(0,WORLD.ground,320,32);for(let x=-g.camera%16;x<320;x+=16)ctx.drawImage(images.tiles,((Math.floor((x+g.camera)/16)%8+8)%8)*16,0,16,16,Math.floor(x),WORLD.ground,16,16);ctx.fillStyle="#d4b944";for(let x=-g.camera%40;x<320;x+=40)ctx.fillRect(x,168,19,2);for(const pl of g.platforms){const sx=pl.x-g.camera;if(sx>-pl.w&&sx<320){ctx.fillStyle="#203e4a";ctx.fillRect(sx,pl.y,pl.w,8);ctx.fillStyle="#57a1a0";ctx.fillRect(sx,pl.y,pl.w,2)}}for(const a of MISSION_AREAS){const sx=a.x-g.camera;if(sx>0&&sx<320){ctx.fillStyle="#37e8df44";ctx.fillRect(sx,30,1,118)}}}
function drawPlayer(p,cam){if(p.invuln>0&&Math.floor(p.invuln*12)%2)return;const frame=p.dead?7:p.shootPose>0?6:!p.onGround?(p.vy<0?4:5):Math.abs(p.vx)>0?Math.floor(p.anim)%4:0;const x=Math.round(p.x-cam-12),y=Math.round(p.y);ctx.save();if(p.face<0){ctx.translate(x+24,0);ctx.scale(-1,1);ctx.drawImage(images.player,frame*24,0,24,32,0,y,24,32)}else ctx.drawImage(images.player,frame*24,0,24,32,x,y,24,32);ctx.restore()}
function drawEnemies(g){for(const e of g.enemies){const x=Math.round(e.x-g.camera);if(x<-110||x>350)continue;const frame=e.dead?3:e.phase==="charge"?2:e.attackFlash>0?2:Math.floor(e.anim)%2;if(e.dead&&Math.floor(e.death*20)%2)continue;if(e.type==="boss")ctx.drawImage(images.boss,frame*96,0,96,64,x-48,Math.round(e.y),96,64);else{const t=ENEMY_TYPES[e.type],size=e.type==="beetle"?48:32;ctx.drawImage(images.enemies,frame*48,t.row*48,48,48,x-size/2,Math.round(e.y+e.h-size),size,size)}}}
function drawShots(g){for(const s of g.shots){const i=WEAPONS.findIndex(w=>w.type===s.type),x=Math.round(s.x-g.camera),y=Math.round(s.y);ctx.drawImage(images.shots,Math.max(0,i)*16,0,16,16,x-8,y-8,16,16)}for(const s of g.enemyShots){ctx.fillStyle="#b5ef48";ctx.fillRect(Math.round(s.x-g.camera)-3,Math.round(s.y)-3,6,6);ctx.fillStyle="#fff08b";ctx.fillRect(Math.round(s.x-g.camera)-1,Math.round(s.y)-1,2,2)}}
function drawItems(g){for(const it of g.items){if(!it.alive)continue;const x=Math.round(it.x-g.camera);ctx.drawImage(images.items,it.type==="heal"?0:32,0,32,32,x-12,it.y-16,24,24)}}
function drawEffects(g){for(const f of g.effects){const x=f.x-g.camera,a=f.life/f.max;if(f.kind==="explosion"){const fr=Math.min(7,Math.floor((1-a)*8));const sz=Math.max(24,(f.r||24)*2);ctx.drawImage(images.explosion,fr*32,0,32,32,x-sz/2,f.y-sz/2,sz,sz)}else if(f.kind==="lightning"){ctx.strokeStyle="#c8a8ff";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,f.y);ctx.lineTo(f.x2-g.camera,f.y2);ctx.stroke()}else{ctx.fillStyle=f.kind==="muzzle"?"#fff08b":"#fff";ctx.fillRect(x-4,f.y-3,8,6)}}}
function drawHud(g){const p=g.player;ctx.fillStyle="#03101ddd";ctx.fillRect(4,4,125,20);ctx.fillStyle="#3a1f2b";ctx.fillRect(8,9,92,7);ctx.fillStyle=p.hp<25?"#ff4f6d":"#37e8df";ctx.fillRect(8,9,92*p.hp/p.maxHp,7);ctx.fillStyle="#e4fff6";ctx.font="7px monospace";ctx.fillText(`HP ${Math.ceil(p.hp)}`,9,15);const w=weapon(save.equipped[p.weaponSlot]);ctx.fillStyle="#071522dd";ctx.fillRect(4,28,99,16);ctx.drawImage(images.weapons,WEAPONS.indexOf(w)*32,0,32,32,6,28,16,16);ctx.fillStyle="#ffe05c";ctx.fillText(`${w.id} ${w.name}`,25,38);ctx.fillStyle="#071522dd";ctx.fillRect(225,4,91,20);ctx.fillStyle="#e4fff6";ctx.fillText(`M01 ${formatTime(g.time)}`,232,12);ctx.fillText(`SCORE ${String(g.score).padStart(6,"0")}`,232,20);const boss=g.enemies.find(e=>e.type==="boss"&&!e.dead);if(boss){ctx.fillStyle="#02060dcc";ctx.fillRect(42,158,236,15);ctx.fillStyle="#ff4f6d";ctx.fillRect(47,166,226*boss.hp/boss.maxHp,4);ctx.fillStyle="#ffe05c";ctx.fillText("B-01 MOTHER CRAWLER",94,164)}if(g.areaTimer>0){ctx.fillStyle="#020611dd";ctx.fillRect(55,67,210,28);ctx.fillStyle=g.bossStarted?"#ff4f6d":"#ffe05c";ctx.textAlign="center";ctx.font="bold 9px monospace";ctx.fillText(g.areaText,160,84);ctx.textAlign="left"}}

function loop(ts){const dt=Math.min(.1,(ts-last)/1000||0);last=ts;acc+=dt;while(acc>=1/60){update(1/60);acc-=1/60}draw();requestAnimationFrame(loop)}

loadAssets().catch(()=>{document.querySelector("#screenTitle h1").textContent="ASSET LOAD ERROR"});
renderWeaponGrid();document.querySelector("#soundToggle").textContent=`SOUND: ${save.settings.sound?"ON":"OFF"}`;requestAnimationFrame(loop);

// Test/QA hooks intentionally read-only except the explicit debug commands.
window.__PDF_GAME__={version:VERSION,getState:()=>({state,time:game?.time||0,score:game?.score||0,playerHp:game?.player.hp??null,enemies:game?.enemies.length||0,boss:!!game?.bossStarted,unlocked:[...save.unlocked]}),start:startMission,spawnBoss:()=>{if(game&&!game.bossStarted){game.player.x=4200;startBoss()}},complete:()=>game&&completeMission()};

if(new URLSearchParams(location.search).has("debug")){
  const panel=document.createElement("div");panel.className="debug-panel";panel.innerHTML='<b>QA</b><button data-debug="god">GOD</button><button data-debug="boss">WARP BOSS</button><button data-debug="win">DEFEAT BOSS</button><button data-debug="hurt">DAMAGE</button>';
  document.body.append(panel);panel.addEventListener("click",e=>{const cmd=e.target.dataset.debug;if(!cmd)return;if(!game)startMission();if(cmd==="god")game.player.invuln=999;if(cmd==="boss"){game.spawnIndex=SPAWNS.length;game.player.x=4300;if(!game.bossStarted)startBoss()}if(cmd==="win"){const boss=game.enemies.find(x=>x.type==="boss");if(boss)damageEnemy(boss,boss.hp+1)}if(cmd==="hurt")hurtPlayer(25,game.player.x+20)});
}
