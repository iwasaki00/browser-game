# モバイルレイアウト仕様

対象: Version 0.1.4 — MASS INVASION

## レイアウトモード

| モード | 優先度 | プレイ中の構成 | メニュー・モーダル |
| --- | --- | --- | --- |
| landscape | 推奨 | 画面幅を使ったシェルの中央に最大サイズの16:9 Canvas、左に移動・JUMP、右にSW・FIRE | Canvas内へ表示 |
| portrait | 継続可能 | 上段に16:9 Canvas、下段に操作専用領域 | ゲームシェル全高を使用 |

向きは `matchMedia("(orientation: portrait)")` で判定し、`html[data-layout]` と `#gameShell[data-layout]` に反映する。プレイ中のみ `#gameShell.is-playing` を付け、portraitの2段構成を有効にする。

portraitのヘッダーに小さく「横向き推奨」を表示し、向きを変えなくても操作を継続できる。画面方向固定APIは使用しない。

## ワールドの描画倍率

- 定数: `BATTLE_CAMERA.minZoom = 0.35`、`maxZoom = 0.85`、`idleZoom = 0.50`。PC・landscape・portraitで共通の自動ズーム
- 320×180 Canvasは維持し、ワールド描画時のカメラ変換へ倍率を適用する。
- 横方向の可視範囲は `320 / 現在倍率` で算出し、約376.47〜914.29ワールドpx（敵なしは640px）となる。
- 地面の画面位置は148pxへ固定し、背景、プレイヤー、敵、弾、地形、アイテム、エフェクトを同倍率で描画する。HUD（HP・武器・ボスHP）は等倍の画面座標を使う。
- `js/camera.js` の `worldToScreen` / `screenToWorld` / `clientToScreen` / `viewBounds` で座標系を統一する。位置と倍率は `createBattleCamera` / `evaluateBattleCamera` / `updateBattleCamera` で管理し、端はワールド幅から現在の可視幅を引いて制限する。
- マウス照準は逆変換、タッチ照準は発射位置からパッド方向ベクトルへ変換する。中央タップはプレイヤーの向いている方向へ水平射撃する。
- 背景を横に繰り返し、拡大した上下範囲を空・地面で埋める。地形タイルを可視範囲の両端より外まで敷き、カメラ端や画面揺れでも空白を出さない。
- 弾の画面外判定は `viewBounds` から算出する。敵カリングと画面外再配置も可視幅を使用する。出現トリガーはプレイヤーのワールド位置を維持する。
- Canvasの `imageSmoothingEnabled=false` とCSSの `image-rendering` でnearest-neighborを維持する。

## 自動ズームの評価と追従

調整値は `js/data.js` の `BATTLE_CAMERA` に集約する。ミッション単位でカメラ状態と集計バッファを作り、リトライ時は初期化する。セーブには追加項目を持たせない。

| パラメータ | 初期値 | 用途 |
| --- | --- | --- |
| minZoom / maxZoom / idleZoom | 0.35 / 0.85 / 0.50 | 全体の倍率制限と敵なし基準 |
| evaluationDistance / bandWidth | 600 / 100ワールドpx | 評価半径と前後各6帯の集計 |
| evaluationInterval | 0.15秒 | 評価間隔 |
| farZoom / distanceFalloff | 0.38 / 215px | 距離に対する連続曲線 |
| crowdPenalty / maxCrowdPenalty | 0.006 / 0.08 | 3体を超える有効敵数の倍率補正 |
| crowdFreeCount / isolationDistance / isolatedGroupLimit | 3体 / 200px / 2体 | 集団補正と単独外れ値判定の閾値 |
| rearWeight / isolatedFarWeight | 0.65 / 0.18 | 後方と遠方単独外れ値の重み |
| groupPadding / groupScreenFraction | 48ワールドpx / 0.80 | 集団全体を収める余裕 |
| zoomDeadband / candidateTolerance | 0.015 / 0.04 | 小振動の抑止と候補倍率の安定判定 |
| engageHold / idleHold | 0.30 / 0.45秒 | 目標採用までの安定待ち |
| zoomInRate / zoomOutRate / positionRate | 2.2 / 2.6 / 5（毎秒） | 指数補間の追従速度 |
| lookAhead / playerMargin | 32 / 56画面px | 前方余白とプレイヤーの安全域 |
| bossMinZoom / bossMaxZoom / bossPadding | 0.35 / 0.65 / 100ワールドpx | ボス戦の制限と攻撃視認用の余裕 |
| midbossMaxZoom / midbossPadding | 0.70 / 80ワールドpx | 中ボスの構図 |

1. `game.enemies` の実在する敵を1回走査する。死亡、HP0以下、`active=false`、`spawned=false`、評価距離外を除外する。描画カリングや将来の出現予定は参照しない。
2. 前後100px帯ごとに敵数・距離合計・左右端を集計する。重みは敵数の平方根、後方係数、単独外れ値係数を組み合わせる。200px超の単独帯で隣接帯にも敵がいない場合、距離分布への寄与を弱め、集団の左右端から除外する（総数2体以下は除外しない）。
3. 基本目標は `farZoom + (maxZoom - farZoom) × exp(-重み付き距離 / distanceFalloff)`。敵数補正を引き、集団の左右端とプレイヤーを80%の画面幅へ収める倍率との小さい方を採用する。距離帯は集計用であり、倍率を段階切替しない。
4. 目標は0.30秒安定してから採用し、差0.015以下は維持する。敵なしへ戻るときは0.45秒待つ。現在倍率と位置は `目標 + (現在 - 目標) × exp(-追従速度 × dt)` で更新し、倍率を常に0.35〜0.85へ制限する。
5. 移動速度の符号を進行方向とし、照準による向き変更では前方余白を反転しない。前方32画面pxの余裕を滑らかに切り替え、可能なら評価した集団の両端も画面に収める。ワールド端の制限を優先しつつ、それ以外ではプレイヤーを左右56画面pxの安全域に保つ。
6. ボス戦では生存ボスとプレイヤーの左右端＋余白から目標を計算する。通常敵の召喚数はボス構図の倍率に使用しない。中ボスにも専用構図を使い、死亡後は通常評価へ自然に戻す。

距離帯バッファ4本はTypedArrayで再利用する。評価は `O(敵数 + 12帯)`、フレームごとの追従は `O(1)`。カメラ処理は配列のソートや敵ごとの一時オブジェクトを生成しない。0.1.4では敵密度30/50/100体へ対応し、同じ評価距離・倍率制限・ボス構図を維持する。

照準・弾・爆発・背景・敵は補間中の**現在倍率と現在位置**を使用する。HUDと仮想パッドはワールド変換の外で表示する。画面サイズの変更時もカメラ倍率を基準値にリセットしない。

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
