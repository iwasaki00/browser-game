import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
import {homewardDistance,sectorUnlocked} from './homeward-progress.js';
import {DESTINATIONS,ORIGIN,normalizeVoyage,departurePosition,createOpenVoyage} from './open-voyage.js';
import {VOYAGE_COURSES} from './voyage-courses.js';
export function createHomewardUI({progress,onEnter,onOpen=()=>{},onChange=()=>{},onRecord=()=>{},onDestination=()=>{},getNavigation=()=>({}),canEnter=()=>true}){
 const $=s=>document.querySelector(s),dialog=$('#homewardDialog');let pending=null;
 function show(view){for(const id of ['intro','map','event'])$('#homeward-'+id).hidden=id!==view;if(!dialog.open){onOpen();dialog.showModal();}}
 function render(){
  const state=progress.state,d=homewardDistance(state);
  $('#homewardDistance').textContent=`地球まで推定 ${d.remaining.toLocaleString('ja-JP')} 航路単位 · 帰還 ${d.percent.toFixed(1)}%`;
  $('#homewardMeter').value=d.percent;$('#homewardSaveNotice').textContent=progress.notice;
  const list=$('#homewardSectorList');list.replaceChildren();
  for(const sector of HOMEWARD_SECTORS){
   const cleared=state.cleared.includes(sector.id),unlocked=sectorUnlocked(state,sector.id),current=state.currentSector===sector.id;
   const button=document.createElement('button');button.type='button';button.disabled=!unlocked||!canEnter();button.dataset.sector=sector.id;
   button.textContent=`${current?'現在地 · ':''}${cleared?'✓ ':unlocked?'':'🔒 '}${sector.number} ${sector.name} — ${cleared?'再航行':unlocked?'航行する':'未到達'}`;
   if(current)button.setAttribute('aria-current','location');
   button.addEventListener('click',()=>onEnter(sector.id));list.append(button);
   const node=$('#homewardNode'+sector.number);if(node){node.classList.toggle('current',current);node.classList.toggle('visited',cleared);node.classList.toggle('locked',!unlocked);}
  }
  $('#homewardMapLog').textContent=state.cleared.length?getHomewardDefinition(state.cleared.at(-1))?.arrival??'':'帰還航路は、最初のセクターから始まる。';
  $('#homewardRouteHint').textContent=getHomewardDefinition(state.currentSector).hint;
  $('#homewardFoundationEnd').hidden=state.cleared.length!==HOMEWARD_SECTORS.length;
  choices($('#homewardMapChoices'),state.currentSector);
  renderVoyage();
  const journal=$('#homewardJournal');journal.replaceChildren();
  for(const sector of HOMEWARD_SECTORS){
   const entry=state.journal?.[sector.id];if(!entry&&!state.cleared.includes(sector.id))continue;
   const item=document.createElement('article'),title=document.createElement('h4');title.textContent=`${sector.number} ${sector.name}${state.cleared.includes(sector.id)?' · 通過済み':''}`;item.append(title);
   for(const text of entry?[entry.departure,entry.encounter,entry.discovery,entry.choiceLog,entry.arrival]:[sector.arrival])if(typeof text==='string'){const p=document.createElement('p');p.textContent=text;item.append(p);}
   if(Array.isArray(entry?.choiceHistory)&&entry.choiceHistory.length>1){const p=document.createElement('p');p.textContent='選択履歴：'+entry.choiceHistory.map(e=>e?.choice==='pursue'?'追跡':'回避').join(' → ');item.append(p);}
   if(sector.id==='homeward-09')for(const d of DESTINATIONS){
    if(!state.voyage?.visited?.includes(d.id))continue;
    const p=document.createElement('p');p.textContent=d.log;item.append(p);
    const reference=state.voyage.records?.[d.id];if(typeof reference==='string'){const replay=document.createElement('button');replay.type='button';replay.textContent=`${d.name}の寄港記録をCINEMATIC再生（専用保護）`;replay.addEventListener('click',()=>onRecord(reference));item.append(replay);}
   }
   const refs=[['保護した到着記録をCINEMATIC再生（専用保護）',entry?.importantFlightId],['到着の航行をCINEMATIC再生',entry?.clearFlightId],['保存済みの直近航行をCINEMATIC再生',entry?.flightId]];
   const used=new Set();for(const [label,id]of refs)if(typeof id==='string'&&!used.has(id)){used.add(id);const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>onRecord(id));item.append(button);}
   journal.append(item);
  }
 }
 function renderVoyage(){
  const section=$('#voyageNavigation'),navigation=getNavigation();section.hidden=progress.state.currentSector!=='homeward-09'||navigation.active===false;if(section.hidden)return;
  const v=normalizeVoyage(progress.state.voyage),position=navigation.position??departurePosition(v),stage=createOpenVoyage(v);
  $('#voyageCheckpoint').textContent=`${navigation.flying?'航行中':`寄港地：${DESTINATIONS.find(d=>d.id===v.checkpoint)?.name??ORIGIN.name}`} ／ 選択中：${DESTINATIONS.find(d=>d.id===v.selected).name}`;
  const svg=$('#voyageMap');svg.replaceChildren();
  const node=(tag,attrs,text)=>{const element=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))element.setAttribute(key,value);if(text)element.textContent=text;svg.append(element);return element;};
  node('rect',{width:3750,height:5000,fill:'#071422'});
  for(const p of stage.planets)node('circle',{cx:p.x,cy:p.y,r:Math.max(55,p.radius),fill:p.color});
  for(const d of DESTINATIONS){
   if(v.rewards.includes('route-charts'))node('line',{x1:position.x,y1:position.y,x2:d.x,y2:d.y,stroke:'#426c85','stroke-width':10,'stroke-dasharray':'40 40'});
   node('circle',{cx:d.x,cy:d.y,r:d.id===v.selected?110:75,fill:v.visited.includes(d.id)?d.color:'#183044',stroke:d.color,'stroke-width':d.id===v.selected?30:14});
   node('text',{x:d.x,y:d.y-160,fill:d.color,'font-size':160,'text-anchor':d.x>1875?'end':'start'},`${v.visited.includes(d.id)?'✓ ':''}${d.name}`);
  }
  node('circle',{cx:position.x,cy:position.y,r:65,fill:'#ffffff'});node('text',{x:Math.min(3100,position.x+100),y:position.y+200,fill:'#ffffff','font-size':160},'現在地');
  const list=$('#voyageDestinations');list.replaceChildren();
  for(const d of DESTINATIONS){const button=document.createElement('button');button.type='button';button.dataset.destination=d.id;button.setAttribute('aria-pressed',String(d.id===v.selected));button.textContent=`${d.name} · ${v.visited.includes(d.id)?'探索済み':'未探索・信号のみ'} · ${Math.round(Math.hypot(d.x-position.x,d.y-position.y)).toLocaleString()}単位`;button.disabled=!navigation.flying&&v.checkpoint===d.id;
   button.addEventListener('click',()=>{onDestination(d.id);render();});list.append(button);
  }
  const course=VOYAGE_COURSES[v.checkpoint+'>'+v.selected];
  $('#voyageCourse').textContent=v.rewards.includes('route-charts')&&course&&!navigation.flying?`解読した参考航路：ANGLE ${course[0]}° / THRUST ${course[1]}（初期惑星配置・発射地点用。予測で再確認）`:'目的地を選び、閉じると航行へ戻ります。救難信号の調査で参考航路を表示できます。';
  $('#voyageDiscoveries').textContent=v.discoveries.length?v.discoveries.join(' ／ '):'詳細は未発見。寄り道せず帰還ゲートへ直行することもできます。';
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
