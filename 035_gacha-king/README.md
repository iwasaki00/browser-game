# ガチャ王 / GACHA KING

Version 0.1.1 — ASSET INTEGRATION & UX POLISH

iPhone Safariを主対象にした、依存ライブラリなしの静的ブラウザゲームです。ガチャで12種類の「へんてこ生物」を集め、即売り・架空フリマ・架空SNSを使って3種類の王を目指します。

Version 0.1.1では `gacha-king_henteko-vol01` の正式画像12枚を統合しました。画像は `assets/items/henteko-vol01/`、既存IDと素材IDの対応は同フォルダの `manifest.json` にあります。Version 0.1.0のゲームID、価格、抽選weight、セーブキーは維持されています。

## 起動

`index.html` を静的Webサーバーで配信してください。ES Modulesを利用するため、`file://` での直接起動ではなく、VS Code Live Serverや次のコマンドが利用できます。

```powershell
py -m http.server 8080
```

その後 `http://localhost:8080/` を開きます。GitHub Pagesではリポジトリ直下を公開元に指定できます。

## テスト

```powershell
npm test
npm run check
```

セーブデータはブラウザの `localStorage` に保存されます。外部API、実課金、実SNS・フリマ通信はありません。
