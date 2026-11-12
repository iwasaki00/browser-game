# Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE

**判定：CONDITIONAL。RCは作成済み、正式公開は保留。**

| 項目 | 状態 | 根拠 |
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

[正式版への条件](RELEASE_DECISION_1.0.0.md) / [総合受入](FINAL_ACCEPTANCE_1.0.0.md) / [素材許諾](ASSET_LICENSE_MANIFEST.md)
