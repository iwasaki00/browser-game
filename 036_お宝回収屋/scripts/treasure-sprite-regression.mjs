import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Preserve the historical RC evidence; write results under a separate feature tag.
const names=['browser','depth-browser','reveal-browser','river-browser','gold-browser','beach-browser','field-browser'];
const output='docs/treasure-sprite-regression-results.json',start=Math.max(0,names.indexOf(process.argv[2]));
const previous=start&&existsSync(output)?JSON.parse(readFileSync(output,'utf8')):[];
const results=previous.filter(r=>names.indexOf(r.name)<start&&r.exitCode===0);
if(previous.some(r=>r.exitCode!==0))writeFileSync('docs/treasure-sprite-regression-initial-failure.json',JSON.stringify(previous,null,2)+'\n');
for(const name of names.slice(start)){
 const temp='scripts/.sprite-regression-'+name+'.mjs';
 try{
  writeFileSync(temp,readFileSync('scripts/acceptance-'+name+'-test.mjs','utf8').replaceAll('v092','sprites').replaceAll('0.9.2','1.0.0-rc.1'));
  const start=Date.now(),r=spawnSync(process.execPath,[temp],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
  writeFileSync('.sprite-regression-'+name+'.log',(r.stdout??'')+(r.stderr??''));
  results.push({name,exitCode:r.status,seconds:(Date.now()-start)/1000});console.log(name,r.status);
  if(r.status!==0){console.error(r.stderr);break;}
 }finally{unlinkSync(temp);}
}
writeFileSync(output,JSON.stringify(results,null,2)+'\n');
if(results.length!==names.length||results.some(r=>r.exitCode!==0))process.exitCode=1;
