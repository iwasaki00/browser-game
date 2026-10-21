import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runtime} from "./helpers/runtime.mjs";
import {PLAYER_CLASSES,DEFAULT_SAVE,SAVE_KEY,WORLD,WEAPONS,sanitizeSave} from "../js/data.js";
import {applyPlayerClass,moveClassPlayer,classPlayerFrame} from "../js/player.js";
import {worldToScreen} from "../js/camera.js";

const start=id=>{const r=runtime({...DEFAULT_SAVE,selectedClass:id},{debug:true});r.run("startMission()");return r};
const body=id=>{const p={x:300,y:116,face:1,onGround:true,anim:0};applyPlayerClass(p,id);return p};

for(const [id,hp,speed,jump] of [["RANGER",100,95,220],["SCOUT",75,180,253],["GUARDIAN",200,65,176],["WING",65,110,0]]){
  test(`${id}: mission HP/speed and class-specific sprite row`,()=>{
    const r=start(id);assert.equal(r.run("game.player.hp"),hp);assert.equal(r.run("game.player.maxHp"),hp);
    r.run("input.right=true;update(1/60)");assert.equal(r.run("game.player.vx"),speed);
    if(jump){r.run("input.jump=true;update(1/60)");assert.ok(Math.abs(r.run("game.player.vy")+jump-WORLD.gravity/60)<1e-8)}
    r.drawCalls.length=0;r.run("images.classes='classes';drawPlayer(game.player)");
    const draw=r.drawCalls.find(c=>c[0]==="drawImage");assert.equal(draw[1],"classes");assert.equal(draw[3],PLAYER_CLASSES[id].row*32);
  });
}

test("class selection is available for all four, persists and applies on retry without changing equipment",()=>{
  const r=start("RANGER"),equipped=r.json("save.equipped");r.click("mission-select");r.click("select-mission","M01");
  assert.equal(r.get("classGrid").children.length,4);
  for(const id of Object.keys(PLAYER_CLASSES)){
    r.click("select-class",undefined,id);r.click("deploy");assert.equal(r.run("game.player.classId"),id);
    r.run("hurtPlayer(99999,0);update(1/60)");r.flush();assert.equal(r.run("state"),"gameover");
    r.click("retry");assert.equal(r.run("game.player.classId"),id);assert.equal(r.run("game.player.hp"),PLAYER_CLASSES[id].hp);
    r.click("mission-select");r.click("select-mission","M01");
  }
  assert.deepEqual(r.json("save.equipped"),equipped);
  const restored=runtime(JSON.parse(r.storage.get(SAVE_KEY)));assert.equal(restored.run("save.selectedClass"),"WING");
});

test("SCOUT dash is short, edge-triggered, cooldown-limited, has no immunity and cannot cross walls",()=>{
  const p=body("SCOUT");moveClassPlayer(p,{special:true,right:true},[],.1);assert.equal(p.vx,360);assert.equal(p.dashDirection,1);
  assert.equal(classPlayerFrame(p),9);moveClassPlayer(p,{special:true,right:true},[],.1);assert.equal(p.dashTime,0);
  for(let i=0;i<120;i++)moveClassPlayer(p,{special:true,right:true},[],1/60);assert.equal(p.dashTime,0);
  moveClassPlayer(p,{},[],.01);moveClassPlayer(p,{special:true,left:true},[],.01);assert.ok(p.dashTime>0);assert.equal(p.dashDirection,-1);
  p.x=80;p.y=60;p.onGround=false;p.dashTime=0;p.dashCd=0;p.dashHeld=false;
  moveClassPlayer(p,{special:true,right:true},[{x:100,y:70,w:80}],.1);assert.equal(p.x,93);
  const r=start("SCOUT");r.key("keydown","c");r.run("update(1/60);hurtPlayer(20,0)");assert.equal(r.run("game.player.hp"),55);
  r.key("keyup","c");assert.equal(r.run("input.special"),false);
});

