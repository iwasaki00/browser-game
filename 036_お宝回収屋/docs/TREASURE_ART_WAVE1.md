# お宝ドット絵 第1弾 — 12点

対象：036_お宝回収屋 — THE FINDERS。Versionは1.0.0-rc.1を維持。第一候補12点はすべて既存54件のPNG対象内にあり、代替・対象変更はありません。各分野4点です。

## 制作対象とセル位置

列・行は0始まり、座標はシート左上からのpxです。全セル32×32、全シート256×160を維持しています。

| ID | 正式名称 | シートPNG | (列,行) | 左上(px) | 描き分け |
|---|---|---|---|---|---|
|B001|金属製キャップ|beach_daily_sheet.png|(0,0)|(0,0)|ギザギザの縁と短い側面。部分的な錆と左上の金属反射。|
|B007|記念メダル|beach_valuable_sheet.png|(0,0)|(0,0)|滑らかな円盤と二重の縁、下側の厚み。小文字を使わない。|
|B011|金製リング|beach_valuable_sheet.png|(3,0)|(96,0)|透過した大きな穴、内壁と金の反射。宝石は付けず輪郭を優先。|
|B012|高級防水腕時計|beach_valuable_sheet.png|(4,0)|(128,0)|短いベルトと大きめの文字盤。白い針と青い盤面。原寸確認後に比率を調整。|
|R002|鉄製ボルト|river_metal_sheet.png|(1,0)|(32,0)|六角頭、斜めの軸、簡略化したねじ山と部分錆。|
|R004|古いスパナ|river_tool_sheet.png|(1,0)|(32,0)|透過した開口部と細長い柄。左上側の反射。|
|R005|鉄製チェーン|river_metal_sheet.png|(2,0)|(64,0)|3つの輪の重なりと透過した穴。鉄塊にならない輪郭。|
|R007|鉄製工具箱|river_tool_sheet.png|(2,0)|(64,0)|上部の取っ手、穴、ふたの境目、留め具。青緑の塗装と小さな錆。|
|G001|石英の小片|gold_stone_sheet.png|(0,0)|(0,0)|白い割れ面、冷たい影、不規則な欠け。|
|G003|黄鉄鉱の粒|gold_mineral_sheet.png|(1,0)|(32,0)|2つの立方体が組み合わさる直線的な面。淡い真鍮色と暗いオリーブ色の側面。|
|G007|微細な砂金|gold_rare_sheet.png|(0,0)|(0,0)|5粒が透過した隙間をあけて集まる形。大きな塊にしない。|
|G012|大粒の天然金|gold_rare_sheet.png|(5,0)|(160,0)|丸みのある凹凸、厚い側面、暖かい金色。黄鉄鉱の直線的な結晶と区別。|

## 制作と画風

内蔵image_genで12品を各品別に新規制作しました。元SVGの縮小・変換ではありません。左上光、材質色を持つ暗い輪郭、少し見下ろした立体感、8〜16色程度の材質別パレットでレトロゲーム風に統一。生成原画を輪郭が崩れない最近傍サンプリングとパレット整理で32pxへ仕上げています。時計は原寸で文字盤が細かったため、ベルトを短くして盤面を大きくした原画へ作り直しました。

最終セルはアルファ0/255、外周2px以上を透明にしています。文字・背景・レア度枠・発光は素材へ焼き込んでいません。G007は8近傍で数えても5つの独立した細粒です。単一の大きな塊にしていません。

制作プロンプト全12件と選択した原画のファイル名：[generation.json](../artwork/treasure-wave1/generation.json)。最終32pxドットデータ：[pixels.json](../artwork/treasure-wave1/pixels.json)。AI生成原画と素材の制作由来はASSET_LICENSE_MANIFESTにも追記しました。

## 対象外セルの照合

- 差し替え前の9シートをartwork/treasure-wave1/before/へ保存。PNGファイル全体のハッシュではなく、PNGをデコードしたRGBA各4096bytesをセルごとに比較しました。
- 全360セル中、指定12セルが変更。残る348セルはRGBAバイト列が完全一致し、対象外の変更ピクセルは0です。348には、既存仮絵42、SVGフォールバック用の未制作246、空き60セルが含まれます。
- 書き換えたゲーム用シートは7枚。beach_nature_sheetとriver_rare_sheetは変更なし。9シート構成と300件のID・座標・availableは維持しています。
- srcのPNG以外とpackage等の92ファイルも差替前ハッシュと一致。Version、マスター、ゲーム処理、保存形式、図鑑のHTML/CSS・レイアウト、枠色・グローの変更はありません。

[厳密なピクセル照合結果](treasure-art-wave1/pixel-comparison.json) / [保存した差替前シート](../artwork/treasure-wave1/before/)。

