# TREASURE ART — WAVE 2

基準版：1.0.0-rc.1（変更なし）。制作・検証：2026-11-14。元の試作54点から第1弾12点を除く42点を完成・組み込みました。各分野14点、第1弾込みでは各18点・合計54点です。未完成0点、対象の代替0点。未制作246点には着手していません。

## 対象の確定

制作開始前にTREASURE_SPRITE_PLAN.md、TREASURE_ART_WAVE1.md、現行マスター、treasure-sprite-map.jsonを照合し、[制作前対象表](TREASURE_ART_WAVE2_TARGETS.md)とartwork/treasure-wave2/targets.jsonへ確定しました。300件の予約セルと、available=trueで仮絵の存在する54件を区別しています。以下の座標はすべて0始まりです。

|分野|ID|正式名称|シート|列|行|
|---|---|---|---|---:|---:|
|B|B002|古い釣り針|beach_daily_sheet|1|0|
|B|B004|錆びたボルト|beach_daily_sheet|3|0|
|B|B005|金属製キーホルダー|beach_daily_sheet|4|0|
|B|B006|アクセサリーの留め具|beach_daily_sheet|5|0|
|B|B009|銀製ブレスレット|beach_valuable_sheet|1|0|
|B|B010|古い銀貨|beach_valuable_sheet|2|0|
|B|B013|サクラガイの両殻|beach_nature_sheet|0|0|
|B|B014|タカラガイの殻|beach_nature_sheet|1|0|
|B|B020|サンゴ礫|beach_nature_sheet|7|0|
|B|B025|丸く磨かれた瓶底|beach_nature_sheet|4|1|
|B|B026|気泡入りの古瓶片|beach_nature_sheet|5|1|
|B|B032|ガラス製ボタン|beach_nature_sheet|3|2|
|B|B033|銀製イヤーカフ|beach_daily_sheet|7|0|
|B|B045|銅製の遊技トークン|beach_valuable_sheet|0|2|
|R|R001|錆びた鉄くぎ|river_metal_sheet|0|0|
|R|R003|釣り具の鉄製部品|river_tool_sheet|0|0|
|R|R006|自転車用スタンド|river_metal_sheet|3|0|
|R|R008|小型鉄製滑車|river_tool_sheet|3|0|
|R|R009|真鍮製バルブ|river_metal_sheet|4|0|
|R|R010|古い船用アンカー|river_rare_sheet|0|0|
|R|R011|小型金庫|river_rare_sheet|1|0|
|R|R012|希少な産業設備の部品|river_rare_sheet|2|0|
|R|R013|角形ナット|river_metal_sheet|5|0|
|R|R025|モンキーレンチ|river_tool_sheet|4|0|
|R|R059|鉄製部品箱|river_tool_sheet|2|3|
|R|R079|アルミ製水筒|river_rare_sheet|3|0|
|R|R089|鋳鉄製ハンドル|river_rare_sheet|5|1|
|R|R100|刻印入り精密機械ユニット|river_rare_sheet|0|3|
|G|G002|砂鉄の粒|gold_mineral_sheet|0|0|
|G|G004|色のきれいな小石|gold_stone_sheet|1|0|
|G|G005|瑪瑙の小片|gold_mineral_sheet|2|0|
|G|G006|水晶の小結晶|gold_mineral_sheet|3|0|
|G|G008|砂金の薄片|gold_rare_sheet|1|0|
|G|G009|小粒の天然金|gold_rare_sheet|2|0|
|G|G010|水晶標本|gold_rare_sheet|3|0|
|G|G011|中粒の天然金|gold_rare_sheet|4|0|
|G|G013|正長石の劈開片|gold_stone_sheet|2|0|
|G|G014|微斜長石の粒|gold_stone_sheet|3|0|
|G|G025|方解石の劈開片|gold_mineral_sheet|4|0|
|G|G060|蛇紋石の集合片|gold_mineral_sheet|7|4|
|G|G061|玉髄脈の小片|gold_stone_sheet|6|1|
|G|G084|磁鉄鉱を含む黒砂の塊|gold_stone_sheet|5|4|

## 制作方法と画風

第1弾contact-sheet.pngとgeneration.jsonを基準に、内蔵image_genで42品それぞれに個別プロンプトを作成し、新規原画を生成しました。全42点を1枚の完成シートとして生成する方法は使用していません。砂浜・川底・河原の順に、原画制作→32px仕上げ→既存セルへの配置→分野別原寸確認を行いました。SVGからの変換や汎用絵への置換はありません。

原画の透過境界を基準として最近傍で32pxセルに収め、材質別の限定パレットへ量子化しています。最終アルファは0/255、周囲最低2pxの透明余白。光は左上、斜め上からの視点、文字・背景・枠・グローを素材へ含めません。細長い品は細長いままです。レア度による画像の拡縮は追加していません。

- 砂浜：釣り針の返し、留め具の開口、ブレスレットの細い連結輪、イヤーカフの幅広い切れ目を区別。硬貨は欠けた縁、トークンは平滑な円盤と刻み、貝は二枚・巻貝で描き分けています。
- 川底：モンキーレンチの調整部、スタンドの足、滑車の取付輪、バルブの管体、ハンドルの中抜き、部品箱の仕切りを優先。第1弾のスパナ・チェーン・工具箱と並べて確認しました。
- 河原：単結晶・群晶・割れ片、長石の直線的な劈開と蛇紋石の丸い集合、砂鉄の散粒と黒砂の塊を区別。天然金は薄片・小粒・三つの膨らみを持つ中粒を描き分け、第1弾の黄鉄鉱・微細砂金・大粒金と並べています。

32pxと4倍画像・原寸シルエットを目視しました。品名を隠した第三者による判別率の測定は行っていません。

