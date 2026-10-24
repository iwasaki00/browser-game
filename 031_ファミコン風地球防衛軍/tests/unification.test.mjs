import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {ArtPreview,ART_STYLES,UNIFIED_FILES,UNIFIED_ENEMIES,STUDY_FILES,drawStudyPlayer,drawStudyEnemy,drawStudyIcon,drawStudyProjectile,drawStudyEffect,drawUnifiedSpecial,drawUnifiedTile} from '../js/art-preview.js';
import {WEAPONS,ENEMY_TYPES,DEFAULT_SAVE,SAVE_KEY} from '../js/data.js';
import {classPlayerFrame} from '../js/player.js';
import {weakCore} from '../js/mission02.js';

const manifest=JSON.parse(readFileSync(new URL('../assets/art-refresh/unified-01/manifest.json',import.meta.url),'utf8'));
const pack=()=>({...Object.fromEntries(Object.keys(UNIFIED_FILES).map(k=>[k,'U:'+k])),_u:Object.fromEntries(Object.keys(UNIFIED_FILES).map(k=>[k,true])),_b:{},_far:false,fallbacks:[]});
const calls=()=>{const out=[];return {out,ctx:new Proxy({},{get:(o,k)=>o[k]??((...v)=>out.push([k,...v])),set:(o,k,v)=>(o[k]=v,true)})}};
const lab=()=>{const r=runtime(structuredClone(DEFAULT_SAVE),{debug:true});r.click('test-lab');r.run(`artPreview.uPack=${JSON.stringify(pack())};assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='OLD:'+k)`);return r};

