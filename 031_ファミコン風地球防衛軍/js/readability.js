// Screen-legible accents only. No collision, damage, RNG, timers or save writes.
export const READABILITY=Object.freeze({invulnerableAlpha:.7,crowdEnemies:50,crowdEffects:48,decorDraws:16,particleDraws:48,dangerAccents:24});
export const playerOpacity=p=>p.invuln>0&&!(p.hitPose>0)?(Math.floor(p.invuln*12)%2?READABILITY.invulnerableAlpha:1):1;
const colors={RANGER:'#a3e5cf',SCOUT:'#e9d59c',GUARDIAN:'#b9cde4',WING:'#bce5ec'};
export function drawPlayerLocator(c,p,zoom){
 if(p.dead)return;const u=1/zoom,x=p.x,y=p.y+32,head=p.y-3*u;
 c.save();c.globalAlpha=1;c.lineWidth=u;c.strokeStyle='#031017';
 if(p.onGround){c.fillStyle='#020a11aa';c.fillRect(x-8,y,16,2*u)}
 c.beginPath();c.moveTo(x-7*u,y);c.lineTo(x-7*u,y+2*u);c.lineTo(x-3*u,y+2*u);c.moveTo(x+7*u,y);c.lineTo(x+7*u,y+2*u);c.lineTo(x+3*u,y+2*u);c.stroke();
 c.fillStyle=p.hitPose>0?'#fff1c4':colors[p.classId]??colors.RANGER;
 c.fillRect(x-6*u,y+u,3*u,u);c.fillRect(x+3*u,y+u,3*u,u);
 // Four compact, class-specific head marks; never a full-body glow or box.
 if(p.classId==='WING'){c.fillRect(x-5*u,head,u,2*u);c.fillRect(x+4*u,head,u,2*u)}
 else if(p.classId==='GUARDIAN'){c.fillRect(x-2*u,head,4*u,u);c.fillRect(x-u,head+u,2*u,u)}
 else if(p.classId==='SCOUT'){c.fillRect(x-2*u,head,2*u,u);c.fillRect(x+u,head,2*u,u)}
 else c.fillRect(x-u,head,2*u,u);
 c.restore();
}
export function drawEnemyShotAccent(c,s,zoom){
 if((s.w??6)>16||(s.h??6)>16)return;
 const u=1/zoom,r=Math.max((s.w??6)/2,2*u),x=Math.round(s.x),y=Math.round(s.y),speed=Math.hypot(s.vx||0,s.vy||0)||1;
 c.save();c.globalAlpha=1;c.strokeStyle='#041018';c.lineWidth=3*u;c.beginPath();c.moveTo(x-r,y);c.lineTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.closePath();c.stroke();c.strokeStyle='#ffc590';c.lineWidth=u;c.stroke();
 c.strokeStyle='#e9a778';c.beginPath();c.moveTo(x,y);c.lineTo(x-(s.vx||0)/speed*5*u,y-(s.vy||0)/speed*5*u);c.stroke();c.fillStyle='#fff2d0';c.fillRect(x-u/2,y-u/2,u,u);c.restore();
}
export function drawDangerRect(c,z,b,zoom,active=false){
 if(!Number.isFinite(z.x+z.y+z.w+z.h)||z.w<=0||z.h<=0||z.x+z.w/2<b.left||z.x-z.w/2>b.right||z.y+z.h<b.top||z.y>b.bottom)return false;
 const u=1/zoom,left=z.x-z.w/2;c.save();c.globalAlpha=1;c.strokeStyle='#031018';c.lineWidth=3*u;c.strokeRect(left,z.y,z.w,z.h);c.strokeStyle=active?'#ffab86':'#f5d7a0';c.lineWidth=u;c.strokeRect(left,z.y,z.w,z.h);
 c.fillStyle=active?'#ffab86':'#f5d7a0';c.fillRect(left,z.y,Math.min(z.w,4*u),u);c.fillRect(left,z.y,u,Math.min(z.h,4*u));c.fillRect(left+z.w-u,z.y+z.h-Math.min(z.h,4*u),u,Math.min(z.h,4*u));c.restore();return true;
}
export function drawDangerAccents(c,g,b,zoom){
 let count=0;const mark=(z,active=false)=>{if(count<READABILITY.dangerAccents&&drawDangerRect(c,z,b,zoom,active))count++};
 for(const e of g.enemies)if(!e.dead&&e.warningLeft>0)for(const z of e.attackPlan?.zones??[])mark(z);
 const stage=g.finalDefense??g.mothership??g.living??g.mobile??g.sky??g.coast;
 if(stage?.networkPlan?.zone)mark(stage.networkPlan.zone);
 for(const z of stage?.hazards??[])if(z.life>0)mark(z,true);
 for(const p of g.living?.pulses??[])if(['WARNING','CLOSING'].includes(String(p.state).toUpperCase()))mark({x:p.x+(p.w??24)/2,y:p.y??36,w:p.w??24,h:p.h??112});
 return count;
}
export const crowdedVisuals=g=>g.liveEnemies>=READABILITY.crowdEnemies||g.effects.length>=READABILITY.crowdEffects||g.impact.corpses>=32;
