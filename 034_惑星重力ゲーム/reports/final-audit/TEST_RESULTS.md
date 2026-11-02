# 自動検証結果

対象2.0.0-rc.4。Node v25.9.0 / Windows / Chrome 156.0.8078.76。

## 全自動テスト

`node tests/qa-all.mjs --final --report=final-audit`

**36ファイル、515 PASS、FAIL 0、SKIP 0、cancelled 0。約40.03秒。** 一時コピーで実行した。詳細：[all-final.json](all-final.json)、[全出力](all-final.txt)。物理の決定性、予測一致、1／10／100倍、各航路、5結末、旧保存、手掛かり・探索、チュートリアル、SCAN、日誌・ヒントを含む。

## 実ブラウザ試験（515件とは別集計）

すべて `node tests/<名称>.mjs --final-audit` で実行。

|名称|最終結果|検証範囲／出力|
|---|---|---|
|qa-browser|PASS|CLASSIC20連続★3、保存・ギャラリー50件、2分再生 / browser-results.json|
|final-voyage-ui|PASS|全5結末の実到達、終了・再閲覧・再生・復元 / ui-results.json|
|beginner-browser|PASS|全6STEPの実タッチと本編非干渉 / beginner-browser.json|
|beginner-lifecycle|PASS|再試行・スキップ・途中復元・キャンセル・旧環境 / beginner-lifecycle.json|
|story-navigation-browser|PASS|日誌、章、3段階ヒント、未発見秘匿、SCAN移動・復帰 / story-ui.json|
|mobile-polish-ui|PASS|4縦サイズ、横画面、模擬安全領域、タッチ競合 / mobile-ui-results.json|
|mobile-polish-navigation|PASS|DEEP実到達、100倍中の目的地変更、保護再生・回転 / navigation-results.json|
|mobile-polish-audio|PASS（PC経路）|AudioContext生成・再開・再生成・ミュート・保存 / audio-results.json|
|orbit-share-ui|PASS（PC／API模擬）|実PNG、Worker・代替、共有キャンセル・未対応 / share/result.json|
|final-audit-operations|PASS|連打・複数モード遷移・実失敗・再発射・不正保存 / operations.json|
|final-audit-pages|PASS|サブパス、相対参照、実PNG Worker、外部要求0 / pages.json|
|final-audit-release|STATIC CHECKS PASS|実行ファイル68件、構文・相対参照・パターン監査 / release-audit.json|
|final-audit-endurance|結果はPERFORMANCE.md参照|同一ページの実時間15分、4条件 / endurance.json|

## 保存・異常系

- 旧HOMEWARD v1・CLASSIC・チュートリアル・CLUE・結末・お気に入り・保護記録の読込と復元を確認。
- 通常20件＋お気に入り30件、自動整理、個別削除、保護記録不変、トランザクション中断を確認。再読込後ギャラリー50件・保護記録2件。
- IndexedDB一時／恒久容量エラーは故障注入。再試行各3回の上限と既存保護記録の維持を確認。実ディスクを満杯にはしていない。
- 不正な旧JSONは元文字列を保持したまま一時プレイ・入力・描画ループが継続。
- 実飛行中の一時停止で状態不変、再開で進行、回転、失敗、入力復元、再発射、RESETを確認。
- スリングショットのPointer Cancel・複数指によるキャンセル、惑星ドラッグとパン／ピンチの競合を確認。
- 描画ループの継続は実Canvas描画を数えて確認。任意の未捕捉例外をエンジン内部へ強制投入した試験ではない。

## テスト基盤の修正履歴（製品不具合とは区別）

1. 既存QAの仮想時計を停止したまま容量エラー試験に進むと、再試行タイマーも停止した。保存試験の前に実時計へ戻して全20ステージを含むQAを再実行し成功。
2. 再試行で結果パネルを閉じた後に、非表示の再発射ボタンを押す手順がタイムアウト。通常LAUNCHを使う正しい手順へ修正し複合操作試験を再実行し成功。
3. Pages試験でギャラリー記録が2件になり曖昧セレクターが失敗。対象名で絞り、再実行し成功。
4. 初回チュートリアルの案内を既存音声・共有試験が考慮していなかったため、任意案内を閉じて本来の操作へ進めるよう修正。
5. 継続試験は、初期の条件別コンテキスト案を中断し、同一ページを保持する4条件へ強化して再実施。`endurance-interim-isolated-phases.json` は参考途中値であり15分完了結果には含めない。
6. 同一ページ試験の初回は未定義の `gate>probe` を参照して停止した。既存定義の `gate>rescue`／`rescue>gate` に変更して15分を最初から再計測。停止結果は `endurance-harness-failed.json` に保存し、完了結果に混ぜない。

失敗したテストの削除・無効化や、到達の強制はしていない。

## 画面確認と未検証

320×568、375×667、390×844、430×932、844×390、PC1366×768。安全領域はCDPでの模擬、アドレスバーは高さを縮めた再現であり実Safariではない。各サイズの画面キャプチャを本フォルダに保存。

iPhone実音、OS共有先、実ノッチ・バー挙動、実タップ感、発熱は **UNVERIFIED**。BGMは現行仕様にないため **NOT APPLICABLE**。保存途中からの飛行完全再開は現行仕様外で、チェックポイント復元と段階記録の保護を検証した。
