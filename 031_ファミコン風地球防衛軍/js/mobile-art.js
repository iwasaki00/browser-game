import {loadStudyImage} from './art-preview.js?v=0.2.3-C';

// M05-only visual data. All destinations are world pixels; HUD stays elsewhere.
export const MOBILE_ACTORS=Object.freeze({assaultroller:[36,24],repairdrone:[30,22],sentrywalker:[44,38],reactor:[160,96],basedevice:[28,32]});
export const MOBILE_FILES={tiles:['tiles/mobile.png',256,64],distantBase:['backgrounds/distant-base.png',430,164]};
for(const name of ['wilderness','deck','interior','control','reactor'])MOBILE_FILES[name+'Background']=['backgrounds/'+name+'.png',640,360];
for(const name of ['dust','exhaust','fire','break','heal','warning'])MOBILE_FILES['mobile'+name[0].toUpperCase()+name.slice(1)]=['effects/'+name+'.png',512,64];
for(const [kind,[w,h]] of Object.entries(MOBILE_ACTORS)){
  MOBILE_FILES[kind]=['sprites/'+kind+'.png',w*16,h*2];
  MOBILE_FILES[kind+'Far']=['far/'+kind+'.png',w*16,h*2];
}
export async function loadMobileArt(loader=loadStudyImage){
  return Object.fromEntries(await Promise.all(Object.entries(MOBILE_FILES).map(async([key,args])=>{
    try{return [key,await loader(args[0]+'?v=0.5.0',args[1],args[2],'assets/mobile-fortress-01/')]}catch{return [key,null]}
  })));
}
function sceneAt(g){const x=g.player?.x??0;return x<1400?'wilderness':x<3000?'deck':x<4600?'interior':x<6200?'control':'reactor'}
function visible(e,b,pad=0){return e.x+e.w+pad>=b.left&&e.x-e.w-pad<=b.right&&e.y+e.h+pad>=b.top&&e.y-pad<=b.bottom}
function gear(c,x,y,r,time){
  c.save();c.translate(x,y);c.rotate(time);c.strokeStyle='#526e77';c.lineWidth=3;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();
  c.strokeStyle='#9cae9e';c.lineWidth=2;
  for(let k=0;k<6;k++){const a=k*Math.PI/3;c.beginPath();c.moveTo(Math.cos(a)*r*.25,Math.sin(a)*r*.25);c.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);c.stroke()}
  c.restore();
}
export function drawMobileBackdrop(c,pack,g,b){
  c.fillStyle='#182631';c.fillRect(b.left-16,b.top-16,b.right-b.left+32,b.bottom-b.top+32);
  const scene=sceneAt(g),image=pack?.[scene+'Background'];
  // Cumulative travel is a presentation offset only. Stopping/reducing drive
  // speed remains continuous; the renderer never moves game entities.
  const travel=Number.isFinite(g.mobile?.travel)?g.mobile.travel:0;
  const parallax=scene==='wilderness'?.16:scene==='deck'?.1:.025;
  const shift=(g.camera??b.left)*parallax-travel*(scene==='wilderness'?.5:scene==='deck'?.35:.04);
  const start=Math.floor((b.left-shift)/320)*320+shift;
  for(let x=start-320;x<b.right+320;x+=320){
    if(image)c.drawImage(image,0,0,640,360,x,0,320,180);
    if(scene==='wilderness'||scene==='deck'){
      c.fillStyle='#b09e7627';for(let n=0;n<5;n++){const dx=(travel*.7+n*61)%320;c.fillRect(x+dx,150+(n%3)*5,15+(n%2)*9,3)}
    }
  }
  if(scene==='wilderness'&&pack?.distantBase){
    const progress=Math.max(0,Math.min(1,(g.player?.x??0)/1400)),w=200+progress*260,h=w*164/430;
    // One target base, not one base per repeated scenery tile. Apparent size
    // increases on approach; this projection has no collision/world writes.
    c.drawImage(pack.distantBase,0,0,430,164,g.camera+(b.right-b.left)*.65-w/2,148-h,w,h);
  }
  if(scene==='interior'){
    // Slow visual gears/pistons stop with the same background drive factor.
    const phase=travel*.025;
    for(let x=Math.floor(b.left/160)*160;x<b.right+160;x+=160){gear(c,x+54,42,16,phase);c.fillStyle='#657f82';c.fillRect(x+113,48+Math.round(Math.sin(phase)*5),5,29)}
  }
  if(scene==='deck'){
    // Wheels, exhaust and restrained chassis vibration are visual only. They
    // never offset the platform transform, player, aiming or collision bodies.
    const phase=travel*.04,wobble=Math.round(Math.sin(phase)*Math.min(1,g.mobile?.speed??1));
    for(let x=Math.floor(b.left/112)*112;x<b.right+112;x+=112){
      c.fillStyle='#17232c';c.fillRect(x,153+wobble,94,18);
      for(let n=0;n<4;n++)gear(c,x+12+n*22,162+wobble,6,phase);
      for(let n=0;n<8;n++){const at=(n*12+travel)%94;c.fillStyle='#7c8b86';c.fillRect(Math.round(x+at),154+wobble,6,2)}
    }
    if(pack?.mobileExhaust){const f=Math.floor(travel*.12)%8;for(let n=0;n<2;n++)c.drawImage(pack.mobileExhaust,f*64,0,64,64,b.left+70+n*190,105+wobble,32,32)}
  }
}
export function drawMobileWorld(c,pack,g,b){
  for(const p of g.platforms??[]){
    if(p.active===false||!visible(p,b,16))continue;
    const edge=Math.min(p.x+p.w,b.right+16),bottom=Math.min(p.y+p.h,b.bottom+16);
    for(let x=Math.max(p.x,Math.floor(b.left/16)*16);x<edge;x+=16)for(let y=p.y;y<bottom;y+=16){
      const w=Math.min(16,p.x+p.w-x),h=Math.min(16,p.y+p.h-y),i=p.moving?2:p.kind==='hatch'?3:p.kind==='gear'?5:y===p.y?0:1;
      if(pack?.tiles)c.drawImage(pack.tiles,i*32,0,w*2,h*2,x,y,w,h);
      else{c.fillStyle=y===p.y?'#becbb9':'#425765';c.fillRect(x,y,w,h)}
    }
    if(p.moving){
      c.fillStyle='#b7d0b7';c.fillRect(p.x+10,p.y,p.w-20,2);
      const vertical=p.axis==='y'||p.vertical,travel=p.travel??0,at=travel>0?((g.time??0)*(p.speed??0))%(travel*2):0,positive=travel>0?at<travel:true;
      c.font='6px monospace';c.fillText(vertical?(positive?'↓':'↑'):(positive?'→':'←'),p.x+p.w/2-3,p.y+8);
    }
  }
  // Gates are presentation only: the mission owns whether their platform is
  // active. Do not create or remove collision bodies here.
  for(const p of g.mobile?.gates??[]){
    if(!visible(p,b,8))continue;c.strokeStyle=p.open?'#91c9ab':'#c9ad7d';c.lineWidth=1;
    if(!p.open){c.strokeRect(p.x,p.y,p.w,p.h);for(let y=p.y+4;y<p.y+p.h;y+=8){c.beginPath();c.moveTo(p.x,y);c.lineTo(p.x+p.w,Math.min(p.y+p.h,y+8));c.stroke()}}
  }
}
export function drawMobileEnemy(c,pack,e,x,y,far){
  const size=MOBILE_ACTORS[e.type];if(!size)return false;
  const [w,h]=size,boss=e.type==='reactor',image=pack?.[e.type+(far?'Far':'')]??pack?.[e.type];
  const frame=e.dead?3:e.hitFlash>0?4:boss&&!e.shielded?(e.hp<e.maxHp*.3?6:5):e.warningLeft>0?2:e.type==='sentrywalker'&&e.hp<e.maxHp*.5?6:Math.floor(e.anim??0)%2;
  const top=boss?y-32:y;
  if(image)c.drawImage(image,frame*w*2,0,w*2,h*2,x-w/2,top,w,h);
  else{
    c.fillStyle=boss?'#7b7a80':'#7b8e8c';c.fillRect(x-w/2,top,w,h);
    c.strokeStyle='#bed2ba';c.lineWidth=1;c.strokeRect(x-w/2,top,w,h);c.fillStyle='#c8dcae';c.fillRect(x-4,y+(boss?28:8),8,8);
  }
  if(e.fixedDevice&&!e.dead){
    c.save();c.fillStyle=e.partKind==='left'?'#e3bc85':e.partKind==='right'?'#95cdbb':'#c3c9b2';
    c.fillRect(x-10,y+5,20,2);
    if(e.partKind==='drive')gear(c,x,y+17,7,(e.anim??0)*.5);
    else if(e.partKind==='turret'){c.fillStyle='#a7b8ad';c.fillRect(x-23,y+9,20,4)}
    else if(e.partKind==='left'||e.partKind==='right'){c.font='5px monospace';c.fillText(e.partKind==='left'?'L':'R',x-2,y+16)}
    c.restore();
  }
  return true;
}
export function drawMobileWarnings(c,g){
  const state=g.mobile;if(!state)return;
  c.save();c.lineWidth=1;c.font='7px monospace';let devices=0,links=0;
  for(const e of g.enemies??[]){
    if(e.dead)continue;
    if(e.fixedDevice&&devices++<12){
      c.strokeStyle='#c7b98e';c.strokeRect(e.x-15,e.y-1,30,34);c.fillStyle='#c8ceae';c.fillRect(e.x-13,e.y+33,26*Math.max(0,e.hp/e.maxHp),2);
    }
    if(!(e.warningLeft>0))continue;
    c.strokeStyle='#edbf87';c.fillStyle='#c980512b';
    if(e.type==='reactor'&&e.attackPlan){
      for(const z of e.attackPlan.zones??[]){c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);c.fillText('!',z.x-2,Math.max(17,z.y-4))}
    }else if(e.type==='assaultroller'||e.type==='sentrywalker'||e.fixedDevice){
      if(Number.isFinite(e.warnX)&&Number.isFinite(e.warnY)){
        c.beginPath();c.moveTo(e.x,e.y+e.h/2);c.lineTo(e.warnX,e.warnY);c.stroke();c.strokeRect(e.warnX-5,e.warnY-5,10,10);
      }
      c.fillText('!',e.x-2,e.y-5);
    }
  }
  // Read actual successful heal links, not all nearby enemies. Cap visuals only;
  // healing selection and amounts remain entirely in mission logic.
  for(const r of state.repairs??[]){
    if(links>=12)break;if(r.life<=0||!r.from||!r.target||r.from.dead||r.target.dead)continue;
    const from=typeof r.from==='object'?r.from:(g.enemies??[]).find(e=>e.id===r.from),target=typeof r.target==='object'?r.target:(g.enemies??[]).find(e=>e.id===r.target);
    if(!from||!target||target.fixedDevice||target.type==='reactor')continue;
    c.strokeStyle='#a0d9b8';c.setLineDash?.([3,3]);c.beginPath();c.moveTo(from.x,from.y+from.h/2);c.lineTo(target.x,target.y+target.h/2);c.stroke();c.setLineDash?.([]);
    c.fillStyle='#d2e3bb';c.fillRect(target.x-3,target.y-5,6,1);c.fillRect(target.x,target.y-8,1,7);links++;
  }
  c.fillStyle='#e7ac72';for(const z of state.hazards??[])c.fillRect(z.x-z.w/2,z.y,z.w,z.h);
  c.restore();
}
export function drawMobileFX(c,pack,f,t){
  const aliases={mobileBreak:'mobileBreak',mobileFire:'mobileFire',mobileDust:'mobileDust',mobileExhaust:'mobileExhaust',mobileHeal:'mobileHeal',mobileWarning:'mobileWarning',mobileShieldOff:'mobileHeal'};
  const key=aliases[f.kind];if(!key)return false;
  const image=pack?.[key],size=f.kind==='mobileBreak'?48:f.kind==='mobileDust'?36:32;
  c.save();c.globalAlpha=Math.max(0,1-t*.85);
  if(image)c.drawImage(image,Math.min(7,Math.floor(t*8))*64,0,64,64,f.x-size/2,f.y-size/2,size,size);
  else{c.fillStyle=key==='mobileHeal'?'#a0d9b8':'#e2bb85';c.fillRect(f.x-4,f.y-4,8,8)}
  c.restore();return true;
}
