import test from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './helpers/runtime.mjs';
import {ArtPreview,STUDY_FILES,STUDY_B_FILES,drawStudyPlayer,drawStudyEnemy} from '../js/art-preview.js';
import {WEAPON_BY_ID,SAVE_KEY,DEFAULT_SAVE} from '../js/data.js';
import {classPlayerFrame} from '../js/player.js';

const makePack=()=>({...Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,'B:'+k])),_b:Object.fromEntries(Object.keys(STUDY_B_FILES).map(k=>[k,true])),fallbacks:[]});
const lab=()=>{let r=runtime(structuredClone(DEFAULT_SAVE),{debug:true});r.click('test-lab');r.run("artPreview.bPack={...Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,'B:'+k])),_b:Object.fromEntries(Object.keys(STUDY_B_FILES).map(k=>[k,true])),fallbacks:[]};assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='OLD:'+k)");return r};

test('B loads nine revised resources, reuses four weapons, caches and preserves old style',async()=>{
  const art=new ArtPreview(),seen=[];const loader=async(path,w,h,root)=>{seen.push({path,w,h,root});return {path,w,h,root}};
  assert.equal(await art.select('STUDY_01_B',loader),true);assert.equal(art.style,'STUDY_01_B');assert.equal(Object.keys(art.pack._b).length,9);assert.equal(seen.filter(x=>x.root?.includes('study-01-b')).length,9);
  await art.select('STUDY_01',loader);assert.equal(art.style,'STUDY_01');assert.equal(art.pack._b,undefined);
  const n=seen.length;await art.select('STUDY_01_B',loader);await art.select('ORIGINAL');await art.select('STUDY_01',loader);assert.equal(seen.length,n);
});
test('B missing image falls back per resource to Study 01, then ORIGINAL if both fail',async()=>{
  const art=new ArtPreview();assert.equal(await art.select('STUDY_01_B',async(path,w,h,root)=>{if(root&&path.includes('ranger'))throw Error('missing B');return path}),true);
  assert.equal(art.pack._b.ranger,undefined);assert.equal(art.pack._b.wing,true);assert.equal(art.pack.ranger,'in-game/ranger_body.png');assert.deepEqual(art.pack.fallbacks,['ranger']);
  const broken=new ArtPreview();assert.equal(await broken.select('STUDY_01_B',async path=>{if(path.includes('ranger'))throw Error('missing both');return path}),false);assert.equal(broken.style,'ORIGINAL');assert.match(broken.error,/ORIGINAL/);
});
test('cancelling a pending B load cannot override ORIGINAL or a newer Study 01 request',async()=>{
  const art=new ArtPreview(),gates=[];const pending=art.select('STUDY_01_B',()=>new Promise(resolve=>gates.push(resolve)));
  await art.select('STUDY_01',async()=>({}));gates.forEach(fn=>fn({}));await pending;assert.equal(art.style,'STUDY_01');assert.equal(art.pack._b,undefined);
});
test('B three-style live/paused switches preserve complete game state, terrain and save bytes',async()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("spawnEnemy('crawler',1150);spawnEnemy('needle',1200);game.player.hp=43;game.score=123;const snapshot=JSON.stringify(game),savedObject=JSON.stringify(save)");
  for(const mode of ['lab','play','pause']){
    r.run(`show('${mode}')`);
    for(const style of ['STUDY_01_B','ORIGINAL','STUDY_01_B']){await r.run(`setArtStyle('${style}')`);r.run('draw()');assert.equal(r.run('JSON.stringify(game)'),r.run('snapshot'))}
  }
  assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run('JSON.stringify(save)'),r.run('savedObject'));
});
for(const res of [1,2])for(const zoom of [.35,.50])test(`B ${320*res} / ${zoom}: projection, muzzle, collision and five held weapons`,async()=>{
  const r=lab();r.change('labPreset','RANGER');await r.run("setArtStyle('STUDY_01_B')");r.run(`setPreviewResolution(${res});game.battleCamera.zoom=${zoom};syncCameraView()`);
  for(const id of ['A-01','R-04','H-08','T-06','D-19'])for(const face of [-1,1]){
    r.run(`game.lab.equipped[0]='${id}';game.player.face=${face};game.player.shotCd=game.player.switchCd=0;input.aimMode='touch';input.touchDx=${face};input.touchDy=0;shoot();drawPlayer(game.player)`);
    assert.equal(r.run('game.player.shotCd'),WEAPON_BY_ID.get(id).interval);
    assert.ok(r.drawCalls.some(c=>c[0]==='translate'&&c[1]===r.run(`game.player.x+${face>0?18:-3}`)&&c[2]===r.run('game.player.y+13')));
  }
  assert.deepEqual(r.json('[game.player.w,game.player.h]'),[14,27]);assert.equal(r.get('game').width,320*res);assert.equal(r.run('view.zoom'),zoom);
});
test('representative player poses use existing animation state, death has no floating weapon',()=>{
  const calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]??((...v)=>calls.push([k,...v]))});
  for(const id of ['RANGER','WING'])for(const extra of [{},{vx:95,anim:1},{vx:95,anim:2},{vx:95,anim:3},{onGround:false,vy:-100},{onGround:false,vy:90},{shootPose:.1},{hitPose:.1},{dead:true}]){
    const p={classId:id,face:1,x:300,y:116,onGround:true,vx:0,anim:0,...extra},before=JSON.stringify(p);calls.length=0;
    assert.equal(drawStudyPlayer(ctx,makePack(),p,WEAPON_BY_ID.get('A-01'),'held'),true);assert.equal(JSON.stringify(p),before);
    const draw=calls.find(c=>c[0]==='drawImage'&&c[1]===`B:${id==='RANGER'?'ranger':'wing'}`);assert.equal(draw[2],classPlayerFrame(p)*48);assert.equal(draw[8],24);assert.equal(draw[9],32);
    if(p.dead)assert.equal(calls.filter(c=>c[0]==='drawImage').length,1);
  }
});
test('missing revised player retains original Study pose limits, unsupported actors stay ORIGINAL',()=>{
  const pack=makePack();delete pack._b.ranger;let p={classId:'RANGER',x:0,y:0,onGround:false};assert.equal(drawStudyPlayer({},pack,p,WEAPON_BY_ID.get('A-01')),false);
  for(const classId of ['SCOUT','GUARDIAN'])assert.equal(drawStudyPlayer({},pack,{...p,classId},WEAPON_BY_ID.get('A-01')),false);
  assert.equal(drawStudyEnemy({},pack,{type:'queen'},0,0),false);
});
test('B enemy pose / variant / feet and death trails use drawing only, no sort or mutation',async()=>{
  const r=lab();await r.run("setArtStyle('STUDY_01_B')");r.run("spawnEnemy('crawler',1150);spawnEnemy('needle',1180);spawnEnemy('boss',1240);damageEnemy(game.enemies[0],999,{type:'bullet',vx:100,vy:0});const before=JSON.stringify(game);drawEnemies(game);drawDeathGhost(game.enemies[0],1000,128,0,.5,true)");
  assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='B:crawler'&&c[2]===192));
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='B:boss'));assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='B:needle'));
});
test('B and ORIGINAL run identical actual combat updates including deaths; normal mode always original',async()=>{
  const a=lab(),b=lab();await b.run("setArtStyle('STUDY_01_B')");b.run('setPreviewResolution(2)');
  for(const r of [a,b])r.run("show('play');spawnEnemy('crawler',1120);input.fire=true;input.aimMode='touch';input.touchDx=1;input.touchDy=0;for(let i=0;i<120;i++){update(1/60);draw()}");
  assert.equal(a.run('JSON.stringify(game)'),b.run('JSON.stringify(game)'));
  b.click('lab-exit');b.run('startMission();draw()');assert.equal(b.get('game').dataset.artStyle,'ORIGINAL');assert.equal(b.get('game').width,320);
});

