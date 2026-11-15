import type {State} from './engine';
import {EXPLORATION_TARGETS,explorationHeading,explorationHint,setExplorationGoal} from './exploration-goals';
import {treasureShape,treasureSilhouette} from './reveal';
export function mountExplorationGoals(host:HTMLElement,s:State,changed:()=>void){
 const box=document.createElement('details');box.id='exploration-goals';host.append(box);
 function render(){const active=s.explorationGoal?.target;box.innerHTML='<summary>探索目標（同時に1点）'+(active?'：設定中':'：未設定')+'</summary><p>未発見の品を1点選べます。洗浄して初めて図鑑に登録すると達成。出現を保証する機能ではありません。</p><button id="exploration-clear" '+(!active?'disabled':'')+'>探索目標を解除</button><div class="exploration-choices">'+EXPLORATION_TARGETS.map(id=>{
  const found=!!s.discoveredTreasures[id],h=explorationHint(s,id);return `<article class="exploration-choice"><div>${found?treasureShape(id):treasureSilhouette()}</div><div><strong>${explorationHeading(s,id)}</strong><p>${h.location} / ${h.place}（${h.status}）</p><p>${h.required}</p><p>${h.recommended}</p><button data-exploration-target="${id}" ${found||active===id?'disabled':''}>${found?'発見済み':active===id?'探索目標に設定中':'この品を探索目標にする'}</button></div></article>`;
 }).join('')+'</div>';
 box.querySelector<HTMLButtonElement>('#exploration-clear')!.onclick=()=>{setExplorationGoal(s,null);changed();render();};
 box.querySelectorAll<HTMLButtonElement>('[data-exploration-target]').forEach(b=>b.onclick=()=>{if(setExplorationGoal(s,b.dataset.explorationTarget!)){changed();render();}});
 }render();
}
export function updateExplorationGoalHUD(host:HTMLElement,s:State){const id=s.explorationGoal?.target;host.hidden=!id;if(!id)return;const label='探索目標：'+explorationHeading(s,id)+' / '+explorationHint(s,id).summary;if(host.textContent!==label)host.textContent=label;}
