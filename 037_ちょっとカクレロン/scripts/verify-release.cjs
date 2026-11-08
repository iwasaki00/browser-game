// Local-only checks. Uses existing Playwright/Chrome; no install or deployment.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {APP,VERSION}=require('./release-config.cjs');
function run(args,env={}){
  const result=spawnSync(process.execPath,args,{cwd:APP,stdio:'inherit',env:{...process.env,...env}});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${args[0]} failed (${result.status})`);
}
try{
  run(['scripts/build-release.cjs','--pages']);
  run(['--test','tests/*.test.cjs']);
  run(['tests/browser-qa.cjs'],{QA_APP_ROOT:'',QA_BASE_PATH:'/',QA_ARTIFACT_DIR:'docs/qa-v071/source'});
  run(['tests/browser-qa.cjs'],{QA_APP_ROOT:`release/pages/${path.basename(APP)}`,QA_BASE_PATH:`/browser-game/${path.basename(APP)}/`,QA_ARTIFACT_DIR:'docs/qa-v071/artifact'});
  const files=['P01','P02','P03','P04'].flatMap(id=>['question','answer'].map(kind=>`${id}-${kind}.png`)).concat('oriented-question.png');
  for(const file of files)assert.deepEqual(fs.readFileSync(path.join(APP,'docs/qa-v071/source',file)),fs.readFileSync(path.join(APP,'docs/qa-v071/artifact',file)),`Source/artifact PNG mismatch: ${file}`);
  const {hash}=require('./build-release.cjs');
  const result={version:VERSION,status:'PASS',comparison:'exact PNG bytes, source vs isolated nested artifact',files:files.map(file=>({file,sha256:hash(fs.readFileSync(path.join(APP,'docs/qa-v071/artifact',file)))}))};
  fs.writeFileSync(path.join(APP,'docs/qa-v071/png-parity.json'),JSON.stringify(result,null,2)+'\n');
  fs.copyFileSync(path.join(APP,'release/pages-manifest.json'),path.join(APP,'docs/qa-v071/pages-manifest.json'));
  const manifest=require(path.join(APP,'release/pages-manifest.json'));
  fs.writeFileSync(path.join(APP,'docs/qa-v071/app-files.txt'),manifest.appManifest.files.map(f=>`${f.file}  ${f.sha256}`).join('\n')+'\n');
  console.log(`PASS: ${VERSION} source/artifact PNG parity (${files.length} pairs)`);
}catch(error){console.error(error.message);process.exitCode=1;}
