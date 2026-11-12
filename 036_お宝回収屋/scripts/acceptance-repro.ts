import {writeFileSync} from 'node:fs';
import {createState,plot} from '../src/engine';
import {parseBackup} from '../src/save';
const rows:any[]=[];
for(const name of ['unsafeKey','duplicateSand','orphanSand','htmlGrainUID','htmlBatchID']){
 const s:any=createState(92);
 if(name==='unsafeKey')s.settings=JSON.parse('{"sound":false,"short":false,"__proto__":{"polluted":true}}');
 if(name==='duplicateSand')s.sandBatches=[0,1].map(()=>({id:'same',plotId:plot(s).id,items:[],cells:10,processed:false}));
 if(name==='orphanSand')s.sandBatches=[{id:'sand',plotId:plot(s).id,items:['missing'],cells:10,processed:false}];
 if(name==='htmlGrainUID')plot(s).items[0].uid='x"><img src=x onerror="window.__importExecuted=true">';
 if(name==='htmlBatchID')s.sandBatches=[{id:'x"><img src=x onerror="window.__importExecuted=true">',plotId:plot(s).id,items:[],cells:10,processed:false}];
 try{parseBackup(JSON.stringify(s));rows.push({name,accepted:true});}catch(e){rows.push({name,accepted:false,error:(e as Error).message});}
}
writeFileSync('docs/acceptance-repro-before-v092.json',JSON.stringify(rows,null,2));console.log(rows);
