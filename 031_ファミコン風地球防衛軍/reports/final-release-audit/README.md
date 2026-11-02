# 1.2.0-C5 — FINAL RELEASE AUDIT

実施日：2026-11-02（JST）。基準はC4（参照履歴`679947c`）。公開・commit・push・デプロイのコマンドは実行していない。通常セーブの初期化・削除・移行も実施していない。

## 公開判断：CONDITIONAL

**ローカル公開候補の自動QA・静的監査はPASS。ただしiPhone Safari、無敵なし人手攻略、実FPS、配信構成への候補適用・リモート配信、所有者による最終権利確認が未完了。READYではない。**

元の開発チェックアウトは従来どおりdebug=1／2を使える。既存main/root配信設定をそのまま使用した場合に、今回の公開候補へ自動切替されるわけではない。公開候補を使う配信方法と実機受入は次の承認対象で、今回は公開していない。

機械可読結果：[results.json](results.json)。公開候補の全ファイル・SHA256・除外一覧：[public-manifest.json](public-manifest.json)。実機手順：[FINAL_RELEASE_AUDIT.md](../../docs/FINAL_RELEASE_AUDIT.md)。

## 1. 配列監査で見つかった問題と修正

| ID | 優先度 | C4で再現した問題 | C5の最小対応・結果 |
| --- | --- | --- | --- |
| A-01 | HIGH | M08形態1／2の移行で予約jobsを消去。旧件数で次のjob.weaponを参照し例外 | 当初件数に加えて現存件数と同一jobs参照を確認。通常／debug2ともPASS |
| A-02 | HIGH | タレット→マイン設置後、マインでボス撃破。新arsenalまたは空のinstallationsへ古い保持件数を書戻し、空要素のx参照で描画例外 | 元arsenal／listを保持し、消去・置換後は書戻さず終了。M04クリア・M08形態移行・非致死保持ともPASS |
| C4既知 | HIGH・修正済み維持 | 複数メテオ弾の更新中にボス撃破でshotsが0になりexpanded参照例外 | C4の現存長チェックを維持。通常／debug2×4兵科、300発残留・空配列を追加検証 |

新規配列テストは修正前7 FAIL／1 PASSを実際に確認し、修正後8 PASS。例外を握りつぶしたり、強制クリア・HP補正で回避したりしていない。ゲームの実修正は`js/weapons.js`の予約攻撃／マインの寿命管理に限定。武器・兵科・敵・ボスの能力値、M01〜M08の地形、難易度、カメラ、保存形式、アートは変更なし。

### その他の監査範囲

