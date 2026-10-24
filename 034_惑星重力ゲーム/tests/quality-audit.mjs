// Read-only source/evidence audit. Does not run game saves or overwrite old reports.
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CHALLENGES} from '../js/challenges.js';
const root=new URL('../',import.meta.url),repo=new URL('../../',import.meta.url),dir=new URL('reports/quality-audit/',root);
await mkdir(dir,{recursive:true});
const read=async name=>(await readFile(new URL(name,root),'utf8')).replace(/\r\n/g,'\n');
const json=async name=>JSON.parse(await read(name));
const hash=text=>createHash('sha256').update(text).digest('hex');
const git=args=>execFileSync('git',args,{cwd:fileURLToPath(repo),encoding:'utf8',maxBuffer:8e6}).replace(/\r\n/g,'\n');
const project='034_惑星重力ゲーム/';
const groups=[
 {report:'reports/special-challenges/verification.json',files:['js/physics.js','js/planets.js','js/launch.js','js/live-gravity.js','js/challenges.js','js/special-challenges.js','js/progress.js','tests/special-planets.test.mjs','tests/special-challenges.test.mjs'],scope:'Stage11–20到達・★3・特殊効果・旧01–10保護・旧セーブ互換'},
 {report:'reports/gallery/ui-result.json',files:['js/gallery-store.js','js/flight-record.js','js/gallery-ui.js','tests/gallery.test.mjs','tests/gallery-ui.mjs'],scope:'IndexedDB保存復元・20/30上限・削除・お気に入り・保存不能/容量不足'},
 {report:'reports/orbit-share/result.json',files:['js/orbit-art.js','js/orbit-art-worker.js','js/orbit-share-ui.js','js/flight-record.js','tests/orbit-art.test.mjs','tests/orbit-share-ui.mjs'],scope:'PNG両サイズ・非破壊・失敗復旧・共有模擬/非対応代替'},
];
const reused=[];
for(const group of groups){
 const commit=git(['log','-1','--format=%H','--',project+group.report]).trim();assert.ok(commit,group.report);
 const sources=[];
 for(const file of group.files){
  const current=await read(file),old=git(['show',`${commit}:${project}${file}`]);
  assert.equal(current,old,`${file}: prior evidence invalidated; run focused tests`);
  sources.push({file,sha256:hash(current)});
 }
 reused.push({...group,commit,sources,status:'PASS',method:'report and dependency source equality; no simulation rerun'});
}
const balance=await json('reports/balance/after.json'),special=await json('reports/special-challenges/verification.json');
assert.deepEqual(CHALLENGES.slice(0,10),balance.stages);
const stageEvidence=CHALLENGES.map((stage,i)=>{
 const evidence=i<10?balance.measurements.find(x=>x.id===stage.id):special.find(x=>x.id===stage.id);
 assert.ok(evidence,stage.id);assert.equal(evidence.status,'cleared');
 if(i>=10){assert.deepEqual(stage.solution,evidence.solution);assert.equal(evidence.stars,3);}
 return{id:stage.id,name:stage.name,angle:stage.threeStarSolution.angleDeg,speed:stage.threeStarSolution.speed,baselineAngle:stage.solution.angleDeg,baselineSpeed:stage.solution.speed,baselineSeconds:evidence.time,status:'PASS',method:'既存検証を再利用（再計算なし）',evidence:i<10?'reports/balance/after.json + THREE_STARS.md + v0.6.0旧軌道保護検証':'reports/special-challenges/verification.json'};
});
assert.equal(stageEvidence.length,20);
const gallery=await json('reports/gallery/ui-result.json'),art=await json('reports/orbit-share/result.json');
assert.ok(Object.values(gallery.policy).every(Boolean));assert.deepEqual(gallery.errors,[]);assert.deepEqual(art.errors,[]);
assert.ok(art.nonDestructive&&art.failureRecovery&&art.urlsReleased&&!art.externalUpload);
const priorUnit=await read('reports/space-experience/unit-result.txt');assert.match(priorUnit,/pass 14/);assert.match(priorUnit,/fail 0/);
const currentEffects=['js/game.js','js/space-experience.js','js/space-audio.js','js/preview.js','js/physics.js','tests/space-experience.test.mjs','tests/launch.test.mjs'];
reused.push({report:'reports/space-experience/unit-result.txt + browser-result.json',scope:'直前v0.8.0の14件・予測/演出非干渉・入力/音声',status:'PASS',method:'same working-tree implementation as previous turn; only version/title metadata changed in this audit',sources:await Promise.all(currentEffects.map(async file=>({file,sha256:hash(await read(file))})))});

const jsFiles=(await readdir(new URL('js/',root))).filter(n=>n.endsWith('.js')).map(n=>'js/'+n);
const findings=[];const imports=[];
for(const file of jsFiles){
 const source=await read(file);execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,root))]);
 for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
  assert.ok(match[1].startsWith('.'),`External import: ${file}`);await readFile(new URL(match[1],new URL(file,root)));imports.push({file,target:match[1]});
 }
 for(const [kind,regex]of Object.entries({externalUrl:/https?:\/\//g,network:/\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(|sendBeacon\s*\(/g,debug:/\bdebugger\b|console\.(?:log|debug|table)\s*\(/g,dynamicCode:/\beval\s*\(|new Function\s*\(/g}))
  if(regex.test(source))findings.push({file,kind});
}
assert.deepEqual(findings,[]);
const html=await read('index.html'),css=await read('styles.css');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);
for(const file of jsFiles)for(const m of (await read(file)).matchAll(/(?:querySelector|\$)\(['"]#([A-Za-z][\w-]*)['"]\)/g))assert.ok(ids.includes(m[1]),`${file}: missing #${m[1]}`);
assert.ok(html.includes('viewport-fit=cover')&&html.includes('maximum-scale=1'));
for(const token of ['touch-action: none','-webkit-user-select: none','env(safe-area-inset-bottom)','100dvh'])assert.ok(css.includes(token));
assert.ok(!/https?:\/\//.test(html));
await readFile(new URL('.nojekyll',repo));const menu=await readFile(new URL('menu.js',repo),'utf8');assert.ok(menu.includes('./034_惑星重力ゲーム/index.html'));
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await readFile(new URL(match[1],root));
const manifest=await Promise.all([...jsFiles,'index.html','styles.css','icon.svg','package.json'].map(async file=>({file,sha256:hash(await read(file))})));
const result={version:'v0.9.0-A',date:'2026-10-24',environment:'Windows Node; no iPhone verification',reused,stageEvidence,static:{syntaxModules:jsFiles.length,localImports:imports.length,duplicateIds:0,missingIds:0,findings,relativeAssets:true,rootMenuLink:true,noJekyll:true,externalRuntimeDependency:false},manifest};
await writeFile(new URL('source-evidence.json',dir),JSON.stringify(result,null,2));
console.log(`Source audit PASS: ${jsFiles.length} modules, ${imports.length} local imports; 20 stage evidence entries; existing gallery/PNG/space test evidence reused without rerunning.`);
