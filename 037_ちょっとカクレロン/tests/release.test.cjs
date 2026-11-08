const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {APP,VERSION,FILES}=require('../scripts/release-config.cjs');
const {plan,buildApp,verifyArtifact,walk,hash}=require('../scripts/build-release.cjs');
function directory(t){
  const parent=path.join(APP,'release');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'test-'));
  // root was just allocated under app/release; no arbitrary cleanup paths.
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;
}
test('release contains exactly the runtime allowlist, fingerprints and matching versions',t=>{
  const out=path.join(directory(t),'artifact'),manifest=buildApp(out);
  assert.equal(manifest.files.length,13);assert.equal(FILES.length,13);assert.equal(verifyArtifact(out).files,13);
  assert.ok(!walk(out).some(f=>/^(?:tests|docs|scripts|release|node_modules)\/|README|\.cjs$|\.ya?ml$|\.map$/.test(f)));
  for(const file of manifest.files){
    if(!['index.html','assets/menu-icon.svg'].includes(file.file))assert.match(file.file,/\.[a-f0-9]{12}\.(?:js|css|svg)$/);
    assert.equal(hash(fs.readFileSync(path.join(out,file.file))),file.sha256);
  }
  const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  assert.match(html,new RegExp(`application-version" content="${VERSION.replaceAll('.','\\.')}"`));
  assert.equal(fs.readFileSync(path.join(out,'assets/menu-icon.svg'),'utf8'),fs.readFileSync(path.join(APP,'assets/menu-icon.svg'),'utf8'));
  const poses=fs.readFileSync(path.join(out,manifest.names['poses.js']),'utf8');
  for(const pose of require('../poses.js').list)assert.ok(poses.includes(manifest.names[pose.silhouette]));
  assert.equal(require(path.join(out,manifest.names['paint.js'])).HISTORY_LIMIT,25);
  assert.equal(require(path.join(out,manifest.names['export.js'])).MAX_EDGE,2048);
});
test('artifact validation fails on missing files, unexpected development files and modified bytes',t=>{
  const out=path.join(directory(t),'artifact'),manifest=buildApp(out),file=manifest.files.find(f=>f.file.endsWith('.js'));
  const target=path.join(out,file.file),original=fs.readFileSync(target);
  fs.unlinkSync(target);assert.throws(()=>verifyArtifact(out),/file set mismatch/);fs.writeFileSync(target,original);
  fs.writeFileSync(path.join(out,'private-photo.png'),'not a photo');assert.throws(()=>verifyArtifact(out),/file set mismatch/);fs.unlinkSync(path.join(out,'private-photo.png'));
  fs.appendFileSync(target,'\n// modified');assert.throws(()=>verifyArtifact(out),/content mismatch/);
});
test('release builds are deterministic and unsafe output destinations cannot be removed',t=>{
  const root=directory(t),a=buildApp(path.join(root,'a')),b=buildApp(path.join(root,'b'));
  assert.deepEqual(a,b);assert.deepEqual(a.files,plan().manifest.files);
  for(const target of [APP,path.dirname(APP),path.join(APP,'assets'),path.join(APP,'release')])assert.throws(()=>buildApp(target),/Output must/);
  const workflow=fs.readFileSync(path.join(APP,'scripts/pages-release.workflow.yml'),'utf8');
  assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/\n  push:/);
  assert.match(workflow,/default: false/);assert.match(workflow,/if: inputs.deploy/);
  assert.match(workflow,/path: '037_ちょっとカクレロン\/release\/pages'/);
});
