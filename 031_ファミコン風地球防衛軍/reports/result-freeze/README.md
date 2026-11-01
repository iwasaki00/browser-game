# M03 RESULT FREEZE FIX / 1.2.0-A1

修正前後の隔離テストとChrome操作を記録する。Safari実セーブは参照しておらず、iPhoneで報告された完全停止そのものの根本原因は未確定。Chromeでは修正前から司令部へ戻れたが、戦闘入力残留はNodeで再現した。

## 完了報告（2026-11-01 JST）

| No. | 項目 | 結果 |
| --- | --- | --- |
| 1 | 修正Version | 1.2.0-A1 — M03 RESULT FREEZE FIX |
| 2 | 変更ファイル | 下記一覧。通常保存形式・戦闘性能・地形・アートは変更なし |
| 3 | 再現 | 修正前Nodeで飛行／射撃入力のリザルト残留を再現。通常エンジンの正式M03/WING出撃→撃破→結果→司令部は修正前Chromeで成功し、実機の完全停止は未再現 |
| 4 | 根本原因・根拠 | **確定できた別個の不備**：completeMission/show(result)に入力解除がなく、resetInputもpointer captureを解放しなかった。held input／aimPointer／pressedControlsが結果へ残るアサーションが修正前失敗・修正後成功。WING限定の能力不具合ではなく共通遷移経路 |
| 5 | 未確定事項 | Safariの完全停止が入力残留、保存、描画例外、ブラウザ固有キャンセル等のどれかは未確定。実データのM03クリア・M04解放が保存されたかも未参照。入力残留を実機停止の根本原因と断定しない |
| 6 | 修正 | クリア確定／結果表示で入力リセット、明示capture解放、所有解除後に解放して同期cancelへ対応。二重遷移抑止、保存状態・再試行、24件揮発診断を追加 |
| 7 | M03 WING遷移 | Nodeで開始X64から実移動・射撃のASSISTED通しと、保持／解放／キャンセル条件の結果→司令部成功。Chrome3サイズで実ボタン操作成功 |
| 8 | M04解放・保存 | テスト専用origin/MapでM03確定→M04 OPEN→保存→結果→司令部→M04装備準備まで成功。reload後も維持。保存失敗模擬では成功表示せず明示再試行 |
| 9 | 他3兵科 | RANGER/SCOUT/GUARDIAN：正式出撃後のボス地点ショートテストで実射撃・結果・司令部・保存・初回報酬1回を確認。通常全編人手攻略ではない |
| 10 | 他作戦 | M01結果の代表回帰、既存統合QAの全8作戦・M08全6シーン／結果／再視聴成功。既存の性能・AI・イベントは維持 |
| 11 | 関連テスト | 最終89成功（新規17、gameplay-polish22、campaign19、mobile-acceptance28、campaign-integration3）。構文・空白差分検査も確認 |
| 12 | qa:campaign | 再実行成功：140 PASS／0 FAIL／NORMAL_SIM未クリア8／HUMAN未実施8。関連587成功。最終の診断欄欠損ガード追加後は上記89件を再実行 |
| 13 | 実ブラウザ | Chrome 156、844×390・780×360・390×844。結果ボタン44px高、中央hit=true、操作パッドhidden、実クリック／連続クリック→司令部、M04選択、reload後の装備準備成功。新規JSエラー0 |
| 14 | iPhone再確認 | 下記の保持／解放／cancel・縦横・保存確認を実機で行う。ユーザーのSafari実保存を初期化しない |
| 15 | 未解決 | iPhoneの完全停止の再現と原因確定・実機での解消確認。無敵なし人手クリア・Safariの長押し／複数指／ノッチ条件は未確認 |

**対応状態：入力残留の修正と診断・保存再試行は実装済み。報告されたSafari HIGH不具合の最終クローズは実機再確認待ち。**

## 調査した実処理

1. 通常保存は既存`pixel-defense-front-save-v1`・version 2、旧version 1互換。クリア済み・解放ミッション・武器・装備・兵科・ミッション戦績・キャンペーン戦績・実績を既存の正規化関数で保持する。キーとスキーマを変更しない。
2. B-03は既存damageEnemyでHP0→死亡ガード・スコア／撃破を一度確定。M03危険範囲と弾を消し、段階的撃破FXと900ms後のcompleteMissionを予約する。
3. completeMissionはgame.clearで重複を防ぎ、通常の武器箱報酬・未取得優先抽選・M03クリア・M04解放・最高スコア・時間・兵科戦績・実績を更新。保存を試行し、500ms後に結果を表示する。既存の報酬量・順序は維持。
4. 変更前は通常結果へのshowでresetInputを呼ばず、FLY/HOLD/FIRE等の所有状態が残った。resetInput自体にもreleasePointerCaptureがなかった。これはボス／兵科の共通経路。M03だけの終了画面は存在しない。
5. 変更前でもChrome実クリックは司令部へ到達したため、この入力不備だけで実機の永久停止を説明できたとは扱わない。M03描画・報酬・保存・実績処理の例外は今回のChromeで未検出。

