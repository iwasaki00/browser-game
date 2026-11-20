import type {State} from './engine';
import {EXPLORATION_TARGETS,explorationHeading,explorationHint,setExplorationGoal} from './exploration-goals';
import {treasureShape,treasureSilhouette} from './reveal';
export function mountExplorationGoals(host:HTMLElement,s:State,changed:()=>void){
 const box=document.createElement('details');box.id='exploration-goals';host.prepend(box);
 function render(){const active=s.explorationGoal?.target;box.innerHTML='<summary>探索目標（同時に1点）'+(active?'：設定中':'：未設定')+'</summary><p>未発見の品を1点選べます。洗浄して初めて図鑑に登録すると達成。出現を保証する機能ではありません。</p><button id="exploration-clear" '+(!active?'disabled':'')+'>探索目標を解除</button><div class="exploration-choices">'+EXPLORATION_TARGETS.map(id=>{
  const found=!!s.discoveredTreasures[id],h=explorationHint(s,id);return `<article class="exploration-choice"><div>${found?treasureShape(id):treasureSilhouette()}</div><div><strong>${explorationHeading(s,id)}</strong><p>${h.location} / ${h.place}（${h.status}）</p><p>${h.required}</p><p>${h.recommended}</p><button data-exploration-target="${id}" ${found||active===id?'disabled':''}>${found?'発見済み':active===id?'探索目標に設定中':'この品を探索目標にする'}</button></div></article>`;
 }).join('')+'</div>';
 box.querySelector<HTMLButtonElement>('#exploration-clear')!.onclick=()=>{setExplorationGoal(s,null);changed();render();};
 box.querySelectorAll<HTMLButtonElement>('[data-exploration-target]').forEach(b=>b.onclick=()=>{if(setExplorationGoal(s,b.dataset.explorationTarget!)){changed();render();}});
 }render();return render;
}
export function updateExplorationGoalHUD(host:HTMLElement,s:State){
 const id=s.explorationGoal?.target;host.hidden=!id;if(!id){delete host.dataset.goal;return;}
 if(host.dataset.goal!==id){host.dataset.goal=id;host.innerHTML='<summary><strong class="goal-heading"></strong><span class="goal-brief"></span></summary><div class="goal-hud-detail"><p class="goal-location"></p><p class="goal-required"></p><p class="goal-recommended"></p><button data-goal-change>目標変更</button><button data-goal-clear>解除</button></div>';}
 const h=explorationHint(s,id),labels={'.goal-heading':'探索目標：'+explorationHeading(s,id),'.goal-brief':h.place+' / '+h.brief,'.goal-location':'推奨：'+h.location+' / '+h.place+'（'+h.status+'）','.goal-required':h.required,'.goal-recommended':h.recommended};
 for(const [selector,text]of Object.entries(labels)){const el=host.querySelector(selector)!;if(el.textContent!==text)el.textContent=text;}
}
