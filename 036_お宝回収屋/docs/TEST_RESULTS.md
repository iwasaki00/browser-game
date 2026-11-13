# TREASURE SPRITE SHEET FOUNDATION（Version変更なし）

自動665/665（既存647＋追加18）、新しい表示試験10ケース、既存7ブラウザ回帰、本番4ケースが成功。9シート・300割当・54試作とSVGフォールバックを検証。iPhone Safari実機は今回未確認。初回タイムアウトと試験データ補正を含む詳細は[TREASURE_SPRITE_RESULTS](TREASURE_SPRITE_RESULTS.md)と[検証サマリー](treasure-sprite-summary.json)を参照。

---

# Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE

647/647、ブラウザ7/7、保存12状態、不正JSON、複数タブ、10画面構成、本番2ブラウザ、preview/配下パス4ケース、300種、未実装77道具、6ライン24ゲーム時間を確認。iPhoneはユーザー申告OK、WebKit未導入。

[最終受入](FINAL_ACCEPTANCE_1.0.0.md) / [公開判断](RELEASE_DECISION_1.0.0.md)

---

# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

647件成功（旧631＋16）、ブラウザ回帰7/7、12状態保存、別contextJSON、破損11分類＋HTML UID、10端末構成、6ライン24ゲーム時間、300種、本番Chrome/Edgeが成功。WebKit未導入/実機Safari未確認。

[監査と結果](FINAL_REPORT_0.9.2.md)

---

# Version 0.9.1 — STABILITY & FINAL POLISH

631件成功（既存617＋14）、既存7ブラウザ回帰、Chrome320/390/1280・Edge390の保存/入力、公開版Chrome/Edge、9状態復元、400モデル、6ライン24ゲーム時間、300種監査、実メモリ/CPU計測。WebKit/実機Safari未確認。[結果](FINAL_REPORT_0.9.1.md) / [性能](PERFORMANCE_REPORT_0.9.1.md)。

---

# Version 0.9.0 — GAME EXPERIENCE REFINEMENT

617件の自動テスト、既存7ブラウザ回帰、Chrome/Edgeの新UI・本番版、100シード×4方針、6ライン24ゲーム時間が成功。詳しくは [QA](UX_QA_REPORT.md) と [30分モデル](FIRST_30_MINUTES_ANALYSIS.md)。WebKit未実施、実機iPhone Safari・人間の主観評価はユーザー確認待ち。

再実行：npm.cmd test / npm.cmd run test:regression-browser / npm.cmd run test:ux-browser / npm.cmd run test:automation-browser / npm.cmd run test:advanced-browser / npm.cmd run test:save-browser / npm.cmd run test:field-feel-browser / npm.cmd run test:advanced-stress / npm.cmd run balance:ux -- 100 / npm.cmd run test:ux-performance / npm.cmd run build / npm.cmd run test:production。

---

# Version 0.8.2 — 検証結果

- 自動 **581件成功、失敗0**。既存528件＋追加53件。川底の能力/重量/磁性/距離/障害物/時間/持替え/再試行/入力頻度、河原の地形/容量/ふるい/皿/水流準備/微細回収/固定個体/残渣/時間加速/保存を検証。RFEEL/GFEEL20件の保存整合も含む。
- TypeScript・Vite成功。46モジュール、JS376.26kB/gzip96.58kB、CSS23.31kB/gzip6.20kB。
- [道具体験UI](field-feel-ui-v082.json)：Chrome320/390/1280px、Edge390px。マウス長押し・ドラッグ、20/200イベント、CDPタッチ・cancel、blur/解放停止、持替え進捗、保存、装備4枠、8タブ・FEEL20・JSON・通常保存分離に成功。頻度比較は実際に計上された作業秒当たりの進行で照合。処理落ちで100msを超えた時間は安全側に捨てる。
- [既存7系統](regression-browser-results-v082.json)：すべて成功。旧「回数/距離だけ」の操作を長押しへ更新し、既存の対象・報酬・品質・深度・保存期待値を維持。通常画面・深層・露出/洗浄・川底・河原・砂浜道具・川底/河原道具を確認。
- [6ラインUI](advanced-ui-v082.json)：320/390/1280pxで購入・増設・強化・個別停止・配分・6ライン・成長・300品・Worker/中止/出力/通常保存分離を確認。
- [本番Chrome/Edge](production-results-v082.json)：既存全分野/設備/ライン/図鑑/保存復元を確認。RFEEL/GFEEL・DIG・旧LABの強制操作/比較/Workerマーカーが全アセットに存在しない。DEV APIなし、隠し操作も無効、通常保存キーだけを使用。
- [保存と複数タブ](save-phase0-v082.json)：履歴1万件の圧縮、支払い資格保持、処理中保存、最新スナップショット、単一進行タブ、所有権移動・復元に成功。
- [100シード](field-feel-balance-v082.json)：川底2800、河原処理1400、採取800、精密400条件。全条件で二重報酬0、固定個体維持。能力不足は回収不可でnull時間。詳細と計測範囲はFIELD_TOOL_BALANCE.md。
- [長時間試験](advanced-stress-v082.json)：6ライン24ゲーム時間、1002個体の一括回収、継続投入4332件、キュー最大64、毎時復元24回、履歴200、保存175663〜181543bytes。非表示進行なし・二重移行不変。Node heapでありiPhone実機メモリではない。
- iPhone Safari実機・実機の音/電池/メモリは未確認。Chromeの小画面とタッチ成功をSafari実機の保証とはしない。

