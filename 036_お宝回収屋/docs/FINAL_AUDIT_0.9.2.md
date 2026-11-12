# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

監査日：2026-11-12。対象は既存036。新システム・道具・お宝・エリア・価格・出現率の追加変更なし。commit/push/公開コマンドなし。

## 前版資料と7件の再監査

FINAL_REPORT_0.9.1、QUALITY_AUDIT_0.9.1、SAVE_SAFETY_REPORT、PERFORMANCE_REPORT_0.9.1、RELEASE_READINESS、IPHONE_SAFARI_TEST、README/CHANGELOG/TEST_RESULTSはすべて存在し、確認。欠落資料なし。

| ID | 重大度 | 原因 | 再現条件 | 維持した修正 | 現在の試験結果 | 証跡 |
|---|---|---|---|---|---|---|
| S01 | Critical | 競合拒否前にバックアップを上書き | 主保存999/競合123 FN | IDBのrevision/進行権検証→確定→バックアップ。競合後の書込を保護 | CAS拒否後backup42を保持、最新primary999。緊急保存99も維持 | stability-browser-v092.json |
| S02 | High | 必須値欠損を初期値で補完 | currentFN等を削除したJSON | validateCoreで必須値を検証、旧optionalは移行 | 既存STABLE6項目＋import missingを拒否。元データ不変 | tests/stability.test.ts / import-acceptance-v092.json |
| S03 | High | 保存禁止時の例外と復旧導線が所有権ガードに阻まれる | IDB SecurityError/両保存破損320px | 起動/再開/終了のcatch、タイトル復旧画面と所有権ガードの限定 | 退避・ファイル選択が可能、未処理例外0。書込は進行権を維持 | stability-browser-v092.json |
| I01 | Medium | 右ボタンでも掘削開始 | 右クリックを250ms保持 | 主Pointer/左ボタンのみ受付 | 掘削回数不変。通常入力は7回帰で確認 | acceptance-stability-browser-test.mjs |
| I02 | Medium | 別の指で作業開始・所有指以外の終了が混ざる | 主指を別UIに置き、2本目で引く。皿で他指を離す | primary/owner pointerIdで開始と終了を照合 | 2本目で引上げない。他指を離しても皿は継続、主指終了で停止 | stability-browser-v092.json |
| L01 | Medium | LABを閉じてもWorker/周期処理が残る | 比較中にX、繰返し開閉 | disposeDebugLabと遅延mountの非表示チェック | X後Worker0、intervalは起動時と同数。120開閉でも確認 | stability-browser-v092.json / stability-performance-v092.json |
| U01 | Low | 長文保存警告が320pxで縦にはみ出す | LS QuotaExceededError | 短いフッター、詳細は設定/titleへ | 高さ568のままバックアップ注意を表示 | stability-browser-v092.json |

Critical/Highの3件を含め、上記条件で再発なし。一般的な全環境での不存在を保証するものではありません。

## 新たに確認した問題

Critical 0 / High 2 / Medium 1 / Low 1。4件とも修正済み。

### A01 High — インポート個体IDからDOM実行

再現：HTML属性を含むUIDを持つ砂利JSONを受理し、選別台を開くとimg/onerrorが実行。

原因：河原のUID/砂利袋IDと設備個体IDをHTML属性へ無エスケープで挿入。危険キーの事前拒否もない。

修正：clone前の危険キー・識別子・入れ子検証。河原と設備の属性をエスケープ。

回帰：acceptance.test.ts + acceptance-import.mjs。インポート拒否と検証を迂回した直接描画でも不活性。

証跡：import-dom-repro-before-v092.json / acceptance-repro-before-v092.json / import-acceptance-v092.json

### A02 Medium — 砂在庫の参照矛盾を受理

再現：同じ砂バッチID、存在しない個体、二つの袋に同じ個体を設定。

原因：砂の量の検証はあったが、バッチIDと内容物の所有関係を検証していない。

修正：バッチID/個体の一意性、batch状態、配分量、残渣参照を検証。内容物の再抽選なし。

回帰：acceptance.test.ts + invalid sand/queue browser cases。正常な砂利・6ラインも完全一致。

証跡：acceptance-repro-before-v092.json / import-acceptance-v092.json

### A03 High — 異常品質の洗浄後に保存不能

再現：quality/initialQuality=1e308を受理。報酬FNは固定額のままだが、評価と図鑑bestがInfinityとなり、次回migrateは拒否。

原因：有限・非負だけで品質を検証し、評価計算の有効範囲を限定していない。

修正：通常生成とLABの上限を確認して品質0〜2、初期品質0〜2を検証。保管個体も同じ検証。FNは0〜MAX_SAFE_INTEGER。

回帰：acceptance.test.ts + qualityOverflow import case。元の主保存・バックアップ不変。

証跡：numeric-repro-before-v092.json / import-acceptance-v092.json

### A04 Low — JSONとIDBで設備の停止理由が不一致

再現：6ラインをJSON round-tripすると、共有参照のあるIDB snapshotとは設備reasonだけ異なる。

原因：machinesの停止理由を更新後、instancesの別オブジェクトへ参照を付け替える。

修正：validateFacilitiesで全設備個体の停止理由を共通正規化。数量・進捗・FNは変更なし。

回帰：砂利/6ラインのJSON全状態一致と移行反復一致、12状態の保存試験。

証跡：json-facility-repro-before-v092.json / stability-browser-v092.json

## その他の改善と試験の制約

viewportのmaximum-scale=1指定を削除。ゲーム面と皿のtouch-action:none、通常ボタンのmanipulationは維持し、ブラウザ全体のズームを明示的に禁止しません。実機Safariのダブルタップ/ピンチ動作は未確認。

最初の同時負荷時、河原回帰が固定8ストローク後のgoldStats未生成で失敗。コード変更せず単独再実行で成功し、その後の最終7系統の結果は[回帰証跡](regression-browser-results-v092.json)。固定実秒ベースの入力試験には環境負荷の影響があります。

別環境復元の初回比較は「再開ボタンを押した後」のexperience/loadoutsも比較して失敗。新規の装備選択イベントと保存を区別し、再読込後・再開前の保存全体を比較して一致。これをセーブ欠落として修正していません。

## 公開判定

**CONDITIONAL**。自動試験・PC・保存の主要条件はPASS。iPhone実機、全体の権利/配布許諾、任意形式の個人情報を含む公開範囲の最終確認が未完。確認済み重大問題の未修正は0。

[端末](DEVICE_COMPATIBILITY_0.9.2.md) / [保存](SAVE_RECOVERY_AUDIT.md) / [権利・安全性](SECURITY_AND_LICENSE_AUDIT.md) / [30項目報告](FINAL_REPORT_0.9.2.md)
