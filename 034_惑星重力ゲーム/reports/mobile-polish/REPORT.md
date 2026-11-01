# ORBIT MAKER v1.9.3 — MOBILE POLISH

## Versionと検証の区別

v1.9.3のローカル実装。PC Windows Chromeによる画面・CDPタッチ・Web Audio・PNG・性能試験と、Node全405件を対象とした。iPhone Safari実機は未確認。公開・push・デプロイ、ユーザーの保存情報の消去は行っていない。

## 主要変更ファイル

|ファイル|変更|
|---|---|
|index.html / package.json|v1.9.3表示、メニューが飛行一時停止であることをアクセシブル名で明記、全件試験の出力先を分離|
|styles.css|動的ビューポートと安全領域、短い画面でメニュー44px、再生パネル内スクロール、速度セレクタ16px、Canvasの長押し抑止|
|js/game.js / js/gallery-ui.js|Canvasだけのcontextmenu抑止。設定を開くと既存の音声を停止し、操作中ジェスチャーを終了|
|tests/echoes.test.mjs|同一条件比較に試験用実時計を固定。物理エンジンや本番時計は変更しない|
|tests/qa-all.mjs / tests/orbit-share-ui.mjs|既存レポートを上書きしないmobile-polish出力先|
|tests/mobile-polish-*.mjs|画面・実CDPタッチ・ネイティブ音声・広域航行・保護再生・実時間性能の検証|
|reports/mobile-polish/|原測定JSON、画面キャプチャ、ログ、最終iPhone確認表|

## モバイルUI・画面比較

縦画面の盤面は縮小していない。短い画面だけメニューを38→44pxへ拡大し、盤面が6px小さくなる。詳細機能は従来のパネルに保持。再生画面は内容全体をパネル内部でスクロールでき、下端の操作を表示できる。

下表はCSSピクセル。Chromeで上59／下34pxの安全領域を注入した条件であり、実端末のノッチ測定値ではない。

|縦ビューポート|変更前→後の盤面|高さを80px縮めた場合の盤面（後）|横画面の盤面（後）|
|---|---|---|---|
|320×568|310×317 → 同じ|310×237|450×183（568×320）|
|375×667|365×416 → 同じ|365×336|549×238（667×375）|
|390×844|380×593 → 同じ|380×513|726×253（844×390）|
|430×932|420×681 → 同じ|420×601|814×293（932×430）|

横は左右59／下21pxを注入。全12条件で主要ボタンの安全領域内配置、44px以上の高さ、ヒットテスト、ページ全体のスクロールなしを確認。再生・速度・カメラ・全航跡・閉じる操作も内部スクロール後にヒット可能。Safariバーの伸縮そのものは再現していない。

変更前：[320横再生](before-320-landscape-gallery.png) → 変更後：[320横再生](after-320-landscape-gallery.png)。変更後の通常画面：[320縦](after-320-game.png)、[375縦](after-375-game.png)、[390縦](after-390-game.png)、[430縦](after-430-game.png)。全測定は [before.json](before.json) / [ui-results.json](ui-results.json)。

## タッチ・航行・再生

ブラウザのCDP Input.dispatchTouchEventを使用し、PointerEventのpointerType=touchと実クリック発生を確認。DOMの疑似pointerイベントだけで合格にしていない。惑星追加・選択・移動・削除、空白パン、ピンチ、2本指パン、ANGLE 0.01°／THRUST 1の微調整、スリングショット短距離キャンセル・Pointer Cancel・複数指キャンセル・発射、メニュー中一時停止、100倍、同条件再発射、RESETを4サイズで確認。

物理時間は操作試験で仮想時計を使い、実測性能では実時間を使った。ジェスチャー直後に指がボタンまで移動する350msの間隔を設けた。目的地変更後のボタン再描画に対応するため、試験のクリック観測はdocumentのcaptureで行う。削除済みDOMを比較して失敗する試験方式を修正し、本番操作を強制成功させていない。

DEEP SPACEの専用試験もPASS。未知対象の名前を伏せた目的地表示、100倍設定中の目的地変更、DS01への実航行・寄港、再読み込み後の寄港点復元、帰還CLEAR、FOLLOWの手動解除・復帰を確認。保護記録のCINEMATIC再生・停止・再開・4倍・位置変更・最初から・手動パン・CINEMATIC復帰・画面回転・終了・閉じる・再読み込みと、再生による保護記録の不変性を確認した。[navigation-results.json](navigation-results.json)。未解放領域の試験準備は隔離ブラウザ内のfixtureに限定し、ユーザーの進行には適用しない。

## 長距離航行・CINEMATIC性能

Windows 10.0.26300、Core i7-1355U、RAM約16GB、headless Chrome 156、375×667、DPR3。rAFスケジュール回数からFPS、CDP TaskDurationからrenderer task占有比、強制GC後のJSヒープを測定。GPUメモリ・OS全体のCPU率・端末発熱を表す値ではない。

|実時間測定条件|時間|FPS|renderer task占有比|
|---|---:|---:|---:|
|HUGE・3惑星・通常1倍|18.081秒|59.79|24.88%|
|100倍・発射／RESET／リトライ20回|6.739秒|58.47|37.36%|
|3惑星＋6ギミック群・予測入力更新|10.247秒|59.92|28.15%|
|DEEP 12000×10000・6対象・1倍の最初8秒|8.394秒|58.97|32.88%|
|同じ航行を100倍にして帰還CLEARまで|1.711秒|35.07|92.46%|

