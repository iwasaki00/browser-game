# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

**判定：CONDITIONAL**。確認済み未修正のCritical/Highなし。実機と権利等の必須未確認が残るためREADYではありません。

| 項目 | 状態 | 根拠・残作業 |
|---|---|---|
| 既存631＋追加16単体テスト | PASS | 647/647。異常品質/砂参照/危険キーを含む |
| ブラウザ回帰7系統 | PASS | 7/7。再試行履歴はFINAL_AUDIT参照 |
| 12状態保存/旧移行/報酬台帳 | PASS | stability-browser / 既存単体 |
| JSON確認/別context復元/失敗保護 | PASS | device-acceptance / import-acceptance |
| 複数タブ/二重処理抑止 | PASS | save-phase0 / CAS / 24h |
| Chrome/Edgeの本番操作 | PASS | production-results |
| 320/375/390/430px/短画面 | PASS | device-acceptance |
| 主指/副指/中断/復旧UI | PASS | stability-browser |
| 6ライン24ゲーム時間 | PASS | 1002大量・連続4332品、履歴200 |
| 300種/12エリア/46道具/126マスター | PASS | treasure-audit |
| TypeScript/本番build/DEBUG除外 | PASS | 52modules・本番Chrome/Edge |
| パターン検査：036ソース/配布物 | PASS | 確認した形式の機密候補なし。完全保証ではない |
| npm auditと依存宣言 | PASS | 0件、インストール宣言と推移一覧 |
| Vite由来コードのMIT表記同梱 | PASS | THIRD_PARTY_NOTICES.txt |
| WebKit自動試験 | 未確認 | 実行ファイル未導入 |
| iPhone Safari実機/Files/ノッチ/IME | 未確認 | ユーザー受入表 |
| 制作由来/コード・データの全体配布許諾 | 未確認 | 所有者確認/採用LICENSE未決定 |
| 任意形式の個人情報/公開範囲の最終確認 | 未確認 | パターン検査外の人手レビュー |
| 他ゲームFirebase設定の管理状態 | 未確認 | 036のdist外。リポジトリ全体公開時に確認 |
| 人間による長時間の操作感/面白さ | 未確認 | モデル/自動入力で代替しない |
| 完全自動探索/課金/オフライン収益 | 対象外 | 今回追加なし |
| commit/push/公開 | 対象外 | 指示どおり未実施 |

[判断](RELEASE_DECISION_0.9.2.md) / [総合監査](FINAL_AUDIT_0.9.2.md) / [実機表](IPHONE_ACCEPTANCE_CHECKLIST.md)
