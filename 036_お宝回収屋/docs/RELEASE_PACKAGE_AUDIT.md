# Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE

## 配布候補

出力先dist、base=./。ローカルのリリース候補を作成した段階で、ZIP配布・公開・タグは行っていません。

| ファイル | bytes | SHA256（先頭16桁） |
|---|---:|---|
| assets/index-CkDx-hAs.js | 401648 | a68ddb367b516560 |
| assets/index-Didvjovp.css | 25609 | 75ba7ea98a70e284 |
| index.html | 602 | 027531b5bfc31637 |
| THIRD_PARTY_NOTICES.txt | 1486 | 64e7ee04ad902e11 |

完全なSHA256とモジュール一覧は[ビルド台帳](release-build-v100rc1.json)。最終ファイルとハッシュ一致を確認。本番に不要なテスト・ログ・セーブ・開発モジュール・ソースマップ・レポートは配布物へ含みません。必要なTHIRD_PARTY_NOTICES.txtのみ同梱。

## 本番と相対パス

| ブラウザ | 環境 | パス | アセット/保存/NOTICE/開発API |
|---|---|---|---|
| chrome | vite-preview | / | PASS |
| chrome | pages-subdirectory | /browser-game/036_%E3%81%8A%E5%AE%9D%E5%9B%9E%E5%8F%8E%E5%B1%8B/ | PASS |
| msedge | vite-preview | / | PASS |
| msedge | pages-subdirectory | /browser-game/036_%E3%81%8A%E5%AE%9D%E5%9B%9E%E5%8F%8E%E5%B1%8B/ | PASS |

4176番のvite previewを開発サーバー5176番と別に起動し、本番動作を確認。別のローカルHTTPサーバーで/browser-game/036_お宝回収屋/配下へ同じdistをマウントし、HTML/JS/CSSが同じ配下へ読み込まれ、他originや開発サーバーへ依存しないことを検証。GitHub Pages自体への公開は未実施。

相対アセット、必要NOTICEの取得200、通常JSONのダウンロード、Version表示、__finders未公開、隠しLAB入口無効、pageerror0を確認。本番の総合Chrome/Edge試験でも3分野/深層/設備/6ライン/図鑑/保存/JSON復元が成功。

## 除外・安全性

実行モジュール43件。外部はVite補助コード1件、DEBUG LAB/比較Workerなし。DEVマーカーの検査と実動作の両方で除外を確認。絶対Windowsパス、@vite/client、/src/main.ts、localhost:5176、previewポート参照などの禁止文字列一致0。Viteの同梱MIT原文も照合。

npm audit 0件（2026-11-13取得）。検査した形式の資格情報候補は036ソース/配布物0。他ゲームのFirebase設定4ファイルに8パターン一致はv0.9.2と同じ扱いで値を伏せて記録、今回のdistに含まれません。クラウド側の制限/認可設定は調査対象外・未確認。別ゲームを変更していません。任意の個人情報や全形式の秘密情報の不存在を正規表現だけでは保証しません。

通常ゲームの外部API/CDN/フォントファイル通信なし。試験した本番パスのリクエストは同一originのみ。JSONは端末内処理。HTML注入は危険キー/IDの拒否と属性エスケープ、表示textContent/escで保護し、RC不正入力試験でも確認。

## 残る公開条件

ビルド完全性と、ゲーム固有素材の配布許諾の完了は別判断です。[素材マニフェスト](ASSET_LICENSE_MANIFEST.md)の未確認を解消するまで、公開判定はCONDITIONAL。

[本番総合](production-results-v100rc1.json) / [previewと配下パス](preview-acceptance-v100rc1.json) / [機密・依存監査](security-license-v100rc1.json)
