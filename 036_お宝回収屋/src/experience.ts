import type {State} from './engine';
export const firstEventKeys=['start','dig','find','wash','reward','purchase','tool','layer','area','machine','automation'] as const;
export type FirstEvent=typeof firstEventKeys[number];
export interface ExperienceEvent {id:FirstEvent;order:number;time:number;operations:number;fn:number;tools:string[];area:string;found:number;work:number;}
export interface Experience {version:1;guide:boolean;legacy:boolean;operations:number;events:ExperienceEvent[];recentBook:string[];}
export const freshExperience=():Experience=>({version:1,guide:true,legacy:false,operations:0,events:[],recentBook:[]});
export function uxAction(s:State){if(s.experience)s.experience.operations++;}
export function firstEvent(s:State,id:FirstEvent){const x=s.experience;if(!x||x.events.some(e=>e.id===id))return;x.events.push({id,order:x.events.length+1,time:s.playTime,operations:x.operations,fn:s.currentFN,tools:[...s.ownedTools],area:s.explorationAreas[0].areaId??'B-A',found:Object.values(s.discoveredTreasures).reduce((n,d)=>n+d.count,0),work:s.digWorkSeconds??0});}
export function effects(s:State){return s.settings.effects??'full';}
export function validateExperience(s:State,wasMissing=false){if(wasMissing)s.experience={...freshExperience(),guide:false,legacy:true};const x=s.experience;if(!x||x.version!==1||typeof x.guide!=='boolean'||typeof x.legacy!=='boolean'||!Number.isSafeInteger(x.operations)||x.operations<0||!Array.isArray(x.events)||x.events.length>11||new Set(x.events.map(e=>e.id)).size!==x.events.length||x.events.some((e,i)=>!firstEventKeys.includes(e.id)||e.order!==i+1||![e.time,e.operations,e.fn,e.found,e.work].every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(e.tools)||e.tools.length>46||typeof e.area!=='string')||!Array.isArray(x.recentBook)||x.recentBook.length>12)throw Error('プレイ案内の保存が不正です');if(s.settings.effects!==undefined&&!['full','light','off'].includes(s.settings.effects))throw Error('演出設定が不正です');}
