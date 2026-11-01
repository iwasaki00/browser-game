# 1.2.0-C — FINAL ACCEPTANCE

最終判定：**CONDITIONAL**。必須の統合QA・関連700件・ローカル静的監査は合格。通常難易度の人手全編攻略、iPhoneの残りの受入項目、前景FPS、実際の公開方式・配信先は未確認。READYではない。公開・commit・push・デプロイは、こちらから実施していない。

実施日：2026-11-01。各自動試験のUTC実行時刻・対象版はJSONを参照。[結果集計](results.json)／[公開前監査](release-audit.json)／[性能の未計測表](performance.json)／[手順](../../docs/FINAL_ACCEPTANCE.md)。

## 1. Version・証拠区分

1.2.0-C — FINAL ACCEPTANCE。PASS＝実際に指定範囲を確認、FAIL＝問題発生、NOT RUN＝未実施、BLOCKED＝環境等の問題で実行不能。Node VM・静的読取・ユーザー実機申告を区別する。

| 確認済み実機項目 | 状態 | 証拠 |
| --- | --- | --- |
| B1 移動速度の体感復旧 | PASS | USER_REPORTED：今回の依頼でiPhone実機OKの申告 |
| B1 コ字形マーカー消失 | PASS | USER_REPORTED：同上 |
| A1 M03 WINGリザルトの正常動作 | PASS | USER_REPORTED：今回の依頼で実機確認済みの申告 |

Codexが端末を操作した／Safari保存を参照したという意味ではない。OS版・端末型番・全入力パターン・FPSは未提供。過去の報告書は作成時点の履歴として保存し、この3項目は再確認待ちから確認済みへ更新する。

## 2. 変更ファイル

| 分類 | ファイル |
| --- | --- |
| 既存本体 | `js/game.js`（旧QA APIのDEBUG制限、dataキャッシュ版）, `js/data.js`（VERSIONのみ）, `index.html`（表示版・mainキャッシュ） |
| コマンド | `package.json`（版・audit:release）, `tools/campaign-integration.mjs`（既存関連スイートへ最終受入試験追加） |
| 新規試験・監査 | `tests/final-acceptance.test.mjs`, `tools/release-audit.mjs`, `tools/final-acceptance-report.mjs` |
| 既存試験 | `tests/campaign-integration.test.mjs`（版の整合のみ） |
| 文書 | `README.md`, `docs/MOBILE_ACCEPTANCE.md`, `docs/FINAL_ACCEPTANCE.md`, 本README |
| 実行記録・テンプレート | 本フォルダの`results.json`, `release-audit.json`, `performance.json`, `manual-playthrough.csv`、`reports/campaign-integration/`のREADME・results.json・related-tests.txt |

適用範囲の.gitattributes/.editorconfigなし。既存UTF-8/BOMなし・LFを維持。core.autocrlf=trueの警告を消す目的でGit設定や他ファイルを一括変更していない。作業中に外部のコミットが取り込まれたが、こちらからcommit／巻戻しはせず、他プロジェクトの変更は触っていない。

## 3. 統合QA

`npm run qa`（既存qa:campaignの別名）を実行、終了0。

| 区分 | 結果 |
| --- | --- |
| 集計156ケース | 140 PASS／0 FAIL／8 NORMAL_SIM NOT_CLEARED／8 HUMAN NOT_RUN |
| 関連26スイート | 700 PASS／0 FAIL／skip 0 |
| M01〜M08連続 | 全8 PASS、ASSISTED：新規相当→正式出撃→必須ギミック→実射撃→ボス→リザルト→報酬→保存→再読込 |
| M08完結・再視聴 | PASS：最終撃破時の保存、6シーン、8/8、再視聴による報酬非加算 |
| 完結後の再出撃 | 全8作戦の通常UIで再出撃・初期状態・射撃・中止を新規試験。M01/M08の再クリアと初回報酬非再付与は既存連続QA |

