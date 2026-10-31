import {loadStudyImage} from './art-preview.js?v=0.2.3-C';

// Visual adapter only: source cells are 2x world pixels. No renderer below
// writes gameplay state, advances timers, starts AI, or changes collision data.
export const MOTHERSHIP_ACTORS=Object.freeze({commanddrone:[32,26],phasestalker:[32,32],assaulttitan:[56,48],commandcore:[176,112],commanddevice:[28,32]});
export const MOTHERSHIP_FILES={tiles:['tiles/mothership.png',256,64]};
for(const name of ['shell','hangar','fusion','network','command','signal'])MOTHERSHIP_FILES[name+'Background']=['backgrounds/'+name+'.png',640,360];
for(const name of ['command','shield','phase','strike','break','signal'])MOTHERSHIP_FILES['mothership'+name[0].toUpperCase()+name.slice(1)]=['effects/'+name+'.png',512,64];
for(const [kind,[w,h]] of Object.entries(MOTHERSHIP_ACTORS)){
  MOTHERSHIP_FILES[kind]=['sprites/'+kind+'.png',w*16,h*2];
  MOTHERSHIP_FILES[kind+'Far']=['far/'+kind+'.png',w*16,h*2];
}
export async function loadMothershipArt(loader=loadStudyImage){
  return Object.fromEntries(await Promise.all(Object.entries(MOTHERSHIP_FILES).map(async([key,args])=>{
    try{return [key,await loader(args[0]+'?v=0.9.0',args[1],args[2],'assets/mothership-01/')]}catch{return [key,null]}
  })));
}
function sceneAt(g){const x=g.player?.x??0;return x<1600?'shell':x<3400?'hangar':x<5300?'fusion':x<7100?'network':'command'}
function visible(p,b,pad=0){return !b||p.x+(p.w??0)+pad>=b.left&&p.x-pad<=b.right&&p.y+(p.h??0)+pad>=b.top&&p.y-pad<=b.bottom}
function line(c,x1,y1,x2,y2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}

export function drawMothershipBackdrop(c,pack,g,b){
  c.fillStyle='#182332';c.fillRect(b.left-16,b.top-16,b.right-b.left+32,b.bottom-b.top+32);
  const image=pack?.[sceneAt(g)+'Background'],shift=(g.camera??b.left)*.04;
  const start=Math.floor((b.left-shift)/320)*320+shift;
  for(let x=start-320;x<b.right+320;x+=320){
    if(image)c.drawImage(image,0,0,640,360,x,0,320,180);
    else{
      c.fillStyle='#29384a';c.fillRect(x,0,320,162);c.strokeStyle='#526574';c.lineWidth=4;
      for(let n=0;n<4;n++){line(c,x+n*96+7,0,x+n*96+30,55);line(c,x+n*96+30,55,x+n*96+18,162)}
    }
  }
  // End transmission is cosmetic and can never make M08 selectable.
  if((g.mothership?.collapseLeft??0)>0&&pack?.signalBackground){
    c.save();c.globalAlpha=.16;c.drawImage(pack.signalBackground,0,0,640,360,b.left,b.top,b.right-b.left,b.bottom-b.top);c.restore();
  }
}

export function drawMothershipWorld(c,pack,g,b){
  for(const p of g.platforms??[]){
    if(p.active===false||!visible(p,b,16))continue;
    const edge=Math.min(p.x+p.w,b.right+16),bottom=Math.min(p.y+p.h,b.bottom+16);
    const first=p.x+Math.max(0,Math.floor((b.left-16-p.x)/16))*16;
    for(let x=first;x<edge;x+=16)for(let y=p.y;y<bottom;y+=16){
      const w=Math.min(16,p.x+p.w-x),h=Math.min(16,p.y+p.h-y);
      const tile=p.kind==='ceiling'?1:p.kind==='container'?2:p.kind==='gate'?3:p.kind==='biofield'?4:y===p.y?0:5;
      if(pack?.tiles)c.drawImage(pack.tiles,tile*32,0,w*2,h*2,x,y,w,h);
      else{c.fillStyle=y===p.y?'#b8c8b6':'#4e6474';c.fillRect(x,y,w,h)}
    }
  }
  c.save();c.lineWidth=1;
  const state=g.mothership;if(!state){c.restore();return}
  // Actual active network flags only, never timers inferred from animation.
  for(const device of state.devices??[]){
    if(device.dead||device.active===false||!visible({x:device.x-15,y:device.y,w:30,h:34},b,8))continue;
    const active=!device.disabled&&!device.stopped;
    c.strokeStyle=active?'#a3cebc':'#758b91';c.strokeRect(device.x-13,device.y+4,26,24);
    c.fillStyle=active?'#cbdcc0':'#7e8b91';c.fillRect(device.x-2,device.y+12,4,4);
  }
  if(state.fusionUntil>(g.time??0)){
    c.strokeStyle='#d6b48a';
    for(const p of g.platforms??[]){
      if(p.kind!=='biofield'||p.active===false||!visible(p,b,8))continue;
      for(let x=Math.max(p.x,b.left);x<Math.min(p.x+p.w,b.right);x+=16)line(c,x,p.y-2,x+7,p.y-6);
    }
  }
  c.restore();
}

