# MOBILE ACCEPTANCE PREPARATION / 1.2.0-A

実機受入の準備段階。iPhone Safari実機、人手の通常全8ミッションクリア、実機FPSは未確認。Windows Chromeでの診断操作とNodeの合成時計テストを、実機性能とは区別する。

計測仕様は[PERFORMANCE_MEASUREMENT](../../docs/PERFORMANCE_MEASUREMENT.md)、接続・人手受入は[MOBILE_ACCEPTANCE](../../docs/MOBILE_ACCEPTANCE.md)。公開・commit・push・デプロイなし。実装・確認日：2026-11-01 JST。

## 完了報告

| No. | 項目 | 結果 |
| --- | --- | --- |
| 1 | Version | 1.2.0-A — MOBILE ACCEPTANCE PREPARATION / Phase A |
| 2 | 変更ファイル | 下記一覧。診断・UI・テスト・文書のみ。アート／戦闘性能／地形／保存形式は変更なし |
| 3 | 診断HUD | LABだけでON/OFF、ゲーム外ヘッダー。現在／平均RAF、品質、サンプル、敵数。詳細パネルはP50/P95・CPU・弾／FX・倍率等。更新750ms |
| 4 | 計測方式 | 既存MobilePlaytest継承、実RAF間隔とPerformance時刻による更新／描画CPUを別集計。低FPS指標=1000/P95で最低FPSではない |
| 5 | 有効・除外 | 非表示・ポーズ・復帰後1秒を除外。250ms以下の低速は保持。250ms超は直前CPU整合／判別不能を別記。品質3区分・件数・有効秒数・除外数を表示 |
| 6 | 10代表試験 | M01基本／100体、M03対空、M06通路、M08形態1/2/3・エンディング、FX負荷、現在戦闘120秒。既存LAB処理を使用 |
| 7 | 通常攻略 | 未使用別ポートの通常URLで新規検証プロフィール。通常HP・被弾・解放・死亡・クリア条件を使用。LAB無敵QAと区別 |
| 8 | 評価・問題 | 5項目1〜5と未評価null、端末名任意、結果・メモ。問題ID・4重大度・条件・再現・影響・値・状況。追加はOPEN、解決は明示操作のみ |
| 9 | 出力 | 選択記録の日本語テキスト、全履歴JSON、Blob保存要求、失敗時の読取専用手動コピー。外部送信なし |
| 10 | 通常セーブ | 専用キーpixel-defense-front-acceptance-v1。通常キーの内容・書込数を関連試験で確認 |
| 11 | LAB隔離 | 成績・報酬・実績非加算。5タブ／司令部4タブ維持。通常URLでHUD・TEST LAB非表示。B手動記録は自己申告で自動クリア認定しない |
| 12 | 関連自動試験 | 72成功（受入28＋従来モバイル25＋LAB UI10＋武器リスト9）。構文チェック・diff空白検査成功 |
| 13 | 統合QA | npm run qa:campaign：140成功／失敗0／NORMAL_SIM未クリア8／HUMAN未実施8。関連549成功。下記の区分に注意 |
| 14 | Chrome確認 | 起動、LAB、開始／停止、HUD、10候補、形態3直接開始、履歴復元、評価明示保存、JSON／テキストコピー、指定3サイズ、通常M01出撃 |
| 15 | iPhone準備 | LAN配信・安全な通常検証origin・手動コピー・実タッチ／音声／中断／長時間／保存チェックの手順を作成。実機試験そのものは未実施 |
| 16 | 接続方法 | プロジェクト直下でpy -3 -m http.server 8120 --bind 0.0.0.0、ipconfigの実IPv4でiPhoneからアクセス。実際のLAN配信・Firewall変更は未実施 |
| 17 | Phase B | 実機JSON・問題ID・再現手順・画像を取得後、同条件で再現し必要最小限の表示／操作／性能修正。未確認を解決済みにしない |
| 18 | 未確認 | iPhone Safari実機・LAN到達・ノッチ・実マルチタッチ・Safari音声／保存／コピー／中断復帰・人手通常全編・50/100/200実機性能 |

## 作成・変更ファイル

- 本体：`index.html`、`styles.css`、`js/game.js`、新規`js/mobile-acceptance.js`、`js/mobile-playtest.js`（既定互換の時間／履歴オプション）、`js/data.js`（VERSIONのみ）、`package.json`（Version）。
- テスト：新規`tests/mobile-acceptance.test.mjs`、既存`tests/mobile-playtest.test.mjs`の互換確認、`tests/helpers/runtime.mjs`（診断モジュール接続）、`tests/campaign-integration.test.mjs`（版番号期待）、`tests/lab-ui.test.mjs`（古い固定版番号を現行VERSIONへ整合）、`tools/campaign-integration.mjs`（関連スイート追加）。既存mobile-playtest試験のソースは変更せず再実行。
- 文書：`README.md`、`docs/GAME_SPEC.md`、`docs/TEST_LAB_UI.md`、新規`docs/MOBILE_ACCEPTANCE.md`、`docs/PERFORMANCE_MEASUREMENT.md`。
- 結果：本フォルダ、`reports/campaign-integration/README.md`・`results.json`・`related-tests.txt`を再生成。Arcade031親リンクは変更なし。

