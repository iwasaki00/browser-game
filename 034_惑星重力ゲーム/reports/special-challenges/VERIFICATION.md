# v0.6.1 SPECIAL CHALLENGES 検証

既存物理・1/120秒。解答の位置/種類/サイズ/角度/速度/終了状態はspecial-challenges.jsとverification.json。全て移動なしで両モード到達。

| Stage | 名称 | 惑星 | 角度 / 推力 | 到達秒 | 評価 | 両モード / スリング |
|---|---|---|---|---|---|---|
| stage-11 | 小さな巨人 | dense | -70 / 170 | 2.200 | ★★★ | 成功 / 成功 |
| stage-12 | 重力の針穴 | dense | -68 / 208 | 1.867 | ★★★ | 成功 / 成功 |
| stage-13 | 逆らう星 | repulsor | -54 / 170 | 2.392 | ★★★ | 成功 / 成功 |
| stage-14 | 押して曲げる | repulsor + earth | -50 / 220 | 1.742 | ★★★ | 成功 / 成功 |
| stage-15 | 灼熱の航路 | star | -69 / 170 | 2.158 | ★★★ | 成功 / 成功 |
| stage-16 | 太陽をかすめて | star | -72 / 176 | 2.158 | ★★★ | 成功 / 成功 |
| stage-17 | 深淵の引力 | blackhole | -72 / 200 | 1.858 | ★★★ | 成功 / 成功 |
| stage-18 | 事象の境界 | blackhole | -74 / 220 | 1.733 | ★★★ | 成功 / 成功 |
| stage-19 | 相反する力 | blackhole + repulsor | -72 / 220 | 1.742 | ★★★ | 成功 / 成功 |
| stage-20 | 宇宙の支配者 | blackhole + repulsor + dense | -66 / 212 | 1.592 | ★★★ | 成功 / 成功 |

## 特殊惑星の寄与と許容幅

全ての基準解答について、各惑星を削除またはその重力を無効化すると到達しないことを検証。さらに、初期配置を固定し、許可発射角を0.5°刻み・推力を2刻みで探索したところ、対象特殊惑星の重力無効化では全試行が失敗。Stage14の通常惑星は格子全域の必須性ではなく、基準航路への寄与を確認。
種類・サイズ・個数を固定し、惑星中心の移動を初期位置から各軸±12に制限。Stage19〜20は発射角±1°・推力±4以内に制限する一方、惑星位置は調整可能。両発射方式に同じ条件を適用する。
これは初期配置の有限格子と解答の因果比較による検証であり、全ての連続配置や飛行中の操作に対する数学的必須性の証明ではない。数値結果を超えて「特殊惑星以外では絶対に攻略不能」とは主張しない。

| Stage | 惑星 | 削除 / 重力無効 | 無効化時の成功/格子数 | ±2位置の成功/9 | 危険/表面からの最接近余裕 |
|---|---|---|---|---|---|
| stage-11 | dense | escaped / escaped | 0/221 | 9/9 | 36.07 |
| stage-12 | dense | escaped / escaped | 0/221 | 6/9 | 13.82 |
| stage-13 | repulsor | escaped / crashed | 0/221 | 7/9 | 9.86 |
| stage-14 | repulsor | escaped / escaped | 0/119 | 9/9 | 17.41 |
| stage-14 | earth | escaped / escaped | 0/0 | 9/9 | 50.77 |
| stage-15 | star | escaped / escaped | 0/221 | 9/9 | 30.18 |
| stage-16 | star | escaped / escaped | 0/221 | 6/9 | 8.11 |
| stage-17 | blackhole | escaped / escaped | 0/221 | 5/9 | 74.08 |
| stage-18 | blackhole | escaped / escaped | 0/119 | 6/9 | 48.90 |
| stage-19 | blackhole | escaped / escaped | 0/15 | 9/9 | 94.69 |
| stage-19 | repulsor | escaped / escaped | 0/15 | 9/9 | 47.30 |
| stage-20 | blackhole | escaped / escaped | 0/25 | 6/9 | 68.08 |
| stage-20 | repulsor | crashed / crashed | 0/25 | 9/9 | 86.06 |
| stage-20 | dense | escaped / escaped | 0/25 | 7/9 | 1.55 |

## 危険領域・保護対象

恒星とブラックホールを含む新ステージで、高速横断時のoverheated/absorbed失敗を検証。物理エンジン・予測・特殊惑星設定を変更していない。Stage01〜10はv0.5.1の保存済みデータと完全一致。localStorageキーとdesign/liveの保存構造を維持し、読込対象を20件へ拡張。

## 実機での確認項目（未実施）

Stage10クリア済みセーブでStage11が解放されること、Stage11〜20のテーマ・星・ロック表示、種類固定、惑星ドラッグと両発射方式の範囲制約、重力操作の危険領域、RESETでステージ初期配置へ戻ることを確認する。Chrome viewport再現とiPhone実機は区別する。