再実行：npm.cmd test / npm.cmd run build / npm.cmd run balance:field-feel / npm.cmd run test:advanced-stress。開発サーバー5176でtest:field-feel-browser、test:regression-browser、test:advanced-browser、test:save-browser。本番はtest:production。

---

# Version 0.8.1 — 検証結果

- 自動 **528件成功、失敗0**。旧454件を含む。追加74件：10境界、9道具の上限、材質適性、非掘削道具、ブラシ、静止/移動/イベント/フレーム頻度、停止/復帰、固定個体、実体積採砂、限界、旧250保存、ライン供給、描画、DIG20保存整合。
- 型検査・本番ビルド成功。44モジュール、JS367.69kB/gzip93.75kB、CSS22.64kB/gzip6.03kB。
- [既存ブラウザ7系統](regression-browser-results-v081.json)：全成功。時間式入力に合わせて長押しへ変更し、80/180/280/420/600の上限、洗浄報酬、保存、宝非露出の期待値は維持。画素は宝の輝きと重ならない穴で計測。
- [掘削Chrome/Edge](digging-ui-results-v081.json)：Chrome320/390/1280、Edge1280。静止・ドラッグ・20/200イベント、CDPタッチ、10層、道具/モーダル/blur/hidden停止、保存復元、4枠と装備比較、DIG20・8タブ・JSON・通常セーブ分離を検証。
- [6ライン](advanced-ui-v081.json)、[3設備](automation-ui-results-v081.json)、[旧ライン](line-ui-results-v081.json)、[12エリアと図鑑300](world-ui-results-v081.json)：320/390/1280pxで全成功。Worker比較/中止を維持。
- [本番Chrome/Edge](production-results-v081.json)：DEV APIなし、隠し操作で開けず、通常保存キーのみ。DIG/ADV/WORLD/TREASURE/LINE/AUTOと比較/Worker/強制操作のコード・専用CSSマーカーを配布全アセットで不在確認。既存全分野と増設・保存復元も成功。
- [保存と複数タブ](save-phase0-v081.json)：1万履歴848827→29068bytes、最近200件・支払10000件保持。処理中保存、緊急スナップショット、単一進行タブ、所有権引き継ぎ・復元成功。
- [100シード](digging-balance-v081.json)：到達2400、表層/硬砂4800、収益1400条件。固定個体維持、Jなし、不可逆進行不能0。60秒収益なしの構成/シードあり。[表と制約](DIGGING_BALANCE.md)。人間の実プレイ時間ではない。
- [24ゲーム時間負荷](advanced-stress-v081.json)：6ライン同時稼働、1002個体全回収、キュー最大64、毎時復元24回、継続投入4332件、履歴200。保存175651〜181611bytes、非表示進行なし・二重移行不変。計測はNode heapで実機メモリではない。
- iPhone Safari実機・実機の音・電池/メモリは未確認。Chromeの幅とタッチ試験はSafariの代替保証ではない。

再実行：npm.cmd test / npm.cmd run build / npm.cmd run balance:digging。開発サーバーを5176で起動してtest:digging-browser、test:regression-browser、test:advanced-browser、test:automation-browser、test:line-browser、test:world-browser、test:save-browser。本番はtest:production。

---

# Version 0.8.0 — 検証結果

