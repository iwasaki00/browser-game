# お宝回収屋 — THE FINDERS

**Version 0.4.1 — RIVER & GOLD TOOL EXPANSION**

少し斜めから見下ろす砂浜を掘り、川底ではつかむ・磁石を投げる・引き上げる操作で探索し、回収・洗浄で架空通貨FNを稼ぐ探索ゲームです。河原では砂利を採取し、パンニング・ふるい・吸引瓶・スルースで砂金を取り出します。素手から道具へ工程を育てます。TypeScript / Vite / Canvas 2D、サーバー・外部API・課金は不要です。

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

## 0.4.1の変更

- 川底6・河原6道具を追加。距離・磁性・重量・観察、採取・前処理・微細回収に役割を分けました。
- カメラ＋アームのC07、砂鉄分離＋水流のC10を実装。所有だけの固定FNボーナスはありません。
- ショップの比較と12道具のアイコンを追加。分野別クイック4枠を維持します。
- DEBUG LABは8タブ・44シナリオ。購入前後計測と4購入ルート比較、Workerの中止、JSON出力に対応。
- [新道具の価格・使い方](docs/RIVER_GOLD_TOOL_EXPANSION.md)／[購入ルートの100シード結果](docs/PURCHASE_ROUTE_ANALYSIS.md)。

## 0.4.0の変更

- 既存マスターから砂浜15道具を追加。第4・第5層、精密回収、広域探知、前処理・運搬補助を実装。
- 旧区画の穴とお宝を保持。新しい清掃区画から深層対応します。通常画面に深度の数字は表示しません。
- C02/C03/C04が実作業で成立。4枠をどう使うかで得意な工程が変わります。
- ショップを分類・8件単位・状態表示・性能比較へ。DEBUG LABは8タブを維持して同一シード比較と砂浜10シナリオを追加。
- [新道具の操作・価格・解放・組み合わせ](docs/BEACH_TOOL_EXPANSION.md)／[深層と保存互換](docs/DEPTH_EXPANSION.md)。

## 0.3.0の変更

- G-A/G-Bの河原探索、砂利袋、指で動かすパンニング、7道具、連続選別するスルースを追加。
- 砂浜20個または川底5個でG-A。河原発見10個またはパンニング5回でG-B。初回は素手、資金と荷物は共通です。
- ふるいで前処理し、通常皿で微細粒を残すC09。虫眼鏡で見分け、吸引瓶で精密回収します。
- 砂浜・川底・河原のクイック装備を各4枠で保存。砂利の残渣や途中作業も保存します。
- DEBUG LABは8タブ・22シナリオへ。河原状態・工程別実測・1/2/10倍速を追加。本番ビルドから除外します。
- 初心者向け操作、保存互換、LABの使い方は [GOLD PANNING説明書](docs/GOLD_PANNING.md)。[試験結果](docs/TEST_RESULTS.md)と[バランス](docs/BALANCE.md)も更新しました。

## 0.2.0の変更

- 砂浜累計回収10個で岸辺の浅瀬、20個で石だまりを解放。川底の初回は素手。資金・道具・図鑑・荷物は共通です。
- トング、フック、小型磁石、ロープ付き磁石、巻取り器、強力磁石、滑車の7道具を実装。道具が届く場所、磁性・重量、必要操作が変わります。
- 対象をつかんで手前へドラッグ。ロープ付き磁石は岸から水底へスワイプして離すと投擲。回収失敗の個体は同区画で再挑戦できます。
- 開発版は設定のVERSION表示を素早く5回タップするとDEBUG LAB。7タブ、10シナリオ、専用セーブ、可視化とJSONログを使用できます。通常状態を退避してテストします。
- 本番ではLABのJS・CSS・生成操作を除外。詳しい操作・道具・保存仕様は [川底とDEBUG LABの説明書](docs/RIVER_RECOVERY_DEBUG_LAB.md)。

## 0.1.3の変更

- 探知機は弱／中／強、浅そう／深そうと反応の特徴を表示し、粗い探知跡を持替え後も残します。先に探知して慎重に掘ると損耗が減り、初期品質は上がりません。固定FN報酬は変更していません。
- 手選別は1回3単位・所要体力6、購入後の砂ふるいは15単位・所要体力4。複数の砂袋をまとめて処理し、取り残した小物は残渣として次へ持ち越せます。手選別だけでも最終的に回収できます。
- 「洗う」は約1.4秒で汚れが落ち、「スキップ」は同じ結果へ即移行します。洗浄前・中・後のモーダルとお宝・ボタンの位置は共通です。
- 第3層までの深掘りと保存互換を維持。道具の仕事は図鑑・記録から確認でき、実測不足は「データ不足」と表示します。

画面例：[洗浄前](docs/v013-wash-before-390.png) / [洗浄中](docs/v013-wash-during-390.png) / [洗浄後](docs/v013-wash-after-390.png)。詳細は [TOOL_VALUE_REVEAL_UX](docs/TOOL_VALUE_REVEAL_UX.md)。

