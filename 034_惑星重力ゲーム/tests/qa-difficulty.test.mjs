import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {CHALLENGES} from '../js/challenges.js';import {getHomewardSector} from '../js/homeward-data.js';import {placementAllowed} from '../js/planets.js';import {runRoute} from './measure-game-balance.mjs';
const dir=new URL('../reports/quality-assurance/',import.meta.url);mkdirSync(dir,{recursive:true});
test('HOMEWARD02 / CLASSIC19: 既存測定との比較、データ維持、入力・配置の感度',()=>{
 const before=JSON.parse(readFileSync(new URL('../game-balance/measurements.json',dir),'utf8')),rows=[];
 for(const [path,hash]of Object.entries(before.hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+path,dir))).digest('hex'),hash,path);
 const stage=getHomewardSector('homeward-02');for(const delta of [-1,-.1,-.0328125,-.03203125,-.01,0,.01,.03203125,.0328125,.1,1]){const r=runRoute(stage,{angleDeg:-65+delta,speed:220});rows.push({sector:stage.id,delta,success:r.success,reason:r.reason});if(Math.abs(delta)<=.03203125)assert.ok(r.success);else assert.equal(r.success,false);}
 assert.equal(runRoute(stage,stage.launch).success,false);for(const speed of [218,219,220])assert.ok(runRoute(stage,{angleDeg:-65,speed}).success);
 const original=CHALLENGES[18],measure=before.results.find(r=>r.id===original.id);for(const s of measure.samples.filter(s=>s.reason!=='outside-input-range')){const r=runRoute(original,{angleDeg:original.solution.angleDeg+s.da,speed:original.solution.speed+s.ds});assert.equal(r.success,s.success);}
 const placement=[];for(let i=0;i<2;i++)for(const axis of ['x','y'])for(const delta of [-10,-5,-2,2,5,10]){const s=structuredClone(original);s.planets[i][axis]+=delta;const legal=placementAllowed(s.planets[i],s);const r=legal?runRoute(s,s.solution):null;placement.push({planet:i,axis,delta,legal,success:r?.success??null,reason:r?.reason??'placement-restricted'});}
 writeFileSync(new URL('difficulty.json',dir),JSON.stringify({physicsAndStageData:'byte-identical to v1.9.1',homeward02:rows,homeward02Advice:'keep angle -65, change thrust 200 -> 218..220; 0.01 degree controls retained',classic19:{legalInputGrid:measure.combined,placement,decision:'retain goal and rating; challenge is not strictly increasing at stage19'}},null,2));
});