通し戦闘の補助は無敵時間。ASSISTED／STRUCTURALを通常の人手攻略成功とは扱わない。[統合詳細](../campaign-integration/README.md)／[生データ](../campaign-integration/results.json)／[700件ログ](../campaign-integration/related-tests.txt)。

## 4. 兵科・武器・ボス

4兵科×8ミッションの32到達、4兵科×8ボス×初期2武器の64攻撃は全PASS。前者はAREA01から実移動・地形確認（攻撃除外）、後者はボス途中開始・無敵LABで実射撃。条件を合わせた通常全編攻略ではない。

全20武器の正式装備→攻撃生成→実ダメージ→命中統計→弾・jobs・設置物の再出撃清掃はPASS。専用射撃標的のHPを高くしたSTRUCTURAL試験であり、通常敵HPや武器性能を変更してはいない。使用1回・ヒットイベント数・保存統計を検証。

| ボス | 自動確認の範囲 |
| --- | --- |
| B-01 | 実出現・撃破・結果・再クリア。800/400HP閾値の実charge発動・速度を追加試験。独立した盾／必須部位は元からなし |
| B-02 | 地下ネスト・障壁・弱点開閉・実ダメージ・撃破・再開始 |
| B-03 | 3Phase初期化・HP／弱点・予兆矩形・攻撃・撃破・結果 |
| B-04 | 砲台→左右装置→コア、盾／部位、Phase再開・初期武器 |
| B-05 | 左右装置の任意順・盾・炉心・Phase・再初期化 |
| B-06 | 左右ノード停止・盾周期とHP段階の独立・露出・撃破 |
| B-07 | 防衛3系統任意順・中枢・HP段階・不安定化・撃破 |
| B-08 | 3系統・3形態・盾・HP・余剰ダメージ非持越し・古い判定清掃・最終崩壊・一度だけのクリア／結末・再初期化 |

B-02〜08は既存のmission02／boss-polish／fortress-balance／mobile-fortress／living-colossus／mothership／final-defense等を再利用。全ボスの実機視認性と通常人手回避は未認定。

## 5. 通常難易度

NORMAL_SIMは代表8件とも実行済み未クリア（FAILと混同しない）。通常HP・被ダメージ・STANDARD・A-01/S-02で、ミッション／兵科／エリア／被害／残HP／最後の被弾位置等を記録している。自動controllerの回避判断が限定されるため、通常攻略不能の証明ではない。高度な自動プレイヤーや難易度変更は追加していない。

人手8件はNOT RUN。[CSVテンプレート](manual-playthrough.csv)を複製し、武器・密度・結果・到達エリア・被害・死亡原因・ボス問題・操作問題・難易度評価を記録する。確認できない数値を0にしない。既存LABのB_NORMAL自己申告欄／メモも使えるが、LAB成功を人手の正式クリアへ変換しない。

## 6. M03リザルト

既存result-freeze17件PASS。WINGのFLY/HOLD/FIRE保持・全解放、cancel・連打、明示キャプチャ解放、司令部復帰、M04解放／再読込、保存例外表示・再試行、報酬／戦績／実績の二重付与防止、他3兵科・代表ミッション・M08を再確認。

ユーザーの実機OK申告も別証拠としてPASS。Cで入力／保存／報酬処理は変更していない。

## 7. カメラ・マーカー

B1の意図した反転即時追従、速度ノイズ抑制、0.35〜0.85、旧版と同じ移動距離、コ字マーカーなし、描画元・銃口・接地・透明PNGの不変を関連回帰で確認。Cでカメラ・readability・player・PNGは変更していない。実機OK申告の範囲は前記3項目だけ。

## 8. 保存・旧セーブ

S01〜07は連続正式クリアの実保存、S08は既存v1形式、S09欠損、S10不正値で全PASS。ミッション解放・武器解放・初回報酬・兵科戦績・武器統計・完結／結末フラグを保持。保存キー・schemaを変更していない。