## 制作元と再配置

- artwork/treasure-wave2/generation.json：全42点の原画ファイル名、プロンプト、パレット、最大描画範囲。
- artwork/treasure-wave2/pixels.json：完成した32pxのパレット・ドット配列・原画SHA-256。再生成APIを使わず同じ完成絵を再配置できます。
- artwork/treasure-wave2/sprites/：個別の32×32透過PNG42枚。
- artwork/treasure-wave2/before/：作業前の9シート。第1弾完成12点を含みます。
- src/assets/treasures/sheets/：ゲームが使用する従来の9枚。各256×160、8列×5行のままです。
- scripts/treasure-art-wave2.mjs：セル配置・RGBA照合・個別PNG書出し。applyで完成ドットを配置、verifyで照合、exportで個別PNGのみを書き出します。

通常ビルドで画像制作処理は動きません。既存のbuild-prototype-sheets.mjsを再実行すると仮絵で上書きされるため、完成絵の更新には使わないでください。

## 対象外セルと既存仕様

PNG全体のハッシュを変更範囲判定に使わず、PNGをデコードした非乗算RGBAの4096バイトを360セルそれぞれで比較しました。変更42セル、対象外318セルすべて完全一致、変更ピクセル0。内訳は第1弾12点＋未制作246点＋空き60枠です。対象42セルは完成ドットデータ・個別PNGとも完全一致します。再配置後の9シートのバイト列も再配置前と一致し、配置処理の再実行で画像は変化しません。

[ピクセル照合結果](treasure-art-wave2/pixel-comparison.json)。srcの非PNGファイルとpackage/lock/index/Vite設定を含む92ファイルのSHA-256も作業前と一致。割当表・マスター・Version・ゲーム仕様・セーブ形式・図鑑レイアウト・汚れ処理・レア度の枠とグローは変更していません。ゲームの進行セーブに画像情報を追加しません。

## 確認画像

各確認画像は18点をID・正式名称・第1弾/第2弾の印付きで、32px原寸・128pxの4倍・原寸シルエットを併記しています。

|分野|全18点の比較|図鑑一覧（390px幅）|代表の洗浄後|
|---|---|---|---|
|砂浜|[contact-B.png](treasure-art-wave2/contact-B.png)|[1ページ目](treasure-art-wave2/book-B-1.png)・[2ページ目](treasure-art-wave2/book-B-2.png)|[B014 タカラガイの殻](treasure-art-wave2/washed-B014.png)|
|川底|[contact-R.png](treasure-art-wave2/contact-R.png)|[1ページ目](treasure-art-wave2/book-R-1.png)・[2ページ目](treasure-art-wave2/book-R-2.png)|[R025 モンキーレンチ](treasure-art-wave2/washed-R025.png)|
|河原|[contact-G.png](treasure-art-wave2/contact-G.png)|[1ページ目](treasure-art-wave2/book-G-1.png)・[2ページ目](treasure-art-wave2/book-G-2.png)|[G010 水晶標本](treasure-art-wave2/washed-G010.png)|

同フォルダにbook-分野-ページ-bottom.png（ページ下部）とdirty-ID.png（洗浄前）も保存しています。図鑑は既存の1ページ12件のままで、各分野18件を2ページに分けて撮影しました。画像は実アプリのテスト専用ブラウザ状態から取得し、通常プレイヤーのセーブは操作していません。

## 検証結果

確定結果は[検証集計](treasure-art-wave2/verification-summary.json)、[ブラウザ結果](treasure-art-wave2/browser-results.json)、[本番結果](treasure-art-wave2/production-results.json)に記録しました。

- npm.cmd test：既存665件成功、失敗0件。
- npm.cmd run build：成功。9枚の256×160 PNGを独立ファイルで出力。
- 専用ブラウザ検証8ケースすべて成功：Windows Chrome/Edgeの320×568、390×1000、1280×1000。各ケースで図鑑54点の一覧・詳細、洗浄42点の表示RGBAと正式名称を確認。汚れの表示/消去、共通未発見シルエット、洗浄二重報酬防止、セーブ再読込も検証。
- 画像ロード失敗2ケース（上記8ケースに含む）：Chrome/Edgeで対象シートを遮断し、SVGフォールバックと洗浄・報酬・保存の継続を検証。
- 未制作分のSVG表示2ケースも成功。B003・R014・G015についてChrome/Edgeで洗浄・報酬を確認。
- 本番4ケースすべて成功：Chrome/Edge×通常/画像読込失敗。日本語名を含む配布サブパス、図鑑54点、9シート、保存、DEBUG LAB・開発APIの除外を確認。
- iPhone Safari実機・WebKit：今回未確認。タッチ設定と狭い幅のChrome/Edge自動試験は実機Safariの代替とは扱いません。

検証コマンド：node scripts/treasure-art-wave2.mjs verify、node --import tsx scripts/treasure-art-wave2-browser.mjs、node --import tsx scripts/treasure-art-wave2-production.mjs。実画面の撮影のみはscripts/treasure-art-wave2-screenshots.mjs。開発サーバーは127.0.0.1:5176を使用します。

## データの食い違い・残作業

R010は説明文が鉄製の錨、材質属性はaluminumです。ID・名称・セルは確定しているため対象を入れ替えず、銀灰色の錨として描き、マスターは変更していません。R012は名称が抽象的で材質goldのため、金色の精密ローター部品として視覚化しました。R003の釣り具部品はスイベル、R100の精密機械はギアボックス形状の解釈です。実在メーカーの刻印・文字・商標は描いていません。

未制作246点、実機Safari受入、第三者の原寸判別確認は残作業です。今回の対象42点に未完成・未割当・代替品はありません。commit・push・公開操作は実施していません。
