import {MISSIONS,clamp} from './data.js?v=0.3.2';

export function outcomeData(g){
  return {missionId:g.missionId,missionName:MISSIONS.find(m=>m.id===g.missionId)?.name??g.missionId,
    classId:g.lab?.preset??g.player.classId,area:Math.max(1,(g.area??0)+1),areaName:g.areas?.[Math.max(0,g.area)]?.name??'記録なし',
    time:g.time,score:g.score,kills:g.kills,qa:!!g.lab,coverage:g.lab?.run?.checkpoint.areaIndex>0?'途中開始':'開始地点から',normalSaved:!g.lab};
}
export function combatHudText(g,equipped){const p=g.player;return `${g.missionId} AREA${Math.max(1,g.area+1)} / ${p.classId} / HP ${Math.ceil(p.hp)}/${p.maxHp}${p.classId==='WING'?` / EN ${Math.ceil(p.energy)}/100`:''} / SLOT1 ${equipped[0]} / SLOT2 ${equipped[1]} / 選択${p.weaponSlot+1} / 敵${g.liveEnemies}`}
export function drawCombatHud(c,g,equipped,weapon,icon,timeLabel){
  const p=g.player,selected=p.weaponSlot;c.save();c.font='bold 7px monospace';c.textAlign='left';
  c.fillStyle='#04101de8';c.fillRect(4,4,111,32);c.fillRect(119,4,197,32);
  c.fillStyle='#e4fff6';c.fillText(p.classId,8,12);c.textAlign='right';c.fillText(`${Math.ceil(p.hp)}/${p.maxHp}`,110,12);c.textAlign='left';
  c.fillStyle='#442335';c.fillRect(8,16,103,5);c.fillStyle=p.hp/p.maxHp<.25?'#ff6b7e':'#55e3ca';c.fillRect(8,16,103*clamp(p.hp/p.maxHp,0,1),5);
  c.font='6px monospace';c.fillStyle='#a5c0c5';c.fillText('HP',8,29);
  if(p.classId==='WING'){c.fillText(`EN ${Math.ceil(p.energy)}/100`,25,30);c.fillStyle='#42616d';c.fillRect(69,25,41,4);c.fillStyle='#8dcaff';c.fillRect(69,25,41*p.energy/100,4)}
  else if(p.classId==='SCOUT')c.fillText(p.dashCd>0?`DASH ${p.dashCd.toFixed(1)}s`:'DASH READY',25,29);
  else c.fillText(g.lab?'QA / NO SAVE':'DEFENSE FRONT',25,29);
  c.font='7px monospace';c.fillStyle='#e4fff6';c.fillText(`${g.missionId} A${String(Math.max(1,g.area+1)).padStart(2,'0')}`,123,12);c.fillText(`敵 ${String(Math.min(999,g.liveEnemies)).padStart(3,'0')}`,210,12);c.textAlign='right';c.fillText(timeLabel,312,12);c.textAlign='left';
  for(let slot=0;slot<2;slot++){const w=weapon(equipped[slot]),x=123+slot*96;c.fillStyle=slot===selected?'#36513f':'#102432';c.fillRect(x,17,93,15);c.fillStyle=slot===selected?'#ffe58e':'#b2c6ca';if(slot===selected)c.fillRect(x,31,93,1);icon(w,x+1,18,12);c.font='6px monospace';c.fillText(`${slot+1} ${w.id}`,x+15,23);c.fillText(w.name.slice(0,8),x+15,30)}
  c.restore();
}
export function drawBossHud(c,boss,core){
  if(!boss)return;const id=boss.type==='boss'?'B-01':boss.type==='queen'?'B-02':boss.type==='fortress'?'B-04 P'+boss.skyPhase:boss.type==='reactor'?'B-05 P'+boss.mobilePhase:boss.type==='overmind'?'B-08 FORM '+boss.form:boss.type==='commandcore'?'B-07 P'+boss.hpPhase:boss.type==='neuralheart'?'B-06 P'+boss.hpPhase:'B-03';c.save();c.fillStyle='#071322e8';c.fillRect(119,39,197,17);c.font='7px monospace';c.fillStyle='#f0e2bb';c.fillText(`${id} ${core?(core.open?'CORE OPEN':'CORE CLOSED'):'ARMOR'}`,123,46);c.textAlign='right';c.fillText(`${Math.ceil(Math.max(0,boss.hp))}/${boss.maxHp}`,312,46);c.fillStyle='#3b2334';c.fillRect(123,49,189,4);c.fillStyle=core?.open?'#ffb37c':'#ee6e8e';c.fillRect(123,49,189*clamp(boss.hp/boss.maxHp,0,1),4);c.restore();
}
export function drawCoreMarker(c,point,core,zoom,flash=0){
  if(point.x<8||point.x>312||point.y<40||point.y>170)return;const r=clamp(core.r*zoom,7,18),x=Math.round(point.x),y=Math.round(point.y);c.save();c.lineWidth=1;c.strokeStyle=flash>0?'#fff8d3':core.open?'#ffd37e':'#8498a6';c.globalAlpha=core.open?1:.65;
  for(const sx of [-1,1])for(const sy of [-1,1]){c.beginPath();c.moveTo(x+sx*(r-4),y+sy*r);c.lineTo(x+sx*r,y+sy*r);c.lineTo(x+sx*r,y+sy*(r-4));c.stroke()}
  if(core.open){c.fillStyle='#ffd37e';c.fillRect(x-2,y-r-4,5,2)}c.restore();
}
