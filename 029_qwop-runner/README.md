# RAGDOLL RUN — Phase 1C

Q/W/O/Pで左右の股関節とひざを個別に動かす、横視点の物理人体・関節制御テストベンチです。Phase 1CではPhase 1A/1Bを維持しながら、人が前進入力を覚えるためのTRAININGモードを追加しています。

## 起動とテスト

リポジトリのルートをHTTPサーバーで配信し、`029_qwop-runner/index.html`を開きます。Matter.jsは`022_pythagora-lab/vendor/matter.min.js`を共有利用します。

```sh
node 029_qwop-runner/tests/phase1a.test.cjs
node 029_qwop-runner/tests/phase1b.test.cjs
node 029_qwop-runner/tests/phase1c.test.cjs
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

頭、胴体、左右の太もも・すね・足を独立Bodyとして、首、股関節、ひざ、足首をConstraintで接続しています。同一キャラクター内の自己衝突は無効、地面との衝突は有効です。全関節は固定せず、60Hz物理更新内のPD制御で目標角度へ追従します。

| 関節 | Kp | Kd | Max Torque |
|---|---:|---:|---:|
| Torso | 0.15 | 0.08 | 0.20 |
| Hip | 4.00 | 0.30 | 4.00 |
| Knee | 6.00 | 0.40 | 6.00 |
| Ankle | 4.00 | 0.30 | 4.00 |
| Neck | 0.45 | 0.12 | 0.30 |

関節制限は股関節`-60°～+60°`、ひざ`-6°～+92°`、足首`-30°～+30°`、首`-25°～+25°`です。

## DEBUG

入力、関節Current/Target/Torque、位置、速度、1秒平均X速度、FPS、画面向き、デモ状態、首接続、左右足のGROUND/AIRと摩擦値を表示します。通常の物理パラメータに加え、次を比較できます。

- Dynamic Foot Friction: 接地足を基準値の118%、遊脚を72%（デフォルトOFF）
- Balance: 100 / 75 / 50 / 25%（デフォルト100%）
- Ankle Control: 100 / 75 / 50 / 25% / OFF（デフォルト100%）

RESET PARAMETERSですべて推奨値へ戻ります。

## Phase 1Cの範囲

100mゴール、タイマー競争、ランキング、ハイスコア、音、障害物、キャラクター・ステージ追加、自動攻略は実装していません。TRAININGは入力を説明・評価するだけで、操作や姿勢を自動修正しません。
