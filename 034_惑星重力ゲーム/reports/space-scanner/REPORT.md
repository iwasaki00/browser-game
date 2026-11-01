# ORBIT MAKER v1.9.4 — SPACE SCANNER

## 1. Version

v1.9.4のローカル実装。公開・Git push・デプロイは行わない。iPhone Safari実機は未確認。PCブラウザと自動試験の結果を以下に区別する。

## 2. 変更ファイル

- `js/space-scanner.js`：読み取り専用カタログ、操作権限、検索、フィルター、方向・矢印配置、表示専用カメラ補間。
- `js/space-scanner-ui.js`：SCAN、情報パネル、惑星サーチ、リング、矢印、軽量レーダー演出。
- `js/game.js`：既存ループ・入力との接続。実ドラッグ・削除UIで共通権限を使用。物理エンジンの式は変更しない。
- `index.html`、`package.json`、`styles.css`、`README.md`：バージョン、オーバーレイ、案内。
- `tests/space-scanner.test.mjs`：24件のモデル・非干渉・回帰テスト。
- `tests/space-scanner-ui.mjs`、`space-scanner-modes.mjs`、`space-scanner-capture.mjs`：Chrome CDPタッチ・全モード・実時間性能・画像。
- `tests/qa-all.mjs`：過去資料を上書きしないspace-scanner出力先。
- `reports/space-scanner/`：仕様、検証原データ、画面、実機確認表。

## 3. SPACE SCAN

盤面右上のSCANで開始。盤面の高さ・下部発射領域を変えず、既知対象の種類・操作可否・状態・短い説明を表示する。明るい実線＋✥は操作可能、破線＋ロック等は位置操作不可。SCAN終了で情報を閉じる。

最初の約0.8秒だけ波を描く。軽量演出では波を省略し、機能は維持する。6フィルターはすべて／操作可能／惑星／探索対象／危険領域／目的地。表示の絞り込みで物理対象や重力を消さない。対象カタログは最大4Hz、毎フレームは既存対象の位置と画面上の描画だけを更新する。

## 4. 惑星サーチ

SCAN→惑星を探す。現在のカメラ中心からの距離順で配置済み惑星を検索し、名前・種類・8方位・距離・操作内容を表示。前／次で循環する。編集権限がない対象は含めない。対象なしの場合は理由とRESET・モード確認の案内を表示。

発射前は許可範囲内で移動可。軌道設計の飛行中は不可、重力操作の飛行中は移動可。終了後はRESETまで不可。`fixedPlanets`は種類・数固定であり、移動禁止ではない。狭い配置範囲や固定天体も判定する。検索と実ドラッグは同じ`planetPermissions`を使用する。

## 5. 天体情報

通常の天体タップ、SCANのマーカー、対象一覧から、名前／種類／状態／重力・危険特性／操作説明／調査方法／目的地設定可否を表示する。通常の惑星選択・ドラッグ・スリングショット・パン／ピンチを維持する。

未知情報は既存`targetAvailable`・`deepAvailable`と名称関数を利用して制限。UNKNOWN目的地は列挙しない。DETECTEDは未解析ID、INVESTIGATEDで既知情報を開示。追加信号と時空異常は既存CLUE条件を満たすまで表示しない。物理的な危険天体は隠さない。新たな発見やCLUEをスキャン操作だけで付与しない。

## 6. 方向矢印

画面外対象に、8方向の文字・矢印・種類・名前またはID・距離を表示。タップで情報対象を選択し、惑星なら既存の選択状態にも反映。「表示」で視点移動へ進める。

選択中の対象を優先し、矩形衝突を避ける。目的地・速度・選択・通知・カメラ操作の領域も避ける。最大6件で、空間が少ない場合はさらに減らす。省略された対象も一覧から全件選択できる。遠すぎて未知の対象を新たに露出させることはない。

## 7. カメラ移動・復元

「表示」で約300msの補間。中心・倍率のみを変更し、ロケットや時間・速度・惑星位置・保存航行状態を書き換えない。飛行中は通常の物理ステップによる航行が続く。

最初の検索前の中心・倍率を保持する。「視点を戻す」またはスキャン終了で復元し、FIXEDになる。FOLLOW／CINEMATICは従来のカメラ選択から再開できる。手動パン・ピンチ・ズーム・UI入力で自動移動を中断し、ステージ変更時は旧ワールドへの移動を破棄する。

## 8. モード別確認

CLASSIC19、FREE SPACEのHUGE配置、HOMEWARD02、DEEP SPACE、FINAL VOYAGEを隔離ブラウザで検証。前後切替、編集説明、表示、手動中断、復元、マーカー選択、保存情報の不変性を確認する。解放済みの試験fixtureを使う場合も、ユーザーの進行を書き換えない。

軌道設計飛行中の検索ゼロと、重力操作飛行中の移動可・削除不可も確認。未調査のDEEP対象の正式名称はUIへ出さず、軽量演出でも検索を利用できる。[モード・性能原データ](modes-performance.json)／[追加ブラウザ結果](additional-browser.json)。

