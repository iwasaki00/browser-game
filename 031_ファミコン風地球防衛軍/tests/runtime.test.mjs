import test from "node:test";
import assert from "node:assert/strict";
import * as data from "../js/data.js";
import {runtime} from "./helpers/runtime.mjs";

test("TITLE confirms, cancellation continues, acceptance discards only session and timers",()=>{
  const r=runtime({version:1,cleared:["M01"],unlocked:["A-01","S-02","L-03"]});
  r.run("startMission();update(1/60)");const before=r.json("game.time");
  r.click("title");assert.equal(r.run("state"),"confirm");
  r.run("update(1/60)");assert.equal(r.json("game.time"),before);
  r.click("cancel-title");assert.equal(r.run("state"),"play");r.run("update(1/60)");assert.ok(r.json("game.time")>before);
  r.run("scheduleMission(()=>completeMission(),900)");assert.equal(r.timers.size,1);
  r.click("title");r.click("confirm-title");assert.equal(r.run("state"),"title");assert.equal(r.run("game"),null);assert.equal(r.timers.size,0);
  assert.deepEqual(r.json("save.clearedMissions"),["M01"]);assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);assert.ok(r.json("save.unlocked").includes("L-03"));
  for(let i=0;i<4;i++){r.run("startMission()");r.click("title");r.click("confirm-title")}
  assert.equal(r.rafCount(),1);
});

test("clear, game over, retry, selection and reload keep progression; M02 opens, M03 stays locked until M02, M04 never starts",()=>{
  const r=runtime();r.run("startMission();game.time=100;completeMission()");r.flush();assert.equal(r.run("state"),"result");
  assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);
  r.click("mission-select");assert.equal(r.run("state"),"mission");
  const list=r.get("missionList").children;assert.equal(list[0].dataset.status,"CLEAR");assert.equal(list[1].dataset.status,"OPEN");assert.doesNotMatch(list[1].innerHTML,/class="command-deploy"[^>]*disabled/);assert.equal(list[2].dataset.status,"LOCKED");assert.equal(list[3].dataset.status,"LOCKED");assert.equal(list[6].dataset.status,"COMING SOON");assert.equal(r.run('startMission("M04")'),false);
  r.click("select-mission","M03");assert.equal(r.run("state"),"mission");assert.equal(r.run('startMission("M03")'),false);assert.equal(r.run("game"),null);
  r.click("select-mission","M01");r.click("deploy");r.run("game.player.hp=0;update(1/60)");r.flush();assert.equal(r.run("state"),"gameover");
  r.click("retry");assert.equal(r.run("state"),"play");assert.deepEqual(r.json("save.unlockedMissions"),["M01","M02"]);
  r.run("game.player.hp=0;update(1/60)");r.flush();r.click("mission-select");assert.equal(r.run("state"),"mission");
  const saved=JSON.parse(r.storage.get(data.SAVE_KEY)),reloaded=runtime(saved);
  assert.deepEqual(reloaded.json("save.clearedMissions"),["M01"]);assert.deepEqual(reloaded.json("save.unlockedMissions"),["M01","M02"]);assert.ok(reloaded.json("save.unlocked").includes("L-03"));
});

test("stale completion cannot clear a new mission after title and restart",()=>{
  const r=runtime();r.run("startMission();scheduleMission(completeMission,900)");const stale=[...r.timers.values()][0];
  r.click("title");r.click("confirm-title");r.run("startMission()");stale();
  assert.equal(r.run("game.clear"),false);assert.deepEqual(r.json("save.clearedMissions"),[]);
});

test("a delayed mission transition cannot dismiss the TITLE confirmation",()=>{
  const r=runtime();r.run("startMission();scheduleMission(completeMission,900)");r.click("title");r.flush();
  assert.equal(r.run("state"),"confirm");assert.equal(r.run("game.clear"),false);
  r.click("cancel-title");assert.equal(r.run("game.clear"),true);r.flush();assert.equal(r.run("state"),"result");
  r.run("startMission();scheduleMission(completeMission,900)");r.click("title");r.flush();r.click("confirm-title");r.run("startMission()");
  assert.equal(r.run("game.clear"),false);assert.equal(r.run("deferredMissionCallbacks.length"),0);
});

test("actual shot direction follows the camera transform; world collision dimensions stay fixed",()=>{
  const r=runtime();r.run("startMission();game.player.x=900;game.camera=followCamera(900,view.zoom);const target=worldToScreen({x:1000,y:129},game.camera,view.zoom);input.aimX=target.x;input.aimY=target.y;shoot()");
  const shot=r.json("game.shots[0]");assert.ok(shot.vx>0);assert.ok(Math.abs(shot.vy)<1e-8);assert.equal(Math.hypot(shot.vx,shot.vy),310);
  assert.deepEqual(r.json("({w:game.player.w,h:game.player.h})"),{w:14,h:27});
  r.run('game.enemies=[];const enemy=spawnEnemy("crawler",game.player.x,game.player.y);updateEnemies(0)');assert.equal(r.run("game.player.hp"),90);
  r.run("input.right=true;const oldX=game.player.x;update(1/60);globalThis.moved=game.player.x-oldX");assert.ok(Math.abs(r.run("moved")-95/60)<1e-8);
  r.run("input.aimMode='touch';input.touchDx=-1;input.touchDy=0;game.player.shotCd=0;shoot()");assert.ok(r.run("game.shots.at(-1).vx")<0);assert.equal(r.run("game.shots.at(-1).vy"),0);
});

