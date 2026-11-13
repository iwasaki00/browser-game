# 第2弾 制作前の対象照合

元のavailable=trueの54点と、基盤資料のPNG表示対象54点は一致。第1弾の記録12点とユーザー指定の除外12点も一致しました。割当済み300件全体を対象にせず、54点から12点を引いた42点（各分野14点）だけを制作します。対象の代替や追加はありません。

|分野|ID|正式名称|シート|列（0始まり）|行（0始まり）|
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

## 資料と実データの注記

対象ID・セル・仮絵有無の不一致はありません。R010「古い船用アンカー」は説明文では鉄製、現行material属性はaluminumです。対象の同定は確実なため制作は進め、外観は銀灰色の金属の錨として描きます。鉄錆の強調はせず、属性・説明文のゲームデータは変更しません。R012など抽象的な機械部品の形状は名称・カテゴリと材質に基づく造形解釈を制作記録へ残します。
