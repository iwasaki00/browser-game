# v1.9.2 — QUALITY ASSURANCE

## 1. Version・結論

ローカルQAの完了条件をPC・自動検証の範囲で満たした。ゲーム本体のCritical 0／High 0、標準Node全405件PASS、CLASSIC01〜20、HOMEWARDの全5結末、保存・主要物理・PC基本操作を確認。iPhone実機受入や数時間の耐久を完了した意味ではない。公開・push・デプロイは行っていない。

## 2. 変更ファイル

- package.json / index.html：v1.9.2。npm testは全テストを隔離コピーで直列実行する入口へ変更。
- .gitattributes / .editorconfig：このプロジェクトのソース種類にLFを指定。Gitのグローバル設定は変更しない。
- tests/launch.test.mjs：古いDOMモックを補完。
- tests/open-voyage.test.mjs：旧データの任意echoes初期値を含む厳密比較へ補修。
- tests/final-voyage-ui.mjs / tests/orbit-share-ui.mjs：現在のメニュー経由の操作と、QA専用出力先を追加。
- tests/qa-*.mjs：隔離全件実行、連結進行、難易度、PC操作・性能、資料生成。
- reports/quality-assurance/：本レポート・原データ・画面・試験書。

重力・接触・時間倍率・ステージ・ゴール・評価条件・保存処理のゲームコードは変更していない。ゲーム機能の追加・削除はなし。

## 3. 全自動テスト

最初は402件中395 PASS／7 FAIL。試験環境・古いモック・任意項目の期待値を修正し、3件の連結／難易度テストを追加。最終は32ファイル、405件PASS、FAIL 0、SKIP 0。最終所要38.45秒。

対象はpackage.jsonが定義する全 *.test.mjs。失敗テストの削除・skip化なし。npm testが実行するNodeケース一覧・ログは all-final.json / all-final.txt。過去版の単発GUI・探索用スクリプトを全部実行したという意味ではない。現行画面は今回の総合ブラウザ試験と5結末・PNG試験で検証した。過去のスクリーンショットを今回のPASS証拠へ転用していない。

過去テストは報告JSONを書き換えるため、一時コピーで全件を実行。旧エンジンとの比較は本物のGit履歴を読み取る。ユーザーの過去資料や保存を全件試験のために上書きしない。

## 4. CLASSIC進行

新規開始→順次解放→全20ステージ★3→保存→再読込をモデル・Chromeで確認。失敗時の進行不変、最高星保持、再挑戦も確認。[進行結果](PROGRESSION.md)。

## 5. HOMEWARD進行

新規セーブから01〜08を実航行、09で発見・寄港・解析、CLUE01〜09、DEEPの6対象を調査して最終章へ。その到達済み状態から5種類の結末を実航行で確認。別のUI試験でも全5結末、可逆な判断、途中の目的地変更、CINEMATIC、再挑戦を確認。UI試験の解放済みフィクスチャと、新規開始モデル試験を区別した。

## 6. 物理

1/120秒、重力・衝突・危険領域・移動ギミック・スリングショットを維持。76代表航路の1/10/100倍と予測の一致、過去エンジンとの比較を再実行。[物理回帰](PHYSICS.md)。

## 7. 保存互換性

旧v1、星・探索・手掛かり・結末・お気に入り・重要記録を維持。実IndexedDBに50件を保存して再読み込み、書込中断、容量エラーの再試行上限も検証。実ディスク枯渇は故障注入で代替し、実枯渇試験とは呼ばない。飛行途中の完全再開は未対応。[保存結果](SAVE_COMPATIBILITY.md)。

## 8. 検出問題

ゲーム本体Critical 0／High 0。試験・環境のMedium 2群、Low 2群を修正。Lowのバランス観察2件を引継ぎ。初期の7失敗は試験3群に対応する。[一覧](BUGS.md)。

## 9. 修正と改行

試験で旧状態の全フィールドを引き続き比較し、任意初期値だけを明示。モックの入力試験を残し、実Chromeの進行試験も追加。物理や成功条件を変えて試験を通していない。

ルートの .gitattributes / .editorconfig は開始時なし、core.autocrlf=true。GitインデックスのソースはLF。プロジェクト内属性でHTML/CSS/JS/MJS/JSON/MD/TXT/SVGをLF、PNGをbinaryとした。編集したテキストだけLFにし、全ファイルの再正規化やグローバルGit設定変更はしない。改行だけの大量差分なし。

## 10. 残存事項

HOMEWARD02の角度感度とCLASSIC19の難易度差はLowとして維持。飛行中完全再開、OS強制終了・電源断、実容量枯渇、数時間耐久は未対応／未検証を区別して記録。

## 11. 性能

80回の100倍航行は平均rAF 59.41 FPS。連続CINEMATIC120秒と多数対象の予測更新を測定。CPU・ヒープの条件、ピーク、限界を [性能レポート](PERFORMANCE.md) に記録。実機の発熱は判断していない。

## 12. PC画面

|サイズ|盤面 CSS px|基本操作・見切れ・メニュー|
|---|---|---|
|320×568|310×402|PASS（Chrome）|
|375×667|365×501|PASS（Chrome）|
|390×844|380×678|PASS（Chrome）|
|1366×768|690×602|PASS（Chrome）|

100倍中の目標変更、FOLLOWの倍率変更・パン解除、CINEMATIC復帰、再生の停止・再開・サイズ変更を確認。PNG1080×1080／1080×1920、ダウンロード、背景・文字、共有スタブ／非対応代替、生成失敗からの復旧、元記録の不変性もChromeでPASS。OS共有先への実送信は試していない。

## 13. iPhone未確認

[実機確認表](IPHONE_CHECKLIST.md) の全項目は未確認。操作感・安全領域・共有先・可聴音・発熱・処理落ちはPC結果からPASSにしない。

## 14. v1.9.3への引継ぎ

実機試験表を使い、見た目・操作感・端末固有の安全領域・音声・共有・長時間動作を受入確認する。BAL-01/02は数値と人の評価を合わせて判断する。保存を消して試験しない。新規Critical／Highが出たら公開前に修正・再検証する。

## 再実行方法

Windowsでプロジェクトへ移動し npm test。ブラウザ試験は node tests/qa-browser.mjs、node tests/final-voyage-ui.mjs --qa、node tests/orbit-share-ui.mjs --qa、node tests/qa-flight-performance.mjs（または --crowded）。Chromeと既存の019_bomber-lab内Playwrightを使用する。原データが揃った後 node tests/qa-document.mjs で総合・性能Markdownを更新する。
