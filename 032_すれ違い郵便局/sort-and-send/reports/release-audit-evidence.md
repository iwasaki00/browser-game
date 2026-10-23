# RELEASE AUDIT：指摘と根拠

監査日：2026-10-23。パスはアプリディレクトリからの相対パス。既存コードは変更せず、再現試験には注入可能な`memoryStorage()`だけを使いました。各再現はViteの`createServer({configFile:false, server:{middlewareMode:true,watch:null}})`と`ssrLoadModule`から現在のモジュールを読み込み、標準出力で観察しています。追加テストファイルは作成していません。

## AUD-001：一部不正値によって正常な進行全体が失われる

- 状態：FAIL、重要度：**P1**。
- 箇所：`src/progress.ts:23`の`decode()`、同27〜28行の一括検証、`createProgressStore()`の読み込みcatch（49行）、`persist()`（52行）。
- 再現条件：schema 1の正常な星・CLEAR履歴と、不正な設定値または星1件が混在する。
- 手順：メモリストアでStage01を星3CLEARとして保存する。保存JSONの`settings.volume`だけを2に変えて再ロードする。その後SFXをOFFにする。
- 実際の結果：再ロード時`status='recovered'`、`bestStars={}`、`clearedStageIds=[]`となる。SFX変更時に初期進行が保存され、元の正常な星3・CLEAR・Stage02解放も消える。
- 期待する結果：不正な項目だけを除外／既定値化し、正常な進行を保持する。安全な復元ができなければ原文を保護して保存を止め、利用者へ説明する。
- 根拠：現行関数で上記を実行し、保存前後のJSONを比較。既存`progress.test.ts`の「recovers malformed data」は全体初期化を期待しており、正常項目の保持を保証していない。
- 未確認：実ユーザーの破損頻度は不明。ブラウザ保存を書き換えてのGUI再現は実施していない。

再現の核（隔離メモリ限定）：

```js
const storage = memoryStorage();
const first = createProgressStore(ids, storage);
first.recordResult('01', true, 3);
const json = JSON.parse(storage.getItem(productionProgressKey));
json.settings.volume = 2;
storage.setItem(productionProgressKey, JSON.stringify(json));
const restored = createProgressStore(ids, storage);
// 実測: recovered / bestStars={} / clearedStageIds=[]
restored.setSettings({ ...restored.data.settings, sfx: false });
// 実測: 元の正常進行がないJSONへ保存される
```

## AUD-002：古いタブの進行保存が新記録・未知形式を上書きする

- 状態：FAIL、重要度：**P1**。
- 箇所：`src/progress.ts:46`の起動時だけの読み込み、`persist():52`の無条件`setItem`、`src/main.ts:484`のstorageイベント（LABキーのみ）。
- 再現条件：同じ保存先を共有するタブA/Bを開く、または起動後に別版が保存形式を更新する。
- 手順A：空の同一メモリストレージでストアA/Bを作成。AでStage01星3を保存。BでSFXをOFFにする。
- 実際A：永続データの`bestStars`が`{}`へ戻り、CLEARと解放も失われる。Bが星1CLEARした場合もAの星3を考慮しない。
- 手順B：schema 1／未保存でストアAを作成。保存先を`{"schemaVersion":99,"marker":"future"}`に置き換え、Aで設定を変更する。
- 実際B：未知schemaがschema 1に上書きされ、markerも消える。起動時に未知schemaだった場合の保護テストは通るが、起動後の変更には効かない。
- 期待する結果：書き込み直前に現在の保存を検証し、未知schemaなら保存禁止。既知schemaの別タブ更新は最高星・CLEARを保持し、リセット操作との競合は明示的に扱う。
- 根拠：現行関数による独立した2再現で確認。LAB側の`write()`には保存直前の文字列照合があるが、進行側にはない。
- 未確認：実ブラウザ2タブでの並行操作と完全同時書き込みの競合は未実行。通常の単一タブ保存はChrome再読込でも成功した。

```js
const storage = memoryStorage();
const a = createProgressStore(ids, storage);
const b = createProgressStore(ids, storage);
a.recordResult('01', true, 3);
b.setSettings({ ...b.data.settings, sfx: false });
// 実測: JSON.parse(storage.getItem(productionProgressKey)).bestStars === {}
```

## AUD-003：未知保存形式の案内が実行不能な初期化へ誘導する