- 自動454件成功、失敗0。既存407＋追加47。バージョン期待値は現行へ更新。設備個体・配分・移行・部分投入・強化制限・成長・300品・ADV20を検証。
- 型検査・Vite成功。41モジュール、JS358.64kB/gzip90.11kB、CSS21.66kB/gzip5.82kB。
- [既存ブラウザ7系統](regression-browser-results-v080.json)：全成功。通常、深層、露出/洗浄、川底、河原、砂浜道具、川底/河原道具。
- [ADV UI](advanced-ui-v080.json)：320/390/1280pxで購入・増設・強化・2/6ライン・個別停止・材料指定・一つずつの詳細・成長・8タブ・ADV20・300品・通常セーブ分離・Worker実行/中止/JSONを確認。
- [3設備](automation-ui-results-v080.json)、[旧ライン管理](line-ui-results-v080.json)、[12エリアと図鑑300](world-ui-results-v080.json)も3幅で成功。
- [本番Chrome/Edge](production-results-v080.json)：既存機能と増設/強化/保存復元成功。DEV API・隠し起動・ADV/WORLD/TREASURE/LINE/AUTO強制操作と比較モジュールを除外。
- [保存](save-phase0-v080.json)：1万履歴848827→29065bytes、最近200件と累計保持。進行中保存、最新緊急スナップショット、単一進行タブ、所有権移動・復元成功。
- [300品監査](TREASURE_REACHABILITY_AUDIT.csv)：正常300、警告0、異常0。SR/Jを含め条件固定で通常回収・支払い・図鑑・二重報酬拒否まで検証。通常100シードで全種出たという意味ではない。
- [100シード](advanced-balance-v080.json)：3分野×5構成×少量/大量＝3000条件、全条件で通常収益あり、二重報酬0。体力は本体操作実績から集計。
- [成長100単位](growth-model-v080.json)：同じ空の砂袋で初期34操作、1ライン1操作、2ライン2操作。採取/洗浄/FNは対象外。
- [負荷](advanced-stress-v080.json)：1002対象を全件回収、キュー最大64。6ライン24ゲーム時間、毎時復元24回、継続投入4332件、履歴200、非表示tick不変、二重移行不変。試験側で完了参照を毎分整理（通常の区画切替に相当）し途中・未受取は残す。
- 保存：1002対象処理後466091bytes、24時間175651〜182209bytes。Node heap約24.1〜108.8MiB。ブラウザ/iPhoneメモリは未測定。
- 大量個体照合の二重ループを集合参照に変更し、スポット測定の2ゲーム秒計算が約200〜500msから30〜50msへ改善。設備計算10Hz、UI400ms単位、描画から分離。
- iPhone Safari実機は未確認。Chromeの縦画面・タッチで代替確認。時間は固定モデルで人間の実プレイ時間ではない。

## 再実行と制約

npm.cmd test / npm.cmd run build / npm.cmd run audit:treasures / npm.cmd run balance:advanced / npm.cmd run test:advanced-stress。ブラウザは別ターミナルでnpm.cmd run dev -- --port 5176 --strictPortを起動しtest:advanced-browser、test:automation-browser、test:line-browser、test:world-browser、test:save-browser、test:regression-browser、test:production。

性能比較は材料準備済み・設備付与。購入時間は採取を含む短時間収益を反復する線形試算で、資金制約付きの解放/購入ルート全体ではない。長い投資回収期間、分野単位の異なる全体滞留、Safari実機・ブラウザメモリは次版へ引き継ぐ。

---

# Version 0.7.0 — 検証結果

- 自動テスト407件成功、失敗0。既存351件と追加56件。旧件数36→300、部分投入、保存区画保持に伴う期待値は現行仕様へ更新。第5層の既存テストは実処理を維持して成功。
- TypeScript検査・Vite本番ビルド成功（39モジュール）。JS344.19kB / gzip85.25kB、CSS21.21kB / gzip5.73kB。
- 既存ブラウザ7系統を最終コードで再実行し全成功：通常探索・深層・露出／洗浄・川底・河原・砂浜道具・川底／河原道具。[結果](regression-browser-results-v070.json)
- 新エリア／図鑑：320/390/1280px、全12エリア・新7エリアへの移動、12件ページ、分野・状態・検索、未発見の秘密、R/SR/J、固定モーダル、8タブ・99シナリオ、1000個配置、通常セーブ分離、PNG未配置時404なし、pageerrorなし。[結果](world-ui-results-v070.json)
- ライン管理：320/390/1280px、タッチ、停止・再開、中間在庫、川底移動警告、手動精密回収、1/2/10倍比較、Worker比較・中止・JSON出力。[結果](line-ui-results-v070.json)
- 既存3設備：3幅で購入・予約・停止復元・別分野継続・非表示停止・タッチ指定・精密回収・LAB比較を確認。[結果](automation-ui-results-v070.json)
- 保存：1万件の履歴は848340→28528 bytes、最近200件を保持し累計10000件を維持。処理中保存、最新緊急スナップショット、2タブ単一進行、所有権移動・復元成功。[結果](save-phase0-v070.json)
- 部分投入：砂／砂利500単位の袋、旧220単位の砂利袋を容量内の区間で処理。先頭個体のスキップ・二重消費・入力統計の水増しを防止。未投入分と個体IDは元袋に保持（自動テスト）。
- 本番Chrome/Edge：探索・洗浄・保存・川底・河原・深層・新道具・3設備・ライン・全12エリア・図鑑300成功。DEV API、隠し起動、強制生成、WORLD/TREASURE/LINE/AUTOマーカー・比較モジュールを除外。[結果](production-results-v070.json)
- 100シード×12エリア×3構成＝3600試行＋5個到達3600試行、候補抽選120万回。全条件で通常収益を確認。5個到達は628条件が120モデル秒以内未達。[条件・数値](WORLD_BALANCE.md)
- 1000個混合配置：5回復元、1000個報酬確定、履歴200件、503277→374193 bytes、二重支払いなし。強制Jを含むため通常の経済比較には使わない。
- 24ゲーム時間：3分野同時、毎時保存復元24回、累計7576件、最大キュー4件、保存142847〜155379 bytes、非表示tick不変、二重移行不変。[結果](world-stress-v070.json)。モデルを約41.4秒で実行した試験であり、実機を24時間放置した確認ではない。
- 実画面の図鑑詳細・川底・320pxラインを画像で目視確認。iPhone Safari実機は未確認。Chromiumのタッチ・縦画面とChrome/Edge本番で代替確認。

