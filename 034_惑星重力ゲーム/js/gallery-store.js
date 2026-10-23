export const GALLERY_DB='orbit-maker-gallery';
export const AUTO_LIMIT=20,FAVORITE_LIMIT=30;
export class GalleryError extends Error{}
export class GalleryStore{
 constructor(factory){try{this.factory=factory===undefined?globalThis.indexedDB:factory;}catch{this.factory=null;}this.opening=null;}
 async open(){
  if(!this.factory)throw new GalleryError('ギャラリー保存を利用できません。ゲームは続けられます。');
  if(!this.opening)this.opening=new Promise((resolve,reject)=>{
   const request=this.factory.open(GALLERY_DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('flights'))request.result.createObjectStore('flights',{keyPath:'id'});};
   request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new GalleryError('ギャラリーが別の画面で使用中です。'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
  }).catch(error=>{this.opening=null;throw error;});
  return this.opening;
 }
 async transaction(mode,operation){
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('flights',mode),store=tx.objectStore('flights');let result;
   tx.oncomplete=()=>resolve(result);
   tx.onabort=()=>reject(tx.error??new GalleryError('ギャラリーへの保存が中断されました。'));
   tx.onerror=()=>{};
   try{operation(store,value=>{result=value;},tx);}catch(error){tx.abort();reject(error);}
  });
 }
 list(){return this.transaction('readonly',(store,done)=>{const r=store.getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id)));});}
 save(record){return this.transaction('readwrite',(store,done)=>{
  const request=store.getAll();request.onsuccess=()=>{
   // Read, insert and eviction share a single serializable transaction.
   const rows=request.result.filter(r=>r.id!==record.id);rows.push({...record,favorite:false});
   const autos=rows.filter(r=>!r.favorite).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
   store.put({...record,favorite:false});for(const old of autos.slice(AUTO_LIMIT))store.delete(old.id);done(record.id);
  };
 });}
 setFavorite(id,favorite){return this.transaction('readwrite',(store,done)=>{
  const r=store.getAll();r.onsuccess=()=>{
   const rows=r.result,record=rows.find(r=>r.id===id);if(!record){done(false);return;}
   if(favorite&&!record.favorite&&rows.filter(r=>r.favorite).length>=FAVORITE_LIMIT){done(false);return;}
   record.favorite=favorite;store.put(record);
   const autos=rows.filter(r=>!r.favorite).sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
   for(const old of autos.slice(AUTO_LIMIT))store.delete(old.id);done(true);
  };
 });}
 delete(id){return this.transaction('readwrite',(store,done)=>{store.delete(id);done(true);});}
}
export function galleryErrorMessage(error){
 if(error?.name==='QuotaExceededError')return '保存容量が不足しています。ギャラリーの不要な記録を削除してください。';
 return error instanceof GalleryError?error.message:'軌道を保存・読込できませんでした。ゲームは続けられます。';
}
