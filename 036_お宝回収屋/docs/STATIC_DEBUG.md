# 静的デバッグ専用版 — THE FINDERS

確認日：2026-11-15。ゲームVersionは **1.0.0-rc.1** のままです。commit・push・GitHub Pages公開は行っていません。

## 成果物と起動

| 用途 | コマンド | 出力 | 起動時の保存キー |
|---|---|---|---|
| 通常版 | `npm.cmd run build` | `dist/` | `finders-v1` |
| 静的デバッグ版 | `npm.cmd run build:debug` | `dist-debug/` | `finders-static-debug-v1` |
| 従来のVite開発プレイ | `npm.cmd run dev` | 開発サーバー | `finders-dev-v1` |
| 従来のローカルDEBUG LAB | 開発サーバーの隠し入口、または `?debug=1` | 開発サーバー | `finders-debug-v1` |

静的デバッグ版は `dist-debug/index.html` を静的HTTP/HTTPS配信で開くだけで起動します。クエリー指定やVite開発サーバーは不要です。`?debug=0` を付けても通常版には変わりません。

両ビルドは `base: './'` です。JS・CSS・9枚のPNGとWorkerを同じ出力フォルダー内で相対参照するため、GitHub Pagesのプロジェクト配下にも配置できます。WorkerのUI依存を `dev-automation-state.ts` へ分離し、静的バンドル時の循環依存も解消しました。

通常版は引き続き `?debug=1` 等ではデバッグになりません。強制操作・テスト保存キー・API・デバッグ用Workerを通常成果物から除外しています。

## セーブを分離する仕組み

`import.meta.env.VITE_STATIC_DEBUG` をViteのビルドモードから固定し、通常ビルドではfalse、`--mode debug` ではtrueとしてコンパイルします。URLや保存データ内のフラグでは切り替えません。

静的デバッグ版の `saveKey()` は、既定引数や呼び出し元のscopeにかかわらず専用キーを返します。初回セッション取得、IndexedDB、localStorageバックアップ、自動保存、復元、終了時保存が専用領域を使います。同一オリジンの `finders-v1`・`finders-dev-v1`・`finders-debug-v1` は読み込み元として使いません。

通常版へのリンクとDEBUG LABの「通常プレイへ戻る」は `../dist/index.html` へ別ページ遷移します。静的デバッグの同じ画面で通常セーブへ切り替える操作はありません。従来のローカル開発版の隠し入口・8タブ・同一画面での復帰は維持しています。

「DEBUG／テスト用セーブ」はタイトル・採取画面に表示し、モーダル中も画面上端のラベルで識別できます。バックアップ名も `finders-static-debug-save-...json`／`finders-static-debug-recovery-...json` と区別します。セーブJSONには通常と同じ有限の数値を保持します。

## 通常メニューから300点を閲覧

静的デバッグ版で「図鑑・記録」を開くと、その場で全300点を閲覧できます。DEBUG LABを経由する必要はありません。

- 砂浜・川底・河原各100点。正式名称・専用ドット絵・詳細を表示。
- 未発見品には「未発見・閲覧のみ」を表示。発見フラグ・回収数・目標達成は変更しない。
- 分野フィルター、名前・ID検索、12件ずつの既存ページ送りを使用。
- 検索・ページ変更時は閲覧用の古い詳細を消し、別の品との取り違えを防止。

DEBUG LABの「お宝」タブにある「選んだ品を即回収」も維持しています。1点を未洗浄のまま追加し、「洗浄へ」から既存の洗浄・報酬・正式図鑑登録を試せます。探索目標は洗浄前には達成せず、初回登録時に達成します。

## 使用できる装備の範囲

調査結果とユーザー回答に基づき、**実装済み46道具＋3設備＝49件を即使用可能**にしました。マスターに名前・説明だけが存在する残り77件は新規実装せず、「未実装・閲覧のみ」と明記しています。126件すべてが実動作するという扱いにはしていません。

- 46道具は購入・進行条件なしで最初から所持し、対応分野の「装備」画面で4枠へ割り当てて使える。
- B301 電動ふるい、R301 電動ウインチ、G304 電動砂利搬送機は初期導入済み。
- 「探索場所」から全12エリアへ移動可能。各装備の掘削深度・磁性・重量・到達距離・比重選別などの能力判定は既存どおり。
- 設備は実際の材料・対象を指定して稼働する。材料なしで成果や報酬は発生しない。入力容量・出力容量・設備数・強化上限等の構造的制限は維持。
- 77件はDEBUG LABの道具選択で閲覧でき、付与・装備ボタンは無効。3設備もクイックスロットではなく設備画面で使う。
- 現行の実装済み装備に使い切り回数・バッテリー・専用消耗品の管理はないため、その新規仕様は追加していない。体力や処理材料は既存の作業条件として維持。

126件のID・正式名称・通常価格・対応分野・実装区分は [equipment.csv](static-debug/equipment.csv) と [equipment.json](static-debug/equipment.json) に記録しています。通常マスターの価格や性能は変更していません。

## 無限FN