test("render fills background and ground past both camera edges; HUD is outside world scale",()=>{
  const r=runtime();r.run("startMission();assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]=k)");
  for(const zoom of [.35,.5,.85])for(const x of [8,4775]){
    r.drawCalls.length=0;r.run(`game.player.x=${x};game.battleCamera.zoom=${zoom};game.battleCamera.x=followCamera(${x},${zoom});syncCameraView();draw()`);
    const calls=r.drawCalls,scaleIndex=calls.findIndex(c=>c[0]==="scale"&&c[1]===zoom),hpIndex=calls.findIndex(c=>c[0]==="fillText"&&c[1]==="HP"),lastRestore=calls.findLastIndex((c,i)=>c[0]==="restore"&&i<hpIndex);
    assert.ok(scaleIndex>=0);assert.ok(calls.some((c,i)=>c[0]==="drawImage"&&c[1]==="bg"&&i>scaleIndex&&i<lastRestore));
    assert.ok(calls.some((c,i)=>c[0]==="fillText"&&String(c[1]).startsWith("HP")&&i>lastRestore));
    let scale=[1,1];const stack=[];for(const c of calls.slice(0,hpIndex+1)){if(c[0]==='setTransform')scale=[c[1],c[4]];if(c[0]==='save')stack.push([...scale]);if(c[0]==='restore')scale=stack.pop();if(c[0]==='scale')scale=[scale[0]*c[1],scale[1]*c[2]]}assert.deepEqual(scale,[1,1]);
    const bounds=r.json("viewBounds(game.camera,view.zoom)"),fill=calls.find(c=>c[0]==="fillRect"&&c[2]===data.WORLD.ground);
    assert.ok(fill[1]<=bounds.left);assert.ok(fill[1]+fill[3]>=bounds.right);
    const bg=calls.filter(c=>c[0]==="drawImage"&&c[1]==="bg");assert.ok(bg[0][2]<=bounds.left);assert.ok(bg.at(-1)[2]+320>=bounds.right);
  }
  assert.equal(r.run("ctx.imageSmoothingEnabled"),false);
});

test("moving dynamic camera uses its current zoom for shots and retains world collision",()=>{
  const r=runtime();r.run("startMission();game.player.x=1500;game.director.stopped=true;spawnEnemy('crawler',1900)");
  const zooms=[];
  for(let i=0;i<240;i++){
    r.run("game.player.invuln=999;update(1/60)");
    if(i%30===0){
      zooms.push(r.run("view.zoom"));
      r.run("{input.aimMode='mouse';const t=worldToScreen({x:game.player.x+100,y:game.player.y+13},game.camera,view.zoom);input.aimX=t.x;input.aimY=t.y;game.player.shotCd=0;shoot()}");
      assert.ok(r.run("Math.abs(game.shots.at(-1).vy)")<1e-8);assert.equal(r.run("game.shots.at(-1).vx"),310);
    }
  }
  assert.ok(Math.max(...zooms)-Math.min(...zooms)>.02);
  assert.deepEqual(r.json("({w:game.player.w,h:game.player.h})"),{w:14,h:27});
});

test("virtual movement, jump, switching and FIRE work while zoom changes",()=>{
  const r=runtime();r.run("startMission();game.player.x=1000;game.director.stopped=true;spawnEnemy('crawler',1400)");
  r.pointer("right","pointerdown");r.run("update(1/60)");assert.ok(r.run("game.player.x")>1000);
  r.pointer("right","pointerup");r.pointer("jump","pointerdown");r.run("update(1/60)");assert.ok(r.run("game.player.vy")<0);r.pointer("jump","pointerup");
  r.pointer("switch","pointerdown");assert.equal(r.run("game.player.weaponSlot"),1);
  r.pointer("aimPad","pointerdown",{clientX:205});r.run("game.player.weaponSlot=0;game.player.shotCd=0;game.player.switchCd=0;update(1/60)");
  assert.ok(r.run("game.shots.length")>0);assert.ok(r.run("game.shots.at(-1).vx")>0);assert.equal(r.run("game.shots.at(-1).vy"),0);
  r.pointer("aimPad","pointerup");assert.equal(r.run("input.fire"),false);
});

test("boss attack loop progresses and camera releases after defeat",()=>{
  const r=runtime();r.run("startMission();game.player.x=4200;startBoss();game.player.invuln=999;const b=game.enemies[0];b.timer=2.19;b.shotCd=0");
  for(let i=0;i<240;i++)r.run("update(1/60)");
  assert.equal(r.run("game.battleCamera.mode"),"boss");assert.ok(r.run("game.battleCamera.zoom")>=.35);assert.ok(r.run("game.battleCamera.zoom")<=.85);
  assert.ok(r.run("game.enemies[0].anim")>0);assert.ok(r.run("game.enemies[0].timer")!==2.19);
  r.run("damageEnemy(game.enemies[0],9999)");for(let i=0;i<180;i++)r.run("update(1/60)");
  assert.equal(r.run("game.battleCamera.mode"),"idle");assert.ok(Math.abs(r.run("view.zoom")-.5)<.002);
});
