# 1.2.0-C4 — PROJECTILE COMPLETION FIX

実施日：2026-11-02（JST）。C3のユーザー診断を根拠に、確認できた例外だけを最小修正した。公開・commit・push・デプロイなし。

## 原因とログの意味

添付ログはM04／WING／`saveScope=DEBUG2`／T-16,M-20。実際のとどめは、持ち替え前に発射されたM-20だった。

| 診断イベント | 内容 |
| --- | --- |
| `boss-low-hit` | M-20の35ダメージでHP1→-34 |
| `boss-defeated` / `DEFEAT_CONFIRMED` | ボス撃破確定 |
| `progress-updated` | M04クリア状態・M05解放へ更新 |
| `store-ok` / `save-ok` | DEBUG2専用保存の成功を記録 |
| `frame-error` | `Cannot read properties of undefined (reading 'expanded')` |
| `RESULT_READY` / `result-raf` | 保護処理により結果へ移行しRAFも継続。ただし`frameFault=true`のまま |

`updateExpanded()`は更新前に`const length=g.shots.length`を保存し、その件数で弾を走査していた。途中のM-20爆発がボスを倒すと、`damageEnemy()`の共通撃破処理が`game.shots.length=0`を実行する。次の反復で消えた弾を取得し、`s.expanded`を参照して例外になった。

通常RANGERでも同じ経路を再現でき、WING専用やdebug=2の無敵処理が原因ではなかった。ブラウザ固有APIに依存しない弾配列の寿命の問題。C3ログの保存は成功しており、通常セーブではなく専用セーブへの記録だった。実ユーザーのlocalStorageを直接読んだり変更したりしたわけではない。

## 最小修正

`js/weapons.js`のループ条件を以下へ変更した。

```js
index < length && index < g.shots.length
```

当初件数による上限と、コールバック後の現存件数の両方を確認する。消去後の存在しない弾を参照しない一方、新たに追加された弾を無制限に同フレーム更新しない。不要な配列コピー・ソート・再帰は追加していない。ゲームロジック上の実変更はこの継続条件1か所と説明コメントのみ。

例外の握りつぶし・無条件クリア・次ミッションの強制解放・HP補正は追加していない。既存のRAF保護／B-04崩壊／結果タイマー／入力解除はそのまま使用する。武器の威力・射程・間隔・弾道・子弾数・連鎖回数、兵科性能、ボスHP、難易度、セーブ形式も変更していない。

端末で修正版を識別できるよう、VERSION・タイトルの表示をC4に変更。HTML→game.js→weapons.js／data.jsのクエリを更新し、古いキャッシュと区別した。

## 再現と回帰テスト

実際の`game.js`・武器モジュールを既存Node VM／DOM・Canvasアダプターで実行。保存はテストごとのMapのみで、ユーザーの通常保存領域には接続しない。

| 項目 | 結果 |
| --- | --- |
| 修正前の再現テスト | 1件を選択実行しFAIL。同じ`expanded`例外を検出（期待値は「例外なし」）。C4修正前に実行 |
| 新規回帰 | **12件PASS、FAIL／skip 0** |
| 通常4兵科 | RANGER／SCOUT／GUARDIAN／WING：M-20撃破→例外なし→崩壊進行→結果→司令部→M05出撃・移動・射撃 |
| debug=2の4兵科 | 同じ経路、M05解放・保存・再読込、通常保存バイト不変・全setItemが専用キーのみ |
| 武器持ち替え | M-20実発射後にT-16へ持ち替えて撃破。ダメージ元がM-20として記録される |
| LAB2兵科 | RANGER／WING、ボス直接開始、`game.clear=false`でも弾消去後に例外なし、LAB結果と通常保存不変 |
| 配列縮小 | ダメージコールバックで弾配列を消去しても、未定義参照・追加命中なし |
| 配列追加 | ダメージコールバックで弾を追加しても当初件数の更新上限を維持。新しい弾のageは0 |
| 二重処理 | 崩壊後のスキップ・遅延タイマー・再クリア呼出しで戦績／報酬を重複付与しない |
| リロード | 隔離プロフィールを再読込し、M04クリア・M05解放を維持 |

