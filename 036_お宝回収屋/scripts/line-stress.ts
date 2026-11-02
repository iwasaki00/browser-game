import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {automationFixture,supplyAutomation,drainAutomation} from '../src/dev-automation';
import {createLine,setLineRunning,lineTick,lineStocks} from '../src/lines';
import {auto,automationTick} from '../src/automation';
import {addPlot,plot,tick,stored,reward} from '../src/engine';
import {migrate} from '../src/save';
import {recoveryCount} from '../src/ledger';
let s=automationFixture(6900,'B',true);for(const f of ['B','R','G'] as const){createLine(s,f);setLineRunning(s,f,true);}const samples=[],start=performance.now();let supply=0,reloads=0,peakQueue=0,peakBytes=0;
for(let block=0;block<8640;block++){
 if(block%6===0){const f=(['B','R','G'] as const)[supply%3];addPlot(s,70000+supply++,true,f==='B'?'B-A':f==='R'?'R-B':'G-B');supplyAutomation(s,f,true);}
 lineTick(s,10);tick(s,10,true);drainAutomation(s);peakQueue=Math.max(peakQueue,auto(s).jobs.length);
 if(block%360===359){const before=s.totalEarnedFN;s=migrate(JSON.parse(JSON.stringify(s)));assert.equal(s.totalEarnedFN,before);for(const f of ['B','R','G'] as const)setLineRunning(s,f,true);reloads++;const bytes=Buffer.byteLength(JSON.stringify(s));peakBytes=Math.max(peakBytes,bytes);samples.push({hour:(block+1)/360,bytes,ms:performance.now()-start,paid:recoveryCount(s),jobs:auto(s).jobs.length,recent:s.collectedTreasures.length,history:auto(s).history.length,stocks:Object.values(s.lines!).map(l=>({field:l!.field,...lineStocks(s,l!)}))});console.log('hour',(block+1)/360,bytes);}
}
const before=JSON.stringify(s);lineTick(s,86400,false);automationTick(s,86400,false);assert.equal(JSON.stringify(s),before);const c=migrate(JSON.parse(before)),again=migrate(structuredClone(c));assert.deepEqual(c,again);for(const f of stored(s)){const value=reward(s,f.uid);assert.equal(reward(s,f.uid),0);assert.ok(value>=0);}assert.ok(auto(s).history.length<=100);assert.ok(s.collectedTreasures.length<=200);assert.ok(auto(s).jobs.length<=64);
writeFileSync('docs/line-stress-v060.json',JSON.stringify({version:'0.6.0',gameHours:24,concurrentFields:3,reloads,peakQueue,peakBytes,elapsedMs:performance.now()-start,hiddenUnchanged:true,idempotentMigration:true,recentHistory:s.collectedTreasures.length,paid:recoveryCount(s),fn:s.totalEarnedFN,samples},null,2));
