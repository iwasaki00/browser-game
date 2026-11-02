// C5 evidence collector: local isolated QA + static inspection, never publishing.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {auditRelease,resolveReference,inspectText} from './release-audit.mjs';
import {buildPublicCandidate} from './public-candidate.mjs';
import {transitionCase,missionIds} from '../tests/helpers/release-transitions.mjs';
import {runtime} from '../tests/helpers/runtime.mjs';
import {deploy} from './campaign-integration.mjs';
import {VERSION} from '../js/data.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=join(root,'reports/final-release-audit');
mkdirSync(dir,{recursive:true});
const result={version:VERSION,dateJST:'2026-11-02',generatedAt:new Date().toISOString(),method:'isolated Node VM real engine / local static files; not browser or device',published:false,transitions:[],issues:[],device:{status:'NOT_RUN'},performance:{status:'NOT_RUN',validSamples:0,reason:'No foreground real-browser/device samples; Node simulation is not FPS'}};
for(const debug2 of [false,true])for(const id of missionIds){try{const row=transitionCase(id,debug2);result.transitions.push(row);console.log(row.mode+' '+id+' PASS')}catch(e){result.transitions.push({mission:id,mode:debug2?'URL_INVINCIBLE':'ASSISTED',status:'FAIL',reason:e.message});result.issues.push({severity:'HIGH',area:'transition',mission:id})}}
result.source=await auditRelease();
try{
 const manifest=await buildPublicCandidate(),paths=new Set(manifest.files.map(f=>f.path)),base=join(root,manifest.root),findings=[],refs=[];
 for(const row of manifest.files){const bytes=readFileSync(join(base,row.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.bytes);if(!['.html','.css','.js','.svg'].includes(extname(row.path)))continue;
  const text=bytes.toString('utf8');findings.push(...inspectText(text,row.path));
  const patterns=extname(row.path)==='.html'?[/\b(?:src|href)\s*=\s*["']([^"']+)["']/g]:extname(row.path)==='.css'?[/url\(\s*["']?([^\s)"']+)/g]:extname(row.path)==='.js'?[/\bimport\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g]:[];
  for(const pattern of patterns)for(const m of text.matchAll(pattern)){const ref=resolveReference(row.path,m[1]);if(!ref.skip){assert.ok(ref.path&&paths.has(ref.path),row.path+' invalid local reference');refs.push({from:row.path,to:ref.path})}}
 }
 assert.deepEqual(findings,[]);const gameSource=readFileSync(join(base,'js/game.js'),'utf8');const modes=[];
 for(const search of ['', '?debug=1','?debug=2','?debug=02','?debug=20','?debug=true','?debug=2abc']){const r=runtime(null,{search,sourceText:gameSource,recordDraw:false});assert.equal(r.run('DEBUG||URL_INVINCIBLE'),false);r.click('test-lab');r.run('startLab()');assert.equal(r.run('game'),null);assert.equal(r.run('window.__PDF_GAME__'),undefined);deploy(r,'M01');r.run('hurtPlayer(20,0)');assert.equal(r.run('game.player.hp'),80);modes.push({query:search||'(none)',status:'PASS',debug:false,damageApplied:true})}
 const inventory=readdirSync(base).sort();assert.deepEqual(inventory,['assets','index.html','js','styles.css']);
 const missions=missionIds.map(id=>({...transitionCase(id,false,gameSource),profile:'PUBLIC_CANDIDATE'}));
 result.candidate={status:'PASS',root:manifest.root,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),references:refs.length,findings,modes,missions,excludedCount:manifest.excluded.length,unreachableDevelopmentCodeRetained:true,actualDeploymentChanged:false};
}catch(e){result.candidate={status:'FAIL',reason:e.message};result.issues.push({severity:'HIGH',area:'public-candidate'})}
try{const qa=JSON.parse(readFileSync(join(root,'reports/campaign-integration/results.json'),'utf8'));assert.equal(qa.version,VERSION);assert.equal(qa.summary.fail,0);result.qa=qa.summary;const log=readFileSync(join(root,'reports/campaign-integration/related-tests.txt'),'utf8');result.relatedTests=Number(log.match(/ℹ tests (\d+)/)?.[1]??0);assert.ok(result.relatedTests>=803)}catch(e){result.qa={status:'FAIL',reason:e.message};result.issues.push({severity:'HIGH',area:'qa'})}
result.judgement=result.issues.length||result.source.status!=='PASS'?'NOT READY':'CONDITIONAL';
result.conditions=['iPhone Safari C5 IP-01..IP-10 and normal-difficulty manual acceptance NOT RUN','Existing raw main/root publication would retain developer debug modes; use the audited public candidate after separate deployment review','Remote GitHub Pages/Sites settings, CDN/cache, owner asset-rights confirmation NOT RUN'];
writeFileSync(join(dir,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({version:VERSION,transitions:result.transitions.length,source:result.source.status,candidate:result.candidate.status,relatedTests:result.relatedTests,judgement:result.judgement}));if(result.judgement==='NOT READY')process.exitCode=1;
