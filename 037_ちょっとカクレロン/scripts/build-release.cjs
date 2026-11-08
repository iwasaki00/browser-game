// Dependency-free release preparation. Never changes GitHub settings or deploys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { APP, VERSION, FILES } = require('./release-config.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const inside = (root, target) => target.startsWith(root + path.sep);
function regularFile(root, relative) {
  if (!relative || relative.split('/').some(p => !p || p === '.' || p === '..') || path.isAbsolute(relative)) throw new Error(`Unsafe path: ${relative}`);
  let current = root;
  for (const part of relative.split('/')) {
    if (!fs.readdirSync(current).includes(part)) throw new Error(`Missing/case mismatch: ${relative}`);
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink not allowed: ${relative}`);
  }
  if (!fs.statSync(current).isFile()) throw new Error(`Not a file: ${relative}`);
  return current;
}
function outputDirectory(target) {
  const out = path.resolve(target), release = path.join(APP, 'release');
  // Check the final absolute target before every recursive removal. Never touch
  // the source tree, repository root, another game, or an arbitrary caller path.
  if (out !== path.join(APP, 'dist') && !inside(release, out)) throw new Error('Output must be dist or a child of this app/release');
  let current = out;
  while (inside(APP, current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Output symlink not allowed');
    current = path.dirname(current);
  }
  if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  return out;
}
function plan() {
  const input = new Map(FILES.map(file => [file, fs.readFileSync(regularFile(APP, file))]));
  const html = input.get('index.html').toString();
  if (!html.includes(`application-version" content="${VERSION}"`) || !html.includes(`v${VERSION} <span>RELEASE PREP / 公開準備`)) throw new Error('HTML/runtime version mismatch');
  for (const [,version] of html.matchAll(/\.(?:js|css)\?v=([^"']+)/g)) if (version !== VERSION) throw new Error('Source cache key mismatch');
  const names = {}, content = new Map();
  const fingerprint = (file, bytes) => {
    const extension = path.posix.extname(file);
    return file.slice(0, -extension.length) + '.' + hash(bytes).slice(0, 12) + extension;
  };
  for (const [file, bytes] of input) if (file.endsWith('.svg')) {
    // Parent menu references this stable, unchanged icon path.
    names[file] = file === 'assets/menu-icon.svg' ? file : fingerprint(file, bytes);
    content.set(names[file], bytes);
  }
  const rewriteAssets = text => Object.entries(names).reduce((s,[from,to]) => s.replaceAll(from,to),text);
  for (const [file, bytes] of input) if (/\.(?:js|css)$/.test(file)) {
    const transformed = Buffer.from(rewriteAssets(bytes.toString('utf8')));
    names[file] = fingerprint(file, transformed);
    content.set(names[file], transformed);
  }
  const outputHTML = html.replace(/((?:src|href)=["'])([^"']+)(["'])/g, (all,start,ref,end) => {
    const name = names[ref.split('?')[0]];
    if (!name) throw new Error(`Undeclared HTML asset: ${ref}`);
    return `${start}${name}?v=${VERSION}${end}`;
  });
  names['index.html'] = 'index.html';
  content.set('index.html', Buffer.from(outputHTML));
  const files = [...content].map(([file,bytes]) => ({file,bytes:bytes.length,sha256:hash(bytes)})).sort((a,b)=>a.file.localeCompare(b.file,'en'));
  return { content, manifest: {version:VERSION,files,names} };
}
function walk(root, relative = '') {
  return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
    if(entry.isSymbolicLink())throw new Error('Artifact contains a symlink');
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root,name) : [name];
  }).sort();
}
function verifyArtifact(out, manifest = plan().manifest) {
  const actual=walk(out),expected=manifest.files.map(f=>f.file).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Artifact file set mismatch (missing or unexpected files)');
  for(const entry of manifest.files)if(hash(fs.readFileSync(regularFile(out,entry.file)))!==entry.sha256)throw new Error(`Artifact content mismatch: ${entry.file}`);
  const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  for(const [,ref]of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const [file,query]=ref.split('?');regularFile(out,file);
    if(query!==`v=${VERSION}`)throw new Error('Artifact asset version mismatch');
  }
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(out,manifest.names['poses.js']),'utf8'),{module});
  for(const pose of module.exports.list)regularFile(out,pose.silhouette);
  for(const file of actual.filter(f=>/\.(?:html|js|css)$/.test(f))){
    const text=fs.readFileSync(path.join(out,file),'utf8');
    for(const [,dependency]of text.matchAll(/require\("\.\/([^"]+)"\)/g))regularFile(out,dependency);
    if(/https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|console\.|[A-Za-z]:\\|file:\/\/\//.test(text))throw new Error(`Review runtime network/storage/log/local path: ${file}`);
  }
  return {version:VERSION,files:actual.length,missing:0,unexpected:0,hashes:'PASS',references:'PASS',privacy:'PASS'};
}
function buildApp(out = path.join(APP,'dist')) {
  const prepared=plan(); // Validate everything before replacing previous output.
  out=outputDirectory(out);
  for(const [file,bytes]of prepared.content){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  return {...prepared.manifest,validation:verifyArtifact(out,prepared.manifest)};
}
const excludedRoot = file => /^(?:\.github|\.openai|\.vite)(?:\/|$)/.test(file) || ['.gitignore','README.md'].includes(file);
function stagePages(out = path.join(APP,'release','pages')) {
  const appManifest=buildApp();
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:APP,encoding:'utf8'}).trim();
  const appPath=path.relative(repo,APP).split(path.sep).join('/');
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const tracked=execFileSync('git',['ls-tree','-r','-z',revision],{cwd:repo,maxBuffer:16*1024*1024}).toString().split('\0').filter(Boolean);
  const others=[],excluded=[];
  // Preserve other games from the committed snapshot, not concurrent edits in
  // their working trees. No Git index, branch or source file is modified.
  for(const entry of tracked){
    const match=entry.match(/^(\d+) blob ([a-f0-9]+)\t([\s\S]+)$/);
    if(!match)throw new Error('Unsupported Git tree entry');
    const file=match[3];
    if(file===appPath||file.startsWith(appPath+'/')||excludedRoot(file)){excluded.push(file);continue;}
    if(!['100644','100755'].includes(match[1]))throw new Error(`Unsupported tracked mode: ${file}`);
    others.push({file,object:match[2]});
  }
  const batch=execFileSync('git',['cat-file','--batch'],{cwd:repo,input:others.map(f=>f.object+'\n').join(''),maxBuffer:512*1024*1024});
  let offset=0;
  for(const file of others){
    const end=batch.indexOf(10,offset),header=batch.toString('ascii',offset,end).match(/^([a-f0-9]+) blob (\d+)$/);
    if(!header||header[1]!==file.object)throw new Error('Git blob read failed');
    const length=Number(header[2]);file.bytes=batch.subarray(end+1,end+1+length);file.sha256=hash(file.bytes);offset=end+1+length+1;
  }
  out=outputDirectory(out);
  for(const {file,bytes}of others){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  const appOut=path.join(out,appPath);fs.mkdirSync(appOut,{recursive:true});
  for(const file of appManifest.files){const target=path.join(appOut,file.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(APP,'dist',file.file),target);}
  const actual=walk(out),expected=[...others.map(f=>f.file),...appManifest.files.map(f=>`${appPath}/${f.file}`)].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Shared Pages file set mismatch');
  for(const file of others)if(hash(fs.readFileSync(path.join(out,file.file)))!==file.sha256)throw new Error(`Other project changed: ${file.file}`);
  verifyArtifact(appOut,appManifest);
  const menu=fs.readFileSync(path.join(out,'menu.js'),'utf8');
  if(!menu.includes(`./${appPath}/index.html`)||!menu.includes(`./${appPath}/assets/menu-icon.svg`))throw new Error('Existing menu path mismatch');
  return {version:VERSION,revision,appPath,appManifest,otherFiles:others.length,totalFiles:actual.length,otherFilesByteIdentical:true,excludedRoot:excluded.filter(f=>!f.startsWith(appPath+'/')),applicationDevelopmentFilesExcluded:true,appliedToGitHub:false};
}
if(require.main===module){
  try{
    const shared=process.argv.includes('--pages'),report=shared?stagePages():buildApp();
    fs.mkdirSync(path.join(APP,'release'),{recursive:true});
    fs.writeFileSync(path.join(APP,'release',shared?'pages-manifest.json':'app-manifest.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({version:VERSION,output:shared?'release/pages':'dist',files:shared?report.totalFiles:report.files.length,validation:shared?'PASS; other tracked files byte-identical':report.validation}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={plan,buildApp,verifyArtifact,stagePages,walk,hash};
