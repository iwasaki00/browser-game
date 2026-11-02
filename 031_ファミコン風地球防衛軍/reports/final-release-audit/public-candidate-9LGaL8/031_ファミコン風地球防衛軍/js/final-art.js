import {loadStudyImage} from './art-preview.js?v=0.2.3-C';

// Presentation-only M08 adapter. Source cells are 2x immutable world anchors.
export const FINAL_ACTORS=Object.freeze({overseer:[32,28],biobreaker:[48,42],coreguard:[36,34],overmind1:[176,112],overmind2:[176,112],overmind3:[176,112],defensenode:[28,32]});
export const FINAL_FILES={tiles:['tiles/final-defense.png',256,64]};
for(const name of ['deep','arsenal','network','source','final','earth','escape','silence'])FINAL_FILES[name+'Background']=['backgrounds/'+name+'.png',640,360];
for(const name of ['finalShield','finalBeam','finalPulse','finalSpore','finalTransition','finalCollapse'])FINAL_FILES[name]=['effects/'+name+'.png',512,64];
for(const [kind,[w,h]] of Object.entries(FINAL_ACTORS)){
  FINAL_FILES[kind]=['sprites/'+kind+'.png',w*16,h*2];FINAL_FILES[kind+'Far']=['far/'+kind+'.png',w*16,h*2];
}
export async function loadFinalArt(loader=loadStudyImage){
  return Object.fromEntries(await Promise.all(Object.entries(FINAL_FILES).map(async([key,args])=>{
    try{return [key,await loader(args[0]+'?v=1.0.0',args[1],args[2],'assets/final-defense-01/')]}catch{return [key,null]}
  })));
}
function sceneAt(g){const x=g.player?.x??0;return x<1700?'deep':x<3700?'arsenal':x<5700?'network':x<7700?'source':'final'}
function visible(p,b,pad=0){return !b||p.x+(p.w??0)+pad>=b.left&&p.x-pad<=b.right&&p.y+(p.h??0)+pad>=b.top&&p.y-pad<=b.bottom}
function line(c,x1,y1,x2,y2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}

export function drawFinalBackdrop(c,pack,g,b){
  c.fillStyle='#182332';c.fillRect(b.left-16,b.top-16,b.right-b.left+32,b.bottom-b.top+32);
  const image=pack?.[sceneAt(g)+'Background'],shift=(g.camera??b.left)*.04,start=Math.floor((b.left-shift)/320)*320+shift;
  for(let x=start-320;x<b.right+320;x+=320){
    if(image)c.drawImage(image,0,0,640,360,x,0,320,180);
    else{c.fillStyle='#29384a';c.fillRect(x,0,320,162);c.strokeStyle='#526574';c.lineWidth=4;for(let n=0;n<4;n++)line(c,x+n*96+7,0,x+n*96+30,162)}
  }
}

export function drawFinalWorld(c,pack,g,b){
  for(const p of g.platforms??[]){
    if(p.active===false||!visible(p,b,16))continue;
    const edge=Math.min(p.x+p.w,b.right+16),bottom=Math.min(p.y+p.h,b.bottom+16),first=p.x+Math.max(0,Math.floor((b.left-16-p.x)/16))*16;
    for(let x=first;x<edge;x+=16)for(let y=p.y;y<bottom;y+=16){
      const w=Math.min(16,p.x+p.w-x),h=Math.min(16,p.y+p.h-y),tile=p.kind==='ceiling'?1:p.kind==='container'?2:p.kind==='gate'?3:p.kind==='biofield'?4:y===p.y?0:5;
      if(pack?.tiles)c.drawImage(pack.tiles,tile*32,0,w*2,h*2,x,y,w,h);else{c.fillStyle=y===p.y?'#bdcbb7':'#526574';c.fillRect(x,y,w,h)}
    }
  }
  const state=g.finalDefense;if(!state)return;c.save();c.lineWidth=1;
  for(const e of state.devices??[]){
    if(e.dead||e.active===false||!visible({x:e.x-15,y:e.y,w:30,h:34},b,8))continue;
    c.strokeStyle=e.disabled?'#758b91':'#bad0b9';c.strokeRect(e.x-13,e.y+4,26,24);
  }
  c.restore();
}

