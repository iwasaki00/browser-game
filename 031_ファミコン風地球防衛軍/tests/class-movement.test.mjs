import test from "node:test";
import assert from "node:assert/strict";
import {runtime} from "./helpers/runtime.mjs";
import {PLAYER_CLASSES,DEFAULT_SAVE,SAVE_KEY,WORLD} from "../js/data.js";
import {PLAYER_PRESETS} from "../js/playground.js";
import {applyPlayerClass,moveClassPlayer} from "../js/player.js";

const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function player(id,x=200,y=116){const p={x,y,face:1,onGround:y===116,anim:0};applyPlayerClass(p,id);return p}
const mission=()=>{const r=runtime();r.run("startMission()");return r};
const platforms=mission().json("game.platforms"); // Actual M01, not a copied fixture.
function advance(p,input,seconds,fps=60,terrain=[]){for(let i=0;i<Math.round(seconds*fps);i++)moveClassPlayer(p,input,terrain,1/fps)}

test("GUARDIAN jump height is sufficient for M01's mandatory 28/32px steps",()=>{
  const peak=jump=>{const p=player("GUARDIAN");p.vy=-jump;p.onGround=false;let min=p.y;
    for(let i=0;i<90;i++){moveClassPlayer(p,{},[],1/60);min=Math.min(min,p.y)}return 116-min};
  near(peak(176),23.5166666667,1e-6);near(peak(209),33.5);near(peak(220),37.2166666667,1e-6);
  assert.equal(PLAYER_CLASSES.GUARDIAN.jump,209);near(209**2/(2*WORLD.gravity),35.226612903225806);
  const blocking=platforms.filter(pl=>116<pl.y+8);assert.deepEqual(blocking.map(pl=>148-pl.y),[28,32]);
  assert.ok(Math.max(...blocking.map(pl=>148-pl.y))<peak(209));
});

for(const id of Object.keys(PLAYER_CLASSES)){
  test(`${id} traverses all four real M01 platform locations without terrain changes`,()=>{
    for(const pl of platforms){
      const blocking=116<pl.y+8,p=player(id,pl.x-7);
      let landed=false;
      for(let i=0;i<240;i++){
        moveClassPlayer(p,{right:true,jump:blocking&&i===0,up:id==="WING"&&blocking&&i<30},platforms,1/60);
        landed ||= p.onGround&&p.y===pl.y-32;
      }
      assert.ok(p.x-7>=pl.x+pl.w,`${id} blocked at ${pl.x}`);
      if(id==="GUARDIAN"&&blocking)assert.equal(landed,true,`GUARDIAN must land on ${pl.x}, not phase through`);
    }
  });
}

test("GUARDIAN can take off near either side, land on each mandatory step and walk off",()=>{
  for(const pl of platforms.filter(pl=>116<pl.y+8))for(const direction of [-1,1])for(const gap of [0,8,16]){
    const p=player("GUARDIAN",direction>0?pl.x-7-gap:pl.x+pl.w+7+gap);p.face=direction;
    let landed=false;
    for(let i=0;i<240;i++){
      moveClassPlayer(p,{right:direction>0,left:direction<0,jump:i===0},platforms,1/60);
      landed ||= p.onGround&&p.y===pl.y-32;
    }
    assert.equal(landed,true,`no landing at ${pl.x}, direction ${direction}, gap ${gap}`);
    assert.ok(direction>0?p.x-7>=pl.x+pl.w:p.x+7<=pl.x);
    near(p.y,116);assert.equal(p.onGround,true);
  }
});

test("GUARDIAN still blocks at a side without jumping; HP, speed, armor and hitbox are unchanged",()=>{
  const r=runtime({...DEFAULT_SAVE,selectedClass:"GUARDIAN"});r.run("startMission();game.director.stopped=true;game.player.x=513");
  r.key("keydown","d");r.run("for(let i=0;i<60;i++)update(1/60)");near(r.run("game.player.x"),513);
  r.key("keydown"," ");r.run("update(1/60)");near(r.run("game.player.vy"),-209+WORLD.gravity/60);r.key("keyup"," ");
  r.run("for(let i=0;i<180;i++)update(1/60)");assert.ok(r.run("game.player.x")>607);
  assert.deepEqual(r.json("[game.player.maxHp,game.player.vx,game.player.w,game.player.h]"),[200,65,14,27]);
  r.run("hurtPlayer(20,0)");near(r.run("game.player.hp"),185);near(r.run("game.player.vy"),-49.5);near(r.run("game.player.invuln"),1);
  assert.equal(PLAYER_PRESETS.HEAVY.jump,176); // Historical LAB override is not the formal class.
});

