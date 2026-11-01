// Local-only release audit. Findings contain rule/file names, never secret values.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'reports/final-acceptance');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.posix.join(dir,e.name)):[path.posix.join(dir,e.name)]);
const runtime=['index.html','styles.css','icon.svg',...walk('js')];
const manifest=runtime.map(file=>({file,bytes:fs.statSync(path.join(root,file)).size,sha256:sha(file)}));
const baseline=JSON.parse(read('reports/space-scanner/protected-hashes.json')).files;
const protectedFiles=Object.entries(baseline).map(([file,hash])=>({file,unchanged:sha(file)===hash}));
assert.ok(protectedFiles.every(x=>x.unchanged),'Protected gameplay source changed');
const findings=[],references=[],syntax=[];
for(const file of runtime){
 const text=read(file);
 for(const [rule,re] of [
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['cloud-access-key',/\bAKIA[A-Z0-9]{16}\b/],
  ['github-token',/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/],
  ['api-secret-assignment',/\b(?:api_?key|client_?secret|password)\s*[:=]\s*['"][^'"]{8,}['"]/i],
  ['external-resource',/(?:src|href)\s*=\s*['"](?:https?:)?\/\//i],
  ['runtime-network',/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|sendBeacon\s*\()/],
  ['debug-exposure',/\b(?:debugger|console\.(?:log|debug)|__DEBUG__)\b/],
 ])if(re.test(text))findings.push({file,rule});
 if(file.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  syntax.push({file,status:result.status===0?'PASS':'FAIL'});
  assert.equal(result.status,0,'Syntax: '+file);
 }
 const re=file.endsWith('.html')?/(?:src|href)=["'](\.\/[^"'#]+)["']/g:/(?:from\s*|import\s*\(|new URL\s*\()\s*['"](\.[^'"]+)['"]/g;
 for(const match of text.matchAll(re)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
  references.push({from:file,to:target,exists:runtime.includes(target)});
 }
}
assert.ok(references.every(r=>r.exists),'Missing relative runtime reference');
assert.deepEqual(findings,[],'Review audit rule findings; do not print source values');
const preview=path.join(root,'release-preview');
fs.mkdirSync(preview,{recursive:true});
for(const row of manifest){const target=path.join(preview,row.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,row.file),target);}
// Reject unexpected files instead of deleting anything automatically.
assert.deepEqual(walk('release-preview').map(p=>p.slice('release-preview/'.length)).sort(),runtime.slice().sort());
const summary={version:JSON.parse(read('package.json')).version,status:'PASS',runtimeFiles:manifest.length,runtimeBytes:manifest.reduce((a,b)=>a+b.bytes,0),manifest,protectedFiles,references,syntax,findings,staging:'release-preview (local only)',license:fs.existsSync(path.join(root,'LICENSE'))?'present':'UNVERIFIED: owner must choose public source licensing',limits:['Pattern checks are not a complete secret detector','No deployment or real personal storage accessed']};
fs.writeFileSync(path.join(out,'release-audit.json'),JSON.stringify(summary,null,2)+'\n');
const qa=JSON.parse(read('reports/final-acceptance/all-final.json'));
for(const file of ['classic-progression.json','homeward-progression.json']){
 const source=path.join(qa.temporaryCopy,'reports/quality-assurance',file);
 assert.ok(fs.existsSync(source));fs.copyFileSync(source,path.join(out,file));
}
console.log(JSON.stringify({status:summary.status,version:summary.version,files:summary.runtimeFiles,bytes:summary.runtimeBytes,protected:protectedFiles.length,references:references.length,license:summary.license}));
