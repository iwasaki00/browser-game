import {VIEW,WORLD,clamp,visibleWorldWidth} from "./data.js";

export function worldToScreen(point,camera,zoom){
  return {x:(point.x-camera)*zoom,y:WORLD.ground+(point.y-WORLD.ground)*zoom};
}

export function screenToWorld(point,camera,zoom){
  return {x:camera+point.x/zoom,y:WORLD.ground+(point.y-WORLD.ground)/zoom};
}

export function clientToScreen(point,rect){
  return {x:(point.x-rect.left)*VIEW.canvasWidth/rect.width,y:(point.y-rect.top)*VIEW.canvasHeight/rect.height};
}

export function followCamera(playerX,zoom){
  return clamp(playerX-105/zoom,0,Math.max(0,WORLD.width-visibleWorldWidth(zoom)));
}

export function viewBounds(camera,zoom){
  const topLeft=screenToWorld({x:0,y:0},camera,zoom);
  const bottomRight=screenToWorld({x:VIEW.canvasWidth,y:VIEW.canvasHeight},camera,zoom);
  return {left:topLeft.x,top:topLeft.y,right:bottomRight.x,bottom:bottomRight.y};
}

export function aimTarget(input,origin,camera,zoom){
  if(input.aimMode==="touch")return {x:origin.x+input.touchDx*200,y:origin.y+input.touchDy*200};
  return screenToWorld({x:input.aimX,y:input.aimY},camera,zoom);
}
