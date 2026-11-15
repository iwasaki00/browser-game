import {mountCollection} from './collection';
import {treasures,treasure,CONFIG} from './data';
import {stored,type State} from './engine';
import {spawn} from './dev-actions';
export function instantRecovery(s:State,id:string){
 if(!treasure(id))throw Error('お宝IDを確認してください');
 if(stored(s).length>=CONFIG.capacity)throw Error('洗浄待ちが満杯です。先に洗浄してください');
 const f=spawn(s,id,{state:'stored'});f.areaId=treasure(id).locations[0];return f;
}
export function mountTreasureCheck(host:HTMLElement,s:State,changed:()=>void,wash:()=>void){
 const section=document.createElement('section');section.id='lab-treasure-check';host.prepend(section);
 section.innerHTML='<h3>素材・図鑑登録の確認</h3><p>DEBUG／テスト用セーブ。閲覧だけでは発見・達成状態を変更しません。</p><button id="lab-catalog-toggle">全300点を表示</button><div id="lab-catalog" hidden></div><label>即回収する品名・ID<input id="lab-quick-query" type="search" maxlength="60"></label><label>対象1点<select id="lab-quick-item"></select></label><button id="lab-quick-recover">選んだ品を即回収</button><p id="lab-quick-result" role="status"></p><button id="lab-quick-wash" hidden>洗浄へ</button>';
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>section.querySelector<T>('#'+id)!;
 const select=el<HTMLSelectElement>('lab-quick-item'),query=el<HTMLInputElement>('lab-quick-query');
 const filter=()=>{const q=query.value.trim().toLowerCase();select.replaceChildren(...treasures.filter(t=>(t.id+' '+t.name).toLowerCase().includes(q)).map(t=>new Option(t.id+' / '+t.name,t.id)));el<HTMLButtonElement>('lab-quick-recover').disabled=!select.options.length;};filter();query.oninput=filter;
 el('lab-catalog-toggle').onclick=()=>{const box=el('lab-catalog');box.hidden=!box.hidden;if(!box.hidden){box.replaceChildren();mountCollection(box,s,{revealAll:true});}el('lab-catalog-toggle').textContent=box.hidden?'全300点を表示':'閲覧表示を閉じる';};
 el('lab-quick-recover').onclick=()=>{try{const f=instantRecovery(s,select.value);changed();el('lab-quick-result').textContent=treasure(f.id).name+'を未洗浄で追加しました。図鑑登録・探索目標の達成は洗浄後です。';el('lab-quick-wash').hidden=false;}catch(e){el('lab-quick-result').textContent=String(e);}};
 el('lab-quick-wash').onclick=wash;
}