test('all 41 runtime atlases have matching generated dimensions and no duplicated IDs',()=>{
  assert.equal(ART_STYLES.length,4);assert.equal(Object.keys(UNIFIED_FILES).length,41);
  for(const [key,[path,w,h]] of Object.entries(UNIFIED_FILES)){
    assert.deepEqual(manifest.assets[path].size,[w,h],key);
    assert.equal(new Set(manifest.assets[path].frameIds).size,manifest.assets[path].frames,path);
  }
  assert.equal(manifest.weapons.length,20);assert.deepEqual(manifest.weapons.map(w=>w.id),WEAPONS.map(w=>w.id));
});
test('UNIFIED lazy atomic load caches 41 resources, cancellation and ORIGINAL remain safe',async()=>{
  const a=new ArtPreview(),gates=[];const promise=a.select('UNIFIED_01',(...v)=>new Promise(resolve=>gates.push(()=>resolve(v))));
  assert.equal(a.pack,null);assert.equal(a.style,'ORIGINAL');assert.equal(gates.length,41);gates.slice(0,-1).forEach(f=>f());await Promise.resolve();assert.equal(a.pack,null);
  gates.at(-1)();assert.equal(await promise,true);assert.equal(Object.keys(a.pack._u).length,41);
  await a.select('ORIGINAL');await a.select('UNIFIED_01',()=>{throw Error('cached')});assert.equal(a.style,'UNIFIED_01');
  const b=new ArtPreview(),q=[];const pending=b.select('UNIFIED_01',()=>new Promise(resolve=>q.push(resolve)));b.reset();q.forEach(f=>f({}));assert.equal(await pending,false);assert.equal(b.style,'ORIGINAL');
});
test('per-resource missing U descends B, Study, ORIGINAL; missing far uses close sprite',async()=>{
  const a=new ArtPreview();await a.select('UNIFIED_01',async(path,w,h,root)=>{if(root?.includes('unified'))throw Error('U missing');return root?.includes('01-b')?'B:'+path:'S:'+path});
  assert.equal(a.pack._u.ranger,undefined);assert.equal(a.pack._b.ranger,true);assert.match(a.pack.ranger,/B:/);assert.match(a.pack.icons,/S:/);assert.equal(a.pack.scout,null);
  const b=new ArtPreview();await b.select('UNIFIED_01',async()=>{throw Error('all missing')});
  const {ctx}=calls();for(const id of ['RANGER','SCOUT','GUARDIAN','WING'])assert.equal(drawStudyPlayer(ctx,b.pack,{classId:id},WEAPONS[0]),false);
  const c=new ArtPreview();await c.select('UNIFIED_01',async(path,w,h,root)=>{if(path.startsWith('far/'))throw Error('far missing');return path});c.prepare(.35);
  const recorded=calls();drawStudyPlayer(recorded.ctx,c.pack,{classId:'SCOUT',x:100,y:116,face:1,onGround:true,vx:0,anim:0},WEAPONS[0],'old');
  assert.equal(recorded.out.find(x=>x[0]==='drawImage')[1],'sprites/scout.png');
  const d=new ArtPreview();await d.select('UNIFIED_01',async(path,w,h,root)=>{if(root?.includes('unified')&&path==='sprites/ranger.png')throw Error('near missing');return root+path});d.prepare(.35);
  const fallback=calls();drawStudyPlayer(fallback.ctx,d.pack,{classId:'RANGER',x:100,y:116,face:1,onGround:true,vx:0,anim:0},WEAPONS[0],'old');
  assert.equal(fallback.out.find(x=>x[0]==='drawImage')[1],d.pack.ranger,'B fallback must not borrow a U far sheet');
});
test('all four classes use existing 12-frame lookup and both weapon-facing anchors',()=>{
  for(const classId of ['RANGER','SCOUT','GUARDIAN','WING'])for(const frame of [0,1,2,3,4,5,6,7,8,9,10,11])for(const face of [-1,1]){
    const p={classId,x:300,y:80,face,onGround:true,vx:0,anim:0};
    if(frame>=1&&frame<=3){p.vx=95;p.anim=frame}
    if(frame===4||frame===5){p.onGround=false;p.vy=frame===4?-100:100}
    if(frame===6)p.shootPose=.1;if(frame===7)p.hitPose=.1;if(frame===8)p.dead=true;if(frame===9)p.dashTime=.1;
    if(frame===10||frame===11){p.onGround=false;p.vy=frame===10?-100:0}
    for(const w of WEAPONS){const {ctx,out}=calls(),before=JSON.stringify(p);assert.equal(drawStudyPlayer(ctx,pack(),p,w,'OLD'),true);assert.equal(JSON.stringify(p),before);
      const body=out.find(c=>c[0]==='drawImage');assert.equal(body[2],classPlayerFrame(p)*48);assert.deepEqual(body.slice(8),[24,32]);
      if(!p.dead){assert.ok(out.some(c=>c[0]==='translate'&&c[1]===p.x+(face>0?18:-3)&&c[2]===p.y+13));const held=out.find(c=>c[1]==='U:held');assert.equal(held[2],w.assetIndex*32);assert.deepEqual(held.slice(6),[-15,-7,16,16])}
    }
  }
});
test('six mobs, both bosses, nest and barrier have real animation/death/hit paths',()=>{
  for(const [type,[w,h]] of Object.entries(UNIFIED_ENEMIES))for(const state of ['move','attack','hit','dead']){
    const e={...ENEMY_TYPES[type],type,x:500,y:40,face:1,anim:1,uid:2,timer:3,hp:50,maxHp:100,attackFlash:state==='attack'?.1:0,hitFlash:state==='hit'?.1:0,dead:state==='dead'};
    const {ctx,out}=calls(),before=JSON.stringify(e);assert.equal(drawStudyEnemy(ctx,pack(),e,e.x,e.y),true);assert.equal(JSON.stringify(e),before);
    const draw=out.find(c=>c[0]==='drawImage');assert.deepEqual(draw.slice(8),[w,h]);assert.equal(draw[2],(state==='dead'?3:state==='hit'?4:state==='attack'?2:type==='barrier'?0:1)*w*2);
    if(type==='queen')assert.equal(out.some(c=>c[0]==='scale'),false);
  }
});
test('B02 open core renders precisely on existing +4/+60 weak-point without mirroring',()=>{
  for(const face of [-1,1]){
    const e={...ENEMY_TYPES.queen,type:'queen',x:800,y:40,face,anim:0,timer:.5};const {ctx,out}=calls();drawStudyEnemy(ctx,pack(),e,e.x,e.y);
    const draw=out.find(c=>c[0]==='drawImage');assert.equal(draw[2],5*240);assert.equal(draw[6]+128/2,weakCore(e).x);assert.equal(draw[7]+120/2,weakCore(e).y);
  }
});
test('20 icons, projectiles, hit effects, special effects share the actual weapon registry',()=>{
  for(const w of WEAPONS){const {ctx,out}=calls();assert.ok(drawStudyIcon(ctx,pack(),w.id,0,0,32,32));assert.ok(drawStudyProjectile(ctx,pack(),w.id,0,0));assert.ok(drawStudyEffect(ctx,pack(),w.id,.5,10,20));assert.ok(drawUnifiedSpecial(ctx,pack(),w.id,.5,10,20));
    assert.equal(out[0][2],w.assetIndex*32);assert.equal(out[1][2],w.assetIndex*32);assert.equal(out[2][3],w.assetIndex*64);assert.equal(out[3][3],w.assetIndex*64);
  }
});
test('far-detail has stable hysteresis and unchanged source cell / world envelope',()=>{
  const a=new ArtPreview();a.pack=pack();for(const [z,far] of [[.5,false],[.39,true],[.41,true],[.43,true],[.44,false],[.42,false],[.35,true]]){a.prepare(z);assert.equal(a.pack._far,far)}
  const {ctx,out}=calls();drawStudyPlayer(ctx,a.pack,{classId:'RANGER',x:30,y:116,onGround:true,face:1,vx:0,anim:0},WEAPONS[0]);assert.equal(out[0][0],'save');assert.equal(out.find(c=>c[0]==='drawImage')[1],'U:rangerFar');
});
test('total preview image failure uses ORIGINAL for bosses, lightning, ground and actors',async()=>{
  const r=lab();r.run("artPreview.uPack={...Object.fromEntries(Object.keys(UNIFIED_FILES).map(k=>[k,null])),_u:{},_b:{},fallbacks:Object.keys(UNIFIED_FILES)};spawnEnemy('boss',1200);game.effects.push({kind:'lightning',x:1000,y:100,x2:1200,y2:100,life:.1,max:.2});");
  await r.run("setArtStyle('UNIFIED_01')");r.run('draw()');
  assert.ok(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]==='OLD:boss'));
  assert.equal(r.drawCalls.some(c=>c[0]==='drawImage'&&c[1]===null),false);
});
for(const mission of ['M01','M02'])test(`${mission}: live / paused four-style swap, all terrain/state/save bytes unchanged`,async()=>{
  const r=lab();r.run(`startLab(true,'${mission}');spawnEnemy('crawler',1300);game.player.hp=41;game.score=321;const snapshot=JSON.stringify(game),saved=JSON.stringify(save)`);
  r.run("artPreview.basePack=Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,'S:'+k]));artPreview.bPack={...artPreview.basePack,_b:{}}");
  for(const state of ['lab','play','pause'])for(const style of ART_STYLES){r.run(`show('${state}')`);await r.run(`setArtStyle('${style}')`);r.run('draw()');assert.equal(r.run('JSON.stringify(game)'),r.run('snapshot'));assert.equal(r.run('JSON.stringify(save)'),r.run('saved'))}
  assert.equal(r.storage.get(SAVE_KEY),JSON.stringify(DEFAULT_SAVE));
});
for(const scale of [1,2])for(const zoom of [.35,.5,.85])test(`${scale*320}/${zoom}: U draw keeps camera, HUD and aim coordinates`,async()=>{
  const r=lab();await r.run("setArtStyle('UNIFIED_01')");r.run(`setPreviewResolution(${scale});game.battleCamera.zoom=${zoom};syncCameraView();const snapshot=JSON.stringify(game);draw()`);
  assert.equal(r.run('JSON.stringify(game)'),r.run('snapshot'));assert.equal(r.get('game').width,scale*320);assert.equal(r.run('view.zoom'),zoom);assert.equal(r.run('ctx.imageSmoothingEnabled'),false);
  for(const w of WEAPONS)r.run(`game.lab.equipped[0]='${w.id}';game.player.shotCd=0;input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()`);
  assert.ok(r.run('game.shots.every(s=>Number.isFinite(s.x+s.y))'));r.run('game.areaTimer=0;drawHud(game)');assert.equal(r.run('ctx.font'),'7px monospace');
});
test('U ORIGINAL simulations remain identical: four classes, 200 mobs, deaths, shots and terrain',async()=>{
  for(const id of ['RANGER','SCOUT','GUARDIAN','WING']){
    const a=lab(),b=lab();for(const r of [a,b])r.run(`changeLabSetting({id:'labPreset',value:'${id}'});changeLabSetting({id:'labCount',value:'200'});spawnLabEnemies();game.lab.equipped[0]='R-04';input.right=true;input.fire=true;input.aimMode='touch';input.touchDx=1;input.touchDy=0`);
    await b.run("setArtStyle('UNIFIED_01')");
    for(let i=0;i<120;i++){a.run('update(1/60);draw()');b.run('update(1/60);draw()')}
    assert.deepEqual(b.json('game'),a.json('game'));assert.equal(b.storage.get(SAVE_KEY),a.storage.get(SAVE_KEY));
  }
});
test('all underground tile types keep exact crop/destination at partial edges',()=>{
  for(let tile=0;tile<16;tile++){const {ctx,out}=calls();assert.ok(drawUnifiedTile(ctx,pack(),'M02',tile,123,28,7,8));assert.deepEqual(out[0].slice(4),[14,16,123,28,7,8])}
});
