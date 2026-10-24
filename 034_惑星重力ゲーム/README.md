# ORBIT MAKER（オービットメーカー）

Version 0.9.1 — MOBILE UI & AUDIO FIX

「表示・音」「惑星編集」をオーバーレイへ変更しました。開閉で盤面や発射操作を押し下げず、設定中は飛行を一時停止し、閉じると同じ状態から再開します。
サウンドON時の確認音、実際の合成音経路を使う「テスト音を鳴らす」、開始・中断・再開の診断情報を追加しました。音の初期値はOFFです。
修正前後の画面、原因候補、関連テスト、iPhone再確認手順は [v0.9.1検証レポート](reports/mobile-ui-audio/VERIFICATION.md) を参照してください。PC検証では実機の聴感を合格と扱いません。公開・pushは未実施です。

以下は過去Versionの監査記録です。

正式完成前の品質監査版です。新しいゲーム機能・物理・ステージ・保存形式の変更はありません。
PC検証とiPhone実機検証を区別した [品質監査レポート](reports/quality-audit/AUDIT.md) と、利用者が記入できる [iPhone実機試験書](reports/quality-audit/IPHONE_CHECKLIST.md) を参照してください。今回は公開しません。

v0.9.0-Bは実機受入の準備作業です。[公開状態の調査結果](reports/acceptance-preparation/PREPARATION_REPORT.md) と [iPhoneでの起動・簡易チェック表](reports/acceptance-preparation/IPHONE_QUICK_CHECK.md) を追加しました。準備時点のゲーム本体はv0.9.0-Aです。

以下はv0.8.0までに実装した機能の説明です。

発射の噴射・粒子、接近時に明るくなる航跡、スイングバイ、特殊惑星の波紋・発光、CLEARと失敗理由別の演出を追加しました。
ブラックホール吸収域・恒星熱領域をぎりぎりで安全に抜けると「CLOSE CALL」を表示します。星評価・難易度への影響はありません。
「表示設定」で演出品質（標準／軽量）とサウンドを変更できます。音は初期OFFで、ONを保存した場合も再読み込み後のユーザー操作を待って開始します。
物理・ステージ・予測・ギャラリー・画像保存のデータ形式は変更していません。
演出一覧、関連テスト、iPhone実機チェックと引き継ぎは [reports/space-experience/VERIFICATION.md](reports/space-experience/VERIFICATION.md) を参照してください。

軌道ギャラリーの詳細から「画像作成」を選ぶと、保存済みの座標を宇宙アートへ再描画します。
構図プレビューで正方形／縦長、文字ON/OFF、宇宙／シンプル背景を選び、1080×1080または1080×1920のPNGを生成できます。
画像保存、Web Share APIでの共有、画像を開いて保存する代替手段に対応。画像の外部自動アップロードや記録の更新は行いません。
仕様・実出力・検証と実機チェックは [reports/orbit-share/VERIFICATION.md](reports/orbit-share/VERIFICATION.md) を参照してください。

発射から終了までのロケット・惑星位置を記録し、IndexedDBへ自動保存します。画面右上の「軌道一覧」から鑑賞できます。
自動保存は直近20件、お気に入りは最大30件。お気に入りは自動削除しません。不要な記録は一覧から個別削除できます。
再生・一時停止・最初から、0.5/1/2/4倍、軌道全体表示に対応。再生は記録データだけを使い、物理計算をやり直しません。
RESET中断も失敗記録として保存します。保存できない環境でもゲームは継続できます。
記録構造・容量対策・検証・iPhone実機チェックは [reports/gallery/VERIFICATION.md](reports/gallery/VERIFICATION.md) を参照してください。

