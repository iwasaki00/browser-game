import type {State} from './engine';
// Inspect before cloning/migration; imported data must remain inert JSON.
export function validateJSONTree(raw:unknown){
 const pending:{value:unknown;depth:number}[]=[{value:raw,depth:0}],seen=new WeakSet<object>();
 const identifiers=new Set(['id','uid','playerId','instanceId','plotId','batchId','source']);
 while(pending.length){const {value,depth}=pending.pop()!;if(depth>100)throw Error('保存データの入れ子が深すぎます');

 if(value===null||typeof value!=='object')continue;if(seen.has(value))continue;seen.add(value);
 if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('保存データは通常のJSONオブジェクトにしてください');
 for(const [key,child] of Object.entries(value)){
 if(['__proto__','prototype','constructor'].includes(key))throw Error('保存データに危険なオブジェクトキーがあります');
 if(identifiers.has(key)&&(typeof child!=='string'||/[<>"'&]/.test(child)||child.length>512))throw Error('保存データの識別子が不正です');
 pending.push({value:child,depth:depth+1});
 }
 }
}
export function validateSandReferences(s:State){
 const batches=new Set<string>(),assigned=new Set<string>(),finds=new Map([...s.explorationAreas[0].items,...s.retainedFinds].map(f=>[f.uid,f]));
 for(const b of s.sandBatches){
 if(typeof b.id!=='string'||!b.id||batches.has(b.id)||!Array.isArray(b.items)||typeof b.processed!=='boolean'||new Set(b.items).size!==b.items.length)throw Error('砂バッチID・内容物が不正です');batches.add(b.id);
 for(const uid of b.items){const f=finds.get(uid);if(typeof uid!=='string'||!f||f.state!=='batch'||assigned.has(uid))throw Error('砂の個体参照が矛盾しています');assigned.add(uid);}
 for(const [uid,n] of Object.entries(b.allocations??{}))if(!Number.isFinite(n)||n<0||n>b.cells+1e-6)throw Error('砂の配分量が不正です');
 for(const uid of Object.keys(b.residueWork??{}))if(!b.items.includes(uid))throw Error('砂の残渣参照が不正です');
 }
}
