import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/mobile-ui-audio/',root),before=process.argv.includes('--before');
await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const [width,height]of[[375,667],[390,844],[320,568]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  if(before)assert.equal(await page.locator('#displayPanel').evaluate(el=>el.tagName),'DETAILS','Only capture BEFORE from the previous implementation');
  const measure=()=>page.evaluate(()=>({document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],viewport:[innerWidth,innerHeight],board:document.querySelector('#spaceFrame').getBoundingClientRect().toJSON(),launch:document.querySelector('#launchButton').getBoundingClientRect().toJSON()}));
  const normal=await measure();await page.screenshot({path:fileURLToPath(new URL(`${before?'before':'after'}-normal-${width}x${height}.png`,dir))});
  const panels={};
  for(const name of ['display','planet']){
   if(before)await page.locator('#'+name+'Panel').evaluate(el=>el.open=true);
   else await page.locator(name==='display'?'#openDisplaySettings':'#openPlanetSettings').click();
   panels[name]=await measure();
   if(!before){
    assert.deepEqual(panels[name].board,normal.board);assert.deepEqual(panels[name].launch,normal.launch);
    const box=await page.locator('#'+name+'Panel').boundingBox();assert.ok(box.x>=11&&box.y>=11&&box.x+box.width<=width-11&&box.y+box.height<=height-11);
    const panel=page.locator('#'+name+'Panel');await panel.locator('details').first().evaluate(el=>el.open=true);
    await panel.locator('.settings-content').evaluate(el=>el.scrollTop=el.scrollHeight);
    const close=page.locator(name==='display'?'#closeDisplaySettings':'#closePlanetSettings');assert.ok(await close.isVisible());
    await panel.locator('details').first().evaluate(el=>el.open=false);await panel.locator('.settings-content').evaluate(el=>el.scrollTop=0);
   }
   await page.screenshot({path:fileURLToPath(new URL(`${before?'before':'after'}-${name}-${width}x${height}.png`,dir))});
   if(before)await page.locator('#'+name+'Panel').evaluate(el=>el.open=false);
   else await page.locator(name==='display'?'#closeDisplaySettings':'#closePlanetSettings').click();
  }
  if(!before){
   assert.deepEqual(normal.document,[width,height]);assert.ok(normal.board.height>=230);
   for(const selector of ['#gameMode','#openDisplaySettings','#openPlanetSettings','[data-launch-mode="precision"]','[data-launch-mode="slingshot"]','#angleInput','#speedInput','#launchButton','#resetButton']){
    const hit=await page.locator(selector).evaluate(el=>{const b=el.getBoundingClientRect(),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=innerHeight&&(el===target||el.contains(target));});assert.ok(hit,`${width}: ${selector} clipped`);
   }
  }
  assert.deepEqual(errors,[]);results.push({size:`${width}x${height}`,normal,panels,errors});await context.close();
 }
 if(!before){
  const context=await browser.newContext({viewport:{width:375,height:667},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.audioProbe={contexts:[],starts:0,resumes:0,destinationEdges:0,active:0,peak:0,rejectResume:false};
   const Native=AudioContext;
   window.AudioContext=class extends Native{
    constructor(...args){super(...args);audioProbe.contexts.push(this);}
    resume(){audioProbe.resumes++;return audioProbe.rejectResume?Promise.reject(new DOMException('blocked','NotAllowedError')):super.resume();}
    createGain(){const node=super.createGain(),connect=node.connect.bind(node);node.connect=(target,...rest)=>{if(target===this.destination)audioProbe.destinationEdges++;return connect(target,...rest);};return node;}
    createOscillator(){const node=super.createOscillator(),start=node.start.bind(node),disconnect=node.disconnect.bind(node);let counted=false;const released=()=>{if(counted){audioProbe.active--;counted=false;}};node.start=(...a)=>{audioProbe.starts++;audioProbe.active++;counted=true;audioProbe.peak=Math.max(audioProbe.peak,audioProbe.active);return start(...a);};node.disconnect=(...a)=>{released();return disconnect(...a);};node.addEventListener('ended',released);return node;}
   };
  });
  const url=`http://127.0.0.1:${server.address().port}`;await page.goto(url);
  assert.equal(await page.evaluate(()=>audioProbe.contexts.length),0);
  const inputState=()=>page.evaluate(()=>({angle:document.querySelector('#angleInput').value,speed:document.querySelector('#speedInput').value,mode:document.querySelector('#gameMode').value,launch:document.querySelector('[data-launch-mode="precision"]').getAttribute('aria-pressed'),planet:document.querySelector('#planetSelection').textContent}));
  await page.locator('#angleInput').fill('-68');await page.locator('#speedInput').fill('160');await page.locator('#gameMode').selectOption('live');const original=await inputState();
  await page.locator('#openPlanetSettings').click();await page.locator('#addPlanet').click();await page.locator('#deletePlanet').click();
  await page.locator('#planetType').selectOption('asteroid');await page.locator('#planetSize').selectOption('small');assert.match(await page.locator('#planetSelection').textContent(),/1260/);
  await page.locator('#closePlanetSettings').click();assert.equal((await inputState()).angle,original.angle);assert.equal((await inputState()).mode,original.mode);
  await page.locator('#openDisplaySettings').click();
  await page.locator('#soundToggle').click();await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
  assert.ok(await page.evaluate(()=>audioProbe.starts>0&&audioProbe.destinationEdges>0));
  await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('音声時計: 進行'),null,{timeout:2500}).catch(async error=>{
   console.log(JSON.stringify(await page.evaluate(()=>({diagnostics:document.querySelector('#audioDiagnostics').textContent,contexts:audioProbe.contexts.map(ctx=>({state:ctx.state,time:ctx.currentTime})),starts:audioProbe.starts}))));throw error;
  });
  await page.locator('#displayPanel details').evaluate(el=>el.open=true);await page.screenshot({path:fileURLToPath(new URL('audio-diagnostics-375.png',dir))});
  // Actual Chrome context suspension/resume; the next tap must send the tone.
  await page.evaluate(async()=>{await audioProbe.contexts.at(-1).suspend();});
  await page.locator('#testSound').click();await page.waitForFunction(()=>audioProbe.contexts.at(-1).state==='running'&&document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
  const resumes=await page.evaluate(()=>audioProbe.resumes);assert.ok(resumes>=1);
  await page.evaluate(async()=>{await audioProbe.contexts.at(-1).suspend();audioProbe.rejectResume=true;});await page.locator('#testSound').click();
  await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('NotAllowedError'));
  await page.evaluate(()=>audioProbe.rejectResume=false);await page.locator('#testSound').click();await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
  const recovered=await page.evaluate(()=>audioProbe.contexts.length);assert.ok(recovered>=2);
  await page.locator('#soundToggle').click();await page.waitForFunction(()=>audioProbe.active===0);
  const starts=await page.evaluate(()=>audioProbe.starts);assert.ok(await page.locator('#testSound').isDisabled());
  await page.locator('#closeDisplaySettings').click();await page.locator('#openPlanetSettings').click();await page.locator('#closePlanetSettings').click();assert.equal(await page.evaluate(()=>audioProbe.starts),starts);
  await page.locator('#openDisplaySettings').click();await page.locator('#soundToggle').click();await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));await page.locator('#closeDisplaySettings').click();
  await page.reload();assert.equal(await page.evaluate(()=>audioProbe.contexts.length),0);await page.locator('#openDisplaySettings').click();assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'),'true');await page.locator('#soundToggle').click();await page.locator('#closeDisplaySettings').click();
  // Flight state is frozen while a settings dialog is open, then resumes.
  await page.locator('#launchButton').click();await page.locator('#openDisplaySettings').click();
  const frozen=await page.locator('#gameCanvas').evaluate(el=>el.toDataURL());await page.waitForTimeout(220);assert.equal(await page.locator('#gameCanvas').evaluate(el=>el.toDataURL()),frozen);
  await page.locator('#closeDisplaySettings').click();await page.waitForTimeout(100);assert.notEqual(await page.locator('#gameCanvas').evaluate(el=>el.toDataURL()),frozen);await page.locator('#resetButton').click();assert.ok(await page.locator('#launchButton').isEnabled());
  // Stage20 editing restrictions remain data driven in the same isolated context.
  await page.evaluate(()=>localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-19":3},"live":{"stage-10":2}}'));await page.reload();
  await page.locator('#openStages').click();await page.locator('#stageList button').nth(19).click();await page.locator('#openPlanetSettings').click();
  for(const selector of ['#addPlanet','#deletePlanet','#planetType','#planetSize','#specialSample'])assert.ok(await page.locator(selector).isDisabled());
  await page.locator('#planetPanel details').evaluate(el=>el.open=true);assert.match(await page.locator('#challengeConditions').textContent(),/固定/);await page.locator('#closePlanetSettings').click();assert.ok(await page.locator('#launchButton').isEnabled());
  const waveform=await page.evaluate(async()=>{
   const {SpaceAudio}=await import('./js/space-audio.js');const offline=new OfflineAudioContext(1,22050,44100);
   const facade={state:'running',get currentTime(){return offline.currentTime;},destination:offline.destination,createGain:offline.createGain.bind(offline),createOscillator:offline.createOscillator.bind(offline)};
   const audio=new SpaceAudio(true,{AudioContext:class{constructor(){return facade;}}});if(!await audio.testSound())throw Error('Tone not sent');
   const buffer=await offline.startRendering(),samples=buffer.getChannelData(0),rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);audio.setEnabled(false);return{rms,frames:samples.length,sampleRate:buffer.sampleRate,method:'PC OfflineAudioContext, not iPhone speaker'};
  });assert.ok(waveform.rms>.001);
  assert.deepEqual(errors,[]);await writeFile(new URL('interaction-audio.json',dir),JSON.stringify({browser:'Windows Chrome, not iPhone Safari',panelsPreserveInputs:true,editor:true,stage20FixedConditions:true,flightPauseResume:true,initialMute:true,soundRestoredWithoutAutoplay:true,testSentToDestination:true,actualChromeSuspendResume:true,rejectedResumeRecovered:true,muteStopsNodes:true,waveform,iphoneAudible:'UNVERIFIED',errors},null,2));
  await context.close();
  const comparison=await browser.newPage({viewport:{width:820,height:790},deviceScaleFactor:1});
  await comparison.goto(`http://127.0.0.1:${server.address().port}/reports/mobile-ui-audio/comparison.html`);
  await comparison.locator('img').last().evaluate(img=>img.decode());
  await comparison.screenshot({path:fileURLToPath(new URL('comparison-375.png',dir)),fullPage:true});await comparison.close();
 }
 await writeFile(new URL(before?'before.json':'after.json',dir),JSON.stringify(results,null,2));console.log(`${before?'Before':'After'} screenshots captured: 3 viewports, normal/display/planet`);
}finally{await browser.close();await new Promise(r=>server.close(r));}
