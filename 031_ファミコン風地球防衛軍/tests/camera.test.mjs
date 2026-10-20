import test from "node:test";
import assert from "node:assert/strict";
import {VIEW,WORLD} from "../js/data.js";
import {worldToScreen,screenToWorld,clientToScreen,followCamera,viewBounds,aimTarget} from "../js/camera.js";

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test("world/screen conversion round trips at both camera edges",()=>{
  for(const player of [8,900,4775]){
    const camera=followCamera(player,.7),bounds=viewBounds(camera,.7);
    assert.ok(bounds.left>=0);assert.ok(bounds.right<=WORLD.width+1e-8);
    for(const point of [{x:player,y:116},{x:player+80,y:64},{x:player-30,y:148}]){
      const inverse=screenToWorld(worldToScreen(point,camera,.7),camera,.7);
      close(inverse.x,point.x);close(inverse.y,point.y);
    }
    close(worldToScreen({x:player,y:WORLD.ground},camera,.7).y,WORLD.ground);
  }
  close(worldToScreen({x:900,y:116},followCamera(900,.7),.7).x,105);
});

test("mouse target matches displayed world point at CSS sizes and touch aim stays relative",()=>{
  const rect={left:12,top:40,width:640,height:360},camera=400,target={x:700,y:80};
  const screen=worldToScreen(target,camera,.7),client={x:rect.left+screen.x*2,y:rect.top+screen.y*2};
  const mouse=clientToScreen(client,rect),result=aimTarget({aimMode:"mouse",aimX:mouse.x,aimY:mouse.y},{x:500,y:129},camera,.7);
  close(result.x,target.x);close(result.y,target.y);
  for(const cameraEdge of [0,WORLD.width-VIEW.canvasWidth/.7]){
    const origin={x:cameraEdge+64,y:129},right=aimTarget({aimMode:"touch",touchDx:1,touchDy:0},origin,cameraEdge,.7);
    close(right.y,origin.y);assert.ok(right.x>origin.x);
    const up=aimTarget({aimMode:"touch",touchDx:0,touchDy:-1},origin,cameraEdge,.7);
    close(up.x,origin.x);assert.ok(up.y<origin.y);
  }
});
