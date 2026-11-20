# v0.6.1 — TRACE CONTROL FIX 調査・修正報告

2026-11-21（日本時間）。コミット・push・公開なし。変更ファイルはLF。

## 原因調査と判断

録画ファイル自体と録画時のiOS/Safariバージョン・表示倍率・ビューポート値は提供されていない。利用者の現象報告とv0.6.0のコードを照合した。実機で原因を確定したという報告ではない。

| 項目 | v0.6.0のコードで確認したこと | v0.6.1での対応 |
| --- | --- | --- |
| 道具の選択 | `tool-trace`クリック→`tool='trace'`→`beginTrace()`→パネル閉鎖。選択経路は自動テストでも正常。「道具：砂」は通常の砂を選択中の表示であり、なぞり砂中の表示ではない | 通常も省略せず「砂を触る」、なぞり砂は「なぞり砂」と表示。メニューは「なぞり砂（重力なし）」にし、選択項目へチェック・強調色・太字 |
| 重力・慣性停止 | `beginTrace()`が既存速度をゼロにし、`PathEngine.step()`が通常物理を停止。溝保持は既に正常 | この処理と押し分けアルゴリズムは維持。さらにアプリのframeでも通常物理を呼ばない |
| 重力の設定保持 | なぞり砂中も矢印クリックが`tilt.manual()`を呼び、`applyGravity()`が設定を書き換えられた。センサーでも保存重力の値が変わる。実移動は停止していたが、入力設定を保持する境界が不明確 | 重力パネルに無効の案内、矢印・傾き開始・基準合わせを無効化。強制クリックもガード。センサーは最新入力だけ保持し、Freeの重力へ適用しない。通常道具に戻ると以前の手動方向／維持していた傾き入力の最新方向で再開 |
| Safariのタッチ | viewportはdevice-width、Canvasの`touch-action:none`・選択／長押し抑止は既に存在。Touch Eventsの非passiveな抑止はなかった | Canvas限定でtouchstart/move/endを`passive:false`＋cancelable時のpreventDefault、dblclickも抑止。pointerup/cancel/lostcapture・touchcancel・ウィンドウblurで古い軌跡とcaptureを終了 |
| 左寄り・右の空白 | アプリはwidth100%・中央寄せ・max-width64remで、固定のスマホ横幅はない。viewport設定にも明らかな誤りはない。録画時の倍率・横スクロール値がないため、ページ幅、拡大率、表示領域の移動のどれかは未特定 | root幅と横方向のoverflow/overscroll、グリッド子の最小幅、パネルの長文折返しを制約。キャンバスと端に余白。診断欄にinner/visual viewport、scale/offset、clientWidth/scrollWidth/scrollXを追加 |

`scrollWidth > clientWidth`は内容の横はみ出し、`scrollX`やvisual viewportのoffsetは横移動、scaleはピンチ等の表示拡大を調べる手掛かりになる。Safariのページ拡大設定も別途確認する。実測なしに「右の空白は解消した」とは断定しない。

## 変更ファイル

- `src/app.js`：現在の道具名、重力入力ガード・復帰、frame停止、キャンバス限定タッチ抑止、capture終了、設定内の幅・倍率診断。
- `index.html`：v0.6.1、メニュー名、重力無効の案内、診断項目。
- `style.css`：選択チェック・強調、横方向のはみ出し／overscroll対策、stage内の余白。dvh、セーフエリア、設定内スクロール、縦スクロールの代替は維持。
- `package.json`：バージョンのみ。
- `test/trace.test.js`：標準／高精細の落下中の慣性停止と右左上重力からの復帰、2件追加。
- `test/app-tilt.test.js`：選択直後の配置保持、表示・重力設定・入力モードの保持と復帰、強制入力ガード、非passiveなタッチ抑止の範囲、Pointerキャンセル、設定の開閉を追加。
- `test/layout.html`・`test/layout-browser.js`：v0.6.1の幅・横スクロール・倍率を検査する準備。**未実行**。
- `scripts/qa-serve.mjs`：上記レイアウト検証のJSON専用出力先を追加。通常起動には書き込みAPIなし。画像保存・動画保存・共有機能は追加なし。
- `README.md`・`docs/IPHONE_CHECKLIST.md`・本ファイル：調査結果、操作と未確認項目。

既存の`src/paths.js`の押し分け、`engine.js`、`hourglass.js`、`tilt.js`、`reassembly.js`は変更していない。

## 検証結果

| 環境 | 結果 |
| --- | --- |
| Node v25.9.0 / Windows x64 | **85件成功、失敗0**。既存83件を含む。全実行約22.4秒 |
| 実ブラウザ | **未確認**。Computer Use接続が`native pipe is unavailable`で失敗。CSSレイアウト、実際のズーム・スクロール、ネイティブPointer Capture、FPSは確認できていない |
| iPhone Safari実機 | **未確認**。実機のダブルタップ・端スワイプ・指離し・設定スクロール・縦画面の収まりの改善効果は未確認 |
| Windows iPhone Web Emulator | **未確認** |

自動テストで、標準／高精細の不透明画像中央の連続した溝、指離し後の保持、右・左・上重力と既存慣性の停止、スワイプ前後のID・色・個数・壁の保持、通常道具への重力復帰、リセット・復元を確認。手動重力の復帰と、傾きモードを維持したままの再開は実アプリのハンドラーでも確認した。既存の砂時計流下・反転、壁、画面回転とタッチ座標のテストも成功。

模擬DOMのTouch Event検証はキャンセル処理と登録オプションを検証するもの。Safariが実際にズームを抑止すること、CSSが期待どおり配置されることの証明にはしない。

## Safari側の制約と確認手順

WebKitはtouch-actionによるタップ動作の制御と、Safari 16からのoverscroll-behavior対応を説明している。[WebKitのタップ動作解説](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/)、[Safari 16のoverscroll対応](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/)。Pointer Eventsの既定動作制御はCSSのtouch-actionを基本とする。[W3C Pointer Events](https://www.w3.org/TR/pointerevents/)

ページ側ではキャンバス内の操作、横のはみ出し、スクロール連鎖を抑える。Safariにはoverscroll指定で履歴ナビゲーションを止められない報告もあり、OS・ブラウザが先に扱う画面最端の戻るジェスチャーまで完全に防げるとは保証しない。[WebKitの履歴ナビゲーションに関する報告](https://bugs.webkit.org/show_bug.cgi?id=240183)。最端から始める操作はキャンバス内部からの操作と区別して確認する。ページ全体のuser-scalable=noやmaximum-scale=1は追加していない。

実機ではヘッダーのv0.6.1を確認し、道具→「なぞり砂（重力なし）」→写真中央をひとなぞり→指離しの順で溝保持を確認する。通常道具に戻し重力再開を確認。その後、Canvasのダブルタップ・領域外へのスワイプ・OSキャンセルと、写真選択・設定スクロール・Canvas外の拡大を別々に確認する。

画面幅390×844／375×667相当・Safariバー展開・文字拡大時に横はみ出しと操作位置を確認。空白が出たら診断欄の値とSafariページ拡大設定を記録する。ブラウザ接続が回復した場合は `npm run qa` → `/test/layout.html` で模擬サイズを検査でき、JSONはこのフォルダーへ保存される。現時点で実ブラウザの結果JSONは生成していない。
