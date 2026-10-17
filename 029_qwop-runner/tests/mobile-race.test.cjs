'use strict';
const assert = require('node:assert/strict');
const { RaceController, FallGuard, storageKeysFor } = require('../race.js');
const values = new Map(); let writes=0;
const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{writes++; values.set(k,v);}};
const race=new RaceController({storage,recordCategory:'EASY',countdown:{ready:100,three:100,two:100,one:100,go:100}});
race.startCountdown(0); race.pause(150);
assert.equal(race.countdownLabel(10000),'3'); race.update(10000,100);
assert.equal(race.state,'COUNTDOWN'); assert.equal(race.recordValid,true);
race.resume(10000); race.update(10249,0); assert.equal(race.state,'COUNTDOWN');
race.update(10250,0); assert.equal(race.state,'RUNNING');
race.update(11250,30); race.pause(11270); const frozen=race.snapshot();
race.pause(20000); race.update(50000,100); race.finish(50000); race.gameOver(50000,100);
assert.deepEqual(race.snapshot(),frozen); assert.equal(race.inputEnabled,false);
race.resume(50000); race.update(50100,100);
assert.equal(race.finalTimeMs,1100); assert.equal(race.recordValid,false);
assert.equal(values.has(storageKeysFor('EASY').bestTime),false);
const endWrites=writes; race.finish(51000); race.gameOver(52000); race.update(53000,150);
assert.equal(writes,endWrites,'terminal result cannot be saved twice');
for(const difficulty of ['EASY','NORMAL','HARD']) {
  race.setRecordCategory(difficulty); race.startCountdown(0); race.update(400,0); race.update(1400,10);
  race.gameOver(1500,10); assert.equal(race.bestTimeMs,null); assert.equal(race.bestDistance,10);
  race.reset(); race.startCountdown(0); race.update(400,0); race.update(1400,100);
  assert.equal(race.bestTimeMs,1000); assert.equal(race.bestDistance,100);
  const saved=writes; race.finish(1600); race.gameOver(1700); assert.equal(writes,saved);
}
const guard=new FallGuard(); assert.equal(guard.update(true,249),false);
assert.equal(guard.update(false,1),false); assert.equal(guard.update(true,200),false); assert.equal(guard.update(true,50),true);
console.log('Mobile race tests passed: frozen countdown/run, excluded interruption, invalidation, v2 per-difficulty records, idempotent finish, 250ms fall guard');
