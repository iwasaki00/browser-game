## 画像管理の追加仕様（TREASURE SPRITE SHEET FOUNDATION）

お宝300件の描画は9ジャンルの透過PNGシートへ対応。1セル32×32、8列×5行、各40枠。300件の固定割当と54件の試作セルを管理し、246件は既存SVGで表示します。FN、出現率、回収判定、洗浄報酬、保存形式は変更しません。詳細は[TREASURE_SPRITE_PLAN](TREASURE_SPRITE_PLAN.md)を参照。

---

# Version 0.9.0 — GAME EXPERIENCE REFINEMENT

道具126マスター/46使用可能、設備3種、300お宝、12エリア、6ラインを維持。ID・価格・FN報酬・生成確率の変更なし。新規追加は保存用の experience（version=1、guide、legacy、operations、events最大11、recentBook最大12）と settings.effects（full/light/off）。各イベントは順序、ゲーム秒、操作数、FN、所持道具、分野、累計回収数、掘削作業秒を保持。ログは外部送信しません。

DEBUG LABのUX-01〜UX-20は開発専用。既存159シナリオに追加して179件、8タブを維持。

---

# Version 0.8.2 — RIVER & GOLD TOOL FEEL

新規道具/宝/エリアなし。300宝・126道具・46使用可能道具・設備3種・価格/解放を維持。RiverSession.workSeconds、GoldWork.setup、GravelBatch.sluicePreparedを任意追加。通常個体ID・固定捕捉順位・厳密台帳は維持。

---

# Version 0.8.1 — 掘削モデル

src/digging.tsに10層と9掘削道具の速度・材質適性・体力性能を分離。126道具ID、46使用可能道具、3設備、300お宝マスターと価格・報酬・J率は変更しない。StateへdigWorkSeconds/digBatchSerial、PlotへdigLayersSeenを任意項目で追加。旧保存の物理深度を維持。

---

# Version 0.8.0 — 設備個体と複数ライン

設備種別B301/R301/G304の名称・価格を維持。Automation.instancesにinstanceId→Machineを保持。個体にlevel/investment、ラインにinstanceId/name/mesh、作業にinstanceId/lineIdを追加。既存キーB/R/GへB2/R2/G2を追加。配分はState.distributionのmanual/equal/capacity/spaceと巡回カーソル。未知ID・重複接続・不正Lv・孤立予約・壊れた配分を保存検証で拒否する。

厳密台帳の個体ID発行・支払資格は維持。[300品CSV監査](TREASURE_REACHABILITY_AUDIT.csv) / [詳細JSON](treasure-audit-v080.json)。

---

# Version 0.7.0 — データ構成

お宝300種＝旧36＋src/treasure-expansion.jsonの264。B001〜B100、R001〜R100、G001〜G100。ID・名称・分野・分類・レア度・評価・場所・材質・重量・磁性・能力条件・難易度・洗浄・画像ID・固定報酬を登録。河原は粒径・比重を追加。

全件表：[TREASURE_MASTER_300](TREASURE_MASTER_300.md)。CSV：[TREASURE_ASSET_MANIFEST](TREASURE_ASSET_MANIFEST.csv)。生成コマンドはnpm.cmd run data:treasures。元の道具126／使用可能46／設備3のID・名称・価格は変更しない。

world-rules.tsが環境と解放、world-generation.tsが固定シード配置を担当。旧36品の保護用データはtreasure-baseline-v060.json。環境と訪問・達成だけを保存し、300件の説明文をセーブへ複製しない。

---

# Version 0.6.0 追補

新しい道具ID・価格の変更はない。使用可能46道具、126道具マスター、3設備B301/R301/G304を維持する。ラインIDはLINE-B/LINE-R/LINE-G、工程IDはtransport/screen/magnet/separate/pull/organize/precision。Find.stateにtransitを追加。設備IDとDEBUGシナリオIDのLINE-01〜20は別名前空間。工程はマスター材料の再抽選を行わない。

---

# Version 0.5.0 — 設備マスター連携

126種のID・名称・価格は変更なし。手動道具availableは46種。B301/R301/G304をequipmentType=facilityとして別在庫・別購入経路で実装し、手動4枠へは入りません。catalogOnlyのうち3つが設備画面実装となり、純粋な未実装は77種です。

| ID | 名称 | 価格FN | 入力 | 出力 |
| --- | --- | ---: | ---: | ---: |
| B301 | 電動ふるい | 25,000 | 240砂単位 | 8個 |
| R301 | 電動ウインチ | 30,000 | 12対象 | 8個 |
| G304 | 電動砂利搬送機 | 48,000 | 240砂利単位 | 12個 |

36お宝、16組み合わせ、12エリア登録は維持。G401自動砂利供給機260,000FNなど大型設備は未実装のままです。個体UID・材質・磁性・重量・品質・捕捉履歴は共通。詳しくは [SEMI_AUTOMATION](SEMI_AUTOMATION.md)。

---

以下は過去バージョンの記録です。

# DATA_MASTER

`master-source.json`は添付仕様の「ID｜名称…」行を正確に構造化した原文データ。`data.ts`が不足属性を補完して公開する。依頼ファイルへの実行時依存はない。

