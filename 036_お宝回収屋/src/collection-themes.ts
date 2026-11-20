import {treasure} from './data';
import type {State} from './engine';

export interface CollectionTheme {id:string;field:string;title:string;ids:readonly string[];}
// Names, artwork and acquisition data remain owned by the treasure master.
export const COLLECTION_THEMES:readonly CollectionTheme[]=[
 {id:'beach-forgotten',field:'B',title:'砂浜の忘れ物',ids:['B002','B003','B005']},
 {id:'river-tools',field:'R',title:'川底の工具',ids:['R004','R025','R026']},
 {id:'natural-gold',field:'G',title:'形の違う自然金',ids:['G007','G008','G009']},
];
export function validateCollectionThemes(themes:readonly CollectionTheme[]=COLLECTION_THEMES){
 const themesSeen=new Set<string>(),itemsSeen=new Set<string>();
 for(const theme of themes){
  if(themesSeen.has(theme.id)||theme.ids.length<3||theme.ids.length>5)throw Error('テーマ定義が不正です');
  themesSeen.add(theme.id);
  for(const id of theme.ids){const t=treasure(id);if(!t||t.category!==theme.field||itemsSeen.has(id))throw Error('テーマのお宝IDが無効または重複しています: '+id);itemsSeen.add(id);}
 }
 return true;
}
export function themeProgress(s:Pick<State,'discoveredTreasures'>,theme:CollectionTheme){
 const found=theme.ids.filter(id=>!!s.discoveredTreasures[id]).length;
 return {found,total:theme.ids.length,complete:found===theme.ids.length};
}
// Snapshot before registration, compare after it. No persisted notification flags.
export function themeSnapshot(s:Pick<State,'discoveredTreasures'>){
 return COLLECTION_THEMES.map(t=>themeProgress(s,t).complete);
}
export function newlyCompletedThemes(before:readonly boolean[],s:Pick<State,'discoveredTreasures'>){
 return COLLECTION_THEMES.filter((t,i)=>before[i]===false&&themeProgress(s,t).complete);
}
