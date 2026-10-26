import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
import {homewardDistance,sectorUnlocked} from './homeward-progress.js';
export function createHomewardUI({progress,onEnter,onOpen=()=>{},onChange=()=>{},onRecord=()=>{}}){
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
   const node=$('#homewardNode'+sector.number);if(node){node.classList.toggle('current',current);node.classList.toggle('visited',cleared);node.classList.toggle('locked',!unlocked);}
  }
  $('#homewardMapLog').textContent=state.cleared.length?getHomewardDefinition(state.cleared.at(-1))?.arrival??'':'帰還航路は、最初のセクターから始まる。';
  $('#homewardRouteHint').textContent=getHomewardDefinition(state.currentSector).hint;
  $('#homewardFoundationEnd').hidden=state.cleared.length!==HOMEWARD_SECTORS.length;
  choices($('#homewardMapChoices'),state.currentSector);
  const journal=$('#homewardJournal');journal.replaceChildren();
  for(const sector of HOMEWARD_SECTORS){
   const entry=state.journal?.[sector.id];if(!entry&&!state.cleared.includes(sector.id))continue;
   const item=document.createElement('article'),title=document.createElement('h4');title.textContent=`${sector.number} ${sector.name}${state.cleared.includes(sector.id)?' · 通過済み':''}`;item.append(title);
   for(const text of entry?[entry.departure,entry.encounter,entry.discovery,entry.choiceLog,entry.arrival]:[sector.arrival])if(typeof text==='string'){const p=document.createElement('p');p.textContent=text;item.append(p);}
   if(Array.isArray(entry?.choiceHistory)&&entry.choiceHistory.length>1){const p=document.createElement('p');p.textContent='選択履歴：'+entry.choiceHistory.map(e=>e?.choice==='pursue'?'追跡':'回避').join(' → ');item.append(p);}
   const refs=[['到着の航行をCINEMATIC再生',entry?.clearFlightId],['保存済みの直近航行をCINEMATIC再生',entry?.flightId]];
   const used=new Set();for(const [label,id]of refs)if(typeof id==='string'&&!used.has(id)){used.add(id);const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>onRecord(id));item.append(button);}
   journal.append(item);
  }
 }
 function choices(container,id){
  container.replaceChildren();const definition=getHomewardDefinition(id);container.hidden=!definition?.choices;
  for(const option of definition?.choices??[]){
   const button=document.createElement('button');button.type='button';button.dataset.choice=option.id;
   button.textContent=`${option.label}${option.detour?`（寄り道 +${option.detour}）`:''}`;button.setAttribute('aria-pressed',String(progress.state.choices[id]===option.id));
   button.addEventListener('click',()=>{progress.choose(id,option.id);onChange();render();choices($('#homewardEventChoices'),id);$('#homewardBriefHint').textContent=option.hint;$('#homewardContinue').disabled=false;});container.append(button);
  }
 }
 function open(){render();if(progress.state.openingSeen)show('map');else{$('#homewardOpening').textContent=HOMEWARD.opening;show('intro');}}
 function briefing(id){const s=getHomewardDefinition(id);if(!s.choices&&progress.state.eventsSeen.includes(`${id}:enter`)){dialog.close();return;}
  pending=id;$('#homewardEventTitle').textContent=`SECTOR ${s.number} / ${s.name}`;$('#homewardEventText').textContent=s.enter;$('#homewardBriefHint').textContent=s.hint;$('#homewardSaveNotice').textContent=progress.notice;show('event');
  choices($('#homewardEventChoices'),id);$('#homewardContinue').disabled=Boolean(s.choices&&!progress.state.choices[id]);
 }
 $('#closeHomeward').addEventListener('click',()=>dialog.close());
 $('#homewardStart').addEventListener('click',()=>{progress.start();onChange();onEnter(progress.state.currentSector);});
 $('#homewardContinue').addEventListener('click',()=>{if(pending)progress.markEvent(`${pending}:enter`);onChange();pending=null;dialog.close();});
 return {open,briefing,isOpen:()=>Boolean(dialog.open),close:()=>dialog.close(),render};
}
