# TREASURE ART WAVE 3 — 専用ドット絵60点

確認日: 2026-11-14。ゲームVersionは **1.0.0-rc.1のまま**。ゲーム仕様・セーブ形式・図鑑レイアウトは変更していません。commit・push・公開は行っていません。

## 完成数と対象の確定

砂浜20点・川底20点・河原20点、計60点を新規制作して組み込みました。第1弾12点と第2弾42点を保持し、専用画像は **114点（各分野38点）**、未制作は **186点** です。対象の代替・未完成品はありません。

現行のお宝定義・300件のスプライトマップと、第1弾・第2弾の制作記録を照合しました。作業前の制作済み54点は両弾の記録と一致し、新作60点はすべて作業前 available=false の品です。割当済みセルだけの品は制作済みとして数えていません。対象ID・名称・セルに判断不能な食い違いはありませんでした。

制作前の一覧は [TREASURE_ART_WAVE3_TARGETS.md](TREASURE_ART_WAVE3_TARGETS.md)、機械可読データは [targets.json](../artwork/treasure-wave3/targets.json) に保存しています。以下の列・行はすべて0始まりです。

## 選定の根拠

既存の区画生成処理 generateWorld(seed, area, true) を使用し、12エリアそれぞれ500シード、合計6,000区画をジャックポットなしで生成して、未制作246点の出現個体数を数えました。出現数の詳細は [selection-evidence.json](../artwork/treasure-wave3/selection-evidence.json) に保存しています。これは生成時の出現数であり、回収成功数や人間のプレイ時間の実測ではありません。

序盤A/BエリアのC/Uを優先し、参考順位には (3×A出現数＋2×B出現数＋C出現数＋0.5×D出現数)÷500 を使用しました。現行処理はレア度を C:65/U:25/R:8/SR:1.8/J:0.2 で選び、該当候補から抽選します。マスターの spawnWeight をさらに個体別の倍率として適用した集計ではありません。

順位だけで20点を切らず、丸い品・工具の頭部や開口・同系色の鉱物を比較できる構成にしました。G049（黄銅鉱）、G088（板状砂金）、G098（微細砂金の集合）はC/D側の描き分け確認枠として追加しており、序盤品として扱っていません。

## 砂浜 — 完成20点

| ID | 正式名称 | シート | 列 | 行 | A出現数 | B出現数 |
|---|---|---|---:|---:|---:|---:|
| B003 | 釣り用のおもり | beach_daily_sheet | 2 | 0 | 219 | 483 |
| B015 | 巻貝の蓋 | beach_nature_sheet | 2 | 0 | 119 | 132 |
| B016 | ウニの殻 | beach_nature_sheet | 3 | 0 | 138 | 117 |
| B017 | タコノマクラの殻 | beach_nature_sheet | 4 | 0 | 110 | 149 |
| B018 | イカの甲 | beach_nature_sheet | 5 | 0 | 135 | 136 |
| B019 | 穿孔された貝殻 | beach_nature_sheet | 6 | 0 | 114 | 139 |
| B021 | 軽石の漂着片 | beach_nature_sheet | 0 | 1 | 140 | 123 |
| B024 | フジツボの付いた小石 | beach_nature_sheet | 3 | 1 | 131 | 151 |
| B046 | 穴あき銅銭 | beach_valuable_sheet | 1 | 2 | 79 | 0 |
| B047 | アルミ製記念コイン | beach_valuable_sheet | 2 | 2 | 89 | 0 |
| B048 | 真鍮の乗船トークン | beach_valuable_sheet | 3 | 2 | 117 | 0 |
| B050 | 銅製の商店札 | beach_valuable_sheet | 5 | 2 | 89 | 0 |
| B053 | 釣り用スイベル | beach_daily_sheet | 0 | 1 | 121 | 143 |
| B054 | ルアーの金属リップ | beach_daily_sheet | 1 | 1 | 115 | 151 |
| B056 | 真鍮のサルカン | beach_daily_sheet | 3 | 1 | 125 | 147 |
| B057 | 釣り竿のガイド環 | beach_daily_sheet | 4 | 1 | 132 | 130 |
| B058 | 網の補修針 | beach_daily_sheet | 5 | 1 | 119 | 148 |
| B061 | リールのドラグ座金 | beach_daily_sheet | 0 | 2 | 78 | 79 |
| B063 | 小さな六角レンチ | beach_daily_sheet | 2 | 2 | 185 | 0 |
| B073 | 栓抜き | beach_daily_sheet | 4 | 3 | 120 | 137 |

