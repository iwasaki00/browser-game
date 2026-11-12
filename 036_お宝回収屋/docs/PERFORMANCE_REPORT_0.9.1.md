# Version 0.9.1 — STABILITY & FINAL POLISH

## 条件と実測

Windows上のheadless Chrome開発版、390px。実機iPhoneではありません。GC後のJSヒープ、CDP DOMカウンター、interval/Worker、renderer main-thread TaskDurationを測定しました。

| 状態 | JS heap bytes | interval | Worker | 生存DOM |
|---|---:|---:|---:|---:|
| initial | 3755036 | 2 | 0 | 118 |
| after-60-modal-cycles | 6016984 | 2 | 0 | 770 |
| after-120-modal-cycles | 5786448 | 2 | 0 | 770 |
| after-6-lines | 8675368 | 2 | 0 | 770 |

初回の増加にはLABモジュール/固定DOM/キャッシュを含みます。60→120回開閉でJSヒープは低下、DOMは同数、タイマーは起動時と同数、Worker0でした。単一試験でメモリリーク不存在を一般化しません。

6ライン・1002対象・未洗浄100個・図鑑300の15.01実秒で、main-thread TaskDuration 3.00秒、ScriptDuration 2.31秒、比率約19.97%。OS全体CPU使用率ではありません。

| 演出 | draw中央値ms | p95 ms | 標本数 |
|---|---:|---:|---:|
| canvasDraw-full | 3.30 | 6.00 | 300 |
| canvasDraw-light | 4.00 | 8.60 | 300 |
| canvasDraw-off | 4.00 | 8.20 | 300 |

60秒保持の継続掘削の実行は69.99秒（操作送信/待機を含む）。図鑑300種は12カード、検索/モーダル20回/保存/大量荷物を確認。設定間の小差とばらつきがあるため軽量化の速度向上を断定せず、drawだけをFPSや入力遅延と呼びません。

## 24ゲーム時間

6ライン同時、1002個の大量処理で1002個回収、キュー最大64件。24ゲーム時間の連続供給で4332個、最近履歴200件、保存容量は1時間177719→24時間183599 bytes。非表示時不変・移行反復の同一性を確認。実計算64.93秒。Node.js heapはブラウザ値と区別します。

## 未測定

iPhone実機のメモリ/OSプロセスCPU/FPS/入力遅延/熱/電池、実時間24時間のブラウザ運転、NodeのCPU時間は未測定。WebKit未インストール。[メモリ/CPU](stability-performance-v091.json) / [描画](ux-performance-v091.json) / [負荷](advanced-stress-v091.json)。
