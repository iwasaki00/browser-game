// Imported only by DEBUG LAB; never by the normal application entry.
import {COLLECTION_THEMES} from './collection-themes';
import {createState,reward} from './engine';
import {spawn} from './dev-actions';
export function themeFixture(id:string){
 const theme=COLLECTION_THEMES.find(t=>t.id===id);
 if(!theme)throw Error('テーマIDが不正です');
 const state=createState(20261115);
 for(const item of theme.ids.slice(0,-1)){const f=spawn(state,item,{state:'stored'});reward(state,f.uid);}
 return {state,missing:theme.ids.at(-1)!};
}
