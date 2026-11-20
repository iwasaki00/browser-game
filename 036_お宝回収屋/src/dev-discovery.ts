import {treasure} from './data';
import {COLLECTION_THEMES} from './collection-themes';
import {washCardMarkup} from './reveal';
import {playDiscovery,type DiscoveryOptions} from './discovery-ui';
import type {DiscoveryResult} from './discovery';
export const discoveryPreviews=[
 {key:'common',title:'C 通常品の初発見',id:'B001',first:true},
 {key:'uncommon',title:'U 初発見',id:'B007',first:true},
 {key:'rare',title:'R 初発見',id:'B009',first:true},
 {key:'super-rare',title:'SR 初発見',id:'B011',first:true},
 {key:'jackpot',title:'J 初発見',id:'B012',first:true},
 {key:'theme',title:'テーマ完成',id:'B005',first:true,theme:'beach-forgotten'},
 {key:'combined',title:'探索目標達成＋テーマ完成',id:'R026',first:true,theme:'river-tools',goal:true},
 {key:'repeat-sr',title:'SR 再取得（長い演出なし）',id:'B011',first:false},
 {key:'repeat-j',title:'J 再取得（長い演出なし）',id:'B012',first:false},
] as const;
export function previewDiscovery(key:string):DiscoveryResult{
 const p=discoveryPreviews.find(p=>p.key===key);if(!p)throw Error('演出プレビューを選んでください');
 const theme='theme' in p?COLLECTION_THEMES.find(t=>t.id===p.theme):undefined;
 return {id:p.id,rarity:treasure(p.id).rarity,first:p.first,goal:'goal' in p&&p.goal,themes:theme?[{id:theme.id,title:theme.title,found:theme.ids.length,total:theme.ids.length}]:[]};
}
export function mountDiscoveryPreview(root:HTMLElement,key:string,options:DiscoveryOptions,back:()=>void){
 const result=previewDiscovery(key),t=treasure(result.id);root.innerHTML=washCardMarkup(result.id);
 const card=root.querySelector<HTMLElement>('.wash-card')!;card.dataset.phase='done';card.dataset.rarity=result.rarity;card.dataset.effects=options.effects;
 root.querySelector<HTMLElement>('.wash-display')!.setAttribute('aria-label',t.name);
 root.querySelector('#reveal-name')!.textContent=t.name+' / '+t.rarity;
 root.querySelector('#reveal-description')!.textContent=t.description;
 root.querySelector('#reveal-quality')!.textContent='閲覧専用：図鑑・FN・発見履歴は変更しません';
 root.querySelector('#reveal-reward')!.textContent='報酬処理なし';
 root.querySelector<HTMLElement>('#clean')!.hidden=true;
 const next=root.querySelector<HTMLButtonElement>('#next-find')!;next.hidden=false;next.textContent='再生し直す';
 const close=root.querySelector<HTMLButtonElement>('#skip-clean')!;close.textContent='LABへ戻る';
 let live=true,controller=playDiscovery(card,result,{...options,preview:true});
 next.onclick=()=>{if(live){controller.dispose();controller=playDiscovery(card,result,{...options,preview:true});}};
 close.onclick=()=>{if(live)back();};
 return ()=>{live=false;controller.dispose();};
}
export function mountDiscoveryLab(host:HTMLElement,open:(key:string)=>void){
 const box=document.createElement('details');box.id='lab-discovery-preview';
 box.innerHTML='<summary>発見演出プレビュー（閲覧専用）</summary><p>図鑑登録・FN・発見履歴を変更せず、見た目だけを再生します。実登録の試験は従来の即回収→洗浄を使います。</p><label>演出<select id="lab-discovery-kind">'+discoveryPreviews.map(p=>'<option value="'+p.key+'">'+p.title+'</option>').join('')+'</select></label><button id="lab-discovery-play">演出プレビュー</button>';
 host.prepend(box);box.querySelector<HTMLButtonElement>('#lab-discovery-play')!.onclick=()=>open(box.querySelector<HTMLSelectElement>('#lab-discovery-kind')!.value);
}
