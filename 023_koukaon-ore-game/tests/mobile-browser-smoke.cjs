// Run against a dedicated headless Chromium CDP session and local app server.
// ORE_CDP_URL=http://127.0.0.1:9338 node tests/mobile-browser-smoke.cjs <app-url> [screenshot.png]
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const pages=await (await fetch((process.env.ORE_CDP_URL || 'http://127.0.0.1:9338') + '/json')).json();const ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m);pending.delete(m.id);}};const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(Error("CDP timeout: "+method)),8000);pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});ws.send(JSON.stringify({id,method,params}));});const run=async expression=>{const r=await call('Runtime.evaluate',{expression,userGesture:true,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:process.argv[2]});await new Promise(r=>setTimeout(r,1500));
const sizes=[[320,568],[375,667],[390,844],[430,932],[844,390]];
for(const [width,height] of sizes){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});for(const nav of ['titleScreen','studioScreen','libraryScreen']){await run(`document.querySelector('[data-nav="${nav}"]').click()`);const info=await run('({scroll:document.documentElement.scrollWidth,width:innerWidth,height:innerHeight,screen:document.querySelector(".screen:not([hidden])").id})');assert.ok(info.scroll<=width,JSON.stringify({width,height,nav,...info}));}console.log('layout OK',width,height);}
await run(`document.querySelector('[data-nav="titleScreen"]').click();document.querySelector('[data-select-game="action"]').click();document.querySelector("#quickStartButton").click()`);await new Promise(r=>setTimeout(r,3300));
for(const [width,height] of sizes){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});const info=await run('(()=>{const root=document.querySelector("#actionControls");return {hidden:document.querySelector("#gameScreen").hidden,buttons:[...root.querySelectorAll("button")].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})}})()');assert.equal(info.hidden,false);assert.ok(info.buttons.every(b=>b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=height),JSON.stringify({width,height,info}));}console.log('action controls OK at all 5 sizes');
await run("window.originalStartGame=GameManager.prototype.startGame;GameManager.prototype.startGame=async function(...args){await originalStartGame.apply(this,args);window.checkedGame=this.current;}");
await call("Emulation.setDeviceMetricsOverride",{width:844,height:390,deviceScaleFactor:1,mobile:true});
for(const mode of ["breakout","fight","pinball"]){await run(`document.querySelector("#gameQuitButton").click();document.querySelector('[data-select-game="${mode}"]').click();document.querySelector("#quickStartButton").click()`);await new Promise(r=>setTimeout(r,3300));const fit=await run('({logical:checkedGame.height,scale:checkedGame.ctx.getTransform().d,bitmap:checkedGame.canvas.height})');assert.ok(fit.logical*fit.scale<=fit.bitmap+1,JSON.stringify({mode,fit}));}console.log("landscape boards fit their canvas: breakout, fight, pinball");

await run('document.querySelector("#gameQuitButton").click();document.querySelector("#quickStartButton").click();document.querySelector("#gameQuitButton").click()');await new Promise(r=>setTimeout(r,2900));assert.equal(await run('document.querySelector("#gameScreen").hidden'),true);console.log('cancelled game countdown stays on title');
await run("window.micRequests=0;window.fakeTracks=[];navigator.mediaDevices.getUserMedia=async()=>{window.micRequests++;const c=new AudioContext();await c.resume();const dest=c.createMediaStreamDestination();const osc=c.createOscillator();osc.connect(dest);osc.start();window.fakeTracks.push(...dest.stream.getTracks());return dest.stream;};document.querySelector('[data-nav=\"studioScreen\"]').click();document.querySelector(\"[data-record]\").click();document.querySelector(\"[data-record]\").click();");
await new Promise(r=>setTimeout(r,200));
await run("document.querySelector(\"#cancelRecordingButton\").click()");
await new Promise(r=>setTimeout(r,2200));
assert.deepEqual(await run('({requests:micRequests,active:fakeTracks.some(t=>t.readyState==="live"),hidden:document.querySelector("#recordScreen").hidden})'),{requests:1,active:false,hidden:true});console.log("browser recording countdown cancellation and duplicate guard OK");
await run("document.querySelector(\"[data-record]\").click()");
await new Promise(r=>setTimeout(r,2200));
await run("document.querySelector(\"#stopRecordingButton\").click()");
await new Promise(r=>setTimeout(r,350));
assert.equal(await run('document.querySelector("#recordReview").hidden'),false);assert.equal(await run('fakeTracks.some(t=>t.readyState==="live")'),false);
await run("document.querySelector(\"#previewRecordingButton\").click()");
await new Promise(r=>setTimeout(r,400));
assert.equal(await run('document.querySelector("#errorDialog").hidden'),true);console.log("native recording, release and preview OK");
await run("window.originalRequest=StorageManager.prototype.request;StorageManager.prototype.request=function(store,mode,operation){return mode===\"readwrite\"?Promise.reject(new DOMException(\"test quota\",\"QuotaExceededError\")):originalRequest.call(this,store,mode,operation)};document.querySelector(\"#acceptRecordingButton\").click()");
await new Promise(r=>setTimeout(r,400));
assert.equal(await run('document.querySelector("#errorDialog").hidden'),false);assert.equal(await run('document.querySelector("#recordReview").hidden'),false);
await run("StorageManager.prototype.request=originalRequest;document.querySelector(\"#closeErrorButton\").click();document.querySelector(\"#acceptRecordingButton\").click()");
await new Promise(r=>setTimeout(r,650));
assert.equal(await run('document.querySelector("#studioScreen").hidden'),false);console.log("quota failure retains recording; retry saves to IndexedDB OK");
await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});const shot=await call('Page.captureScreenshot',{format:'png'});if(process.argv[3])fs.writeFileSync(process.argv[3],Buffer.from(shot.data,'base64'));
console.log('browser checks passed');ws.close();})().catch(e=>{console.error(e);process.exitCode=1;});
