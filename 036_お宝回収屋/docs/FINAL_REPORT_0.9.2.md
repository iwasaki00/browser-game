# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

1. **Version**：0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

2. **主な変更ファイル**：save.ts / save-validation.ts / gold-ui.ts / lines-ui.ts / facilities.ts / index.html / main.ts / data.ts / package/lock / public/THIRD_PARTY_NOTICES.txt / acceptanceテストと監査資料

3. **v0.9.1再監査**：Critical1/High2/Medium3/Low1の7件を再確認。上記再現条件で再発なし。FINAL_AUDITに原因・修正・試験を記録

4. **新たな不具合**：HTML個体IDから実行、砂参照矛盾、異常品質で洗浄後保存不能、設備停止理由のJSON/IDB差の4件

5. **重大度**：Critical0 / High2 / Medium1 / Low1。全件修正済み

6. **修正**：危険キー/識別子/入れ子検証、DOM属性エスケープ、品質/FN範囲、砂参照整合、停止理由正規化。ブラウザの明示ズーム禁止指定も削除

7. **未解決問題**：確認済み重大問題の未修正0。実機・全体許諾・任意機密情報の最終レビューは未確認

8. **セーブ・復元**：12状態で全内容比較（保存メタ以外）。旧形式/停止状態への復元を維持

9. **JSONバックアップ**：6ライン/荷物/300図鑑を別contextへ確認付き復元、再読込後一致。プレビュー/キャンセルでは無書込

10. **破損データ**：11種類＋HTML UIDを拒否。明示復元の容量不足でも両コピー不変

11. **複数タブ**：既存進行権/lease/revisionを再利用。後続進行停止、所有権移譲、CAS/緊急保存を確認

12. **PC Chrome**：本番3分野・設備・図鑑・保存・バックアップPASS。通常pageerror0

13. **PC Edge**：本番の同じ機能PASS。小画面全4幅もPASS

14. **WebKit**：未実施。既存PlaywrightのWebKit executableが未導入。勝手な大型環境追加なし

15. **iPhone向け画面**：320/375/390/430px、高さ568px、1280px、回転をChrome/Edgeで10構成確認

16. **iPhone Safari実機**：ユーザー受入待ち。Files、ノッチ、アドレスバー/IME、実タップ/長押し/拡大、熱/電池は未確認

17. **操作性**：既存操作を維持し、明示的maximum-scale制約を削除。主指/副指の所有権、モーダル/復旧導線/4枠を確認

18. **6ライン長時間**：24ゲーム時間、1002対象大量処理、連続4332回収、queue上限64、履歴200。実計算149.07秒（人間の24時間ではない）

19. **メモリ・FPS**：GC heapはDEVICE資料参照。rAF 59.95回/秒、p95間隔16.80ms。実表示FPS/実機入力遅延とは区別

20. **300種類監査**：300/300到達・登録、固定報酬一致、二重受取0、SVG代替表示。126マスター/46道具/12エリア維持

21. **機密情報**：管理テキストとdistを検査。036候補なし。他ゲームFirebase4ファイルは値を伏せて記録し、管理状態未確認

22. **外部ライブラリ**：npm audit0件、7主要ツールと推移依存の宣言を記録。互換性未検証の一括更新なし

23. **素材・権利**：外部画像/音源/フォントファイル同梱なし。コード生成SVG/合成音/システムフォント。制作由来と全体許諾は所有者確認待ち。ViteのMIT表記を同梱

24. **DEBUG LAB**：本番Chrome/Edgeで開発API/隠し入口/強制生成/比較Workerなし。ソースのDEVモジュールは保持

25. **自動テスト**：647/647（既存631＋16）、7系統ブラウザ回帰成功。新規入力/端末/別context/容量不足もPASS

26. **本番ビルド**：TypeScript noEmit＋Vite成功、52modules。index/JS/CSS/必要NOTICEのみ。LF統一

27. **公開可否**：CONDITIONAL。自動試験成功だけでREADYにはしない

28. **公開前の必須作業**：実機表を記入、制作由来と全体許諾/表示を確定、機密情報/配布範囲を最終レビュー

29. **Windows起動**：対象フォルダでnpm.cmd run dev -- --host 0.0.0.0 --port 5176 --strictPort。PC http://localhost:5176/、同LAN iPhone http://192.168.3.17:5176/。終了Ctrl+C。依存がなければnpm.cmd ci

30. **1.0.0への引継ぎ**：実機/権利/配布範囲の確認と主観評価。WebKit未導入、固定実秒入力試験の負荷依存を記録。commit/push/公開は未実施

[総合監査](FINAL_AUDIT_0.9.2.md) / [端末](DEVICE_COMPATIBILITY_0.9.2.md) / [保存](SAVE_RECOVERY_AUDIT.md) / [安全性・権利](SECURITY_AND_LICENSE_AUDIT.md) / [公開判断](RELEASE_DECISION_0.9.2.md) / [iPhone実機表](IPHONE_ACCEPTANCE_CHECKLIST.md)
