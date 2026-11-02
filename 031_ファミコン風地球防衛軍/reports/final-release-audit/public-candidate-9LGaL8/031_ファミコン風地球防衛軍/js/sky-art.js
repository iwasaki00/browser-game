import {loadStudyImage} from './art-preview.js?v=0.2.3-C';
import {skyTargetOpen,skyPlatformMotion,FORTRESS_GUIDANCE,SKY} from './mission04.js?v=0.4.1';
export const SKY_ACTORS=Object.freeze({interceptor:[36,22],shielddrone:[32,28],heavygunner:[40,36],fortress:[160,96],skydevice:[28,32]});
export const SKY_FILES={background:['backgrounds/sky.png',640,360],tiles:['tiles/sky.png',256,64],skyBreak:['effects/break.png',512,64],skyOrb:['effects/shot.png',512,64]};
for(const [k,[w,h]] of Object.entries(SKY_ACTORS)){SKY_FILES[k]=['sprites/'+k+'.png',w*16,h*2];SKY_FILES[k+'Far']=['far/'+k+'.png',w*16,h*2]}
export async function loadSkyArt(loader=loadStudyImage){return Object.fromEntries(await Promise.all(Object.entries(SKY_FILES).map(async([k,args])=>{try{return [k,await loader(...args,'assets/sky-01/')]}catch{return [k,null]}})))}
export function drawSkyBackdrop(c,pack,g,b){
  c.fillStyle='#111d2f';c.fillRect(b.left-10,b.top-10,b.right-b.left+20,b.bottom-b.top+20);
  const start=Math.floor((b.left-g.camera*.12)/320)*320+g.camera*.12;
  for(let x=start-320;x<b.right+320;x+=320)if(pack?.background)c.drawImage(pack.background,0,0,640,360,x,0,320,180);
}
export function drawSkyWorld(c,pack,g,b){
  for(const p of g.platforms){if(p.active===false||p.x>b.right||p.x+p.w<b.left)continue;
    const left=Math.max(p.x,Math.floor(b.left/16)*16),bottom=Math.min(p.y+p.h,b.bottom+16);
    for(let x=left;x<Math.min(p.x+p.w,b.right+16);x+=16)for(let y=p.y;y<bottom;y+=16){const w=Math.min(16,p.x+p.w-x),h=Math.min(16,p.y+p.h-y),i=p.moving?2:p.kind==='shell'?3:y===p.y?0:1;
      if(pack?.tiles)c.drawImage(pack.tiles,i*32,0,w*2,h*2,x,y,w,h);else{c.fillStyle=y===p.y?'#b9c9b8':'#334858';c.fillRect(x,y,w,h)}}
    if(p.moving){const m=skyPlatformMotion(p,g.time);c.fillStyle=m.turnLeft<=FORTRESS_GUIDANCE.turnWarning?'#ffd18b':'#9ccabb';c.fillRect(p.x+12,p.y,p.w-24,2);c.strokeStyle='#bfded3';c.lineWidth=1;c.strokeRect(p.x+12,p.y-2,p.w-24,3)}
  }
}
export function drawSkyEnemy(c,pack,e,x,y,far){
  const size=SKY_ACTORS[e.type];if(!size)return false;const [w,h]=size,image=pack?.[e.type+(far?'Far':'')]??pack?.[e.type];
  const boss=e.type==='fortress',dy=boss?y-32:y,frame=e.dead?3:e.hitFlash>0?4:boss&&e.skyPhase===3?(e.hp<e.maxHp*.3?6:5):e.warningLeft>0||e.fixedDevice&&e.partKind==='turret'?2:Math.floor(e.anim??0)%2;
  if(image)c.drawImage(image,frame*w*2,0,w*2,h*2,x-w/2,dy,w,h);else{c.fillStyle=boss?'#75808a':'#b9c9b8';c.fillRect(x-w/2,dy,w,h);c.fillStyle='#e8bc7c';c.fillRect(x-5,y+8,10,7)}

  return true;
}
export function drawSkyWarnings(c,g){
  c.save();c.lineWidth=1;c.font='7px monospace';
  let rings=0;for(const d of g.sky.shieldSources){if(rings>=FORTRESS_GUIDANCE.sourceMarkers)break;if(d.dead||d.x<g.camera-120||d.x>g.camera+320/g.battleCamera.zoom+120)continue;c.strokeStyle='#84b6a932';c.beginPath();c.arc(d.x,d.y+14,SKY.shieldRadius,0,Math.PI*2);c.stroke();rings++}
  for(const e of g.enemies){if(e.dead)continue;
    if(e.fixedDevice){const open=skyTargetOpen(g,e);c.strokeStyle=open?'#f2d093':'#758899';c.fillStyle=open?'#f2d093':'#758899';c.strokeRect(e.x-16,e.y-2,32,36);c.fillRect(e.x-14,e.y+34,28*e.hp/e.maxHp,2)}
    if(!e.warningLeft)continue;c.strokeStyle='#f2bd80';c.fillStyle='#d881552b';
    if(e.type==='fortress'&&e.attackPlan)for(const z of e.attackPlan.zones){c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);c.fillText('!',z.x-2,Math.max(20,z.y-4))}
    else if(e.type==='heavygunner'||e.type==='interceptor'){c.beginPath();c.moveTo(e.x,e.y+(e.type==='heavygunner'?12:0));c.lineTo(e.warnX,e.warnY);c.stroke();c.strokeRect(e.warnX-6,e.warnY-6,12,12)}
  }
  c.fillStyle='#efaf7e';for(const h of g.sky.hazards)c.fillRect(h.x-h.w/2,h.y,h.w,h.h);
  c.restore();
}
export function drawSkyFX(c,pack,f,t){if(f.kind==='skyShieldOff'){c.save();c.globalAlpha=Math.max(0,1-t);c.strokeStyle='#95dfc4';c.lineWidth=1;c.beginPath();c.arc(f.x,f.y,12+30*t,0,Math.PI*2);c.stroke();c.restore();return true}if(!['skyBreak','skyFire'].includes(f.kind))return false;const image=f.kind==='skyFire'?pack?.skyOrb:pack?.skyBreak;if(image)c.drawImage(image,Math.min(7,Math.floor(t*8))*64,0,64,64,f.x-24,f.y-24,48,48);else{c.fillStyle='#efc388';c.fillRect(f.x-6,f.y-6,12,12)}return true}
