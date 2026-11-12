# Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE

## 結果

**RC版のローカル作成・検証：完了。正式公開判定：CONDITIONAL。** 新機能・道具・お宝・エリア・経済の追加変更なし。今回のゲームコード変更はVersion/RC表示のみ。新規不具合は検証範囲で再現なし。単体テストは647件を維持し、件数を増やしていません。

| 受入項目 | 状態 | 根拠 |
|---|---|---|
| 主要ゲーム機能/12エリア/300種/46道具/3設備/6ライン/Lv1–3 | PASS | 647件・7回帰・本番2ブラウザ |
| 保存12状態/旧互換/厳密台帳/JSON移行 | PASS | stability/import/device/saveのRC証跡 |
| 二重取得/材料複製/設備増殖/進行権 | PASS | 既存テスト・CAS・長時間・複数タブ |
| 過去11不具合 | PASS | 下記再監査表 |
| 本番build/DEBUG除外/相対パス/NOTICE | PASS | モジュール・SHA256台帳/本番/preview |
| iPhone Safariユーザー受入 | PASS | ユーザー、0.9.2、OKとの申告。測定/ログ未提供 |
| CodexによるiPhone実機直接操作 | 対象外 | 未実施。ユーザー申告と区別 |
| WebKit自動試験 | 未確認 | webkit-2370実行ファイル未導入 |
| ゲーム固有素材/コード/データの許諾 | 未確認 | 配布内51ファイルの権原/条件が未確定 |
| Vite由来の同梱コードとMIT表記 | PASS | ローカルLICENSE原文照合、他外部実行モジュールなし |
| 任意形式の個人情報と公開範囲の最終レビュー | 未確認 | 検査パターンでは完全判定しない |
| リポジトリ全体の他ゲームFirebase設定の管理状態 | 未確認 | 036のdist外。別ゲームは変更しない |
| commit/push/tag/Pages/その他の配布 | 対象外 | 実行しない |

## 機能別受入

- 砂浜：10層/新しい区画の最大深度600、道具速度/硬さ/持替え、発見と砂処理。旧チュートリアル区画の280深度は互換仕様として維持。
- 川底：磁石/フック、磁性/重量/距離/障害物/引上げ速度、ウインチ。
- 河原：採取/ふるい/皿/スルース/微細粒/残渣再処理。
- 共通：12エリア/300種/46道具/装備4枠/ショップ/洗浄/図鑑/FN/3設備/6ライン/Lv1〜3/配分/停止再開。未実装77道具の手持ち道具購入を拒否、FN不変。設備3種は専用購入を維持。

## 過去11不具合

| ID | 当時重大度 | 問題/原因 | 再現条件 | 維持した修正 | 現在の回帰証跡 |
|---|---|---|---|---|
| S01 | Critical | 競合した保存が端末バックアップを先に上書き | 主保存999、競合123 FN | IDB lease/revision確定後にバックアップ、拒否後は保護 | CASBackupProtected / emergencyRace |
| S02 | High | 必須値欠損を初期値で上書き | FN等を欠損 | validateCore必須検証、旧optional移行を維持 | STABLE必須欠損 / import missing |
| S03 | High | 保存禁止時に例外/復旧導線が使えない | IDB禁止、両データ破損320px | try/catchと復旧UI・入力ガードの限定 | storageBlocked/corrupt recoveryAccessible |
| I01 | Medium | 右クリックでも掘削 | 右ボタン保持 | 左/主Pointerのみ開始 | 掘削回数不変（RC stability） |
| I02 | Medium | 副指で作業開始/他指終了で主作業が止まる | 複数Touchの開始と終了 | primaryとpointerId所有者の照合 | secondaryFingerIgnored / goldSecondaryReleaseIgnored |
| L01 | Medium | LABを閉じてもWorker/タイマーが残る | 比較中にX、120回の開閉 | disposeと遅延mountのガード | LABWorkerAndTimerDisposed / RC performance |
| U01 | Low | 長文保存警告が320pxではみ出す | localStorage容量不足 | 短いフッター＋詳細表示 | 568px維持、saveWarningCompact PASS |
| A01 | High | インポート個体IDからDOM実行 | HTML属性を含むUIDを持つ砂利JSONを受理し、選別台を開くとimg/onerrorが実行。 | clone前の危険キー・識別子・入れ子検証。河原と設備の属性をエスケープ。 | 危険UID拒否/directRenderInert |
| A02 | Medium | 砂在庫の参照矛盾を受理 | 同じ砂バッチID、存在しない個体、二つの袋に同じ個体を設定。 | バッチID/個体の一意性、batch状態、配分量、残渣参照を検証。内容物の再抽選なし。 | 砂参照・重複の拒否/正常round-trip |
| A03 | High | 異常品質の洗浄後に保存不能 | quality/initialQuality=1e308を受理。報酬FNは固定額のままだが、評価と図鑑bestがInfinityとなり、次回migrateは拒否。 | 通常生成とLABの上限を確認して品質0〜2、初期品質0〜2を検証。保管個体も同じ検証。FNは0〜MAX_SAFE_INTEGER。 | qualityOverflow拒否/647単体 |
| A04 | Low | JSONとIDBで設備の停止理由が不一致 | 6ラインをJSON round-tripすると、共有参照のあるIDB snapshotとは設備reasonだけ異なる。 | validateFacilitiesで全設備個体の停止理由を共通正規化。数量・進捗・FNは変更なし。 | 砂利・6ラインJSON/IDB完全一致 |