出現数は各エリア500区画中の個体数です。同じ区画で複数出現する場合を含みます。

## 川底 — 完成20点

| ID | 正式名称 | シート | 列 | 行 | A出現数 | B出現数 |
|---|---|---|---:|---:|---:|---:|
| R014 | 蝶ナット | river_metal_sheet | 6 | 0 | 85 | 81 |
| R015 | 割りピン | river_metal_sheet | 7 | 0 | 79 | 77 |
| R016 | 平座金 | river_metal_sheet | 0 | 1 | 98 | 97 |
| R017 | ばね座金 | river_metal_sheet | 1 | 1 | 71 | 67 |
| R019 | U字ボルト | river_metal_sheet | 3 | 1 | 93 | 71 |
| R020 | リベット | river_metal_sheet | 4 | 1 | 79 | 82 |
| R021 | ホースバンド | river_metal_sheet | 5 | 1 | 94 | 80 |
| R022 | 金属製アンカー鋲 | river_metal_sheet | 6 | 1 | 93 | 89 |
| R023 | 歯付き座金 | river_metal_sheet | 7 | 1 | 75 | 82 |
| R024 | 鋼製ヒンジピン | river_metal_sheet | 0 | 2 | 83 | 77 |
| R026 | ラジオペンチ | river_tool_sheet | 5 | 0 | 105 | 74 |
| R028 | 六角ソケット | river_tool_sheet | 7 | 0 | 82 | 103 |
| R029 | ラチェットハンドル | river_tool_sheet | 0 | 1 | 70 | 41 |
| R030 | 鉄製ハンマーの頭 | river_tool_sheet | 1 | 1 | 80 | 39 |
| R032 | 金切り鋸の枠 | river_tool_sheet | 3 | 1 | 85 | 77 |
| R033 | タガネ | river_tool_sheet | 4 | 1 | 92 | 75 |
| R034 | ポンチ | river_tool_sheet | 5 | 1 | 88 | 86 |
| R035 | パイプレンチの顎 | river_tool_sheet | 6 | 1 | 85 | 35 |
| R037 | 工具用エクステンションバー | river_tool_sheet | 0 | 2 | 97 | 85 |
| R038 | 差し金 | river_tool_sheet | 1 | 2 | 89 | 94 |

出現数は各エリア500区画中の個体数です。同じ区画で複数出現する場合を含みます。

## 河原 — 完成20点

| ID | 正式名称 | シート | 列 | 行 | A出現数 | B出現数 |
|---|---|---|---:|---:|---:|---:|
| G015 | 斜長石の小片 | gold_stone_sheet | 4 | 0 | 219 | 0 |
| G016 | 黒雲母の薄片 | gold_stone_sheet | 5 | 0 | 255 | 0 |
| G017 | 白雲母の薄片 | gold_stone_sheet | 6 | 0 | 253 | 0 |
| G019 | 角閃石の粒 | gold_stone_sheet | 0 | 1 | 222 | 0 |
| G020 | 普通輝石の粒 | gold_stone_sheet | 1 | 1 | 243 | 0 |
| G024 | 緑泥石の集合片 | gold_stone_sheet | 5 | 1 | 233 | 0 |
| G049 | 黄銅鉱の粒 | gold_mineral_sheet | 4 | 3 | 0 | 0 |
| G062 | 碧玉の礫 | gold_stone_sheet | 7 | 1 | 227 | 347 |
| G063 | 燧石の礫 | gold_stone_sheet | 0 | 2 | 237 | 371 |
| G064 | チャートの礫 | gold_stone_sheet | 1 | 2 | 247 | 357 |
| G065 | 黒曜石の破片 | gold_stone_sheet | 2 | 2 | 238 | 325 |
| G066 | 軽石の礫 | gold_stone_sheet | 3 | 2 | 240 | 358 |
| G069 | 花崗岩の礫 | gold_stone_sheet | 6 | 2 | 239 | 372 |
| G072 | 片麻岩の礫 | gold_stone_sheet | 1 | 3 | 212 | 366 |
| G075 | 礫岩の小片 | gold_stone_sheet | 4 | 3 | 210 | 328 |
| G081 | 石英脈を含む角礫 | gold_stone_sheet | 2 | 4 | 208 | 501 |
| G082 | 長石を含むペグマタイト片 | gold_stone_sheet | 3 | 4 | 180 | 485 |
| G083 | 石英と黄鉄鉱の共生標本 | gold_stone_sheet | 4 | 4 | 185 | 501 |
| G088 | 板状砂金 | gold_rare_sheet | 1 | 1 | 0 | 0 |
| G098 | 微細砂金の集合 | gold_rare_sheet | 3 | 2 | 0 | 0 |