## 9. 性能・飛行一致

測定はPC Windows Chrome、375×667、DPR3。rAF回数、renderer TaskDuration、GC後のJSヒープを採取する。iPhoneのFPS・発熱・GPUメモリを表さない。比較数値は以下の実測表を参照。

<!-- PERFORMANCE -->
Environment: win32 / 13th Gen Intel(R) Core(TM) i7-1355U / Chrome 156.0.8078.76 / 375x667 DPR3.

|Condition|Wall seconds|FPS|Renderer task %|GC-sampled JS heap MiB (start -> end)|
|---|---:|---:|---:|---|
|SCAN OFF (overview)|10.132|56.26|95.02|19.67 -> 17.40|
|SCAN ON (overview)|10.126|52.83|97.35|18.72 -> 18.25|

- SCAN ON / 100x: 2.850 wall seconds, 38.25 FPS, CLEAR at 57.108333333 simulation seconds, 1144 recorded frames.
- SCAN OFF / 100x: 2.773 wall seconds, 41.83 FPS, CLEAR at 57.108333333 simulation seconds, 1144 recorded frames.

Reference before DOM throttling: OFF 29.27 FPS / ON 23.93 FPS. Each is a short PC sample; load and GC variation are included.
<!-- /PERFORMANCE -->

同じ開始セーブfixture・ANGLE −37.69°／THRUST 220で実際に100倍航行し、SCAN ON／OFFの終端、航行時間、保存した全座標列を比較する。寄港後のチェックポイントを比較元にせず、各試行の前に隔離コンテキスト内で同一の開始状態を読み直す。途中で位置を補正しない。

ヒープの短時間測定には割当・GCの変動がある。数時間のメモリ安定性やiPhoneの発熱は未確認。高負荷の全景・100倍航行は最終受入で軽量演出と併せて確認する。

## 10. 全自動試験・保存互換性

既存405件＋追加24件＝**全429件**を対象に実行。原結果は [all-final.json](all-final.json) と [all-final.txt](all-final.txt)。初回の426件結果も [all-initial.json](all-initial.json) に保持。追加されたゴール権限・レーダー時刻・選択中矢印の回帰を含む。

重力・接触・固定刻み・1／100倍・予測と実飛行・既存代表航路・20ステージ・5結末・旧セーブ・記録保護の既存回帰を維持する。スキャンを読み取るだけの処理とカメラ操作を挟んだ物理試験でも終端一致を確認する。

新しい保存キー・IndexedDBスキーマは追加しない。旧HOMEWARD v1、CLASSIC進行、古いお気に入り、保護記録を投入した隔離ブラウザで、閲覧・検索・移動・復元・RESET後に保存内容の原文一致を確認。明示的に目的地を設定した場合だけ既存の変更処理を利用する。ユーザーのセーブは消去・初期化しない。

## 11. PCブラウザ・画像

320×568、375×667、390×844、430×932と、それぞれの横画面を確認。縦は上59／下34px、横は左右59／下21pxの安全領域をChromeへ注入。実ノッチやSafariバーの再現ではない。盤面サイズ不変、パネル内スクロール、タップ・パン・ピンチ、発射、RESET、主要操作と表示の境界を確認する。[browser.json](browser.json)。

画像：[通常320](normal-320.png)／[SCAN 320](scan-panel-320.png)／[横320](scan-landscape-320.png)／[SCAN 390](scan-panel-390.png)／[DEEPの方向矢印](deep-arrows.png)。各モードの画像は`mode-*.png`。

再実行：

```powershell
npm test
node tests/space-scanner-ui.mjs
node tests/space-scanner-capture.mjs
node tests/space-scanner-modes.mjs
```

Chromeと既存019_bomber-lab内Playwrightを使用する。ブラウザ試験はNode429件と別集計し、水増ししない。実時間性能の採取時には他の検証を同時に実行しない。

## 12. iPhone実機未確認

[実機確認表](IPHONE_CHECKLIST.md) の全項目は未確認。操作感、実ノッチ・安全領域、Safariバー、誤タップ、長押し・ダブルタップ、100倍中の応答、熱・処理落ちはPC成功から合格にしない。

## 13. 不具合・残課題

実時間で検出した負のレーダー半径による停止を修正し、回帰を追加した。初期の目的地分類と広域FREEゴールの誤った固定説明も修正。[BUGS.md](BUGS.md)。最終試験の未解決Critical／Highは検証範囲内で0件を条件とする。

矢印は密集時に件数を制限するため、全対象の同時吹き出し表示は行わない。長い情報はパネル内部でスクロールする。短時間測定を超えるメモリ耐久と実機での見やすさは受入課題として残す。

## 14. v2.0.0への引継ぎ

SCANのSC-01〜08と既存IP-01〜14をまとめて実機受入する。新しいCritical／Highがあれば完成版扱いせず修正する。既存進行を消して試験しない。公開は別の明示承認まで行わない。詳細設計は [SPEC.md](SPEC.md)。