- 状態：FAIL、重要度：**P3**（案内の不整合）。
- 箇所：`src/main.ts:454`の`updateStorageStatus()`、`src/lab-integration.ts:22`の`resetProgressAndLab()`。
- 再現条件：起動時に進行キーが未知schema。
- 実際の結果：状態文は「保存を再開する場合は進行を初期化してください」と案内する一方、初期化は「未対応の進行保存形式を保護するため、初期化を中止しました」と拒否する。
- 期待する結果：保護を維持したうえで「このバージョンでは保存・初期化できません。対応版を利用してください」等の一貫した案内にする。
- 根拠：表示分岐を静的に確認。隔離ストアをschema99で起動し`resetProgressAndLab(...,true)`が`ok:false`となることを実行確認。
- 未確認：未知schemaを実Chromeへ投入しての表示確認は未実施。拒否自体は意図された保護であり、不具合として解除を求めるものではない。

## AUD-004：初回画面で評価基準を事前に理解する説明が不足

- 状態：FAIL、重要度：**P3**。
- 箇所：`index.html`の`.intro`・`.help`・`#rescue-explanation`、`src/main.ts:316`付近の結果生成。コスト式は`src/cost.ts`にあり、画面の初回説明にはない。
- 再現条件：初めてStage01を開き、説明を読む。
- 実際の結果：L/R切り替え、荷物ごとの枠進行、全便正解、HINT入口、LAB解放条件は表示される。星2/3の区別とRESCUE星1は該当結果が出てから分かる。方向転換コストの計算方法も画面内で説明されていない。
- 期待する結果：初回から評価の目的を判断できる短い説明を用意する。
- 改善文案：「全便正解でCLEAR。RESCUEを使うと星1、使わずに成功すると星2、最小の方向転換コストなら星3です。コストは使った分岐の矢印がL/Rで切り替わる回数で、最後から先頭への切り替わりも数えます。」
- 根拠：現行HTML・結果表示を静的確認し、Chromeで星3／RESCUE星1の説明の出現時点も確認。
- 未確認：新規プレイヤーによる理解度テストは未実施。改善文案は実装していない。

## 指摘以外の主要な証拠

| 証拠ID | 方法・観察 |
|---|---|
| EV-01 | 現行Vitest：`node node_modules/vitest/vitest.mjs run src/lab.test.ts src/progress.test.ts src/scoring.test.ts src/rescue.test.ts src/simulation.test.ts --configLoader native --maxWorkers=1`、5ファイル108件成功 |
| EV-02 | `node node_modules/typescript/bin/tsc --noEmit`成功。`node scripts/validate-hints.mjs`で20面60件VALID |
| EV-03 | SSRで全20面のFingerprint・generated集計と保存レポートの一致を確認。保存済み成功74設定を`simulate`してすべてCLEAR、コスト一致。レポート期待値28,548検査／74成功とLAB総数74一致。失敗設定の全列挙はしていない |
| EV-04 | npm公式audit成功、既知脆弱性0件。最初のサンドボックス内照会は失敗し、ネットワークを許可した再照会で成功。依存変更なし |
| EV-05 | distはHTML1・JS1・CSS1。秘密パターン・ローカル絶対パス・DEVキー／query語なし。JS内fetchはViteのmodulepreload互換処理で、外部宛先を固定するものではない |
| EV-06 | Chrome専用オリジン`http://127.0.0.1:8044/`の現存dist。DEVクエリ付きでも未解放0/20。A LRで星3CLEAR後再読込し、最高星3・Stage02解放・LAB1/20を復元 |
| EV-07 | 同Chrome375×812。HINT1→2、閉じる。LLでRUN→RESCUE停止（最初RED tick1通常L）、時間が経ってもTICK1 PAUSEDのまま。キャンセル後FAILED2/3・星0・RESCUE未使用 |
| EV-08 | 再読込後LR、RUN→RESCUEでBLUE tick2通常RをRのまま確定。星1CLEAR・LAB対象外・最高星3維持。warn/errorログ0。viewport解除済み |
| EV-09 | 375pxで文書scrollWidth360≤innerWidth375、HINT/RESCUEダイアログ幅324、HINT閉じる134×44px、RESCUE確定134×約69px。左右のはみ出し・操作不能なし |
| EV-10 | 前工程[LAB記録](lab-review.md)のGUI結果：DEV一時メモリfixtureで解放済み一覧、新規・重複・RESCUE除外・設定適用DESIGN・ヒント／RESCUE初期化・リセット確認。今回の永続LAB GUI確認とは区別 |

配信serverは`node node_modules/vite/bin/vite.js preview --configLoader native --host 127.0.0.1 --port 8044 --strictPort`で起動しました。最初の通常previewは設定バンドルの一時ファイル権限で失敗したため、ネイティブ設定読取へ切り替えて成功しました。distや設定ファイルは変更していません。

機密文字列検査はAPIキーの代表形式、秘密鍵ヘッダー、ローカルパス、通信API・URLの検索とコード確認です。すべての秘密形式を検知する保証はありません。外部ライブラリの宣言ライセンスと実ファイルの存在を確認しましたが、配布通知や制作物の権利はHuman Reviewです。
