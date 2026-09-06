'use strict';

const fs=require('fs'),os=require('os'),path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');

const edge=['C:','Program Files (x86)','Microsoft','Edge','Application','msedge.exe'].join(path.sep);
const port=9338;
const gameUrl='http://127.0.0.1:8765/025_pendulum-duel/index.html?debugHazards=1';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pendulum-hazard-cdp-'));
let browser,ws,nextId=1;
const pending=new Map(),runtimeErrors=[],consoleMessages=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function retry(fn,attempts=60){
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
  assert(fs.existsSync(edge),'Microsoft Edge is required for hazard runtime testing');
  browser=spawn(edge,['--headless=new','--disable-gpu','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--no-first-run','--disable-default-apps','--remote-debugging-port='+port,'--user-data-dir='+profile,gameUrl],{stdio:'ignore'});
  const target=await retry(async()=>{
    const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(response=>response.json());
    const page=pages.find(item=>item.type==='page'&&item.url.includes('025_pendulum-duel'));
    if(!page)throw new Error('Hazard test page is not ready');
    return page;
  });
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message);return;}
    if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);
    if(message.method==='Runtime.consoleAPICalled')consoleMessages.push(message.params.args.map(arg=>arg.value).join(' '));
  };
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await retry(async()=>{const ready=await evaluate(`document.readyState==='complete'&&players.length===2&&typeof updateHazards==='function'`);if(!ready)throw new Error('Hazard scripts are not ready');return true;});
  await evaluate(`$('start').click();Array.from(document.querySelectorAll('[data-ready]')).find(button=>button.dataset.ready==='0').click();$('matchStart').click()`);
  assert.strictEqual(await evaluate('state'),'countdown');
  await wait(3900);
  assert.strictEqual(await evaluate('state'),'running');
  await evaluate(`players.forEach(player=>player.hp=999)`);
  const forced=await evaluate(`(()=>{const event=pendulumDebug.triggerEvent('LOW_GRAVITY'),bomb=pendulumDebug.spawnBomb(),snapshot=pendulumDebug.getState();return {event,bomb,gravity:environment().gravity,bombX:snapshot.bomb?.x,bombY:snapshot.bomb?.y}})()`);
  assert(forced.event&&forced.bomb&&forced.gravity===.5&&forced.bombX>0&&forced.bombY>0,'Console debug triggers did not activate a visible event and bomb');
  await evaluate(`Math.random=()=>0;resetHazards();hazardState.event.next=.8;hazardState.bombNext=1.2`);

  const started=Date.now();
  let sawWarning=false,sawEvent=false,sawBomb=false,firstEvent=null,firstBomb=null,eventStarts=0,bombSpawns=0,lastPhase='idle',lastBomb=false,lastSnapshot=null;
  for(let i=0;i<80;i++){
    await wait(500);
    const snapshot=await evaluate(`({state,phase:hazardState.event.phase,next:hazardState.event.next,bomb:Boolean(hazardState.bomb),bombX:hazardState.bomb?.x??null,bombY:hazardState.bomb?.y??null,remaining,elapsed,accumulator,last,chaos:hazardState.chaos[0].value})`);
    lastSnapshot=snapshot;
    sawWarning||=snapshot.phase==='warning';
    if(snapshot.phase==='active'&&lastPhase!=='active'){eventStarts++;firstEvent??=(Date.now()-started)/1000;}
    if(snapshot.bomb&&!lastBomb){bombSpawns++;firstBomb??=(Date.now()-started)/1000;}
    if(snapshot.bomb&&!lastBomb)await evaluate('hazardState.bomb.fuse=.05');
    sawEvent||=snapshot.phase==='active';
    sawBomb||=snapshot.bomb;
    lastPhase=snapshot.phase;
    lastBomb=snapshot.bomb;
    if(sawWarning&&sawEvent&&sawBomb&&consoleMessages.some(message=>message==='[BOMB] exploded'))break;
  }
  assert(sawWarning&&sawEvent&&sawBomb,'WARNING, event, or bomb did not occur in a normal CPU match: '+JSON.stringify({lastSnapshot,runtimeErrors,consoleMessages}));
  assert(eventStarts>0&&bombSpawns>0,'Hazard counters did not advance');
  assert.deepStrictEqual(runtimeErrors,[],'Runtime errors: '+runtimeErrors.join('; '));
  console.log(JSON.stringify({firstEvent,firstBomb,eventStarts,bombSpawns,consoleMessages}));
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  try{if(ws)ws.close();}catch{}
  try{if(browser)browser.kill();}catch{}
  await wait(150);
  const tempRoot=path.resolve(os.tmpdir())+path.sep,resolved=path.resolve(profile);
  if(resolved.startsWith(tempRoot)&&path.basename(resolved).startsWith('pendulum-hazard-cdp-'))fs.rmSync(resolved,{recursive:true,force:true});
});
