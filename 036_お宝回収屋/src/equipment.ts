import {tool} from './data';
import type {State} from './engine';
export const equipmentCategory=(s:State)=>s.explorationAreas[0].areaId?.[0]??'B';
function clean(s:State,ids:string[],category:string){return Array.from({length:4},(_,i)=>{const id=ids[i]??'';return id==='hand'||s.ownedTools.includes(id)&&tool(id)?.category===category&&tool(id)?.implementationStatus==='available'?id:'';});}
export function rememberEquipment(s:State){const category=equipmentCategory(s);s.loadouts??={};s.loadouts[category]=clean(s,s.quickSlots,category);}
export function restoreEquipment(s:State){const category=equipmentCategory(s);s.quickSlots=clean(s,s.loadouts?.[category]??['hand','','',''],category);s.equippedTools=s.quickSlots.filter(id=>id&&id!=='hand');}
export function migrateEquipment(s:State){if(s.loadouts)return;const legacy=[...s.quickSlots];if(!legacy.some(id=>id&&id!=='hand'&&tool(id)?.category!==equipmentCategory(s)))return;s.loadouts={};for(const category of ['B','R','G'])s.loadouts[category]=clean(s,legacy,category);restoreEquipment(s);}
export function assignPurchased(s:State,id:string){const category=tool(id)!.category,current=equipmentCategory(s);s.loadouts??={};const slots=category===current?s.quickSlots:s.loadouts[category]??['hand','','',''];const i=slots.indexOf('');if(i>=0)slots[i]=id;s.loadouts[category]=[...slots];if(category===current){s.quickSlots=slots;s.equippedTools=slots.filter(id=>id&&id!=='hand');}}
