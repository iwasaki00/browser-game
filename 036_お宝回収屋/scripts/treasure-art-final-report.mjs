import fs from 'node:fs';import assert from 'node:assert/strict';
const json=p=>JSON.parse(fs.readFileSync(p,'utf8')),dir='docs/treasure-art-final';
const pixel=json(dir+'/pixel-comparison.json');assert.equal(pixel.complete,true);assert.equal(pixel.available,300);
const lots=[4,5,6].map(w=>({wave:w,pixel:json('docs/treasure-art-wave'+w+'/pixel-comparison.json'),browser:json((w===6?dir:'docs/treasure-art-wave'+w)+'/browser-results.json')}));
for(const l of lots){assert.equal(l.pixel.pendingTargets,0);assert.equal(l.pixel.changedCells,l.wave===6?66:60);assert.equal(l.browser.length,8);for(const r of l.browser)assert.deepEqual(r.errors,[]);}
const legacy=json(dir+'/treasure-sprite-browser-results.json'),prod=json(dir+'/production-results.json');assert.equal(legacy.length,10);assert.equal(prod.length,4);for(const r of [...legacy,...prod])assert.deepEqual(r.errors,[]);
const unit=fs.readFileSync(dir+'/unit-test.log','utf8'),build=fs.readFileSync(dir+'/build.log','utf8');assert.match(unit,/pass 665/);assert.match(unit,/fail 0/);assert.match(build,/built in/);
const plan=json('artwork/treasure-final/plan.json'),map=json('src/treasure-sprite-map.json');
const index=plan.map(e=>({...e,available:map.find(m=>m.treasureId===e.treasureId).available,status:'dedicated-complete'}));fs.writeFileSync('artwork/treasure-final/final-index.json',JSON.stringify(index,null,2)+'\n');
const quote=x=>'"'+String(x).replaceAll('"','""')+'"';const csv=[['ID','正式名称','分野','シート','列0始まり','行0始まり','制作区分','専用画像完成'],...index.map(e=>[e.treasureId,e.name,e.field,e.sheet,e.col,e.row,e.lot==='prior'?'第1〜3弾':'第'+e.lot+'弾',true])];fs.writeFileSync(dir+'/treasure-index.csv',csv.map(r=>r.map(quote).join(',')).join('\n')+'\n');
const summary={version:json('package.json').version,newSprites:186,totalSprites:300,fields:{B:100,R:100,G:100},lotSizes:[60,60,66],lotOutsideRGBA:[300,300,294],finalProtectedRGBA:174,prior114Unchanged:true,spare60Unchanged:true,unitPass:665,unitFail:0,lotBrowserPass:24,legacyBrowserPass:10,productionPass:4,normalProductionSVG:0,build:'PASS',iPhoneSafari:'NOT TESTED',WebKit:'NOT TESTED'};
fs.writeFileSync(dir+'/verification-summary.json',JSON.stringify(summary,null,2)+'\n');
const text=String.raw`# TREASURE ART FINAL — 全300点 専用ドット絵

確認日: 2026-11-14。ゲームVersion: ${summary.version}（変更なし）。

## 最終集計

第1〜3弾の114点を保持し、第4〜6弾で186点を新規制作・組み込みしました。砂浜100点・川底100点・河原100点、計300点すべて専用ドット絵です。未制作0点、保留0点、代替品への置換0点です。

| ロット | 砂浜 | 川底 | 河原 | 新作 | 累計 | 対象外RGBA一致 |
|---|---:|---:|---:|---:|---:|---:|
| 第4弾 | 20 | 20 | 20 | 60 | 174 | 300セル |
| 第5弾 | 20 | 20 | 20 | 60 | 234 | 300セル |
| 第6弾 | 22 | 22 | 22 | 66 | 300 | 294セル |

ID・正式名称・分野・シート・0始まりの列/行・ロットの全300件一覧: [制作前の対象一覧](TREASURE_ART_FINAL_TARGETS.md)、[最終一覧CSV](treasure-art-final/treasure-index.csv)、[最終一覧JSON](../artwork/treasure-final/final-index.json)。再開用の個別完了記録は [progress.json](../artwork/treasure-final/progress.json) です。

## 対象確定と制作

現行のお宝定義・スプライトマップを第1〜3弾の画素記録と照合し、開始時の制作済み114IDとの一致を確認しました。セル割当だけで制作済みとは判定していません。判断不能なIDや座標の食い違いはありませんでした。

第4弾は既存の実生成6,000区画（各エリア500シード、ジャックポットなし）の出現個体数を使用し、未制作品の序盤重み付き順位を優先しました。参考順位は (3A+2B+C+0.5D)/500。これは出現数であり、回収成功率や人間のプレイ時間ではありません。根拠はplan.jsonと第3弾のselection-evidence.jsonに保存しています。

内蔵image_genで1品ずつ専用絵を新規制作し、制作とセル配置を分離しました。SVG変換・色替え・仮画像による完成扱いはありません。左上光、少し上からの視点、材質別の暗い輪郭、32×32透過PNG、約2pxの余白を基準にしています。背景・文字・枠・発光・泥は素材に焼き込んでいません。生成後に切り抜き・32pxへの配置・限定パレット化を行いました。

個別PNG、最終画素、各品のフルプロンプト・生成元は artwork/treasure-wave4/、treasure-wave5/、treasure-wave6/ に保存しています。実行時はプロジェクト内の9シートのみを使い、Codexの生成フォルダーには依存しません。第4弾B068は最初の絵が工具の頭部全体にも見えたため、単独の片刃として再制作しました。既存114点は描き直していません。

## 組み込みと保持検証

9シートの名称・256×160px・8列×5行・32pxセル・全IDの座標を維持しました。各ロット開始前の9枚を保存し、デコードしたRGBAで全360セルを比較しました。対象外は第4弾300セル、第5弾300セル、第6弾294セルが完全一致しました。

最終状態も第4弾開始前と比較し、既存114点と空き60枠、計174セルが完全一致、変更画素0でした。マップの座標・カテゴリ・レア度などは不変で、変更したのは186件のavailableフラグだけです。保護した実行ソース・設定91ファイルも不変です。Version・ゲーム仕様・セーブ形式・図鑑レイアウトは変更していません。

300IDと300セルは1対1で対応し、欠落・重複割当・空セル参照・はみ出しがないことを検証しました。新作186点の個別32px PNGは該当シートセルと全RGBAが一致します。詳細: [全体比較](treasure-art-final/pixel-comparison.json)、[第4弾](treasure-art-wave4/pixel-comparison.json)、[第5弾](treasure-art-wave5/pixel-comparison.json)、[第6弾](treasure-art-wave6/pixel-comparison.json)。

## 比較画像と所見

紛らわしい品に絞り、ID・正式名称・原寸32px・4倍拡大・原寸シルエットを掲載しました。既存品には「既存・変更なし」の印を付けています。

- [compare-B.png](treasure-art-final/compare-B.png): キャップ・メダル・コイン類、細い軸類、薄い貝殻。縁、穴、刻印位置、厚み、突出部を比較できます。
- [compare-R.png](treasure-art-final/compare-R.png): R016/R017、R004/R025、ペンチ類、チャック・歯車類。
- [compare-G.png](treasure-art-final/compare-G.png): G007/G098、薄片・丸粒・ナゲット、黄鉄鉱・黄銅鉱・方鉛鉱、雲母類。

既存R016/R017はどちらも円環状で、原寸では厚み・切れ目の差が小さく、名称なしの識別には注意が必要です。R004/R025は工具の口と調整部を見て区別する組です。G007/G098はともに散粒で、粒数・大きさ・密集度が主な違いです。今回は既存セルを保持しました。第三者による品名を隠した識別試験は未実施です。

比較画像フォルダー（エクスプローラーへ貼り付け）:

    C:\_wk\github\browser-game\036_お宝回収屋\docs\treasure-art-final

ファイル名: compare-B.png / compare-R.png / compare-G.png

## テスト・ブラウザ・本番ビルド

各ロットでChrome/Edge、320×568・390×1000・1280×1000の一覧と代表6品の詳細・洗浄前後、画像失敗2ケースを確認しました。最終ロットでは通常時300点すべてをID・セル単位で照合し、SVGへ落ちないことを検証しました。洗浄前の汚れ、未発見品の共通シルエット、レア度枠・グロー、保存復元、二重報酬防止を維持しています。

| 確認 | 結果 |
|---|---|
| npm.cmd test | 既存665件成功・失敗0 |
| 各ロット専用ブラウザ試験 | 各8ケース、計24ケース成功 |
| 既存素材ブラウザ試験 | 10ケース成功 |
| 本番版ブラウザ試験 | 4ケース成功、通常300点・SVG0点 |
| npm.cmd run build | TypeScript・Vite成功 |
| 本番DEBUG LAB除外 | 強制APIや開発UIが含まれないことを確認 |

本番の画像失敗試験では、対象シートの40品だけSVGへ代替し、他260品は専用画像のまま表示されます。通常時の300点表示とは分けて確認しました。詳細は [verification-summary.json](treasure-art-final/verification-summary.json)、各ロットのbrowser-results.json、最終フォルダーのproduction-results.json・treasure-sprite-browser-results.json・各ログに保存しています。全ての過去の分野別ブラウザ試験を再実行したという意味ではありません。

最終代表の画像: detail-B100.png/dirty-B100.png/washed-B100.png、detail-R094.png/dirty-R094.png/washed-R094.png、detail-G093.png/dirty-G093.png/washed-G093.png。図鑑のページ別一覧も同フォルダーに保存しました。

## iPhone Safari実機の未確認と手順

iPhone Safari実機・WebKitは未確認です。PCの小画面試験を実機確認として扱っていません。

1. Windowsで対象フォルダーから npm.cmd run preview -- --host 0.0.0.0 --port 4173 を実行します。同じLANのiPhone SafariからWindowsのLANアドレス:4173を開きます。
2. 図鑑で各分野の発見済み品を検索し、原寸一覧・詳細・枠色・画像の欠けや横はみ出しを確認します。PCでの代表はB100（金側の懐中時計）、R094（産業用軸受の外輪）、G093（樹枝状自然金）です。未発見なら手元の発見済み品で確認し、これらは回収後に確認してください。
3. 各分野の未洗浄品で、汚れの重なり・洗浄後の画像・レア度演出・ボタンとの非干渉を確認します。未発見欄は共通シルエットであることも確認します。
4. 縦画面で図鑑のスクロール・詳細・閉じる・洗浄の押しやすさ、Safe Areaを確認します。通常セーブを試験用に初期化しないでください。

未完成素材や保留IDはありません。実機Safariと第三者識別試験が未確認事項です。commit・push・公開は行っていません。
`;
fs.writeFileSync('docs/TREASURE_ART_FINAL.md',text.replaceAll('C:\\_wk\\github\\browser-game\\036_お宝回収屋\\docs\\treasure-art-final','C:\\_wk\\github\\browser-game\\036_お宝回収屋\\docs\\treasure-art-final'));
console.log(summary);