M08撃破直後の再読込・崩壊前の画面離脱、リザルト・再視聴を検証。OS強制終了／ブラウザストレージ追放の実機試験はNOT RUN。未保存の状態でページを閉じても記録が残ることは保証しない。保存失敗は既存の未保存表示と再試行で扱い、成功と誤表示しない。Safari実保存は参照・初期化・上書きしていない。

## 9. TEST LAB隔離

隔離Mapの保存バイトだけでなくsetItem呼出数が増えないことを確認。200体生成／消去・武器変更・ボス撃破・仮想完結・終了・通常攻略QAを含む。通常の解放・報酬・装備・戦績へ混入なし。司令部4タブ・LAB5タブ・通常320／LAB640は維持。

debug=1は公開しても誰でも入れるローカルLABで、認証ではない。旧window.__PDF_GAME__だけが通常URLへ露出していたためDEBUG条件へ制限した。正常なLAB使用は維持。

## 10. 実績30件

マスタ30件、条件判定、累積値、旧記録の不明／0の区別、称号、保存・二重通知防止・LAB非加算を既存challenges／campaign試験で確認。人手で全30件を取得したとの認定ではない。ユーザーの未観測達成状況を推測して補完していない。

## 11. 性能

30／50／100／LAB200体、連続爆発、貫通・多段、B-08第3形態はすべて**BLOCKED／有効サンプル0**。ブラウザ操作スキルの参照ファイルが実環境に存在せず、前景／実機試験を実行できなかった。FPS／フレーム時間／実描画CPUはnull（未取得）、0FPSではない。除外数0も処理未実行であり「中断なしの正常測定」とは扱わない。

