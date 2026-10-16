# Bomber Lab 変更箇所テスト

Playwright を利用する対象限定テストです。プロジェクトルートから実行します。

```powershell
npm install --prefix tests --no-save --package-lock=false playwright@1.60.0
npx --prefix tests playwright install chromium webkit
node tests/bomber.spec.cjs
```

既存環境を利用する場合は `PLAYWRIGHT_MODULE` に Playwright モジュールへのパス、必要に応じて `CHROMIUM_EXE` / `WEBKIT_EXE` にブラウザ実行ファイルを指定できます。`SCREENSHOT_DIR` を指定すると小型画面の画像を保存します。

確認範囲:
- Chromium / WebKit: 320×568、375×667、390×844、430×932、844×390、PC 1280×800。横はみ出し、盤面4:3、操作領域の大きさ・重なり、オーバーレイ内ボタンの到達性。
- Start / Retry / Title、ステージクリア後のアップグレード選択。
- 操作IDの保持、別の指の終了、up / cancel / lostpointercapture、移動と3アクションの同時入力、クリック重複、キーボード、blur / visibilitychange。
- Chromium CDPの実タッチイベント列による移動とBombの同時操作・独立解除。
- 連鎖遅延と各画面遷移後の旧タイマー無効化、保存と再読込、保存取得不可・容量エラー時の継続。
- 通常のアニメーションループでのキーボード移動と爆弾設置。

入力・タイマーの検証ではアニメーションループを止め、保留入力と画面遷移を決定的に検証します。実機Safariのマルチタッチ、ブラウザバーやノッチのSafe Area、ダブルタップ・長押し・ピンチ操作の体感は別途実機で確認してください。全件回帰テストではありません。

