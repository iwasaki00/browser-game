import test from "node:test";
import assert from "node:assert/strict";
import {VIEW,WORLD,BATTLE_CAMERA} from "../js/data.js";
import {worldToScreen,screenToWorld,clientToScreen,followCamera,viewBounds,aimTarget,createBattleCamera,evaluateBattleCamera,updateBattleCamera,damp} from "../js/camera.js";

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test("world/screen conversion round trips at both camera edges",()=>{
  for(const zoom of [.35,.5,.85])for(const player of [8,900,4775]){
    const camera=followCamera(player,zoom),bounds=viewBounds(camera,zoom);
    assert.ok(bounds.left>=0);assert.ok(bounds.right<=WORLD.width+1e-8);
    for(const point of [{x:player,y:116},{x:player+80,y:64},{x:player-30,y:148}]){
      const inverse=screenToWorld(worldToScreen(point,camera,zoom),camera,zoom);
      close(inverse.x,point.x);close(inverse.y,point.y);
    }
    close(worldToScreen({x:player,y:WORLD.ground},camera,zoom).y,WORLD.ground);
  }
  close(worldToScreen({x:900,y:116},followCamera(900,.5),.5).x,VIEW.canvasWidth/2-BATTLE_CAMERA.lookAhead);
});

test("mouse target matches displayed world point at CSS sizes and touch aim stays relative",()=>{
  const rect={left:12,top:40,width:640,height:360},camera=400,target={x:700,y:80};
  for(const zoom of [.35,.5,.85]){
  const screen=worldToScreen(target,camera,zoom),client={x:rect.left+screen.x*2,y:rect.top+screen.y*2};
  const mouse=clientToScreen(client,rect),result=aimTarget({aimMode:"mouse",aimX:mouse.x,aimY:mouse.y},{x:500,y:129},camera,zoom);
  close(result.x,target.x);close(result.y,target.y);
  for(const cameraEdge of [0,WORLD.width-VIEW.canvasWidth/zoom]){
    const origin={x:cameraEdge+64,y:129},right=aimTarget({aimMode:"touch",touchDx:1,touchDy:0},origin,cameraEdge,zoom);
    close(right.y,origin.y);assert.ok(right.x>origin.x);
    const up=aimTarget({aimMode:"touch",touchDx:0,touchDy:-1},origin,cameraEdge,zoom);
    close(up.x,origin.x);assert.ok(up.y<origin.y);
  }
  }
});

const player=()=>({x:2000,y:116,w:14,h:27,vx:0,face:1});
const enemy=(dx,overrides={})=>({x:2000+dx,y:119.5,w:28,h:20,hp:24,type:"crawler",...overrides});
function sample(enemies,battle={}){const p=player(),c=createBattleCamera(p);evaluateBattleCamera(c,p,enemies,battle);return c}
function settle(c,p,enemies,battle={},seconds=6,fps=60){for(let i=0;i<seconds*fps;i++)updateBattleCamera(c,p,enemies,battle,1/fps);return c}

test("distance produces continuous close-to-far zoom and crowd/spread widen the view",()=>{
  let last=1;
  for(let distance=0;distance<=600;distance+=5){const c=sample([enemy(distance)]);assert.ok(c.rawZoom<=last+1e-8);assert.ok(last-c.rawZoom<.16);last=c.rawZoom}
  assert.ok(sample([enemy(15)]).rawZoom>.8);
  assert.ok(sample([enemy(100)]).rawZoom>=.6);
  assert.ok(sample([enemy(260)]).rawZoom>=.45&&sample([enemy(260)]).rawZoom<=.6);
  const far=sample([enemy(550),enemy(570),enemy(590)]);assert.ok(far.rawZoom>=.35&&far.rawZoom<=.45);
  const near=sample([enemy(60),enemy(70),enemy(80)]);
  const mixed=sample([enemy(60),enemy(70),enemy(80),enemy(410),enemy(420),enemy(440),enemy(460)]);
  assert.ok(mixed.rawZoom<near.rawZoom-.15);
  const outlier=sample([enemy(60),enemy(70),enemy(80),enemy(590)]);assert.ok(outlier.rawZoom>near.rawZoom-.12);
  assert.ok(sample([enemy(-200),enemy(-205),enemy(-210),enemy(200),enemy(205),enemy(210)]).rawZoom<sample(Array.from({length:6},()=>enemy(200))).rawZoom);
  assert.ok(sample(Array.from({length:20},()=>enemy(50))).rawZoom<sample([enemy(50)]).rawZoom);
});

test("only active spawned enemies within 600 world px are evaluated, independently of rendering",()=>{
  const c=sample([enemy(550),enemy(580),enemy(601),enemy(20,{dead:true}),enemy(30,{active:false}),enemy(40,{spawned:false}),enemy(50,{hp:0}),enemy(100,{type:"boss"})]);
  assert.equal(c.evaluatedEnemies,2);assert.ok(c.rawZoom<.45);
  const idle=sample([enemy(601),enemy(40,{dead:true})]);assert.equal(idle.rawZoom,.5);assert.equal(idle.mode,"idle");
  // 550 px is outside an initial 640 px-wide forward-framed view, yet is detected.
  const initial=createBattleCamera(player()),bounds=viewBounds(initial.x,initial.zoom);assert.ok(2550>bounds.right);
});

