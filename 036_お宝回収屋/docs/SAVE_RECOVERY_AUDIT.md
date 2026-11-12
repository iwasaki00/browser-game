# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

## 保存方式と互換

saveVersion=2と既存キーを維持。公開finders-v1、開発finders-dev-v1、LAB finders-debug-v1。IndexedDB saves/currentが主保存、localStorageが端末バックアップ。原子的なIDBトランザクションでrevisionと有効な進行権を検証してから確定し、その後にバックアップ。CAS拒否時は両方保護。

旧optionalデータは従来通り移行。新しいキー拒否/品質範囲/砂参照検証は正常な過去セーブを保ったまま危険な入力を拒否。JSONとIDBの共有参照差による停止理由も統一。移行反復の同一性を検証。

## 保存状態

- PASS：newGame
- PASS：equipped
- PASS：rewarded
- PASS：digging
- PASS：riverPull
- PASS：goldPan
- PASS：100Unwashed
- PASS：6WorkingLines
- PASS：upgradedLv3
- PASS：purchased
- PASS：areaUnlocked
- PASS：300Registered

上記12状態で保存メタ情報以外を全状態比較。FN・所持道具・装備・正規化深度mask・砂/砂利・個体UID・未洗浄品・図鑑・設備instanceId/Lv・キュー・報酬台帳・発見履歴を含みます。設備/ラインは復元時に安全な停止へ正規化し、未知の経過時間を加算しません。

## JSONの操作試験

設定からJSONエクスポート→新規contextでファイル選択→プレビュー→確認→確定→再読込→再開前の保存全体が一致。6ライン・荷物20個・300種図鑑を含む。確認前/キャンセル時は無書込。本番Chrome/Edgeの同じUIもPASS。

拒否確認：empty / syntax / missing / future / range / qualityOverflow / duplicate / unsafeKey / sandConflict / queueConflict / oversize。HTML UIDも拒否。すべて既存主保存とバックアップが不変。20MB制限は読込み前のFile.sizeとparseBackupのUTF-8サイズで検査。危険キーをclone/移行前に拒否、深さ100を超える入れ子を中断。

明示restore中にIDB putのQuotaExceededErrorを注入し、両保存が不変。主保存の正常commit後にLSのみ容量不足の場合は、主保存成功とバックアップ注意を区別して通知。復元不可なら元データの調査用退避を利用可能。調査用アーカイブは通常セーブJSONのインポート形式ではありません。

## 複数タブと中断

既存GameSessionの進行権と保存トランザクションのlease/revisionを再利用。後発タブの進行・保存を止め、権限移譲/再読込でも同じ素材・個体・設備・FNを二重処理しません。pagehide/非表示で作業停止。期限切れや閉鎖後は新所有者が読込から再開。別context/別originの保存は別領域であり、タブロックはそれらを同期するクラウド機能ではありません。

全ストレージがブラウザ設定で禁止された場合は進行を再開できません。タイトルから原本退避・検証へ進み、設定を解除してから復元。端末やOSによる全保存削除/故障を、同一端末内の二重保存だけで防ぐことはできません。JSONを端末外にも保管してください。

履歴試験：849576→30097bytes、詳細200件、累計10000件。24ゲーム時間 177926→183806bytes、未受取品・処理中個体・厳密な支払状態を保持。

[保存12状態](stability-browser-v092.json) / [不正入力・容量不足](import-acceptance-v092.json) / [複数タブ](save-phase0-v092.json) / [長時間](advanced-stress-v092.json)