すべて再発防止テストあり、今回の条件で再発なし。保存/注入/品質/在庫はtests/stability.test.ts、tests/acceptance.test.ts、既存台帳/設備テスト、およびRCブラウザ保存/入力試験で確認。過去の重大度を新規問題件数に加算していません。

## 保存とJSON

12状態：newGame / equipped / rewarded / digging / riverPull / goldPan / 100Unwashed / 6WorkingLines / upgradedLv3 / purchased / areaUnlocked / 300Registered。FN/道具/4枠/mask/河原バッチ/未洗浄品/図鑑/設備ID・Lv/ライン・キュー/支払台帳を保存メタ情報以外で比較。設備は安全な停止状態で復元。閉じていた時間は処理せず、オフライン収益なし。

確認前/キャンセル時は無書込。6ライン・未洗浄20個・300種図鑑のJSONを別contextへ移行し、再読込後の保存が一致。不正JSON 11分類＋HTML UIDを拒否。明示復元中のQuotaExceededErrorでも両保存を保護。複数タブの進行停止/所有権移譲/CAS/新しい緊急保存も成功。通常と開発テストの保存領域は分離。

## iPhoneユーザー受入

- 受入者：ユーザー
- 対象Version：0.9.2
- 結果：OKとの申告
- 詳細な測定値・ログ・機種・iOS：未提供
- Codexによる実機直接確認：未実施
- 根拠：今回の添付仕様 Phase 5。記録日2026-11-13。

ユーザー受入OKは記録済みです。WebKitの未実施をユーザー受入の失敗に置き換えず、逆にユーザー申告からWebKit自動試験が成功したとも記録しません。RCでは機能/UI配置を変更していませんが、RC自体の実機再試験結果は提供されていません。

## 性能・長時間

計測環境：Windows、Node.js v25.9.0、Playwright 1.64.1、headless Chrome。実機測定や人間の操作時間とは区別します。

6ライン24ゲーム時間、1002対象の大量処理で1002回収、連続供給4332回収、queue最大64、最近履歴200。保存177926→183806bytes。非表示時不変・移行反復同一を確認。実計算64.96秒。実時間24時間のブラウザ運転や人間の24時間プレイではありません。

| 状態 | GC後ブラウザJS heap bytes | interval | Worker | DOM |
|---|---:|---:|---:|---:|
| initial | 3846040 | 2 | 0 | 118 |
| after-60-modal-cycles | 6034420 | 2 | 0 | 770 |
| after-120-modal-cycles | 5722280 | 2 | 0 | 770 |
| after-6-lines | 6658660 | 2 | 0 | 770 |

Chrome390pxのrAF 180標本、59.95回/秒、間隔p95 16.90ms。ショップclick→入力表示 10回、範囲69.53〜181.08ms（Playwright待機/通信を含む）。実表示FPSや指から描画までの遅延とは別です。GC/キャッシュ/モジュールロードの影響を含み、単一試験でリーク不存在は断定しません。実機メモリ/熱/電池は測定値未提供。

## 残事項

ゲーム固有素材の権原と配布条件、公開範囲の最終確認。詳細は[素材許諾](ASSET_LICENSE_MANIFEST.md)と[公開判断](RELEASE_DECISION_1.0.0.md)。

[647単体・7回帰の結果](acceptance-summary-v100rc1.json) / [保存](stability-browser-v100rc1.json) / [不正入力](import-acceptance-v100rc1.json) / [複数タブ](save-phase0-v100rc1.json) / [本番](production-results-v100rc1.json) / [24h](advanced-stress-v100rc1.json) / [性能](stability-performance-v100rc1.json)