敵弾・敵一覧・ボス部位・ホーミング・爆発候補・破片・FX／プール・攻撃判定・通知キュー・タイマー・遅延処理・非同期アート読込を読取確認。deathフラグと後段詰め直し、専用候補バッファ、世代／処理上限、current mission同一性、timer破棄、アートtoken等を追跡した。対応表は[監査仕様](../../docs/FINAL_RELEASE_AUDIT.md#配列安全性監査と修正)。同種の追加BLOCKER/HIGHは確認しなかったが、未到達の全実行順序を完全保証する監査ではない。

## 2. 回帰・全8作戦の出撃遷移

`npm run qa`（内部で既存qa:campaign）：**終了コード0**。

| 区分 | 結果 |
| --- | --- |
| 統合QA | 156グループ：140 PASS、0 FAIL、NORMAL_SIM 8 NOT_CLEARED、HUMAN 8 NOT RUN |
| 関連Node | **33ファイル・846件PASS、失敗／skip 0** |
| C5追加 | 配列8、公開候補10、遷移25＝43件 |
| C4回帰 | 従来12件を維持。追加で通常／debug2×4兵科の300発残留8件・空配列1件 |
| 静的監査 | PASS：実行時255ファイル、参照335、秘密候補0、実行時外部参照／問題0、Arcade031 PASS |
| ローカルHTTP | PASS：255実行時ファイル＋404の256チェック、バイト／hash／MIME、日本語サブディレクトリ・版クエリ |
| 構文／改行差分 | Node構文検査・git diff --checkを実行。既存UTF-8 BOMなし・LFを維持 |

証拠：[統合集計](../campaign-integration/README.md)、[統合JSON](../campaign-integration/results.json)、[846件の詳細](../campaign-integration/related-tests.txt)、[静的監査](../final-acceptance/release-audit.json)、[HTTP結果](../final-acceptance/local-http.json)。

### 撃破→演出更新→結果→司令部→次出撃→RAF移動／射撃

| 撃破作戦 | 通常画面ASSISTED | debug=2 | 公開候補ASSISTED | 次に動作した作戦 |
| --- | --- | --- | --- | --- |
| M01 | PASS | PASS | PASS | M02 |
| M02 | PASS | PASS | PASS | M03 |
| M03 | PASS | PASS | PASS | M04 |
| M04 | PASS | PASS | PASS | M05 |
| M05 | PASS | PASS | PASS | M06 |
| M06 | PASS | PASS | PASS | M07 |
| M07 | PASS | PASS | PASS | M08 |
| M08 | PASS・エンディング | PASS・エンディング | PASS・エンディング | M01再出撃 |

RANGER／A-01,S-02／STANDARD。各作戦は正式出撃X64から既存入力専用controllerの移動・実射撃・部位破壊で撃破する。開始後ワープ・ターゲットHP編集・直接クリアなし。通常と公開候補はinvuln補助付きASSISTED、debug2はURL無敵。撃破後60フレームの実エンジン更新→既に予約された結果タイマー実行→通常UIで次出撃→RAF約1秒、X64→159・発射を検証した。M08のみ既存のエンディングスキップ操作を経由する。

これはNode VMのDOM／Canvasアダプターでの実行であり、実ブラウザ描画・人手通常難易度クリアとは違う。追加のWING／T-16＋M-20／4兵科・大量残弾はPhase3残HP1の**部分QA**で、ボス全Phaseや全編人手攻略の代替ではない。既存の32到達／64初期武器ボス攻撃／20武器／全8作戦チェーンは別に維持している。

## 3. 通常・LAB・debug=2・QA保存

- 通常キーは従来どおり。旧v1／現行v2、クリア・報酬・武器解放・最高点／時間・兵科／武器統計・実績30件／称号・エンディング完結・再視聴・再出撃を既存試験で確認。
- debug2は専用キーのみ。HP減少なし／被弾反応あり、AI・敵への攻撃・保存・再読込・通常URLへの復帰、不正値で無敵にならないことをC3関連31件で回帰。新規M08形態移行・マイン／残弾・全8次出撃も同じ隔離で確認。
- LABはメモリ内のみ。既存debug1・5タブ・200体・640描画・武器20・演出3段階・通常保存隔離を維持。新規試験も本物のLABからボス撃破まで確認。
- Node QAはテストごとのMapであり、実ユーザーのSafari保存領域は参照・書込していない。保存失敗・二重報酬防止は既存の回帰を実行。新たな保存移行はなし。

## 4. 公開用ファイル・デバッグ分離

生成したローカル候補：

[public-candidate-9LGaL8/031_ファミコン風地球防衛軍](public-candidate-9LGaL8/031_ファミコン風地球防衛軍/index.html)

**255ファイル／1,597,418 bytes**。ルートは`index.html`・`styles.css`・`js/`・`assets/`だけ。docs・reports・tests・tools・QA JSON・内部レポート等、生成時点の620非実行時ファイルを候補から除外。コピーした全ファイルのバイト数／SHA256、候補内の静的相対参照120件を検査した。動的画像は既存ローダー登録簿から収集した335参照の監査に基づく。通常320×180・UNIFIED 01、画像寸法と元のバイトを維持。

公開候補はURLのdebug判定を**生成時の固定値null**へ置換する。起動ボタンも除去するが、それだけに依存せず、debug=1／2・不正値で起動できず通常HPが減ることをテストした。元コードの既知アンカーが変われば生成を拒否する。非表示LAB DOM・実装の一部は残るが、起動は無効で、QA用の`__PDF_GAME__`も露出しない。実際に生成したgame.jsで7起動条件と全8作戦遷移も再実行してPASS。テストスイート側はdebug=0を含む8 URLを検証している。

これは認証・秘匿・改変防止ではない。開発版が配信されれば第三者もURLからdebugを使える。公開候補へ置換しても、利用者自身が保存済みクライアントを改変することは防げない。通常診断の読取り・コピーは残すが、診断ボタンは通常報酬／セーブを変更しない。

### 配信構成に関する注意

- 親READMEはmain/rootのGitHub Pages手順を説明する。親`.nojekyll`あり、`.github/workflows`はローカルになし。
- 親Sites設定はdistを指すが、今回のローカルにその出力はない。リモート実設定・どちらの方式が採用されているかはNOT RUN。
- 既存の公開設定・Arcade031リンク・親ファイルは変更していない。現行root配信がこの候補に置換済みとは扱わない。
- HTTPスモークは**元ソースの実行時グラフ**をローカルで配信した試験。候補のhash／参照／起動／全作戦は別にNodeで検査した。どちらも実Pages／ブラウザ／CDN・キャッシュの検証ではない。

## 5. セキュリティ・素材／ライセンス

実行時グラフと公開候補の秘密候補・ローカル絶対パス検出は0。実行時外部ライブラリ・外部通信先の検出も0。npmのruntime／dev依存宣言はいずれも空。不要なソースマップ・テストデータはallowlist候補に含めていない。

元ソースの絶対パス候補は3件：`docs/MOBILE_ACCEPTANCE.md`の25／72行（ローカル起動例）、`tests/final-acceptance.test.mjs`の17行（検出器のテスト）。秘密値ではないが、元root配信では文書・テストへアクセスできる可能性がある。候補には含めていない。秘密情報の実値は報告へ転記していない。

PNGは固定シードのPython/Pillow生成器・マニフェストと対応。生成器に外部画像取得コードは見つからない。効果音はWeb Audioのローカル合成、CSSフォントは端末システム指定。音声・フォントの配布バイナリや実行時外部パッケージはなし。開発用Pillowはブラウザへ配布しない。

所有者の最終的な権利確認・公開ライセンス選択はNOT RUN。ローカルの由来確認は法的な完全保証ではなく、勝手なライセンス付与はしていない。静的秘密検査も全履歴・バイナリ・未知形式を網羅する完全保証ではない。

## 6. 残存事項

| ID | 状態／重要度 | 必要な対応 |
| --- | --- | --- |
| U-01 | NOT RUN・受入必須 | C5のiPhone Safari IP-01〜IP-10、特にWING M04→M05・複数指・中断復帰 |
| U-02 | NOT RUN・受入必須 | 無敵なし人手の通常攻略。NORMAL_SIM 8件未クリアを攻略不能の証明／PASSにしない |
| U-03 | NOT RUN | 正常な前景FPS・操作感。今回有効サンプル0、測定不能。Node CPUをFPS扱いしない |
| U-04 | NOT RUN・公開条件 | 公開候補を使う配信構成・実Pages相対パス・キャッシュ更新の確認。元root配信との差を解消する |
| U-05 | NOT RUN・公開条件 | 所有者による素材・コードの権利／ライセンス条件確認 |
| L-01 | LOW・記録のみ | Arcade031紹介文に旧「8種類の武器」表記あり。リンク自体は正しく変更禁止範囲のため未変更 |

現在の自動検証で未解決BLOCKER/HIGHはなし。ただし実機の操作・描画を未確認のため、実機症状の完全解消を保証しない。今回のブラウザ環境照会は`browser access host is unavailable`、ネイティブ接続も利用不可だった。同じ接続の再試行は繰り返していない。

## 7. iPhone受入準備

IP-01 通常起動／IP-02 4兵科／IP-03 M04 WING撃破／IP-04 結果→M05出撃／IP-05 M05移動・射撃／IP-06 M08＋エンディング／IP-07 隔離／IP-08 50〜100体／IP-09 再読込／IP-10 PAUSE・複数指。**C5実機はすべてNOT RUN**。過去のA1・B1実機OKは今回のPASSに読み替えない。短時間の操作・合格条件・結果テンプレートは[手順表](../../docs/FINAL_RELEASE_AUDIT.md#iphone-safari最終受入c5は全項目not-run)。

## 8. 作成・変更ファイルと再実行

- 最小修正：`js/weapons.js`
- 版／キャッシュ：`js/data.js`（VERSIONのみ）、`js/game.js`（import URLのみ）、`index.html`、`package.json`
- 回帰：`tests/array-safety.test.mjs`、`tests/public-candidate.test.mjs`、`tests/release-transitions.test.mjs`、`tests/helpers/release-transitions.mjs`（新規）、`tests/campaign-integration.test.mjs`（版）、`tools/campaign-integration.mjs`（スイート登録）
- ローカル生成／集計：`tools/public-candidate.mjs`、`tools/final-release-audit.mjs`（新規）
- 文書：`README.md`、`docs/FINAL_RELEASE_AUDIT.md`、本レポート（新規）
- 証拠出力：`reports/campaign-integration/{README.md,results.json,related-tests.txt}`、`reports/final-acceptance/{release-audit.json,local-http.json}`、本フォルダの`results.json`・`public-manifest.json`・公開候補255ファイル

再実行：`npm run qa` → `npm run audit:release` → `node tools/acceptance-http-smoke.mjs` → `node tools/final-release-audit.mjs`。最後のコマンドは独立した候補フォルダを新規生成する。前の候補・通常データを削除しない。

Sitesスキルは既存チェックアウトのローカル修正・検証・成果物分離方針として使用。登録・同期・公開はしない。ソースは従来のUTF-8 BOMなし・LFを維持し、全行改行変換は行っていない。
