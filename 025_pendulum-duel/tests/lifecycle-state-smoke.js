'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),elements=new Map(),windowHandlers={},documentHandlers={};
let rect={width:1000,height:540};
class Element{
 constructor(id){this.id=id;this.style={};this.dataset={};this.disabled=false;this.handlers={};this.tokens=new Set();this.classList={add:(...a)=>a.forEach(x=>this.tokens.add(x)),remove:(...a)=>a.forEach(x=>this.tokens.delete(x)),toggle:(x,on)=>{if(on??!this.tokens.has(x))this.tokens.add(x);else this.tokens.delete(x);}};}
 set innerHTML(value){this.html=value;for(const match of value.matchAll(/id=["']?([\w-]+)/g))elements.set(match[1],new Element(match[1]));}
 get innerHTML(){return this.html||'';}
 addEventListener(type,fn){this.handlers[type]=fn;}
 setAttribute(){} appendChild(){} closest(){return this;} setPointerCapture(){}
 getBoundingClientRect(){return rect;}
}
const $=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
$('game').getContext=()=>new Proxy({}, {get:()=>()=>{}});
const document={hidden:false,getElementById:$,querySelector:()=>$('.controls'),querySelectorAll:selector=>selector==='.held'?[...elements.values()].filter(e=>e.tokens.has('held')):[],addEventListener:(type,fn)=>documentHandlers[type]=fn,createElement:()=>new Element()};
const sandbox={document,window:{devicePixelRatio:2,addEventListener:(type,fn)=>windowHandlers[type]=fn},performance:{now:()=>1000},requestAnimationFrame:()=>{},location:{search:''},URLSearchParams,console,Math};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'weapons.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'game.js'),'utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
const event=(id,type,pointerId)=>$(id).handlers[type]({pointerId,pointerType:'touch',button:0,cancelable:true,preventDefault(){}});
run("mode='local';state='selecting';readySelections.fill(true);startSelectedMatch();this.savedPlayers=players;countdown=2;startSelectedMatch()");
assert(run('players===savedPlayers&&countdown===2'));
windowHandlers.blur();assert(run("state==='paused'&&pausedFrom==='countdown'"));
const countdown=run('countdown');run('frame(1000)');assert.equal(run('countdown'),countdown);
run('pause();startBattle()');assert.equal(run('state'),'running');
event('ccw0','pointerdown',1);event('ccw0','pointerdown',2);event('lock0','pointerdown',3);event('cw1','pointerdown',4);
event('ccw0','pointerup',1);event('ccw0','pointerup',99);
assert(run('inputs[0].ccw&&inputs[0].lock&&inputs[1].cw'));
windowHandlers.keydown({key:'a',preventDefault(){}});event('ccw0','pointercancel',2);assert(run('inputs[0].ccw'));
windowHandlers.keyup({key:'a'});event('lock0','lostpointercapture',3);assert(run('!inputs[0].ccw&&!inputs[0].lock&&inputs[1].cw'));
event('cw1','pointercancel',4);assert(run('!inputs[1].cw'));
windowHandlers.blur();
const frozen=run('JSON.stringify({players,remaining,hazardState,elapsed})');
run('frame(1200)');assert.equal(run('JSON.stringify({players,remaining,hazardState,elapsed})'),frozen);
document.hidden=true;documentHandlers.visibilitychange();assert.equal(run('state'),'paused');
document.hidden=false;documentHandlers.visibilitychange();assert.equal(run('state'),'paused');
run('pause()');document.hidden=true;documentHandlers.visibilitychange();assert.equal(run('state'),'paused');
document.hidden=false;documentHandlers.visibilitychange();assert.equal(run('state'),'paused');
run('players[0].hp=73;remaining=42;hazardState.chaos[0].value=67;lock(players[0]);spawnBomb();players[0].nodes[1].px-=2;players[0].nodes[1].py+=3;');
for(const next of [{width:390,height:600},{width:844,height:180},{width:375,height:450},{width:1000,height:540}]){
 run('this.snapshot={width,height,p:players[0],L:players[0].L,nodes:players[0].nodes.map(n=>({...n})),chords:players[0].chords.map(c=>({...c})),bomb:{...hazardState.bomb},chaos:JSON.stringify(hazardState.chaos)}');
 rect=next;run('resize()');
 assert(run(`(()=>{const s=snapshot,p=players[0],r=width/s.width,dy=(height-s.height*r)*.48,near=(a,b)=>Math.abs(a-b)<1e-7;return p===s.p&&p.hp===73&&remaining===42&&JSON.stringify(hazardState.chaos)===s.chaos&&near(p.L,s.L*r)&&p.nodes.every((n,i)=>near(n.x,s.nodes[i].x*r)&&near(n.y,s.nodes[i].y*r+dy)&&near(n.x-n.px,(s.nodes[i].x-s.nodes[i].px)*r)&&near(n.y-n.py,(s.nodes[i].y-s.nodes[i].py)*r))&&p.chords.every((c,i)=>near(c.d,s.chords[i].d*r))&&near(hazardState.bomb.x,s.bomb.x*r);})()`),'Resize changed angles, velocity, LOCK or match state');
}
run("pause();players.forEach(p=>p.hp=9999);for(let i=0;i<240;i++)step(1/240,true)");
assert(run("players.every(p=>p.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)))"));
run('remaining=.001;step(1/240,true)');assert.equal(run('state'),'over');
const result=$('overlay').innerHTML;run('finish()');assert.equal($('overlay').innerHTML,result);
run('beginCountdown()');
assert(run("state==='countdown'&&remaining===60&&elapsed===0&&players.every(p=>p.hp===100&&p.cool===0&&p.nodes.length===p.weapon.segments+1)&&hazardState.chaos.every(c=>c.value===0)&&hazardState.bomb===null&&hazardState.event.phase==='idle'&&inputs.every(p=>!p.ccw&&!p.lock&&!p.cw)"));
const idle=run('JSON.stringify(players.map(({trail,...p})=>p))');run('frame(1210)');assert.equal(run('JSON.stringify(players.map(({trail,...p})=>p))'),idle,'Countdown ran collision physics');
run("mode='cpu';startBattle();clearInput()");event('cw1','pointerdown',10);windowHandlers.keydown({key:'l',preventDefault(){}});assert(run('!inputs[1].cw'));
run('players[0].hp=0;step(1/240,true)');assert.equal(run('state'),'over');
console.log('Lifecycle state smoke passed: pointer ownership, keyboard, CPU, countdown/blur/visibility, resize motion + LOCK + hazards, timeout/KO, result guard and replay.');
