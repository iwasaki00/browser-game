'use strict';

const fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');

const edge=[['C:','Program Files','Google','Chrome','Application','chrome.exe'],['C:','Program Files (x86)','Microsoft','Edge','Application','msedge.exe']].map(parts=>parts.join(path.sep)).find(file=>fs.existsSync(file));
const port=9341;
let gameUrl;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pendulum-cdp-'));
let browser,ws,server,nextId=1;
const pending=new Map(),runtimeErrors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function retry(fn,attempts=50){
  let last;
  for(let i=0;i<attempts;i++){try{return await fn();}catch(error){last=error;await wait(100);}}
  throw last;
}

function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=nextId++;
    pending.set(id,{resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
}

async function evaluate(expression){
  const response=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(response.result.exceptionDetails)throw new Error(response.result.exceptionDetails.exception?.description||response.result.exceptionDetails.text||'Browser evaluation failed');
  return response.result.result.value;
}

async function main(){
  server=require('http').createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.split('/').pop();if(!['index.html','game.js','weapons.js','style.css','weapons.css','iphone.css'].includes(name)){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(__dirname,'..',name)));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  gameUrl='http://127.0.0.1:'+server.address().port+'/025_pendulum-duel/index.html';
  assert(edge&&fs.existsSync(edge),'Chrome or Edge is required for browser smoke testing');
  browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-default-apps','--remote-debugging-port='+port,'--user-data-dir='+profile,gameUrl],{stdio:'ignore',windowsHide:true});
  const target=await retry(async()=>{
    const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
    const page=pages.find(item=>item.type==='page'&&item.url.includes('025_pendulum-duel'));
    if(!page)throw new Error('Game page is not ready');
    return page;
  });
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message);return;}
    if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);
  };
  await send('Runtime.enable');
  await retry(async()=>{const ready=await evaluate("document.readyState==='complete'&&typeof WEAPONS==='object'&&players.length===2");if(!ready)throw new Error('Game scripts are not ready');return true;});


  assert.strictEqual(await evaluate("Boolean(document.querySelector('a.brand'))"),false);
  await evaluate("$('local').click();$('start').click();readyWeapon(0);readyWeapon(1);startSelectedMatch();window.savedPlayers=players;countdown=2;startSelectedMatch()");
  assert.strictEqual(await evaluate('players===savedPlayers&&countdown===2'),true);
  await evaluate("dispatchEvent(new Event('blur'))");
  const stopped=await evaluate("JSON.stringify({state,countdown,remaining,players,hazardState})");
  await wait(150);
  assert.strictEqual(await evaluate("JSON.stringify({state,countdown,remaining,players,hazardState})"),stopped);
  assert.strictEqual(await evaluate("state==='paused'&&pausedFrom==='countdown'"),true);
  await evaluate("pause();countdown=.001");await wait(100);
  assert.strictEqual(await evaluate('state'),'running');
  assert.strictEqual(await evaluate(`(()=>{
    const event=(id,type,pointerId)=>$(id).dispatchEvent(new PointerEvent(type,{pointerId,pointerType:'touch',bubbles:true,cancelable:true}));
    event('ccw0','pointerdown',1);event('ccw0','pointerdown',2);event('lock0','pointerdown',3);event('cw1','pointerdown',4);
    event('ccw0','pointerup',1);event('ccw0','pointerup',99);
    const independent=inputs[0].ccw&&inputs[0].lock&&inputs[1].cw;
    dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));event('ccw0','pointercancel',2);
    const keyboard=inputs[0].ccw;dispatchEvent(new KeyboardEvent('keyup',{key:'a'}));
    event('lock0','lostpointercapture',3);const released=!inputs[0].ccw&&!inputs[0].lock&&inputs[1].cw;
    event('cw1','pointercancel',4);return independent&&keyboard&&released&&!inputs[1].cw;
  })()`),true,'Pointer ownership or keyboard composition failed');
  await evaluate("dispatchEvent(new Event('blur'))");
  const frozen=await evaluate('JSON.stringify({remaining,players,hazardState,elapsed})');await wait(150);
  assert.strictEqual(await evaluate('JSON.stringify({remaining,players,hazardState,elapsed})'),frozen);
  await evaluate("dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))");
  assert.strictEqual(await evaluate('state'),'paused');
  await evaluate("pause();Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))");
  assert.strictEqual(await evaluate('state'),'paused');
  await evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))");
  assert.strictEqual(await evaluate('state'),'paused');
  await evaluate(`(()=>{players[0].hp=73;remaining=42;hazardState.chaos[0].value=67;lock(players[0]);spawnBomb();const p=players[0];p.nodes[1].px-=2;p.nodes[1].py+=3;window.resizeSnapshot={p,L:p.L,width,height,choices:[...weaponChoices],chaos:JSON.stringify(hazardState.chaos),nodes:p.nodes.map(n=>({...n})),chords:p.chords.map(c=>({...c})),bomb:{...hazardState.bomb}};})()`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});await wait(100);
  assert.strictEqual(await evaluate(`(()=>{const s=resizeSnapshot,p=players[0],r=width/s.width,dy=(height-s.height*r)*.48,near=(a,b)=>Math.abs(a-b)<1e-6;return p===s.p&&p.hp===73&&remaining===42&&JSON.stringify(weaponChoices)===JSON.stringify(s.choices)&&JSON.stringify(hazardState.chaos)===s.chaos&&near(p.L,s.L*r)&&p.nodes.every((n,i)=>near(n.x,s.nodes[i].x*r)&&near(n.y,s.nodes[i].y*r+dy)&&near(n.x-n.px,(s.nodes[i].x-s.nodes[i].px)*r)&&near(n.y-n.py,(s.nodes[i].y-s.nodes[i].py)*r))&&p.chords.every((c,i)=>near(c.d,s.chords[i].d*r))&&near(hazardState.bomb.x,s.bomb.x*r);})()`),true,'Resize lost motion or match state');
  const layouts=[];
  for(const [w,h] of [[320,568],[375,667],[390,844],[430,932],[844,390],[1280,800]]){
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:w<1000});await wait(100);
    await evaluate('menu()');
    const layout=await evaluate(`(()=>{const rect=id=>$(id).getBoundingClientRect();return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,arena:rect('game').height,controls:['ccw0','lock0','cw0','ccw1','lock1','cw1'].every(id=>{const r=rect(id);return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.height>=44&&r.width>=40}),start:rect('start').bottom<=rect('game').bottom}})()`);
    assert(layout.scroll<=layout.width&&layout.controls&&layout.start&&layout.arena>100,JSON.stringify({w,h,layout}));
    await evaluate("$('start').click()");
    const selection=await evaluate(`(()=>{const grid=document.querySelector('.weapon-select-grid');grid.scrollTop=grid.scrollHeight;const ready=document.querySelectorAll('[data-ready]')[1].getBoundingClientRect(),start=$('matchStart').getBoundingClientRect();return {ready:ready.bottom<=start.top&&ready.top>=0,start:start.bottom<=innerHeight&&start.left>=0&&start.right<=innerWidth,descriptions:[...document.querySelectorAll('.weapon-name small')].every(e=>getComputedStyle(e).display!=='none')};})()`);
    assert(Object.values(selection).every(Boolean),JSON.stringify({w,h,selection}));layouts.push({w,h,arena:layout.arena});
  }
  await evaluate("menu();selectMode('cpu');openWeaponSelect();readyWeapon(0);startSelectedMatch();startBattle()");
  assert.strictEqual(await evaluate(`(()=>{clearInput();$('cw1').dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,pointerType:'touch',cancelable:true}));dispatchEvent(new KeyboardEvent('keydown',{key:'l'}));return !inputs[1].cw&&$('cw1').disabled;})()`),true);
  await evaluate('players[0].hp=0;step(1/240,true)');
  const result=await evaluate("$('overlay').innerHTML");await evaluate('finish()');
  assert.strictEqual(await evaluate("$('overlay').innerHTML"),result);
  await evaluate("$('resume').click()");
  assert.strictEqual(await evaluate("state==='countdown'&&remaining===60&&elapsed===0&&players.every(p=>p.hp===100&&p.cool===0&&p.nodes.length===p.weapon.segments+1)&&hazardState.chaos.every(c=>c.value===0)&&hazardState.bomb===null&&hazardState.event.phase==='idle'&&inputs.every(p=>!p.ccw&&!p.lock&&!p.cw)"),true);
  assert.deepStrictEqual(runtimeErrors,[]);
  console.log('Mobile lifecycle smoke passed: input, pause/countdown, resize, replay, CPU, result guard; layouts '+JSON.stringify(layouts));
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  server?.close();
  try{if(ws)ws.close();}catch{}
  try{if(browser)browser.kill();}catch{}
  await wait(150);
  const tempRoot=path.resolve(os.tmpdir())+path.sep;
  const resolved=path.resolve(profile);
  if(resolved.startsWith(tempRoot)&&path.basename(resolved).startsWith('pendulum-cdp-')){try{fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch(error){console.warn('Temporary browser profile cleanup: '+error.code);}}
});
