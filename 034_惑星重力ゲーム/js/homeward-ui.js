import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
import {homewardDistance,sectorUnlocked} from './homeward-progress.js';
export function createHomewardUI({progress,onEnter,onOpen=()=>{},onChange=()=>{}}){
 const $=s=>document.querySelector(s),dialog=$('#homewardDialog');let pending=null;
 function show(view){for(const id of ['intro','map','event'])$('#homeward-'+id).hidden=id!==view;if(!dialog.open){onOpen();dialog.showModal();}}
 function render(){
  const state=progress.state,d=homewardDistance(state);
  $('#homewardDistance').textContent=`地球まで推定 ${d.remaining.toLocaleString('ja-JP')} 航路単位 · 帰還 ${d.percent.toFixed(1)}%`;
  $('#homewardMeter').value=d.percent;$('#homewardSaveNotice').textContent=progress.notice;
  const list=$('#homewardSectorList');list.replaceChildren();
  for(const sector of HOMEWARD_SECTORS){
   const cleared=state.cleared.includes(sector.id),unlocked=sectorUnlocked(state,sector.id),current=state.currentSector===sector.id;
   const button=document.createElement('button');button.type='button';button.disabled=!unlocked;button.dataset.sector=sector.id;
   button.textContent=`${current?'現在地 · ':''}${cleared?'✓ ':unlocked?'':'🔒 '}${sector.number} ${sector.name} — ${cleared?'再航行':unlocked?'航行する':'未到達'}`;
   if(current)button.setAttribute('aria-current','location');
   button.addEventListener('click',()=>onEnter(sector.id));list.append(button);
   const node=$('#homewardNode'+sector.number);node.classList.toggle('current',current);node.classList.toggle('visited',cleared);node.classList.toggle('locked',!unlocked);
  }
  $('#homewardMapLog').textContent=state.cleared.length?getHomewardDefinition(state.cleared.at(-1))?.arrival??'':'帰還航路は、最初のセクターから始まる。';
  $('#homewardRouteHint').textContent=getHomewardDefinition(state.currentSector).hint;
  $('#homewardFoundationEnd').hidden=state.cleared.length!==3;
 }
 function open(){render();if(progress.state.openingSeen)show('map');else{$('#homewardOpening').textContent=HOMEWARD.opening;show('intro');}}
 function briefing(id){const s=getHomewardDefinition(id);if(progress.state.eventsSeen.includes(`${id}:enter`)){dialog.close();return;}
  pending=id;$('#homewardEventTitle').textContent=`SECTOR ${s.number} / ${s.name}`;$('#homewardEventText').textContent=s.enter;$('#homewardBriefHint').textContent=s.hint;$('#homewardSaveNotice').textContent=progress.notice;show('event');
 }
 $('#closeHomeward').addEventListener('click',()=>dialog.close());
 $('#homewardStart').addEventListener('click',()=>{progress.start();onChange();onEnter(progress.state.currentSector);});
 $('#homewardContinue').addEventListener('click',()=>{if(pending)progress.markEvent(`${pending}:enter`);onChange();pending=null;dialog.close();});
 return {open,briefing,isOpen:()=>Boolean(dialog.open),close:()=>dialog.close(),render};
}