test('B M02 drawing preserves all terrain, nest/barrier/queen data and unsupported tiles',async()=>{
  const r=lab();r.change('labTerrain','M02');r.click('lab-terrain-apply');await r.run("setArtStyle('STUDY_01_B')");
  r.run("game.player.x=3100;game.camera=2800;syncCameraView();const terrainBefore=JSON.stringify(game.platforms),before=JSON.stringify(game);draw()");
  assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.equal(r.run('JSON.stringify(game.platforms)'),r.run('terrainBefore'));
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='B:underTiles'));assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='OLD:undergroundTiles'));
});
test('actual RANGER walking and WING flight/collision/energy updates are identical for B and ORIGINAL',async()=>{
  for(const terrain of ['M01','M02'])for(const id of ['RANGER','WING']){
    const a=lab(),b=lab();for(const r of [a,b]){r.change('labTerrain',terrain);r.click('lab-terrain-apply');r.change('labPreset',id)}await b.run("setArtStyle('STUDY_01_B')");
    for(const r of [a,b])r.run("show('play');input.right=true;input.jump=input.up=true;for(let i=0;i<90;i++){update(1/60);draw()}");
    assert.equal(a.run('JSON.stringify(game)'),b.run('JSON.stringify(game)'),terrain+' '+id);
  }
});