特殊惑星のStage11〜20を追加しました。Stage10のクリアで11が解放され、以降順に20まで解放します。
旧01〜10の星と解放・モード別最高星を維持し、保存形式は同じです。
新ステージは惑星の種類・サイズ・個数を固定し、初期位置から各軸±12の範囲で配置・移動できます。
発射角度と推力にもステージ別の制限があり、精密・スリングショット両方に適用します。制限は惑星編集内に表示します。
全10ステージに両モード・両発射方式で到達する★3解答があります。配置・発射・最接近・特殊惑星の寄与と検証結果は [reports/special-challenges/VERIFICATION.md](reports/special-challenges/VERIFICATION.md) を参照。
375pxのChrome画面サイズ再現でUI・RESET・旧セーブを確認しました。iPhone実機Safariは未確認です。

フリープレイでブラックホール・反重力惑星・恒星・高密度惑星が使えるようになりました。惑星編集から全7種類と特徴文を確認できます。
「体験配置」から4種類のサンプルを読み込めます。RESETでサンプル配置へ戻り、ステージ進行は変化しません。
Stage01〜10のデータ・通常惑星の挙動は維持しています。
設定値と検証・実機チェック項目は [reports/special/VERIFICATION.md](reports/special/VERIFICATION.md)。

03は導入の許容幅を拡大、06〜10はゲート幅、09〜10は第3惑星の位置を調整しました。05以降を中心に★3時間を見直しています。
分析手法・ステージ別比較・重力操作別解は [reports/balance/BALANCE.md](reports/balance/BALANCE.md)、最高評価解答は [reports/balance/THREE_STARS.md](reports/balance/THREE_STARS.md)。
ステージIDと保存形式は変更せず、過去の星・解放を維持します。新しい条件は今後のプレイに適用します。

ミッション横の「遊び方」からステージ攻略01〜10とフリープレイを選択します。
初期解放は01のみ。どちらかのゲームモードでクリアすると次が解放され、最高星は軌道設計・重力操作で別々に保存します。
★1は到達、★2・★3はステージ別の時間以内（重力操作の★3では総移動30以内も必要）。各ステージのratingに条件を定義しています。
ステージの種類・サイズ・個数・配置範囲制約は編集と飛行中移動に適用します。
攻略RESETはステージの初期惑星配置へ戻し、ANGLE・THRUSTは維持します。フリープレイのRESETは従来どおりです。
ステージデータ・解答はjs/challenges.js、保存と評価はjs/progress.js。
全10ステージの到達結果は [reports/stages/VERIFICATION.md](reports/stages/VERIFICATION.md) を参照してください。

惑星編集と表示設定を折りたたみにし、狭い画面では設定欄だけ上下スクロールできます。発射・RESETは常に下部です。
ボタン・selectは高さ44px以上、盤面のタッチ判定は最低44px直径に調整しました。
4サイズのChrome表示・タッチ入力再現結果と、未実施のiPhone実機チェックは [reports/mobile/CHECK.md](reports/mobile/CHECK.md) を参照してください。

MODEから「軌道設計」「重力操作」を選択します。発射前のみ変更でき、選択は保存されます。
重力操作では飛行中の惑星ドラッグ位置へ毎秒90ワールド単位までで移動します。指を離す・キャンセルすると停止します。
目標は黄色の円と線で表示します。禁止領域を横切る経路は手前で停止します。
`js/live-gravity.js` のLIVE_GRAVITY.maxSpeedが速度設定です。各1/120秒ステップで惑星を更新後、既存物理を呼びます。
RESETは発射直前の惑星配置・種類・サイズを復元します。発射前で履歴がない場合は従来のステージ初期化です。
飛行中の予測計算・描画は両モードで停止し、予測設定は発射前用として維持します。

