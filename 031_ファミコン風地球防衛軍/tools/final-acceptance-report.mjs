// Aggregate executed evidence, never certify a device or a human clear from QA.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../js/data.js';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=resolve(root,'reports/final-acceptance');mkdirSync(dir,{recursive:true});
const qa=JSON.parse(readFileSync(resolve(root,'reports/campaign-integration/results.json'),'utf8'));
const audit=JSON.parse(readFileSync(resolve(dir,'release-audit.json'),'utf8'));
const httpPath=resolve(dir,'local-http.json'),http=existsSync(httpPath)?JSON.parse(readFileSync(httpPath,'utf8')):null;
const log=readFileSync(resolve(root,'reports/campaign-integration/related-tests.txt'),'utf8');
const manual=readFileSync(resolve(dir,'manual-playthrough.csv'),'utf8').trim().split(/\r?\n/).map(line=>line.split(','));
if(manual.length!==9||manual.some(line=>line.length!==22)||manual.slice(1).some(line=>line[1]!=='NOT RUN'||line[20]!==VERSION))throw Error('Manual template schema/status/version mismatch; do not certify incomplete rows');
const count=Number(log.match(/ℹ tests (\d+)/)?.[1]??0),failed=Number(log.match(/ℹ fail (\d+)/)?.[1]??-1);
const row=(id,status,source,detail)=>({id,status,source,detail});
const group=(id,pattern,expected)=>{const rows=qa.cases.filter(c=>pattern.test(c.id));return row(id,qa.version===VERSION&&rows.length===expected&&rows.every(r=>r.status==='PASS')?'PASS':'FAIL','npm run qa',`${rows.filter(r=>r.status==='PASS').length}/${expected}; ${rows.length} recorded`)};
const checks=[group('CHAIN_M01_M08',/^CHAIN-M0[1-8]$/,8),group('ROUTES_32',/^ROUTE-/,32),group('STARTER_ATTACKS_64',/^STARTER-/,64),group('WEAPONS_20',/^WEAPON-/,20),group('SAVES_10',/^SAVE-/,10),group('LAB_ISOLATION',/^ISOLATION-/,2),
 row('RELATED_NODE',qa.version===VERSION&&failed===0&&count>0?'PASS':'FAIL','related-tests.txt',`${count} tests; ${failed} failures`),
 row('RELEASE_STATIC',audit.version===VERSION&&audit.status==='PASS'?'PASS':'FAIL','release-audit.json',`${audit.runtimeFiles.length} runtime files / ${audit.referenceCount} references; local, not HTTP`),
 row('LOCAL_HTTP',!http?'NOT RUN':http.version===VERSION&&http.status==='PASS'?'PASS':'FAIL','local-http.json',http?`${http.runtimeFileCount} runtime files / ${http.checks} checks; temporary loopback subdirectory simulation, NOT browser/production hosting`:'Run node tools/acceptance-http-smoke.mjs after release audit'),
 row('B1_MOVEMENT_FEEL','PASS','USER_REPORTED','B1 iPhone feel restored, reported in current request; no independent device measurement'),
 row('B1_LOCATOR_REMOVAL','PASS','USER_REPORTED','B1 brackets absent, reported in current request'),
 row('A1_M03_RESULT','PASS','USER_REPORTED','A1 M03 WING result transition confirmed by user; input details/OS version not supplied'),
 ...Array.from({length:8},(_,i)=>row('HUMAN_M0'+(i+1),'NOT RUN','manual template','No normal-difficulty human full-clear evidence supplied')),
 row('IPHONE_FINAL_MATRIX','NOT RUN','device checklist','Only the three specific user-confirmed regression items above are PASS'),
 row('FOREGROUND_PERFORMANCE','BLOCKED','performance.json','Browser access host unavailable; native Chrome app approval timed out; no foreground/device samples'),
 row('LIVE_PAGES_CONFIGURATION','NOT RUN','local repository only','No remote settings or live-site HTTP check, no publishing'),
 row('ASSET_RIGHTS_OWNER_CONFIRMATION','NOT RUN','local source provenance','Original generators present, external asset imports not detected; owner sign-off not inferred')];
const scenarios=['30_ENEMIES','50_ENEMIES','100_ENEMIES','LAB_200_ENEMIES','EXPLOSION_BURST','PIERCE_MULTI_HIT','B08_FORM3'];
const performance=scenarios.map(id=>({id,status:'BLOCKED',source:'NO_BROWSER_MEASUREMENT',effectiveFps:null,frameMs:null,samples:0,excludedSamples:0,enemies:null,shots:null,effects:null,zoom:null,reason:'No foreground/browser/device run; zero is not 0 FPS or 0 enemies'}));
writeFileSync(resolve(dir,'performance.json'),JSON.stringify({version:VERSION,rows:performance},null,2)+'\n');
const issues=[{id:'C-M01',severity:'MEDIUM',status:'RESOLVED',description:'Normal URL exposed legacy QA mutation API; now DEBUG gated, with normal/debug regression tests'},
 {id:'C-L01',severity:'LOW',status:'OPEN',description:'Branch/root publication can expose development reports with local path strings. Runtime allowlist supplied; remote deployment scope unverified'},
 ...(audit.arcade.descriptionOutdated?[{id:'C-L02',severity:'LOW',status:'OPEN',description:'Arcade031 description still says eight weapons. Link/icon unchanged; parent directory not edited'}]:[]),
 {id:'C-L03',severity:'LOW',status:'OPEN',description:'Legacy tests/data.test.mjs and tests/runtime.test.mjs still contain M07 COMING SOON expectations by source review; not in the executed related suite. Full npm test not run; do not claim it passes'}];
const autoFailed=qa.version!==VERSION||qa.summary.fail>0||checks.some(c=>c.status==='FAIL');
const result={version:VERSION,generatedAt:new Date().toISOString(),decision:autoFailed?'NOT READY':'CONDITIONAL',
 rationale:autoFailed?'Mandatory automatic verification failed or evidence version mismatch':'Automated checks pass; human normal-difficulty clears, final iPhone matrix, foreground performance and remote publication scope remain unverified',
 qa:{...qa.summary,relatedTests:count,relatedFailed:failed},checks,issues,performanceSource:'performance.json',
 notes:['USER_REPORTED is not independent Codex device evidence','NORMAL_SIM NOT_CLEARED does not establish impossible normal difficulty','No publish/commit/push/deploy; only isolated in-memory saves used','Actual Safari save data never accessed or reset']};
writeFileSync(resolve(dir,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({decision:result.decision,qa:result.qa,statuses:Object.fromEntries(['PASS','FAIL','NOT RUN','BLOCKED'].map(s=>[s,checks.filter(c=>c.status===s).length]))}));if(autoFailed)process.exitCode=1;