## 再実行

PowerShellでプロジェクトへ移動しnpm.cmd test、npm.cmd run build。ブラウザ試験は別ターミナルでnpm.cmd run dev -- --port 5176 --strictPortを起動し、test:world-browser / test:line-browser / test:save-browser / test:regression-browser / test:productionを実行。モデルはbalance:world / balance:world-milestones / test:world-stress。

## 残る制約

B-C/B-Dは固定走査モデルで5個到達が遅い。今回の資金準備済み比較から新エリアの設備購入時間・長期投資回収は算出しない。画像は未生成。Safari実機、継続採取による投資分析は次版へ引き継ぐ。

---

# Version 0.6.0 — 検証結果

- 自動テスト：351件成功、失敗0。既存282件を維持（区画移動の1件は新仕様の予約解除へ期待値更新）、保存9件、ライン33件、LAB・境界条件27件。
- 型検査・本番ビルド成功。JS約181.7kB / gzip約66.0kB、CSS約20.2kB。
- 既存ブラウザ7系統：探索UI、深層、露出・洗浄、川底、河原、砂浜道具、川底／河原道具すべて成功。[結果](regression-browser-results-v060.json)
- 既存3設備：320/390/1280px、購入・予約・停止復元・別分野継続・非表示停止・タッチ対象指定・精密回収・旧LAB/Worker。[結果](automation-ui-results-v060.json)
- ラインUI：320/390/1280px、タッチ、個別停止、中間在庫、川底移動確認、手動精密回収、8タブ・44旧＋15 AUTO＋20 LINE、加速比較、Worker比較／中止・JSON。LABを閉じた際のWorker終了も確認。[結果](line-ui-results-v060.json)
- 重量物：390px、弱い磁石で失敗→R201/R104/R110/R206へ構成変更→明示的再指示→回収成功。[結果](line-retry-ui-v060.json)
- 保存Phase 0：10,000履歴圧縮、進行中保存、最新緊急スナップショット、2タブ単一進行、所有権移動／再読込。[結果](save-phase0-v060.json)
- 24ゲーム時間：3分野、毎時再読込24回、9,150件、履歴200、キュー最大5、保存約144kBで安定。非表示進行なし、二重移行同一。キュー64件上限と出力満杯は別の自動テストでも確認。[結果](line-stress-v060.json)
- 本番Chrome/Edge：探索・回収・洗浄・保存復元・既存設備・本番ライン接続と整理成功。LINE/AUTOシナリオ・強制操作・比較Worker・デバッグ保存キーが本番バンドルにないことを検査。[結果](production-results-v060.json)
- 継続採取100シード×3分野×4構成の測定条件・結果は[LINE_BALANCE](LINE_BALANCE.md)。実際の人間のプレイ時間ではない。
- iPhone Safari実機は未確認。Chromiumのタッチ・縦画面による代替検証。

## 再実行

`npm.cmd test` / `npm.cmd run build` / `npm.cmd run balance:lines` / `npm.cmd run test:line-stress`。ブラウザ試験はlocalhost:5176で開発サーバーを起動し、`npm.cmd run test:line-browser` / `npm.cmd run test:automation-browser` / `npm.cmd run test:regression-browser` / `npm.cmd run test:save-browser`。`npm.cmd run test:production`はdistを独自のローカルサーバーで確認する。

---

# TEST_RESULTS — Version 0.5.0 / SEMI AUTOMATION

## 自動テスト

npm.cmd test：**282件成功、失敗0・スキップ0**。既存224件を維持し58件追加。購入/前提/4枠、予約/FIFO、物理量保存、出力満杯、停止/再指示、手動競合拒否、旧セーブ/破損参照拒否、二重処理/報酬防止、1/2/10倍、非表示時計、長時間、履歴上限を確認。

## ブラウザ

test:browser / depth-browser / reveal-browser / river-browser / gold-browser / beach-browser / field-browser がすべて成功。深層/探知機/ふるい/磁石/重量/パンニング/スルース/洗浄/図鑑/ジャックポット/FN/ショップ/保存を回帰確認。結果はregression-browser-results-v050.jsonと各v050記録。

test:automation-browser：320×568、390×844、1280×900。通常購入、一括投入、タッチ登録、途中停止/保存復元、分野移動、非表示停止、精密回収、8タブ/旧44＋新15シナリオ、Worker比較/中止/JSON保存、通常セーブ分離、横幅非超過。ブラウザエラー0。小型画面の通常HUDも1画面に収まります。

