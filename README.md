# browser-game

GitHub Pages で公開する前提のブラウザゲーム集です。ルートのメニューから各ゲームへ移動できます。

## 収録ゲーム

- 五目並べ

## ローカル確認

静的サイトなので、`index.html` を直接開くだけでも確認できます。HTTP で見たい場合は `gomoku/server.py` を流用するか、任意の簡易サーバーを使ってください。

## GitHub Pages で公開

1. GitHub に新しいリポジトリを作成する
2. このディレクトリをそのリポジトリへ push する
3. GitHub の `Settings > Pages` を開く
4. `Build and deployment` で `Deploy from a branch` を選ぶ
5. Branch を `main`、Folder を `/ (root)` にして保存する

公開後の URL は通常:

`https://<GitHubユーザー名>.github.io/<リポジトリ名>/`

五目並べの直リンクは:

`https://<GitHubユーザー名>.github.io/<リポジトリ名>/gomoku/`
