# Version 0.9.0 — GAME EXPERIENCE REFINEMENT

## 自動確認

| 条件 | 結果 |
|---|---|
| 単体・整合性 | 617件成功（既存581＋追加36）、失敗0 |
| 既存ブラウザ | 7/7成功、browser / depth-browser / reveal-browser / river-browser / gold-browser / beach-browser / field-browser |
| 新UI | Chrome 320×568 / 390×900 / 1280×900、Edge 390×900成功 |
| 入力 | 初回掘削/回収/洗浄、購入・4枠切替、検索・変換中の入力保持と確定、案内非表示/再読込 |
| 画面 | 横はみ出しなし、固定モーダル/内部スクロール、上部通知と下部操作の分離 |
| 図鑑 | 300種、表示12件/ページ、最近の初登録 |
| DEBUG LAB | 8タブ・UX20件、全179シナリオ維持、Worker中止/CSV/通常保存分離 |
| 既存設備/6ライン | 投入/停止再開/画面間稼働、管理・比較・中止・保存分離成功 |
| 本番 | Chrome/Edge、開発API/強制操作/隠し入口無効、デバッグ文字列なし |

[UX画面](ux-browser-v090.json) / [7回帰](regression-browser-results-v090.json) / [設備](automation-ui-results-v090.json) / [6ラインUI](advanced-ui-v090.json) / [川底・河原の時間操作](field-feel-ui-v090.json) / [本番](production-results-v090.json)。

## 保存・24ゲーム時間

大量履歴 849576 → 29915 bytes、最近200件と累計支払い10000件を維持。保存中の進捗、緊急バックアップ、単一タブの所有権移譲/再読込を確認。

6ライン同時・24ゲーム時間を約100.20実行秒で計算。1002個の大量処理試験は1002個を回収、キュー最大64件。連続供給では累計4332個、履歴200件。保存容量は1時間 177719 →24時間 183599 bytes。非表示時の状態不変・繰り返し移行の同一性を確認。これは人間が24時間操作した試験ではありません。[保存](save-phase0-v090.json) / [負荷](advanced-stress-v090.json)。

## ブラウザ実測の限界

Windowsのheadless Chrome開発版、390px。300種/6ライン/未洗浄100個、20回モーダル開閉、検索、保存を実行。図鑑DOMは12カードで一定。継続掘削は 64.97秒（60秒の保持＋操作送信/待機を含む）。

| 演出 | draw中央値ms | draw p95 ms | 標本数 |
|---|---:|---:|---:|
| full | 2.10 | 3.80 | 300 |
| light | 1.50 | 2.80 | 300 |
| off | 1.70 | 2.80 | 300 |

GC後の実測JSヒープ 6611056 bytes、DOM 283、保存 294502 bytes。draw関数の時間で、総フレーム時間/FPS/入力遅延ではありません。各設定は同じ砂浜・体力を準備して操作。単一PC測定のばらつきがあり、軽量が常に速いとは断定しません。ブラウザ値と、負荷試験のNode.js heapを混同しません。[性能JSON](ux-performance-v090.json)。

## 型検査・本番ビルド

TypeScript noEmit＋Vite成功。JS index-hrKCOJa4.js 389893 bytes / CSS index-Bf2RhA8R.css 25073 bytes。DEV条件の動的importでUI・強制操作・比較Workerを除外。

## 未確認

Playwright WebKitランタイムが未インストールのため未実施。実機iPhone Safari、実ノッチ/ホームインジケータ、ソフトキーボード、OSの日本語IME、発熱/電池、実機長時間操作、PCの人間の操作感・楽しさは未確認。Safe Area/長押し/拡大抑制の既存実装は維持しましたが、端末固有挙動の保証はしていません。[評価表](PLAYTEST_0.9.0.md)は全12項目未評価・ユーザー確認待ち。
