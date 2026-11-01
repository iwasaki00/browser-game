import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYER_CLASSES} from '../js/data.js';
import {movementCase,setupMovement,sample,step,versionRuntime,historical,REFS} from './helpers/movement-comparison.mjs';
const versions=['A1','B','B1'],classes=Object.keys(PLAYER_CLASSES);
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
for(const id of classes)test(id+': actual engine 1/3s, left/right, long hold and dt independence vs A1/B',()=>{
 for(const version of versions)for(const seconds of [1,3])for(const direction of [-1,1])for(const hz of [30,60,144]){
  const {before,after,speed}=movementCase(version,id,{seconds,direction,hz});near(after.x-before.x,speed*seconds*direction);near(after.time,seconds);near(after.anim-before.anim,10*seconds);
 }
});
for(const id of classes)test(id+': jump/flight horizontal movement and animation unchanged',()=>{
 for(const version of versions){const r=setupMovement(version,id,{air:id==='WING'});r.pointer('right','pointerdown');r.pointer(id==='WING'?'hover':'jump','pointerdown');const a=sample(r);step(r,.2);const b=sample(r);assert.ok(b.y<116);near(b.x-a.x,PLAYER_CLASSES[id].speed*.2);near(b.anim-a.anim,2);if(id==='WING'){near(b.y,a.y);near(b.energy,98.4)}}
});
test('pause releases old press, paused game time stays fixed, new long hold after resume works in all classes',()=>{
 for(const version of versions)for(const id of classes){const r=setupMovement(version,id);r.pointer('right','pointerdown');step(r,1);const a=sample(r);r.key('keydown','p');assert.equal(r.run('state'),'pause');step(r,3);assert.deepEqual(sample(r),{...a,inputRight:false});r.key('keydown','p');step(r,.5);near(sample(r).x,a.x);r.pointer('right','pointerdown');step(r,3);near(sample(r).x-a.x,PLAYER_CLASSES[id].speed*3)}
});
test('held movement survives pointermove and a different finger cancel; release stops at each version',()=>{
 for(const version of versions){const r=setupMovement(version,'WING',{air:true});r.pointer('right','pointerdown',{pointerId:8});r.pointer('up','pointerdown',{pointerId:9});r.pointer('hover','pointerdown',{pointerId:10});r.pointer('aimPad','pointerdown',{pointerId:11});r.run('shoot=()=>{}');
  for(let i=0;i<60;i++){r.pointer('right','pointermove',{pointerId:8,clientX:-100});r.run('update(1/60)')}
  near(sample(r).x,1910);near(sample(r).energy,80);assert.equal(r.run('input.right&&input.fire&&input.up&&input.hover'),true);r.pointer('up','pointercancel',{pointerId:9});assert.equal(r.run('input.right&&input.fire&&input.hover'),true);r.pointer('right','pointerup',{pointerId:8});const x=sample(r).x;step(r,.2);near(sample(r).x,x);r.run('resetInput()');assert.equal(r.run('input.fire||input.hover'),false)}
});
test('B1 intentional turn matches A1 camera immediately, not B direction-hold lag',()=>{
 for(const id of classes){const snapshots=[];for(const version of versions){const r=setupMovement(version,id);r.pointer('left','pointerdown');const frames=[];for(let i=0;i<60;i++){r.run('update(1/60)');frames.push(sample(r))}snapshots.push(frames)}
  assert.equal(snapshots[1][0].direction,1);for(let i=0;i<60;i++){near(snapshots[2][i].cameraX,snapshots[0][i].cameraX);near(snapshots[2][i].lookAhead,snapshots[0][i].lookAhead);near(snapshots[2][i].zoom,snapshots[0][i].zoom);near(snapshots[2][i].screenX,snapshots[0][i].screenX)}
 }
});
test('almost fixed camera at left edge and sustained forward follow match A1/B/B1',()=>{
 for(const x of [64,1800])for(const id of classes){const rows=versions.map(v=>{const r=setupMovement(v,id,{x});r.pointer('right','pointerdown');step(r,1);return sample(r)});for(const row of rows){near(row.x,rows[0].x);near(row.cameraX,rows[0].cameraX);near(row.zoom,.5);if(x===64)near(row.cameraX,0)}}
});
for(const id of ['RANGER','WING'])test(id+': marker OFF removes bracket commands; sprite frames/muzzle match A1 and B',()=>{
 const traces=[];for(const v of versions){const r=versionRuntime(v,{recordDraw:true});r.click('test-lab');r.change('labPreset',id);r.click('lab-close');r.run(`game.player.x=300;game.player.y=60;game.player.invuln=0;game.player.onGround=${id==='RANGER'};game.player.anim=1;activeStudy=()=>({_u:{ranger:true,wing:true,held:true},ranger:'ranger.png',wing:'wing.png',held:'held.png'})`);r.drawCalls.length=0;r.run('drawPlayer(game.player)');traces.push(r.drawCalls)}
 const images=c=>c.filter(a=>a[0]==='drawImage');assert.deepEqual(images(traces[2]),images(traces[0]));assert.deepEqual(images(traces[2]),images(traces[1]));assert.ok(traces[1].some(a=>a[0]==='stroke'));assert.equal(traces[2].filter(a=>['stroke','strokeRect','fillRect'].includes(a[0])).length,0);let depth=0;for(const call of traces[2]){if(call[0]==='save')depth++;if(call[0]==='restore')depth--;assert.ok(depth>=0)}assert.equal(depth,0);
});
test('no movement, art/PNG, frame accumulator or save changes in the compared revisions',()=>{
 for(const path of ['js/player.js','js/art-preview.js']){const current=readFileSync(new URL('../'+path,import.meta.url),'utf8');for(const ref of [REFS.A1,REFS.B])assert.equal(historical(ref,path),current)}
 const getLoop=s=>s.slice(s.indexOf('function loop(ts)'),s.indexOf('const updateEnd=',s.indexOf('function loop(ts)')));const current=readFileSync(new URL('../js/game.js',import.meta.url),'utf8');for(const ref of [REFS.A1,REFS.B])assert.equal(getLoop(historical(ref,'js/game.js')),getLoop(current));
});

test('30/60/144 render callbacks use the same real 60Hz update accumulator, not distance per draw',()=>{
 for(const v of versions)for(const hz of [30,60,144]){const r=setupMovement(v,'RANGER');r.pointer('right','pointerdown');r.run(`last=0;acc=0;for(let i=1;i<=${3*hz};i++)loop(i*1000/${hz})`);const row=sample(r);near(row.x-1800,row.time*95);assert.ok(row.time>=3-1/60-1e-8&&row.time<=3+1e-8);near(row.anim,row.time*10)}
});
