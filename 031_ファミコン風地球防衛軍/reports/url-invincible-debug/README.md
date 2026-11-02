# 1.2.0-C3 — URL INVINCIBLE DEBUG MODE

実施日：2026-11-02（JST）。ローカル作業のみ。公開・commit・push・デプロイなし。

## 結果

`?debug=2`だけで通常キャンペーン画面の無敵試験を有効化。通常HPを毎フレーム補充せず、共通被弾処理のHP減算だけを抑える。被弾ポーズ・音・揺れ・ノックバック・通常の被弾無敵時間・弾命中と消去を維持。敵AI、兵科性能、武器・ボス・通常解放条件は変更していない。

初回は独立したM01セーブ。タイトルの明示ボタンで、専用セーブだけにM01〜M08の解放状態を準備できる（クリア・武器・報酬の付与なし）。通常の司令部・装備・結果・次出撃・エンディングを使う。従来のdebug=1、通常320×180、LAB限定640、5／4タブは維持する。

## 保存と診断

| 用途 | 保存領域 |
| --- | --- |
| 通常キャンペーン | 従来の`pixel-defense-front-save-v1` |
| debug=2キャンペーン・設定・兵科・装備・報酬・全記録 | `pixel-defense-front-save-v1-debug2` |
| debug=2遷移診断 | `sessionStorage`の`pdf-result-transition-debug2-v1` |
| 通常遷移診断 | 従来の`pdf-result-transition-v1` |

初回読込／正常化保存より前にキーを選び、既存の保存処理・サニタイズ・保存失敗表示を再利用する。通常セーブを読み出し元にしたり、削除・移行・マージしたりしない。専用保存失敗時も通常キーへの代替保存はしない。試験Map中の通常キーをバイト比較し、debug=2中の全setItemが専用キーのみであることを確認。通常URLへ戻した場合と専用データ再読込も試験した。実ユーザーのSafari保存データは参照していない。

## 関連検証

| 検証 | 結果・範囲 |
| --- | --- |
| C3新規テスト | PASS：31件、失敗／skip 0（統合実行に含む） |
| URL厳密判定 | PASS：通常・0・1・20・02・true・2abc・空・別名・空白・重複等。URLSearchParamsの先頭デコード値を比較 |
| 4兵科 | PASS：致死量でもHP不変、被弾反応、通常の敵ダメージ・AI更新、ポーズ／再開／再挑戦 |
| 敵弾衝突 | PASS：命中後の弾除去と被弾反応、HP不変 |
| 落下 | PASS：M03〜M08の実復帰関数、HP維持・復帰・未クリア維持。M01/M02は地形下限処理をソース確認 |
| M04全4兵科 | PASS：正式出撃後のボス地点QA、A-01実射撃で砲台・左右装置・コアを破壊、結果→司令部→M05出撃→RAF上の移動・射撃。HP／ボス／クリアの直接編集なし。ただしボス地点へのテスト配置あり |
| M04 WING全編 | PASS：別ケースで開始X64からワープなし、5エリア・全必須部位・崩壊・結果・M05出撃・移動射撃、残HP65。無敵はURLモードのみ |
| WING保持入力 | PASS：残HP4のPhase3テスト配置から実射撃。FLY/HOLD/FIRE保持→撃破→結果でポインター解除。通常診断アーカイブ不変 |
| M01〜M08のURL無敵連続進行 | PASS：新規専用セーブ／RANGER／A-01,S-02／STANDARD。入力専用の既存controllerで開始地点から5エリア・実射撃・保存・各回再読込・次解放・M08完結。無敵タイマー代入や開始後ワープ・直接クリアなし |
| debug=1 | PASS：LAB表示、既存無敵ON/OFF、LAB中の通常保存呼出数・内容不変 |
| 保存失敗 | PASS：「未保存」表示、通常キーへ書込なし。タブ内解放と永続保存の成否を区別 |
| 構文・差分 | PASS：`node --check`（game.js／新テスト）、`git diff --check -- .` |

C3追加ケースは**URL無敵QA**であり、無敵なしの人手攻略ではない。ボス地点配置・HP4配置の部分試験と、ワープなし全編試験を区別する。ゲーム内経過秒は実機FPSではない。