## 本番ビルド

npm.cmd run build：TypeScript/Vite成功。test:productionはChrome/Edgeで通常掘削/川底/河原/深層/新道具/設備購入/処理/洗浄/再読込を確認。DEVフック、隠し操作、強制FN/出現/設備シナリオ、時間倍率UI、比較Worker/開発セーブキーが本番アセットに含まれないことを確認。

## シード・長時間

100シード×3分野×5構成＝1,500処理試行、設備購入300試行。ジャックポット0、購入成功300/300、失敗以外の進行中作業の上限残り0。川底の能力不足対象は消さず残すため未処理数は0ではありません。

各分野8ゲーム時間、合計24時間、各16回保存復元。履歴100件以下、未受取/残渣保持、二重支払なし、非表示状態不変、復帰0秒加算。計算試験であり、人間が8時間操作した試験ではありません。[AUTOMATION_BALANCE](AUTOMATION_BALANCE.md)に詳細を記録。

## 未確認

実機iPhone Safariのタッチ/複数選択/Safe Area/バックグラウンド復帰/長時間メモリは未確認。Chromiumモバイル試験をSafari実機の合格とは扱いません。

---

以下は過去バージョンの記録です。

# TEST_RESULTS — Version 0.4.1 / RIVER & GOLD TOOL EXPANSION

## 自動テスト

npm.cmd test：**224件成功、失敗0、スキップ0**。既存182件を維持し、42件追加。既存のメタデータ確認はVersionと使用可能数を更新し、従来7+7道具の価格を引き続き個別確認しています。

新道具12件の通常購入・解放・価格・重複購入拒否、川底の距離/吸着/引上げ/障害物、観察後だけのC07と荷重保護、回収不能品の再挑戦・二重報酬防止を確認。河原は採取量、実装備による袋集約、固定個体の微細捕捉、精密操作削減、砂鉄だけの分離、鉄なしのC10無効、残渣・途中保存・不正値拒否を確認しました。

購入順の定義、全道具ルート、不要道具を省いた第5層目標、再現性・JSON、初期配置/通常状態の分離、未達理由を検証。計測上限を進行不能と断定せず、stalled:nullと理由を出します。最後に川底の主道具を4枠へ明示的に含め、400試行の時刻・収益が変わらないことも確認しました。

## ブラウザと本番

|試験|結果|
|---|---|
|test:field-browser|320×568 / 390×844 / 1280×900。川底/河原ショップ、回収アームの購入前後、カメラ観察と品質、実タッチ採取/多段ふるい、砂鉄分離、吸引セット一括回収と保存、44シナリオ/8タブ、12道具一括計測、Workerの2シード4ルート・JSON保存・中止・通常状態復帰|
|test:browser|同3画面。砂浜の掘削/タッチ/通知/購入/装備/図鑑/区画/保存/18000FN依頼|
|test:river-browser|同3画面。従来のつかむ/投擲/磁性/重量/滑車、46道具確認、LABと通常保存の分離、途中再開|
|test:gold-browser|同3画面。従来の採取/購入/装備/皿/虫眼鏡/吸引90FN/スルース10倍速/途中保存|
|test:beach-browser|同3画面。五層・同じ穴で420→600、深層保存/回収/洗浄、固定シード比較と出力|
|test:depth-browser|390px。従来80/180/280、素手の手応え、位置・保存・数値ラベルなし|
|test:reveal-browser|320/390px。洗浄演出/固定モーダル/中断/連打/スキップ/再読込/18000FN|
|test:production|Chrome/Edge。砂浜保存・第5層、従来川底/河原、新カメラ＋アーム110FN、砂鉄分離＋水流＋吸引90FN。強制API/起動操作/DEVコード/比較Worker/専用保存キーの成果物除外|

成功結果のpageerrorは全て空配列です。新しい吸引セットのUI接続漏れはブラウザ試験で検出して修正し、3画面で再実行しました。本番の初期素手から観察道具へ切り替える操作も確認しました。

画像はv041-*.png。結果はfield-ui-results-v041.json、ui-results-v041.json、river-ui-results-v041.json、gold-ui-results-v041.json、beach-ui-results-v041.json、depth-ui-results-v041.json、reveal-ui-results-v041.json、production-results-v041.json。購入表は内部で横スクロールし、通常操作を背後へ伝えません。

## バランスとビルド

4ルート×3必須目標×100シード＋川底/河原全購入各100シード、合計1400試行を実行。全到達、計測上限0、J0。12道具の同一条件前後と、各分野の安価な構成の利点を検証。従来の3分野収益も100シードずつで前版同値です。[BALANCE](BALANCE.md)、[PURCHASE_ROUTE_ANALYSIS](PURCHASE_ROUTE_ANALYSIS.md)を参照してください。

TypeScript＋Vite productionビルド成功。24モジュール、JS約122.16kB（gzip46.96kB）、CSS15.80kB。開発モジュールとWorkerの不要コードを成果物から除去しました。

