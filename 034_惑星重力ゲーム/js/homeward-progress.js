import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
import {tutorialEntry,tutorialTransition} from './homeward-tutorial.js';
import {getHomewardSector} from './homeward-data.js';
import {missionSatisfied} from './homeward-mission.js';
export const HOMEWARD_KEY='orbit-maker.homeward.v1';
export const newHomeward=()=>({version:1,currentSector:'homeward-01',cleared:[],openingSeen:false,eventsSeen:[],active:false,tutorial:{},journal:{},choices:{}});
export function sectorUnlocked(state,id){const i=HOMEWARD_SECTORS.findIndex(s=>s.id===id);return i===0||i>0&&state.cleared.includes(HOMEWARD_SECTORS[i-1].id);}
export function homewardDistance(state){const detour=state.choices?.['homeward-07']==='pursue'?600:0;const travelled=HOMEWARD_SECTORS.filter(s=>state.cleared.includes(s.id)).reduce((n,s)=>n+s.distance,0)-detour;return {travelled,remaining:HOMEWARD.totalDistance-travelled,percent:Math.max(0,travelled/HOMEWARD.totalDistance*100)};}
export class HomewardProgress {
 constructor(storage){
  this.storage=storage;this.state=newHomeward();this.writable=true;this.notice='';
  try{
   const raw=storage?.getItem(HOMEWARD_KEY);if(!raw)return;const data=JSON.parse(raw);
   if(data.version!==1||!Array.isArray(data.cleared)||data.cleared.some(id=>!getHomewardDefinition(id)))throw Error();
   const cleared=HOMEWARD_SECTORS.filter((s,i)=>data.cleared.includes(s.id)&&HOMEWARD_SECTORS.slice(0,i).every(p=>data.cleared.includes(p.id))).map(s=>s.id);
   this.state={...data,...newHomeward(),cleared,openingSeen:data.openingSeen===true,eventsSeen:Array.isArray(data.eventsSeen)?data.eventsSeen.filter(e=>typeof e==='string'):[],active:data.active===true,
    journal:data.journal&&typeof data.journal==='object'&&!Array.isArray(data.journal)?data.journal:{},choices:data.choices&&typeof data.choices==='object'&&!Array.isArray(data.choices)?data.choices:{}};
   this.state.currentSector=getHomewardDefinition(data.currentSector)&&sectorUnlocked(this.state,data.currentSector)?data.currentSector:HOMEWARD_SECTORS.find(s=>!cleared.includes(s.id))?.id??HOMEWARD_SECTORS.at(-1).id;
   const source={cleared,tutorial:data.tutorial&&typeof data.tutorial==='object'?data.tutorial:{}};
   this.state.tutorial=Object.fromEntries(HOMEWARD_SECTORS.filter(s=>source.tutorial[s.id]||cleared.includes(s.id)).map(s=>[s.id,tutorialEntry(source,s.id)]));
  }catch{this.writable=false;this.notice='HOMEWARDの保存情報を読み込めません。元のデータを保護し、今回は一時プレイになります。';}
 }
 commit(patch){
  this.state={...this.state,...patch};
  if(!this.writable)return false;
  try{if(!this.storage)throw Error();this.storage.setItem(HOMEWARD_KEY,JSON.stringify(this.state));this.notice='';return true;}
  catch{this.notice='HOMEWARDの進行を保存できません。この画面では続けられますが、再読み込み後は復元できません。';return false;}
 }
 start(){this.commit({openingSeen:true,active:true});}
 enter(id){if(!this.state.openingSeen||!sectorUnlocked(this.state,id))return false;this.commit({currentSector:id,active:true});return true;}
 clear(id,evidence){if(!this.state.active||!this.state.openingSeen||id!==this.state.currentSector||!sectorUnlocked(this.state,id)||!missionSatisfied(getHomewardSector(id),evidence,this.state.choices[id]))return false;this.commit({cleared:[...new Set([...this.state.cleared,id])],eventsSeen:[...new Set([...this.state.eventsSeen,`${id}:arrival`])],tutorial:{...this.state.tutorial,[id]:tutorialTransition(tutorialEntry(this.state,id),id,'clear')}});return true;}
 choose(id,choice){
  const definition=getHomewardDefinition(id),option=definition?.choices?.find(c=>c.id===choice);
  if(!option||this.state.currentSector!==id||!sectorUnlocked(this.state,id))return false;
  this.commit({choices:{...this.state.choices,[id]:choice}});
  const savedHistory=this.state.journal[id]?.choiceHistory,history=Array.isArray(savedHistory)?savedHistory:[];
  this.log(id,{choice,choiceLog:option.text,choiceHistory:history.at(-1)?.choice===choice?history:[...history,{choice,text:option.text,at:Date.now()}]});return true;
 }
 log(id,patch){if(!getHomewardDefinition(id))return;const old=this.state.journal[id]??{};this.commit({journal:{...this.state.journal,[id]:{...old,...patch}}});}
 recordFlight(id,state,evidence,choice,reference=null,token=null){
  const definition=getHomewardDefinition(id);if(!definition)return;
  const success=state.status==='cleared'&&missionSatisfied(getHomewardSector(id),evidence,choice),old=this.state.journal[id]??{};
  this.log(id,{departure:definition.departure,encounter:definition.encounterLog??definition.theme,
   encounters:[...new Set([...(Array.isArray(old.encounters)?old.encounters:[]),...(evidence?.encounters??[])])],
   ...(evidence?.encounters?.length?{discovery:definition.discovery??definition.arrival}:{}),
   ...(success?{arrival:definition.arrival}:{}),lastResult:success?'clear':'fail',elapsed:state.elapsed,
   ...(token?{flightToken:token}:{}),...(reference?{flightId:reference,...(success?{clearFlightId:reference}:{})}:{}),
  });
 }
 attachFlight(id,token,success){
  const old=this.state.journal[id];if(!old)return;
  this.log(id,{...(old.flightToken===token?{flightId:token}:{}),...(success&&!old.clearFlightId?{clearFlightId:token}:old.flightToken===token&&success?{clearFlightId:token}:{})});
 }
 setTutorial(id,entry){if(getHomewardDefinition(id)&&entry)this.commit({tutorial:{...this.state.tutorial,[id]:entry}});}
 markEvent(id){if(!this.state.eventsSeen.includes(id))this.commit({eventsSeen:[...this.state.eventsSeen,id]});}
 leave(){if(this.state.active)this.commit({active:false});}
}
