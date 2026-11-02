// Local-only packaging. Never changes Pages/Sites configuration or invokes Git.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {auditRelease} from './release-audit.mjs';
import {VERSION} from '../js/data.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const marker="const debugValue=new URLSearchParams(location.search).get('debug');";
export function publicGameSource(source){
 if(source.split(marker).length!==2)throw Error('Public build refused: debug bootstrap anchor changed');
 return source.replace(marker,'const debugValue=null; // PUBLIC CANDIDATE: URL debug modes disabled at build time.');
}
export function publicHTML(source){
 for(const id of ['testLabButton','debug2Setup','labToggle','urlInvincibleBadge']){
  const lines=source.split('\n').filter(line=>line.includes(`id="${id}"`));
  if(lines.length!==1)throw Error('Public build refused: entry anchor '+id);
  // Inert placeholders preserve normal UI synchronization without keeping a
  // launch control. LAB content remains unreachable behind the bootstrap gate.
  source=source.replace(lines[0],id==='testLabButton'?'':`      <span id="${id}" hidden></span>`);
 }
 return source;
}
export async function buildPublicCandidate(){
 const audit=await auditRelease();if(audit.status!=='PASS')throw Error('Source static audit must PASS before packaging');
 const base=join(root,'reports/final-release-audit');mkdirSync(base,{recursive:true});
 // Unique output: never delete or overwrite a previous candidate or workspace.
 const container=mkdtempSync(join(base,'public-candidate-')),destination=join(container,'031_ファミコン風地球防衛軍');mkdirSync(destination);
 const files=[];
 for(const row of audit.runtimeFiles){
  const path=row.path;if(!/^(?:index\.html|styles\.css|js\/[^/]+\.js|assets\/[^]*\.(?:png|svg|json))$/.test(path)||path.split('/').includes('..'))throw Error('Unexpected runtime path: '+path);
  let bytes=readFileSync(join(root,path));if(path==='js/game.js')bytes=Buffer.from(publicGameSource(bytes.toString('utf8')));if(path==='index.html')bytes=Buffer.from(publicHTML(bytes.toString('utf8')));
  const target=resolve(destination,path);if(!target.startsWith(destination+sep))throw Error('Output outside candidate');mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,bytes);
  files.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const manifest={version:VERSION,profile:'PUBLIC_CANDIDATE',published:false,debugModesEnabled:false,root:relative(root,destination).split(sep).join('/'),files,sourceAudit:audit.status,excluded:audit.publication.nonRuntimeFiles.filter(p=>!p.startsWith('reports/final-release-audit/public-candidate-')),limitations:['Local candidate only; existing main/root and Sites dist configuration unchanged','Retains unreachable LAB implementation/markup; startup cannot enable debug modes','Not authentication; a user can modify their own downloaded client','No real browser, Safari device or live Pages verification']};
 writeFileSync(join(base,'public-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))buildPublicCandidate().then(m=>console.log(JSON.stringify({profile:m.profile,root:m.root,files:m.files.length,published:false}))).catch(e=>{console.error(e.message);process.exitCode=1});
