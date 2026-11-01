import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {routeFor} from './helpers/campaign-routes.mjs';
import {deploy,drive} from '../tools/campaign-integration.mjs';
import {SAVE_KEY,DEFAULT_SAVE,VERSION} from '../js/data.js';

test('integration runner uses genuine engine input controllers and never writes progress, target HP or positions',()=>{
 for(let n=1;n<=8;n++){const route=routeFor('M0'+n);assert.ok(route.includes('input.fire=true'));assert.doesNotMatch(route,/(?:player|target|boss|p|b)\.(?:x|y|hp|energy)\s*=(?!=)/);assert.doesNotMatch(route,/completeMission\(|damageEnemy\(|startBoss\(/)}
 const source=readFileSync(new URL('../tools/campaign-integration.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/\.clearedMissions\.push|completeMission\(|damageEnemy\(/);assert.equal(VERSION,'1.2.0-B');
});
test('new save normal UI deploy, real M01 kill/result and isolated persisted reload do not touch a sentinel save',()=>{
 const sentinel=runtime({...structuredClone(DEFAULT_SAVE),unlocked:['A-01','S-02','R-04']},{recordDraw:false});const original=sentinel.storage.get(SAVE_KEY),writes=sentinel.writes.length;
 const r=runtime(null,{recordDraw:false,randomSeed:11001008});deploy(r,'M01');const out=drive(r,'M01',{assist:true});assert.equal(out.bossDefeated,true);assert.equal(r.run('state'),'result');assert.deepEqual(out.areas,[0,1,2,3,4]);const saved=JSON.parse(r.storage.get(SAVE_KEY));assert.ok(saved.clearedMissions.includes('M01'));assert.ok(saved.unlocked.includes('L-03'));const q=runtime(saved,{recordDraw:false});assert.equal(q.run("canPlayMission('M02',save)"),true);assert.equal(sentinel.storage.get(SAVE_KEY),original);assert.equal(sentinel.writes.length,writes);
});
test('NORMAL_SIM never replenishes health or suppresses incoming damage and records real fatal hit',()=>{
 const r=runtime(null,{recordDraw:false,randomSeed:11001008});deploy(r,'M01');const out=drive(r,'M01',{maxSeconds:120});assert.equal(out.bossDefeated,false);assert.ok(out.damage>0&&out.hits>0);assert.equal(out.hp,0);assert.ok(out.lastHit);assert.equal(r.run('game.lab'),undefined);assert.equal(r.run('save.clearedMissions.length'),0);
});
