# RAGDOLL RUN — Phase 1G

Q/W/O/Pで左右の股関節とひざを個別に動かす、横視点の物理ランニング実験です。Phase 1Gでは人体としての肘角定義、前後非対称の腕フォーム、ARM FORM TEST、腕・脚の前後描画順を追加しました。

## 起動とテスト

リポジトリのルートをHTTPサーバーで配信し、`029_qwop-runner/index.html`を開きます。Matter.jsは`022_pythagora-lab/vendor/matter.min.js`を共有しています。

```sh
node 029_qwop-runner/tests/phase1a.test.cjs
node 029_qwop-runner/tests/phase1b.test.cjs
node 029_qwop-runner/tests/phase1c.test.cjs
node 029_qwop-runner/tests/phase1d.test.cjs
node 029_qwop-runner/tests/phase1e.test.cjs
node 029_qwop-runner/tests/phase1f.test.cjs
node 029_qwop-runner/tests/phase1g.test.cjs
node 029_qwop-runner/tests/phase1h.test.cjs
node 029_qwop-runner/tests/phase1i.test.cjs
node 029_qwop-runner/tests/phase1j.test.cjs
node 029_qwop-runner/tests/browser-smoke.cjs
```

## 操作

- Q: 右股関節を前、左股関節を後ろへ
- W: 左股関節を前、右股関節を後ろへ
- O: 右ひざを曲げ、左ひざを伸ばす
- P: 左ひざを曲げ、右ひざを伸ばす

キーボード、画面下ボタン、DEBUG内のCONTROL TESTは共通の入力状態を更新します。DOWN中も入力は無効化されず、関節トルクによる物理的な動きが続きます。

## Phase 1Fの診断

DEBUG内には次の独立した試験があります。

- `DRIFT TEST 5s`: RETRY相当の初期状態へ戻し、手入力とデモを無効にして5秒計測します。Start X、End X、Drift Distance、平均/最大X速度、左右足の接地時間、推定荷重を表示します。
- `RECOVERY TEST`: 従来どおり8フレームの軽い横力でLEANINGと復帰性を確認します。
- `FALL TEST`: 左右を交互に、胴体上部へ36フレーム、水平0.135の力を加えます。位置・角度・速度の直接変更は行いません。FALLING/DOWN到達時間、現在の手接地、左右手接地時間、最初に地面へ触れた部位を表示します。DOWN到達後はQ/W/O/Pがすぐ有効になります。

静止ドリフトの主因は、足先側へ偏っていた足首Constraintと、Balanceが使う支持点が同一扱いだったことです。機械的な足首アンカーを足中心付近の`+2px`へ移し、足裏の有効支持点を独立した`-18.27px`として定義しました。速度や位置を固定する処理は使っていません。

## デフォルト候補の比較

同じ物理値で、静止5秒、前進デモ12サイクル、FALL TESTを比較した結果です。距離は正が前進です。

| 候補 | Balance | Arm | 5秒ドリフト | デモ距離 | 平均速度 | 胴体角 平均/最大 | デモ転倒 | DOWN到達 | 手接地 |
|---|---:|---:|---:|---:|---:|---:|---|---:|---|
| A | 100% | 100% | -0.0217m | 5.98m | 0.680m/s | 14.39° / 23.59° | なし | 0.67s | なし（胴体が先に接地） |
| B | 75% | 70% | -0.0374m | 5.50m | 0.621m/s | 15.03° / 25.03° | なし | 0.87s | あり |
| C | 60% | 70% | -0.0208m | 5.51m | 0.629m/s | 15.07° / 25.34° | なし | 0.63s | なし（頭が先に接地） |
| D | 50% | 70% | +0.0041m | 5.62m | 0.644m/s | 15.07° / 26.57° | なし | 0.75s | あり |

暫定の推奨候補はCです。前進量を保ちつつ、自動BalanceをAより弱くできるため、QWOPらしい操作余地があります。ただし、手接地の再現性を重視するならB、最小ドリフトを重視するならDも有力です。Phase 1Fでは最終デフォルトを決定せず、比較候補として残します。現在の起動時設定は従来互換のAです。

## 固定物理パラメータ

