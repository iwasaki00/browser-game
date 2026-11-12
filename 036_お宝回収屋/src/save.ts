import {validateJSONTree,validateSandReferences} from './save-validation';
import {validateExperience} from './experience';
import {validateFacilities} from './facilities';
import {treasure,tool} from './data';
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
function validateCore(r:State){
 if(!Array.isArray(r.explorationAreas)||!r.explorationAreas.length)throw Error('探索区画データが欠損または不正です');
 if(!Number.isFinite(r.currentFN)||r.currentFN<0||!Number.isFinite(r.totalEarnedFN)||r.totalEarnedFN<0)throw Error('所持FN・累計FNが欠損または不正です');
 if(!r.playerStats||!Number.isFinite(r.playerStats.stamina)||r.playerStats.stamina<0||!Array.isArray(r.playerStats.xp)||r.playerStats.xp.length!==4||r.playerStats.xp.some(n=>!Number.isFinite(n)||n<0))throw Error('身体能力データが欠損または不正です');
 if(!Array.isArray(r.ownedTools)||r.ownedTools.some(id=>typeof id!=='string'||!tool(id))||!r.discoveredTreasures||typeof r.discoveredTreasures!=='object'||Array.isArray(r.discoveredTreasures))throw Error('道具・図鑑データが欠損または不正です');
 for(const [id,d] of Object.entries(r.discoveredTreasures))if(!treasure(id)||!d||!Number.isSafeInteger(d.count)||d.count<0||!Number.isFinite(d.best)||d.best<0||!Array.isArray(d.locations)||!Array.isArray(d.tools))throw Error('図鑑実績が不正です');
 for(const name of ['sandBatches','retainedFinds','activeContracts','collectedTreasures','completedContracts','jackpotHistory','revenueHistory','purchases','equippedTools','quickSlots','unlockedTools'] as const)if(r[name]!==undefined&&!Array.isArray(r[name]))throw Error('保存配列が不正です：'+name);
 for(const name of ['saveSequence','saveRevision','saveVersion'] as const)if(r[name]!==undefined&&(!Number.isSafeInteger(r[name])||r[name]!<0))throw Error('保存管理番号が不正です');
 for(const name of ['playTime','digs','cells'] as const)if(r[name]!==undefined&&(!Number.isFinite(r[name])||r[name]<0))throw Error('作業実績が不正です');
 for(const p of r.explorationAreas??[])if(!p||!Array.isArray(p.items)||p.items.some(f=>!f||!['buried','batch','transit','stored','paid'].includes(f.state)||!Number.isFinite(f.quality)||f.quality<0))throw Error('個体の品質・回収状態が不正です');
}
export function migrate(raw:unknown):State {
 validateJSONTree(raw);if(!raw||typeof raw!=='object')throw Error('セーブ形式が不正です');const r=raw as State;validateCore(r);if(r.saveVersion>2)throw Error('新しいバージョンのセーブです');
 const defaults=createState(),s={...defaults,...structuredClone(r),settings:{...defaults.settings,...r.settings}};
 if(!Array.isArray(s.explorationAreas)||!s.explorationAreas.length||!Number.isFinite(s.currentFN)||s.currentFN<0||!Number.isInteger(s.currentPlot)||s.currentPlot<0||s.currentPlot>=s.explorationAreas.length)throw Error('セーブが破損しています');
 if(s.explorationAreas.some(p=>!Array.isArray(p?.mask)||p.mask.length!==1008||p.mask.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('地形データが不正です');
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
 const individualIds=new Set<string>();for(const f of [...s.explorationAreas[0].items,...s.retainedFinds]){if(!treasure(f.id)||typeof f.uid!=='string'||individualIds.has(f.uid))throw Error('お宝種類または個体IDが不正です');individualIds.add(f.uid);}
 for(const b of s.sandBatches)if(b.resistance!==undefined&&(!Number.isFinite(b.resistance)||b.resistance<1||b.resistance>10))throw Error('砂の環境係数が不正です');
 for(const b of s.sandBatches)if(!Number.isFinite(b.cells)||b.cells<0||Object.values(b.residueWork??{}).some(n=>!Number.isFinite(n)||n<0))throw Error('砂の残量データが不正です');
 for(const b of s.sandBatches)if(b.screenedUnits!==undefined&&(!Number.isFinite(b.screenedUnits)||b.screenedUnits<0||b.screenedUnits>b.cells+1e-6))throw Error('砂の選別データが不正です');
 if(s.riverSession?.workSeconds!==undefined&&(!Number.isFinite(s.riverSession.workSeconds)||s.riverSession.workSeconds<0))throw Error('川底作業時間が不正です');
 if(s.riverSession&&(!s.explorationAreas[0].areaId?.startsWith('R-')||!Number.isFinite(s.riverSession.progress)||s.riverSession.progress<0||s.riverSession.progress>1))delete s.riverSession;
 for(const f of [...s.explorationAreas[0].items,...s.retainedFinds])if(f.weight!==undefined&&(!Number.isFinite(f.weight)||f.weight<=0))throw Error('重量データが不正です');
 // Optional fields are initialized lazily: v2 depth, inventories and old quality remain unchanged.
 if(s.world){if(s.world.version!==1||!Array.isArray(s.world.unlocked)||s.world.unlocked.some(id=>!environments[id])||Object.keys(s.world.visits).some(id=>!environments[id])||Object.values(s.world.visits).some(n=>!Number.isSafeInteger(n)||n<0))throw Error('探索進捗が不正です');s.world.milestones=collectionMilestones(s);}
 for(const p of s.explorationAreas)if(p.environment&&(Object.values(p.environment).some(n=>!Number.isFinite(n)||n<0)||p.environment.current<=0||p.environment.hardness<=0||p.environment.volume<=0))throw Error('環境条件が不正です');
 if(s.digWorkSeconds!==undefined&&(!Number.isFinite(s.digWorkSeconds)||s.digWorkSeconds<0)||s.digBatchSerial!==undefined&&(!Number.isSafeInteger(s.digBatchSerial)||s.digBatchSerial<0))throw Error('掘削時間の保存が不正です');for(const p of s.explorationAreas)if(p.digLayersSeen&&(!Array.isArray(p.digLayersSeen)||p.digLayersSeen.some(n=>!Number.isInteger(n)||n<1||n>10)))throw Error('地層到達記録が不正です');validateSandReferences(s);validateExperience(s,r.experience===undefined);compactHistory(s);validateLedger(s);validateGold(s);restoreAutomation(s);validateFacilities(s);validateLines(s);migrateEquipment(s);refresh(s);return s;
}
const revisions=new Map<string,number>(),sequences=new Map<string,number>(),blocked=new Set<string>(),notices=new Map<string,string>();
let saveAllowed=()=>true,sessionOwner:string|undefined;
export function configureSaveSession(allowed:()=>boolean,owner:string){saveAllowed=allowed;sessionOwner=owner;}
export function saveNotice(scope:SaveScope='normal'){return notices.get(saveKey(scope))??'';}
export function storageMessage(error:unknown){if(error instanceof Error){if(error.name==='QuotaExceededError')return '保存容量が不足しています。JSONを退避し、端末の空き容量を確認してください';if(error.name==='SecurityError')return 'ブラウザが保存を許可していません。サイトの保存設定を確認してください';if(error instanceof SyntaxError)return 'JSONを解析できません。元データは保持しています。別のバックアップを選んでください';return error.message;}return '保存データを確認できません。JSONを退避して再読み込みしてください';}
async function readPrimary(key:string){const db=await open(key);try{return await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('saves'),r=tx.objectStore('saves').get('current');let value:unknown;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('保存読込が中断されました'));});}finally{db.close();}}
export async function saveArchive(scope:SaveScope='normal'){const key=saveKey(scope);let primary:unknown,backup:string|null=null;const errors:string[]=[];try{primary=await readPrimary(key);}catch(e){errors.push(storageMessage(e));}try{backup=localStorage.getItem(key);}catch(e){errors.push(storageMessage(e));}return {format:'finders-recovery-archive',primary,backup,errors};}
export async function load(scope:SaveScope='normal'):Promise<State|null>{
 const key=saveKey(scope);let backup:State|null=null,primary:State|null=null,backupError:unknown,primaryError:unknown;
 try{const raw=localStorage.getItem(key);backup=raw!==null?migrate(JSON.parse(raw)):null;}catch(e){backupError=e;}
 try{const raw=await readPrimary(key);primary=raw!==undefined&&raw!==null?migrate(raw):null;}catch(e){primaryError=e;}
 if(!primary&&!backup&&(backupError||primaryError)){blocked.add(key);throw Error('復元できません：'+storageMessage(primaryError??backupError));}
 blocked.delete(key);revisions.set(key,primary?.saveRevision??0);sequences.set(key,Math.max(primary?.saveSequence??0,backup?.saveSequence??0));
 const fromBackup=!!backup&&(!primary||(backup.saveSequence??0)>(primary.saveSequence??0)||(backup.saveSequence??0)===(primary.saveSequence??0)&&backup.lastSavedAt>primary.lastSavedAt);
 const warning=primaryError||backupError;notices.set(key,warning?'保存の一方を読み込めません。'+(fromBackup?'バックアップを確認して再開できます。':'主保存は復元できました。')+' '+storageMessage(warning):fromBackup&&primary?'最新の端末バックアップを確認して再開できます。':'');return fromBackup?backup:primary;
}
let queue:Promise<unknown>=Promise.resolve();
function guard(key:string,restoring=false){if(!saveAllowed())throw Error('別のタブが進行中です。このタブを再開してから保存してください');if(!restoring&&blocked.has(key))throw Error('保存を保護しています。最新データを読み込むか、確認後にバックアップを復元してください');}
function capture(s:State,key:string){compactHistory(s);s.lastSavedAt=new Date().toISOString();const sequence=Math.max(sequences.get(key)??0,s.saveSequence??0)+1;if(!Number.isSafeInteger(sequence))throw Error('保存連番の上限です');sequences.set(key,sequence);s.saveSequence=sequence;return structuredClone(s);}
function publishBackup(snapshot:State,key:string){try{const existing=localStorage.getItem(key);if(existing){try{const old=migrate(JSON.parse(existing));if(old.playerId===snapshot.playerId&&(old.saveSequence??0)>(snapshot.saveSequence??0))return;}catch{}}localStorage.setItem(key,JSON.stringify(snapshot));notices.set(key,'');}catch(e){notices.set(key,'主保存は完了。端末バックアップの更新に失敗：'+storageMessage(e));}}
async function commit(snapshot:State,key:string,scope:SaveScope,restoring=false){guard(key,restoring);const db=await open(key);let revision=0,writeError:unknown;try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite'),store=tx.objectStore('saves'),r=store.get('current'),lease=scope==='normal'&&sessionOwner?store.get('session'):undefined;let stateReady=false,leaseReady=!lease;
 const put=()=>{if(!stateReady||!leaseReady)return;const current=Number.isSafeInteger(r.result?.saveRevision)?r.result.saveRevision:0,expected=revisions.get(key)??0;if(!restoring&&current!==expected||lease&&(lease.result?.owner!==sessionOwner||lease.result.expires<=Date.now())){blocked.add(key);writeError=Error('保存競合を検出しました。最新のセーブから再開してください');tx.abort();return;}revision=current+1;snapshot.saveRevision=revision;if(restoring)snapshot.saveSequence=Math.max(snapshot.saveSequence??0,Number.isSafeInteger(r.result?.saveSequence)?r.result.saveSequence+1:1);try{store.put(snapshot,'current');}catch(e){writeError=e;tx.abort();}};r.onsuccess=()=>{stateReady=true;put();};if(lease)lease.onsuccess=()=>{leaseReady=true;put();};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(writeError??tx.error??Error('保存処理が中断されました。元データは保持しています'));});
 revisions.set(key,revision);sequences.set(key,Math.max(sequences.get(key)??0,snapshot.saveSequence??0));blocked.delete(key);publishBackup(snapshot,key);return snapshot;
 }finally{db.close();}}
export function save(s:State,scope:SaveScope='normal'){try{const key=saveKey(scope);guard(key);const snapshot=capture(s,key);migrate(snapshot);const work=queue.catch(()=>{}).then(async()=>{await commit(snapshot,key,scope);s.saveRevision=snapshot.saveRevision;});queue=work;return work;}catch(e){return Promise.reject(e);}}
export function emergencySave(s:State,scope:SaveScope='normal'){const key=saveKey(scope);try{guard(key);const snapshot=capture(s,key);migrate(snapshot);publishBackup(snapshot,key);}catch{}}
export const MAX_BACKUP_BYTES=20*1024*1024;
export function parseBackup(text:string){if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw Error('バックアップは20MB以下にしてください');return migrate(JSON.parse(text));}
export function backupJSON(s:State){migrate(s);return JSON.stringify(s,null,2);}
export function restoreBackup(raw:unknown,scope:SaveScope='normal'){try{const key=saveKey(scope);guard(key,true);const s=migrate(raw);const work=queue.catch(()=>{}).then(async()=>{const snapshot=capture(s,key);return commit(snapshot,key,scope,true);});queue=work;return work;}catch(e){return Promise.reject(e);}}