## 確認画像

- [12点の原寸32px・4倍128px・原寸シルエット比較](treasure-art-wave1/contact-sheet.png)。表示倍率1の画像です。キャップとメダル、黄鉄鉱と細粒砂金・大粒天然金を隣同士で比較できます。
- 実際の図鑑一覧：[砂浜](treasure-art-wave1/book-B.png) / [川底](treasure-art-wave1/book-R.png) / [河原](treasure-art-wave1/book-G.png)。表示は既存UIを使い、スクロール位置のみ調整しています。
- 洗浄後（全12点）：
  - [B001 金属製キャップ](treasure-art-wave1/washed-B001.png)
  - [B007 記念メダル](treasure-art-wave1/washed-B007.png)
  - [B011 金製リング](treasure-art-wave1/washed-B011.png)
  - [B012 高級防水腕時計](treasure-art-wave1/washed-B012.png)
  - [R002 鉄製ボルト](treasure-art-wave1/washed-R002.png)
  - [R004 古いスパナ](treasure-art-wave1/washed-R004.png)
  - [R005 鉄製チェーン](treasure-art-wave1/washed-R005.png)
  - [R007 鉄製工具箱](treasure-art-wave1/washed-R007.png)
  - [G001 石英の小片](treasure-art-wave1/washed-G001.png)
  - [G003 黄鉄鉱の粒](treasure-art-wave1/washed-G003.png)
  - [G007 微細な砂金](treasure-art-wave1/washed-G007.png)
  - [G012 大粒の天然金](treasure-art-wave1/washed-G012.png)
- 洗浄前の既存汚れ表現：[B001](treasure-art-wave1/dirty-B001.png) / [R002](treasure-art-wave1/dirty-R002.png) / [G001](treasure-art-wave1/dirty-G001.png)。

原寸ではギザ縁のキャップと滑らかなメダル、大きな穴の指輪、ベルト付き時計を輪郭で区別できます。拡大では左上光と材質色の輪郭・色数をそろえています。黄鉄鉱の角張った面、離れた砂金5粒、丸い大粒天然金にも形の差があります。

## 実行した検証

| コマンド | 結果 |
|---|---|
| node scripts/treasure-art-wave1.mjs verify | 対象12変更・対象外348完全一致、2px余白・硬いアルファ・16色以内・保護92ファイル不変 |
| npm.cmd test | 665件成功、失敗0 |
| npm.cmd run build | TypeScript・Vite成功。PNG9枚、JS448.06kB、CSS27.35kB |
| node --import tsx scripts/treasure-art-wave1-browser.mjs | 8ケース成功。Chrome/Edge各3幅＋各1件のシート欠落 |
| node --import tsx scripts/treasure-sprite-production.mjs | 本番4ケース成功。Chrome/Edgeで正常/シート欠落、日本語サブディレクトリ配信 |

表示試験は320×568、390×1000、1280×1000で全12点を一覧・詳細・洗浄前後で確認し、画像の切り抜きRGBAを最終セルと照合しています。洗浄の汚れ、洗浄後の既存枠とグロー、未発見の共通シルエット、二重報酬防止、保存復元も成功。画像欠落でもSVGで洗浄・報酬・保存を継続できました。

本番からDEBUG LAB・DEV APIを除外した状態と相対画像パスを確認しました。全体的なバランス試験や既存7系統の長い回帰は今回再実行していません（ゲーム処理は変更なし）。iPhone Safari実機は今回未確認です。Chromeのタッチエミュレーションを実機確認として扱っていません。

[表示試験ログ](treasure-art-wave1/browser-results.json) / [本番ログ](treasure-art-wave1/production-results.json) / [ビルド台帳](treasure-art-wave1/build.json) / [要約](treasure-art-wave1/results.json)。

## 今後の制作と注意

今回の制作は12点で終了し、残る42件の仮PNG・246件のSVG表示は制作していません。9シートの予約セルと現行フォールバックを維持します。次の制作はこの12点を画風見本にしてください。

基盤用のnpm.cmd run assets:prototypeは全54仮セルをSVGから生成し直す旧試作用コマンドで、今回の専用絵も上書きするため普段は実行しないでください。第1弾の最終ドットデータはpixels.jsonに保持し、node scripts/treasure-art-wave1.mjs applyで指定12セルを再適用できます。applyは現在のシートの対象12セルだけを更新し、他セルを差替前へ戻しません。verifyは第1弾時点の348セルとの比較なので、次の制作で対象外を変更した後は、その版用の比較基準を用意してください。

PNGの比較・再適用には導入済みPlaywrightのPNGコーデックを開発ツールとして利用しています。追加の依存やゲーム本体への読込はありません。commit・push・公開は行っていません。