### 最小限の対策

- クリア確定時と結果／GAME OVER表示時に入力を解除。前者だけでは500msの結果待ち中に再押下できるため、表示境界でも解除する。通常戦闘中の長押し・複数指の所有方式は維持。
- touchPointers／pressedControls／aimPointer／remotePointer／SW長押しタイマーを先にクリアし、その後releasePointerCapture。同期lostpointercaptureや既に無効なpointerの例外で入力解除・画面切替を止めない。
- 結果からミッション選択後、同じ残存ボタンの二度目のclickで再破棄・再描画しない。遷移後は司令部の通常ボタンで操作する。
- 保存失敗は例外を既存storeSaveで扱い、「保存できません（未保存）」を結果と司令部へ表示。結果から戻る際にも一度再試行するが、失敗を理由に永久に閉じ込めない。メモリ上の同じsnapshotを保持する。
- 「保存を再試行」はstoreSaveのみ呼ぶ。completeMission、報酬抽選、CampaignRun.finish、実績解除を再実行しない。成功時だけ保存済み表示。失敗中にタブを閉じる／再読込すると未保存分は失われ得るため、ページを閉じない案内を出す。
- 24件のメモリ内ログでboss-defeated→clear-confirmed→combat-input-released→progress-updated→save-ok/failed→result-screen→result-raf→pointer/touch→mission-select-click→command-render-readyを記録。error/unhandledrejectionは短いメッセージだけ記録し、例外を握り潰して成功扱いにはしない。通常保存への追加フィールド、外部送信、毎フレームの蓄積はない。
- 新しい診断・保存案内のDOMが欠けた旧HTMLでも、それらの補助表示が保存や遷移を止めないようnullチェックを行う。未知の例外を包括的に無視するゲームループ改修はしていない。

## 修正前・回帰テスト

修正前に`tests/result-freeze.test.mjs`を追加して実行。飛行／射撃の保持テストが入力残留で失敗し、全入力解放時・通常遷移・他兵科の結果／保存は成功した。保存案内・診断のテストは未実装のため失敗（完全停止の再現とは別）。修正後17件成功。

| 必須確認 | 検証方法／結果 |
| --- | --- |
| M03 WING結果・司令部・M04 | 正式出撃X64、既存controllerの実移動／実射撃、無敵時間補助だけで全5エリア通過→結果→司令部。PASS |
| FLY/HOLD/移動/FIRE保持・全解放 | 正式出撃後ボス地点へQA配置して実射撃。撃破後の通常900ms待ちに保持を入力。結果で全所有者0、入力false、明示capture解放。PASS |
| 遅延中の新しい指 | completeMission後の500ms待ちに再度FLY/FIREを押す→結果表示で解除。PASS |
| 他3兵科 | 正式出撃＋ボス地点QA、通常の弾とHPで撃破→結果→司令部→reload。PASS |
| 連続タップ | 二度目mission-selectで破棄・描画ログや報酬が増えない。Chromeでdblclickも実施。PASS |
| touch cancel／capture例外 | pointercancel／lostpointercapture、解放時に同期cancelとNotFound相当例外、遅延SWタイマー・遅いpointerup。PASS |
| 保存・解放reload | Map保存→新runtimeでM03 CLEAR／M04 OPEN、通常武器保持。PASS |
| 初回報酬・実績・戦績 | 同一clear再呼出は無操作、保存から再出撃は通常の2回目として記録しFIRST CLEARを再付与しない。既存実績日時も不変。PASS |
| 保存失敗 | setItem例外→未保存を表示、司令部へ戻る→例外解除→明示保存のみ→M04保存、clears=1。PASS |
| LAB隔離・M01・M08 | LAB B-03撃破の通常setItem追加0、M01代表結果、統合QAでM08全形態・全6シーン／再視聴／結果。PASS |

ボス地点配置テストと開始X64の通しテストを区別した。自動QAは無敵時間を使い、通常難易度の人手攻略成功とは表現しない。テストはすべて専用Mapで、SafariのlocalStorageへ接続しない。

```text
node --test tests/result-freeze.test.mjs tests/gameplay-polish.test.mjs tests/campaign.test.mjs tests/mobile-acceptance.test.mjs tests/campaign-integration.test.mjs
89 PASS / 0 FAIL

npm run qa:campaign
140 PASS / 0 FAIL / 8 NOT_CLEARED / 8 HUMAN NOT_RUN
RELATED: 587 PASS / 0 FAIL
```

[統合結果](../campaign-integration/README.md)／[詳細JSON](../campaign-integration/results.json)。統合の初回再実行では、既存テストの「保存できません」という警告文期待が不一致で1失敗。意味を維持して新案内にも同じ文言を残し、再実行で成功。ゲーム性能の不具合を理由なく調整していない。