出現数は各エリア500区画中の個体数です。同じ区画で複数出現する場合を含みます。

## 制作方法と比較画像

第1弾の contact-sheet.png と第2弾の contact-B/R/G.png を参照し、内蔵画像生成で1品ずつ専用絵を新規制作しました。既存SVGの変換・単なる色替えは使用していません。生成とセル配置は別工程です。生成プロンプトと出典ファイルは [generation.json](../artwork/treasure-wave3/generation.json)、最終パレットと画素は [pixels.json](../artwork/treasure-wave3/pixels.json)、個別32×32 PNGは [sprites/](../artwork/treasure-wave3/sprites/) に保存しました。

左上からの光、斜め上からの視点、材質に合わせた暗い輪郭を基準にしました。透過切り抜き・32pxへの配置・限定パレット化を行い、最終PNGは透過または不透明のアルファ、各16色以下です。描画は各セルの座標2〜29内に収めました。背景・文字・レア度枠・グロー・洗浄前の泥は画像に焼き込んでいません。

確認画像では各20点を正式名称・ID付きの原寸と4倍拡大で掲載し、輪郭確認用のシルエットも併記しました。参照枠の既存品と重複掲載した新作は、新作20点の件数には加算していません。

- [contact-B.png](treasure-art-wave3/contact-B.png): キャップB001・メダルB007と、穴あき銅銭B046・記念コインB047・乗船トークンB048・商店札B050を比較。穴・縁・厚み・突起で描き分けました。
- [contact-R.png](treasure-art-wave3/contact-R.png): 既存の古いスパナR004とモンキーレンチR025は変更せず参照枠へ配置。ラジオペンチR026、六角ソケットR028、ラチェットR029、パイプレンチの顎R035を比較できます。
- [contact-G.png](treasure-art-wave3/contact-G.png): 黄鉄鉱G003と黄銅鉱G049、微細砂金G007と集合G098、既存薄片砂金G008と板状砂金G088を並べました。結晶・板・散粒の輪郭差と、雲母・長石等の割れ面を優先しました。

エクスプローラーに貼り付ける比較画像フォルダー:

```text
C:\_wk\github\browser-game\036_お宝回収屋\docs\treasure-art-wave3
```

ファイル名: contact-B.png / contact-R.png / contact-G.png

## 組み込みと対象外の保持

9シートの名称、256×160px、8列×5行、32pxセル、全300品の割当座標を維持しました。60セルを更新し、該当60件の available だけを false から true に変更しました。PNGファイルとして更新されたのは9枚中8枚で、river_rare_sheet.pngはそのままです。

作業前の9枚を artwork/treasure-wave3/before/ に保存し、PNGをデコードして全360セルのRGBAを比較しました。結果は **更新60セル、対象外300セル完全一致、対象外の変更画素0** です。対象外の内訳は既存54点・未制作186点・空き60枠です。全300件のセル位置とその他マップ属性は不変で、保護対象の実行ソース・設定91ファイルも作業前のハッシュと一致しました。

同じ配置処理を再実行しても9枚のPNGとマップのファイルハッシュが変わらないことも確認しました。新作60点の個別PNGはすべて32×32で、対応するシートのセルと全RGBAが一致します。約2pxの周辺余白、透明背景、隣接セルへのはみ出しがないことを機械検証しました。比較の詳細は [pixel-comparison.json](treasure-art-wave3/pixel-comparison.json)、総合結果は [verification-summary.json](treasure-art-wave3/verification-summary.json) を参照してください。

## ゲーム内表示の確認

Chrome・Edgeの320×568、390×1000、1280×1000で、制作済み114点が正しいID・シート位置で図鑑一覧に表示されることを検証しました。各環境でB046/B047/R026/R029/G049/G088の詳細と洗浄前後を確認し、洗浄前の汚れ、洗浄後の画像、レア度の枠・グロー、未発見品の共通シルエットを維持しています。保存・再読み込みと二重報酬防止も確認しました。

