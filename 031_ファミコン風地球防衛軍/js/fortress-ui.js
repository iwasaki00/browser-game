import {clamp} from './data.js?v=0.4.1';
import {worldToScreen} from './camera.js?v=0.4.1';
import {SKY_PHASES,FORTRESS_GUIDANCE as F,skyTargetOpen,skyDeviceState,skyShieldSource,skyPlatformMotion} from './mission04.js?v=0.4.1';

// Screen-space, bounded markers. No combat state, world position or hitbox writes.
export function fortressObjective(g){
  const boss=g.enemies.find(e=>e.type==='fortress'&&!e.dead);
  if(!boss)return null;
  const phase=boss.skyPhase,targets=[];
  if(phase===3)targets.push(boss);
  else for(const p of g.sky.parts)if(!p.dead&&skyTargetOpen(g,p))targets.push(p);
  const generators=g.sky.parts.filter(e=>e.partKind==='generator');
  return {boss,phase,text:SKY_PHASES[phase].text,targets,intro:g.time<g.sky.guideUntil,
    left:generators[0]?skyDeviceState(g,generators[0]):'不明',right:generators[1]?skyDeviceState(g,generators[1]):'不明'};
}
export function fortressMarker(target,g,zoom,offset=0){
  const p=worldToScreen({x:target.x,y:target.y+target.h/2},g.camera,zoom);
  p.x+=offset;p.y+=offset;
  return {x:clamp(p.x,12,308),y:clamp(p.y-18,91,133),direction:p.x<12?-1:p.x>308?1:0,
    label:target.type==='fortress'?'CORE':(target.partKind==='turret'?'T':'S')+(target.x<6650?'-L':'-R')};
}
function shield(c,x,y,color){
  c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x-3,y-3);c.lineTo(x+3,y-3);c.lineTo(x+3,y+1);c.lineTo(x,y+4);c.lineTo(x-3,y+1);c.closePath();c.stroke();
}
export function drawFortressHud(c,g,zoom,offset=0){
  if(!g.sky)return {targets:0,shields:0,sources:0,platforms:0};
  const counts={targets:0,shields:0,sources:0,platforms:0},o=fortressObjective(g);
  c.save();c.textAlign='left';c.lineWidth=1;
  if(o){
    c.fillStyle='#04101df0';c.fillRect(4,39,111,20);c.fillStyle=o.intro?'#ffe1a1':'#c4e0d7';
    c.font='6px monospace';
    if(o.intro){c.fillText(SKY_PHASES[o.phase].lines[0],8,47);c.fillText(SKY_PHASES[o.phase].lines[1],8,55)}
    else{c.fillText('P'+o.phase+' '+SKY_PHASES[o.phase].short,8,47);c.font='5px monospace';c.fillText('装置 左:'+o.left+' 右:'+o.right,8,55)}
    // Persistent left/right status even while the introductory instruction is shown.
    c.font='5px monospace';c.fillStyle='#c4e0d7';c.fillText('L:'+o.left+'  R:'+o.right,123,62);
    for(const target of o.targets){if(counts.targets>=F.targetMarkers)break;
      const m=fortressMarker(target,g,zoom,offset);c.strokeStyle='#ffdf8b';c.fillStyle='#ffdf8b';c.font='6px monospace';
      c.fillText((m.direction<0?'< ':m.direction>0?'> ':'')+m.label,clamp(m.x-8,4,284),m.y-4);
      c.beginPath();c.moveTo(m.x-4,m.y);c.lineTo(m.x,m.y+4);c.lineTo(m.x+4,m.y);c.stroke();counts.targets++;
    }
    if(g.time<(o.boss.shieldedUntil??0)){const m=fortressMarker(o.boss,g,zoom,offset);c.fillStyle='#b8e4e3';c.font='7px monospace';c.fillText('SHIELDED',clamp(m.x-21,8,264),m.y-13)}
  }
  const limit=g.lab&&g.enemyLimit>100?F.reducedShieldMarkers:F.shieldMarkers;
  for(const e of g.enemies){if(e.dead)continue;const p=worldToScreen({x:e.x,y:e.y},g.camera,zoom);
    if(p.x<12||p.x>308||p.y<89||p.y>145)continue;
    if(e.type==='shielddrone'&&counts.sources<F.sourceMarkers){shield(c,p.x,p.y-6,'#fff0b8');c.font='5px monospace';c.fillStyle='#fff0b8';c.fillText('SRC',p.x-5,p.y-13);counts.sources++}
    if(counts.shields<limit&&skyShieldSource(g,e,g.sky.shieldSources)){shield(c,p.x+7,p.y-3,'#95dfc4');counts.shields++}
  }
  for(const b of g.platforms){if(!b.moving)continue;const p=worldToScreen({x:b.x+b.w/2,y:b.y},g.camera,zoom);
    if(p.x<24||p.x>296||p.y<90||p.y>150)continue;
    const m=skyPlatformMotion(b,g.time),turn=m.turnLeft<=F.turnWarning;c.fillStyle=turn?'#ffd18b':'#b9e3d4';c.font='7px monospace';
    c.fillText((m.direction>0?'→':'←')+(turn?' 折返し':''),p.x-(turn?18:4),p.y-7);counts.platforms++;
  }
  if(g.sky.rescuePending){c.font='7px monospace';c.fillStyle='#ffda9e';c.fillText('安全な復帰地点を確認中',90,73)}
  c.restore();return counts;
}
