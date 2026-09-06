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
  if(response.result.exceptionDetails)throw new Error(response.result.exceptionDetails.exception?.description||response.result.exceptionDetails.text||'Browser evaluation failed');
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
  const idleBefore=await evaluate(`players.map(player=>player.nodes.map(node=>[node.x,node.y]))`);
  await wait(250);
  const idleAfter=await evaluate(`players.map(player=>player.nodes.map(node=>[node.x,node.y]))`);
  assert.deepStrictEqual(idleAfter,idleBefore,'Pendulums moved before the match started');
  await evaluate("Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click()");
  assert.strictEqual(await evaluate('readySelections[0]'),true);
  await evaluate("Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='1').click()");
  assert.strictEqual(await evaluate('state'),'selecting');
  assert.strictEqual(await evaluate("$('matchStart').disabled"),false);
  await evaluate("$('matchStart').click()");
  assert.strictEqual(await evaluate('state'),'countdown');
  await wait(3900);
  const cpuRunning=await evaluate('state');
  assert(cpuRunning==='running','CPU countdown stalled in '+cpuRunning+': '+runtimeErrors.join('; '));
  const match=await evaluate("({p0:players[0].weapon.id,p1:players[1].weapon.id,lengthRatio:players[0].L/(width*.087),heavyTip:players[1].weapon.tipSize,hud0:$('weapon0').textContent,hud1:$('weapon1').textContent})");
  assert.strictEqual(match.p0,'long');assert.strictEqual(match.p1,'heavy');
  assert(Math.abs(match.lengthRatio-1.28)<.001&&match.heavyTip>1);
  assert.strictEqual(match.hud0,'LONG');assert.strictEqual(match.hud1,'HEAVY');

  const impact=await evaluate(`(()=>{burst(width/2,height/2,colors[0],24,false,{isTip:true,relativeSpeed:width,massFactor:1,positionMultiplier:1});draw(1/60);return {rings:rings.length,radiusSafe:rings[0].duration===.7}})()`);
  assert(impact.rings>0&&impact.radiusSafe,'Tip-hit impact rendering failed');

  const hazards=await evaluate(`(()=>{resetHazards();inputs[0].cw=true;for(let i=0;i<1500;i++)updateHazards(1/240);inputs[0].cw=false;const over=hazardState.chaos[0].over>0;resetHazards();hazardState.event.next=1;updateHazards(.01);const warned=hazardState.event.phase==='warning';hazardState.event.next=0;updateHazards(.01);const active=hazardState.event.phase==='active';hazardState.event.time=.001;updateHazards(.01);const restored=hazardState.event.phase==='idle'&&environment().gravity===1;spawnBomb();hazardState.bomb.x=players[0].x;hazardState.bomb.y=players[0].y;players[0].jointHp[1]=1;const hp=players[0].hp;explodeBomb();const result={over,warned,active,restored,bombGone:hazardState.bomb===null,damaged:players[0].hp<hp,broken:players[0].nodes.length<players[0].weapon.segments+1,debris:hazardState.debris.length,eventCount:EVENT_CONFIG.events.length};resetPhysics();resetHazards();return result})()`);
  assert(hazards.over&&hazards.warned&&hazards.active&&hazards.restored&&hazards.bombGone&&hazards.damaged&&hazards.broken&&hazards.debris>0&&hazards.eventCount===6,'CHAOS, bomb, event, or joint-break systems failed');
  const failsafe=await evaluate(`(()=>{resetHazards();hazardState.event.next=999;hazardState.bombNext=999;hazardState.matchTime=12.99;updateHazards(.02);const warning=hazardState.event.phase==='warning';hazardState.matchTime=14.99;updateHazards(.02);const event=hazardState.event.phase==='active';hazardState.matchTime=17.99;updateHazards(.02);const bomb=Boolean(hazardState.bomb);resetHazards();return {warning,event,bomb}})()`);
  assert(failsafe.warning&&failsafe.event&&failsafe.bomb,'Hazard failsafe did not force overdue scheduling');
  const lockedBreak=await evaluate(`(()=>{resetPhysics();resetHazards();const p=players[0];lock(p);breakJoint(p,2);step(1/240,true);const valid=p.chords.every(chord=>chord.a<p.nodes.length&&chord.b<p.nodes.length);resetPhysics();resetHazards();return {valid,nodes:p.nodes.length}})()`);
  assert(lockedBreak.valid&&lockedBreak.nodes===2,'LOCK constraints referenced a detached joint');

  const chaos=await evaluate("(()=>{weaponChoices[0]='chaos';resetPhysics();const p=players[0];return {nodes:p.nodes.length,cooldowns:p.hitCooldowns.length,totalRatio:p.L*p.weapon.segments/(width*.087*3),segments:p.weapon.segments}})()");
  assert(chaos.segments===5&&chaos.nodes===6&&chaos.cooldowns===5&&chaos.totalRatio>=1.1&&chaos.totalRatio<=1.25,'CHAOS generation, constraints, or reach failed');

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
  await evaluate("$('weaponBack').click();$('cpu').click();$('start').click();Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click();$('matchStart').click()");
  const cpuChoice=await evaluate("({state,weapon:weaponChoices[1],valid:WEAPON_IDS.includes(weaponChoices[1])})");
  assert(cpuChoice.state==='countdown'&&cpuChoice.valid,'CPU random weapon selection failed');

  const endurance=JSON.parse(await evaluate(`(()=>{const nativeRandom=Math.random;Math.random=()=>.5;state='running';remaining=60;players=[];resetPhysics();players.forEach(player=>player.hp=9999);resetHazards();let steps=0;while(state==='running'&&steps<14400){step(1/240,true);steps++;}const finite=players.every(player=>player.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)))&&hazardState.debris.every(part=>Number.isFinite(part.x)&&Number.isFinite(part.y)),result={steps,finite,debris:hazardState.debris.length,eventStarts:hazardState.event.startCount,bombSpawns:hazardState.bombSpawnCount,firstEvent:hazardState.event.firstStart,firstBomb:hazardState.firstBomb};Math.random=nativeRandom;return JSON.stringify(result)})()`));
  assert(endurance.steps>14000&&endurance.finite&&endurance.debris<30&&endurance.eventStarts>=3&&endurance.bombSpawns>=2,'60-second hazard simulation failed: '+JSON.stringify(endurance));
  console.log('Hazard 60-second result: '+JSON.stringify(endurance));

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
  await send('Page.reload',{ignoreCache:true});
  await retry(async()=>{const ready=await evaluate("document.readyState==='complete'&&typeof WEAPONS==='object'");if(!ready)throw new Error('Mobile page is not ready');return true;});
  const mobile=await evaluate("({innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyOverflow:getComputedStyle(document.body).overflow,touchAction:getComputedStyle($('ccw0')).touchAction,buttons:['ccw0','lock0','cw0','ccw1','lock1','cw1'].every(id=>$(id).getBoundingClientRect().width>0)})");
  assert(mobile.scrollWidth<=mobile.innerWidth&&mobile.bodyOverflow==='hidden'&&mobile.touchAction==='none'&&mobile.buttons,'Mobile layout or touch isolation failed');
  const mobileSelect=await evaluate("(()=>{$('start').click();Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click();const rect=$('matchStart').getBoundingClientRect();return {enabled:!$('matchStart').disabled,top:rect.top,bottom:rect.bottom,height:innerHeight}})()");
  assert(mobileSelect.enabled&&mobileSelect.top>=0&&mobileSelect.bottom<=mobileSelect.height,'Mobile match start button is clipped');
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
