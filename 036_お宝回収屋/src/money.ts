import type {State} from './engine';
import {STATIC_DEBUG} from './build-mode';
export const moneyLabel=(s:State)=>STATIC_DEBUG?'∞':s.currentFN.toLocaleString();
export function canSpend(s:State,amount:number){return Number.isFinite(amount)&&amount>=0&&(STATIC_DEBUG||s.currentFN>=amount);}
export function spend(s:State,amount:number){if(!canSpend(s,amount))return false;if(!STATIC_DEBUG)s.currentFN-=amount;return true;}
