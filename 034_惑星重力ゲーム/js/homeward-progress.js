import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
export const HOMEWARD_KEY='orbit-maker.homeward.v1';
export const newHomeward=()=>({version:1,currentSector:'homeward-01',cleared:[],openingSeen:false,eventsSeen:[],active:false});
export function sectorUnlocked(state,id){const i=HOMEWARD_SECTORS.findIndex(s=>s.id===id);return i===0||i>0&&state.cleared.includes(HOMEWARD_SECTORS[i-1].id);}
export function homewardDistance(state){const travelled=HOMEWARD_SECTORS.filter(s=>state.cleared.includes(s.id)).reduce((n,s)=>n+s.distance,0);return {travelled,remaining:HOMEWARD.totalDistance-travelled,percent:travelled/HOMEWARD.totalDistance*100};}
export class HomewardProgress {
 constructor(storage){
  this.storage=storage;this.state=newHomeward();this.writable=true;this.notice='';
  try{
   const raw=storage?.getItem(HOMEWARD_KEY);if(!raw)return;const data=JSON.parse(raw);
   if(data.version!==1||!Array.isArray(data.cleared)||data.cleared.some(id=>!getHomewardDefinition(id)))throw Error();
   const cleared=HOMEWARD_SECTORS.filter((s,i)=>data.cleared.includes(s.id)&&HOMEWARD_SECTORS.slice(0,i).every(p=>data.cleared.includes(p.id))).map(s=>s.id);
   this.state={...newHomeward(),cleared,openingSeen:data.openingSeen===true,eventsSeen:Array.isArray(data.eventsSeen)?data.eventsSeen.filter(e=>typeof e==='string'):[],active:data.active===true};
   this.state.currentSector=getHomewardDefinition(data.currentSector)&&sectorUnlocked(this.state,data.currentSector)?data.currentSector:HOMEWARD_SECTORS.find(s=>!cleared.includes(s.id))?.id??'homeward-03';
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
 clear(id){if(!this.state.active||!this.state.openingSeen||id!==this.state.currentSector||!sectorUnlocked(this.state,id))return false;this.commit({cleared:[...new Set([...this.state.cleared,id])],eventsSeen:[...new Set([...this.state.eventsSeen,`${id}:arrival`])]});return true;}
 markEvent(id){if(!this.state.eventsSeen.includes(id))this.commit({eventsSeen:[...this.state.eventsSeen,id]});}
 leave(){if(this.state.active)this.commit({active:false});}
}
