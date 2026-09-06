'use strict';

const fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');

const edge=['C:','Program Files (x86)','Microsoft','Edge','Application','msedge.exe'].join(path.sep);
const port=9337;
const gameUrl='http://127.0.0.1:8765/025_pendulum-duel/index.html';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pendulum-cdp-'));
let browser,ws,nextId=1;
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
  if(response.exceptionDetails)throw new Error(response.exceptionDetails.text||'Browser evaluation failed');
  return response.result.result.value;
}

async function main(){
  assert(fs.existsSync(edge),'Microsoft Edge is required for browser smoke testing');
  browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-default-apps','--remote-debugging-port='+port,'--user-data-dir='+profile,gameUrl],{stdio:'ignore'});
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

  assert.strictEqual(await evaluate("(()=>{$('local').click();$('start').click();return state})()"),'selecting');
  await evaluate("Array.from(document.querySelectorAll('.weapon-arrow')).find(button=>button.dataset.player==='0'&&button.dataset.direction==='1').click()");
  await evaluate("Array.from(document.querySelectorAll('.weapon-arrow')).find(button=>button.dataset.player==='1'&&button.dataset.direction==='1').click()");
  await evaluate("Array.from(document.querySelectorAll('.weapon-arrow')).find(button=>button.dataset.player==='1'&&button.dataset.direction==='1').click()");
  assert.deepStrictEqual(await evaluate('[weaponChoices[0],weaponChoices[1]]'),['long','heavy']);
  await evaluate("Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click()");
  assert.strictEqual(await evaluate('readySelections[0]'),true);
  await evaluate("Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='1').click()");
  assert.strictEqual(await evaluate('state'),'countdown');
  await wait(3900);
  assert.strictEqual(await evaluate('state'),'running');
  const match=await evaluate("({p0:players[0].weapon.id,p1:players[1].weapon.id,lengthRatio:players[0].L/(width*.087),heavyTip:players[1].weapon.tipSize,hud0:$('weapon0').textContent,hud1:$('weapon1').textContent})");
  assert.strictEqual(match.p0,'long');assert.strictEqual(match.p1,'heavy');
  assert(Math.abs(match.lengthRatio-1.28)<.001&&match.heavyTip>1);
  assert.strictEqual(match.hud0,'LONG');assert.strictEqual(match.hud1,'HEAVY');

  const inertia=await evaluate("(()=>{clearInput();const p=players[0];for(let j=1;j<p.nodes.length;j++){const node=p.nodes[j];node.x=p.x;node.y=p.y+p.L*j;node.px=node.x+4;node.py=node.y;}const angular=()=>{const node=p.nodes[1],dx=node.x-p.x,dy=node.y-p.y,vx=node.x-node.px,vy=node.y-node.py;return dx*vy-dy*vx;};const before=angular();inputs[0].ccw=true;step(1/240,true);const after=angular();clearInput();return {before,after};})()");
  assert(inertia.before*inertia.after>0,'Opposite torque reversed angular motion instantly instead of braking it');
  const lockState=await evaluate("(()=>{dispatchEvent(new KeyboardEvent('keydown',{key:'s',bubbles:true}));step(1/240,true);const result={locked:players[0].locked,cool:players[0].cool};dispatchEvent(new KeyboardEvent('keyup',{key:'s',bubbles:true}));return result})()");
  assert(lockState.locked>0&&lockState.cool>0,'LOCK activation or cooldown failed');

  const keyState=await evaluate("(()=>{for(const key of ['a','s','d','j','k','l'])dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));return inputs.map(value=>({...value}))})()");
  assert(keyState[0].ccw&&keyState[0].lock&&keyState[0].cw&&keyState[1].ccw&&keyState[1].lock&&keyState[1].cw,'Simultaneous keyboard input failed');
  const released=await evaluate("(()=>{for(const key of ['a','s','d','j','k','l'])dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));return inputs.every(value=>!value.ccw&&!value.lock&&!value.cw)})()");
  assert(released,'Keyboard release failed');

  const pointerState=await evaluate("(()=>{const down=(id,pointerId)=>$(id).dispatchEvent(new PointerEvent('pointerdown',{pointerId,pointerType:'touch',bubbles:true,cancelable:true}));down('ccw0',101);down('cw1',102);return [inputs[0].ccw,inputs[1].cw]})()");
  assert.deepStrictEqual(pointerState,[true,true]);
  const pointerReleased=await evaluate("(()=>{const up=(id,pointerId)=>$(id).dispatchEvent(new PointerEvent('pointerup',{pointerId,pointerType:'touch',bubbles:true,cancelable:true}));up('ccw0',101);up('cw1',102);return !inputs[0].ccw&&!inputs[1].cw})()");
  assert(pointerReleased,'Pointer release failed');
  assert.strictEqual(await evaluate("controls.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))"),false,'Double-tap guard failed');

  await evaluate('finish()');
  assert.strictEqual(await evaluate("Boolean($('weapons')&&$('resume')&&$('menu'))"),true);
  await evaluate("$('weapons').click()");
  assert.strictEqual(await evaluate('state'),'selecting');
  await evaluate("$('weaponBack').click();$('cpu').click();$('start').click();Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click()");
  const cpuChoice=await evaluate("({state,weapon:weaponChoices[1],valid:WEAPON_IDS.includes(weaponChoices[1])})");
  assert(cpuChoice.state==='countdown'&&cpuChoice.valid,'CPU random weapon selection failed');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
  await send('Page.reload',{ignoreCache:true});
  await retry(async()=>{const ready=await evaluate("document.readyState==='complete'&&typeof WEAPONS==='object'");if(!ready)throw new Error('Mobile page is not ready');return true;});
  const mobile=await evaluate("({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyOverflow:getComputedStyle(document.body).overflow,touchAction:getComputedStyle($('ccw0')).touchAction,buttons:['ccw0','lock0','cw0','ccw1','lock1','cw1'].every(id=>$(id).getBoundingClientRect().width>0)})");
  assert(mobile.scrollWidth<=mobile.innerWidth&&mobile.bodyOverflow==='hidden'&&mobile.touchAction==='none'&&mobile.buttons,'Mobile layout or touch isolation failed');
  assert.deepStrictEqual(runtimeErrors,[],'Runtime errors: '+runtimeErrors.join('; '));
  console.log('Browser smoke passed: weapon selection, separate loadouts, countdown, inertial reversal, LOCK, CPU random weapon, keyboard, multi-touch, release, replay paths, and 390x844 mobile layout.');
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  try{if(ws)ws.close();}catch{}
  try{if(browser)browser.kill();}catch{}
  await wait(150);
  const tempRoot=path.resolve(os.tmpdir())+path.sep;
  const resolved=path.resolve(profile);
  if(resolved.startsWith(tempRoot)&&path.basename(resolved).startsWith('pendulum-cdp-'))fs.rmSync(resolved,{recursive:true,force:true});
});
