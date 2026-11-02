# ORBIT MAKER 最終RC監査

- 対象：**2.0.0-rc.4 — STORY NAVIGATION**。監査日：2026-11-02。
- 判定：**CONDITIONAL**。iPhone Safari最終受入と公開時の権利・配置範囲の確認が残る。
- 正式版への変更、push、公開、デプロイは実施していない。
- 監査開始時のGit状態・本体ハッシュは [initial.json](initial.json)。開始時は変更なし。その後の他プロジェクトの変更は操作していない。
- 実行用68ファイルとpackage.jsonは開始時から変更していない。物理・難易度・ステージ・保存形式の変更なし。

## 実施順と変更範囲

Plan：既存QA・保存・物理・画面・既知課題を確認。Tasks：全件テスト、実ブラウザ進行、異常系、継続測定、公開監査を分離。Build：監査用ハーネスのみ追加・修正。Test：下表を実行。Docs：本フォルダの6資料とJSON・画面キャプチャを保存。

主要変更は `tests/final-audit-{operations,endurance,pages,release}.mjs` の追加、既存 `qa-all`、`qa-browser`、`mobile-polish-*`、`final-voyage-ui`、`beginner-*`、`orbit-share-ui` の出力先・初回案内・仮想時計の調整。ゲーム本体の修正は不要だった。テストの削除・無効化はしていない。

## モード別結果

|対象|PC自動検証結果|証拠|
|---|---|---|
|CLASSIC|全20を順次実航行でCLEAR・★3。解放、失敗・再試行、途中再読込、最終保存復元成功|browser-results.json|
|FREE|7種類・サイズの追加時設定、選択・移動・削除、精密／スリングショット、予測、HUGE、パン・ピンチ、RESET成功|operations.json / mobile-ui-results.json|
|HOMEWARD|旧セクター・探索・分岐・保存の全件テスト成功。5結末を実UIから実航行で取得・保存・再閲覧・再生|all-final.txt / ui-results.json|
|BEGINNER|6STEPの実タッチ操作、途中復元、再試行、スキップ、終了。本編保存への非干渉成功|beginner-browser.json / beginner-lifecycle.json|
|GALLERY|旧記録、保護記録、CINEMATIC、停止・再開・速度・シーク・回転・再読込、PNG成功|navigation-results.json / share/result.json|
|STORY NAVIGATION / SCAN|3段階ヒント、日誌・進行、情報の秘匿、場所を見る／視点復帰、船・調査状態の不変性成功|story-ui.json / navigation-results.json|

「全機能の全組合せを手動で確認した」という意味ではない。PCで実行した範囲と実機の未確認を区別する。

## 結末の実到達

|結末|入力された航路|最終区間の物理時間|結果|
|---|---|---:|---|
|END-01 HOMEWARD|earth|56.475秒|PASS|
|END-02 RESCUE|rescue → earth|45.317秒|PASS|
|END-03 THE TRUTH|network → earth|33.917秒|PASS|
|END-04 THE OTHER SIDE|network → passage|14.142秒|PASS|
|END-05 ENDLESS VOYAGE|observatory|33.850秒|PASS|

各テストは必要な既取得状態を隔離セーブに用意し、発射から到達は本物の物理計算を使用する。全物語を初回起動から5回手動周回したものではない。結末カード終了・スキップ・再閲覧・CINEMATIC・再読込、END-05からの再探索を検証した。

## 総括と参照

自動テスト **515 PASS / 0 FAIL / 0 SKIP**。別途ブラウザ試験を実施し、件数に混算していない。今回検出した製品のCritical／Highは0件。ハーネスの停止・セレクター問題は修正後に対象試験を再実行した。

画面の目視ではHOMEWARD左上のタイトル・補助行に軽微な切れが残る（Low、RC-08）。主要操作は使えるが、画面内すべての文字に見切れがないとは報告しない。

- [全テスト・異常系](TEST_RESULTS.md)
- [性能実測と限界](PERFORMANCE.md)
- [公開判断](RELEASE_READINESS.md)
- [残課題](OPEN_ISSUES.md)
- [iPhone最終受入表](IPHONE_CHECKLIST.md)
- 画面例：[375px通常画面](main-375x667.png)、[日誌](log-375x667.png)、[横画面](main-844x390.png)

既存利用者のlocalStorage・IndexedDBは操作していない。試験は一時コピー／隔離ブラウザコンテキスト・ループバック配信で実施した。
