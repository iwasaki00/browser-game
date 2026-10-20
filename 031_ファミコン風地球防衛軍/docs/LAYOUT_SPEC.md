# モバイルレイアウト仕様

対象: Version 0.1.2 — WIDE VIEW & STAGE PROGRESSION

## レイアウトモード

| モード | 優先度 | プレイ中の構成 | メニュー・モーダル |
| --- | --- | --- | --- |
| landscape | 推奨 | 画面幅を使ったシェルの中央に最大サイズの16:9 Canvas、左に移動・JUMP、右にSW・FIRE | Canvas内へ表示 |
| portrait | 継続可能 | 上段に16:9 Canvas、下段に操作専用領域 | ゲームシェル全高を使用 |

向きは `matchMedia("(orientation: portrait)")` で判定し、`html[data-layout]` と `#gameShell[data-layout]` に反映する。プレイ中のみ `#gameShell.is-playing` を付け、portraitの2段構成を有効にする。

portraitのヘッダーに小さく「横向き推奨」を表示し、向きを変えなくても操作を継続できる。画面方向固定APIは使用しない。

## ワールドの描画倍率

- 定数: `VIEW.portraitZoom = 0.70`、`VIEW.landscapeZoom = 0.70`、`VIEW.pcZoom = 0.70`
- 320×180 Canvasは維持し、ワールド描画時のカメラ変換へ倍率を適用する。
- 横方向の可視範囲は `320 / zoom` で算出し、全モード約457.14ワールドピクセルとなる。
- 地面の画面位置は148pxへ固定し、背景、プレイヤー、敵、弾、地形、アイテム、エフェクトを同倍率で描画する。HUD（HP・武器・ボスHP）は等倍の画面座標を使う。
- `js/camera.js` の `worldToScreen` / `screenToWorld` / `clientToScreen` / `followCamera` / `viewBounds` で座標系を統一する。カメラ追従位置は `playerX - 105 / zoom`、端はワールド幅から可視幅を引いて制限する。
- マウス照準は逆変換、タッチ照準は発射位置からパッド方向ベクトルへ変換する。中央タップはプレイヤーの向いている方向へ水平射撃する。
- 背景を横に繰り返し、拡大した上下範囲を空・地面で埋める。地形タイルを可視範囲の両端より外まで敷き、カメラ端や画面揺れでも空白を出さない。
- 弾の画面外判定は `viewBounds` から算出する。敵カリングと画面外再配置も可視幅を使用する。出現トリガーはプレイヤーのワールド位置を維持する。
- Canvasの `imageSmoothingEnabled=false` とCSSの `image-rendering` でnearest-neighborを維持する。

## iPhone Safari対応

- viewportは `viewport-fit=cover` を指定する。
- CSSは `100dvh` を基準にしつつ、JavaScriptで `visualViewport.height` を `--app-height` へ同期する。
- `resize`、`orientationchange`、`visualViewport.resize`、`visualViewport.scroll` で高さを更新する。
- 上下左右の余白へ `env(safe-area-inset-top/right/bottom/left)` を適用する。
- タッチ端末の判定は `any-pointer: coarse` または `navigator.maxTouchPoints > 0` を使用し、900px超の横画面でも仮想パッドを表示する。
- `overscroll-behavior`、`touch-action`、`-webkit-touch-callout` を抑止し、操作中のページスクロールや長押しメニューを避ける。
- モーダルはゲームシェルを超えない最大高、内部スクロール、safe area込みの余白を持つ。

## 仮想パッド

portraitでは左右2群へ分ける。

- 左群: 左移動、右移動、JUMP。左右ボタンは10〜18pxの間隔を確保する。
- 右群: WEAPON SW、FIRE。FIREは104〜132pxの円形領域で、右手親指が届きやすい右側中央へ置く。
- 操作領域全体に下側safe areaを加算する。
- 350px以下の狭幅端末ではボタン寸法と間隔を縮小し、320px幅でも左右が見切れない構成とする。
- landscapeのタッチ端末および900px以下の画面では、基本5操作をシェル下端の左右へ配置する。safe areaを避けたシェル内に収め、FIREは92×78px、移動・JUMP・SWは高さ48px以上とする。

## タイトルと進行記録

- `← TITLE` はゲーム内遷移。進行中ミッションでは確認モーダルを表示して更新を止め、キャンセルで復帰する。
- 確定時は入力とミッション内データ、ゲームオーバー・クリア演出のタイマーを破棄する。イベント登録やrequestAnimationFrameループは再作成しない。
- セーブ形式はv2、キーは旧版と共通。`clearedMissions` と `unlockedMissions` は実装済み一覧 `MISSIONS` とは別に保存する。
- 旧 `cleared` からの移行時とクリア記録時に、クリア済みID自身と次の連番IDを解放済みへ加える。既存の解放済みIDを削除しない。
- ミッション一覧の状態は `COMING SOON`（未実装）を最優先し、実装済みでは `CLEAR` / `OPEN` / `LOCKED` を表示する。出撃直前にも実装・解放条件を再検査する。
- 現在はM01のみ実装済み。将来M02を追加する際は実装一覧と実際のステージ処理を更新することで、既存のM01クリア記録からM02を選択できる。