test("GUARDIAN follows the normal M01 terrain continuously from spawn to the boss approach",()=>{
  const r=runtime({...DEFAULT_SAVE,selectedClass:"GUARDIAN"});
  r.run(`startMission();game.director.stopped=true;input.right=true;
    for(let i=0;i<5000&&game.player.x<4090;i++){
      const p=game.player;
      input.jump=p.onGround&&p.y===WORLD.ground-32&&game.platforms.some(pl=>p.y<pl.y+8&&p.x>=pl.x-23&&p.x<=pl.x+pl.w+7);
      update(1/60);
    }`);
  assert.ok(r.run("game.player.x")>=4090);assert.equal(r.run("state"),"play");
  assert.equal(r.run("game.player.hp"),200);assert.equal(r.run("game.enemies.length"),0);
});

for(const fps of [30,60,144]){
  test(`WING energy is time-based at ${fps}fps: ascent 20/s, hover 8/s, fall 0/s, ground +25/s`,()=>{
    const ascent=player("WING");advance(ascent,{up:true},1,fps);near(ascent.energy,80);
    advance(ascent,{up:true},4,fps);near(ascent.energy,0);assert.equal(ascent.flightLocked,true);
    const hover=player("WING",200,0);advance(hover,{hover:true},10,fps);near(hover.energy,20);near(hover.y,0);
    advance(hover,{hover:true},2.5,fps);near(hover.energy,0);assert.equal(hover.flightLocked,true);
    moveClassPlayer(hover,{hover:true},[],1/fps);assert.ok(hover.vy>0);assert.ok(hover.y>0);
    const falling=player("WING",200,0);falling.energy=42;advance(falling,{},.25,fps);near(falling.energy,42);assert.ok(falling.vy>0&&falling.y>0);
    const grounded=player("WING");grounded.energy=0;grounded.flightLocked=true;advance(grounded,{},2,fps);near(grounded.energy,50);
    advance(grounded,{},2,fps);near(grounded.energy,100);
  });
}

test("FLY wins over HOLD and down, consumes only ascent energy; release uses gravity without energy",()=>{
  const p=player("WING",200,50);moveClassPlayer(p,{up:true,hover:true,down:true},[],.1);
  near(p.energy,98);near(p.y,39);near(p.vy,-110);
  moveClassPlayer(p,{hover:true,down:true},[],.1);near(p.energy,97.2);near(p.y,39);near(p.vy,0);
  moveClassPlayer(p,{},[],.1);near(p.energy,97.2);near(p.vy,62);assert.ok(p.y>39);
});

test("energy exhaustion releases hover mid-step without negative energy or airborne recovery",()=>{
  const p=player("WING",200,10);p.energy=.4;moveClassPlayer(p,{hover:true},[],.1);
  near(p.energy,0);assert.equal(p.flightLocked,true);near(p.vy,31);assert.ok(p.y>10);
  moveClassPlayer(p,{hover:true,up:true},[],.1);near(p.energy,0);assert.ok(p.vy>31);
  const fresh=player("WING");fresh.energy=50;moveClassPlayer(fresh,{up:true},[],.1);near(fresh.energy,48); // no takeoff recharge
});

test("WING falling collides with M01 platforms/ground and all flight remains within world bounds",()=>{
  for(const pl of platforms){const p=player("WING",pl.x+pl.w/2,pl.y-42);p.energy=40;
    for(let i=0;i<90&&!p.onGround;i++)moveClassPlayer(p,{},platforms,1/60);
    assert.equal(p.onGround,true);near(p.y,pl.y-32);near(p.energy,40);
    advance(p,{hover:true},1,60,platforms);near(p.energy,65);
  }
  const p=player("WING",8,0);advance(p,{left:true,up:true},1);near(p.x,8);near(p.y,0);
  p.x=WORLD.width-25;advance(p,{right:true,hover:true},1);near(p.x,WORLD.width-25);near(p.y,0);
});

test("PC Space and touch HOLD hover/fire, touch FLY priority and release, LAB isolation",()=>{
  for(const touch of [false,true]){
    const r=runtime({...DEFAULT_SAVE,selectedClass:"GUARDIAN"},{debug:true});r.click("test-lab");const saved=r.storage.get(SAVE_KEY);
    r.change("labPreset","WING");r.click("lab-close");r.run("game.player.y=20;game.player.onGround=false;game.areaTimer=0");
    if(touch)r.pointer("hover","pointerdown");else r.key("keydown"," ");
    r.run("input.fire=true;update(.1)");near(r.run("game.player.y"),20);near(r.run("game.player.energy"),99.2);assert.ok(r.run("game.shots.length")>0);
    if(touch)r.pointer("up","pointerdown");else r.key("keydown","w");
    r.run("update(.1)");near(r.run("game.player.energy"),97.2);assert.ok(r.run("game.player.y")<20);
    if(touch){r.pointer("up","pointerup");r.pointer("hover","pointerup")}
    else {r.key("keyup","w");r.key("keyup"," ")}
    r.run("game.player.vy=0;update(.1)");near(r.run("game.player.energy"),97.2);assert.ok(r.run("game.player.vy")>0);
    r.click("lab-open");r.click("lab-exit");assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run("save.selectedClass"),"GUARDIAN");
  }
});
