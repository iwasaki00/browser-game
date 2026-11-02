import {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';
const scripts=['browser','depth-browser','reveal-browser','river-browser','gold-browser','beach-browser','field-browser'],results=[];
for(const name of scripts){const start=Date.now(),r=spawnSync(process.execPath,['scripts/'+name+'-test.mjs'],{encoding:'utf8',windowsHide:true});writeFileSync('.regression-'+name+'-v050.log',(r.stdout??'')+(r.stderr??''));results.push({name,exitCode:r.status,seconds:(Date.now()-start)/1000});console.log(name,r.status);if(r.status!==0){console.error(r.stderr);break;}}
writeFileSync('docs/regression-browser-results-v050.json',JSON.stringify(results,null,2));if(results.length!==scripts.length||results.some(r=>r.exitCode!==0))process.exitCode=1;