保護した実DEEP到着記録を、30お気に入り＋20通常記録がある状態でCINEMATIC 0.5倍再生。実時間120秒、途中60秒で再開始し、10秒ごとに12点測定。FPS 58.00〜60.00、GC後ヒープ約7.76〜8.23MiB、最初から最後まで+28,420bytes。2分間の範囲で大きな保持メモリ増加を検出しなかった。数時間・全メモリのリーク不存在は断定しない。原データ：[performance.json](performance.json)。

100倍では描画FPSが低下するが、既存の処理予算・固定ステップ繰越を維持。描画速度を上げるための物理省略や式の変更はない。惑星は仕様の最大3個を試験し、上限を超えた「多数配置」は追加していない。

## 音声・共有

初期音声OFF、ユーザーのCDPタップでネイティブAudioContext作成・音声時計進行・テスト音送信を確認。suspendからの再開、visibility中断相当、close後再生成、ミュート、設定保存、再読み込み後の自動再生抑止を確認。設定を開いたとき既存の発音を止める。BGMは従来仕様に存在せずNOT APPLICABLE。可聴音・iOS AudioSession・消音スイッチ・アプリ中断復帰は実機未確認。[audio-results.json](audio-results.json)。

PNG1080×1080／1080×1920の生成・ダウンロード、文字／背景切替、失敗からの復旧、元記録不変、Object URL解放、外部アップロードなしを確認。Web Shareの成功／キャンセル／非対応はAPIスタブによる分岐試験であり、iOS共有シートや写真・LINE・AirDropへの実保存を合格にしていない。非対応時はPNG保存・表示に誘導。[share/result.json](share/result.json)。

## 保存互換性・物理・難易度

保存スキーマや物理・ステージデータを変更していない。旧HOMEWARD v1、CLASSIC星、古いお気に入り、重要保護記録を隔離コンテキストへ投入し、FREE SPACEの操作と再生後に原文一致を確認。通常進行では寄港・到着時の正規保存を検証。既存IndexedDBのアップグレードや記録削除を行わない。

全405件には旧セーブ復元・保存失敗／再試行・重要記録保護・予測実飛行一致・倍率一致・20ステージ・9セクター・DEEP・5結末の既存検証を含む。HOMEWARD02の基準角度感度約±0.032°と推力218〜220の既存別解、CLASSIC19の寛容さを既存回帰試験で再確認。進行不能ではないため物理・ゴール・評価条件の調整なし。見た目と難易度の受入評価は実機確認へ引き継ぐ。

## 全自動試験

`npm test`：32ファイル、**405 PASS / 0 FAIL / 0 SKIP**、38.049秒。[all-final.json](all-final.json) / [all-final.txt](all-final.txt)。初回は404 PASS / 1 FAIL。2航行の選択時刻が実時計で1msずれた試験を、同じ時計で比較するよう補修し再実行。失敗証跡は [all-initial.txt](all-initial.txt) に保持。

ブラウザ試験はNode405件と別に記録し、件数を水増ししない。再実行：

```powershell
npm test
node tests/mobile-polish-ui.mjs
node tests/mobile-polish-audio.mjs
node tests/mobile-polish-navigation.mjs
node tests/mobile-polish-performance.mjs
node tests/orbit-share-ui.mjs --mobile-polish
```

Chromeと既存019_bomber-lab内Playwrightを使用。テストサーバーとブラウザは各試験で閉じる。結果はmobile-polish内へ保存し、過去バージョンの検証資料を上書きしない。

## 検出問題・修正・残課題

|ID|分類|内容|対応|
|---|---|---|---|
|MP-01|Medium|320幅を横にした再生画面で下部操作が領域外|再生パネル内スクロール、安全領域の上限。全操作へ到達確認|
|MP-02|Low|短い画面のメニュー高さ38px|44pxへ修正。盤面の減少は6px|
|MP-03|Low|Canvas長押しでブラウザメニューが出得る|ゲーム・再生Canvasに限定して抑止。通常入力の文字操作は保持|
|MP-04|Low|速度セレクタの小さい文字によるiOSフォーカス拡大の懸念|16pxへ設定。Safariの実挙動は実機確認|
|MP-T01|試験|旧ストーリー比較の実時計1ms差|試験用Date.now固定。初回失敗は保持|

PC検証範囲で未解決のCritical／Highは0件。iPhoneでの操作感、安全領域、Safariバー、音声、共有、発熱は未確認であり、この0件に実機保証は含まれない。飛行途中からの完全再開、OS強制終了・電源断、実ストレージ容量枯渇、数時間耐久は今回も未対応／未検証を区別して引き継ぐ。

## v2.0.0への引継ぎ

[IPHONE_CHECKLIST.md](IPHONE_CHECKLIST.md) のIP-01〜14を最後にまとめて受入確認する。既存進行を削除せず、未解放試験は保留する。新しいCritical／Highが出た場合は完成版扱いせず修正・関連回帰を行う。PCでのローカル検証完了と、iPhone受入・公開承認を区別する。