test("hysteresis ignores transient enemies and death smoothly returns to idle",()=>{
  const p=player(),c=createBattleCamera(p),near=[enemy(20)];
  settle(c,p,near,{},.15);settle(c,p,[],{},1);close(c.zoom,.5);
  settle(c,p,near);assert.ok(c.zoom>.78);
  const before=c.zoom;near[0].dead=true;updateBattleCamera(c,p,near,{},1/60);
  assert.ok(Math.abs(c.zoom-before)<.02);settle(c,p,near);assert.ok(Math.abs(c.zoom-.5)<.001);
});

test("mixed groups and boundary jitter do not cause zoom oscillation",()=>{
  const p=player(),c=createBattleCamera(p),enemies=[enemy(80),enemy(99),enemy(390),enemy(410),enemy(430)];
  settle(c,p,enemies);let min=1,max=0,previous=c.zoom;
  for(let i=0;i<600;i++){
    enemies[1].x=2099+(i%2)*2;updateBattleCamera(c,p,enemies,{},1/60);
    min=Math.min(min,c.zoom);max=Math.max(max,c.zoom);assert.ok(Math.abs(c.zoom-previous)<.02);previous=c.zoom;
  }
  assert.ok(max-min<.025);
});

test("frame-rate independent smoothing and zoom limits hold with 100+ enemies",()=>{
  const enemies=Array.from({length:150},(_,i)=>enemy(20+i*3));
  for(const dx of [0,590]){
    for(let i=0;i<enemies.length;i++)enemies[i].x=2000+dx+i*.01;
    const p=player(),c=createBattleCamera(p);settle(c,p,enemies);
    assert.ok(c.zoom>=.35&&c.zoom<=.85);assert.ok(c.targetZoom>=.35&&c.targetZoom<=.85);
  }
  const results=[30,60,144].map(fps=>settle(createBattleCamera(player()),player(),[enemy(50)],{},6,fps));
  assert.ok(Math.max(...results.map(c=>c.zoom))-Math.min(...results.map(c=>c.zoom))<.001);
  assert.ok(Math.max(...results.map(c=>c.x))-Math.min(...results.map(c=>c.x))<.1);
  close(damp(.5,.85,2.2,1),damp(damp(.5,.85,2.2,.4),.85,2.2,.6));
});

test("camera looks ahead in travel direction and keeps player inside safe screen margins",()=>{
  const p=player(),right=createBattleCamera(p),left=createBattleCamera(p);p.vx=95;settle(right,p,[]);p.vx=-95;settle(left,p,[]);
  assert.ok(left.x<right.x);
  for(const c of [left,right]){const x=worldToScreen(p,c.x,c.zoom).x;assert.ok(x>=56&&x<=264)}
  for(const x of [8,4775]){p.x=x;settle(right,p,[enemy(20)]);const b=viewBounds(right.x,right.zoom);assert.ok(b.left>=0);assert.ok(b.right<=WORLD.width+1e-8)}
});

test("remote and mixed groups are actually framed together where zoom limits allow",()=>{
  for(const enemies of [[enemy(550),enemy(590)],[enemy(60),enemy(80),enemy(540),enemy(560)],[enemy(-300),enemy(-280),enemy(280),enemy(300)]]){
    const p=player(),c=settle(createBattleCamera(p),p,enemies);
    const px=worldToScreen(p,c.x,c.zoom).x;assert.ok(px>=56-1e-6&&px<=264+1e-6);
    for(const e of enemies){const x=worldToScreen(e,c.x,c.zoom).x;assert.ok(x-e.w*c.zoom/2>=0);assert.ok(x+e.w*c.zoom/2<=320)}
  }
});

test("boss framing includes both actors, ignores summons, and smoothly releases on death",()=>{
  const p=player(),boss=enemy(480,{type:"boss",w:88,h:58,y:90,hp:1200});
  const a=sample([boss],{bossStarted:true}),b=sample([boss,...Array.from({length:20},()=>enemy(20))],{bossStarted:true});
  assert.equal(a.mode,"boss");close(a.rawZoom,b.rawZoom);close(a.focusX,b.focusX);
  settle(a,p,[boss],{bossStarted:true});
  const px=worldToScreen(p,a.x,a.zoom).x,bx=worldToScreen(boss,a.x,a.zoom).x;
  assert.ok(px>=56&&px<264);assert.ok(bx-boss.w*a.zoom/2>=0&&bx+boss.w*a.zoom/2<=320);
  assert.ok(a.zoom>=BATTLE_CAMERA.bossMinZoom&&a.zoom<=BATTLE_CAMERA.bossMaxZoom);
  const before=a.zoom;boss.dead=true;updateBattleCamera(a,p,[boss],{bossStarted:true},1/60);assert.ok(Math.abs(a.zoom-before)<.02);
  settle(a,p,[boss],{bossStarted:true});assert.equal(a.mode,"idle");assert.ok(Math.abs(a.zoom-.5)<.001);
  assert.equal(sample([enemy(200,{type:"beetle",w:42,h:40})],{midbossAlive:true}).mode,"midboss");
});
