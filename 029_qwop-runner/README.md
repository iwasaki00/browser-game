# RAGDOLL RUN — Phase 1E

Q/W/O/Pで左右の股関節とひざを個別に動かす、横視点の物理人体・関節制御テストベンチです。Phase 1Eでは腕フォーム、状態依存Balance、Hand Body、転倒調整用RECOVERY TESTを追加しています。

## 起動とテスト

リポジトリのルートをHTTPサーバーで配信し、`029_qwop-runner/index.html`を開きます。Matter.jsは`022_pythagora-lab/vendor/matter.min.js`を共有利用します。

```sh
node 029_qwop-runner/tests/phase1a.test.cjs
node 029_qwop-runner/tests/phase1b.test.cjs
node 029_qwop-runner/tests/phase1c.test.cjs
node 029_qwop-runner/tests/phase1d.test.cjs
node 029_qwop-runner/tests/phase1e.test.cjs
node 029_qwop-runner/tests/browser-smoke.cjs
```

## 操作

- Q: 右股関節を前、左股関節を後ろへ
- W: 左股関節を前、右股関節を後ろへ
- O: 右ひざを曲げ、左ひざを伸ばす
- P: 左ひざを曲げ、右ひざを伸ばす

太ももとすねにQ/W/O/Pラベルを描画し、該当キーの押下中は明るく拡大します。キーボード、画面ボタン、CONTROL TESTは共通の`inputState`を更新します。

## 縦画面

横向き強制オーバーレイを廃止しました。縦画面ではヘッダ、ゲーム画面、操作エリアを縦に配分し、Q/W/O/Pを2×2へ配置します。DEBUGパネルはゲーム領域の46%以内でスクロールします。横画面では従来どおり4ボタン横並びです。

## 頭と首

頭を胴体へ少し重ねた初期配置に変更し、首Constraintの頭側アンカーを円の内側へ移動しました。首Constraintはstiffness 1、damping 0.5です。相対角度0°への首PDと`-25°～+25°`のソフト制限を適用し、描画時は両アンカー間を肌色の首で結びます。

DEBUGではHead Position、首アンカー間距離、CONNECTED/LOOSE状態を表示します。

## DEMO FORWARD

DEBUG ON時の`DEMO FORWARD`で次の760msサイクルを繰り返します。

1. Q + O: 220ms
2. Q: 160ms
3. W + P: 220ms
4. W: 160ms

デモ中は手動入力を無効にし、現在フェーズと押下中キーを表示・点灯します。`STOP DEMO`、DEBUG OFF、RETRY、ウィンドウフォーカス喪失で停止します。

仕様例の`Q+P → Q → W+O → W`は数値試験で約9秒後に約8.8m後退して転倒しました。ひざ位相を入れ替えた採用シーケンスは12サイクルで約7.5m前進し、姿勢を維持しました。

## TRAINING

画面左上のTRAININGでDEBUGとは独立して切り替えます。NOWに現在入力、NEXTに次の入力を表示し、該当する画面ボタンと身体ラベルを控えめに強調します。

人間入力の受付幅は次のとおりです。最初のキー入力までは判定を開始しません。

| Phase | 受付時間 | NORMAL見本 | SLOW見本 |
|---|---:|---:|---:|
| Q + O | 200–450ms | 220ms | 400ms |
| Q | 100–350ms | 160ms | 280ms |
| W + P | 200–450ms | 220ms | 400ms |
| W | 100–350ms | 160ms | 280ms |

完全一致はGOOD、期待キーを一部含む入力や余分な重複キーを含む入力はOK、期待キーを含まない入力はMISSです。MISSでも停止せず次へ進みます。直近8入力と判定を表示し、正方向のX移動または平均X速度が得られたときはGOOD PUSH / FORWARD、平均X速度が負ならREVERSEヒントを表示します。

WATCH DEMOは選択したNORMAL/SLOW速度で3サイクルだけ再生し、自動停止後にYOUR TURNへ戻ります。DEBUGのDEMO FORWARDは従来どおり連続再生です。

