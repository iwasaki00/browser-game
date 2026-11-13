import entries from './treasure-sprite-map.json';
export const SHEET_NAMES=['beach_nature_sheet','beach_daily_sheet','beach_valuable_sheet','river_metal_sheet','river_tool_sheet','river_rare_sheet','gold_stone_sheet','gold_mineral_sheet','gold_rare_sheet'] as const;
export type TreasureSheet=typeof SHEET_NAMES[number];
export interface TreasureSprite {treasureId:string;sheet:TreasureSheet;col:number;row:number;size:32;field:string;category:string;rarity:string;available:boolean;}
export const CELL_SIZE=32,SHEET_COLUMNS=8,SHEET_ROWS=5;
export const treasureSpriteMap:Readonly<Record<string,TreasureSprite>>=Object.fromEntries(entries.map(e=>[e.treasureId,e as TreasureSprite]));
export function validSpriteCell(entry:TreasureSprite|undefined):entry is TreasureSprite{return !!entry&&SHEET_NAMES.includes(entry.sheet)&&entry.size===CELL_SIZE&&Number.isInteger(entry.col)&&entry.col>=0&&entry.col<SHEET_COLUMNS&&Number.isInteger(entry.row)&&entry.row>=0&&entry.row<SHEET_ROWS;}
