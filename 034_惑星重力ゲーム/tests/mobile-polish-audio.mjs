import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {harness,dir,tap} from './mobile-polish-harness.mjs';
const h=await harness();
try{
 const context=await h.browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));const cdp=await context.newCDPSession(page);
 await page.addInitScript(()=>{window.realAudioContexts=[];const Native=window.AudioContext;if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);realAudioContexts.push(this);}};});
 await page.goto(h.url);assert.equal(await page.evaluate(()=>realAudioContexts.length),0);
 await tap(page,cdp,'#openMenuSettings');await tap(page,cdp,'#openDisplaySettings');assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'),'false');await tap(page,cdp,'#soundToggle');
 await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('AudioContext: running')&&document.querySelector('#audioDiagnostics').textContent.includes('音声時計: 進行'));
 const first=await page.locator('#audioDiagnostics').textContent();assert.match(first,/テスト音: sent/);assert.equal(await page.evaluate(()=>realAudioContexts.length),1);
 // A real native suspended context, resumed by an actual CDP touch gesture.
 await page.evaluate(()=>realAudioContexts[0].suspend());await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('suspended'));await tap(page,cdp,'#testSound');await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('running')&&document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
 const resumed=await page.locator('#audioDiagnostics').textContent();
 await page.evaluate(()=>{window.backgroundFlag=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>backgroundFlag});document.dispatchEvent(new Event('visibilitychange'));});
 await page.evaluate(()=>{backgroundFlag=false;document.dispatchEvent(new Event('visibilitychange'));});await tap(page,cdp,'#testSound');await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('音声時計: 進行'));await page.evaluate(()=>delete document.hidden);
 await page.evaluate(()=>realAudioContexts[0].close());await tap(page,cdp,'#testSound');await page.waitForFunction(()=>realAudioContexts.length===2&&realAudioContexts[1].state==='running');
 await tap(page,cdp,'#soundToggle');assert.equal(await page.locator('#testSound').isDisabled(),true);assert.match(await page.locator('#audioDiagnostics').textContent(),/テスト音: none/);
 await tap(page,cdp,'#soundToggle');await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));await tap(page,cdp,'#closeDisplaySettings');await tap(page,cdp,'#openMenuSettings');await page.waitForTimeout(150);await tap(page,cdp,'#closeMenuSettings');
 await page.reload();assert.equal(await page.evaluate(()=>realAudioContexts.length),0);await tap(page,cdp,'#openMenuSettings');await tap(page,cdp,'#openDisplaySettings');assert.equal(await page.locator('#soundToggle').getAttribute('aria-pressed'),'true');await tap(page,cdp,'#testSound');await page.waitForFunction(()=>document.querySelector('#audioDiagnostics').textContent.includes('テスト音: sent'));
 assert.deepEqual(errors,[]);await writeFile(new URL('audio-results.json',dir),JSON.stringify({browser:h.browser.version(),status:'PASS',context:'native Chrome Web Audio, not a mocked AudioContext; CDP touch gestures',first,resumed,checks:['initial OFF / no context before gesture','test sound sent and clock advancing','suspend / gesture resume','synthetic visibility interruption / gesture recovery','closed native context recreation','mute / unmute','settings and menu pause','saved ON survives reload; no automatic context creation before gesture'],bgm:'NOT APPLICABLE: existing game has synthesized effects only; no BGM added',audibleOutput:'UNVERIFIED: headless output graph only',iPhone:'UNVERIFIED',errors},null,2));console.log('MOBILE AUDIO PASS');await context.close();
}finally{await h.close();}