## 物理構造

頭、胴体、左右の上腕・前腕・手・太もも・すね・足を独立Bodyとして、首、肩、肘、手首、股関節、ひざ、足首をConstraintで接続しています。手は地面と胴体、その他の腕・脚は地面だけに衝突する限定的な自己衝突構成です。全関節は固定せず、60Hz物理更新内のPD制御で目標角度へ追従します。

| 関節 | Kp | Kd | Max Torque |
|---|---:|---:|---:|
| Torso | 0.15 | 0.08 | 0.20 |
| Hip | 4.00 | 0.30 | 4.00 |
| Knee | 6.00 | 0.40 | 6.00 |
| Ankle | 4.00 | 0.30 | 4.00 |
| Neck | 0.45 | 0.12 | 0.30 |
| Shoulder | 1.50 | 0.18 | 1.20 |
| Elbow | 0.70 | 0.12 | 0.65 |

関節制限は股関節`-60°～+60°`、ひざ`-6°～+92°`、足首`-30°～+30°`、首`-25°～+25°`です。

## 自動腕振り

左右の股関節相対角度から中立角差を除き、70°で正規化した歩幅値を算出します。値は毎物理フレーム16%ずつ補間し、細かな脚振動が腕へ直結しないよう平滑化します。右脚が前なら左肩、左脚が前なら右肩を前へ送ります。

肩振幅は20 / 25 / 30 / 35 / 40 / 42°から選択でき、デフォルト35°です。前腕は肩35°・肘70°、後腕は肩約25°・肘100°へ補間します。待機時は左右85°の鏡像です。描画順も脚位相から奥腕→胴体→手前腕へ切り替えます。胴体傾斜が35°を超えると腕制御を弱め、転倒時はラグドール挙動へ移行します。

## Hand / Recovery

左右前腕末端に半径8px、基準密度0.00055のHand Bodyを手首Constraintで追加しています。摩擦はLow 0.35 / Normal 0.70 / High 1.05から選択します。

RECOVERY TESTは胴体上部へ8物理フレームの横方向フォースを加えます。位置や角度を直接変更せず、約13～15°のLEANINGを発生させます。POSTUREはSTABLE / LEANING / FALLING / DOWNを表示します。

Balanceは胴体傾斜8°以降、または胴体が通常位置より低く沈んだ場合に早めに弱まり、DOWN時は8%になります。倒れそうな身体を強制的に直立へ戻しません。

## DEBUG

入力、関節Current/Target/Torque、位置、速度、1秒平均X速度、FPS、画面向き、デモ状態、首接続、左右足のGROUND/AIRと摩擦値を表示します。通常の物理パラメータに加え、次を比較できます。

- Dynamic Foot Friction: 接地足を基準値の118%、遊脚を72%（デフォルトOFF）
- Balance: 100 / 75 / 60 / 50 / 40 / 25%（デフォルト100%）
- Ankle Control: 100 / 75 / 50 / 25% / OFF（デフォルト100%）
- Arm Swing: 100 / 75 / 70 / 60 / 50 / 25 / 0%（デフォルト100%、0%は肩・肘の自動PDなし）
- Arm Mass: Light / Normal / Heavy（基準密度の65% / 100% / 145%、デフォルトNormal）
- Arm Amplitude: 20 / 25 / 30 / 35 / 40 / 42°（デフォルト35°）
- Hand Friction: Low / Normal / High（デフォルトNormal）

RESET PARAMETERSですべて推奨値へ戻ります。

肩・肘のCurrent / Target / Torque、ARM SWING、ARM MASS、左右手足の接地、POSTURE、転倒減衰後の有効制御率もDEBUGへ表示します。

## Phase 1Eの範囲

腕の手動操作や新しい操作キー、100mゴール、タイマー競争、ランキング、ハイスコア、音、障害物、キャラクター・ステージ追加、自動攻略は実装していません。プレイヤー操作はQ/W/O/Pのままです。
