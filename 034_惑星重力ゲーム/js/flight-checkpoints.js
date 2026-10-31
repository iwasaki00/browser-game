// One outstanding IndexedDB write. A newer prefix replaces queued prefixes for
// the same flight; a final record can never be superseded by an older prefix.
export class FlightCheckpoints {
 constructor(archive,{onSaved=()=>{},onError=()=>{}}={}){Object.assign(this,{archive,onSaved,onError});this.pending=new Map();this.running=false;this.finished=new Set();this.idle=Promise.resolve();}
 enqueue(record,sectorId){
  if(!record||this.finished.has(record.id))return this.idle;
  if(!record.partial){this.finished.add(record.id);if(this.finished.size>100)this.finished.delete(this.finished.values().next().value);}
  const old=this.pending.get(record.id);if(!old||record.duration>=old.record.duration)this.pending.set(record.id,{record:structuredClone(record),sectorId});
  if(!this.running){this.running=true;this.idle=this.drain();}return this.idle;
 }
 async drain(){try{while(this.pending.size){const [id,item]=this.pending.entries().next().value;this.pending.delete(id);try{const reference=await this.archive.saveCheckpoint(item.record);this.onSaved(item,reference);}catch(error){this.onError(error,item);}}}finally{this.running=false;}}
}