test("GUARDIAN final damage and knockback are reduced, original one-second invulnerability remains",()=>{
  const r=start("GUARDIAN");r.run("hurtPlayer(10,0)");assert.equal(r.run("game.player.hp"),192.5);
  assert.equal(r.run("game.player.vy"),-49.50000000000001);assert.equal(r.run("game.player.vx"),33);
  assert.equal(r.run("game.player.invuln"),1);r.run("hurtPlayer(10,0)");assert.equal(r.run("game.player.hp"),192.5);
  r.run("game.player.invuln=0;hurtPlayer(10,0)");assert.equal(r.run("game.player.hp"),185);
  r.run("game.items.push({x:game.player.x,y:game.player.y+16,type:'heal',alive:true});updateItems()");assert.equal(r.run("game.player.hp"),200);
});

test("WING: ascent, release descent, hover, five-second budget, exhaustion fall and ground-only recharge",()=>{
  const p=body("WING");moveClassPlayer(p,{up:true},[],.1);assert.equal(p.y,105);assert.equal(p.energy,98);
  moveClassPlayer(p,{},[],.1);assert.ok(p.y>105&&p.vy===28);
  const y=p.y;moveClassPlayer(p,{hover:true},[],.1);assert.equal(p.y,y);assert.equal(p.vy,0);
  for(let i=0;i<282;i++)moveClassPlayer(p,{up:true},[],1/60);
  assert.ok(p.energy<1e-8);moveClassPlayer(p,{up:true},[],1/60);assert.ok(p.vy>0);assert.equal(p.flightLocked,true);
  for(let i=0;i<120;i++)moveClassPlayer(p,{},[],1/60);assert.equal(p.onGround,true);assert.ok(p.energy>0);
  const old=p.energy;moveClassPlayer(p,{},[],1/60);assert.ok(p.energy>old);
  p.y=50;p.onGround=false;p.energy=30;moveClassPlayer(p,{hover:true},[],.1);assert.equal(p.energy,28);
});

test("WING swept collisions on all platform faces and world bounds; switching to ground lands safely",()=>{
  const p=body("WING"),platforms=[{x:100,y:70,w:80}];
  p.x=130;p.y=100;p.onGround=false;moveClassPlayer(p,{up:true},platforms,.5);assert.equal(p.y,78);
  p.y=20;moveClassPlayer(p,{down:true},platforms,.5);assert.equal(p.y,38);assert.equal(p.onGround,true);
  p.x=80;p.y=60;p.onGround=false;moveClassPlayer(p,{right:true,hover:true},platforms,.5);assert.equal(p.x,93);
  p.x=8;p.y=0;moveClassPlayer(p,{up:true,left:true},[],.1);assert.equal(p.y,0);assert.equal(p.x,8);
  p.x=WORLD.width-25;moveClassPlayer(p,{right:true,up:true},[],.1);assert.equal(p.x,WORLD.width-25);
  const r=start("RANGER");r.click("mission-select");r.click("test-lab");r.change("labPreset","WING");
  r.run("game.player.x=550;game.player.y=30;game.player.onGround=false");r.change("labPreset","GUARDIAN");
  assert.equal(r.run("game.player.y"),88);assert.equal(r.run("game.player.onGround"),true);
});

test("all eight weapons use unchanged records across all classes",()=>{
  for(const id of Object.keys(PLAYER_CLASSES)){
    const r=runtime({...DEFAULT_SAVE,selectedClass:id,unlocked:WEAPONS.map(w=>w.id)},{debug:true});r.run("startMission()");
    for(const w of WEAPONS){
      r.run(`save.equipped[0]='${w.id}';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()`);
      assert.equal(r.run("game.shots.at(-1).weapon===WEAPONS.find(w=>w.id===activeEquipment()[0])"),true);
      assert.equal(r.run("game.shots.at(-1).damage"),w.damage);assert.equal(r.run("game.player.shotCd"),w.interval);
    }
  }
});