// Full form matches existing mission adapters. Short form (frame,zoom) is also
// accepted for asset galleries and uses the enemy's immutable world anchors.
export function drawMothershipEnemy(c,pack,e,x,y,far,time=Infinity){
  const size=MOTHERSHIP_ACTORS[e.type];if(!size)return false;
  let suppliedFrame;
  if(arguments.length<=5){suppliedFrame=x;far=(y??1)<.5;x=e.x;y=e.y}
  const [w,h]=size,boss=e.type==='commandcore',device=e.type==='commanddevice';
  const phased=e.phaseState==='PHASED'||e.phaseState==='SHIFT'||e.phaseState==='VANISH'||e.phaseState==='OUT';
  const open=boss&&!e.shielded&&(e.weakOpen!==false&&e.coreOpen!==false);
  const frame=Number.isFinite(suppliedFrame)?Math.max(0,Math.min(7,Math.floor(suppliedFrame))):e.dead?3:e.hitFlash>0?4:boss&&open?((e.hpPhase??e.phase??1)>=3?6:5):phased?7:device&&(e.disabled||e.stopped)?5:e.warningLeft>0?2:Math.floor(e.anim??0)%2;
  const image=pack?.[e.type+(far?'Far':'')]??pack?.[e.type],top=boss?y-24:y;
  c.save();
  if(phased&&!e.dead)c.globalAlpha=.55;
  if(image)c.drawImage(image,frame*w*2,0,w*2,h*2,x-w/2,top,w,h);
  else{
    c.fillStyle=boss?'#7f819a':e.type==='phasestalker'?'#8d829f':'#819ba2';c.fillRect(x-w/2,top,w,h);
    c.strokeStyle='#c9d5bd';c.lineWidth=1;c.strokeRect(x-w/2,top,w,h);
    c.fillStyle='#d7c19c';c.fillRect(x-4,boss?y+28:y+9,8,8);
  }
  c.restore();
  if(boss&&!e.dead){
    c.save();c.lineWidth=1;
    if(e.shielded){c.strokeStyle='#9dccbf';c.strokeRect(x-28,y+5,56,54)}
    else{c.strokeStyle='#ebd5a6';c.strokeRect(x-19,y+13,38,38)}
    if((e.hpPhase??e.phase??1)>=3){
      c.strokeStyle='#1a2738';c.lineWidth=2;
      for(const side of [-1,1]){line(c,x+side*42,y-7,x+side*33,y+7);line(c,x+side*33,y+7,x+side*40,y+19)}
    }
    c.restore();
  }
  return true;
}

