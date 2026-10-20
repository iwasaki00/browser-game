# モバイルレイアウト仕様

対象: Version 0.1.1 — PORTRAIT LAYOUT TUNE

## レイアウトモード

| モード | 優先度 | プレイ中の構成 | メニュー・モーダル |
| --- | --- | --- | --- |
| portrait | 主表示 | 上段に16:9 Canvas、下段に操作専用領域 | ゲームシェル全高を使用 |
| landscape | 補助表示 | 16:9 Canvas上へ操作ボタンを重ねる | Canvas内へ表示 |

向きは `matchMedia("(orientation: portrait)")` で判定し、`html[data-layout]` と `#gameShell[data-layout]` に反映する。プレイ中のみ `#gameShell.is-playing` を付け、portraitの2段構成を有効にする。

## portraitの描画倍率

- 定数: `VIEW.portraitZoom = 0.80`
- landscape: `VIEW.landscapeZoom = 1.00`
- 320×180 Canvasは維持し、ワールド描画時のカメラ変換へ倍率を適用する。
- 横方向の可視範囲は `320 / zoom` で算出するため、portraitでは400ワールドピクセル、landscapeでは320ワールドピクセルとなる。
- 地面の画面位置は148pxへ固定し、プレイヤー、敵、弾、地形、アイテム、エフェクトのみを同倍率で描画する。HUDは読みやすさを保つため等倍とする。
- 照準座標は倍率の逆変換を行い、描画倍率が変わっても射撃方向を一致させる。

## iPhone Safari対応

- viewportは `viewport-fit=cover` を指定する。
- CSSは `100dvh` を基準にしつつ、JavaScriptで `visualViewport.height` を `--app-height` へ同期する。
- `resize`、`orientationchange`、`visualViewport.resize`、`visualViewport.scroll` で高さを更新する。
- 上下左右の余白へ `env(safe-area-inset-top/right/bottom/left)` を適用する。
- `overscroll-behavior`、`touch-action`、`-webkit-touch-callout` を抑止し、操作中のページスクロールや長押しメニューを避ける。
- モーダルはゲームシェルを超えない最大高、内部スクロール、safe area込みの余白を持つ。

## 仮想パッド

portraitでは左右2群へ分ける。

- 左群: 左移動、右移動、JUMP。左右ボタンは10〜18pxの間隔を確保する。
- 右群: WEAPON SW、FIRE。FIREは104〜132pxの円形領域で、右手親指が届きやすい右側中央へ置く。
- 操作領域全体に下側safe areaを加算する。
- 350px以下の狭幅端末ではボタン寸法と間隔を縮小し、320px幅でも左右が見切れない構成とする。
- landscapeのタッチ端末および900px以下の画面では、基本5操作をCanvas下端へ重ねて表示する。
