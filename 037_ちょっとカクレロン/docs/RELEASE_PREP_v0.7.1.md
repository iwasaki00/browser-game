# v0.7.1 — RELEASE PREP / 公開準備

調査・検証日：2026-11-08。**公開構成の準備は完了、本番切替は未適用。判定はCONDITIONAL**。v1.0.0へは更新していない。

## 現在の公開方式と影響範囲

|項目|確認した状態|
|---|---|
|Gitルート|`browser-game`（このアプリは `037_ちょっとカクレロン/`）|
|リモート|`iwasaki00/browser-game`、ローカル作業ブランチmain|
|Pages API実設定|`build_type: legacy`、source `main`／`/`、status built|
|サイトURL|`https://iwasaki00.github.io/browser-game/`|
|ゲームURL|`https://iwasaki00.github.io/browser-game/037_ちょっとカクレロン/index.html`|
|既存Actions|GitHub生成の `dynamic/pages/pages-build-deployment`。独自のroot `.github/workflows` はなし|
|直近公開コミット|`626d57bf28601b9758b1651feca9e2468237beb2`、ビルド成功|
|HTMLの実配置|リポジトリルートのメニューと、各番号ディレクトリ内のindex.html|
|Service Worker|本アプリにはなし。追加・他アプリのキャッシュ消去なし|
|ローカルSites設定|親の `.openai/hosting.json` は別のホスティング設定で、Pagesの配信元ではない。変更していない|

Git情報・READMEだけで推測せず、GitHub APIをGETで確認した。[実設定記録](qa-v071/pages-settings.json)。既存公開URLにもGETを行い、HTMLは **v0.7.0**、列挙したJS／CSS／SVGは200だった。一方、`tests/app.test.cjs` と `docs/QA_REPORT_v0.7.0.md` も200で取得できた。[公開前の観測](qa-v071/public-baseline.json)。v0.7.1の本番確認が済んだという意味ではない。

root配信のままdistを追加しても開発資料の公開は止まらない。そこで、本アプリを許可リストで置換した**共有Pages成果物**を作成する。PagesをGitHub Actionsからの成果物配信へ変更する案になるため、全ゲームが利用する設定に関わる。依頼の第5項に従い、設定変更・workflow設置・push・デプロイは実行していない。ローカル変更は本アプリ内のみ。

## 生成物と除外

```powershell
# アプリ単独の公開用ファイル
node scripts/build-release.cjs

# メニュー・他ゲームを保持したPages全体の成果物
node scripts/build-release.cjs --pages
```

- `dist/`：このゲームの公開版 **13ファイル**。
- `release/pages/`：共有サイトの公開元として渡すディレクトリ。今回 **3975ファイル**。本アプリ13＋他の既存ファイル3962。
- `release/app-manifest.json`／`release/pages-manifest.json`：開発用の生成一覧・SHA-256・検証結果。公開物の中には置かない。
- `dist/`・`release/` はアプリ内 `.gitignore` でGitの追跡対象外。テスト・監査資料は開発ソースに残る。

本アプリの入力許可リストは `scripts/release-config.cjs` に一本化している。

```text
index.html
style.css
poses.js
copy-brush.js
paint.js
editor-view.js
export.js
app.js
assets/kakureron.svg
assets/menu-icon.svg
assets/poses/crouch.svg
assets/poses/spread.svg
assets/poses/lie.svg
```

出力ではHTMLとメニューアイコン以外の名前に内容のSHA-256先頭12桁が付く。正確な出力名とハッシュは [app-files.txt](qa-v071/app-files.txt)、入力名から出力名への対応は [pages-manifest.json](qa-v071/pages-manifest.json) の `appManifest.names` を参照。

本アプリの `tests/`・`docs/`・`scripts/`・README・開発設定・試験画像・スクリーンショット・ログは許可リストにないため含まれない。v0.7.0の3監査資料と証跡も削除・上書きしていない。個人写真や使用時の写真データを収集する処理はない。

他ゲームについては、作業中のファイルを読まず、指定したGitコミットのblobから既存ファイルを復元する。今回の基準は上記626d57b。コピー後に全3962ファイルのSHA-256一致を検証し、rootメニューと037のリンク、固定の `assets/menu-icon.svg` も維持する。他ゲーム内のREADME・テスト等は、既存公開内容を尊重してそのまま保持する。他ゲーム全体の整理・秘密情報監査は今回の対象外。

リポジトリ直下の `.gitignore`・README・`.openai/hosting.json`・`.vite/deps/` の計5ファイルは、実行に不要な開発設定／資料として共有成果物から除外する。ソースは変更しない。`.git`、未追跡ファイル、ローカルキャッシュを丸ごとコピーする方式ではない。シンボリックリンク／submodule等の未対応エントリはエラーで停止する。

## 参照とキャッシュ

HTMLのJS／CSS／SVG参照、ポーズ定義内のSVG参照、JSのローカル依存参照を出力名へ置換する。すべて設置ディレクトリからの相対パスで、ドメイン直下の `/assets/...` やローカル絶対パスは生成しない。大小文字一致、必須ファイル不足、余計なファイル、内容変更を検査し、不一致はビルド検証失敗にする。

