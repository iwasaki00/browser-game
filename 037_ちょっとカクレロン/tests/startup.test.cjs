const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function setup(protocol='https:'){
  const events={},labels=[{handlers:{}},{handlers:{}}],notice={hidden:false,textContent:'準備中'},status={textContent:''},dataset={};
  let clicks=0,failClick=false;
  const input={click(){clicks++;if(failClick)throw new Error('private file information');}};
  for(const label of labels)label.addEventListener=(type,fn)=>label.handlers[type]=fn;
  const document={documentElement:{dataset},querySelector:q=>q==='#startup-status'?notice:q==='#image-input'?input:status,querySelectorAll:()=>labels};
  vm.runInNewContext(fs.readFileSync('startup.js','utf8'),{document,location:{protocol},window:{addEventListener:(name,fn)=>events[name]=fn}});
  return {events,labels,notice,status,dataset,clicks:()=>clicks,failClick:()=>failClick=true};
}
test('startup failures have a safe distinct message; successful initialization stays ready',()=>{
  for(const protocol of ['https:','file:']){
    const a=setup(protocol);a.events.error({message:'private-photo.jpg',filename:'private-path'});
    assert.match(a.notice.textContent,/アプリを起動できません/);
    assert.doesNotMatch(a.notice.textContent,/private|JPEG|PNG/);
    if(protocol==='file:')assert.match(a.notice.textContent,/HTTP\(S\)/);
  }
  const a=setup();a.dataset.appReady='true';a.notice.hidden=true;
  a.events.error();a.events.unhandledrejection();a.events.load();assert.equal(a.notice.hidden,true);
});
test('both labels activate synchronously by Enter/Space and picker errors are not decode errors',()=>{
  const a=setup();let prevented=0;
  for(const [index,key]of ['Enter',' '].entries())a.labels[index].handlers.keydown({key,repeat:false,preventDefault:()=>prevented++});
  assert.equal(a.clicks(),2);assert.equal(prevented,2);
  a.labels[0].handlers.keydown({key:'Enter',repeat:true});a.labels[0].handlers.keydown({key:'ArrowRight'});assert.equal(a.clicks(),2);
  a.failClick();a.labels[1].handlers.keydown({key:'Enter',preventDefault(){}});
  assert.match(a.status.textContent,/選択画面を開けません/);assert.doesNotMatch(a.status.textContent,/private|この画像|JPEG|PNG/);
});
