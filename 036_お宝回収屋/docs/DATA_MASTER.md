# DATA_MASTER

`master-source.json`は添付仕様の「ID｜名称…」行を正確に構造化した原文データ。`data.ts`が不足属性を補完して公開する。依頼ファイルへの実行時依存はない。

| マスター | 数 | 実装状態 |
|---|---:|---|
| お宝 | 36 | B-Aの6通常品＋3特別依頼のみ生成対象 |
| 道具 | 126 | B101/B102/B104/B105/B201のみavailable、121件はcatalogOnly |
| 組み合わせ | 16 | C01/C16が通常プレイで成立。C02はB108実装後 |
| エリア | 12 | B-Aのみavailable |

お宝属性：id/name/description/category/rarity/baseValueFN/locations/depth/material/weight/requiredToolCapabilities/handlingType/contractOnly/spawnWeight/imageId。
道具属性：id/name/description/category/stage/priceFN/capabilities/unlockConditions/compatibleAreas/compatibleTools/equipmentType/operationType/staminaCost/imageId/implementationStatus。

入力にない重量は1、深さは0～280、川底と砂浜の素材はmetal、河原はmineralという初期値。将来実装で個別に精緻化する。compatibleAreasはカテゴリの開始エリア、compatibleToolsは将来用の空配列。unlockConditionsは説明用、実判定はengine.refreshに分離。

収入はincomeマスターに分離し、評価額と混同しない。B006/B008/B010および川底・河原の実収入は未設定。未知のお宝は通常区画の候補に含めない。

セーブにはUID、ID、シード、座標・品質・状態、マスク、バッチ、依頼、図鑑履歴、経験値、装備・解放・所持ID、資金、購入前後履歴、収益時間列、プレイ時間、設定のみ保存。マスターの名称・説明・価格は保持しない。
