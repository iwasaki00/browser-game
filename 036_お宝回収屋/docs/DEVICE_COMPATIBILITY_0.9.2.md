# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

## 実施範囲

| 対象 | 状態 | 結果 |
|---|---|---|
| PC Chrome | PASS | Windows headless。マウス・Touch/CDP・本番機能確認 |
| PC Edge | PASS | Windows headless。主要画面/本番機能確認 |
| WebKit自動試験 | 未確認 | Playwrightは既存依存。webkit-2370実行ファイル未導入でlaunch不可。追加依存やランタイム導入なし |
| iPhoneサイズのエミュレーション | PASS | 下表。iPhone Safari実機と別区分 |
| iPhone Safari実機 | 未確認 | ユーザー受入待ち |

| ブラウザ | 幅px | 高さpx | 探索/4枠/装備/検索/図鑑/6ライン/復旧 | 横はみ出し | 閉じる |
|---|---:|---:|---|---|---|
| chrome | 320 | 568 | PASS | なし | 画面内 |
| chrome | 375 | 568 | PASS | なし | 画面内 |
| chrome | 390 | 568 | PASS | なし | 画面内 |
| chrome | 430 | 568 | PASS | なし | 画面内 |
| chrome | 1280 | 900 | PASS | なし | 画面内 |
| msedge | 320 | 568 | PASS | なし | 画面内 |
| msedge | 375 | 568 | PASS | なし | 画面内 |
| msedge | 390 | 568 | PASS | なし | 画面内 |
| msedge | 430 | 568 | PASS | なし | 画面内 |
| msedge | 1280 | 900 | PASS | なし | 画面内 |

縦画面は高さ568pxも使用。各画面でscrollWidth<=innerWidth+1、モーダルの閉じる位置、4ボタンを検査。568px幅への回転も確認。高さ320pxの横画面は文書を縦スクロールする構成で、縦画面と同じ一画面収容ではありません。

既存7系統は砂浜長押し/ドラッグ/道具速度/深度、川底投擲・フック・引上げ、河原採取・皿・ふるい・スルース・粒回収を検証。主指/2本目/離した後停止、復旧画面操作、LAB終了は7構成で確認。Safe Area用env、svh、touch-action、長押し抑制の実装を静的確認。

ノッチの実際の余白、Safariアドレスバー/ソフトキーボード、日本語IME、長押しメニュー、実タップの反応、画面回転の体感、熱/電池、Filesアプリへの保存は未確認。エミュレーション結果でPASSに置き換えていません。

## 性能の実測

Chrome390px。rAF 180標本の平均cadence 59.95回/秒、間隔中央値 16.70ms、p95 16.80ms。ディスプレイの実描画FPSではありません。ショップclick→入力欄表示 10回、中央値 98.47ms、範囲 55.84〜169.82ms。Playwrightの待機/通信も含み、指から描画までの遅延ではありません。計測時は他の自動試験も並行実行。

| 状態 | GC後JS heap bytes | interval | Worker | 生存DOM |
|---|---:|---:|---:|---:|
| initial | 3845576 | 2 | 0 | 118 |
| after-60-modal-cycles | 5748152 | 2 | 0 | 770 |
| after-120-modal-cycles | 5712784 | 2 | 0 | 770 |
| after-6-lines | 6655532 | 2 | 0 | 770 |

60→120開閉の増減にはモジュール・固定DOM・キャッシュ・GCが影響。単一測定でリーク不存在を断定しません。実機メモリ/実表示FPS/OS CPUは未測定。

[画面・応答](device-acceptance-v092.json) / [Pointer・復旧](stability-browser-v092.json) / [メモリ](stability-performance-v092.json) / [実機表](IPHONE_ACCEPTANCE_CHECKLIST.md)