## 自動試験

```text
node --test tests/mobile-acceptance.test.mjs tests/mobile-playtest.test.mjs tests/lab-ui.test.mjs tests/lab-weapon-picker.test.mjs
72 PASS / 0 FAIL

npm run qa:campaign
156 cases = 140 PASS + 0 FAIL + 8 NOT_CLEARED + 8 NOT_RUN
RELATED-ENGINE-SUITES: 549 PASS / 0 FAIL

node --check js/mobile-acceptance.js
node --check js/game.js
git diff --check -- .
成功
```

統合実行：2026-11-01T04:10:00Z〜04:11:53Z。[詳細](../campaign-integration/README.md)。構造試験・無敵補助付きASSISTEDと無敵なしNORMAL_SIMを区別。NORMAL_SIM8件は既存自動操作の未クリアで、通常攻略不能とも成功とも断定しない。HUMAN8件は未実施。全件の無関係な回帰は実行せず、指定の統合QAと変更影響スイートのみ。最終の計測中ラベル（60/120/手動の区別）補正後も上記72件を再実行した。

受入試験は60Hz合成時計、10fps／250ms保持、直前CPU300ms負荷、判別不能長間隔、復帰再準備、各時間、未取得CPU、履歴20・問題12上限、容量失敗、10プリセット実ハンドラー、通常書込ゼロ、評価・出力失敗、B手動記録の計測なしを含む。LAB各プリセットが通常の保存・成績・実績に混入しないことを確認。

## Chromeの実操作・画面

Windows Chrome 156、ローカル専用`http://127.0.0.1:8912/`、CPU自動操作環境。ブラウザは既存Computer Useを利用。画面サイズはCSS viewport模擬で、iOSではない。終了時に専用タブとサーバーを閉じ、viewportを戻した。

| サイズ | 実際に確認した内容 | 画像 |
| --- | --- | --- |
| 844×390 | HUD ONでcanvasと非重複（HUD y34〜48、canvas y62〜388）、手動計測開始、IP-01〜10全候補の選択、M08第3形態開始 | [HUD](chrome-844x390-hud.png) |
| 780×360 | 停止・履歴保存、HUD OFF、JSONコピー。LAB矩形x8/y8/764×344、ヘッダー・フッター内包 | [出力操作](chrome-780x360-metrics.png) |
| 390×844 | 履歴・評価欄の展開、メモ入力・明示保存、内部スクロール。横はみ出しなし（body幅390、LAB x8/y8/374×828） | [評価フォーム](chrome-390x844-metrics.png) |
| 844×390 通常URL | LAB終了後reload→司令部0/8・4タブ→RANGER/A-01/S-02・2/20解放→通常M01出撃。TEST LAB／HUDなし、R-04は未解放維持、UNIFIED 01・320描画 | [通常出撃](chrome-normal-url.png) |

開発中の同じ版クエリの古いモジュールキャッシュでmanualAcceptance export不足を1度検出。参照クエリ更新後に再起動し、通常／LAB両方の上記操作を確認。それ以降の新規JSエラーは取得ログにない（過去ログは残る）。favicon.icoの要求404はゲーム資産・診断動作には影響しない。古いキャッシュがある場合の手順を受入文書へ記載。

## RAF・CPUの参考記録

[ゲームUIから出力したJSON](chrome-reference.json)。性能比較のための正常連続試験ではない。戦闘中の自動ブラウザ中断を含み、敵0の待機記録もあるので大量戦闘やiPhoneの評価に転用しない。

| 条件 | 品質 | 有効N／時間 | 平均RAF | P50／P95 | 更新／描画CPU | 除外／長間隔／中断 |
| --- | --- | --- | --- | --- | --- | --- |
| IP-01 M01開始付近・敵0 | 参考値 | 892 / 30.01秒 | 29.73fps | 33.50 / 33.50ms | 0.45 / 1.00ms | 128 / 4 / 4 |
| IP-10 現在戦闘・敵0、手動停止 | 参考値 | 479 / 7.99秒 | 59.95fps | 16.75 / 17.00ms | 0.22 / 0.61ms | 73 / 0 / 1 |
| IP-07 M08第3形態 | 測定不成立 | 0 / 0秒 | 未取得 | 未取得 | 未取得 | 50 / 3 / 4 |

IP-10は手動停止の操作確認であり120秒試験の達成ではない。IP-07は形態3起動を確認したが、ブラウザの長間隔が混入し有効0件。無意味な再測定はしていない。平均の差から描画品質や端末性能の優劣を判定しない。JSONの人手評価は未評価のままで、Chrome UI操作メモだけを付与した。

## 準備完了と次の試験

診断・代表場面・ローカル保存／出力・通常保存隔離・受入手順は用意できた。実機のPhase A試験を開始し、IP-01から操作／音声を確認した後、100体・各ボス・エンディング・120秒継続へ進む。通常攻略は別originで行う。Phase Bでは問題の重大度と実機再現性を優先し、性能不足を推測してゲームバランスを変更しない。
