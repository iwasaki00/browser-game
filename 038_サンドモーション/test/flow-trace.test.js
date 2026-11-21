import test from 'node:test';
import assert from 'node:assert/strict';
import { PathEngine } from '../src/paths.js';
import { TRACE, traceRadius } from '../src/trace.js';
import { canvasPoint, canvasDisplaySize } from '../src/input.js';
import { naturalFixture, naturalRaster } from './natural-reference.js';
import { Reassembly } from '../src/reassembly.js';

function setup(w, h, porous = false) {
  const e = naturalFixture(PathEngine, w, h);
  if (porous) {
    const grains=[];
    for(let id=0;id<e.count;id++)if((e.x[id]+e.y[id])%5)
      grains.push({x:e.x[id],y:e.y[id],color:[...e.colors.subarray(id*4,id*4+4)]});
    e.load(grains);
  }
  e.beginTrace(); return e;
}
function metrics(e) {
  let moved=0,sum=0,max=0;
  for(let id=0;id<e.count;id++) {const d=Math.hypot(e.x[id]-e.originX[id],e.y[id]-e.originY[id]);if(d)moved++;sum+=d;max=Math.max(max,d);}
  return {moved,mean:moved?sum/moved:0,max};
}
function stroke(e, strength='standard', speed=800, width='medium', path=[.3,.45,.7,.45]) {
  return e.traceSegment(e.width*path[0],e.height*path[1],e.width*path[2],e.height*path[3],traceRadius(e.width,width),speed,strength);
}
function check(e, colors) {
  e.assertIntegrity();assert.deepEqual(e.colors,colors);assert.equal(e.grid.filter(Boolean).length,e.count);
  const pixels=naturalRaster(e);let visible=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i])visible++;
  assert.equal(visible,e.count);
  for(let id=0;id<e.count;id++)assert.equal(e.grid[e.y[id]*e.width+e.x[id]],id+1);
  assert.ok(e.lastTraceStats.work<=e.lastTraceStats.workLimit);assert.ok(e.lastTraceStats.workLimit<=TRACE.maxWork);
}
for(const [w,h] of [[180,300],[270,450]]) {
  test(`${w} flow: weak/standard/strong move progressively more grains and further along the same dense trace`,()=>{
    const values=[];
    for(const strength of ['weak','standard','strong']){
      const e=setup(w,h),colors=e.colors.slice();stroke(e,strength);check(e,colors);values.push(metrics(e));
      assert.ok(e.lastTraceStats.cycles>0);assert.equal(e.lastTraceStats.pushes,0);
      for(let id=0;id<e.count;id++)assert.ok(Math.abs(e.x[id]-e.originX[id])+Math.abs(e.y[id]-e.originY[id])<=e.lastTraceStats.budget);
    }
    assert.ok(values[0].moved<values[1].moved&&values[1].moved<values[2].moved);
    assert.ok(values[0].mean<values[1].mean&&values[1].mean<values[2].mean);
  });
  test(`${w} flow: fast trace moves further; reversing the trace changes directional mixing`,()=>{
    const slow=setup(w,h),fast=setup(w,h),reverse=setup(w,h),colors=slow.colors.slice();
    stroke(slow,'standard',800);stroke(fast,'standard',16);stroke(reverse,'standard',16,'medium',[.7,.45,.3,.45]);
    assert.ok(metrics(fast).mean>metrics(slow).mean);assert.notDeepEqual(fast.x,reverse.x);
    for(const e of [slow,fast,reverse])check(e,colors);
  });
  test(`${w} flow: nearby vacancies create short push chains and local grooves`,()=>{
    const e=setup(w,h,true),colors=e.colors.slice(),old=e.grid.slice();stroke(e,'strong');check(e,colors);
    assert.ok(e.lastTraceStats.pushes>0);assert.ok(e.lastTraceStats.chainMoves>0);
    assert.ok(e.lastTraceStats.maxChainLength>1);assert.ok(e.lastTraceStats.maxChainLength<=e.lastTraceStats.reach);
    let newVoids=0;for(let y=Math.floor(h*.45-2);y<=h*.45+2;y++)for(let x=Math.floor(w*.3);x<=w*.7;x++)if(old[y*w+x]&&!e.grid[y*w+x])newVoids++;
    assert.ok(newVoids>0);
  });
  test(`${w} flow: strong 30 repeats preserve visible grains, idle poses and exact return/reset`,()=>{
    const e=setup(w,h),colors=e.colors.slice();
    for(let i=0;i<30;i++){stroke(e,'strong');check(e,colors);}
    const x=e.x.slice(),y=e.y.slice();
    for(const gravity of [[1,0],[-1,0],[0,-1]]){e.setGravity(...gravity);for(let i=0;i<200;i++)e.step();}
    assert.deepEqual(e.x,x);assert.deepEqual(e.y,y);
    const ret=new Reassembly(e);assert.ok(ret.start());ret.advance(1500);
    assert.deepEqual(e.x,e.originX);assert.deepEqual(e.y,e.originY);assert.equal(e.fixedCount,e.count);check(e,colors);
    e.beginTrace();stroke(e,'strong');e.reset();assert.deepEqual(e.x,e.originX);assert.deepEqual(e.y,e.originY);check(e,colors);
  });
  test(`${w} flow: every preset respects its influence radius and leaves fixed sand outside untouched`,()=>{
    for(const width of ['small','medium','large'])for(const strength of ['weak','standard','strong']) {
      const e=setup(w,h),colors=e.colors.slice();stroke(e,strength,800,width);check(e,colors);
      const radius=e.lastTraceStats.influenceRadius;
      for(let id=0;id<e.count;id++) {
        const x=e.originX[id],y=e.originY[id],cx=Math.max(w*.3,Math.min(w*.7,x));
        if(Math.hypot(x-cx,y-h*.45)>radius){assert.equal(e.x[id],x);assert.equal(e.y[id],y);assert.equal(e.fixed[id],1);}
      }
    }
  });
  test(`${w} flow: walls and edge strokes retain grain count and wall-connected sides`,()=>{
    const e=setup(w,h),particles=[],mid=Math.floor(w/2),scale=w/180;
    for(let id=0;id<e.count;id++)if(Math.abs(e.x[id]-mid)>3*scale)
      particles.push({x:e.x[id],y:e.y[id],color:[...e.colors.subarray(id*4,id*4+4)]});
    e.load(particles);e.editWallSegment(mid,0,mid,h-1);e.beginTrace();
    const colors=e.colors.slice(),walls=e.walls.slice(),side=Array.from(e.x,x=>x<mid);
    for(const path of [[.4,.2,.6,.7],[-.1,0,1.1,0],[0,-.1,0,1.1],[1,0,1,1],[0,1,1,1]]){stroke(e,'strong',16,'large',path);check(e,colors);}
    assert.deepEqual(e.walls,walls);for(let id=0;id<e.count;id++)assert.equal(e.x[id]<mid,side[id]);
  });
}
test('flow: high quality retains comparable screen-space width, response and CSS touch mapping',()=>{
  const normalized=[];
  for(const [w,h]of[[180,300],[270,450]]) {
    assert.equal(traceRadius(w),5*w/180);
    const display=canvasDisplaySize(367,437,w,h);
    assert.ok(Math.abs(display.width-255)<1e-9);assert.ok(Math.abs(display.height-425)<1e-9);
    const e=setup(w,h);stroke(e);normalized.push(metrics(e).moved/(w/180)**2);
    for(const rect of [{left:67,top:144,width:255,height:425},{left:10,top:60,width:355,height:591.6667}]) {
      const point=canvasPoint({clientX:rect.left+rect.width*.6,clientY:rect.top+rect.height*.4,timeStamp:800},{getBoundingClientRect:()=>rect},e);
      assert.ok(Math.abs(point.x-w*.6)<1e-9);assert.ok(Math.abs(point.y-h*.4)<1e-9);
    }
  }
  assert.ok(normalized[1]/normalized[0]>.75&&normalized[1]/normalized[0]<1.3);
});
test('flow: resolution compensation keeps every force within 20 percent in screen-space mean distance',()=>{
  for(const strength of ['weak','standard','strong']) {
    const distances=[];
    for(const [w,h]of[[180,300],[270,450]]){const e=setup(w,h);stroke(e,strength);distances.push(metrics(e).mean/(w/180));}
    assert.ok(distances[1]/distances[0]>.8&&distances[1]/distances[0]<1.2);
  }
});