発射前は水色の点線で予想軌道を表示します。到達予測は緑、衝突終端は赤い×です。
精密設定を通常の予測に使用し、スリングショットを引いている間はその初速へ切り替えます。キャンセルすると通常へ戻ります。
予測ON/OFFは保存され、OFFでは計算しません。実飛行中と結果表示中も計算・描画を停止します。
予測は `js/preview.js` から既存のcreateSimulation/stepSimulationを1/120秒刻みで呼びます。
最大1441ステップ（既存の飛行時間上限12秒）、1フレーム最大160ステップ・約2ms、描画は4点ごとです。
入力のスナップショットが変われば古い計算を破棄します。逸脱軌道の描画はワールド境界でクリップします。
重力目安は初期OFF。選択惑星単独の加速度から青〜黄〜赤の放射グラデーションを作ります。合成重力や厳密な等重力線ではありません。

惑星は0〜3個配置できます。惑星をタップして選択し、追加・削除・種類・サイズを編集します。
重なり、発射地点周辺28単位、ゴール周辺12単位、画面外への配置を禁止します。拡大できない場合は移動後に変更してください。
種類の基準値（半径 / 質量）は小惑星22 / 1800、地球型38 / 5200、巨大ガス48 / 8000。
サイズ倍率（半径 / 質量）は小0.8 / 0.7、中1 / 1、大1.2 / 1.3。最大質量は10400です。
設定と配置制約は `js/planets.js` に分離しています。RESETは既存ステージの惑星1個へ戻し、再試行は編集配置を維持します。

発射方式は「精密発射」と「スリングショット」から選択できます。選択はlocalStorageに保存します。
精密発射は従来のANGLE・THRUSTとLAUNCHを使用します。
スリングショットではロケットの円内から引いて離すと反対方向へ発射します。14ワールド単位以内へ戻すとキャンセルし、速度は120〜220です。
RESETは配置と精密設定を初期化し、再試行は配置を保ちます。選択した発射方式はどちらでも維持します。
複数指、Pointer Cancel、フォーカス喪失では発射をキャンセルします。
`js/launch.js` は発射変換とモード保存を担当し、共通の初期速度ベクトルを物理層・将来の軌道予測で使用できます。

惑星をドラッグして重力場を調整し、ロケットを緑のゲートへ導く2D物理パズルです。依存パッケージや外部サービスはありません。

## 起動

ES Modulesを使用するため、ローカルHTTPサーバーから開きます。

```powershell
cd C:\_wk\github\browser-game\034_惑星重力ゲーム
py -3 -m http.server 8034
```

ブラウザで `http://localhost:8034/` を開いてください。

## テスト

v0.9.1のUI・音声に関連する範囲だけを確認する場合：

```powershell
node --test tests/mobile-audio.test.mjs tests/space-experience.test.mjs tests/launch.test.mjs
node tests/mobile-ui-audio-ui.mjs
```

ブラウザ確認は独立したChrome contextを使用します。既存のiPhone・通常ブラウザの保存データには接続しません。

v0.9.0-Aの監査（既存証拠の検証と、不足していた画面・性能・継続確認）：

```powershell
node tests/quality-audit.mjs
node --test --test-name-pattern='同じ初期条件では同じ軌道になる' tests/physics.test.mjs
node tests/quality-audit-ui.mjs
```

結果は `reports/quality-audit/` に出力します。監査は独立ブラウザ環境を使い、利用者の保存データへ接続しません。

v0.8.0の関連テストを再実行する場合：

```powershell
cd C:\_wk\github\browser-game\034_惑星重力ゲーム
node --test tests/space-experience.test.mjs tests/launch.test.mjs
node tests/space-experience-ui.mjs
```

上記はv0.8.0の関連範囲のみ。UI確認スクリプトは既存の019_bomber-lab内のPlaywrightとインストール済みChromeを使用します。ゲーム本体には依存パッケージは不要です。

## 構成

- `js/physics.js`: DOMに依存しない重力計算、Velocity Verlet積分、連続衝突判定、軌道シミュレーション
- `js/stages.js`: ステージデータ
- `js/game.js`: 入力、ゲーム状態、Canvas描画
- `tests/physics.test.mjs`: Gravity Coreに関係する物理・判定テスト
