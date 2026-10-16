# 変更範囲の回帰テスト

対象プロジェクトのルートから実行します。

```powershell
npm.cmd install --prefix tests --package-lock=false
npx.cmd --prefix tests playwright install chromium webkit
node tests/regression.cjs
```

既存ブラウザを使用する場合、実行ファイルの絶対パスを `CHROMIUM_EXECUTABLE` と `WEBKIT_EXECUTABLE` 環境変数に設定できます。

- Chromium / WebKitで320×568、375×667、390×844、430×932、844×390、PCの1280×900を確認。
- 240×320では縦スクロールにより操作ボタンへ到達できることを確認。
- タイマー解除・世代チェック・430ms間隔、タップ位置・連続入力・マウス操作、合体・スコア、リスタート確認とキャンセル、物理オブジェクトの除去、一時停止・非アクティブ化、リサイズ後の包含と速度、最大フルーツ列の重なり補正、保存失敗、画像フォールバックを検証。
- テスト時だけGameインスタンスを公開。配布コードにはテスト用グローバルを追加しない。
- CDNを同じMatter.js 0.20.0のローカルファイルに置換するため、CDN接続の確認は含まない。
- スクリーンショットは `artifacts/` に保存。

## 実機で残る確認

iPhone SafariのSafe Area、アドレスバー開閉に伴う100dvhの変化、画面回転、ピンチ拡大、ダブルタップ、長押し選択、アプリ切替・ロック後の復帰。Windows版WebKitの結果はiPhone実機での確認を意味しません。