再現条件は正式出撃後、テスト配置でB-04のPhase3／残HP1／ボス付近から開始する**部分QA**。撃破そのものは`shoot()`からの本物のメテオ弾・爆発・ダメージ処理による。複数の弾が残る条件、HP1→-34を確認し、直接ダメージ・強制クリア・強制結果への遷移は使わない。通常4ケースは無敵補助なし／通常HP、debug=2の4ケースはURL無敵と区別する。人手による全編通常攻略ではない。

LAB用の新規テストは通常の結果診断が作られない既存仕様を考慮し、実際の`frameFault`も確認する。LABの未作成診断をテスト側で参照した2件の初回失敗は、製品の例外とは別に修正して再実行済み。期待する「製品の例外なし」は緩めていない。

## 統合QA

`npm run qa`（既存の`npm run qa:campaign`を実行）：終了コード0。

- 156グループ：140 PASS、0 FAIL、NORMAL_SIM未クリア8、HUMAN未実施8。
- 関連30ファイル：**803テストPASS、FAIL／skip 0**。新規12件を含む。
- M01〜M08連続進行・保存・再出撃・M08エンディング、M03 WING結果回帰、M04解放、20武器、兵科・実績・LAB／debug=2隔離等の既存試験を再実行。
- 既存連続チェーンはASSISTED、通常難易度自動操作8件はNOT_CLEARED、人手はNOT RUN。今回の修正を、通常全編を人手クリアした証明として扱わない。

証拠：[集計](../campaign-integration/README.md)、[JSON](../campaign-integration/results.json)、[803テストの詳細](../campaign-integration/related-tests.txt)。新規ケースは`projectile-completion.test.mjs`。Node構文検査（weapons.js／game.js／新テスト）と`git diff --check -- .`もPASS。

## 変更ファイル

- 実修正：`js/weapons.js`
- 版・キャッシュ：`js/game.js`（import URLのみ）、`js/data.js`（VERSIONのみ）、`index.html`、`package.json`
- 試験：`tests/projectile-completion.test.mjs`（新規）、`tests/campaign-integration.test.mjs`（現行VERSION）、`tools/campaign-integration.mjs`（関連スイート登録）
- 文書：`README.md`、`docs/BOSS_DEFEAT_TRANSITION.md`、本レポート（新規）
- 再生成QA出力：`reports/campaign-integration/README.md`、`results.json`、`related-tests.txt`

通常セーブの削除・初期化・移行・移植は不要。アセット、M01〜M08地形・AI・カメラ・兵科・通常セーブ形式・Arcade031リンクは保護する。対象の改行設定を確認し、変更ソースは従来どおりUTF-8 BOMなし・LFで編集。Sitesスキルはローカルの修正／検証方針のみ使用し、公開・同期は行わない。

## ブラウザ・実機の未確認

今回の環境照会でブラウザ接続ホストとネイティブ接続が利用不可だったため、実ブラウザ操作は**NOT RUN**。iPhone Safari実機、表示・タップ・中断復帰・実FPS、人手攻略も未確認。同じブラウザ接続を繰り返し再試行したり、別経路で迂回操作したりしていない。

添付診断では結果画面のpointerdown/upは届いていたが、`mission-select-click`は記録されていなかった。このログだけでは「次へ戻るボタンがどこで押せなかったか」は確定しない。特定できた更新例外は修正したが、実機の操作症状がすべて解消したとはまだ判断しない。

### iPhoneで再確認する操作

1. 修正版を表示できる環境で、タイトルの版が**1.2.0-C4**であることを確認。今回公開はしていないため、既に公開済みのC3が自動更新されたとは扱わない。
2. 通常保存を消さず、`?debug=2`の専用保存でM04／WING／T-16＋M-20へ出撃する。必要なら既存の試験用解放操作を使う。
3. 必須砲台・左右装置・コアを通常どおり攻撃し、M-20でとどめを刺す。T-16へ持ち替えてメテオが残っている条件も試す。
4. 「描画・更新エラー」が出ず、崩壊→リザルト→ミッション選択→M05出撃となり、その後も移動・射撃できることを確認する。
5. 再読込後の専用M04記録・M05解放と、通常URLへ戻した場合の正式記録不変を確認する。
6. まだ操作不能になる場合は、その画面で既存の遷移診断を再コピーする。次は`frame-error`の有無、`mission-select-click`・`command-active`・出撃受付／拒否・`frame-ready`を切り分ける。

C4は実機確認待ち。今回の自動テストだけで公開READYへ引き上げない。