未制作のB008/R018/G018は従来のSVG表示のままです。シート読込失敗時も既存のフォールバックで進行できます。撮影は独立したテスト用ブラウザコンテキストで行い、通常プレイのセーブは操作していません。

| 分野・代表品 | 図鑑一覧 | 詳細 | 洗浄前 | 洗浄後 |
|---|---|---|---|---|
| 砂浜 B046 穴あき銅銭 | [一覧](treasure-art-wave3/book-B.png) | [詳細](treasure-art-wave3/detail-B046.png) | [汚れあり](treasure-art-wave3/dirty-B046.png) | [洗浄後](treasure-art-wave3/washed-B046.png) |
| 川底 R026 ラジオペンチ | [一覧](treasure-art-wave3/book-R.png) | [詳細](treasure-art-wave3/detail-R026.png) | [汚れあり](treasure-art-wave3/dirty-R026.png) | [洗浄後](treasure-art-wave3/washed-R026.png) |
| 河原 G049 黄銅鉱の粒 | [一覧](treasure-art-wave3/book-G.png) | [詳細](treasure-art-wave3/detail-G049.png) | [汚れあり](treasure-art-wave3/dirty-G049.png) | [洗浄後](treasure-art-wave3/washed-G049.png) |

## テスト・ビルド結果

| 実行内容 | 結果 | 記録 |
|---|---|---|
| npm.cmd test | 665件成功・失敗0 | [unit-test.log](treasure-art-wave3/unit-test.log) |
| node scripts/treasure-art-wave3.mjs verify | 60セル更新・対象外300セル一致・91ファイル不変 | [pixel-comparison.json](treasure-art-wave3/pixel-comparison.json) |
| node scripts/treasure-art-wave3-browser.mjs | 8ケース成功（6環境＋読込失敗2） | [browser-results.json](treasure-art-wave3/browser-results.json) |
| npm.cmd run test:sprites-browser | 既存10ケース成功 | [treasure-sprite-browser-results.json](treasure-art-wave3/treasure-sprite-browser-results.json) |
| node scripts/treasure-art-wave3-fallback.mjs | 未制作SVG代替2ケース成功 | [fallback-results.json](treasure-art-wave3/fallback-results.json) |
| node scripts/treasure-art-wave3-production.mjs | 本番版4ケース成功、DEBUG LAB除外・9シート読込 | [production-results.json](treasure-art-wave3/production-results.json) |
| npm.cmd run build | TypeScript・Vite本番ビルド成功 | [build.log](treasure-art-wave3/build.log) |
| node scripts/treasure-art-wave3-finalize.mjs | 60個別PNG一致、全試験記録の総合検証成功 | [verification-summary.json](treasure-art-wave3/verification-summary.json) |

ブラウザ試験は開発サーバー127.0.0.1:5176を使用し、既存試験の出力先は SPRITE_ART_OUTPUT=docs/treasure-art-wave3 に設定しました。本番試験はdistを独立サーバーで配信し、日本語を含む配置先でも確認しました。今回は素材変更の回帰として上記24ケースを実行したもので、すべての過去の分野別ブラウザ試験を再実行したという意味ではありません。

## 主要な追加・変更ファイル

- src/assets/treasures/sheets/*.png（8枚）と src/treasure-sprite-map.json（60件の表示可否のみ）
- artwork/treasure-wave3/（生成記録・最終画素・個別PNG・作業前スナップショット・選定根拠）
- scripts/treasure-art-wave3*.mjs（配置・画素照合・比較画像・ブラウザ・本番・総合確認）
- tests/treasure-sprites.test.ts と scripts/treasure-sprite-browser-test.mjs（制作済み114点への期待値更新）
- docs/treasure-art-wave3/（比較画像・スクリーンショット・試験記録）
- README.md、docs/TREASURE_SPRITE_PLAN.md、docs/TREASURE_ASSET_MANIFEST.csv、docs/ASSET_LICENSE_MANIFEST.md（件数と生成元の記録更新）

## 未確認・残作業

今回選定した60点の制作・組み込みに未完成はありません。未制作186点は対象外のままSVGフォールバックを維持しています。iPhone Safari実機およびWebKitは未確認です。小画面のChrome/Edge検証を実機Safariの確認として扱っていません。

原寸・拡大・比較枠と代表画面は目視確認しましたが、品名を隠した第三者による識別試験は実施していません。今後の画風評価には今回の比較画像を利用できます。Version・ゲーム仕様・セーブ形式・図鑑レイアウトの変更、commit・push・公開は行っていません。