既存AcceptanceMeter／30秒計測／BENCHを維持。[未計測表](performance.json)／[実測手順](../../docs/FINAL_ACCEPTANCE.md#性能試験)。Node VM高速処理時間や異常なrAFからiPhone性能を評価しない。実測不足のため性能最適化・敵数削減・演出変更はしていない。

## 12. 公開前監査

`npm run audit:release`：**ローカル静的範囲PASS**。[監査JSON](release-audit.json)。監査コマンドを実際に実行した結果であり、遠隔サイトへの監査・公開成功の意味ではない。

| 項目 | 結果・範囲 |
| --- | --- |
| 実行用参照 | 254ファイル／334参照。HTML/CSS・36 JS・215 PNG・SVG1。存在・大小文字・相対パス・PNG署名／規定寸法が適合 |
| 秘密候補 | 実行用／開発用テキストの定義済みパターンで0件。秘密の不存在や全Git履歴の保証ではない。値を転載しない設計 |
| 通信・依存 | 実行時外部URL・通信API・npm外部依存を検出せず。DOM/Canvas/Web Audio・ローカル画像。OSフォント使用、同梱音声／フォントファイルなし |
| アート出所 | 固定シードPython/Pillow生成コードとマニフェストを確認。既存素材を再生成せず、外部画像の調達コードを検出せず。法的権利・オリジナリティ全般の保証ではない |
| 開発ライブラリ | Pillow 10.2.0のローカルメタデータはHPND。開発用でありブラウザ配信物へライブラリを同梱しない。所有者の公開条件／権利確認はNOT RUN |
| 開発API | 通常URLの進行変更API露出を再現→DEBUG制限後は非露出・LAB側は維持を回帰確認 |
| 開発ログ・ローカルパス | 実行用では検出せず。ソースのみの3候補は実機接続手順2箇所と監査用fixture1箇所。個人情報や秘密値を報告へ転載しない |
| 公開対象 | 親READMEはmain/root＋.nojekyll、GitHub Actions workflowなし。別Sites manifestはdist指定・ローカル出力なし。現在有効な方式／遠隔設定はNOT RUN |
| 不要ファイル | root公開ならdocs/reports/tests/tools・比較画像等も出せる。JSONのruntimeFilesを配信用許可リストとして準備。ファイル削除・dist生成・公開範囲変更はしていない |
| Arcade031 | href・アイコン・参照先ファイルを確認。親menu.jsのSHA256を記録。こちらから変更なし |
| キャッシュ・旧保存 | main/dataのC参照を更新。未変更CSS／カメラ／画像は既存版参照を維持。save key/schemaは不変、service workerなし。実際のCDN混在／キャッシュ更新はNOT RUN |
| HTTP | 実サーバーの200/404、MIME、HTTPS、ライブPages確認はNOT RUN。静的に参照が解決したことだけをPASS |

公開対象全リポジトリの他ゲームは監査対象外。最終的な素材権利確認と配信方式・対象は所有者側で確定する。

## 13. 発見した問題・修正

| ID | 優先度 | 状態 | 内容 |
| --- | --- | --- | --- |
| C-M01 | MEDIUM | RESOLVED | 通常URLの旧QA進行変更APIをDEBUG限定へ。外部アカウント権限ではないが、意図しないローカル進行変更を避ける |
| C-L01 | LOW | OPEN | root配信で開発ファイル・ローカルパス候補が公開され得る。配信用許可リストと方式確認が必要 |
| C-L02 | LOW | OPEN | Arcade031説明がまだ8武器表記。リンクは正しい。親ディレクトリの文言は今回変更せず記録のみ |
| C-L03 | LOW | OPEN | 旧tests/data.test.mjs・runtime.test.mjsにM07 COMING SOON期待がソース上残る。今回の関連26スイート外。npm test全件はNOT RUNで、合格とは報告しない |

新しい未解決BLOCKER/HIGHは今回の実行範囲で発見せず。C-M01以外のゲーム本体は版・キャッシュだけで、能力・武器・敵AI・地形・難易度・進行・報酬・保存・アートを変更していない。

監査器の初回はStudyのデフォルトrootと降順メニューの切り出しを誤り、欠損を誤検出した。実ローダーのデフォルトとメニュー構造を追跡して監査側を修正。実ゲーム素材やリンクを変更して通したものではない。B-01追加試験も出現個体の初期timerを含めて厳密に閾値を評価し、AIを変えずPASSを確認した。

## 14. 未確認事項

通常人手8作戦、iPhone最終マトリクス残り、OS異常終了／保存追放、実FPS・音声・見た目の最終品質、ライブ配信のMIME／404／CDN、素材権利の所有者確認、公開方式・範囲は未確認。ブラウザ操作・スクリーンショット取得は今回0件。Node描画呼出し試験を実表示確認としない。

## 15. iPhoneで行うべき試験

1. C版を確認し、既存セーブを消さず、M01／M03 WING／M06／M08、司令部／リザルト／結末を横向き中心に試験する。
2. 左右・反転・ジャンプ・DASH・FLY/HOLD・移動＋射撃・切替・マイン長押し・複数指・cancel・PAUSE/RESUME・中断／復帰を組み合わせる。
3. safe-area・アドレスバー・長押し・ダブルタップ・小倍率の予兆／弱点・音声解除／ミュートを確認。
4. M03結果→司令部→M04、再読込記録、M08崩壊→結末→結果・再視聴を確認。既に申告された正常動作をCでも回帰確認する。
5. 通常人手攻略をCSV複製へ記録。性能は別途LAB前景30秒以上で採取し、自己申告と測定値を混ぜない。

## 16. 公開判定

**CONDITIONAL**：必須自動QA・静的監査の範囲は合格、確認した実機回帰3項目もユーザー申告PASS。一方、通常人手・iPhone全体・実測性能・実配信対象の未確認が残るためREADYとはしない。既知LOW項目も次の受入で整理する。

再実行順：`npm run qa` → `npm run audit:release` → `node tools/final-acceptance-report.mjs`。新しいFAILが出た場合は原因を調査し、実装不具合とテスト準備の問題を区別する。最終公開は今回の作業外で、別の明示的な指示が必要。
