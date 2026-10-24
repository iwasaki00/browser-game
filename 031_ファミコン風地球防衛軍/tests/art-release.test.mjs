import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY,WEAPONS,PLAYER_CLASSES} from '../js/data.js';
import {UNIFIED_FILES,UNIFIED_ENEMIES} from '../js/art-preview.js';

const seed=()=>({...structuredClone(DEFAULT_SAVE),clearedMissions:['M01'],unlockedMissions:['M01','M02'],unlocked:WEAPONS.map(w=>w.id)});
const loader=(path,w,h,root)=>Promise.resolve(root+path);
const prepare=async(r,load=loader)=>{
  r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='OLD:'+k)");
  r.run('releaseArt.reset()');r.run('releaseArt.uPack=null');
  await r.run('loadReleaseArt')(load);return r;
};
const drawn=(r,key)=>r.drawCalls.some(c=>c[0]==='drawImage'&&String(c[1]).includes('unified-01/'+UNIFIED_FILES[key][0]));

test('normal URL preloads release art without creating LAB controls or profilers',async()=>{
  const r=runtime();assert.equal(r.run('DEBUG'),false);assert.equal(r.run('releaseArt.loading'),true);assert.equal(r.run('releaseArt.requested'),'UNIFIED_01');assert.equal(r.run('artPreview'),null);
  const before=r.storage.get(SAVE_KEY);await prepare(r);r.run('draw()');
  assert.equal(r.get('game').dataset.artStyle,'UNIFIED_01');assert.deepEqual([r.get('game').width,r.get('game').height],[320,180]);assert.equal(r.run('profiler'),null);assert.equal(r.run('liveProfiler'),null);
  assert.notEqual(r.get('testLabButton').hidden,false);assert.equal(r.storage.get(SAVE_KEY),before);assert.ok(drawn(r,'city'));
  r.click('test-lab');assert.equal(r.run('game'),null);assert.equal(await r.run("setArtStyle('ORIGINAL')"),false);assert.equal(r.run('setPreviewResolution(2)'),false);
});

test('pending normal art keeps original images until the whole validated pack commits, without resetting gameplay',async()=>{
  const r=runtime(seed());r.run("assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='OLD:'+k);startMission();game.player.hp=47;game.score=123;game.time=9");
  const gates=[];const before=r.run('JSON.stringify(game)'),save=r.storage.get(SAVE_KEY);
  const pending=r.run('loadReleaseArt')((...args)=>new Promise(resolve=>gates.push(()=>resolve(args[3]+args[0]))));
  assert.equal(gates.length,41);r.run('draw()');assert.equal(r.get('game').dataset.artStyle,'ORIGINAL');assert.ok(r.drawCalls.some(c=>c[1]==='OLD:classes'));
  gates.slice(0,-1).forEach(f=>f());await Promise.resolve();assert.equal(r.run('releaseArt.pack'),null);
  gates.at(-1)();await pending;r.run('draw()');assert.equal(r.get('game').dataset.artStyle,'UNIFIED_01');assert.equal(r.run('JSON.stringify(game)'),before);assert.equal(r.storage.get(SAVE_KEY),save);
});

for(const mission of ['M01','M02'])test(`${mission}: normal 320 rendering uses unified world, all four classes, both bosses/nests and 20 real weapons`,async()=>{
  const r=await prepare(runtime(seed()));r.run(`startMission('${mission}')`);const save=r.storage.get(SAVE_KEY);
  for(const id of Object.keys(PLAYER_CLASSES)){
    r.run(`applyPlayerClass(game.player,'${id}');game.battleCamera.zoom=.5;syncCameraView()`);r.drawCalls.length=0;r.run('draw()');assert.ok(drawn(r,id.toLowerCase()),id);
    assert.deepEqual(r.json('[game.player.w,game.player.h]'),[14,27]);
    for(const w of WEAPONS){
      r.run(`save.equipped[0]='${w.id}';game.player.weaponSlot=0;game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()`);
      assert.equal(r.run('game.player.shotCd'),w.interval,`${id}/${w.id}`);
      r.drawCalls.length=0;r.run('draw()');assert.ok(drawn(r,'held'));assert.ok(drawn(r,'icons'));
      r.run('game.shots.length=0;clearArsenal(game)');
    }
  }
  for(const type of Object.keys(UNIFIED_ENEMIES)){
    r.run(`game.enemies=[];game.liveEnemies=game.liveMobs=0;game.bossStarted=false;spawnEnemy('${type}',game.player.x+100,40);`);r.drawCalls.length=0;r.run('draw()');assert.ok(drawn(r,type),type);
  }
  r.drawCalls.length=0;r.run('draw()');assert.ok(drawn(r,mission==='M01'?'city':'underground'));assert.ok(drawn(r,mission==='M01'?'cityTiles':'underTiles'));
  assert.equal(r.get('game').dataset.artStyle,'UNIFIED_01');assert.equal(r.get('game').width,320);assert.equal(r.run('ctx.imageSmoothingEnabled'),false);assert.equal(r.storage.get(SAVE_KEY),save);
});

