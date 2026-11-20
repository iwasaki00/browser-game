import type {State} from './engine';
import {treasure} from './data';
import {treasureShape,treasureSilhouette} from './reveal';
import {COLLECTION_THEMES,themeProgress} from './collection-themes';

export function mountCollectionThemes(host:HTMLElement,s:State,detail:(id:string)=>void){
 const box=document.createElement('details');box.id='collection-themes';
 box.innerHTML='<summary>テーマ収集</summary><p>洗浄後、図鑑に正式登録された種類を数えます。閲覧だけでは増えません。</p>';
 for(const theme of COLLECTION_THEMES){
  const p=themeProgress(s,theme),section=document.createElement('details');section.dataset.theme=theme.id;
  section.innerHTML=`<summary>${theme.title} <span data-theme-progress="${theme.id}">${p.found} / ${p.total}${p.complete?' — 完成':''}</span></summary><div class="theme-items">${theme.ids.map(id=>{
   const known=!!s.discoveredTreasures[id],t=treasure(id);
   return `<article class="theme-item"><div class="item-icon">${known?treasureShape(id):treasureSilhouette()}</div><div>${known?`<strong>${t.name}</strong><br><button data-theme-detail="${id}">詳細</button>`:'<strong>？？？</strong><p>未発見</p>'}</div></article>`;
  }).join('')}</div>`;
  box.append(section);
 }
 host.querySelector('.book-filters')!.before(box);
 box.querySelectorAll<HTMLButtonElement>('[data-theme-detail]').forEach(b=>b.onclick=()=>detail(b.dataset.themeDetail!));
}
