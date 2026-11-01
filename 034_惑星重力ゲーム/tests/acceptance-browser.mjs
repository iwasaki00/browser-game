// Sequential browser checks: no competing benchmark processes, no user profile.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const dir=new URL('../reports/final-acceptance/',import.meta.url);
const names=['final-voyage-ui','space-scanner-ui','space-scanner-capture','space-scanner-modes','mobile-polish-audio','mobile-polish-navigation','orbit-share-ui','mobile-polish-performance','space-scanner-endurance'];
const results=[];
for(const name of names){
 const start=Date.now(),log=fs.createWriteStream(new URL(name+'-log.txt',dir));
 console.log('START',name);
 const exitCode=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['tests/'+name+'.mjs','--acceptance'],{stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>{log.write(b);process.stdout.write(b);});child.stderr.on('data',b=>{log.write(b);process.stderr.write(b);});child.on('error',reject);child.on('close',resolve);
 });
 await new Promise(r=>log.end(r));results.push({name,exitCode,status:exitCode===0?'PASS':'FAIL',elapsedMs:Date.now()-start});
 fs.writeFileSync(new URL('browser-suite.json',dir),JSON.stringify(results,null,2)+'\n');
 if(exitCode!==0){process.exitCode=exitCode??1;break;}
}