test("dynamic camera contains fast and flying players without changing zoom bounds",()=>{
  for(const id of ["SCOUT","WING"]){const r=start(id);
    r.run("game.director.stopped=true;game.areaTimer=0;input.right=true;input.up=true;input.special=true;for(let i=0;i<300;i++)update(1/60)");
    const p=r.json("game.player"),zoom=r.run("view.zoom"),camera=r.run("game.camera"),screen=worldToScreen(p,camera,zoom);
    assert.ok(zoom>=.35&&zoom<=.85);assert.ok(screen.x>=0&&screen.x<=320);assert.ok(screen.y>=0&&screen.y+32*zoom<=180);
  }
});

test("legacy saves default RANGER, unknown classes sanitize, progress/weapons/settings survive",()=>{
  for(const version of [1,2]){
    const old={...DEFAULT_SAVE,version,cleared:["M01"],unlocked:["A-01","S-02","R-04"],highScore:200,bestTime:50,settings:{enemyDensity:"MASSIVE",destructionLevel:3,shake:false}};delete old.selectedClass;
    const saved=sanitizeSave(old);assert.equal(saved.selectedClass,"RANGER");assert.ok(saved.clearedMissions.includes("M01"));assert.ok(saved.unlocked.includes("R-04"));assert.equal(saved.settings.destructionLevel,3);assert.equal(saved.highScore,200);assert.equal(saved.bestTime,50);
  }
  assert.equal(sanitizeSave({...DEFAULT_SAVE,selectedClass:"invalid"}).selectedClass,"RANGER");
});

test("formal LAB classes are identical to missions, remain temporary, preserve legacy experiments and 200 cap",()=>{
  const r=runtime({...DEFAULT_SAVE,selectedClass:"GUARDIAN"},{debug:true});r.click("test-lab");const stored=r.storage.get(SAVE_KEY);
  assert.equal(r.run("game.player.hp"),100);assert.equal(r.run("game.lab.preset"),"STANDARD");
  for(const id of Object.keys(PLAYER_CLASSES)){
    r.change("labPreset",id);assert.equal(r.run("game.player.classId"),id);assert.equal(r.run("game.player.hp"),PLAYER_CLASSES[id].hp);
  }
  r.change("labCount","200");r.click("lab-spawn");assert.equal(r.run("game.liveEnemies"),200);assert.equal(r.run("game.player.hp"),65);
  r.click("lab-close");r.pointer("up","pointerdown");r.run("update(.1)");r.pointer("up","pointerup");assert.ok(r.run("game.player.y")<116);
  r.pointer("hover","pointerdown");const y=r.run("game.player.y");r.run("update(.1)");assert.equal(r.run("game.player.y"),y);r.pointer("hover","pointerup");
  assert.equal(r.get("gameShell").dataset.wing,"true");r.click("lab-open");r.change("labPreset","SCOUT");assert.equal(r.get("gameShell").dataset.scout,"true");
  r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),stored);r.run("startMission()");assert.equal(r.run("game.player.classId"),"GUARDIAN");
});

test("atlas dimensions, poses and responsive conditional controls are registered",()=>{
  const png=readFileSync(new URL("../assets/sprites/player/classes.png",import.meta.url));assert.equal(png.readUInt32BE(16),288);assert.equal(png.readUInt32BE(20),128);
  const p=body("SCOUT");p.dead=true;assert.equal(classPlayerFrame(p),8);p.dead=false;p.hitPose=.1;assert.equal(classPlayerFrame(p),7);
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8"),css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(html,/id="classGrid"/);assert.match(html,/data-touch="special"/);assert.match(html,/data-touch="hover"/);
  assert.match(css,/\[data-wing="true"\] \.wing-controls/);assert.match(css,/\[data-scout="true"\] \.dash-button/);
});