## 0.1.2から引き継いだ機能

砂浜の左右を水平にし、前後だけの遠近感へ変更しました。同じ穴を素手→小型スコップ→大型スコップと掘り進めると、地点ごとの底色・壁・影が変わります。通常UIに深さの数値は表示しません。素手の限界の下に未発見品があると、低確率で小さな「コツッ」と手応えを返します。探知・回収そのものを代行する機能ではありません。

画面例：[素手](docs/v012-depth-hand.png) / [小型スコップ](docs/v012-depth-small-shovel.png) / [大型スコップ](docs/v012-depth-large-shovel.png)。原因調査と保存互換の詳細は [PERSPECTIVE_DEPTH_FIX](docs/PERSPECTIVE_DEPTH_FIX.md)。

## 0.1.1から引き継いだ機能

断面表示を廃止し、穴の影と縁で深さを表現しました。深さの数字は表示しません。6種類の道具カーソルと、指を置いている間だけ出る半透明アイコンに対応。通知は砂浜上部に表示され、タップで消せます。0.1.0のセーブは自動移行し、現在の1区画と回収済みの荷物を保持します。詳細は `docs/SURFACE_VIEW_UPDATE.md`。

## 遊び方

- 「砂浜へ出かける」を押し、砂浜の**好きな場所を**マウス・指でなぞります。タップだけでは掘れません。
- 光る◇をタップして保管し、「洗浄」で正体を確認・報酬を受け取ります。
- 2個回収で小型スコップが入荷。最初の4個（ボルト・おもり各2個）は合計160 FNです。
- スコップは掘った砂をバッチに採取。手で選別でき、砂ふるいなら1作業で最大15単位の砂を選別します。
- 熊手は表層を横に広く探索。大型スコップは深く大量採取。探知機は視覚ゲージで埋没金属を探し、掘る時は持ち替えます。
- 装備画面で4枠に割り当てます。素手は常時使用可能です。
- 区画追加は無料。新しい場所へ進むと前の地形と未発見品は破棄され、戻れません。回収品・採取済みの砂・図鑑・資金は持ち越します。
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
npm.cmd run test:depth-browser
npm.cmd run test:reveal-browser
npm.cmd run balance:tools
npm.cmd run balance:river
npm.cmd run balance:routes
npm.cmd run test:field-browser
npm.cmd run balance:beach
npm.cmd run test:beach-browser
npm.cmd run balance:gold
npm.cmd run test:gold-browser
npm.cmd run test:river-browser
npm.cmd run test:production
```

ブラウザ試験はインストール済みGoogle Chromeを利用します。開発版と本番版のセーブは別です。開発版は設定のVERSIONを5回タップしてDEBUG LABを開き、専用テストセーブでFN変更・道具付与・お宝出現等を利用できます。

## ファイル

- `src/data.ts`, `src/master-source.json`: 36お宝・126道具・16連携・12エリア
- `src/engine.ts`: UIに依存しないゲームロジック
- `src/save.ts`: IndexedDB・バックアップ・形式移行
- `src/surface.ts`: 斜め投影・穴の描画・道具SVG・カーソル
- `src/main.ts`, `src/style.css`: 入力・UI・上部トースト・タッチアイコン
- `src/tool-value.ts`: 探知情報・品質保護・道具実測レポート
- `src/reveal.ts`: 洗浄演出と完了状態
- `src/river.ts`, `src/river-view.ts`: 川底の独立回収処理と水面描画
- `src/dev.ts`, `src/dev-actions.ts`, `src/dev.css`: 開発専用DEBUG LAB
- `src/gold.ts`, `src/gold-ui.ts`, `src/gold-view.ts`: 河原・砂利・選別・作業台
- `src/equipment.ts`, `src/measure.ts`: カテゴリ別装備・共通工程実測
- `src/dev-gold.ts`: 開発専用の河原シナリオ
- `src/beach-tools.ts`, `src/shop.ts`: 砂浜の性能・解放・ショップ比較
- `src/dev-beach.ts`, `src/dev-beach-ui.ts`: 開発専用の固定条件比較・深度シナリオ
- `src/field-tools.ts`, `src/field-shop.ts`: 川底・河原の追加性能と比較
- `src/dev-field.ts`, `src/dev-routes.ts`, `src/dev-route-ui.ts`, `src/dev-route-worker.ts`: 購入前後・購入ルートの開発専用比較
- `src/events.ts`: 上限100件の重要イベント
- `tests/`, `scripts/`: 自動テスト・模擬プレイ・ブラウザ試験
- `docs/`: 仕様・判断・試験結果・今後の計画

R-C/R-D、G-C/G-Dなどの将来エリア・80道具はマスターのみです。オンライン同期・オフライン収益はありません。詳細は `docs/GAME_SPEC.md` と `docs/TEST_RESULTS.md` を参照してください。