## 実Chrome確認

既存のComputer Useを使用。`tools/result-freeze-preview.mjs`は**手動起動したloopback専用サーバーでだけ**game.jsへテストcontrollerを追加配信する。通常index.htmlはこのツールを参照しない。専用ポート8925（修正前）／8926（修正後）を使用。初回は空のテストoriginだけにM01/M02済みfixtureを作成し、既存セーブがあればQA起動を拒否する。ゲーム内の正式M03出撃から開始し、既存controller・武器・AI・ボス・タイマー・保存・結果を使用。HP/敵/clearの直接代入はせず、無敵時間と高速の固定更新だけを補助する。

| CSS viewport | 結果ボタン矩形 | 中央hit test | 実操作 |
| --- | --- | --- | --- |
| 844×390 | x308.5 y293 / 110×44 | true | 結果→司令部→M04 OPEN選択・準備ボタン有効 |
| 780×360 | x276.48 y277 / 110×44 | true | 結果ボタンdblclick→司令部 |
| 390×844 | x41.5 y572 / 150×44 | true | 結果→司令部、reload→M04選択→装備画面 |

操作パッドvisibility=hidden。M03のmothershipStory等はhidden、ボタンに重なる透明要素なし。結果ログにresult-rafがあり描画ループの継続を確認。取得JS errorは0件。スクリーンショット上端のASSISTED QA帯はサーバーが足す検証用表示で、本編へは入らない。描画の実FPSやiPhoneのタッチ性能を計測したものではない。確認後にタブ・サーバーを終了しviewportを復元。

- [844×390 リザルト](result-844x390.png)
- [844×390 司令部・M04](command-m04-844x390.png)
- [780×360 リザルト](result-780x360.png)
- [390×844 リザルト](result-390x844.png)

## 変更ファイル・改行

- `js/game.js`：入力／captureの解除、結果遷移ガード、保存案内／再試行、揮発診断。`index.html`：結果と司令部の保存UI・折りたたみログ。`styles.css`：新表示だけのサイズ／横画面配置。
- `js/data.js`、`package.json`：Versionのみ。HTMLのバージョン・参照queryもA1へ更新。
- 新規`tests/result-freeze.test.mjs`、`tests/campaign-integration.test.mjs`の版番号、`tools/campaign-integration.mjs`の関連スイート追加。新規`tools/result-freeze-preview.mjs`は通常ゲームへ接続しないローカルブラウザ試験用。
- `README.md`、`docs/MOBILE_ACCEPTANCE.md`、本報告と4画像、統合QAの3結果ファイル。
- プロジェクトと祖先の適用対象`.gitattributes`／`.editorconfig`は無し。Git core.autocrlf=trueだが、今回の既存実ファイルはUTF-8 BOMなし／LFのみであったため、その実形式を維持。LF/CRLF混在・全面改行変換を行っていない。Gitが将来CRLFへ変換する警告とは区別。`git diff --check`で空白異常を確認。
- M01〜M08地形、兵科4・武器20・敵／ボス性能、UNIFIED 01、カメラ、通常320／LAB640、LAB5／司令部4タブ、30実績、通常保存スキーマ、Arcade031リンク、A版の診断機能は変更なし。

## iPhone Safariでの再確認（既存セーブを消さない）

1. A1版へ更新したページを通常reloadし、v1.2.0-A1表示を確認する。Safariのサイトデータ消去・セーブ初期化・ブラウザのプライベートモード移行は行わない。
2. 司令部でまずM03のCLEAR／M04のOPENの有無を確認する。今回こちらでその実保存状態を参照できたわけではない。
3. 通常のWINGでM03を遊び、FLY/HOLD＋射撃・移動の指を保持した撃破と、指をすべて離した撃破をそれぞれ確認する。途中開始／無敵QAで通常攻略を認定しない。
4. 結果で「保存済み」／「未保存」を確認。未保存ならタブを閉じず、空き容量等を確認して保存を再試行。通常データを削除しない。
5. ミッション選択→M04選択／装備準備へ進む。横・縦、通常タップ・連続タップ、途中で指が画面外へ出た場合も確認する。
6. 保存済み確認後にreloadし、M03クリア、M04解放、武器・兵科戦績・実績が維持されるか確認する。
7. 再発時はページを閉じる前に「遷移診断」を展開し、最後の段階・error・result-rafの有無が分かる画像を残す。iOS/Safari版、画面方向、保持していた指、アドレスバー／背景復帰の直前操作も記録。ログは通常保存へ書かず、reloadすると消える。UI自体が一切反応しない場合はその画面と操作条件を記録し、無理に解決済みとしない。

実機で同じ症状が再現する場合は、このログと条件から次の最小修正を判断する。現在のユーザーセーブの復旧や修復を実施したとの主張はしない。
