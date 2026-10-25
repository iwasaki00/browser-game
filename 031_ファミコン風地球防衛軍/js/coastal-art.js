import {loadStudyImage} from './art-preview.js?v=0.2.3-C';
import {coastalWeakCore} from './mission03.js?v=0.3.0';
export const COAST_FILES=Object.freeze({coast:['backgrounds/coast.png',640,360],tiles:['tiles/coast.png',256,256],
  shorecrab:['sprites/shorecrab.png',480,144],skyray:['sprites/skyray.png',480,144],siegebeetle:['sprites/siegebeetle.png',576,240],leviathan:['sprites/leviathan.png',1920,192],aa:['sprites/aa.png',384,64],
  shorecrabFar:['far/shorecrab.png',480,144],skyrayFar:['far/skyray.png',480,144],siegebeetleFar:['far/siegebeetle.png',576,240],leviathanFar:['far/leviathan.png',1920,192],
  coastSplash:['effects/splash.png',128,32],coastWarning:['effects/warning.png',128,32],coastAA:['effects/artillery.png',128,32],coastTentacle:['effects/tentacle.png',512,128],coastBreak:['effects/bossBreak.png',2560,192]});
export const COAST_ACTORS=Object.freeze({shorecrab:[40,24],skyray:[40,24],siegebeetle:[48,40],leviathan:[160,96]});
export async function loadCoastalArt(loader=loadStudyImage){return Object.fromEntries(await Promise.all(Object.entries(COAST_FILES).map(async([k,args])=>{try{return [k,await loader(...args,'assets/coastal-01/')]}catch{return [k,null]}})))}
export function drawCoastalEnemy(ctx,pack,e,x,y,far){
  const size=COAST_ACTORS[e.type];if(!size)return false;const [w,h]=size;
  const image=far&&pack?.[e.type+'Far']?pack[e.type+'Far']:pack?.[e.type];
  const frame=e.dead?3:e.hitFlash>0?4:e.type==='leviathan'&&coastalWeakCore(e).open?5:e.warningLeft>0||e.attackFlash>0?2:Math.floor(e.anim||0)%2,row=e.type==='leviathan'?0:(e.uid??0)%3;
  if(image){ctx.save();if(e.face>0&&e.type!=='leviathan'){ctx.translate(x*2,0);ctx.scale(-1,1)}ctx.drawImage(image,frame*w*2,row*h*2,w*2,h*2,x-w/2,y,w,h);if(e.type==='leviathan'&&e.hp<=900&&!e.dead)ctx.drawImage(image,3*w*2+92,40,80,48,x-w/2+46,y+20,40,24);ctx.restore()}
  else{ctx.fillStyle=e.type==='skyray'?'#acb6cf':'#967c9c';ctx.fillRect(x-w/2,y,w,h);ctx.fillStyle='#e1dfbf';ctx.fillRect(x-5,y+4,10,5)}
  if(!e.dead&&e.warningLeft>0){const n=e.type==='leviathan'&&e.coastAction===0?e.coastPhase:1;ctx.strokeStyle='#ffb77e';ctx.lineWidth=2;for(let i=0;i<n;i++){const wx=e.type==='leviathan'&&e.coastAction===2?e.x:e.warnX+(i-(n-1)/2)*76;ctx.strokeRect(wx-21,120,42,28)}}
  return true;
}
export function drawCoastTile(ctx,pack,index,x,y,w=16,h=16){if(!pack?.tiles){ctx.fillStyle=index===2?'#476c78':'#203e4a';ctx.fillRect(x,y,w,h);return}const variant=((Math.floor(x/16)*7+Math.floor(y/16)*3)%4+4)%4,cell=variant*16+index;ctx.drawImage(pack.tiles,cell%8*32,Math.floor(cell/8)*32,w*2,h*2,x,y,w,h)}
export function drawCoastalWorld(ctx,pack,g,bounds){
  for(let x=Math.floor(bounds.left/16)*16;x<bounds.right+16;x+=16)for(let y=148;y<Math.min(bounds.bottom+16,228);y+=16){drawCoastTile(ctx,pack,5,x,y);if(y===148)drawCoastTile(ctx,pack,6,x,y,16,6)}
  for(const p of g.platforms){if(p.x>bounds.right||p.x+p.w<bounds.left)continue;for(let x=Math.max(p.x,Math.floor(bounds.left/16)*16);x<p.x+p.w&&x<bounds.right;x+=16)for(let y=p.y;y<p.y+p.h&&y<bounds.bottom;y+=16)drawCoastTile(ctx,pack,p.kind==='container'?2:p.kind==='defense'?3:p.kind==='wreck'?4:y===p.y?0:1,x,y,Math.min(16,p.x+p.w-x),Math.min(16,p.y+p.h-y))}
  for(const t of g.coast.turrets){if(t.x<bounds.left-32||t.x>bounds.right+32)continue;if(pack?.aa)ctx.drawImage(pack.aa,(t.hp<=0?3:t.wait>.5?2:0)*64,0,64,64,t.x-16,t.y,32,32);else{ctx.fillStyle='#88b7ba';ctx.fillRect(t.x-12,t.y+16,24,16)}}
  ctx.fillStyle='#b3efff';for(const s of g.coast.aaShots)ctx.fillRect(Math.round(s.x)-2,Math.round(s.y)-1,4,2);
}
export function drawCoastalFX(ctx,pack,f,progress){
  if(!f.kind?.startsWith('coast'))return false;
  const size=f.kind==='coastBreak'?[160,96,8]:f.kind==='coastTentacle'?[64,64,4]:[16,16,4],image=pack?.[f.kind],frame=Math.min(size[2]-1,Math.floor(progress*size[2]));
  if(image)ctx.drawImage(image,frame*size[0]*2,0,size[0]*2,size[1]*2,f.x-size[0]/2,f.y-size[1]/2,size[0],size[1]);
  else{ctx.fillStyle=f.kind==='coastBreak'?'#ffe59b':'#8ddde5';ctx.fillRect(f.x-4,f.y-3,8,6)}
  if(f.kind==='coastWarning'){ctx.strokeStyle='#ff9974';ctx.lineWidth=2;ctx.strokeRect(f.x-21,120,42,28)}return true;
}
