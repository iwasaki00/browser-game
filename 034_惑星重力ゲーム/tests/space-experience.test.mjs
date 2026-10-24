import test from 'node:test';
import assert from 'node:assert/strict';
import {SpaceExperience, EncounterObserver, loadExperience, saveExperience, EXPERIENCE_KEY, failureKind} from '../js/space-experience.js';
import {SpaceAudio} from '../js/space-audio.js';
import {createSimulation, stepSimulation} from '../js/physics.js';
import {createPreview, advancePreview} from '../js/preview.js';
import {getChallenge} from '../js/challenges.js';
import {getSpecialSample} from '../js/special-samples.js';
import {stepLiveFlight} from '../js/live-gravity.js';

const deepFreeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))deepFreeze(v);}return value;};
const sample=(x,y,planet,status='flying')=>({rocket:{position:{x,y},radius:5,velocity:{x:100,y:0}},planets:[planet],status,world:{width:375,height:500},elapsed:1});

test('初期ミュート・標準、設定保存復元と旧セーブへの非干渉',()=>{
 const values=new Map([['orbit-maker.stage-progress.v1','legacy']]);const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.deepEqual(loadExperience(storage),{quality:'standard',sound:false});
 saveExperience(storage,{quality:'light',sound:true});assert.deepEqual(loadExperience(storage),{quality:'light',sound:true});
 assert.equal(values.get('orbit-maker.stage-progress.v1'),'legacy');assert.equal(values.size,2);assert.ok(values.has(EXPERIENCE_KEY));
 assert.deepEqual(loadExperience({getItem:()=>'{bad'}),{quality:'standard',sound:false});
 assert.doesNotThrow(()=>saveExperience({setItem(){throw Error();}},{sound:true}));
});

for(const reason of ['absorbed','overheated'])test(`CLOSE CALL ${reason}: 安全離脱時のみ・侵入と高速横断は除外`,()=>{
 const p={id:'p',x:100,y:100,radius:20,hazards:[{radius:20,reason}]};
 const run=(points,status='flying')=>{const observer=new EncounterObserver();const events=[];
  for(let i=1;i<points.length;i++)events.push(...observer.update(sample(...points[i-1],p),sample(...points[i],p,i===points.length-1?status:'flying')));return events.filter(e=>e.kind==='closecall');};
 const near=[[40,130],[75,130],[100,130],[125,130],[160,130]];
 assert.equal(run(near).length,1); // Five-unit clearance after rocket radius.
 assert.equal(run(near.slice(0,3)).length,0); // Do not celebrate on approach.
 assert.equal(run([[40,150],[100,150],[160,150]]).length,0);
 assert.equal(run([[40,120],[100,120],[160,120]],'crashed').length,0);
 assert.equal(run([[40,100],[160,100]]).length,0); // Swept crossing; endpoints safe.
 assert.equal(run([...near.slice(0,3),near.at(-1)],'crashed').length,0);
 const moving={...p,x:110};const o=new EncounterObserver();
 assert.doesNotThrow(()=>o.update(deepFreeze(sample(60,130,p)),deepFreeze(sample(100,130,moving))));
});

test('接近と90度旋回イベント、通常／特殊惑星の色',()=>{
 const planet={id:'p',x:100,y:100,radius:20,render:{glow:'#ff00ff'}};const observer=new EncounterObserver();let events=[];
 let previous=sample(260,100,planet);
 for(const a of [0,.4,.8,1.2,1.6,2]){const state=sample(100+60*Math.cos(a),100+60*Math.sin(a),planet);events.push(...observer.update(previous,state));previous=state;}
 assert.equal(events.filter(e=>e.kind==='approach').length,1);assert.equal(events.filter(e=>e.kind==='swingby').length,1);
 assert.equal(observer.tint,'#ff00ff');assert.ok(observer.proximity>0);
});

test('発射・CLEAR・5種類の失敗演出、有限寿命、RESET、軽量の上限',()=>{
 const state=createSimulation(getChallenge('stage-01')),events=[];const fx=new SpaceExperience('standard',e=>events.push(e));fx.launch(deepFreeze(state));
 assert.equal(fx.notice.text,'LIFTOFF');assert.equal(fx.particles.length,20);
 fx.finish({...state,status:'cleared'});assert.equal(fx.notice.text,'CLEAR');
 for(const [status,reason,kind]of[['crashed',undefined,'collision'],['crashed','absorbed','absorbed'],['crashed','overheated','overheated'],['escaped',undefined,'escaped'],['timeout',undefined,'timeout']]){
  const end={...state,status,reason};assert.equal(failureKind(end),kind);fx.finish(end);assert.equal(fx.notice.kind,kind);
 }
 assert.ok(fx.particles.length<=64);assert.ok(fx.rings.length<=6);
 fx.setQuality('light');assert.ok(fx.particles.length<=12);
 for(let i=0;i<100;i++)fx.finish({...state,status:'cleared'});
 assert.ok(fx.particles.length<=12);assert.ok(fx.rings.length<=6);
 fx.update(2);assert.equal(fx.particles.length,0);assert.equal(fx.rings.length,0);assert.equal(fx.notice,null);
 fx.launch(state);fx.reset();assert.equal(fx.particles.length,0);assert.equal(fx.observer.proximity,0);
 assert.ok(events.includes('launch')&&events.includes('cleared'));
});

