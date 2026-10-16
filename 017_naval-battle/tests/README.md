限定テストは `naval.spec.cjs` で実行します。実Firebaseには接続せず、2つの独立したブラウザ画面と模擬Realtime Databaseで検証します。

実行例（この tests ディレクトリ内）：

    npm install --no-save --package-lock=false playwright
    npx playwright install chromium
    node naval.spec.cjs

環境変数 CHROMIUM_PATH で既存Chromiumの実行ファイルを指定できます。
NAVAL_SCREENSHOT_DIR を指定した場合のみ、サイズ別のPNGを保存します。

検証範囲：CPUの旧タイマー無効化と620ms後の反撃、配置の重複禁止・向き変更・開始制約、攻撃済み範囲と連続操作の消費制御、指定4サイズとPC表示、敵海域最終行のクリック、部屋作成・参加・準備・開始、同時再戦、通信失敗時の復元と再試行、切断中の攻撃禁止、退出後の遅延処理、部屋IDコピーの成功・拒否・API非対応。

2026-10-17 実行結果：Chromiumで上記テストすべて成功。主要UIは320×568、375×667、390×844、430×932で画面内に収まり、横はみ出しなし。小さい縦画面の敵海域は内部スクロール。PCは1280×900で左右の海域配置を確認。

艦構成・カード定義・配置ルール・攻撃解決・撃沈/勝敗判定・CPUカード/対象選択関数は、修正前のソースと一致することを別途比較確認済み。

未確認：iPhone実機Safari（Safe Area、アドレスバーによる表示高変化、長押し、ダブルタップ、ピンチズーム）、実Firebaseを使う2端末の通信・再戦・通信断復旧。Windows上の導入済みWebKitは起動待ちが完了せず、検証を中止。
