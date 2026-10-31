// Separate IndexedDB: normal gallery eviction never opens this database.
export const HOMEWARD_ARCHIVE_DB='orbit-maker-homeward-archive';
export class HomewardArchive {
 constructor(factory){try{this.factory=factory===undefined?globalThis.indexedDB:factory;}catch{this.factory=null;}this.opening=null;}
 open(){
  if(!this.factory)return Promise.reject(Error('HOMEWARDの重要記録を保存できません。IndexedDBが利用できません。'));
  if(!this.opening)this.opening=new Promise((resolve,reject)=>{
   const request=this.factory.open(HOMEWARD_ARCHIVE_DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('flights'))request.result.createObjectStore('flights',{keyPath:'key'});};
   request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('重要記録の保存が別の画面で使用中です。'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
  }).catch(error=>{this.opening=null;throw error;});return this.opening;
 }
 async transaction(mode,operation){const db=await this.open();return new Promise((resolve,reject)=>{
  const tx=db.transaction('flights',mode);let result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error??Error('重要記録の保存が中断されました。'));tx.onerror=()=>{};
  try{operation(tx.objectStore('flights'),value=>{result=value;});}catch(error){tx.abort();reject(error);}
 });}
 list(){return this.transaction('readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result);});}
 async find(id){return (await this.list()).filter(row=>row.record.id===id).sort((a,b)=>Number(Boolean(a.record.partial))-Number(Boolean(b.record.partial))||b.record.duration-a.record.duration)[0]?.record??null;}
 async retry(operation){let last;for(let i=0;i<3;i++){try{return await operation();}catch(error){last=error;if(i<2)await new Promise(resolve=>setTimeout(resolve,50*(i+1)));}}throw last;}
 saveCheckpoint(record){
  if(!record?.id||!record.frames?.length||record.frames.length>4096)return Promise.reject(Error('段階保存の形式が不正です。'));
  const key=`partial:${record.id}`;
  return this.retry(()=>this.transaction('readwrite',(store,done)=>{const r=store.getAll();r.onsuccess=()=>{
   const rows=r.result,existing=rows.find(row=>row.key===key);
   if(existing&&(!existing.record.partial||existing.record.duration>record.duration)){done(existing.record.id);return;}
   if(!existing&&rows.filter(row=>row.key.startsWith('partial:')).length>=30)throwQuota();
   else{store.put({key,record:structuredClone(record),savedAt:Date.now()});done(record.id);}
   function throwQuota(){// Abort the transaction: protected flights are never evicted.
    store.transaction.abort();
   }
  };}));
 }
 saveFirst(key,record){return this.retry(()=>this.saveFirstAttempt(key,record));}
 saveFirstAttempt(key,record){
  if(!record?.frames?.length||record.frames.length>4096)return Promise.reject(Error('重要記録の形式または点数が不正です。'));
  return this.transaction('readwrite',(store,done)=>{const r=store.get(key);r.onsuccess=()=>{
   if(r.result){done(r.result.record.id);return;}
   // One immutable first record per sector / first docking site. No eviction.
   store.add({key,record:structuredClone(record),savedAt:Date.now()});done(record.id);
  };});
 }
}
export async function migrateHomewardRecords(progress,gallery,archive){
 const rows=await gallery.list(),missing=[];let migrated=0;
 for(const id of progress.state.cleared){
  const entry=progress.state.journal[id];if(!entry?.clearFlightId||entry.importantFlightId)continue;
  const existing=await archive.find(entry.clearFlightId),record=existing??rows.find(row=>row.id===entry.clearFlightId);
  if(!record){missing.push(id);continue;}
  const reference=await archive.saveFirst(`sector:${id}:first`,record);progress.log(id,{importantFlightId:reference});migrated++;
 }
 return {migrated,missing};
}
