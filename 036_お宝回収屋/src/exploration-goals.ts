import type {State} from './engine';
import {areas,treasure,tool} from './data';
import {areaUnlocked} from './river';
import {goldAreaUnlocked} from './gold';
import {worldUnlocked} from './world-rules';
export interface ExplorationGoal {target:string|null;completed:string[];}
export const EXPLORATION_TARGETS=['B001','B004','B007','R001','R002','R004','G001','G003','G007'] as const;
export const isExplorationTarget=(id:string)=>EXPLORATION_TARGETS.some(t=>t===id);
export function setExplorationGoal(s:State,id:string|null){
 if(id!==null&&(!isExplorationTarget(id)||!!s.discoveredTreasures[id]))return false;
 s.explorationGoal??={target:null,completed:[]};s.explorationGoal.target=id;return true;
}
// Only the existing first-registration transaction may complete a goal. No replayable toast queue.
export function registerExplorationGoal(s:State,id:string,first:boolean){
 const g=s.explorationGoal;if(!first||!g||g.target!==id||g.completed.includes(id))return false;
 g.completed.push(id);g.target=null;return true;
}
export function validateExplorationGoal(s:State){
 const g=s.explorationGoal;if(g===undefined)return;
 if(!g||typeof g!=='object'||g.target!==null&&(typeof g.target!=='string'||!isExplorationTarget(g.target))||!Array.isArray(g.completed)||g.completed.length>9||g.completed.some(id=>typeof id!=='string'||!isExplorationTarget(id))||new Set(g.completed).size!==g.completed.length)throw Error('探索目標データが不正です');
 if(g.target&&s.discoveredTreasures[g.target])g.target=null;
}
export function explorationHeading(s:State,id:string){
 if(s.discoveredTreasures[id])return treasure(id).name;
 const field=({B:'砂浜',R:'川底',G:'河原'} as Record<string,string>)[id[0]];
 return field+'の目標 '+(EXPLORATION_TARGETS.filter(x=>x[0]===id[0]).findIndex(x=>x===id)+1);
}
function accessible(s:State,id:string){return id==='B-A'||worldUnlocked(s,id)||(id[0]==='R'?areaUnlocked(s,id):id[0]==='G'?goldAreaUnlocked(s,id):false);}
const toolState=(s:State,id:string)=>tool(id)!.name+'（'+(s.ownedTools.includes(id)?'所持':s.unlockedTools.includes(id)?'購入可能・未所持':'未解放・未所持')+'）';
export function explorationHint(s:State,id:string){
 const location=id==='G007'?'G-B':id[0]+'-A',place=areas.find(a=>a.id===location)!;
 const status=accessible(s,location)?'移動可能':'未解放：'+place.unlockConditions;
 let required='',recommended='';
 if(id[0]==='B'){
  required='必須：砂を掘って露出した品を回収し、洗浄。砂に入った品は選別も必要。';
  recommended=id==='B007'?'おすすめ：浅い個体を探す。深い個体は深掘り道具に持ち替える。':'おすすめ：まず浅い砂を素手で探索。初期区画にも出現する。';
 }else if(id==='R004'){
  required='必須：重さ0.9kgを扱え、対象に届く回収道具。隙間の個体はフック等で障害物に対応。';
  recommended='おすすめ：'+toolState(s,'R101')+'。鉄製なので磁石も選択肢。';
 }else if(id[0]==='R'){
  required='必須：対象に届く回収道具。岸に近く障害物のない個体なら素手で回収できる。';
  recommended='おすすめ：遠い影には'+toolState(s,'R101')+'。鉄製なので磁石も使える。';
 }else if(id==='G007'){
  required='必須：砂利採取→皿またはスルースの比重選別→粒の精密回収→洗浄。'+(['G102','G201','G203'].some(x=>s.ownedTools.includes(x))?'比重選別道具は所持。':'比重選別道具は未所持（'+toolState(s,'G102')+'）。');
  recommended='おすすめ：'+toolState(s,'G110')+'で微細粒を1回で回収。素手でも複数回の操作で回収可能。';
 }else{
  required='必須：砂利を採取し、粒を回収して洗浄。';recommended='おすすめ：まず素手で採取。手で扱える大きさの粒はそのまま回収できる。';
 }
 return {location,place:place.name,status,required,recommended,summary:place.name+'（'+status+'） / '+(id==='G007'?'比重選別と精密回収が必要':id==='R004'?'重量・距離に対応して回収':id[0]==='R'?'岸に近い影は素手で試せる':id[0]==='G'?'素手で砂利を採取して洗浄':id==='B007'?'深さに合う掘削道具を使う':'浅い砂を素手で探索')};
}
