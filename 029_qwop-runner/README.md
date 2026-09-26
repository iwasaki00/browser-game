# QWOP Runner Ver 1.0.0

Q/W/O/Pの4キーで左右の股関節と膝を個別に動かす、横視点の物理100mランニングゲームです。転倒してもレースは続き、後退や這った状態でのゴールも可能です。

## 起動方法

リポジトリのルートをHTTPサーバーで配信し、`029_qwop-runner/index.html`を開きます。

```sh
python -m http.server 8000
```

ブラウザで `http://localhost:8000/029_qwop-runner/` を開いてください。Matter.jsは `022_pythagora-lab/vendor/matter.min.js` を利用します。

## ゲームの流れ

1. READY画面で難易度を選びます。
2. 必要ならTRAININGを有効にします。
3. START 100mを押します。
4. READY → 3 → 2 → 1 → GO! の後、100mを走ります。
5. GOAL後にTIME、難易度別BEST、BEST DISTANCEを確認します。
6. RUN AGAINでREADYへ戻ります。

## 操作

- Q: 右股関節を前、左股関節を後ろへ動かす
- W: 左股関節を前、右股関節を後ろへ動かす
- O: 右膝を曲げ、左膝を伸ばす
- P: 左膝を曲げ、右膝を伸ばす
- Enter / Space: READYからスタート、またはGOAL後にRUN AGAIN

キーボードと画面下部のタッチボタンに対応しています。カウントダウン中の入力は無効で、WAITが表示されます。

## 難易度

難易度は移動速度ではなく、既存物理に掛ける姿勢補助倍率で変化します。操作ルールとQ/W/O/Pの脚目標は全難易度で共通です。

| 難易度 | Balance | Ankle | Neutral Assist | Fall Assist | Arm Swing | Amplitude |
|---|---:|---:|---:|---:|---:|---:|
| EASY / 簡単 | 90% | 100% | 115% | 120% | 70% | 32° |
| NORMAL / 普通 | 60% | 100% | 100% | 100% | 70% | 35° |
| HARD / 難しい | 35% | 50% | 60% | 55% | 65% | 35° |

- EASY: 姿勢補助が強く、操作練習向け。自動歩行や入力補完はありません。
- NORMAL: Phase 1で確定した推奨C設定を基準にした標準QWOP体験です。
- HARD: 姿勢・足首・中立姿勢補助が弱く、誤操作で転倒しやすいモードです。

初回はNORMALです。最後に選んだ難易度はlocalStorageへ保存されます。変更できるのはREADY中だけです。

## TRAINING

TRAININGは次に押すキー、入力タイミング、GOOD/OK/MISSを表示します。全難易度で使用でき、人間操作としてVALID記録になります。WATCH DEMOを使った走行はDEBUG RUNになり、記録されません。

## 100m CHALLENGE

HUDにはDISTANCE、TO GO、TIME、難易度別BESTを表示します。50mでHALFWAY、90mでFINAL 10mを表示し、100mでタイマーと入力を停止します。進捗バー、STARTライン、10m目盛り、50m表示、フィニッシュラインを備えています。

## 記録

BEST TIMEとBEST DISTANCEはEASY / NORMAL / HARD別にlocalStorageへ保存します。NEW BEST時は前回記録、新記録、差分を結果画面へ表示します。TRAININGはVALID、DEMOや自動DEBUGテストはINVALIDです。

## DEBUG

DEBUGには物理パラメータ表示、DEMO FORWARD、DRIFT TEST、FALL TEST、RECOVERY TEST、ARM FORM、ARM CONNECTION、ELBOW MATRIXがあります。自動操作や診断を使ったレースはDEBUG RUNとなり、BESTを更新しません。

## 縦横画面

PC横画面、スマートフォン縦画面の両方に対応します。縦画面ではHUD、難易度選択、結果カード、Q/W/O/Pを再配置します。

## 主要物理仕様

- Matter.js、60Hz固定ステップ
- Engine iterations: position 14 / velocity 12 / constraint 6
- Gravity: 0.72
- Ground friction: 1.05
- Foot friction: 1.35
- Joint Constraint: stiffness 0.985 / damping 0.32
- Balance Kp / Kd / max force: 0.0020 / 0.020 / 0.10
- Torso PD: 0.15 / 0.08 / 0.20
- Hip PD: 4.00 / 0.30 / 4.00
- Knee PD: 6.00 / 0.40 / 6.00
- Ankle PD: 4.00 / 0.30 / 4.00
- Shoulder PD: 2.50 / 0.15 / 1.20
- Elbow PD: 1.50 / 0.12 / 1.00

難易度はこれらの基礎値を書き換えず、`difficulty.js`の倍率を適用します。

## テスト

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
node 029_qwop-runner/tests/phase1k.test.cjs
node 029_qwop-runner/tests/phase2a.test.cjs
node 029_qwop-runner/tests/phase2b.test.cjs
node 029_qwop-runner/tests/final.test.cjs
node 029_qwop-runner/tests/browser-smoke.cjs
```

FINAL TESTは3難易度の無操作、通常前進、誤操作、転倒、100m GOAL、難易度別記録、TRAINING、DEBUG RUN、縦横UIを検証します。
