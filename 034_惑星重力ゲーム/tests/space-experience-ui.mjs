import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),dir=new URL('reports/space-experience/',root);
await mkdir(dir,{recursive:true});
const server=createServer(async(req,res)=>{
 try{const url=new URL('.'+new URL(req.url,'http://localhost').pathname,root),file=url.pathname.endsWith('/')?new URL('index.html',url):url;
  if(!fileURLToPath(file).startsWith(fileURLToPath(root)))throw Error();
  res.setHeader('Content-Type',file.pathname.endsWith('.js')?'text/javascript':file.pathname.endsWith('.css')?'text/css':file.pathname.endsWith('.svg')?'image/svg+xml':'text/html');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:667},hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.audioStats={contexts:0,starts:0,active:0,peak:0,gesture:false};
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);audioStats.contexts++;audioStats.gesture=navigator.userActivation.isActive;}
   createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);
    node.start=(...args)=>{audioStats.starts++;audioStats.active++;audioStats.peak=Math.max(audioStats.peak,audioStats.active);start(...args);};
    node.addEventListener('ended',()=>audioStats.active--);return node;}
  };
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>document.querySelector('#angleOutput').value==='−55°');
 assert.equal(await page.evaluate(()=>audioStats.contexts),0);
 await page.evaluate(()=>{localStorage.setItem('orbit-maker.stage-progress.v1','{"design":{"stage-10":2},"live":{"stage-12":1}}');});
 await page.locator('#displayPanel').evaluate(el=>el.open=true);
 assert.equal(await page.locator('#soundToggle').textContent(),'サウンド OFF');
 await page.locator('#soundToggle').click();assert.equal(await page.evaluate(()=>audioStats.contexts),1);assert.equal(await page.evaluate(()=>audioStats.gesture),true);
 await page.locator('#effectQuality').selectOption('light');
 await page.reload();assert.equal(await page.evaluate(()=>audioStats.contexts),0); // Saved ON must not auto-start audio.
 await page.locator('#displayPanel').evaluate(el=>el.open=true);
 assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#effectQuality').inputValue(),'light');
 await page.locator('#effectQuality').selectOption('standard');
 await page.locator('#displayPanel').evaluate(el=>el.open=false);
 await page.locator('#planetPanel').evaluate(el=>el.open=true);await page.locator('#specialSample').selectOption('blackhole');await page.locator('#planetPanel').evaluate(el=>el.open=false);
 await page.locator('#angleInput').fill('-72');await page.locator('#speedInput').fill('120');
 await page.evaluate(()=>{
  window.cues=[];new MutationObserver(()=>cues.push(document.querySelector('#experienceCue').textContent)).observe(document.querySelector('#experienceCue'),{childList:true});
  window.frameGaps=[];let last=performance.now();const frame=t=>{frameGaps.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
 await page.locator('#launchButton').click();
 await page.waitForFunction(()=>document.querySelector('#experienceCue').textContent==='LIFTOFF');
 await page.screenshot({path:fileURLToPath(new URL('launch-375.png',dir))});
 assert.ok(await page.locator('#resetButton').isEnabled());
 await page.waitForFunction(()=>cues.includes('CLOSE CALL'),{timeout:8000});
 await page.screenshot({path:fileURLToPath(new URL('close-call-375.png',dir))});
 await page.locator('#result').waitFor({state:'visible'});assert.equal(await page.locator('#result').getAttribute('data-effect'),'escaped');
 const performanceResult=await page.evaluate(()=>{const gaps=frameGaps.filter(x=>x>0).sort((a,b)=>a-b);return{frames:gaps.length,medianMs:gaps[Math.floor(gaps.length*.5)],p95Ms:gaps[Math.floor(gaps.length*.95)],cues,audio:{...audioStats}};});
 assert.ok(performanceResult.cues.includes('SWINGBY'));assert.ok(performanceResult.audio.starts>0);assert.ok(performanceResult.audio.peak<=4);
 await page.locator('#resetButton').click();assert.ok(await page.locator('#launchButton').isEnabled());assert.equal(await page.locator('#experienceCue').textContent(),'');
 // UI mute stops all active nodes. The next launch remains playable and silent.
 await page.locator('#displayPanel').evaluate(el=>el.open=true);await page.locator('#soundToggle').click();await page.waitForFunction(()=>audioStats.active===0);
 await page.locator('#effectQuality').selectOption('light');await page.locator('#displayPanel').evaluate(el=>el.open=false);
 const starts=await page.evaluate(()=>audioStats.starts);await page.locator('#launchButton').click();await page.waitForFunction(()=>document.querySelector('#experienceCue').textContent==='LIFTOFF');
 assert.equal(await page.evaluate(()=>audioStats.starts),starts);await page.locator('#resetButton').click();
 // Failures keep distinct reasons in the real game renderer, with no input delay.
 for(const [type,kind]of[['blackhole','absorbed'],['star','overheated']]){
  await page.locator('#planetPanel').evaluate(el=>el.open=true);await page.locator('#specialSample').selectOption(type);await page.locator('#planetPanel').evaluate(el=>el.open=false);
  await page.locator('#launchButton').click();await page.locator('#result').waitFor({state:'visible'});
  assert.equal(await page.locator('#result').getAttribute('data-effect'),kind);
  if(type==='star')await page.screenshot({path:fileURLToPath(new URL('heat-failure-375.png',dir))});
  await page.locator('#resetButton').click();assert.ok(await page.locator('#launchButton').isEnabled());
 }
 // Existing stage, prediction and next-stage action stay available during CLEAR.
 await page.locator('#openStages').click();await page.locator('#stageList button').first().click();
 await page.locator('#angleInput').fill('-72');await page.locator('#speedInput').fill('126');
 await page.locator('#launchButton').click();await page.locator('#result.success').waitFor({state:'visible'});
 assert.equal(await page.locator('#resultLabel').textContent(),'CLEAR');assert.equal(await page.locator('#clearStars').textContent(),'★★★');assert.ok(await page.locator('#nextStage').isEnabled());
 await page.screenshot({path:fileURLToPath(new URL('clear-375.png',dir))});
 await page.locator('#nextStage').click();assert.ok(await page.locator('#launchButton').isEnabled());assert.ok(await page.locator('#result').isHidden());
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('orbit-maker.stage-progress.v1')));assert.equal(saved.design['stage-10'],2);assert.equal(saved.live['stage-12'],1);
 await page.locator('#displayPanel').evaluate(el=>el.open=true);
 await page.setViewportSize({width:320,height:568});await page.locator('#soundToggle').scrollIntoViewIfNeeded();
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,board:document.querySelector('#spaceFrame').getBoundingClientRect().height,buttons:[...document.querySelectorAll('#soundToggle,#resetButton,#launchButton')].map(el=>{const b=el.getBoundingClientRect();return{x:b.x,right:b.right,height:b.height};})}));
 assert.ok(layout.scrollWidth<=320);assert.ok(layout.board>=260);assert.ok(layout.buttons.every(b=>b.x>=0&&b.right<=320&&b.height>=44));
 await page.screenshot({path:fileURLToPath(new URL('settings-320.png',dir))});
 assert.deepEqual(errors,[]);
 await writeFile(new URL('browser-result.json',dir),JSON.stringify({browser:'Windows Chrome mobile viewport, not iPhone Safari',launch:true,closecall:true,swingby:true,clear:true,absorbed:true,overheated:true,reset:true,nextStage:true,settingsRestored:true,initialMute:true,userGestureAudio:true,savedOnDoesNotAutoplay:true,mute:true,light:true,oldProgressPreserved:true,performanceResult,layout,errors},null,2));
 console.log('Space Experience UI PASS: launch, CLOSE CALL, swingby, CLEAR, reset/next, sound/quality persistence, gesture audio/mute, 375px/320px');
}finally{await browser.close();await new Promise(r=>server.close(r));}