バージョンの基準は既存 `app.js` のVERSION定数。生成スクリプトが読み取り、HTMLメタ情報・表示・ソースJS／CSSのqueryと一致することを検査する。出力HTMLはハッシュ名に加えて `?v=0.7.1` を付ける。変更されたSVGも別のハッシュ名になる。メニューアイコンだけは親の既存参照用に名前を固定し、内容は変更していない。

取得済みのPages HTMLは `Cache-Control: max-age=600`。新しいHTMLが取得されれば一貫したハッシュ付き参照が使われるが、GitHub CDN・ブラウザに残るHTMLをアプリから即時無効化する保証はない。旧HTMLが残る間は旧版表示や旧ファイルの読込失敗が起こり得る。切替後はVersionを確認し、必要なら一度再読み込みし、なお古ければ配信キャッシュの更新を待つ。強制再読込ループ、Service Worker、他アプリのキャッシュ削除は追加していない。

## ローカルの公開成果物検証

```powershell
node scripts/verify-release.cjs
```

既存Playwright／Chromeを利用する。新しいnpm依存・ブラウザのダウンロードは不要。`PLAYWRIGHT_MODULE` で別の既存インストールを指定可能。処理は、共有成果物生成→内部68件→ソース版Chrome14件→成果物版Chrome14件→PNG9組の同一性検査。

成果物側は `release/pages/037_ちょっとカクレロン/` だけをHTTPサーバーへ渡し、`/browser-game/037_ちょっとカクレロン/` にマウントする。ソースフォルダへのフォールバックなし。開発ファイル・古い非ハッシュ名・存在しない参照は404となる。サーバー／ブラウザは試験終了時に停止する。結果とPNGは開発用 `docs/qa-v071/` に保存する。

## 共有Pagesへの適用手順（未実行）

GitHub Actionsによる成果物の指定・配信は[GitHub公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に従う。

1. 共有サイトの担当者がこの案・除外範囲・他ゲームの保持内容を確認する。適用直前のPages設定・成功ビルドのコミットとURLを再記録する。今回の調査値を将来の復旧基準へ無条件に流用しない。
2. `scripts/pages-release.workflow.yml` をリポジトリの `.github/workflows/pages-release.yml` へ設置し、本アプリの変更とともにレビュー・コミットする。テンプレートのままアプリ内に置いている現状では起動しない。
3. `Settings > Pages > Build and deployment > Source` を **GitHub Actions** に切り替える。URL・ディレクトリ名は変更しない。rootのメニュー・他ゲームも同じ成果物に含める。
4. mainで「Prepare browser-game Pages」を手動実行する。初回は `deploy=false`。内部試験・共有成果物の検証・Pages artifactのアップロードまで確認する。自動pushトリガーは付けていない。
5. artifactに本アプリ13ファイルだけがあり、メニュー・他ゲームのファイルが保持されていることをレビューする。CIではブラウザ試験を未実行なので、同じコミットの `verify-release.cjs` によるローカル検証も必要。
6. 配信が承認されたら、同じ確認済みコミットを対象に `deploy=true` で手動実行する。mainが進んでいた場合は再検証する。`github-pages` 環境と `pages:write`／`id-token:write` はdeployジョブだけに付与する。
7. 成功後に以下を実行し、さらに実ブラウザでVersion・編集・PNGとメニュー／他ゲームの代表操作を確認する。HTTP検査だけで主要操作の本番確認済みとは扱わない。

```powershell
node scripts/check-public.cjs --release
```

このコマンドは静的URLへのGETのみ。HTMLのVersion、参照アセット200、開発用パス404を検査し、`docs/qa-v071/public-release.json` に記録する。既定の `node scripts/check-public.cjs` は現状観測用で、公開受入の合否とは区別する。現在は後者だけを実行済み。

**main/rootのままpushしても除外は有効にならない。distだけ、または本アプリだけをPagesへ配信すると他ゲームが失われるので、共有成果物のディレクトリを配信すること。**

## 復旧

適用直前の設定と成功ビルドSHAを保存しておく。Actions配信後の不具合では、まず以前に受入済みの同じコミット／artifactの再配信を検討する。未検証の新しいmainで再実行しない。

従来方式へ戻す場合はPagesを `Deploy from a branch` に戻し、保存した成功コミットから作った専用の復旧ブランチ／rootを配信するか、担当者が確認した元のmain／rootへ戻す。mainの履歴を強制的に書き換える必要はない。復旧はサイト全体へ作用するため、他ゲームも含む保存時点の状態に戻ることを確認する。従来root配信に戻ると開発資料も再び公開される点に注意し、恒久対応にはしない。

## 未確認・未適用

- 共有Pages設定・workflowの設置／実行／デプロイは未適用。本番はv0.7.0で、QA-03の不要ファイル公開も本番では未解消。
- Actions YAMLは既存パーサーで構文・artifact経路・手動deploy条件を確認したが、GitHubのrunner上で実行していない。
- v0.7.1公開後のHTTPS／キャッシュ更新／404・実ブラウザ操作は未確認。
- iPhone Safari、実OS共有シート、LINE送信、実機メモリ、Safe Area等は最終受入待ち。Chromeモバイルエミュレーションを実機合格に代えない。

公開物の除外構成と試験は完成している。共有設定の適用・実URL確認・ユーザー最終受入後に、v1.0.0への移行を判断する。
