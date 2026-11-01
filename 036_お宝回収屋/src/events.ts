import type {State} from './engine';
export interface GameEvent {time:number;type:string;detail:string;}
export function logEvent(s:State,type:string,detail=''){(s.events??=[]).push({time:s.playTime,type,detail});if(s.events.length>100)s.events.splice(0,s.events.length-100);}
