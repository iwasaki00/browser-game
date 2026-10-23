# 公開前監査 検査表

対象コミット・環境は[監査本書](release-audit.md)、EV番号と指摘は[根拠集](release-audit-evidence.md)を参照。PASSは記載した検査範囲だけの判定です。以前のGUI結果は「前工程」と明記しています。

| 検査ID | 検査項目 | 状態 | 証拠 | 備考 |
|---|---|---|---|---|
| AUD-01-01 | 出発順・tick・1tick1移動・同時処理順 | PASS | simulation.ts / EV-01 | ID順、tickごと各荷物1回のループ |
| AUD-01-02 | 分岐循環・合流・独立カウンター | PASS | simulation.ts / EV-01 | 分岐から送出時に1進む |
| AUD-01-03 | 誤配送後継続・全配送後CLEAR/FAILED | PASS | finish() / EV-01、07 | 正解個数と全荷物数から判定 |
| AUD-01-04 | 再挑戦初期化・履歴 | PASS | main.design / DeliveryRun初期化 / history.ts | historyは既存イベントの読取だけ |
| AUD-01-05 | 保存全探索レポートとの対応 | PASS | EV-03 | 全20識別子・集計・保存74成功設定が一致 |
| AUD-01-06 | 現行28,548設定の全列挙 | NOT_APPLICABLE | 今回は実行しない指示 | 保存報告の全探索数と今回再配送数を区別 |
| AUD-02-01 | FAILED0・RESCUE成功1・通常非最適2・最適3 | PASS | rateDelivery / EV-01 | 通常分布からRESCUEを先に分離 |
| AUD-02-02 | 同一ストアの最高星維持・星1次面解放 | PASS | progress.test / EV-01、08 | 最高星3から星1後も3を保持 |
| AUD-02-03 | 複数タブの最高星・CLEAR維持 | FAIL | AUD-002 | P1、古いスナップショットで消失 |
| AUD-02-04 | SolverへのRESCUE混入防止 | PASS | solver.tsのsimulateのみ使用 | 通常エンジンを新規生成、予約なし |
| AUD-03-01 | 保存キー・schema・設定・正常再読込 | PASS | progress.ts / EV-01、06 | ProductionとDEVキーを分離 |
| AUD-03-02 | 一部不正値から正常項目を保持 | FAIL | AUD-001 | P1、正常な進行全体を破棄して次回保存 |
| AUD-03-03 | 起動時に未知schemaを保護 | PASS | progress.test / EV-01 | 書込禁止、統合初期化も拒否 |
| AUD-03-04 | 起動後に未知schemaへ変わった場合の保護 | FAIL | AUD-002 | P1、保存直前の再検証なし |
| AUD-03-05 | 保存例外でもプレイ継続 | PASS | progress.test / EV-01 | メモリ内継続、状態通知 |
| AUD-03-06 | 初期化キャンセル・音声演出設定保持 | PASS | LAB/progressテスト / EV-01、10 | LAB削除失敗は進行初期化も停止 |
| AUD-03-07 | 未知形式の初期化案内 | FAIL | AUD-003 | P3、保護による拒否と案内が不一致 |
| AUD-04-01 | 全20最高星1・RESCUE星も含む | PASS | labUnlock / EV-01 | 19面ではロック |
| AUD-04-02 | 解放した通常RUNの登録 | PASS | recordRunOutcome / EV-01 | 進行更新→解放判定→収集 |
| AUD-04-03 | FAILED・RESCUE除外 | PASS | lab.collect / EV-01、08 | rescueUsedとイベントmarkerの双方を見る |
| AUD-04-04 | 全分岐正規化・未使用差異・重複 | PASS | normalizeConfiguration / EV-01 | 順序一定のJSON tuple、100回重複でも1件 |
| AUD-04-05 | 独立キー・保存後再生成で復元 | PASS | lab.test / EV-01 | 注入ストレージによる現在の実行結果 |
| AUD-04-06 | 旧Fingerprint・未知schema・部分破損・容量 | PASS | lab.test / EV-01 | 原文保持、現在の件数・適用から除外 |
| AUD-04-07 | 合計成功数74・min(100,total) | PASS | EV-03 / lab.test | 将来128成功の合成fixtureで上限100を確認 |
| AUD-04-08 | 再挑戦直前の再取得・設定検証 | PASS | prepareLabRetry / EV-01 | 保存差替え・再ロックを拒否 |
| AUD-04-09 | DESIGN適用・HINT/RESCUE初期化・非自動RUN | PASS | main.ts統合 / EV-10 | 前工程Chrome DEVメモリfixtureで操作確認 |
| AUD-04-10 | 永続LABの実ブラウザ再読込 | UNVERIFIED | 単体復元のみPASS | memory-only DEV fixtureは永続保存の証拠にしない |
| AUD-04-11 | 通常プレイで20面を通して解放 | UNVERIFIED | 解放ロジックはEV-01 | 全20面GUI巡回はしない |
| AUD-05-01 | RESCUE複製・照合・古い予約排除 | PASS | WeakMap/revision / EV-01 | RUNごとpreview所有、tick/parcel/switch/枠/方向一致 |
| AUD-05-02 | PAUSED停止・キャンセル未消費 | PASS | EV-07 | 停止後もTICK1、再開後FAILED・未使用 |
| AUD-05-03 | 1イベント上書き・カウンター・1回制限 | PASS | rescue.test / EV-01 | 同方向確定も使用扱い |
| AUD-05-04 | HINT60件・識別子・経路参照 | PASS | EV-02 | 保存成功設定を参照、全探索はしない |
| AUD-05-05 | HINT段階・状態競合・星/RESCUE無影響 | PASS | hints.ts / hints-ui.ts / EV-07 | 1→2、3未解放をChromeで確認、状態処理は静的確認 |
| AUD-06-01 | viewport・375px横幅・主要ボタン | PASS | EV-09 | ピンチを禁止するmeta指定なし |
| AUD-06-02 | Canvas表示座標・サイズ変更 | PASS | main.resize / ResizeObserver | DPRと論理盤面の比でsetTransform |
| AUD-06-03 | Canvas上の入力座標変換 | NOT_APPLICABLE | Canvasに入力イベントなし | 分岐操作はHTMLボタン |
| AUD-06-04 | タップ・文字選択・スクロール | PASS | CSS touch-action:manipulation / user-select:none | ボタンのみ選択抑制、スクロール禁止イベントなし。実機感触は別 |
| AUD-06-05 | iOS安全領域・可変高・横向き | UNVERIFIED | IP-02、12 | viewport-fit=coverなし、safe-area専用CSSなし。未確認を不具合とはしない |
| AUD-06-06 | 音声ジェスチャ・非表示停止処理 | PASS | audio.ts / main.visibilitychange | 音声例外はゲーム外でcatch |
| AUD-06-07 | iPhone音声実聴・バックグラウンド復帰 | UNVERIFIED | IP-11 | AudioContext interruptedを含む実機挙動未確認 |
| AUD-07-01 | 機密代表形式・ローカルパス検索 | PASS | EV-05 | 対象ソースと現存distで該当なし。完全検出の保証ではない |
| AUD-07-02 | ゲーム独自外部通信・外部資産 | PASS | ソース走査 / EV-05 | Canvas/Web Audio生成、システムフォント。SVG名前空間URLは通信でない |
| AUD-07-03 | HTML挿入・保存文字列の表示 | PASS | main / LabPanel / HintPanel | innerHTMLは固定・検証済み値、保存自由文は挿入しない |
| AUD-07-04 | 依存・既知脆弱性 | PASS | EV-04 | 公式npm audit既知0件、実行時依存なし |
| AUD-07-05 | ライセンス宣言・ファイル | PASS | lock93項目、直接3依存のLICENSE | 宣言欠落0、不要な直接依存を検出せず |
| AUD-07-06 | 画像・音・フォント・文書・ライブラリの権利 | UNVERIFIED | Human Review | 自作由来・配布通知要否の人間による承認待ち |
| AUD-07-07 | DEV全解放・fixtureのProduction除外 | PASS | EV-05、06 | DEVクエリ付きでも0/20から開始 |
| AUD-07-08 | 専用「12_公開前監査ツール」 | UNVERIFIED | 利用可能ツール・近傍検索で確認できず | 実行していない。静的監査で代替 |
| AUD-08-01 | dist参照・相対配置・版の一致 | PASS | EV-05 / base:'./' / menu.js | 既存親menuは本作distへ、戻り先は3階層上 |
| AUD-08-02 | 不要開発ファイル・ソースマップ | PASS | dist全3ファイル | .map・レポート・fixture・秘密情報なし |
| AUD-08-03 | ローカル起動・JS/CSS読取 | PASS | EV-06 | 現存distをpreview、再生成なし |
| AUD-08-04 | キャッシュ対策の構造 | PASS | ハッシュ名JS/CSS、Service Workerなし | HTMLの更新／CDN反映時間は別 |
| AUD-08-05 | GitHub Pages実URL・CDNキャッシュ | UNVERIFIED | リモート配信未操作 | 公開URL・親menuを変更していない |
| UX-01 | L/R・枠進行・RUN・全便正解 | PASS | index.html / Chrome | 左右と印、操作文を確認 |
| UX-02 | 星2/3・RESCUE星1の事前説明 | FAIL | AUD-004 | P3、結果後だけでなく事前説明を推奨 |
| UX-03 | HINT入口・LAB解放条件 | PASS | index.html / EV-06、07 | HINT影響なしの案内、全20星1条件 |

既存テストの前工程75件・91件は参考証拠として利用し、今回の108件とは加算していません。ビルド・全件回帰・全20面GUI巡回・全28,548設定探索は今回未実行です。
