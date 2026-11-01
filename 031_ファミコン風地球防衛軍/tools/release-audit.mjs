// Local static release audit. No deploy, remote access, browser or user storage.
import {readFileSync,readdirSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtime} from '../tests/helpers/runtime.mjs';
import {ArtPreview} from '../js/art-preview.js';
import {loadCoastalArt} from '../js/coastal-art.js';
import {loadSkyArt} from '../js/sky-art.js';
import {loadMobileArt} from '../js/mobile-art.js';
import {loadLivingArt} from '../js/living-art.js';
import {loadMothershipArt} from '../js/mothership-art.js';
import {loadFinalArt} from '../js/final-art.js';
import {VERSION} from '../js/data.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const clean=s=>decodeURIComponent(s.split(/[?#]/)[0]);
const hash=b=>createHash('sha256').update(b).digest('hex');
export function inspectText(text,path,scope='RUNTIME'){
 const findings=[];
 const rules=[['PRIVATE_KEY',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,'HIGH'],
  ['GITHUB_TOKEN',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g,'HIGH'],
  ['AWS_ACCESS_ID',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,'HIGH'],
  ['SLACK_TOKEN',/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,'HIGH'],
  ['CREDENTIAL_LITERAL',/\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-/+=]{20,}['"]/gi,'HIGH'],
  ['LOCAL_ABSOLUTE_PATH',/(?:[A-Za-z]:[\\/](?:Users|_wk|ProgramData)[\\/]|\/Users\/|\/home\/)/g,scope==='RUNTIME'?'MEDIUM':'LOW']];
 for(const [rule,regex,severity] of rules)for(const m of text.matchAll(regex))findings.push({rule,severity,path,line:text.slice(0,m.index).split('\n').length,scope});
 // No matching value or surrounding snippet is ever put in the report.
 return findings;
}
export function resolveReference(from,ref){
 if(!ref||ref.startsWith('#')||/^(?:data:|blob:)/.test(ref))return {skip:true};
 if(/^(?:[a-z]+:)?\/\//i.test(ref))return {external:true};
 if(ref.startsWith('/'))return {error:'ROOT_ABSOLUTE_URL'};
 const path=resolve(dirname(resolve(root,from)),clean(ref));
 if(!path.startsWith(resolve(root)+sep))return {error:'OUTSIDE_PROJECT'};
 return {path:relative(root,path).split(sep).join('/')};
}
const walk=dir=>readdirSync(dir,{withFileTypes:true}).filter(e=>!['.git','node_modules','__pycache__'].includes(e.name)).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const exactCase=path=>{let base=root;for(const part of path.split('/')){if(!readdirSync(base).includes(part))return false;base=resolve(base,part)}return true};
export async function auditRelease(){
 const issues=[],files=new Map(),references=[],external=[],pending=['index.html','styles.css'];
 const r=runtime(null,{recordDraw:false});
 const add=(from,ref,size=null)=>{const result=resolveReference(from,ref);if(result.skip)return;if(result.external){external.push({from,reference:'[external URL omitted; inspect source]'});return}if(result.error){issues.push({rule:result.error,severity:'HIGH',path:from});return}
  references.push({from,path:result.path});if(!files.has(result.path)){files.set(result.path,{path:result.path,size});pending.push(result.path)}else if(size)files.get(result.path).size=size;
 };
 for(const file of r.json('Object.values(imageFiles)'))add('index.html',file);
 const loader=async(path,w,h,prefix='assets/art-refresh/study-01/')=>{add('index.html',prefix+path,[w,h]);return {src:prefix+path,naturalWidth:w,naturalHeight:h}};
 const art=new ArtPreview();for(const style of ['STUDY_01','STUDY_01_B','UNIFIED_01'])await art.select(style,loader);
 for(const load of [loadCoastalArt,loadSkyArt,loadMobileArt,loadLivingArt,loadMothershipArt,loadFinalArt])await load(loader);
 const visited=new Set();
 while(pending.length){const path=pending.shift();if(visited.has(path))continue;visited.add(path);if(!files.has(path))files.set(path,{path,size:null});const absolute=resolve(root,path);
  if(!existsSync(absolute)||!statSync(absolute).isFile()){issues.push({rule:'MISSING_FILE',severity:'HIGH',path});continue}
  if(!exactCase(path))issues.push({rule:'CASE_MISMATCH',severity:'HIGH',path});
  const data=readFileSync(absolute),row=files.get(path);row.bytes=data.length;row.sha256=hash(data);
  if(extname(path)==='.png'){
   if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')issues.push({rule:'PNG_SIGNATURE',severity:'HIGH',path});
   else{row.dimensions=[data.readUInt32BE(16),data.readUInt32BE(20)];if(row.size&&String(row.size)!==String(row.dimensions))issues.push({rule:'PNG_DIMENSIONS',severity:'HIGH',path})}
  }
  if(!['.html','.css','.js','.svg'].includes(extname(path)))continue;const text=data.toString('utf8');issues.push(...inspectText(text,path));
  if(extname(path)==='.html')for(const m of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g))add(path,m[1]);
  if(extname(path)==='.css')for(const m of text.matchAll(/url\(\s*["']?([^\s)"']+)/g))add(path,m[1]);
  if(extname(path)==='.js'){
   for(const m of text.matchAll(/\bimport\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g)){if(!m[1].startsWith('.'))issues.push({rule:'NONLOCAL_IMPORT',severity:'HIGH',path});else add(path,m[1])}
   for(const m of text.matchAll(/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|sendBeacon)\s*\(/g))issues.push({rule:'NETWORK_API_REVIEW',severity:'MEDIUM',path,line:text.slice(0,m.index).split('\n').length});
  }
 }
 const allFiles=walk(root),nonRuntime=allFiles.map(p=>relative(root,p).split(sep).join('/')).filter(p=>!files.has(p));
 const sourceFindings=[];for(const path of nonRuntime)if(/\.(?:md|json|txt|js|mjs|py|html|css|svg|ya?ml)$/.test(path))sourceFindings.push(...inspectText(readFileSync(resolve(root,path),'utf8'),path,'SOURCE_ONLY'));
 const normalHook=r.run('!!window.__PDF_GAME__');if(normalHook)issues.push({rule:'NORMAL_DEBUG_MUTATION_API',severity:'MEDIUM',path:'js/game.js'});
 const menuPath=resolve(root,'../menu.js'),menu=readFileSync(menuPath,'utf8'),entry=menu.match(/\{\s*number:\s*"031"[\s\S]*?\n\s*\}/)?.[0]??'';
 const arcade={status:entry.includes('href: "./031_ファミコン風地球防衛軍/index.html"')&&entry.includes('assets/game-icon.svg')?'PASS':'FAIL',menuSha256:hash(menu),descriptionOutdated:entry.includes('8種類の武器')};
 if(arcade.status==='FAIL')issues.push({rule:'ARCADE031_LINK',severity:'HIGH',path:'../menu.js'});
 const packageData=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 if(external.length)issues.push({rule:'EXTERNAL_RUNTIME_REFERENCE',severity:'MEDIUM',path:'runtime graph'});
 const sensitive=sourceFindings.filter(f=>f.rule!=='LOCAL_ABSOLUTE_PATH');
 return {version:VERSION,generatedAt:new Date().toISOString(),method:'local static graph + exported image registries + isolated VM; no HTTP/device/remote Pages check',
  status:issues.some(i=>i.severity==='HIGH')||sensitive.length?'FAIL':issues.length?'REVIEW':'PASS',runtimeIssues:issues,sourceSensitiveFindings:sensitive,sourceAbsolutePathFindings:sourceFindings.filter(f=>f.rule==='LOCAL_ABSOLUTE_PATH'),
  runtimeFiles:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),referenceCount:references.length,externalRuntimeReferences:external,
  normalDebugMutationAPI:normalHook,lab:'debug=1 opt-in local-only test environment; NOT authentication; ordinary URL hides UI',
  dependencies:packageData.dependencies??{},devDependencies:packageData.devDependencies??{},arcade,
  publication:{localDocumentedMethod:'parent README: main branch / repository root',remoteSettings:'NOT RUN',workflowPresent:existsSync(resolve(root,'../.github/workflows')),nojekyllPresent:existsSync(resolve(root,'../.nojekyll')),
   sourceExposure:'Root publishing may also expose docs/reports/tests/tools. Runtime allowlist is runtimeFiles; no deploy configuration changed.',nonRuntimeFiles:nonRuntime.sort()},
  limitations:['Pattern-based secret scan is not a proof of absence or full Git-history scan','Image existence/signature/dimensions, not device decode/visual QA','No remote Pages setting or live URL/404 check','Asset authorship/licensing needs owner confirmation; local provenance only']};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){const result=await auditRelease();mkdirSync(resolve(root,'reports/final-acceptance'),{recursive:true});writeFileSync(resolve(root,'reports/final-acceptance/release-audit.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,files:result.runtimeFiles.length,references:result.referenceCount,runtimeIssues:result.runtimeIssues,sourceSensitive:result.sourceSensitiveFindings.length,sourcePathFindings:result.sourceAbsolutePathFindings.length,arcade:result.arcade.status}));if(result.status==='FAIL')process.exitCode=1}
