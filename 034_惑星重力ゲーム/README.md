# ORBIT MAKER（オービットメーカー）

Version 0.1.1 — SLINGSHOT LAUNCH

発射方式は「精密発射」と「スリングショット」から選択できます。選択はlocalStorageに保存します。
精密発射は従来のANGLE・THRUSTとLAUNCHを使用します。
スリングショットではロケットの円内から引いて離すと反対方向へ発射します。14ワールド単位以内へ戻すとキャンセルし、速度は120〜220です。
RESETは配置と精密設定を初期化し、再試行は配置を保ちます。選択した発射方式はどちらでも維持します。
複数指、Pointer Cancel、フォーカス喪失では発射をキャンセルします。
`js/launch.js` は発射変換とモード保存を担当し、共通の初期速度ベクトルを物理層・将来の軌道予測で使用できます。

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
