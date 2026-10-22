# ORBIT MAKER（オービットメーカー）

Version 0.1.0 — Gravity Core

惑星をドラッグして重力場を調整し、ロケットを緑のゲートへ導く2D物理パズルです。依存パッケージや外部サービスはありません。

## 起動

ES Modulesを使用するため、ローカルHTTPサーバーから開きます。

```powershell
cd C:\_wk\github\browser-game\034_惑星重力ゲーム
py -3 -m http.server 8034
```

ブラウザで `http://localhost:8034/` を開いてください。

## テスト

```powershell
cd C:\_wk\github\browser-game\034_惑星重力ゲーム
npm test
```

## 構成

- `js/physics.js`: DOMに依存しない重力計算、Velocity Verlet積分、連続衝突判定、軌道シミュレーション
- `js/stages.js`: ステージデータ
- `js/game.js`: 入力、ゲーム状態、Canvas描画
- `tests/physics.test.mjs`: Gravity Coreに関係する物理・判定テスト
