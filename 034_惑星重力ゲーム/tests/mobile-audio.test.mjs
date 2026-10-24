import test from 'node:test';
import assert from 'node:assert/strict';
import {SpaceAudio} from '../js/space-audio.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture(resume){
 const stats={contexts:[],starts:0,connections:[],closed:0};
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=extra=>({connect(to){stats.connections.push([this,to]);},disconnect(){this.disconnected=true;},...extra});
 class Context{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={destination:true};stats.contexts.push(this);}
  resume(){return resume?resume(this,stats):Promise.resolve().then(()=>{this.state='running';this.onstatechange?.();});}
  close(){stats.closed++;this.state='closed';return Promise.resolve();}
  createGain(){return node({gain:param()});}
  createOscillator(){return node({frequency:param(),start(){stats.starts++;},stop(){}});}
 }
 const session={type:'auto'},host={AudioContext:Context,navigator:{audioSession:session}};
 return{stats,host,session};
}

test('非同期resume完了を待って実ゲームと同じmaster/destinationへテスト音を送る',async()=>{
 let resumeDone;const {host,stats,session}=fixture(ctx=>new Promise(resolve=>{resumeDone=()=>{ctx.state='running';resolve();};}));
 const audio=new SpaceAudio(false,host);audio.unlock();assert.equal(stats.contexts.length,0);
 audio.setEnabled(true);const sent=audio.testSound();assert.equal(stats.starts,0);assert.equal(audio.diagnostics().pending,true);
 assert.equal(session.type,'playback');resumeDone();assert.equal(await sent,true);assert.equal(stats.starts,1);
 assert.ok(stats.connections.some(([from,to])=>from===audio.master&&to===audio.context.destination));
 const voice=[...audio.voices][0],gain=audio.gains.get(voice);assert.ok(stats.connections.some(([from,to])=>from===voice&&to===gain));assert.ok(stats.connections.some(([from,to])=>from===gain&&to===audio.master));
 audio.setEnabled(false);assert.equal(session.type,'auto');assert.equal(audio.voices.size,0);assert.equal(audio.gains.size,0);assert.ok(gain.disconnected);
});

test('resumeの重複をまとめ、完了前の飛行音を後から大量再生しない',async()=>{
 let done,calls=0;const {host,stats}=fixture(ctx=>{calls++;return new Promise(resolve=>{done=()=>{ctx.state='running';resolve();};});});
 const audio=new SpaceAudio(true,host),a=audio.unlock(),b=audio.unlock();assert.equal(a,b);assert.equal(calls,1);
 for(let i=0;i<100;i++)assert.equal(audio.play('approach'),false);
 done();await a;assert.equal(stats.starts,0);assert.equal(audio.play('launch'),true);audio.setEnabled(false);
});

test('テスト音をすぐ再タップしても失敗にせず、前の確認音と重ねない',async()=>{
 const {host,stats}=fixture();const audio=new SpaceAudio(true,host);
 assert.equal(await audio.testSound(),true);assert.equal(await audio.testSound(),true);
 assert.equal(stats.starts,2);assert.equal(audio.voices.size,1);audio.setEnabled(false);
});

test('resumeが解決しない場合は期限付きで診断し、次のタップだけで再生成する',async()=>{
 const {host,stats}=fixture((ctx,s)=>s.contexts.length===1?new Promise(()=>{}):Promise.resolve().then(()=>{ctx.state='running';}));
 const audio=new SpaceAudio(true,host,{resumeTimeoutMs:10});assert.equal(await audio.testSound(),false);
 assert.equal(audio.diagnostics().lastError,'ResumeTimeout');assert.equal(audio.diagnostics().pending,false);assert.equal(stats.contexts.length,1);
 assert.equal(await audio.testSound(),true);assert.equal(stats.contexts.length,2);assert.equal(stats.closed,1);audio.setEnabled(false);
});

test('開始拒否と非対応を診断し、再タップで回復する',async()=>{
 const {host,stats}=fixture((ctx,s)=>s.contexts.length===1?Promise.reject(new DOMException('denied','NotAllowedError')):Promise.resolve().then(()=>{ctx.state='running';}));
 const audio=new SpaceAudio(true,host);assert.equal(await audio.testSound(),false);assert.equal(audio.lastError,'NotAllowedError');assert.equal(await audio.testSound(),true);audio.setEnabled(false);
 const missing=new SpaceAudio(true,{});assert.equal(await missing.testSound(),false);assert.equal(missing.diagnostics().state,'not-created');assert.match(missing.lastError,/Unsupported/);
});

test('中断・バックグラウンドから戻っても勝手に音を出さず、次の操作でresumeする',async()=>{
 const {host,stats}=fixture();const audio=new SpaceAudio(true,host);await audio.unlock();audio.play('launch');
 audio.context.state='interrupted';audio.context.onstatechange();audio.backgrounded();audio.foregrounded();
 assert.equal(stats.contexts.length,1);assert.equal(audio.voices.size,0);assert.equal(audio.play('ui'),false);
 assert.equal(await audio.testSound(),true);assert.equal(audio.context.state,'running');assert.equal(stats.contexts.length,1);assert.equal(audio.resumeAttempts,2);audio.setEnabled(false);
});

test('closed状態は次の明示操作で再生成し、古いcontextを使わない',async()=>{
 const {host,stats}=fixture();const audio=new SpaceAudio(true,host);await audio.unlock();const old=audio.context;old.state='closed';
 assert.equal(await audio.testSound(),true);assert.notEqual(audio.context,old);assert.equal(stats.contexts.length,2);audio.setEnabled(false);
});

for(const action of ['mute','background'])test(`開始待ち中の${action}で遅延した確認音をキャンセル`,async()=>{
 let done;const {host,stats}=fixture(ctx=>new Promise(resolve=>{done=()=>{ctx.state='running';resolve();};}));const audio=new SpaceAudio(true,host);
 const result=audio.testSound();if(action==='mute')audio.setEnabled(false);else audio.backgrounded();
 done();assert.equal(await result,false);await sleep(0);assert.equal(stats.starts,0);assert.equal(audio.voices.size,0);audio.setEnabled(false);
});

test('runningでも音声時計が停止していれば診断し、次のテスト音で再生成する',async()=>{
 const {host,stats}=fixture();const audio=new SpaceAudio(true,host);await audio.testSound();await sleep(720);
 assert.equal(audio.clockAdvancing,false);assert.equal(audio.lastError,'AudioClockNotAdvancing');assert.equal(stats.contexts.length,1);
 await audio.testSound();assert.equal(stats.contexts.length,2);audio.setEnabled(false);
});

test('音声時計進行と4音上限、AudioSession非対応でも通常経路を維持',async()=>{
 const {host,stats}=fixture();Object.defineProperty(host.navigator,'audioSession',{get(){throw Error('unsupported');}});
 const audio=new SpaceAudio(true,host);assert.equal(await audio.testSound(),true);audio.context.currentTime=.2;await sleep(180);assert.equal(audio.clockAdvancing,true);
 for(const kind of ['launch','swingby','closecall'])assert.equal(audio.play(kind),true);
 assert.equal(audio.voices.size,4);assert.equal(audio.play('cleared'),false);assert.equal(stats.contexts.length,1);audio.setEnabled(false);
});
