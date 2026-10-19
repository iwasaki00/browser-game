import test from "node:test";
import assert from "node:assert/strict";
import {WEAPONS,ENEMY_TYPES,sanitizeSave,pickReward,DEFAULT_SAVE} from "../js/data.js";

test("8 weapons have unique ids and positive tuning values",()=>{
  assert.equal(WEAPONS.length,8);assert.equal(new Set(WEAPONS.map(w=>w.id)).size,8);
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
