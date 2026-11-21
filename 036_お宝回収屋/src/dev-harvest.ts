import {createState,type State} from './engine';import {applyBeachScenario} from './dev-beach';import {applyScenario} from './dev-actions';import {applyGoldScenario} from './dev-gold';
export interface HarvestComparison {enabled:()=>boolean;set:(on:boolean)=>void;stats:()=>unknown;reset:()=>void;start:()=>void;}
export const harvestScenes=[['B','砂浜：接地点・露出'],['R-tongs','川底：トング'],['R-hook','川底：フック'],['R-magnet','川底：小型磁石'],['R-rope','川底：ロープ・重量物'],['R-heavy','川底：重量不足'],['R-brass','川底：磁性不一致'],['G-gather','河原：砂利採取'],['G-screen','河原：ふるい'],['G-pan','河原：パンニング'],['G-grain','河原：微細粒の吸引'],['G-sluice','河原：スルース']] as const;
export function harvestFixture(key:string){
 if(!harvestScenes.some(x=>x[0]===key))throw Error('比較状況を確認してください');
 const state=createState(2111);state.settings.sound=false;
 const result=key==='B'?applyBeachScenario(state,'B-TEST-01'):key.startsWith('R-')?applyScenario(state,({'R-tongs':'tongs','R-hook':'hook','R-magnet':'magnetic','R-rope':'strong','R-heavy':'heavy','R-brass':'brass'} as Record<string,string>)[key]):applyGoldScenario(state,({'G-gather':'G-TEST-02','G-screen':'G-TEST-03','G-pan':'G-TEST-04','G-grain':'G-TEST-06','G-sluice':'G-TEST-08'} as Record<string,string>)[key]);
 return {state,tool:result.tool};
}
let selected='B',template:{key:string;state:State;tool:string}|undefined;
export function mountHarvestLab(host:HTMLElement,comparison:HarvestComparison,replace:(fixture:{state:State;tool:string})=>void){
 const box=document.createElement('details');box.id='lab-harvest';box.innerHTML='<summary>採取操作の比較</summary><p>追加した視覚フィードバックだけを切り替えます。OFFは従来の見え方。採取条件・道具性能・報酬は同じです。</p><label class="toggle"><input id="lab-harvest-toggle" data-visual-only type="checkbox" '+(comparison.enabled()?'checked':'')+'>追加フィードバックON</label><label>同じ条件を再現<select id="lab-harvest-scene">'+harvestScenes.map(([id,name])=>'<option value="'+id+'" '+(selected===id?'selected':'')+'>'+name+'</option>').join('')+'</select></label><button id="lab-harvest-reset">同じ初期状態を再現</button><p>テスト用進行を置き換えます。通常セーブには触れません。再現後はON／OFFを選び、採取へ戻って比較してください。</p><button id="lab-harvest-start">採取へ</button><button id="lab-harvest-stats">描画診断を表示</button><button id="lab-harvest-metrics-reset">診断をリセット</button><pre id="lab-harvest-diagnostics"></pre>';
 host.prepend(box);const el=<T extends HTMLElement=HTMLElement>(id:string)=>box.querySelector<T>('#'+id)!;
 el<HTMLInputElement>('lab-harvest-toggle').onchange=e=>{e.stopPropagation();comparison.set((e.target as HTMLInputElement).checked);};
 el<HTMLSelectElement>('lab-harvest-scene').onchange=e=>{selected=(e.target as HTMLSelectElement).value;};
 el('lab-harvest-reset').onclick=()=>{if(!confirm('現在のテスト用進行を比較用の初期状態へ置き換えますか？ 通常セーブは変更しません。'))return;if(template?.key!==selected)template={key:selected,...harvestFixture(selected)};replace(structuredClone(template));};
 el('lab-harvest-start').onclick=comparison.start;
 el('lab-harvest-stats').onclick=()=>{el('lab-harvest-diagnostics').textContent=JSON.stringify(comparison.stats(),null,2);};
 el('lab-harvest-metrics-reset').onclick=()=>{comparison.reset();el('lab-harvest-diagnostics').textContent='診断をリセットしました。';};
}