## 未確認・既知の制限

**iPhone Safari実機は未確認です。** Chromiumの実タッチはSafari実機の代用ではありません。Safe Area、長押し/拡大、内部スクロール、Workerの中止、バックグラウンド保存を実機で確認してください。

購入ルートは定義した4候補の比較で、全購入順の最適解を証明しません。照準・移動・操作時間はモデル化しており、人間の所要時間を保証しません。長時間の大量砂利・履歴・比較JSONの容量確認と、本格半自動化は次版へ引き継ぎます。

commit・push・GitHub Pages公開なし。

---

# TEST_RESULTS — Version 0.4.0 / BEACH TOOL EXPANSION

## 自動テスト

npm.cmd test：**182件成功、失敗0、スキップ0**。既存136件を維持し、46件を追加しました。15道具の通常購入・未解放と重複購入拒否、五層の上限、同じ穴の持替え、深層回収と二重報酬防止、旧区画維持・新規区画・保存復元、五層の色と壁、C02/C03/C04、網目、補助装備、ショップ、固定比較とシナリオ切替を確認しています。

旧v2のmaskは変換せず、深度・FN・道具・図鑑・荷物・砂/砂利・途中状態を維持。未知の深層形式と範囲外の値を拒否します。河原の途中状態から砂浜シナリオへ切り替えた際の孤立データ防止も確認しました。

## ブラウザ

|試験|結果|
|---|---|
|test:beach-browser|320×568、390×844、1280×900。分類・8件表示・購入・未実装購入拒否、実タッチ420→600、深層保存/再読込、回収洗浄、固定シード比較とJSON保存、通常セーブ分離。8タブ/32シナリオ|
|test:browser|同3画面。既存砂浜の掘削、6道具カーソル、実タッチ、通知非干渉、ショップ/装備/図鑑、区画、保存、18000FNジャックポット|
|test:depth-browser|390px。同じ穴で80/180/280、旧深度の保存、素手の手応え、数値ラベルなし|
|test:reveal-browser|320/390px。洗浄演出・固定モーダル・背景操作防止・中断/連打/スキップ/再読込・18000FN依頼|
|test:river-browser|同3画面。つかむ/投擲/磁性/重量/滑車、購入/装備、途中保存、LABの初期化/復帰と通常状態分離|
|test:gold-browser|同3画面。採取、購入/装備、実タッチの皿、途中保存、虫眼鏡、吸引90FN、スルース10倍速、保存分離|
|test:production|Chrome/Edge。砂浜・川底・河原の通常処理、第5層への掘削/保存/再読込/回収/洗浄、強制API不在、隠し操作無効、開発比較/生成/シナリオ/専用保存キーの成果物除外|

全ての成功結果でpageerrorは空配列。開発中のソース書換えによるVite再読込で中断した回は成功集計に含めず、ソース確定後に再実行しました。河原の時限スルース試験も再確認しています。

結果JSONはbeach-ui-results-v040、ui-results-v040、depth-ui-results-v040、reveal-ui-results-v040、river-ui-results-v040、gold-ui-results-v040、production-results-v040。画像はv040-*.png。ショップと第5層を目視し、水平投影、内部スクロール、暗い穴、通知と下部操作の非干渉を確認しました。

## ビルドと模擬プレイ

npm.cmd run build：TypeScript＋Vite production成功、22モジュール。JS約113.24kB（gzip43.84kB）、CSS15.80kB。DEVモジュールは成果物の依存から除去されています。

100シードの通常進行と4条件×8構成×100シードの比較を実施。既存砂浜・川底・河原の収益回帰も100シードずつ実行。方法・到達時間・購入達成率・使用回数・体力は [BALANCE](BALANCE.md) とbeach-balance-v040.jsonを参照してください。126道具の調査はtool-master-audit-v040.json。

## 未確認・制限

**iPhone Safari実機は未確認です。** Chromiumの実タッチイベントはSafari実機の代用ではありません。Safe Area、長押し/拡大抑制、選択パネルとキーボード、背景復帰と保存容量を実機で確認してください。人間の購入順・操作テンポ・長時間メモリの確認は次版へ引き継ぎます。

深掘り装置は手動のみ。B302のマスター価格39000FNは維持しているため、全道具を先に買う場合は第5層への投資が遅くなります。比較ボットのFN/分を人間の収益保証には使いません。commit・push・GitHub Pages公開なし。

---

# TEST_RESULTS — Version 0.3.0 / GOLD PANNING

## 自動テスト

npm.cmd test：**136件成功、失敗0、スキップ0**。砂浜64件・川底/DEBUG35件の既存99件を維持し、河原32件・DEBUG拡張5件を追加しました。将来エリアを確認する既存R18は、実装済みG-Aを未実装対象から外しG-C/G-Dを確認しています。

