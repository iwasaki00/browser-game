import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {ArtPreview,STUDY_FILES,ART_ANCHORS,loadStudyImage,drawStudyPlayer,drawStudyEnemy,drawStudyIcon,drawStudyProjectile,drawStudyTile,drawStudyEffect,drawStudyLightning} from '../js/art-preview.js';
import {DEFAULT_SAVE,SAVE_KEY,WEAPON_BY_ID,WEAPONS} from '../js/data.js';
import {weakCore} from '../js/mission02.js';

const pack=()=>Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,`study:${k}`]));
const calls=()=>{const out=[];return {out,ctx:new Proxy({},{get:(o,k)=>o[k]??((...args)=>out.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)})}};
const lab=()=>{const r=runtime(structuredClone(DEFAULT_SAVE),{debug:true});r.click('test-lab');r.run("artPreview.pack=Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,'study:'+k]));assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='original:'+k)");r.drawCalls.length=0;return r};

test('ORIGINAL is default, lazy, and cached Study commits only the complete pack',async()=>{
  const art=new ArtPreview();let count=0;assert.equal(art.style,'ORIGINAL');assert.equal(art.pack,null);
  await art.select('ORIGINAL',()=>{throw Error('must not load')});
  const gates=[];const promise=art.select('STUDY_01',(...args)=>{count++;return new Promise(resolve=>gates.push(()=>resolve({src:args[0]})))});
  assert.equal(art.style,'ORIGINAL');assert.equal(art.loading,true);gates[0]();await Promise.resolve();assert.equal(art.pack,null);
  gates.slice(1).forEach(fn=>fn());assert.equal(await promise,true);assert.equal(Object.keys(art.pack).length,13);assert.equal(art.style,'STUDY_01');
  await art.select('ORIGINAL');await art.select('STUDY_01',()=>{throw Error('must use cache')});assert.equal(count,13);
});

test('rapid ORIGINAL cancellation and reset cannot be overwritten by stale loading',async()=>{
  for(const reset of [false,true]){const art=new ArtPreview(),gates=[];const promise=art.select('STUDY_01',()=>new Promise(resolve=>gates.push(resolve)));
    if(reset)art.reset();else await art.select('ORIGINAL');gates.forEach(fn=>fn({}));assert.equal(await promise,false);assert.equal(art.style,'ORIGINAL');assert.equal(art.loading,false)}
});

test('one failed image rejects the entire pack and returns ORIGINAL',async()=>{
  const art=new ArtPreview();assert.equal(await art.select('STUDY_01',async path=>{if(path.includes('wing'))throw Error('missing');return {path}}),false);
  assert.equal(art.style,'ORIGINAL');assert.equal(art.pack,null);assert.match(art.error,/ORIGINAL/);
});

test('real loader validates dimensions and handles image errors',async()=>{
  const previous=globalThis.Image;let mode='ok';
  globalThis.Image=class{set src(value){this.naturalWidth=mode==='wrong'?1:96;this.naturalHeight=64;queueMicrotask(()=>mode==='error'?this.onerror():this.onload())}};
  try{await loadStudyImage('in-game/ranger_body.png',96,64);mode='wrong';await assert.rejects(loadStudyImage('x',96,64),/サイズ/);mode='error';await assert.rejects(loadStudyImage('x',96,64),/読み込めません/)}finally{globalThis.Image=previous}
});

test('live and paused swaps preserve every gameplay field, score, progression and save bytes',async()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("spawnEnemy('crawler',1400);shoot();game.player.hp=41;game.score=123;game.time=12;const before=JSON.stringify(game)");
  for(const playing of [false,true]){
    if(playing)r.click('lab-close');
    assert.equal(await r.run("setArtStyle('STUDY_01')"),true);assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
    assert.equal(r.run('setPreviewResolution(2)'),true);r.run('draw()');assert.equal(r.get('game').width,640);assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
    await r.run("setArtStyle('ORIGINAL')");r.run('setPreviewResolution(1);draw()');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
  }
  assert.equal(r.storage.get(SAVE_KEY),saved);
});

test('pause comparison freezes updates/inputs; pause selectors swap without resuming',async()=>{
  const r=lab();r.click('art-compare');assert.equal(r.run('state'),'pause');assert.equal(r.run('artComparison'),true);
  r.run('const before=JSON.stringify(game)');r.key('keydown','d');r.pointer('aimPad','pointerdown');r.run('update(5)');assert.equal(r.run('input.right||input.fire'),false);
  r.change('pauseArtStyle','STUDY_01');await Promise.resolve();r.change('pauseRenderScale','2');r.run('draw()');assert.equal(r.get('game').dataset.artStyle,'STUDY_01');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
  r.key('keydown','Escape');assert.equal(r.run('state'),'lab');assert.equal(r.run('artComparison'),false);
});

