import fs from 'node:fs';import assert from 'node:assert/strict';
const map=JSON.parse(fs.readFileSync('src/treasure-sprite-map.json','utf8')),plan=JSON.parse(fs.readFileSync('artwork/treasure-final/plan.json','utf8'));
assert.equal(map.filter(e=>e.available).length,300,'Finish all sprites first');
let s=fs.readFileSync('README.md','utf8');s=s.split('\n').map(line=>line.includes('お宝画像は9枚')?line.split('お宝画像は9枚')[0]+'お宝画像は9枚の32×32セルシートで管理し、砂浜・川底・河原が各100件、全300件を専用ドット絵のPNGで表示します。第1〜3弾114件を保持し、第4〜6弾で186件を制作しました。[全300点の制作・検証結果](docs/TREASURE_ART_FINAL.md)・[画像管理と制作手順](docs/TREASURE_SPRITE_PLAN.md)。画像読込失敗時のSVG代替表示は維持しています。ゲーム仕様・バランス・セーブ形式・図鑑レイアウト・Versionは変更していません。':line).join('\n');fs.writeFileSync('README.md',s);
const file='docs/TREASURE_SPRITE_PLAN.md';s=fs.readFileSync(file,'utf8');
s=s.split('\n').map(line=>{
 if(line.startsWith('1セル32×32'))return '1セル32×32、8列×5行、256×160の背景透過RGBA PNGです。col/rowは0始まり。300件すべてに一意のセルがあり、全300件を専用ドット絵で表示します。各分野100件、未制作0件、未割当0件、空き60セルです。第1〜3弾114件を保持し、第4弾60件・第5弾60件・第6弾66件を追加しました。[最終制作・照合結果](TREASURE_ART_FINAL.md)。';
 if(line.startsWith('## PNG表示対象'))return '## PNG表示対象（専用ドット絵300件）';
 if(line.startsWith('- available=trueの'))return '- available=trueの300件を専用PNGで表示します。通常時のSVGフォールバックは0件です。未割当・available=false・セル不正・画像読込エラー・シート寸法不正の場合のSVG代替は維持します。失敗したシートはそのページ中は再試行せず、再読込で再試行します。';
 if(line.startsWith('現在の9シートは'))return '現在の9シートは専用ドット絵300件を含みます。内蔵image_genで1品ずつ新規制作し、32×32の透過・材質別パレットへ仕上げています。外部素材の取得やSVG縮小は使用していません。第1〜3弾の画風を基準とし、原寸の輪郭・穴・部品の形・結晶や粒の違いを優先しました。';
 if(line.startsWith('制作プロンプト・最終ドットデータは'))return '制作プロンプト・生成元・最終画素・個別PNGはartwork/treasure-wave1/〜treasure-wave6/に記録しています。第4〜6弾の対象・再開記録はartwork/treasure-final/、全300件の最終一覧はdocs/treasure-art-final/treasure-index.csvに保存しています。SVG由来の仮PNGと未制作セルは0件です。';
 if(line.startsWith('今後は186件'))return '今後は300件の原寸での判別性評価と実機Safari確認を継続します。R016/R017、R004/R025、G007/G098は既存セルを変更せず最終比較へ掲載しました。制作元・プロンプトの記録を維持します。';
 if(line.startsWith('|')){const parts=line.split('|'),sheet=parts[1],entries=map.filter(e=>e.sheet===sheet);if(entries.length){if(parts.length===9){parts[3]=String(entries.length);parts[4]=String(entries.length);parts[5]='0';parts[6]=String(40-entries.length);return parts.join('|');}if(parts.length===4){parts[2]=entries.sort((a,b)=>a.treasureId.localeCompare(b.treasureId)).map(e=>e.treasureId+' '+plan.find(p=>p.treasureId===e.treasureId).name).join('、');return parts.join('|');}}}
 return line;
}).join('\n');fs.writeFileSync(file,s);
const license='docs/ASSET_LICENSE_MANIFEST.md';s=fs.readFileSync(license,'utf8').replace('現行は専用PNG114件','第3弾完了時は専用PNG114件');if(!s.includes('## 専用ドット絵 第4〜6弾'))s=s.replace('\n','\n\n## 専用ドット絵 第4〜6弾の制作由来（2026-11-14）\n\n未制作186件を内蔵image_genで1品ずつ新規制作し、32px透過PNGとして既存9シートへ配置しました。外部素材の新規取得、SVG変換、色替えだけの流用は行っていません。制作元・フルプロンプト・最終画素・個別PNGはartwork/treasure-wave4/〜treasure-wave6/、全ID一覧と照合結果は[TREASURE_ART_FINAL](TREASURE_ART_FINAL.md)に記録しています。\n\n現行は全300件が専用PNGです。既存114件と空き60枠のRGBAは変更ありません。以下は各制作段階当時の履歴であり、今回、過去のコード・素材の権利関係を再判定していません。\n');fs.writeFileSync(license,s);
console.log('Updated current artwork documentation to300; release status and version unchanged.');