河原の解放、素手とスコップ、7道具、粒径/比重選別、C09、残渣・二重報酬防止、満杯保管、途中保存・旧v2移行、カテゴリ別装備、固定シード、将来品除外、12シナリオ、ID指定生成、工程計測、時間加速を確認しました。最後の保存範囲検証と手選別の処理完了判定を含めて再実行しています。

## ブラウザ検証

|コマンド|結果|
|---|---|
|test:gold-browser|320×568 / 390×844 / 1280×900。素手採取、ショップ、装備、実タッチのパンニング、途中保存、虫眼鏡、吸引と90FN、スルース、10倍速、8タブ、通常保存の分離、はみ出しなし|
|test:browser|同3画面。砂浜の掘削・タッチ道具・上部通知・購入・図鑑・区画・保存・ジャックポット成功|
|test:depth-browser|同じ穴で80→180→280、道具上限・保存・手応えを維持|
|test:reveal-browser|320/390px。固定モーダル、洗浄中断・スキップ・連打・再読込、18000FN依頼を維持|
|test:river-browser|同3画面。つかむ・実タッチ投擲・重量物・滑車、通常セーブの退避/復元・リセット・再読込を維持|
|test:production|Chrome/Edge。砂浜保存・川底回収洗浄・河原採取/皿/精密回収/洗浄成功。隠し操作無効、強制APIなし、LABのJS/CSS/生成操作/専用保存キーの成果物混入なし|
|build|TypeScript検証とVite productionビルド成功。20モジュール、JS約104.89kB（gzip約40.50kB）、CSS約15.41kB|

各ブラウザ結果のpageerrorは空配列です。河原画像を目視し、砂利の斜め見下ろし、皿の残砂、虫眼鏡ヒント、320pxでの内部スクロールを確認しました。

結果JSON：gold-ui-results-v030、ui-results-v030、depth-ui-results-v030、reveal-ui-results-v030、river-ui-results-v030、production-results-v030。画像は同フォルダのv030-*.pngです。手順と道具は [GOLD_PANNING](GOLD_PANNING.md)。

## 模擬プレイ

河原100シード、装備8構成×同じ100シード、砂浜100シード、川底100シードと持込資金・装備比較を実行。河原7道具の購入到達、進行停止0、J0。[BALANCE](BALANCE.md)に条件と実測値を記載しました。

## 未確認と制限

**iPhone Safari実機は未確認です。** Chromiumの実タッチイベント試験はSafari実機確認の代用ではありません。Safe Area、長押し/拡大、指操作とスクロール、LAB内キーボード、バックグラウンド復帰を実機で確認してください。長期・大量残渣の実機メモリ試験と、人間による購入テンポ計測は次版へ引き継ぎます。

commit・push・GitHub Pages公開は行っていません。

---

# TEST_RESULTS — Version 0.2.0 / RIVER RECOVERY & DEBUG LAB

## 自動テスト

`npm.cmd test`：**99件成功、失敗0**。砂浜の既存64件を維持し、川底25件、DEBUG操作・再現性・保存保護10件を追加しました。磁性・距離・吸着・引き上げの個別判定、7道具、C05/C06の装備条件、重量不足後の同一個体再挑戦、品質・報酬、二重回収防止、引き寄せ途中の保存復元、区画切替の荷物維持を確認しています。

## ブラウザと本番

|コマンド|結果|
|---|---|
|`npm.cmd run test:browser`|320×568、390×844、1280×900。砂浜操作、カーソル、実タッチ、通知、ショップ、図鑑、区画、保存、ジャックポット成功|
|`npm.cmd run test:depth-browser`|390×844。同じ穴を80→180→280、色、手応え、保存、深い品の回収成功|
|`npm.cmd run test:reveal-browser`|320／390。洗浄とスキップ、連打、モーダル固定、背景遮断、閉じる・再読込成功|
|`npm.cmd run test:river-browser`|3サイズ。通常のR-A初回素手、ドラッグ・洗浄、7タブ、全実装道具付与、磁性指定生成、実タッチで投擲・引き上げ、滑車重量物、通常セーブ分離・復元・初期化・途中再開成功|
|`npm.cmd run test:production`|Chrome／Edge。通常セーブ、砂浜掘削・再読込、川底回収・洗浄成功。隠し操作を5回タップしてもLABなし。window.__findersなし。開発JS／CSS・FN強制操作・生成・専用保存キーの成果物除外成功|
|`npm.cmd run build`|TypeScript検証＋Vite productionビルド成功|

保存分離は通常セーブのFNと区画内容をLAB操作の前後で比較し、テスト初期化後にも通常状態が維持されることを確認しています。通常プレイで回収途中にLABへ出入りした場合、および再読込した場合も対象IDと進捗を保持します。

結果：`ui-results-v020.json`、`depth-ui-results-v020.json`、`reveal-ui-results-v020.json`、`river-ui-results-v020.json`、`production-results-v020.json`。画像：`v020-river-*`、`v020-debug-lab-*`、`v020-production-river-*`。

## バランス