test('normal art renders death/hit/environmental FX and keeps world, muzzle and queen weak core coordinates',async()=>{
  const r=await prepare(runtime(seed()));r.run("startMission('M02');game.battleCamera.zoom=.5;syncCameraView();game.enemies=[];game.liveEnemies=0;const queen=spawnEnemy('queen',game.player.x+100,40);queen.timer=.5;queen.face=-1;const core=JSON.stringify(weakCore(queen));pushEffect({kind:'bossBreak',x:game.player.x+90,y:60,life:.2,max:1});pushEffect({kind:'nestBreak',x:game.player.x+80,y:90,life:.2,max:1});pushEffect({kind:'hit',artWeaponId:'R-04',x:game.player.x,y:90,life:.1,max:.2});");
  const before=r.run('JSON.stringify(game)');r.drawCalls.length=0;r.run('draw()');for(const key of ['queen','bossBreak','nestBreak','fx'])assert.ok(drawn(r,key),key);
  assert.equal(r.run('JSON.stringify(game)'),before);assert.equal(r.run('JSON.stringify(weakCore(queen))'),r.run('core'));
  r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()");assert.deepEqual(r.json('[game.shots[0].originX,game.shots[0].originY]'),r.json('[game.player.x+18,game.player.y+13]'));
});

test('release loading failures descend per asset and total failure always draws original, never null',async()=>{
  const a=await prepare(runtime(seed()),async(path,w,h,root)=>{if(root?.includes('unified-01')&&['sprites/ranger.png','weapons/icons.png'].includes(path))throw Error('404');return root+path});
  assert.equal(a.run('releaseArt.pack._b.ranger'),true);assert.ok(a.run("releaseArt.pack.fallbacks.includes('icons')"));a.run('startMission();draw()');assert.ok(a.drawCalls.some(c=>c[0]==='drawImage'&&String(c[1]).includes('study-01-b/sprites/ranger.png')));
  const b=await prepare(runtime(seed()),async()=>{throw Error('offline')});b.run('startMission();draw()');assert.ok(b.drawCalls.some(c=>c[1]==='OLD:classes'));assert.ok(b.drawCalls.some(c=>c[1]==='OLD:tiles'));assert.equal(b.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==null),false);
  assert.equal(b.get('game').width,320);assert.equal(b.run('state'),'play');
});

test('LAB ORIGINAL and 640 are independent of release art, across pending loads and exits',async()=>{
  const r=await prepare(runtime(seed(),{debug:true})),saved=r.storage.get(SAVE_KEY);r.click('test-lab');assert.equal(r.run('artPreview.style'),'ORIGINAL');r.run('draw()');assert.equal(r.get('game').dataset.artStyle,'ORIGINAL');
  r.run('artPreview.uPack=releaseArt.uPack');await r.run("setArtStyle('UNIFIED_01')");r.run('setPreviewResolution(2);draw()');assert.equal(r.get('game').width,640);
  const before=r.run('JSON.stringify(game)');await r.run("setArtStyle('ORIGINAL')");r.run('draw()');assert.equal(r.get('game').dataset.artStyle,'ORIGINAL');assert.equal(r.run('JSON.stringify(game)'),before);
  const gates=[];const pending=r.run('artPreview.select.bind(artPreview)')('STUDY_01',()=>new Promise(resolve=>gates.push(resolve)));
  r.click('lab-exit');r.run("startMission('M02');draw()");gates.forEach(f=>f('STUDY'));await pending;r.run('draw()');
  assert.equal(r.get('game').dataset.artStyle,'UNIFIED_01');assert.equal(r.get('game').width,320);assert.equal(r.run('releaseArt.requested'),'UNIFIED_01');assert.equal(r.storage.get(SAVE_KEY),saved);
  r.click('test-lab');assert.equal(r.run('artPreview.style'),'ORIGINAL');assert.equal(r.run('previewRenderScale'),1);
});

test('release and ORIGINAL run identical real simulation for both missions, with no save/progression changes from rendering',async()=>{
  for(const mission of ['M01','M02']){
    const a=await prepare(runtime(seed())),b=await prepare(runtime(seed()));await a.run("releaseArt.select('ORIGINAL')");
    for(const r of [a,b])r.run(`startMission('${mission}');input.right=true;input.fire=true;input.aimMode='touch';input.touchDx=1;input.touchDy=0`);
    for(let i=0;i<120;i++)for(const r of [a,b])r.run('update(1/60);draw()');
    assert.deepEqual(b.json('game'),a.json('game'));assert.equal(b.storage.get(SAVE_KEY),a.storage.get(SAVE_KEY));
  }
});

test('v1 save unlocks and selected class survive release loading and equipment thumbnails use unified atlases',async()=>{
  const old={version:1,cleared:['M01'],unlocked:['A-01','S-02','L-03','R-04'],equipped:['L-03','R-04'],highScore:4321,bestTime:88,selectedClass:'GUARDIAN',settings:{sound:false}};
  const r=runtime(old),before=r.storage.get(SAVE_KEY);await prepare(r);r.run("show('equip');renderWeaponGrid()");assert.equal(r.storage.get(SAVE_KEY),before);
  assert.equal(r.run('save.selectedClass'),'GUARDIAN');assert.equal(r.run("save.unlockedMissions.includes('M02')"),true);assert.deepEqual(r.json('save.equipped'),old.equipped);assert.equal(r.run('save.highScore'),4321);
  assert.equal(r.get('classGrid').children.filter(b=>b.children.length).length,4);assert.equal(r.get('weaponGrid').children.filter(b=>b.children.length).length,20);
  for(const id of ['ranger','scout','guardian','wing','icons'])assert.ok(drawn(r,id),id);
});
