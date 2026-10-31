import {loadStudyImage} from './art-preview.js?v=0.2.3-C';

// M06 visual-only adapter. Image destinations are world pixels; HUD and input
// transforms remain owned by the shared renderer. No gameplay state is written.
export const LIVING_ACTORS=Object.freeze({pulseworm:[36,24],sporefly:[30,24],guardiancell:[42,38],neuralheart:[160,104],neuralnode:[24,28],bioshell:[28,64]});
export const LIVING_FILES={tiles:['tiles/living.png',256,64]};
for(const name of ['entrance','pulse','fluid','neural','heart'])LIVING_FILES[name+'Background']=['backgrounds/'+name+'.png',640,360];
for(const name of ['flow','foam','signal','spore','pulse','collapse','shield'])LIVING_FILES['living'+name[0].toUpperCase()+name.slice(1)]=['effects/'+name+'.png',512,64];
for(const [kind,[w,h]] of Object.entries(LIVING_ACTORS)){
  LIVING_FILES[kind]=['sprites/'+kind+'.png',w*16,h*2];
  LIVING_FILES[kind+'Far']=['far/'+kind+'.png',w*16,h*2];
}
export async function loadLivingArt(loader=loadStudyImage){
  return Object.fromEntries(await Promise.all(Object.entries(LIVING_FILES).map(async([key,args])=>{
    try{return [key,await loader(args[0]+'?v=0.6.0',args[1],args[2],'assets/living-colossus-01/')]}catch{return [key,null]}
  })));
}
function sceneAt(g){const x=g.player?.x??0;return x<1400?'entrance':x<3100?'pulse':x<4800?'fluid':x<6500?'neural':'heart'}
function visible(p,b,pad=0){return p.x+p.w+pad>=b.left&&p.x-pad<=b.right&&p.y+(p.h??0)+pad>=b.top&&p.y-pad<=b.bottom}
function line(c,x1,y1,x2,y2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
function arrow(c,x,y,right){const d=right?1:-1;line(c,x-d*6,y,x+d*7,y);line(c,x+d*2,y-4,x+d*7,y);line(c,x+d*2,y+4,x+d*7,y)}

export function drawLivingBackdrop(c,pack,g,b){
  c.fillStyle='#211e2c';c.fillRect(b.left-16,b.top-16,b.right-b.left+32,b.bottom-b.top+32);
  const scene=sceneAt(g),image=pack?.[scene+'Background'],shift=(g.camera??b.left)*.045;
  const start=Math.floor((b.left-shift)/320)*320+shift;
  for(let x=start-320;x<b.right+320;x+=320){
    if(image)c.drawImage(image,0,0,640,360,x,0,320,180);
    else{
      c.fillStyle='#352939';c.fillRect(x,0,320,148);c.strokeStyle='#634c5d';c.lineWidth=4;
      for(let n=0;n<4;n++){line(c,x+n*84+10,0,x+n*84+39,80);line(c,x+n*84+39,80,x+n*84+18,148)}
    }
  }
}

export function drawLivingWorld(c,pack,g,b){
  for(const p of g.platforms??[]){
    if(p.active===false||!visible(p,b,16))continue;
    const edge=Math.min(p.x+p.w,b.right+16),bottom=Math.min(p.y+p.h,b.bottom+16);
    const offset=((p.x%16)+16)%16;
    for(let x=Math.max(p.x,Math.floor(b.left/16)*16-offset);x<edge;x+=16){
      if(x<p.x)continue;
      for(let y=p.y;y<bottom;y+=16){
        const w=Math.min(16,p.x+p.w-x),h=Math.min(16,p.y+p.h-y);
        const i=p.kind==='pulse'?2:p.kind==='shell'?4:p.kind==='neuralgate'?3:p.kind==='bioceiling'?5:y===p.y?0:1;
        if(pack?.tiles)c.drawImage(pack.tiles,i*32,0,w*2,h*2,x,y,w,h);
        else{c.fillStyle=y===p.y?'#bdccaf':'#52666b';c.fillRect(x,y,w,h)}
      }
    }
  }
  c.save();c.lineWidth=1;
  // Actual mission state is read, never inferred from the decorative heartbeat.
  for(const p of g.living?.pulses??[]){
    const y=p.y??36,h=p.h??112,box={x:p.x,y,w:p.w??24,h};if(!visible(box,b,16))continue;
    const state=String(p.state??'OPEN').toUpperCase(),closed=state==='CLOSED',warning=state==='WARNING'||state==='CLOSING',reopen=state==='REOPEN'||state==='REOPENING';
    c.strokeStyle=warning?'#ecc28b':closed?'#92b9ad':'#739a94';
    c.strokeRect(box.x-2,y-2,box.w+4,h+4);
    c.fillStyle='#bbccb3';c.fillRect(box.x-3,y-2,5,4);c.fillRect(box.x+box.w-2,y-2,5,4);
    if(warning){
      c.fillStyle='#c9956a38';c.fillRect(box.x,y,box.w,h);
      c.strokeStyle='#edc28b';for(let yy=y+5;yy<y+h;yy+=13)line(c,box.x,yy,box.x+box.w,Math.min(y+h,yy+6));
      c.font='6px monospace';c.fillStyle='#f0d39c';c.fillText('!',box.x+box.w/2-2,y+10);
    }else if(!closed){
      c.strokeStyle=reopen?'#a8d4b9':'#658f8e';
      for(let yy=y+10;yy<y+h;yy+=21){line(c,box.x-4,yy,box.x-7,yy+4);line(c,box.x+box.w+4,yy,box.x+box.w+7,yy+4)}
    }
  }
  for(const f of g.living?.flows??[]){
    const y=f.y??112,h=f.h??36,box={x:f.x,y,w:f.w??160,h};if(!visible(box,b,16))continue;
    const active=f.active!==false,force=Number.isFinite(f.force)?f.force:0,right=force>=0;
    c.fillStyle=active?'#4c969b27':'#40545c22';c.fillRect(box.x,y,box.w,h);
    c.strokeStyle=active?'#91c9ba':'#647d80';line(c,box.x,y+1,box.x+box.w,y+1);
    const motion=active?((g.time??0)*Math.min(30,Math.abs(force)))%42:0;
    for(let x=box.x+21;x<box.x+box.w-12;x+=42){
      const xx=x+(right?motion:-motion);if(xx>box.x+8&&xx<box.x+box.w-8)arrow(c,Math.round(xx),y+h*.55,right);
    }
    // Foam is sparse and visual only, including when the current is stopped.
    c.fillStyle='#b9d0b3';for(let n=0;n<Math.min(18,Math.ceil(box.w/23));n++){
      const xx=box.x+(n*23+(active?(g.time??0)*force*.3:0))%box.w;
      if(xx>=box.x&&xx<box.x+box.w)c.fillRect(Math.round(xx),y+h-4-(n%3)*3,3,1);
    }
  }
  c.restore();
}

export function drawLivingEnemy(c,pack,e,x,y,far,time=Infinity){
  const size=LIVING_ACTORS[e.type];if(!size)return false;
  const [w,h]=size,boss=e.type==='neuralheart',node=e.type==='neuralnode';
  const stopped=node&&(e.stopped||e.disabled||e.stoppedUntil>time);
  const frame=e.dead?3:e.hitFlash>0?4:boss&&!e.shielded?((e.hpPhase??1)>=3?6:5):stopped?5:e.warningLeft>0?2:e.type==='guardiancell'&&(e.armorBroken||e.hp<e.maxHp*.4)?6:Math.floor(e.anim??0)%2;
  const image=pack?.[e.type+(far?'Far':'')]??pack?.[e.type],top=boss?y-24:y;
  if(image)c.drawImage(image,frame*w*2,0,w*2,h*2,x-w/2,top,w,h);
  else{
    c.fillStyle=boss?'#7d859b':'#749b98';c.fillRect(x-w/2,top,w,h);
    c.strokeStyle='#d7dac1';c.lineWidth=1;c.strokeRect(x-w/2,top,w,h);
    c.fillStyle=stopped?'#e3bd87':'#b9dbc0';c.fillRect(x-4,boss?y+36:y+9,8,8);
  }
  if(boss&&!e.dead&&(e.hpPhase??1)>=2){
    // Damage belongs to HP phase, never to the independent shield cycle.
    c.save();c.strokeStyle='#18232c';c.lineWidth=2;
    for(const side of [-1,1])line(c,x+side*47,y-4,x+side*39,y+6),line(c,x+side*39,y+6,x+side*44,y+14);
    if(e.hpPhase>=3&&Number.isFinite(time)&&Math.floor(time*9)%3===0){c.fillStyle='#e5d6a4';c.fillRect(x-3,y+37,6,3)}
    c.restore();
  }
  if(node&&!e.dead){
    c.save();c.strokeStyle=stopped?'#e3bd87':'#a5d3bb';c.lineWidth=1;c.strokeRect(x-11,y+3,22,19);
    if(e.partKind==='left'||e.partKind==='right'){
      c.font='5px monospace';c.fillStyle='#eff0c8';c.fillText(e.partKind==='left'?'L':'R',x-2,y+12);
    }
    c.restore();
  }
  return true;
}

export function drawLivingWarnings(c,g){
  const state=g.living;if(!state)return;
  c.save();c.lineWidth=1;c.font='7px monospace';let links=0,markers=0;
  for(const signal of state.signals??[]){
    if(links++>=16)break;
    const fromY=signal.fromY??88,toY=signal.toY??88,p=Math.max(0,Math.min(1,signal.progress??0));
    c.strokeStyle='#6f9897';line(c,signal.fromX,fromY,signal.toX,toY);
    c.strokeStyle='#d5e0b9';line(c,signal.fromX,fromY,signal.fromX+(signal.toX-signal.fromX)*p,fromY+(toY-fromY)*p);
    c.fillStyle='#e8e2bc';c.fillRect(signal.fromX+(signal.toX-signal.fromX)*p-2,fromY+(toY-fromY)*p-2,4,4);
  }
  for(const e of g.enemies??[]){
    if(e.dead)continue;
    if(e.type==='neuralnode'&&markers++<12){
      const stopped=e.stoppedUntil>(g.time??0)||e.stopped;
      c.fillStyle=stopped?'#e0be8b':'#aed4bc';c.fillRect(e.x-7,e.y-4,14,2);
    }
    if(!(e.warningLeft>0))continue;
    c.strokeStyle='#e7c08b';c.fillStyle='#b97b6e30';
    if(e.attackPlan){
      for(const z of e.attackPlan.zones??[]){
        c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);
        c.fillStyle='#f1d49f';c.fillText('!',z.x-2,Math.max(14,z.y-3));c.fillStyle='#b97b6e30';
      }
    }else{
      if(Number.isFinite(e.warnX)&&Number.isFinite(e.warnY)){
        line(c,e.x,e.y+e.h/2,e.warnX,e.warnY);c.strokeRect(e.warnX-5,e.warnY-5,10,10);
      }
      c.fillStyle='#eed09a';c.fillText('!',e.x-2,e.y-5);
    }
  }
  c.fillStyle='#dda17982';for(const z of state.hazards??[])c.fillRect(z.x-z.w/2,z.y,z.w,z.h);
  c.restore();
}

export function drawLivingFX(c,pack,f,t){
  const aliases={livingFlow:'livingFlow',livingFoam:'livingFoam',livingSignal:'livingSignal',livingSpore:'livingSpore',livingPulse:'livingPulse',livingCollapse:'livingCollapse',livingShield:'livingShield',livingShieldOff:'livingShield',livingShellBreak:'livingCollapse'};
  const key=aliases[f.kind];if(!key)return false;
  const image=pack?.[key],size=f.kind==='livingCollapse'?52:f.kind==='livingPulse'?44:32;
  c.save();c.globalAlpha=Math.max(0,1-t*.85);
  if(image)c.drawImage(image,Math.min(7,Math.floor(Math.max(0,t)*8))*64,0,64,64,f.x-size/2,f.y-size/2,size,size);
  else{c.fillStyle=key==='livingShield'||key==='livingSignal'?'#a9d8bd':'#dfbd8f';c.fillRect(f.x-4,f.y-4,8,8)}
  c.restore();return true;
}