| マスター | 数 | 実装状態 |
|---|---:|---|
| お宝 | 36 | 砂浜・川底R001〜R007/R009・河原G001〜G008（各エリアの対応種）が通常生成対象 |
| 道具 | 126 | 砂浜20件＋川底13件＋河原13件がavailable、80件はcatalogOnly |
| 組み合わせ | 16 | C01/C16と条件付きC02/C03/C04/C05/C06/C07/C09/C10が通常プレイで成立。C02はB108実装後 |
| エリア | 12 | B-A/R-A/R-B/G-A/G-Bがavailable |

お宝属性：id/name/description/category/rarity/baseValueFN/locations/depth/material/weight/requiredToolCapabilities/handlingType/contractOnly/spawnWeight/imageId。
道具属性：id/name/description/category/stage/priceFN/capabilities/unlockConditions/compatibleAreas/compatibleTools/equipmentType/operationType/staminaCost/imageId/implementationStatus。

入力にない重量は1、深さは0～280、砂浜の素材はmetal、河原はmineralという初期値。川底はriverMasterでiron/brass/aluminum/gold、重量、磁性を個別指定する。compatibleAreasは川底でR-A/R-B、他はカテゴリの開始エリア、compatibleToolsは将来用の空配列。unlockConditionsは説明用、実判定はengine.refreshとriver.areaUnlockedに分離。

収入はincomeマスターに分離し、評価額と混同しない。川底の通常対象8種には清掃・契約報酬を設定。B006/B008/B010および将来の川底・G009〜G012の実収入は未設定。未知のお宝は通常区画の候補に含めない。

セーブにはUID、ID、シード、座標・品質・状態、マスク、バッチ、依頼、図鑑履歴、経験値、装備・解放・所持ID、資金、購入前後履歴、収益時間列、プレイ時間、設定のみ保存。マスターの名称・説明・価格は保持しない。


## 0.1.1のセーブ形式v2

マスター数・価格・収入設定は変更なし。個体のx/yは砂浜の平面座標、depthは埋没深さ。maskは36×28セルの掘削深さを0～1へ正規化した配列。explorationAreasは現在の1区画、currentPlotは0固定。exploredPlotsは累計区画数で大型スコップの3区画解放に使用。retainedFindsは破棄済み区画で回収／採砂した荷物のみ保持する軽量データ。sandSampledは採砂経験を永続化。保存キーは旧版と同一のため自動移行可能。


## 0.1.2の追加

マスター数・価格・報酬は変更なし。CONFIGに手応え確率0.3・再試行間隔12秒・対象距離18px・同じ穴の距離28px・限界付近の許容差0.5を追加。保存形式はv2のまま、任意のhandFeedback配列（plotId/x/y/attemptedAt/hinted）を追加。旧版では未存在でも空配列で読み込む。mask・個体depthの値は一切再スケールしない。


## 0.1.3

36お宝・126道具・16連携・価格・固定FN報酬を維持。道具用のサイズ初期プロファイルで反応の特徴を補完。個体にinitialQuality/qualityFinalized/qualityLoss/damagePrevented/surveyed/plannedRecovery/excavationTool/recoveryRecorded、区画にsurveyMarks、砂バッチにscreenedUnits/allocations/residueWork、状態にlastScan/sortHistory/recoveryHistoryを任意追加。マスター名称・説明・価格は保存へ複製しない。


## 0.3.0の追加属性

河原の実FNはG001〜G008順に8/10/18/25/65/100/90/260。元のbaseValueFNは維持し、評価値と分離します。gold.tsの固定プロファイルgrain/densityは順に2.4/2.65、0.7/5.2、1/5、4/2.7、3/2.6、2/2.65、0.12/19.3、0.45/19.3です。

個体へgrain/density/goldSite/goldOffset/goldAllocation/captureRank/goldCapture/goldRich/observed/pickWork、区画へgoldSites、状態へgoldVersion:1/gravelBatches/goldWork/sluiceFeed/goldStats/goldUnlockedAreas/loadouts/selectedTools/operationMetricsを追加。個体ID・品質・捕捉判定値を再抽選せず、共通保存v2から不足項目を移行します。詳細は [GOLD_PANNING](GOLD_PANNING.md)。


## 0.4.0

既存126件のID・名称・価格を維持。採用15件の性能はbeach-tools.tsへ分離し、data.tsのcapabilities・unlockConditions・staminaCost・implementationStatusへ反映します。全件の調査は [tool-master-audit-v040.json](tool-master-audit-v040.json)。区画にbeachDepthVersion:1、個体にidentified、探知跡にprecise、状態にbeachMeshを任意追加。旧maskを再スケールしません。詳細は [BEACH_TOOL_EXPANSION](BEACH_TOOL_EXPANSION.md)、[DEPTH_EXPANSION](DEPTH_EXPANSION.md)。


## 0.4.1

field-tools.tsに12道具の補足性能を分離。ID・名称・価格は原文マスターのまま。G002は砂鉄の磁性を補足し、天然金を磁石対象にしません。FindへriverObserved/riverCameraObserved/riverLoadMeasured/riverProtected、GravelBatchへfineScreened/magnetized/magnetRecovered、GoldWorkへprepared/fineFraction/magneticFractionとmagnet工程を任意追加。旧形式v2/goldVersion1と保存キーを維持。未知・不正な前処理量は拒否します。全件調査は [tool-master-audit-v041.json](tool-master-audit-v041.json)。
