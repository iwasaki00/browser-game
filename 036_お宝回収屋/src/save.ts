import {environments,collectionMilestones} from './world-rules';
import {validateLines} from './lines';
import {compactHistory,validateLedger} from './ledger';
import {restoreAutomation} from './automation';
import {createState,surfaceY,refresh,type State,type Plot} from './engine';
import {plotDepthScale} from './beach-tools';
import {validateGold} from './gold';
import {migrateEquipment} from './equipment';
// Keep the existing keys so 0.1.0 saves remain discoverable.
const normalKey=import.meta.env?.DEV?'finders-dev-v1':'finders-v1';
export type SaveScope='normal'|'debug';
export function saveKey(scope:SaveScope='normal'){if(scope==='debug'){if(!import.meta.env?.DEV)throw Error('開発専用セーブは本番版では使用できません');return 'finders-debug-v1';}return normalKey;}
function open(key:string):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(key,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function convertPlot(p:Plot,tutorial:boolean):Plot {
 const old=p.mask;const items=p.items.map((f,i)=>({...f,depth:f.depth??f.y,y:f.depth===undefined?surfaceY(p.seed,i,tutorial):f.y}));
 const mask=old.map(n=>n/28);
 // A previously exposed find must remain available after conversion.
 p.items.forEach((f,i)=>{if(f.state!=='buried')return;let sum=0,n=0;for(let yy=Math.floor((f.y-8)/10);yy<=Math.floor((f.y+8)/10);yy++)for(let xx=Math.floor((f.x-8)/10);xx<=Math.floor((f.x+8)/10);xx++)if(xx>=0&&xx<36&&yy>=0&&yy<28){sum+=old[yy*36+xx];n++;}if(n&&sum/n>=.55){const next=items[i];for(let yy=Math.floor((next.y-8)/10);yy<=Math.floor((next.y+8)/10);yy++)for(let xx=Math.floor((next.x-8)/10);xx<=Math.floor((next.x+8)/10);xx++)if(xx>=0&&xx<36&&yy>=0&&yy<28)mask[yy*36+xx]=Math.max(mask[yy*36+xx],Math.min(1,((next.depth??0)+12)/280));}});
 return {...p,mask,items};
}
export function migrate(raw:unknown):State {
 if(!raw||typeof raw!=='object')throw Error('セーブ形式が不正です');const r=raw as State;if(r.saveVersion>2)throw Error('新しいバージョンのセーブです');
 const defaults=createState(),s={...defaults,...structuredClone(r),settings:{...defaults.settings,...r.settings}};
 if(!Array.isArray(s.explorationAreas)||!s.explorationAreas.length||!Number.isFinite(s.currentFN)||s.currentFN<0||!Number.isInteger(s.currentPlot)||s.currentPlot<0||s.currentPlot>=s.explorationAreas.length)throw Error('セーブが破損しています');
 if(s.explorationAreas.some(p=>p.mask.length!==1008||p.mask.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('地形データが不正です');
 // v2 uses the same normalized depth representation in 0.1.1 and 0.1.2.
 // Validate it without scaling or resetting any valid excavation progress.
 for(const p of s.explorationAreas)if(!Array.isArray(p.items)||p.items.some(f=>!Number.isFinite(f.x)||!Number.isFinite(f.y)||f.x<0||f.x>=360||f.y<0||f.y>=((r.saveVersion??0)<2?plotDepthScale(p)+1:280)||f.depth!==undefined&&(!Number.isFinite(f.depth)||f.depth<0||f.depth>plotDepthScale(p))))throw Error('お宝の位置・深度データが不正です');
 s.handFeedback=(Array.isArray(s.handFeedback)?s.handFeedback:[]).filter(h=>h&&typeof h.plotId==='string'&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&Number.isFinite(h.attemptedAt)&&typeof h.hinted==='boolean');
 for(const p of s.explorationAreas)if(p.beachDepthVersion!==undefined&&p.beachDepthVersion!==1)throw Error('未知の深層形式です');
 const oldVersion=(r.saveVersion??0)<2;
 const plots=oldVersion?s.explorationAreas.map((p,i)=>convertPlot(p,i===0)):s.explorationAreas;
 s.exploredPlots=Math.max(1,r.exploredPlots??plots.length);s.sandSampled ||= s.sandBatches.length>0;
 s.retainedFinds=[...(s.retainedFinds??[]),...plots.filter((_,i)=>i!==s.currentPlot).flatMap(p=>p.items).filter(f=>f.state==='stored'||f.state==='batch')];
 s.explorationAreas=[plots[s.currentPlot]];s.currentPlot=0;s.saveVersion=2;
 s.sandBatches=s.sandBatches.filter(b=>!b.processed);const ids=new Set([...s.explorationAreas[0].items,...s.retainedFinds].filter(f=>f.state!=='paid').map(f=>f.uid));s.activeContracts=s.activeContracts.filter(uid=>ids.has(uid));
 for(const f of [...s.explorationAreas[0].items,...s.retainedFinds]){if(f.initialQuality!==undefined&&(!Number.isFinite(f.initialQuality)||f.initialQuality<0))throw Error('品質データが不正です');}
 for(const p of s.explorationAreas)for(const m of p.surveyMarks??[])if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||!Number.isFinite(m.strength)||m.strength<0||m.strength>1||!Array.isArray(m.targets))throw Error('探知データが不正です');
 for(const b of s.sandBatches)if(!Number.isFinite(b.cells)||b.cells<0||Object.values(b.residueWork??{}).some(n=>!Number.isFinite(n)||n<0))throw Error('砂の残量データが不正です');
 for(const b of s.sandBatches)if(b.screenedUnits!==undefined&&(!Number.isFinite(b.screenedUnits)||b.screenedUnits<0||b.screenedUnits>b.cells+1e-6))throw Error('砂の選別データが不正です');
 if(s.riverSession&&(!s.explorationAreas[0].areaId?.startsWith('R-')||!Number.isFinite(s.riverSession.progress)||s.riverSession.progress<0||s.riverSession.progress>1))delete s.riverSession;
 for(const f of [...s.explorationAreas[0].items,...s.retainedFinds])if(f.weight!==undefined&&(!Number.isFinite(f.weight)||f.weight<=0))throw Error('重量データが不正です');
 // Optional fields are initialized lazily: v2 depth, inventories and old quality remain unchanged.
 if(s.world){if(s.world.version!==1||!Array.isArray(s.world.unlocked)||s.world.unlocked.some(id=>!environments[id])||Object.keys(s.world.visits).some(id=>!environments[id])||Object.values(s.world.visits).some(n=>!Number.isSafeInteger(n)||n<0))throw Error('探索進捗が不正です');s.world.milestones=collectionMilestones(s);}
 for(const p of s.explorationAreas)if(p.environment&&Object.values(p.environment).some(n=>!Number.isFinite(n)||n<0))throw Error('環境条件が不正です');
 compactHistory(s);validateLedger(s);validateGold(s);restoreAutomation(s);validateLines(s);migrateEquipment(s);refresh(s);return s;
}
const revisions=new Map<string,number>(),sequences=new Map<string,number>();
let saveAllowed=()=>true,sessionOwner:string|undefined;
export function configureSaveSession(allowed:()=>boolean,owner:string){saveAllowed=allowed;sessionOwner=owner;}
export async function load(scope:SaveScope='normal'):Promise<State|null>{
 const key=saveKey(scope);let backup:State|null=null,backupError:unknown;try{const raw=localStorage.getItem(key);backup=raw?migrate(JSON.parse(raw)):null;}catch(e){backupError=e;}
 let primary:State|null=null;try{const db=await open(key);const raw=await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('saves'),r=tx.objectStore('saves').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});primary=raw?migrate(raw):null;}catch(e){if(!backup)throw e;}
 revisions.set(key,primary?.saveRevision??0);sequences.set(key,Math.max(primary?.saveSequence??0,backup?.saveSequence??0));
 if(backup&&(!primary||(backup.saveSequence??0)>(primary.saveSequence??0)||(backup.saveSequence??0)===(primary.saveSequence??0)&&backup.lastSavedAt>primary.lastSavedAt))return backup;if(primary)return primary;if(backupError)throw backupError;return backup;
}
let queue:Promise<unknown>=Promise.resolve();
function capture(s:State,key:string){compactHistory(s);s.lastSavedAt=new Date().toISOString();const sequence=(sequences.get(key)??s.saveSequence??0)+1;if(!Number.isSafeInteger(sequence))throw Error('保存連番の上限です');sequences.set(key,sequence);s.saveSequence=sequence;return structuredClone(s);}
export function save(s:State,scope:SaveScope='normal'){
 if(!saveAllowed())return Promise.reject(Error('別のタブが進行中です。このタブを再開してから保存してください'));
 const key=saveKey(scope),snapshot=capture(s,key);let backupError:unknown;try{localStorage.setItem(key,JSON.stringify(snapshot));}catch(e){backupError=e;}
 queue=queue.catch(()=>{}).then(async()=>{if(!saveAllowed())throw Error('進行権限が失われました');const db=await open(key),expected=revisions.get(key)??0;snapshot.saveRevision=expected+1;try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),r=store.get('current'),lease=scope==='normal'&&sessionOwner?store.get('session'):undefined;let stateReady=false,leaseReady=!lease;const commit=()=>{if(!stateReady||!leaseReady)return;if((r.result?.saveRevision??0)!==expected||lease&&(lease.result?.owner!==sessionOwner||lease.result.expires<=Date.now())){tx.abort();return;}store.put(snapshot,'current');};r.onsuccess=()=>{stateReady=true;commit();};if(lease)lease.onsuccess=()=>{leaseReady=true;commit();};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(Error('保存競合を検出しました。最新のセーブから再開してください'));});revisions.set(key,expected+1);s.saveRevision=expected+1;if(backupError)console.warn('バックアップ保存失敗',backupError);}finally{db.close();}});return queue;
}
export function emergencySave(s:State,scope:SaveScope='normal'){if(!saveAllowed())return;const key=saveKey(scope);try{const snapshot=capture(s,key);localStorage.setItem(key,JSON.stringify(snapshot));}catch{}}