test('unsupported states, classes, mobs, weapons and effects keep original fallbacks',()=>{
  const {ctx}=calls(),p={x:10,y:116,classId:'RANGER',face:1,vx:0,onGround:true};
  for(const extra of [{classId:'SCOUT'},{classId:'GUARDIAN'},{hitPose:.1},{dead:true},{onGround:false},{classId:'WING',onGround:true},{classId:'WING',onGround:false,flightLocked:true}])assert.equal(drawStudyPlayer(ctx,pack(),{...p,...extra},WEAPON_BY_ID.get('A-01'),'held'),false);
  for(const type of ['spider','beetle','worm','spitter','nest','queen','barrier'])assert.equal(drawStudyEnemy(ctx,pack(),{type},0,0),false);
  for(const fn of [drawStudyIcon,drawStudyProjectile])assert.equal(fn(ctx,pack(),'P-13',0,0,16,16),false);
  assert.equal(drawStudyEffect(ctx,pack(),'G-07',.5,0,0),false);assert.equal(drawStudyLightning(ctx,pack(),{assetIndex:15}),false);
});

for(const id of ['RANGER','WING'])test(`${id}: temporary pose and held muzzle anchors are rendering-only in both directions`,()=>{
  for(const face of [1,-1])for(const weaponId of ['A-01','R-04','H-08','T-06','D-19']){
    const p={x:300,y:60,classId:id,face,vx:0,vy:id==='WING'?-10:0,onGround:id==='RANGER'},before=JSON.stringify(p),{ctx,out}=calls();
    assert.equal(drawStudyPlayer(ctx,pack(),p,WEAPON_BY_ID.get(weaponId),'oldHeld'),true);assert.equal(JSON.stringify(p),before);
    assert.ok(out.some(c=>c[0]==='translate'&&c[1]===300+(face>0?18:-3)&&c[2]===73));
    const held=out.find(c=>c[0]==='drawImage'&&c[1]==='study:held');assert.equal(held[6],-ART_ANCHORS.held[weaponId][0]/2);assert.equal(held[7],-ART_ANCHORS.held[weaponId][1]/2);
  }
});

test('ground feet, flight body center and boss feet align with existing world hitboxes',()=>{
  const {ctx,out}=calls(),p=pack();
  drawStudyEnemy(ctx,p,{type:'crawler',h:20,anim:0},500,128);let c=out.at(-1);assert.equal(c[7]+31,148);
  drawStudyEnemy(ctx,p,{type:'needle',h:16,anim:0},500,40);c=out.at(-1);assert.equal(c[7]+17,48);
  drawStudyEnemy(ctx,p,{type:'boss',h:58},500,90);c=out.at(-1);assert.equal(c[7]+63.5,148);
  const queen={type:'queen',x:5280,y:52,timer:0,phase:'move'};assert.deepEqual(weakCore(queen),{x:5284,y:112,r:19,open:true});
});

for(const resolution of [1,2])for(const zoom of [.35,.5,.85])test(`${320*resolution} resolution / ${zoom}: logical aim, camera, HUD and collisions unchanged`,async()=>{
  const r=lab();r.change('labPreset','RANGER');r.click('lab-close');await r.run("setArtStyle('STUDY_01')");
  r.run(`setPreviewResolution(${resolution});game.battleCamera.zoom=${zoom};game.battleCamera.x=300;syncCameraView();const beforeCamera=JSON.stringify(game.battleCamera);
    const muzzle={x:game.player.x+18,y:game.player.y+13};const aim=worldToScreen({x:muzzle.x+100,y:muzzle.y},game.camera,view.zoom);input.aimMode='mouse';input.aimX=aim.x;input.aimY=aim.y;shoot();draw()`);
  assert.equal(r.get('game').width,320*resolution);assert.equal(r.get('game').height,180*resolution);
  assert.ok(Math.abs(r.run('game.shots.at(-1).vy'))<1e-8);assert.ok(Math.abs(r.run('game.shots.at(-1).vx')-310)<1e-8);assert.equal(r.run('JSON.stringify(game.battleCamera)'),r.run('beforeCamera'));
  assert.deepEqual(r.json('clientToScreen({x:160,y:90},{left:0,top:0,width:320,height:180})'),{x:160,y:90});
  assert.deepEqual(r.json('[game.player.w,game.player.h]'),[14,27]);assert.ok(r.drawCalls.some(c=>c[0]==='setTransform'&&c[1]===resolution&&c[4]===resolution));
  assert.ok(r.drawCalls.some(c=>c[0]==='fillText'&&c[1]==='HP 100'&&c[2]===9&&c[3]===15));assert.equal(r.run('ctx.imageSmoothingEnabled'),false);
});

