// Isolated historical QA: actual versioned game/camera code; no user/browser storage.
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as data from '../../js/data.js';
import {runtime} from './runtime.mjs';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
const prefix=execFileSync('git',['rev-parse','--show-prefix'],{cwd,encoding:'utf8'}).trim();
export const REFS={A1:'08e1548',B:'dfad850',B1:'WORKTREE'};
export const historical=(ref,path)=>execFileSync('git',['show',ref+':'+prefix+path],{cwd,encoding:'utf8',maxBuffer:5e6});
const cache=new Map();
export function versionRuntime(version,{recordDraw=false}={}){
 if(version==='B1')return runtime(null,{debug:true,recordDraw});
 if(!cache.has(version)){
  const ref=REFS[version],camera=historical(ref,'js/camera.js');
  // Imports bind to byte-identical constants. The production movement module is unchanged.
  if(historical(ref,'js/player.js')!==readFileSync(new URL('../../js/player.js',import.meta.url),'utf8'))throw Error('Historical player.js changed; extend module loading before comparing');
  const savedData=historical(ref,'js/data.js').replace(/export const VERSION = .*;/,'');
  if(savedData!==readFileSync(new URL('../../js/data.js',import.meta.url),'utf8').replace(/export const VERSION = .*;/,''))throw Error('Historical gameplay data differs');
  const names=[...camera.matchAll(/export (?:const|function) (\w+)/g)].map(m=>m[1]);
  const exports=vm.runInNewContext(camera.replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'')+'\n({'+names.join(',')+'})',{...data});
  const versionValue=JSON.parse(historical(ref,'package.json')).version;
  let readability={};if(version==='B'){
   const code=historical(ref,'js/readability.js'),keys=[...code.matchAll(/export (?:const|function) (\w+)/g)].map(m=>m[1]);
   readability=vm.runInNewContext(code.replace(/\bexport /g,'')+'\n({'+keys.join(',')+'})');
  }
  cache.set(version,{sourceText:historical(ref,'js/game.js'),modules:{...exports,...readability,VERSION:versionValue}});
 }
 return runtime(null,{debug:true,recordDraw,...cache.get(version)});
}
export function setupMovement(version,classId,{camera='AUTO',x=1800,air=false}={}){
 const r=versionRuntime(version);r.click('test-lab');r.change('labPreset',classId);r.click('lab-close');
 // Flat collision fixture avoids mission obstacles, enemies, hitstop and pickups.
 // moveClassPlayer / update / camera / animation are the real production functions.
 r.run(`clearLabEnemies();game.platforms=[];game.player.x=${x};game.player.y=${air?60:116};game.player.onGround=${!air};game.player.invuln=0;game.player.anim=0;game.time=0;game.lab.cameraMode='${camera}';game.battleCamera=createBattleCamera(game.player);syncCameraView()`);
 return r;
}
export function sample(r){return r.json(`({time:game.time,x:game.player.x,y:game.player.y,cameraX:game.camera,screenX:worldToScreen(game.player,game.camera,view.zoom).x,zoom:view.zoom,lookAhead:game.battleCamera.lookAhead,direction:game.battleCamera.direction,anim:game.player.anim,frame:classPlayerFrame(game.player),energy:game.player.energy,inputRight:input.right,inputLeft:input.left})`)}
export function step(r,seconds,hz=60){r.run(`for(let i=0;i<${Math.round(seconds*hz)};i++)update(${1/hz})`)}
export function movementCase(version,classId,{seconds=1,hz=60,direction=1,air=false,jump=false}={}){
 const r=setupMovement(version,classId,{air});if(air&&classId==='WING')r.pointer('hover','pointerdown',{pointerId:3});
 if(jump)r.pointer('jump','pointerdown',{pointerId:4});r.pointer(direction>0?'right':'left','pointerdown',{pointerId:2});
 const before=sample(r);step(r,seconds,hz);return {version,classId,hz,seconds,direction,air,jump,speed:data.PLAYER_CLASSES[classId].speed,before,after:sample(r)};
}
