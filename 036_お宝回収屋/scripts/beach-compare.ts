import {readFileSync,writeFileSync} from 'node:fs';import {compareBeach,type BeachCondition} from '../src/dev-beach';
const result=JSON.parse(readFileSync('docs/beach-balance-v040.json','utf8'));
const configs=[['B302'],['B207','B104'],['B105','B104','B108'],['B103','B208'],['B107','B106'],['B206','B106'],['B201','B202'],['B205','B209']];
const mean=(n:number[])=>+(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2);
result.comparisons=['surface','bulk','precision','natural'].map(condition=>{const runs=Array.from({length:100},(_,i)=>compareBeach(i+1,configs,condition as BeachCondition,condition==='natural'?6:3));return {condition,configurations:configs.map((tools,i)=>({tools,...Object.fromEntries(['uses','excavation','maxDepth','area','stamina','finds','quality','processed','sortCalls','fn','seconds','fnPerMinute'].map(key=>[key,mean(runs.map(r=>r.results[i][key as 'uses']))]))})),runs};});
writeFileSync('docs/beach-balance-v040.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.comparisons.map(c=>({condition:c.condition,results:c.configurations})),null,2));