test('all 20 weapon data and identical simulations survive render-only swapping',async()=>{
  const a=lab(),b=lab(),before=JSON.stringify(WEAPONS);await b.run("setArtStyle('STUDY_01')");b.run('setPreviewResolution(2)');
  for(const r of [a,b])r.run("show('play');input.fire=true;input.aimMode='touch';input.touchDx=1;input.touchDy=0;spawnEnemy('crawler',1150);for(let n=0;n<90;n++){update(1/60);draw()}");
  assert.equal(a.run('JSON.stringify(game)'),b.run('JSON.stringify(game)'));assert.equal(JSON.stringify(WEAPONS),before);
});

test('stage restart retains preview; normal starts use 320 with ORIGINAL while release images are pending',async()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);await r.run("setArtStyle('STUDY_01')");r.run('setPreviewResolution(2)');r.click('lab-stage-start');assert.equal(r.get('game').width,640);assert.equal(r.get('game').dataset.artStyle,'STUDY_01');
  r.click('lab-open');r.click('lab-exit');assert.equal(r.get('game').width,320);assert.equal(r.get('game').dataset.artStyle,'ORIGINAL');assert.equal(r.storage.get(SAVE_KEY),saved);
  r.run('startMission()');assert.equal(await r.run("setArtStyle('STUDY_01')"),false);assert.equal(r.run('setPreviewResolution(2)'),false);assert.equal(r.get('game').width,320);
  r.click('test-lab');assert.equal(r.run('artPreview.style'),'ORIGINAL');
});

test('render adapter does not mutate terrain, entities, jobs or effects; missing terrain stays original',async()=>{
  const r=lab();r.change('labTerrain','M02');r.click('lab-terrain-apply');r.run("spawnEnemy('crawler',1100);spawnEnemy('needle',1150);spawnEnemy('spider',1200);game.player.y=70;game.player.onGround=false;const before=JSON.stringify(game)");
  await r.run("setArtStyle('STUDY_01')");r.run('draw()');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:underTiles'));assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='original:undergroundTiles'));
  const {ctx}=calls();assert.equal(drawStudyTile(ctx,pack(),'M02',8,0,0),false);
});

test('normal non-debug startup cannot use preview controls',async()=>{const r=runtime();assert.equal(r.run('artPreview'),null);r.run('startMission()');assert.equal(await r.run("setArtStyle('STUDY_01')"),false);assert.equal(r.get('pauseArtControls').hidden,true)});

for(const id of ['A-01','R-04','H-08','T-06','D-19'])test(`${id}: real firing keeps weapon data and uses supported Study rendering`,async()=>{
  const r=lab();r.change('labPreset','RANGER');r.change('labWeapon1',id);await r.run("setArtStyle('STUDY_01')");r.click('lab-close');
  r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()");r.drawCalls.length=0;r.run('draw()');
  assert.equal(r.run('game.player.shotCd'),WEAPON_BY_ID.get(id).interval);
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:held'));
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:icons'));
  if(id==='D-19')assert.equal(r.run('game.arsenal.installations.length'),1);
  else assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:shots'));
});

test('hit, lightning and rocket FX switch textures without changing damage or death animations',async()=>{
  const a=lab(),b=lab();await b.run("setArtStyle('STUDY_01')");
  for(const r of [a,b])r.run("spawnEnemy('crawler',1100);game.grid.rebuild(game.enemies);explode({x:1100,y:138,type:'rocket',damage:45,radius:64,weapon:weapon('R-04')});pushEffect({x:1090,y:135,kind:'hit',type:'bullet',life:.1,max:.1});pushEffect({x:1090,y:130,x2:1150,y2:120,kind:'lightning',life:.1,max:.1});draw()");
  assert.equal(a.run('JSON.stringify(game)'),b.run('JSON.stringify(game)'));
  assert.ok(b.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:fx'));
  assert.ok(b.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='study:shots'));
  assert.ok(b.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='original:enemies'&&c[2]===144));
  b.run("game.player.hitPose=.1;drawPlayer(game.player)");assert.ok(b.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='original:classes'));
});
