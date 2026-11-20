import type {State} from './engine';
import {treasure} from './data';
import {treasureShape,treasureSilhouette} from './reveal';
import {COLLECTION_THEMES,themeProgress} from './collection-themes';
import {explorationHeading,explorationHint,setExplorationGoal} from './exploration-goals';

export function mountCollectionThemes(host:HTMLElement,s:State,detail:(id:string)=>void,changed:()=>void=()=>{}){
 const box=document.createElement('details');box.id='collection-themes';
 host.querySelector('.book-filters')!.before(box);
 const render=()=>{
 const opened=new Set(Array.from(box.querySelectorAll<HTMLDetailsElement>('details[open]')).map(e=>e.dataset.theme??e.dataset.themeHint));
 const active=s.explorationGoal?.target;
 box.innerHTML='<summary>テーマ収集</summary><p>洗浄後、図鑑に正式登録された種類を数えます。閲覧だけでは増えません。</p><button id="theme-goal-clear" '+(!active?'disabled':'')+'>探索目標を解除</button>';
 for(const theme of COLLECTION_THEMES){
  const p=themeProgress(s,theme),section=document.createElement('details');section.dataset.theme=theme.id;section.open=opened.has(theme.id);
  section.innerHTML=`<summary>${theme.title} <span data-theme-progress="${theme.id}">${p.found} / ${p.total}${p.complete?' — 完成':''}</span></summary><div class="theme-items">${theme.ids.map(id=>{
   const known=!!s.discoveredTreasures[id],t=treasure(id),h=explorationHint(s,id);
   return `<article class="theme-item" data-theme-item="${id}"><div class="item-icon">${known?treasureShape(id):treasureSilhouette()}</div><div>${known?`<strong>${t.name}</strong><br><button data-theme-detail="${id}">詳細</button>`:`<strong>${explorationHeading(s,id)}</strong><p>未発見 ${active===id?'<b class="theme-searching">探索中</b>':''}</p><details data-theme-hint="${id}" ${opened.has(id)?'open':''}><summary>探索ヒント</summary><p>推奨：${h.location} / ${h.place}（${h.status}）</p><p>${h.required}</p><p>${h.recommended}</p></details><button data-theme-target="${id}" ${active===id?'disabled':''}>${active===id?'探索中':'探索目標にする'}</button>`}</div></article>`;
  }).join('')}</div>`;
  box.append(section);
 }
 box.querySelectorAll<HTMLButtonElement>('[data-theme-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.themeDetail!));
 box.querySelectorAll<HTMLButtonElement>('[data-theme-target]').forEach(b=>b.onclick=()=>{const id=b.dataset.themeTarget!;if(setExplorationGoal(s,id)){changed();render();const hint=box.querySelector<HTMLDetailsElement>('[data-theme-hint="'+id+'"]');if(hint)hint.open=true;}});
 box.querySelector<HTMLButtonElement>('#theme-goal-clear')!.onclick=()=>{setExplorationGoal(s,null);changed();render();};
 };render();return render;
}
