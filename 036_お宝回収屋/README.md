# お宝回収屋 — THE FINDERS

**Version 0.1.0 — BEACH START**

砂浜の断面をなぞって掘り、回収・洗浄で架空通貨FNを稼ぐ探索ゲームです。素手からスコップ、熊手、砂ふるいへ。TypeScript / Vite / Canvas 2D、サーバー・外部API・課金は不要です。

## Windows / VSCodeで起動

1. Node.js 22.12以降のLTSとVSCodeを用意します。
2. このリポジトリをVSCodeで開き、メニュー「ターミナル → 新しいターミナル」を選びます。
3. PowerShellで次を順に実行します。

```powershell
cd "C:\_wk\github\browser-game\036_お宝回収屋"
npm.cmd ci
npm.cmd run dev
```

ターミナルに出る `http://localhost:5173/` をブラウザで開きます。使用中のポートがあれば、表示された別の番号を使ってください。停止はCtrl+Cです。`npm.cmd` を使うとPowerShellのスクリプト実行ポリシーの影響を避けられます。

## 遊び方

- 「砂浜へ出かける」を押し、砂の**上端から**マウス・指でなぞります。タップだけでは掘れません。
- 光る◇をタップして保管し、「回収品を洗浄」で正体を確認・報酬を受け取ります。
- 2個回収で小型スコップが入荷。最初の4個（ボルト・おもり各2個）は合計160 FNです。
- スコップは掘った砂をバッチに採取。手で選別でき、砂ふるいなら1作業で最大8個（成長後10個）を選別します。
- 熊手は表層を横に広く探索。大型スコップは深く大量採取。探知機は視覚ゲージで埋没金属を探し、掘る時は持ち替えます。
- 装備画面で4枠に割り当てます。素手は常時使用可能です。
- 区画追加は無料。掘削上限より深いお宝が残っても、無料区画で稼ぎ続けられます。
- 自動保存は購入・報酬・区画移動直後と5秒ごと。ブラウザのサイトデータ削除でセーブも消えます。

## 本番ビルドと確認

```powershell
npm.cmd run build
npm.cmd run preview
```

表示された `http://localhost:4173/` を開きます。GitHub Pagesでは `036_お宝回収屋/dist/index.html` が入口です。ルートのゲーム一覧にもリンクを追加済みです。ソースのindex.htmlをダブルクリックしてもTypeScriptは実行できません。distのファイルはビルドで置き換わります。

## iPhone Safariでの確認

PCとiPhoneを同じWi-Fiに接続し、`npm.cmd run dev` に表示されるNetwork URL（例 `http://192.168.x.x:5173/`）をSafariで開きます。Windowsファイアウォールは必要に応じてプライベートネットワークでNode.jsを許可してください。縦画面の掘削、画面外へのドラッグ、アプリ切替後の再開、再読込後の地形・資金、消音時の探知ゲージを確認してください。**実機Safariは未検証**です。LANのアドレスとlocalhostは別の保存先です。

## 検証

```powershell
npm.cmd test
npm.cmd run balance
# 別ターミナルで5176番の開発サーバーを起動してから:
npm.cmd run dev -- --port 5176
# 元のターミナルで:
npm.cmd run test:browser
```

ブラウザ試験はインストール済みGoogle Chromeを利用します。開発版と本番版のセーブは別です。開発版は設定からFN変更・道具付与・お宝出現等を利用できます。

## ファイル

- `src/data.ts`, `src/master-source.json`: 36お宝・126道具・16連携・12エリア
- `src/engine.ts`: UIに依存しないゲームロジック
- `src/save.ts`: IndexedDB・バックアップ・形式移行
- `src/main.ts`, `src/style.css`: 描画・入力・UI
- `src/dev.ts`: 開発専用テスト画面
- `tests/`, `scripts/`: 自動テスト・模擬プレイ・ブラウザ試験
- `docs/`: 仕様・判断・試験結果・今後の計画

将来エリア・121道具はマスターのみです。オンライン同期・オフライン収益はありません。詳細は `docs/GAME_SPEC.md` と `docs/TEST_RESULTS.md` を参照してください。
