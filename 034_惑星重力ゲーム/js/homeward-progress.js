import {FINAL_ID,normalizeFinal,beginFinal,chooseFinal,startFinalFlight,dockFinal,finalDestination} from './final-voyage.js';
import {DEEP_ID,normalizeDeep,observeDeep,deepAvailable,dockDeep,chooseDeepPolicy,deepDeparture} from './deep-space.js';
import {HOMEWARD,HOMEWARD_SECTORS,getHomewardDefinition} from './homeward-data.js';
import {tutorialEntry,tutorialTransition} from './homeward-tutorial.js';
import {getHomewardSector} from './homeward-data.js';
import {missionSatisfied} from './homeward-mission.js';
import {newVoyage,normalizeVoyage,destination,dockVoyage} from './open-voyage.js';
import {normalizeFrontier,legacyFrontier,observeFrontier,targetAvailable,frontierTarget,targetLabel,discoveryEntry} from './frontier.js';
import {resolveEchoes,normalizeEchoes,storyRouteDestination,SIGNAL_ID} from './echoes.js';
import {resolveImpossible,impossibleState,temporalUnlocked,TEMPORAL_SITE,IMPOSSIBLE_ACTIONS} from './impossible-signal.js';
export const HOMEWARD_KEY='orbit-maker.homeward.v1';
export const newHomeward=()=>({version:1,currentSector:'homeward-01',cleared:[],openingSeen:false,eventsSeen:[],active:false,tutorial:{},journal:{},choices:{}});
export function sectorUnlocked(state,id){const i=HOMEWARD_SECTORS.findIndex(s=>s.id===id);return i===0||i>0&&state.cleared.includes(HOMEWARD_SECTORS[i-1].id);}
export function homewardDistance(state){if(['END-01','END-02','END-03'].some(id=>state.finalVoyage?.endings?.[id]))return {travelled:HOMEWARD.totalDistance,remaining:0,percent:100};const detour=state.choices?.['homeward-07']==='pursue'?600:0;const bonus=state.voyage?.rewards?.includes('navigation-tech')?900:0;const travelled=HOMEWARD_SECTORS.filter(s=>state.cleared.includes(s.id)).reduce((n,s)=>n+s.distance,0)-detour+bonus;return {travelled,remaining:HOMEWARD.totalDistance-travelled,percent:Math.max(0,travelled/HOMEWARD.totalDistance*100)};}
export class HomewardProgress {
 constructor(storage){
  this.dockedFlights=new WeakSet();this.lastFinalResult=null;
  this.frontierRuntime=null;this.lastStoryEvents=[];this.impossibleTracking=0;
  this.storage=storage;this.state=newHomeward();this.writable=true;this.notice='';
  try{
   const raw=storage?.getItem(HOMEWARD_KEY);if(!raw)return;const data=JSON.parse(raw);
   if(data.version!==1||!Array.isArray(data.cleared)||data.cleared.some(id=>!getHomewardDefinition(id)))throw Error();
   const cleared=HOMEWARD_SECTORS.filter((s,i)=>data.cleared.includes(s.id)&&HOMEWARD_SECTORS.slice(0,i).every(p=>data.cleared.includes(p.id))).map(s=>s.id);
   this.state={...data,...newHomeward(),cleared,openingSeen:data.openingSeen===true,eventsSeen:Array.isArray(data.eventsSeen)?data.eventsSeen.filter(e=>typeof e==='string'):[],active:data.active===true,
    journal:data.journal&&typeof data.journal==='object'&&!Array.isArray(data.journal)?data.journal:{},choices:data.choices&&typeof data.choices==='object'&&!Array.isArray(data.choices)?data.choices:{}};
   this.state.currentSector=getHomewardDefinition(data.currentSector)&&sectorUnlocked(this.state,data.currentSector)?data.currentSector:HOMEWARD_SECTORS.find(s=>!cleared.includes(s.id))?.id??HOMEWARD_SECTORS.at(-1).id;
   if(data.finalVoyage)this.state.finalVoyage=normalizeFinal(data.finalVoyage);
   if(data.deep)this.state.deep=normalizeDeep(data.deep);
   if(data.voyage)this.state.voyage=normalizeVoyage(data.voyage);
   if(data.frontier)this.state.frontier=normalizeFrontier(data.frontier);else if(data.voyage)this.state.frontier=legacyFrontier(data.voyage);
   if(data.echoes||data.frontier||data.voyage)this.state.echoes=resolveEchoes(data.echoes,this.state.frontier,this.state.voyage,{restoring:true}).story;
   if(data.echoes?.impossible)this.state.echoes=resolveImpossible(this.state.echoes,{restoring:true}).story;
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
 enter(id){if(!this.state.openingSeen||!sectorUnlocked(this.state,id))return false;this.commit({currentSector:id,active:true});if(id===FINAL_ID){const result=beginFinal(this.state.finalVoyage);this.commit({finalVoyage:result.voyage});}return true;}
 clear(id,evidence){if(id===FINAL_ID&&!Object.keys(normalizeFinal(this.state.finalVoyage).endings).some(id=>id!=='END-05'))return false;if(id===DEEP_ID&&!this.state.deep?.completed)return false;if(id==='homeward-09'&&!this.state.voyage?.completed)return false;if(!this.state.active||!this.state.openingSeen||id!==this.state.currentSector||!sectorUnlocked(this.state,id)||!missionSatisfied(getHomewardSector(id),evidence,this.state.choices[id]))return false;this.commit({cleared:[...new Set([...this.state.cleared,id])],eventsSeen:[...new Set([...this.state.eventsSeen,`${id}:arrival`])],tutorial:{...this.state.tutorial,[id]:tutorialTransition(tutorialEntry(this.state,id),id,'clear')}});return true;}
 finalActive(){return this.state.active&&this.state.openingSeen&&this.state.currentSector===FINAL_ID&&sectorUnlocked(this.state,FINAL_ID);}
 selectFinal(id){if(!this.finalActive()||!finalDestination(id))return false;this.commit({finalVoyage:{...normalizeFinal(this.state.finalVoyage),selected:id}});return true;}
 chooseFinalDecision(decision,elapsed=0){if(!this.finalActive())return null;const result=chooseFinal(this.state.finalVoyage,decision,this.state,undefined,elapsed);if(result)this.commit({finalVoyage:result.voyage});return result;}
 launchFinal(){this.lastFinalResult=null;if(!this.finalActive())return [];const result=startFinalFlight(this.state.finalVoyage);this.commit({finalVoyage:result.voyage});return result.events;}
 dockFinal(state){if(!this.finalActive()||this.dockedFlights.has(state))return null;const result=dockFinal(this.state,this.state.finalVoyage,state);if(!result)return null;this.dockedFlights.add(state);this.commit({finalVoyage:result.voyage});this.lastFinalResult=result;if(result.ending&&result.ending!=='END-05')this.clear(FINAL_ID,{});return result;}
 attachFinalRecord(target,ending,id){const v=normalizeFinal(this.state.finalVoyage);if(finalDestination(target)&&!v.records[target])v.records[target]=id;if(ending&&v.endings[ending]&&!v.endings[ending].flightId)v.endings[ending]={...v.endings[ending],flightId:id};this.commit({finalVoyage:v});}
 selectDeep(id){if(!this.state.active||!this.state.openingSeen||!sectorUnlocked(this.state,DEEP_ID)||this.state.currentSector!==DEEP_ID||!deepAvailable(this.state.deep,id))return false;this.commit({deep:{...normalizeDeep(this.state.deep),selected:id}});return true;}
 chooseDeep(policy,position){if(!this.state.active||!this.state.openingSeen||!sectorUnlocked(this.state,DEEP_ID)||this.state.currentSector!==DEEP_ID)return null;const deep=chooseDeepPolicy(this.state.deep,policy,position??deepDeparture(this.state.deep));if(!deep)return null;this.commit({deep});return deep.selected;}
 surveyDeep(previous,next){const r=observeDeep(this.state.deep,previous,next);if(r.events.length)this.commit({deep:r.deep});return r.events;}
 dockDeep(state){if(!this.state.active||!this.state.openingSeen||!sectorUnlocked(this.state,DEEP_ID)||this.state.currentSector!==DEEP_ID||this.dockedFlights.has(state))return false;const deep=dockDeep(this.state.deep,state);if(!deep)return false;this.dockedFlights.add(state);this.commit({deep});if(deep.completed)this.clear(DEEP_ID,{});return true;}
 attachDeepRecord(events,flightId){const deep=normalizeDeep(this.state.deep);for(const e of events)if(deep.targets[e.id]){const field=e.state==='INVESTIGATED'?'investigatedFlightId':'detectedFlightId';if(!deep.targets[e.id][field])deep.targets[e.id]={...deep.targets[e.id],[field]:flightId};}this.commit({deep});}
 selectDestination(id,{requireDiscovered=false}={}){if(this.state.currentSector!=='homeward-09'||!sectorUnlocked(this.state,'homeward-09')||!destination(id)||([SIGNAL_ID,TEMPORAL_SITE.id].includes(id)||requireDiscovered)&&!targetAvailable(this.state.frontier,id,this.state.echoes))return false;this.commit({voyage:{...normalizeVoyage(this.state.voyage),selected:id},frontier:normalizeFrontier(this.state.frontier)});return true;}
 beginSurvey(){this.impossibleTracking=0;this.frontierRuntime=normalizeFrontier(this.state.frontier);for(const entry of Object.values(this.frontierRuntime.targets))entry.tracking=0;
  if(this.state.echoes?.impossible){const episode=impossibleState(this.state.echoes),last=episode.choices.at(-1);if(last&&last.result!=='pending'){episode.choices.push({id:episode.choices.length+1,choice:last.choice,destination:normalizeVoyage(this.state.voyage).selected,at:Date.now(),result:'pending',continued:true});this.commit({echoes:{...this.state.echoes,impossible:episode}});}}
 }
 observeSurvey(previous,next,now){
  const result=observeFrontier(this.frontierRuntime??this.state.frontier,previous,next,now);this.frontierRuntime=result.frontier;
  this.lastStoryEvents=[];
  const oldEvent=result.events.length||next.status==='cleared'&&next.goal.id===SIGNAL_ID;
  const narrative=oldEvent?resolveEchoes(this.state.echoes,result.frontier,this.state.voyage,{now,elapsed:next.elapsed,arrival:next.status==='cleared'&&next.goal.id===SIGNAL_ID}):{story:this.state.echoes,events:[]};
  const episode=narrative.story?.clues?.['CLUE-08']?resolveImpossible({...narrative.story,impossible:{...impossibleState(narrative.story),tracking:this.impossibleTracking}},{previous,next,now}):{story:narrative.story,events:[],changed:false};
  this.impossibleTracking=episode.story?.impossible?.tracking??0;this.lastStoryEvents=[...narrative.events,...episode.events];
  if(oldEvent||episode.changed)this.commit({frontier:result.frontier,echoes:episode.story});return result.events;
 }
 analyzeSignal(kind,elapsed=0,now=()=>Date.now()){
  if(this.state.currentSector!=='homeward-09'||!this.state.echoes?.clues?.['CLUE-05']||!['identity','timestamp'].includes(kind)||kind==='timestamp'&&!this.state.echoes.clues['CLUE-06'])return [];
  const result=resolveImpossible(this.state.echoes,{analysis:kind,now});for(const e of result.events)e.elapsed=elapsed;
  if(result.changed)this.commit({echoes:result.story});return result.events;
 }
 chooseImpossible(choice,now=()=>Date.now()){
  if(this.state.currentSector!=='homeward-09'||!temporalUnlocked(this.state.echoes)||!IMPOSSIBLE_ACTIONS.some(a=>a.id===choice))return null;
  const id=choice==='investigate'?TEMPORAL_SITE.id:choice==='avoid'?'gate':normalizeVoyage(this.state.voyage).selected;if(!this.selectDestination(id,{requireDiscovered:true}))return null;
  const story=normalizeEchoes(this.state.echoes),episode=impossibleState(story),last=episode.choices.at(-1);
  if(last?.choice===choice&&last.result==='pending')return id;
  if(last?.result==='pending'){last.result='superseded';last.completedAt=now();}
  episode.choices.push({id:episode.choices.length+1,choice,destination:id,at:now(),result:'pending'});episode.tracking=0;this.impossibleTracking=0;this.commit({echoes:{...story,impossible:episode}});return id;
 }
 endImpossibleFlight(state,reason){
  if(!this.state.echoes?.impossible)return;const episode=impossibleState(this.state.echoes),last=episode.choices.at(-1);
  if(last?.result!=='pending')return;last.result=reason==='reset'?'reset':state.status==='cleared'?'docked-without-condition':state.status;last.completedAt=Date.now();last.elapsed=state.elapsed;episode.tracking=0;this.commit({echoes:{...this.state.echoes,impossible:episode}});
 }
 chooseStory(choice){
  if(this.state.currentSector!=='homeward-09'||!sectorUnlocked(this.state,'homeward-09'))return null;
  const id=storyRouteDestination(this.state.echoes,this.state.frontier,choice);if(!id||!this.selectDestination(id,{requireDiscovered:true}))return null;
  const story=normalizeEchoes(this.state.echoes),last=story.choices.at(-1);
  if(last?.choice!==choice||last.destination!==id)story.choices.push({choice,destination:id,at:Date.now()});
  this.commit({echoes:story});return id;
 }
 attachStoryRecord(id,reference){const story=normalizeEchoes(this.state.echoes);if(story.records[id])return;story.records[id]=reference;if(story.clues[id])story.clues[id]={...story.clues[id],flightId:reference};this.commit({echoes:story});}
 attachDiscoveryRecord(id,state,reference){
  const target=frontierTarget(id);if(!target)return;
  const field=state==='INVESTIGATED'?'investigatedFlightId':'detectedFlightId',frontier=normalizeFrontier(this.state.frontier);
  if(frontier.targets[target.id][field])return;frontier.targets[target.id][field]=reference;this.commit({frontier});
  if(this.frontierRuntime)this.frontierRuntime.targets[target.id][field]=reference;
 }
 dock(state){
  if(!this.state.active||!this.state.openingSeen||this.state.currentSector!=='homeward-09'||!sectorUnlocked(this.state,'homeward-09')||this.dockedFlights.has(state))return false;
  const voyage=dockVoyage(this.state.voyage??newVoyage(),state);if(!voyage)return false;
  this.dockedFlights.add(state);
  this.commit({voyage});const d=destination(voyage.checkpoint);
  const known=d.id==='gate'||d.id===SIGNAL_ID||d.id===TEMPORAL_SITE.id||discoveryEntry(this.state.frontier,d.id).state==='INVESTIGATED';
  this.log('homeward-09',{departure:'出航：選んだ目的地へ。',discovery:known?d.log:'信号地点へ到着。正体の確認には追加調査が必要。',discoveries: [...voyage.discoveries],arrival:`寄港：${targetLabel(this.state.frontier,d.id,this.state.echoes)}`,visited: [...voyage.visited]});
  if(d.id==='gate')this.clear('homeward-09');return true;
 }
 attachDock(id,reference){const voyage=normalizeVoyage(this.state.voyage);if(!destination(id)||voyage.records[id])return;this.commit({voyage:{...voyage,records:{...voyage.records,[id]:reference}}});}
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
