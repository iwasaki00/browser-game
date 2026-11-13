import {treasureSpriteMap,validSpriteCell,CELL_SIZE,SHEET_COLUMNS,SHEET_ROWS,type TreasureSprite,type TreasureSheet} from './treasure-sprite-map';
const images:Record<string,string>=typeof window==='undefined'?{}:import.meta.glob<string>('./assets/treasures/sheets/*.png',{eager:true,query:'?url&no-inline',import:'default'});
export const sheetURLs:Readonly<Record<string,string>>=Object.fromEntries(Object.entries(images).map(([path,url])=>[path.split('/').at(-1)!.replace('.png',''),url]));
const failedSheets=new Set<string>();
export function resolveTreasureSprite(id:string,map:Readonly<Record<string,TreasureSprite>>=treasureSpriteMap,urls:Readonly<Record<string,string>>=sheetURLs,failed:ReadonlySet<string>=failedSheets){const entry=map[id];if(!validSpriteCell(entry)||entry.treasureId!==id||!entry.available||!urls[entry.sheet]||failed.has(entry.sheet))return;return {...entry,url:urls[entry.sheet],width:CELL_SIZE*SHEET_COLUMNS,height:CELL_SIZE*SHEET_ROWS};}
export function markTreasureSheetFailed(sheet:string){failedSheets.add(sheet);}
export function treasureSprite(id:string){return resolveTreasureSprite(id);}
export type {TreasureSheet};