残高表示は **∞ FN**。`money.ts` の `canSpend/spend/moneyLabel` で、静的デバッグ版だけ残高不足による拒否と数値残高の減算を免除します。所持金へ `Infinity` を代入したり、セーブに無限フラグを書いたりする方式ではありません。

既存の購入・設備増設・強化の処理は通り、設備個体や投資額の記録も有限数値で更新します。通常版では従来どおり残高確認と支払いを行います。設備の各種2台・Lv3等の上限はFN制限とは別なので維持します。洗浄による実際の報酬と収益記録も維持します。

## Windowsでのローカル確認

PowerShellで以下を実行します。

```powershell
Set-Location 'C:\_wk\github\browser-game\036_お宝回収屋'
npm.cmd run build
npm.cmd run build:debug
npm.cmd run preview:both
```

これはNodeの静的配信だけです。Vite開発サーバーは起動しません。1つのオリジン上に、GitHub Pages相当のサブパスで両版を配置します。

```text
通常版
http://127.0.0.1:4179/browser-game/036_お宝回収屋/dist/index.html

デバッグ版
http://127.0.0.1:4179/browser-game/036_お宝回収屋/dist-debug/index.html
```

URLは起動ログにも表示します。終了は `Ctrl+C`。ローカル確認用サーバーは作業完了時には起動していません。

最短操作：

1. 通常版に `?debug=1` を付けても、未発見品が伏せられ、所持FNや装備制限が変わらないことを確認。
2. デバッグ版を開き、DEBUG表示と `∞ FN` を確認。「図鑑・記録」からB/R/G、品名またはIDを検索し「詳細」を開く。
3. 「探索場所」→砂浜・浅瀬・河原へ移動。「装備」から道具を選び、クイック枠で持ち替える。
4. DEBUG LAB→「お宝」→`B004`・`R001`・`G001`を1点ずつ即回収→「洗浄へ」→「洗う」。登録数が増えるのは洗浄後であることを確認。
5. 設備パネルで材料・対象を投入して稼働。ライン管理で増設・強化を繰り返し、再読み込み後も `∞ FN` であることを確認。
6. 「通常版へ（別ページ）」から戻り、元の発見履歴・所持品・通貨が変わっていないことを確認。

## GitHub Pages配置後のURL

リポジトリの配置先が現在と同じ `iwasaki00/browser-game` で、両フォルダーを `036_お宝回収屋/` 配下へ配置した場合のURLです。**今回は未公開です。** `dist-debug/` 全体（assetsを含む）を配置する必要があります。

- 通常版：<https://iwasaki00.github.io/browser-game/036_%E3%81%8A%E5%AE%9D%E5%9B%9E%E5%8F%8E%E5%B1%8B/dist/index.html>
- 静的デバッグ版：<https://iwasaki00.github.io/browser-game/036_%E3%81%8A%E5%AE%9D%E5%9B%9E%E5%8F%8E%E5%B1%8B/dist-debug/index.html>

GitHub PagesはHTTPSなので、iPhone Safariでは配置後のデバッグURLを開き、上記の図鑑・即回収・装備の操作を確認できます。**iPhone Safari実機・WebKitは未確認です。** PCのChrome／Edgeのスマホ幅を実機結果として扱っていません。

## 検証結果

- 自動テスト688件成功、失敗0（既存684件＋追加4件）。通常の価格・残高・データ内フラグによる制限回避防止も確認。
- 静的ブラウザ試験10ケース成功：Chrome 390/1280px、Edge 320px。各条件で通常版と静的デバッグ版を同じオリジン・別パスから起動。
- 全300点の一覧・詳細、未発見閲覧の状態不変、名前・ID検索、3分野の即回収・洗浄・登録を確認。
- 実装済み46道具の選択、B101の掘削・R103の磁石回収・G101の砂利採取、B301/R301/G304の実処理を確認。
- 数値残高0で設備の増設・強化を計15回実行。数値残高は0のまま、表示は∞。バックアップ書出し・復元・再読込を確認。
- 前後で通常系3保存キーのlocalStorageとIndexedDBのcurrentを完全比較し、不変を確認。
- Worker比較15構成と中止、従来のローカルDEBUG LAB入口・8タブ、通常版への実ページ遷移も各1ケース成功（ブラウザ合計13ケース）。
- 通常ビルド・静的デバッグビルドが成功。通常成果物には強制操作・テスト保存キー・デバッグWorkerを含まないことを監査。
- 9枚の元PNGと両成果物のPNGは作業前とSHA-256が一致。300点の素材・マップは変更なし。テキストはLF。

証跡は [static-debug/](static-debug/) に保存しています。`unit.log`、`normal-build.log`、`debug-build.log`、`browser-results.json`、`worker-results.json`、`local-entry-results.json`、`navigation-results.json`、`audit.json`、`summary.json` を参照してください。

主な変更：`vite.config.ts`、`package.json`、`src/build-mode.ts`、`src/money.ts`、`src/static-debug-state.ts`、`src/main.ts`、`src/save.ts`、`src/collection.ts`、`src/dev.ts`、`src/backup-ui.ts`、購入・設備の支払い接点、Worker用準備処理の分離、`scripts/static-debug-*.mjs`、`tests/static-debug.test.ts`。生成された `dist-debug/` が静的デバッグ成果物です。
