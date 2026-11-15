// Included only in the separate static-debug artifact; never in the normal build.
import {tools} from './data';
import {machines,purchaseMachine} from './automation';
import {STATIC_DEBUG} from './build-mode';
import type {State} from './engine';
export function prepareStaticDebug(s:State){
 if(!STATIC_DEBUG)return;
 for(const t of tools.filter(t=>t.implementationStatus==='available')){
  if(!s.ownedTools.includes(t.id))s.ownedTools.push(t.id);
  if(!s.unlockedTools.includes(t.id))s.unlockedTools.push(t.id);
 }
 for(const m of machines)if(!s.automation?.machines[m.id])purchaseMachine(s,m.id);
}