川底FN0開始100シード、砂浜資金1000FN持込み100シード、装備8構成×同じ100シード、砂浜回帰100シード。進行停止0・ジャックポット0。方法と数値は [BALANCE](BALANCE.md)、`river-balance-v020.json`、`balance-results-v020.json`。

## 未確認

**iPhone Safari実機は未確認**です。Chromeの実タッチイベントはSafari実機試験の代用ではありません。Safe Area、キーボードとLABスクロール、長押し・ダブルタップ、バックグラウンド保存を実機で確認してください。

---

# TEST_RESULTS — Version 0.1.3 / TOOL VALUE & REVEAL UX

## 自動テスト

`npm.cmd test`：**64件成功、失敗0**。既存41ケースを維持し、量単位の選別・品質評価の新仕様に関連する期待値を更新。追加23ケースで以下を確認。

- 金属／非金属、距離と反応、粗い地点の一致、深さ・サイズの特徴、強い安価品。
- 再走査で個体・品質・配置の再抽選なし。跡は道具使用と保存を跨いで残り、同じ個体の反応は重複表示しない。
- 事前探知で大型損耗8%→2%、小型なら0%。初期の傷・露出後の損傷は回復しない。補正は一度のみ。
- 品質を評価に反映し、時計の固定報酬18000 FNと二重報酬防止を維持。
- 手選別3単位・体力6、購入後のふるい15単位・体力4。残渣、小物、手選別だけの完了、区画持越し、満杯保管、砂0、複数バッチのまとめ処理。
- 旧v2の未洗浄品・未処理砂・品質を保持。記録不足を予測値で補わない。

## 洗浄の実ブラウザ試験

`npm.cmd run test:reveal-browser`：320px・390px幅のChromeで成功。

未洗浄の仮名と情報隠蔽、約450ms時点の汚れ透明度約0.65、完了後の名称・品質・評価・報酬を確認。洗浄前後でモーダル・お宝領域・主要ボタンのx/y/幅/高さの差が1px未満。背景のドラッグは掘削に影響しない。

洗う連打、スキップ連打、閉じる、洗浄中の再読込、次の品への遷移で重複報酬なし。洗うとスキップは同一品質・評価・報酬。時計依頼18000 FNも確認。

`reveal-ui-results-v013.json`。画像は `v013-wash-before-390.png`, `v013-wash-during-390.png`, `v013-wash-after-390.png`（320px版も保存）。画像を視認し、汚れが薄くなり同じ位置へメダルが現れることを確認した。

## 第3層の実ブラウザ試験

`npm.cmd run test:depth-browser`：390×844で同じ穴をクイック装備ボタンで持替え、実マウスで掘削。80→180→280、各段階の保存再読込、深度245の品の露出・回収・洗浄120 FNを確認。床画素は(215,179,119)→(164,119,72)→(100,66,43)。深度280を超えず、通常UIの深度数値なし。

`depth-ui-results-v013.json`と`v013-depth-*.png`。

## 既存UI・本番

`npm.cmd run test:browser`：320×568、390×844、1280×900のChromeで、掘削・回収・洗浄・ショップ・装備・図鑑／収益・通知の非重複・6道具カーソル・タッチ追従とキャンセル・区画移動・保存復元・ジャックポット・IndexedDB障害時のバックアップが成功。はみ出し・実行例外なし。

`npm.cmd run build`：TypeScriptとVite成功。`node scripts/production-test.mjs`：Chrome・Edgeで本番distの掘削・保存再読込と開発機能の除外を確認。`production-results-v013.json`。

## 100シードの進行と道具比較

通常進行：初発見0.8秒、小型75.1秒、ふるい626.7秒、探知機1720.1秒、通常451.8 FN/分。大当たり0、進行不能0/100。前版と大きな差はなく、価格・報酬の調整なし。理想操作ボットの時間で、人間の実プレイ時間ではない。

道具比較：未探知296.11掘削対探知43.82掘削（探知は別途63走査）。保持品質92%対97.33%。約6個の回収が目標。平均評価は502.07対506.85 FNだが、回収した個体が異なるため品質効果だけを示すものではない。

同じ150単位・6個体の砂は手選別51作業／所要体力306、ふるい10作業／所要体力40。両方で同じ個体を回収。自然生成100シードでは時計4個。`balance-results-v013.json`, `balance-comparison-v013.json`, `tool-comparison-v013.json`。

## 改行・未確認事項

対象ゲーム内の`.gitattributes`・`.editorconfig`を追加。編集対象テキストはCRLF、ビルド出力はLFとし、無関係な既存ゲームは変換しない。

Safari実機／WebKitは未確認。Chromeのモバイル幅や実タッチイベントは実機Safariの代わりにならない。長時間の容量・描画速度・OS強制終了は網羅していない。保存互換はテストデータで確認し、ユーザーの実セーブは提供されていない。

ローカル実装・検証のみ。Gitのcommit・push・公開は行っていない。旧版の末尾v012以前の結果は履歴として保持。
