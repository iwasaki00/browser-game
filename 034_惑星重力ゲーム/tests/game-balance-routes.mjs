import {readFileSync} from 'node:fs';
import {CHALLENGES} from '../js/challenges.js';
import {getHomewardSector} from '../js/homeward-data.js';
import {createOpenVoyage} from '../js/open-voyage.js';
import {createDeepSpace,DEEP_TARGETS} from '../js/deep-space.js';
import {createFinalVoyage} from '../js/final-voyage.js';
import {getHugeSample} from '../js/worlds.js';
const json=p=>JSON.parse(readFileSync(new URL('../reports/'+p,import.meta.url),'utf8'));
export function balanceRoutes(){
 const routes=CHALLENGES.map(stage=>({id:stage.id,group:'CLASSIC',stage:structuredClone(stage),input:stage.solution}));
 for(let n=1;n<=8;n++){const stage=getHomewardSector(`homeward-0${n}`);routes.push({id:stage.id,group:'HOMEWARD',stage,input:stage.solution});}
 const seen=new Set();for(const route of json('open-voyage/route-results.json'))for(const leg of route.legs){const id=`09:${leg.from}>${leg.target}`;if(seen.has(id))continue;seen.add(id);routes.push({id,group:'SECTOR09',stage:createOpenVoyage({checkpoint:leg.from,selected:leg.target}),input:leg});}
 for(const leg of json('deep-space/routes.json'))routes.push({id:`DEEP:${leg.from}>${leg.target}`,group:'DEEP',stage:createDeepSpace({checkpoint:leg.from,selected:leg.target,targets:Object.fromEntries(DEEP_TARGETS.map(t=>[t.id,{state:'DETECTED'}]))}),input:leg});
 for(const leg of json('final-voyage/routes.json'))routes.push({id:`FINAL:${leg.from}>${leg.target}`,group:'FINAL',stage:createFinalVoyage({checkpoint:leg.from,selected:leg.target}),input:leg});
 for(const id of ['voyage','swing','deep']){const stage=getHugeSample(id);routes.push({id:`FREE:${id}`,group:'FREE',stage,input:stage.launch});}
 return routes;
}
