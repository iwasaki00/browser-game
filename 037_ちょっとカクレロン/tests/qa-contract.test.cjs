const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Poses=require('../poses.js');
const root=path.resolve(__dirname,'..');

test('all shipped HTML and pose resources exist with exact case and local relative paths',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const refs=[...html.matchAll(/(?:src|href)="([^"?#]+)(?:[^\"]*)"/g)].map(m=>m[1]).concat(Poses.list.map(p=>p.silhouette));
  assert.ok(refs.length>10);
  for(const ref of refs){
    assert.ok(!/^(?:[a-z]+:|\/)/i.test(ref)&&!ref.split('/').includes('..'),ref);
    let directory=root;
    for(const part of ref.split('/')){
      assert.ok(fs.readdirSync(directory).includes(part),`missing or case mismatch: ${ref}`);
      directory=path.join(directory,part);
    }
    assert.ok(fs.statSync(directory).isFile(),ref);
  }
});

test('privacy contract forbids runtime upload, persistence, analytics and remote dependencies',()=>{
  // A regression guard for known API spellings, complemented by the browser
  // network/storage probe and manual data-flow audit; not a general proof.
  const files=['index.html','style.css','startup.js','app.js','poses.js','paint.js','copy-brush.js','editor-view.js','export.js'];
  for(const file of files){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(source,/https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|console\./,file);
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/connect-src 'none'/);
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  assert.equal([...app.matchAll(/navigator\.share\(/g)].length,1);
  assert.match(app,/querySelector\("#share-question"\)\.addEventListener\("click", shareQuestion\)/);
});