test('物理状態・軌道予測・重力操作に非干渉（通常／特殊、両品質）',()=>{
 for(const stage of [getChallenge('stage-01'),getChallenge('stage-20'),getSpecialSample('repulsor')])for(const quality of ['standard','light']){
  const launch=stage.solution??stage.launch;let actual=createSimulation(stage,launch),baseline=structuredClone(actual);
  const fx=new SpaceExperience(quality);fx.launch(deepFreeze(actual));
  const preview=createPreview(stage,actual.rocket.velocity);while(!preview.done)advancePreview(preview,1441);
  let steps=0;
  while(actual.status==='flying'){
   const previous=deepFreeze(actual);baseline=stepSimulation(baseline,1/120);actual=stepSimulation(actual,1/120);
   fx.observe(previous,deepFreeze(actual));fx.update(1/120);assert.deepEqual(actual,baseline);steps++;
  }
  assert.deepEqual(actual,preview.state);assert.equal(steps,preview.steps);
  const before=structuredClone(actual);fx.finish(deepFreeze(actual));assert.deepEqual(actual,before);
 }
 const stage=getSpecialSample('dense');let a=createSimulation(stage),b=structuredClone(a);const fx=new SpaceExperience();
 for(let i=0;i<150&&a.status==='flying';i++){
  const previous=deepFreeze(a),target={'sample-planet':{x:210,y:280}};
  a=stepLiveFlight(a,target,stage,'live',1/120);b=stepLiveFlight(b,target,stage,'live',1/120);
  fx.observe(previous,deepFreeze(a));assert.deepEqual(a,b);
 }
});

function fakeAudio(){
 const counts={contexts:0,starts:0,resumes:0,disconnects:0};
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 class Context{
  constructor(){counts.contexts++;this.state='suspended';this.currentTime=0;this.destination={};}
  resume(){counts.resumes++;this.state='running';return Promise.resolve();}
  createGain(){return{gain:param(),connect(){},disconnect(){counts.disconnects++;}};}
  createOscillator(){return{frequency:param(),connect(){},disconnect(){counts.disconnects++;},start(){counts.starts++;},stop(){}};}
 }
 return{counts,Context};
}
test('音声は操作後に開始、ON/OFF、種類別音、重複制限・ノード解放',()=>{
 const {counts,Context}=fakeAudio();const audio=new SpaceAudio(false,{webkitAudioContext:Context});
 audio.unlock();audio.play('launch');assert.equal(counts.contexts,0);
 audio.setEnabled(true);audio.play('launch');assert.equal(counts.contexts,0);
 audio.unlock();assert.equal(counts.contexts,1);assert.equal(counts.resumes,1);assert.equal(audio.master.gain.value,.055);
 assert.equal(audio.play('launch'),true);assert.equal(audio.play('launch'),false);
 for(const kind of ['approach','swingby','closecall'])assert.equal(audio.play(kind),true);
 assert.equal(audio.play('cleared'),false);assert.equal(audio.voices.size,4);
 for(const v of [...audio.voices])v.onended();assert.equal(audio.voices.size,0);
 for(const kind of ['cleared','collision','absorbed','overheated','escaped','timeout','ui']){
  audio.context.currentTime+=2;assert.equal(audio.play(kind),true);for(const v of [...audio.voices])v.onended();
 }
 audio.context.currentTime+=2;audio.play('launch');audio.setEnabled(false);assert.equal(audio.voices.size,0);assert.equal(audio.play('ui'),false);
 assert.ok(counts.disconnects>0);audio.setEnabled(true);audio.unlock();assert.equal(counts.contexts,1);
});
test('音声非対応・開始拒否でもゲーム側へ例外を出さない',async()=>{
 const missing=new SpaceAudio(true,{});missing.unlock();assert.equal(missing.unavailable,true);assert.equal(missing.play('launch'),false);
 const denied=new SpaceAudio(true,{AudioContext:class{constructor(){throw Error('denied');}}});assert.doesNotThrow(()=>denied.unlock());
 const {Context}=fakeAudio();const suspended=new SpaceAudio(true,{AudioContext:class extends Context{resume(){return Promise.reject(Error('blocked'));}}});
 suspended.unlock();await Promise.resolve();await Promise.resolve();assert.equal(suspended.unavailable,true);assert.equal(suspended.play('launch'),false);
});
