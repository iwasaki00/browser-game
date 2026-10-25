import test from "node:test";
import assert from "node:assert/strict";
import {VERSION,BATTLE_CAMERA,MISSIONS,WEAPONS,ENEMY_TYPES,sanitizeSave,pickReward,DEFAULT_SAVE,visibleWorldWidth,recordMissionClear,canPlayMission,missionStatus} from "../js/data.js";

test("dynamic camera has bounded zoom and a 0.50 idle view",()=>{
  assert.equal(VERSION,"0.3.0");
  assert.equal(BATTLE_CAMERA.minZoom,.35);assert.equal(BATTLE_CAMERA.maxZoom,.85);assert.equal(BATTLE_CAMERA.idleZoom,.50);
  assert.ok(Math.abs(visibleWorldWidth(BATTLE_CAMERA.minZoom)-914.285714)<.00001);
  assert.equal(visibleWorldWidth(BATTLE_CAMERA.idleZoom),640);
});

test("v1 save migration retains weapons, scores, settings and M01 clear",()=>{
  const s=sanitizeSave({version:1,cleared:["M01"],unlocked:["A-01","S-02","L-03","R-04"],equipped:["L-03","R-04"],highScore:12345,bestTime:95,settings:{sound:false}});
  assert.equal(s.version,2);assert.deepEqual(s.clearedMissions,["M01"]);assert.deepEqual(s.unlockedMissions,["M01","M02"]);
  assert.deepEqual(s.equipped,["L-03","R-04"]);assert.ok(s.unlocked.includes("L-03"));assert.equal(s.highScore,12345);assert.equal(s.bestTime,95);assert.equal(s.settings.sound,false);
  assert.equal(missionStatus(MISSIONS[0],s),"CLEAR");assert.equal(canPlayMission("M01",s),true);
  assert.equal(missionStatus(MISSIONS[1],s),"OPEN");assert.equal(canPlayMission("M02",s),true);
  assert.equal(missionStatus(MISSIONS[2],s),"LOCKED");assert.equal(canPlayMission("M03",s),false);assert.equal(missionStatus(MISSIONS[3],s),"COMING SOON");
  assert.equal(canPlayMission("M99",s),false);
});

test("progress is monotonic across serialization and future implemented stages",()=>{
  const initial=sanitizeSave(null);
  assert.deepEqual(initial.unlockedMissions,["M01"]);assert.equal(missionStatus(MISSIONS[0],initial),"OPEN");
  const fixtures=[{id:"M01",implemented:true},{id:"M02",implemented:true},{id:"M03",implemented:true}];
  assert.equal(missionStatus(fixtures[1],initial),"LOCKED");
  const first=recordMissionClear(initial,"M01");
  assert.equal(canPlayMission("M02",first,fixtures),true);assert.equal(missionStatus(fixtures[1],first),"OPEN");
  const second=recordMissionClear(first,"M02");
  assert.deepEqual(second.clearedMissions,["M01","M02"]);assert.deepEqual(second.unlockedMissions,["M01","M02","M03"]);
  assert.deepEqual(sanitizeSave(JSON.parse(JSON.stringify(second))),second);
  assert.deepEqual(recordMissionClear(second,"M01"),second);
});

test("20 weapons have unique ids and positive tuning values",()=>{
  assert.equal(WEAPONS.length,20);assert.equal(new Set(WEAPONS.map(w=>w.id)).size,20);
  for(const w of WEAPONS){assert.ok(w.damage>0);assert.ok(w.interval>0);assert.ok(w.speed>0);assert.ok(w.range>0)}
});

test("all four enemies and boss match required base hp",()=>{
  assert.equal(ENEMY_TYPES.crawler.hp,24);assert.equal(ENEMY_TYPES.spider.hp,35);
  assert.equal(ENEMY_TYPES.needle.hp,18);assert.equal(ENEMY_TYPES.beetle.hp,180);assert.equal(ENEMY_TYPES.boss.hp,1200);
});

test("corrupt save falls back safely and locked ids are removed",()=>{
  assert.deepEqual(sanitizeSave(null),JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  const s=sanitizeSave({version:1,unlocked:["BAD","R-04"],equipped:["BAD"],highScore:-2,settings:{sound:false}});
  assert.deepEqual(s.unlocked,["A-01","S-02","R-04"]);assert.deepEqual(s.equipped,["A-01","S-02"]);assert.equal(s.highScore,0);assert.equal(s.settings.sound,false);
});

test("first clear guarantees laser then chooses remaining weapon",()=>{
  assert.equal(pickReward(["A-01","S-02"],()=>.99),"L-03");
  assert.equal(pickReward(["A-01","S-02","L-03"],()=>0),"R-04");
  assert.equal(pickReward(WEAPONS.map(w=>w.id)),null);
});