export function drawMothershipWarnings(c,g,b){
  const state=g.mothership;if(!state)return;
  c.save();c.lineWidth=1;c.font='7px monospace';let markers=0,links=0;
  for(const e of g.enemies??[]){
    if(e.dead||!visible({x:e.x-(e.w??24)/2,y:e.y,w:e.w??24,h:e.h??24},b,100))continue;
    if(e.linkedCommander&&links++<12){
      c.strokeStyle='#8fb6b1';c.strokeRect(e.x-4,e.y-7,8,5);
      c.fillStyle='#c4d5bb';c.fillRect(e.x-1,e.y-5,2,2);
    }
    if(e.type==='phasestalker'&&e.phaseState==='SHIFT'&&Number.isFinite(e.targetX)&&markers++<16){
      c.strokeStyle='#b9b0cf';line(c,e.targetX-9,e.y+(e.h??32),e.targetX+9,e.y+(e.h??32));
      line(c,e.targetX-7,e.y+(e.h??32)-4,e.targetX-9,e.y+(e.h??32));
      line(c,e.targetX+7,e.y+(e.h??32)-4,e.targetX+9,e.y+(e.h??32));
    }
    if(!(e.warningLeft>0))continue;
    c.strokeStyle='#e7c08b';c.fillStyle='#b97b6e30';
    if(e.attackPlan){
      for(const z of e.attackPlan.zones??[]){
        if(!visible({x:z.x-z.w/2,y:z.y,w:z.w,h:z.h},b,8))continue;
        c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);
        c.fillStyle='#f1d49f';c.fillText('!',z.x-2,Math.max(14,z.y-3));c.fillStyle='#b97b6e30';
      }
    }else{
      if(Number.isFinite(e.warnX)&&Number.isFinite(e.warnY)){
        line(c,e.x,e.y+(e.h??24)/2,e.warnX,e.warnY);c.strokeRect(e.warnX-5,e.warnY-5,10,10);
      }
      c.fillStyle='#f0d09a';c.fillText('!',e.x-2,e.y-5);
    }
  }
  // Network gun telegraph uses exactly the rectangle later promoted to a hazard.
  if(state.networkPlan){const z=state.networkPlan.zone;c.fillStyle='#b97b6e30';c.strokeStyle='#e7c08b';c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h)}
  if(!g.bossStarted&&g.area===3&&state.network?.shield)for(const z of state.fields??[]){c.fillStyle='#9dcdbc55';c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeStyle='#bddcc0';c.strokeRect(z.x-z.w/2,z.y,z.w,z.h)}
  for(const link of state.links??[]){if(link.from.dead||link.target.dead)continue;c.strokeStyle='#92b7b080';line(c,link.from.x,link.from.y+12,link.target.x,link.target.y+8)}
  for(const link of state.mobileView?.mobile?.repairs??[]){if(link.from.dead||link.target.dead)continue;c.strokeStyle='#c8d59a';line(c,link.from.x,link.from.y+12,link.target.x,link.target.y+8)}
  let shields=0;for(const e of g.enemies??[]){if(shields>=12)break;if(e.dead||e.fixedDevice||e.type==='commandcore'||!visible(e,b))continue;if(!(state.skyView?.sky?.shieldSources??[]).some(s=>s!==e&&!s.dead&&Math.hypot(s.x-e.x,s.y-e.y)<(state.shieldRange??120)))continue;c.strokeStyle='#9bc5c1';c.strokeRect(e.x-5,e.y-6,10,5);shields++}
  c.fillStyle='#dda17982';c.strokeStyle='#e9c58e';
  for(const z of state.hazards??[]){
    if(z.life<=0||!visible({x:z.x-z.w/2,y:z.y,w:z.w,h:z.h},b,8))continue;
    c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);
  }
  c.restore();
}

export function drawMothershipFX(c,pack,f,t){
  const aliases={mothershipCommand:'mothershipCommand',mothershipShield:'mothershipShield',mothershipShieldOff:'mothershipShield',mothershipPhase:'mothershipPhase',mothershipStrike:'mothershipStrike',mothershipBreak:'mothershipBreak',mothershipCollapse:'mothershipBreak',mothershipSignal:'mothershipSignal'};
  const key=aliases[f.kind];if(!key)return false;
  const progress=Number.isFinite(t)?t:Math.max(0,Math.min(1,1-(f.life??0)/(f.maxLife??f.duration??1)));
  const image=pack?.[key],size=f.kind==='mothershipCollapse'?70:f.kind==='mothershipBreak'?48:32;
  c.save();c.globalAlpha=Math.max(0,1-progress*.85);
  if(image)c.drawImage(image,Math.min(7,Math.floor(Math.max(0,progress)*8))*64,0,64,64,f.x-size/2,f.y-size/2,size,size);
  else{c.fillStyle=key==='mothershipShield'||key==='mothershipSignal'?'#a9d8bd':'#dfbd8f';c.fillRect(f.x-4,f.y-4,8,8)}
  c.restore();return true;
}
