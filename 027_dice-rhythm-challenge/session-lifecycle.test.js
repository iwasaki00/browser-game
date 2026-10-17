"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
let now=1000, sequence=0;
const timers = new Map();
const window = {setTimeout(fn){const id=++sequence;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},setInterval(fn){const id=++sequence;timers.set(id,fn);return id;},clearInterval(id){timers.delete(id);}};
const nodes = new Map();
function node(id){if(!nodes.has(id)) nodes.set(id,{hidden:true,checked:false,style:{setProperty(){}},classList:{remove(){},add(){}},querySelector(){return node('b');}});return nodes.get(id);}
const document={getElementById:node,querySelector:()=>({value:'normal'}),documentElement:node('html')};
const sandbox={window,document,performance:{now:()=>now},console,fetch:()=>{},clearTimeout:window.clearTimeout,cancelAnimationFrame(){},requestAnimationFrame:()=>++sequence};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'dice-cell-state.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'game.js'),'utf8').replace('new Game();','window.Game = Game;'),sandbox);
function game(){
 const g=Object.create(window.Game.prototype);
 Object.assign(g,{session:0,beatId:0,beatOpen:false,starting:false,resuming:false,paused:false,hasStarted:false,running:false,preparing:false,mode:'normal',bpm:120,currentBeatDuration:500,beatStart:1000,loadId:0,midiLoading:false,column:0,rows:[[],[2,2,2,2]],taps:[],wrongInput:false,score:0,combo:0,bestCombo:0,lives:3,totals:{PERFECT:0,GOOD:0,MISS:0,ASSIST:0},audio:{unlock:async()=>{},tap(){},metronome(){},result(){}},judge:{judge:()=>({grade:'PERFECT'})}});
 g.ui=new Proxy({}, {get(o,k){return o[k] ||= new Proxy(function(){},{get(t,p){return t[p] ||= node(k+':'+p);},set(t,p,v){t[p]=v;return true;}});}});
 g.previewChart=()=>{};g.applyBeatCss=()=>{};g.updateFrame=()=>{};
 return g;
}
async function main(){
 let g=game(), unlock=deferred(), unlocks=0;
 g.audio.unlock=()=>{unlocks++;return unlock.promise;};let ready=0;g.showReady=()=>ready++;
 const first=g.start();await g.start();assert.equal(unlocks,1);
 g.openStageMenu();unlock.resolve();await first;assert.equal(ready,0);assert.equal(g.running,false);
 g=game();g.showReady(false);const stale=timers.get(g.beatTimer);g.openStageMenu();await stale();assert.equal(g.running,false);
 g=game();g.running=true;g.beatOpen=true;g.taps=[10,200];g.advanceChart=()=>{};let advances=0;g.beginBeat=()=>{advances++;g.beatId++;g.beatOpen=true;};
 g.finishBeat(0,0);g.finishBeat(0,0);assert.equal(g.score,200);assert.equal(advances,1);
 g=game();g.running=true;g.hasStarted=true;g.beatOpen=true;g.taps=[10];now=1200;g.pause();const life=g.lives;g.finishBeat();assert.equal(g.lives,life);assert.equal(g.pausedElapsed,200);
 now=9000;await g.resume();await g.resume();await timers.get(g.beatTimer)();assert.equal(g.beatStart,8800);assert.deepEqual(g.taps,[10]);assert.equal(g.running,true);
 g=game();g.paused=true;g.audio.unlock=async()=>{throw Error('blocked');};await g.resume();assert.equal(g.paused,true);assert.match(g.ui.pauseMessage.textContent,/RESUME/);
 g=game();now=1200;g.running=true;g.beatOpen=true;let taps=0;g.audio.tap=()=>taps++;const button=node('button');
 for(let i=0;i<2;i++) g.onTap({preventDefault(){},currentTarget:button,type:'pointerdown',button:0,timeStamp:now},2);
 assert.equal(g.taps.length,2);assert.equal(taps,2);g.taps=[];g.beatStart=1150;g.onTap({preventDefault(){},currentTarget:button,type:'pointerdown',button:0,timeStamp:1100},2);assert.equal(g.taps.length,0);g.pause();g.onTap({preventDefault(){},currentTarget:button},2);assert.equal(taps,3);
 // UI must ignore a superseded file response and allow retry after failure.
 g=game();const a=deferred(), b=deferred();g.midi={loadFile:f=>f.name==='a'?a.promise:b.promise};let shown=[];g.ui.midiInfo=i=>shown.push(i);g.refreshMidiAnalysis=()=>{};
 const one=g.loadMidiFile({name:'a'}),two=g.loadMidiFile({name:'b'});b.resolve({bpm:120});await two;a.resolve({bpm:60});await one;assert.equal(shown.length,1);assert.equal(shown[0].bpm,120);assert.equal(g.midiLoading,false);
 g.midi.loadFile=async()=>{throw Error('invalid MIDI');};await g.loadMidiFile({name:'bad'});assert.equal(g.midiLoading,false);g.midi.loadFile=async()=>({bpm:100});await g.loadMidiFile({name:'retry'});assert.equal(shown.at(-1).bpm,100);
 // Exercise actual integration with delayed audio and delayed file reads.
 const context={currentTime:10,state:'running'};let audio=deferred();let scheduled=0;
 window.MidiCommon={getNotes:()=>[{startTime:0,endTime:1}],parse:()=>({})};window.MidiAudio={MidiSynth:class{constructor(){this.context=context;}ensureContext(){return audio.promise;}stopAll(){}schedule(){scheduled++;}}};
 window.MidiRhythmAnalyzer=window.MidiDiceChartGenerator=window.MidiGameChart=window.MidiChartDiagnostics={};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'midi-integration.js'),'utf8'),sandbox);
 const m=new window.MidiIntegration();m.song={totalNotes:1,duration:5};m.player.setSong(m.song);m.initialBeatDuration=()=>.5;m.getBeatTiming=i=>({beatIndex:i});
 const start=m.startWithCountIn();m.stop();audio.resolve(context);assert.equal(await start,null);assert.equal(m.player.playing,false);
 audio=deferred();const pending=m.player.startAt(10);m.player.pause();audio.resolve(context);await pending;assert.equal(m.player.playing,false);
 const fa=deferred(),fb=deferred();let parsed=[];m.parse=(buffer,name)=>{parsed.push(name);return name;};const la=m.loadFile({name:'a.mid',arrayBuffer:()=>fa.promise}),lb=m.loadFile({name:'b.mid',arrayBuffer:()=>fb.promise});fb.resolve(new ArrayBuffer(0));await lb;fa.resolve(new ArrayBuffer(0));await la;assert.deepEqual(parsed,['b.mid']);
 m.pausedTimelineTime=-1;audio=deferred();const r=m.resume();m.stop();audio.resolve(context);assert.equal(await r,null);assert.equal(m.player.playing,false);
 console.log(JSON.stringify({result:'PASS',scenarios:12}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