Phase 1Fの比較基準として次を固定します。

| 項目 | 値 |
|---|---:|
| Physics update | 60Hz fixed step |
| Engine iterations | position 14 / velocity 12 / constraint 6 |
| Gravity | 0.72 |
| Ground friction | 1.05 |
| Foot friction | 1.35 |
| Joint Constraint | stiffness 0.985 / damping 0.32 |
| Neck Constraint | stiffness 1.0 / damping 0.5 |
| Foot ankle anchor X | +2px |
| Foot support point X | -18.27px |
| Balance Kp / Kd / max force | 0.0020 / 0.020 / 0.10 |
| Joint limit strength | 20.0 |

### Body密度

| Body | 密度 |
|---|---:|
| Torso | 0.0036 |
| Thigh / Shin / Foot | 0.0023 |
| Head | 0.0017 |
| Upper arm | 0.00125 |
| Forearm | 0.0010 |
| Hand | 0.00055 |

Arm Massは上腕・前腕・手の密度へLight 65%、Normal 100%、Heavy 145%を乗算します。Hand frictionはLow 0.35、Normal 0.70、High 1.05です。

### PD制御

| 関節 | Kp | Kd | Max Torque |
|---|---:|---:|---:|
| Torso | 0.15 | 0.08 | 0.20 |
| Hip | 4.00 | 0.30 | 4.00 |
| Knee | 6.00 | 0.40 | 6.00 |
| Ankle | 4.00 | 0.30 | 4.00 |
| Neck | 0.45 | 0.12 | 0.30 |
| Shoulder | 1.50 | 0.18 | 1.20 |
| Elbow | 0.70 | 0.12 | 0.65 |

可動域はHip `-60°〜60°`、Knee `-6°〜92°`、Ankle `-30°〜30°`、Neck `-25°〜25°`、Shoulder `-85°〜85°`、Elbowは左右鏡像の`25°〜125°`です。中立値は左Hip `+2°`、右Hip `-2°`、左右Knee `+8°`です。

腕PD倍率はSTABLE 100%、LEANING 85%、FALLING 30%、DOWN 8%です。これにArm Swing設定を乗算します。転倒中の腕を強制的に走行フォームへ戻さず、手と地面の物理接触を妨げません。

## 前進デモとTraining

基準デモは`Q+O 220ms → Q 160ms → W+P 220ms → W 160ms`を繰り返します。手入力中の部位ラベルとボタンが点灯し、TrainingではNOW/NEXT、入力タイミング、GOOD/OK/MISS、前進/後退フィードバックを表示します。縦画面では操作ボタンを2×2に配置します。

## Phase 1G 腕フォーム

物理相対角0°は腕が直線なので、人体肘角を`180° - |前腕角 - 上腕角|`として表示します。走行位相が小さい間はPhase 1Fの中立質量配置を維持し、位相0.08を越えた範囲だけ新フォームへ滑らかに補間します。

| 姿勢 | 前側肩 | 前側人体肘角 | 後側肩 | 後側人体肘角 |
|---|---:|---:|---:|---:|
| Neutral | ±10° | 95° | ±10° | 95° |
| Running | 前30° | 80° | 後24° | 95° |

DEBUGの`ARM FORM TEST`はNEUTRAL、LEFT ARM FRONT、RIGHT ARM FRONTを各1.8秒表示します。脚入力は固定しません。DEBUGには左右の肩人体角、肘人体角、前腕画面角、FRONT/REAR ARMを表示します。

描画は奥腕、奥脚、胴体、手前脚、手前腕の順です。通常表示の手は前腕末端に描画し、物理Hand Bodyと接地判定は変更していません。DEBUG輪郭では実際のHand Bodyも確認できます。

推奨候補（Balance 60%、Arm Swing 70%、Amplitude 35°、Hand Friction Normal）の12サイクル実測は5.357mで、Phase 1G基準4.8m以上を維持しています。

## Phase 1Gの範囲

ゴール、タイマー、ランキング、ハイスコア、敵、障害物、キャラクターステージ、腕の手動操作、完成版ゲームループは未実装です。Phase 1Gは腕フォームを確定する段階です。
