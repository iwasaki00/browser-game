// A complete test run in a disposable copy: legacy tests write reports.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const report=process.argv.find(a=>a.startsWith('--report='))?.slice(9)??'quality-assurance';
if(!['quality-assurance','mobile-polish','space-scanner','final-acceptance','mission-guide','beginner-tutorial','story-navigation','final-audit'].includes(report))throw Error('Unknown QA report directory');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'reports',report);fs.mkdirSync(out,{recursive:true});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-qa-')),copy=path.join(temporary,'game');
fs.cpSync(root,copy,{recursive:true,filter:src=>!src.startsWith(out)});
const files=fs.readdirSync(path.join(copy,'tests')).filter(f=>f.endsWith('.test.mjs')).sort();
const label=process.argv.includes('--final')?'all-final':'all-before',start=Date.now();
const gitDir=spawnSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'});if(gitDir.status!==0)throw Error('Git history is required by legacy engine comparisons');
const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...files.map(f=>'tests/'+f)],{cwd:copy,env:{...process.env,GIT_DIR:gitDir.stdout.trim(),GIT_WORK_TREE:root},encoding:'utf8',maxBuffer:30*1024*1024});
const log=(result.stdout??'')+'\n'+(result.stderr??'');fs.writeFileSync(path.join(out,label+'.txt'),log);
const counts={};for(const k of ['tests','pass','fail','skipped','cancelled','todo']){const match=log.match(new RegExp('(?:#|ℹ) '+k+' (\\d+)'));counts[k]=match?Number(match[1]):null;}
const summary={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,node:process.version,platform:process.platform,files:files.length,testFiles:files,exitCode:result.status,elapsedMs:Date.now()-start,temporaryCopy:copy,counts};
fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));process.exitCode=result.status??1;
