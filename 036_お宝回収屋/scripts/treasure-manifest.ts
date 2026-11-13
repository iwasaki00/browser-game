import {writeFileSync,readFileSync,existsSync} from 'node:fs';import {treasures,income} from '../src/data';import {treasureSpriteMap} from '../src/treasure-sprite-map';
if(treasures.length!==300||new Set(treasures.map(t=>t.id)).size!==300)throw Error('300品のマスターを確認してください');
const quote=(x:unknown)=>'"'+String(x).replaceAll('"','""')+'"';
const rows:unknown[][]=[['treasureId','name','field','category','rarity','sheet','col','row','cellSize','imagePath','spriteAvailable']];
for(const t of treasures){const sprite=treasureSpriteMap[t.id],path='src/assets/treasures/sheets/'+sprite.sheet+'.png';rows.push([t.id,t.name,t.category,t.kind,t.rarity,sprite.sheet,sprite.col,sprite.row,sprite.size,path,sprite.available&&existsSync(path)]);}
writeFileSync('docs/TREASURE_ASSET_MANIFEST.csv',rows.map(r=>r.map(quote).join(',')).join(String.fromCharCode(10))+String.fromCharCode(10));
const file='docs/TREASURE_MASTER_300.md',old=readFileSync(file,'utf8'),start=old.indexOf('|B001|'),end=old.indexOf('\nレア度の種類数',start);if(start<0||end<0)throw Error('一覧の境界が見つかりません');const table=treasures.map(t=>'|'+[t.id,t.name,t.category,t.kind,t.rarity,t.baseValueFN,income[t.id],t.locations.join(','),t.conditions].join('|')+'|').join('\n');writeFileSync(file,old.slice(0,start)+table+'\n'+old.slice(end));console.log('300 treasure rows and asset mappings generated');