export function drawFinalEnemy(c,pack,e,x,y,far,time=Infinity){
  const boss=e.type==='overmind',kind=boss?'overmind'+Math.max(1,Math.min(3,e.form??e.hpPhase??e.phase??1)):e.type;
  const size=FINAL_ACTORS[kind];if(!size)return false;
  let suppliedFrame;if(arguments.length<=5){suppliedFrame=x;far=(y??1)<.5;x=e.x;y=e.y}
  const [w,h]=size,open=boss&&!e.shielded&&(e.weakOpen!==false&&e.coreOpen!==false);
  const frame=Number.isFinite(suppliedFrame)?Math.max(0,Math.min(7,Math.floor(suppliedFrame))):e.dead?3:e.hitFlash>0?4:e.transitionLeft>0?7:e.guardState==='GUARD'?2:e.guardState==='OPEN'?5:boss&&open?(e.hp<e.maxHp*.3?6:5):e.warningLeft>0?2:Math.floor(e.anim??0)%2;
  const image=pack?.[kind+(far?'Far':'')]??pack?.[kind],top=boss?y-24:y;c.save();
  if(image)c.drawImage(image,frame*w*2,0,w*2,h*2,x-w/2,top,w,h);
  else{c.fillStyle=boss?'#93869c':'#8e9e9b';c.fillRect(x-w/2,top,w,h);c.strokeStyle='#d2d9bc';c.lineWidth=1;c.strokeRect(x-w/2,top,w,h);c.fillStyle='#e2bd91';c.fillRect(x-4,boss?y+28:y+9,8,8)}
  if(e.type==='coreguard'&&!e.dead){c.strokeStyle=e.guardState==='GUARD'?'#a8d5d1':'#e6c393';c.strokeRect(x-10,y+8,20,19);c.fillStyle=c.strokeStyle;c.font='6px monospace';c.fillText(e.guardState==='GUARD'?'GUARD':'OPEN',x-12,y-4)}
  if(boss&&!e.dead){
    c.strokeStyle=e.shielded?'#9dccbf':'#eed4a0';c.lineWidth=1;
    if(e.shieldWarning){c.fillStyle='#d7c69a';c.fillRect(x-18,y-6,36,2)}
    if(e.shielded)c.strokeRect(x-28,y+5,56,54);else c.strokeRect(x-19,y+13,38,38);
    if(e.transitionLeft>0){c.strokeStyle='#d2d9bc';for(const side of [-1,1])line(c,x+side*45,y+13,x+side*61,y+48)}
  }
  c.restore();return true;
}

export function drawFinalWarnings(c,g,b){
  const state=g.finalDefense;if(!state)return;c.save();c.lineWidth=1;c.font='7px monospace';let count=0;
  for(const e of g.enemies??[]){
    if(e.dead||!visible({x:e.x-(e.w??24)/2,y:e.y,w:e.w??24,h:e.h??24},b,100))continue;
    if((e.linkedOverseer||e.linkedCommander)&&count++<12){c.strokeStyle='#b0cbbd';c.strokeRect(e.x-4,e.y-7,8,5)}
    if(!(e.warningLeft>0))continue;c.strokeStyle='#e8c08b';c.fillStyle='#b97b6e30';
    if(e.attackPlan){for(const z of e.attackPlan.zones??[]){if(!visible({x:z.x-z.w/2,y:z.y,w:z.w,h:z.h},b,8))continue;c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h);c.fillStyle='#f1d49f';c.fillText('!',z.x-2,Math.max(14,z.y-3));c.fillStyle='#b97b6e30'}}
    else{c.fillStyle='#efd19e';c.fillText('!',e.x-2,e.y-5);if(Number.isFinite(e.warnX)&&Number.isFinite(e.warnY)){line(c,e.x,e.y+12,e.warnX,e.warnY);c.strokeRect(e.warnX-5,e.warnY-5,10,10)}}
  }
  for(const link of state.ai?.mothership?.links??state.links??[]){if(link.from.dead||link.target.dead)continue;c.strokeStyle='#9dbeb480';line(c,link.from.x,link.from.y+12,link.target.x,link.target.y+8)}
  if(state.networkPlan){const z=state.networkPlan.zone;c.fillStyle='#b97b6e30';c.strokeStyle='#e8c08b';c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h)}
  for(const link of state.ai?.mothership?.mobileView?.mobile?.repairs??[]){if(link.from.dead||link.target.dead)continue;c.strokeStyle='#c7d49c';line(c,link.from.x,link.from.y+12,link.target.x,link.target.y+8)}
  for(const z of state.hazards??[]){if(z.life<=0||!visible({x:z.x-z.w/2,y:z.y,w:z.w,h:z.h},b,8))continue;c.fillStyle='#dda17982';c.strokeStyle='#e9c58e';c.fillRect(z.x-z.w/2,z.y,z.w,z.h);c.strokeRect(z.x-z.w/2,z.y,z.w,z.h)}
  c.restore();
}

export function drawFinalFX(c,pack,f,t){
  const aliases={finalShield:'finalShield',finalBeam:'finalBeam',finalPulse:'finalPulse',finalSpore:'finalSpore',finalTransition:'finalTransition',finalCollapse:'finalCollapse',finalShieldOff:'finalShield',finalBreak:'finalCollapse'};
  const key=aliases[f.kind];if(!key)return false;
  const progress=Number.isFinite(t)?Math.max(0,Math.min(1,t)):Math.max(0,Math.min(1,1-(f.life??0)/(f.maxLife??f.duration??1))),size=f.kind==='finalCollapse'?76:f.kind==='finalBeam'?42:36;
  c.save();c.globalAlpha=Math.max(0,1-progress*.85);const image=pack?.[key];
  if(image)c.drawImage(image,Math.min(7,Math.floor(progress*8))*64,0,64,64,f.x-size/2,f.y-size/2,size,size);
  else{c.fillStyle=key==='finalShield'?'#a8c8b8':'#e2bd91';c.fillRect(f.x-4,f.y-4,8,8)}
  c.restore();return true;
}
