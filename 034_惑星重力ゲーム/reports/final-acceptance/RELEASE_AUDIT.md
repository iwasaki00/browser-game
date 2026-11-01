# 公開前監査 — v2.0.0-rc.1

判定：**ローカル配信用ファイルの検査PASS／公開は未実施**。公開の承認を意味しない。

## 配置構成

`release-preview/` はローカル確認用コピー。配信対象を `index.html`、`styles.css`、`icon.svg`、`js/` の59ファイル・427,580bytesに限定した。tests、reports、package.json、node_modules、個人PCのパスを含む試験ログはコピーしない。マニフェストとSHA-256は [release-audit.json](release-audit.json)。このフォルダは.gitignore対象であり、自動公開しない。

実行：`node tests/acceptance-audit.mjs`。コピー元の構文・相対参照・秘密情報パターン・保護ファイルを検査し、コピー先に予期しないファイルがあれば停止する。既存ファイルの自動削除はしない。

|項目|検査結果・範囲|
|---|---|
|不要な開発機能|実行時コードにdebugger、console.log/debug、__DEBUG__露出は検出しなかった。試験用fixture・開発依存を配信コピーから除外|
|秘密情報・個人情報|実行時ファイルの秘密鍵、代表的な認証トークン、API秘密値代入パターンは検出0。値を報告へ出力しない。パターン検査だけで不存在を証明するものではない|
|外部通信|実行時コードにfetch／XMLHttpRequest／WebSocket／sendBeacon、外部src/hrefを検出せず。SVGのW3C名前空間は外部取得ではない。PNG共有は利用者操作でOSへ渡す|
|相対パス・構文|137の相対参照が配信対象内に存在。全実行時JavaScriptのNode構文検査PASS。実際のサブフォルダ配信・PNG Worker検証は [staged-share/result.json](staged-share/result.json) を参照|
|バージョン|packageとメニューを2.0.0-rc.1へ更新。正式完成を宣言せず、READMEも最終受入候補と明記|
|README|起動、受入資料、隔離テスト、候補版の位置付けを追加。内部リンク検査は [readme-links.json](readme-links.json)|
|素材・依存|実行時はCanvas／SVG描画とWeb Audio合成。外部画像・音声・実行時ライブラリを同梱しない。試験用Playwright 1.60.0はApache-2.0で、配信コピーには含めない|
|ライセンス|プロジェクトおよびリポジトリルートにLICENSEを確認できなかった。公開ソースの利用条件・権利表記は所有者が決定する必要がある。代理でライセンスを付与しない|
|改行|既存.gitattributes／.editorconfigを維持。Gitのcore.autocrlf=trueに対し、このプロジェクトの対象拡張子はeol=lf。編集対象のみUTF-8/LF、全体の改行変換なし|
|保存情報|元のSafariやChromeプロファイルを使用せず、独立コンテキストで試験。ユーザーの保存情報を削除・初期化しない|

## 公開前に残る作業

1. [iPhone最終確認表](IPHONE_CHECKLIST.md)の未確認を実施し、NGがあれば再現情報を記入する。
2. 所有者がライセンスと公開範囲（ソース全体か配信用ファイルか）を決める。
3. 利用者が正式完成を判断する。承認後に正式版表記・公開手順を別作業として確定する。
4. Git push、GitHub Pages設定、公開・デプロイは今回行わない。現在の公開URLはローカル候補版へ更新されていない。

なおGitリポジトリ全体をそのままPagesへ公開する場合、上の59ファイル限定とは異なり、過去のレポート・試験資料も公開対象となり得る。公開先の設定を別途レビューする。
