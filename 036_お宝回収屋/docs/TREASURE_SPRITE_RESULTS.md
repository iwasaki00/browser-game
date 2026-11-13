# TREASURE SPRITE SHEET FOUNDATION — 実装結果

基準版1.0.0-rc.1。Version変更なし。ローカル実装・検証のみ。commit・push・公開のコマンドは実行していません。

## 1. 主要ファイル

- 新規：src/treasure-sprite-map.ts/json、src/treasure-sprites.css、src/assets/treasures/sheets/の9PNG。
- 変更：src/treasure-assets.ts、src/reveal.ts、src/collection.ts、src/main.ts。
- 試験：tests/treasure-sprites.test.ts、scripts/treasure-sprite-browser-test.mjs、treasure-sprite-production.mjs、treasure-sprite-regression.mjs。
- 制作支援：scripts/build-prototype-sheets.mjs、create-sprite-plan.ts、treasure-manifest.ts。
- 資料：[割当計画](TREASURE_SPRITE_PLAN.md)、[300件CSV](TREASURE_ASSET_MANIFEST.csv)、README、GAME_SPEC、DATA_MASTER、CHANGELOG、TEST_RESULTS、WORLD_EXPANSION、ASSET_LICENSE_MANIFEST。distをローカル再ビルド。

## 2. 管理方式

各IDにsheet/col/row/size/field/category/rarity/availableを持たせます。col/rowは0始まり、sizeは全品32です。Viteが9枚のPNGをハッシュ付き共有ファイルとして出力し、同じシートURLを再利用します。洗浄前後で画像ファイルを分けません。

## 3. 9シート

指定された9シートをすべて実装。各256×160、8列×5行、最大40セル。割当件数は砂浜20/40/40、川底39/36/25、河原38/40/22。300件割当済み、未割当0、空き60セルです。全ID範囲は割当計画を参照。

## 4. 試作数

54件（各シート6件、各分野18件）。既存の仮SVGをCanvasで32×32へ変換した試作透過PNGです。専用絵54種の完成ではなく、カテゴリ内で似た仮形状を共有します。外部画像取得や画像生成サービスは使用していません。9枚のPNGは合計36,387bytesです。

## 5. フォールバック

残り246件はavailable=falseで既存SVG表示。未割当、シート未配置、セル設定不正、読込エラー、256×160以外の画像もSVGへ切り替わります。同じシートの表示済み画像をまとめて差し替え、以後もそのページ中はSVGを使います。ページを再読込すると再試行します。画像失敗時も洗浄・報酬・保存が動作します。

## 6. 表示確認

洗浄前後、図鑑一覧、図鑑詳細を共通描画へ統一。図鑑一覧32px、詳細2倍、洗浄4倍（短い画面は3倍）。元セルは32×32のまま、レア度によるサイズ差はありません。汚れは既存オーバーレイで表現し、未発見品は共通グレーシルエットです。テキスト中心の収益レポート・ログ、探索Canvasの描画は維持します。

[試作表示](treasure-sprites-prototypes.png) / [図鑑・詳細](treasure-sprites-book.png) / [洗浄後](treasure-sprites-washed.png)

## 7. レア度演出

Cは中立色、Uは緑、Rは青、SRは紫、Jは金の枠。R/SR/Jは控えめな背景色・グローを併用します。洗浄前は枠強調を抑制し、既存の洗浄完了演出も維持します。

## 8. セーブへの影響

保存形式・キー・移行処理・FN・報酬・出現率・道具性能は変更なし。画像座標やURL、ロード失敗状態はセーブ外に保持します。既存IDを表示時に参照するので、画像未完成・欠落で進行が失われることはありません。洗浄の二重報酬防止も既存処理です。

## 9. 検証

- 自動テスト665/665成功（既存647＋追加18）。300件の完全性、セル重複・境界、レア度別サイズ不変、未配置/未作成/不正設定のフォールバック、9PNGの寸法・RGBA、保存非変更を検証。
- [表示試験10ケース](treasure-sprite-browser-results.json)：Chrome/Edge × 320/390/1280px、54セルの透明度と切り抜き、残り306セルの空白、図鑑・詳細・洗浄・シルエット・保存復元。ネットワーク失敗と寸法不正のSVG切り替えも確認。
- [既存7系統](treasure-sprite-regression-results.json)：通常探索、深層、露出/洗浄、川底、河原、砂浜道具、川底/河原道具がすべて成功。初回の河原DEBUG LAB起動タイムアウトは[記録](treasure-sprite-regression-initial-failure.json)を保持し、サーバー再起動後に再実行して成功。ゲームロジックの修正なし。
- [本番4ケース](treasure-sprite-production-results.json)：Chrome/Edge × 正常/1シート欠落。日本語サブディレクトリ内で9枚を読込、洗浄・図鑑・保存が成功。DEV API・DEBUG LAB不在と本番コードのデバッグ用マーカー不在を確認。試験用図鑑の必須tools欠落は試験データ側を修正し、通常migrateで検証して実行。
- TypeScript/Vite成功。64モジュール、PNG9枚、JS448.06kB、CSS27.35kB。現行ビルドのサイズ/SHA256は[台帳](treasure-sprite-build.json)。従来のRC受入資料とハッシュ台帳は旧ビルドの記録として保持。
- Chromeのタッチ・画面幅エミュレーションは実機Safariの代替保証ではありません。今回の変更のiPhone Safari実機確認は未実施。

再実行：npm.cmd test / npm.cmd run build。開発サーバー5176を起動しnpm.cmd run test:sprites-browser、node scripts/treasure-sprite-regression.mjs。本番試験はnode --import tsx scripts/treasure-sprite-production.mjs（内部で使い捨て配信サーバー起動）。

## 10. 300件へ向けた残作業

246件の予約セルを制作し、54件の仮絵も専用絵へ置換します。画風統一、32pxでの判別性、各シート端セルの余白、実機Safariの拡大・汚れ・読込失敗表示を確認してください。完成した対象だけavailable=trueにし、セル位置は維持してCSVと試験を更新します。完成素材の制作元と利用条件も記録します。現時点でゲーム進行を妨げる画像表示の問題は確認していませんが、専用絵の品質完成は今回の対象外です。
