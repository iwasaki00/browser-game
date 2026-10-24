import test from 'node:test';
import assert from 'node:assert/strict';
import {Camera} from '../js/camera.js';
import {getStage} from '../js/stages.js';
import {addPlanet,placementAllowed} from '../js/planets.js';
import {getChallenge} from '../js/challenges.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('3画面サイズで主要オブジェクトに余白を取り、逆変換は全倍率で一致',()=>{
 for(const [w,h]of[[308,415],[363,514],[378,691]]){
  const s=getStage(),snapshot=structuredClone(s),c=new Camera();c.resize(w,h);c.fit(s);
  for(const p of [s.launch.position,s.goal,...s.planets]){const screen=c.toScreen(p);assert.ok(screen.x>=12&&screen.x<=w-12&&screen.y>=12&&screen.y<=h-12);}
  for(const zoom of [.5,1,2,3]){c.zoomAt(zoom);for(const point of [{x:48,y:430},{x:196,y:282},{x:319,y:105}]){const back=c.toWorld(c.toScreen(point));close(back.x,point.x);close(back.y,point.y);}}
  assert.deepEqual(s,snapshot);
 }
});
test('ピンチの中心を保ち、2本指の平行移動で視点を移す。倍率上限を守る',()=>{
 const c=new Camera();c.resize(375,500);c.fit(getStage());
 c.beginGesture([{x:130,y:200},{x:230,y:200}]);const anchor=c.toWorld({x:180,y:200});
 c.moveGesture([{x:90,y:215},{x:290,y:215}]);close(c.zoom,2);
 const after=c.toScreen(anchor);close(after.x,190);close(after.y,215);
 c.moveGesture([{x:-2000,y:0},{x:2000,y:0}]);assert.equal(c.zoom,3);
 c.zoomAt(.01);assert.equal(c.zoom,.5);c.fit(getStage());assert.equal(c.zoom,1);
 c.endGesture();const old=structuredClone(c.center);c.moveGesture([{x:0,y:0},{x:100,y:100}]);assert.deepEqual(c.center,old);
});
test('追加時の種類・サイズを適用し、ステージ固定条件と配置制約を守る',()=>{
 for(const type of ['asteroid','earth','gas','blackhole','repulsor','star','dense']){
  const s=getStage(),p=addPlanet(s,type,'small');assert.equal(p.type,type);assert.equal(p.size,'small');assert.ok(placementAllowed(p,s));
 }
 const s=getChallenge('stage-20'),before=structuredClone(s);assert.equal(addPlanet(s,'dense','small'),null);assert.deepEqual(s,before);
 assert.equal(addPlanet(getStage(),'invalid','medium'),null);
});