### ワープなし連続進行の参考値

| ミッション | ゲーム内経過秒 | 残HP / 最大HP |
| --- | ---: | ---: |
| M01 | 80.82 | 100 / 100 |
| M02 | 81.22 | 100 / 100 |
| M03 | 98.42 | 100 / 100 |
| M04 | 155.95 | 100 / 100 |
| M05 | 277.92 | 100 / 100 |
| M06 | 168.82 | 100 / 100 |
| M07 | 177.93 | 100 / 100 |
| M08 | 297.02 | 100 / 100 |

別ケースのM04 WINGは143.55ゲーム内秒、65/65。これは既存controllerによる固定条件の無敵試験値で、人手クリア時間・バランス評価・実機処理時間ではない。

## 統合QA

`npm run qa:campaign`：終了コード0。156グループ中140 PASS、0 FAIL、NORMAL_SIM 8件NOT_CLEARED、HUMAN 8件NOT RUN。関連29ファイルは**791テスト全PASS**（今回の31件を含む）、失敗／skip 0。

全8ミッション順次解放・正式出撃・ボス撃破・結果・保存再読込・エンディング・再出撃・重複報酬防止、32到達／64初期武器攻撃、20武器、旧保存・LAB隔離・実績等を既存ランナーで再確認。通常難易度の自動操作8件は未クリアであり、難易度を変更して成功扱いにはしていない。既存の全編チェーンはASSISTED（invuln補助）、C3専用チェーンはURL無敵として区別する。

証拠：[集計・QA区分](../campaign-integration/README.md)、[JSON](../campaign-integration/results.json)、[791件の詳細ログ・C3の各試験と診断値](../campaign-integration/related-tests.txt)。M03停止／M04解放／C2遷移保護の既存回帰も含む。公開監査の関連テストでArcade031参照を確認し、リンク変更なし。過去のbrowser-check.mdは過去版の証拠で、C3のブラウザ確認ではない。

## 変更ファイル

- 実装・版・表示：`js/game.js`、`js/data.js`（VERSIONのみ）、`index.html`、`styles.css`、`package.json`
- 試験：`tests/url-invincible-debug.test.mjs`（新規）、`tests/helpers/runtime.mjs`（クエリ・専用保存の投入対応）、`tests/campaign-integration.test.mjs`（現行版チェック）、`tools/campaign-integration.mjs`（関連スイート登録）
- 文書：`README.md`、`docs/GAME_SPEC.md`、`docs/URL_INVINCIBLE_DEBUG.md`（新規）、本レポート（新規）
- 再生成QA出力：`reports/campaign-integration/README.md`、`results.json`、`related-tests.txt`

既存のPNG、player／camera／readability／weapons／mission02〜08モジュール、Arcadeのindex／menuへの差分なし。変更ソースはUTF-8 BOMなし・LFを維持し、不要な全行変換は行っていない。Sitesスキルは既存チェックアウトのローカル検証方針として使用し、登録・同期・公開は行っていない。

## 実ブラウザ・未確認

- **NOT RUN**：Computer Useの一度の環境照会で`browser access host is unavailable`、ネイティブ接続も利用不可。実ブラウザの表示・タップ・リロード・画面サイズ比較は実施していない。迂回するブラウザ制御や同じ再試行は行っていない。
- **NOT RUN**：iPhone Safari実機、実FPS、人手による無敵なし攻略。Node VMと仮想RAFはこれらの代替証明ではない。
- **未確定**：C1/C2で報告されたSafari固有の停止原因と実機解消。C3はこれを再確認しやすくする試験手段で、強制クリアや無条件の通常解放による隠蔽ではない。既存の公開判断NOT READYを、この無敵QAだけで引き上げない。
- 実機で行うこと：[手順](../../docs/URL_INVINCIBLE_DEBUG.md#iphone-safariでの確認手順実機未実施)。通常記録を控え、debug=2でWING M04撃破→崩壊→結果→M05出撃・複数指操作・中断復帰→再読込→通常URLへ戻して記録不変を確認。不具合時は専用の遷移診断をコピーする。
