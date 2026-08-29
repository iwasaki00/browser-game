# 効果音全部オレゲーム

自分の声や身の回りの音を録音し、その音をゲーム内の効果音として使うブラウザミニゲーム集です。

収録ゲーム：

- 縦スクロールシューティング
- 横スクロールアクション
- 効果音全部オレ 3マッチ（60秒スコアアタック）

共通サウンドスタジオは選択中ゲームの定義から必要音を生成します。録音・保存・再生・設定画面をゲームごとに複製していません。

## 起動方法

静的ファイルだけで動作します。録音を使わず試す場合は `index.html` を開いて「すぐ遊ぶ」を選べます。録音にはHTTPSまたはlocalhostが必要です。

例：リポジトリ直下で `python -m http.server 8000` を実行し、`http://localhost:8000/023_koukaon-ore-game/` を開きます。

## アクションの操作

iPhoneでは画面下部の左右ボタン、JUMP、ATTACKを使います。Pointer Eventsで同時押しに対応しています。

PCでは `←` / `→` で移動、`Space` でジャンプ、`Z` で攻撃します。

## 3マッチのルールと操作

8×8盤面の隣接ピースをスワイプ、または2個を順番にタップして交換します。縦横に3個以上揃うと消去され、落下・補充後に再び揃うとオレ連鎖になります。成立しない交換は自動的に戻ります。

連鎖音は消去開始時に次の順で鳴ります。

- 1連鎖: `puzzleMatch`
- 2連鎖: `puzzleChain2`
- 3連鎖: `puzzleChain3`
- 4連鎖: `puzzleChain4`
- 5連鎖以上: `puzzleChain5`

4個揃えると縦または横のライン特殊ピース、5個以上では同色全消去ピースを生成します。一度に10個以上消すと大量消去音も重なります。操作が5秒ない場合はヒントを表示し、有効交換がない盤面は自動シャッフルします。

最高スコア、自己ベスト最大連鎖、累計プレイ回数はIndexedDBへ保存します。サウンドチェックの「オレ連鎖テスト」では、1～5連鎖の録音を順番に確認できます。

## マイク利用条件とiPhone Safari

- マイク取得にはHTTPSまたはlocalhostが必要です。
- Safariでマイク許可を求められたら「許可」を選びます。拒否後はSafariのサイト設定から変更します。
- AudioContextはボタン操作時に開始・再開します。バックグラウンド復帰後に音が止まった場合は再開通知か、設定の「サウンドを再開」を押します。
- 縦持ち、Safe Area、ホームインジケータを考慮しています。
- 振動は `navigator.vibrate` がある環境だけで使います。

## 保存

録音Blob、サウンドパック、選択中ゲーム、設定、各ゲームの記録をIndexedDBへ保存します。音声はサーバーへ送信しません。既存ゲーム用の音声キーは変更せず、同じパックの `sounds` へ3マッチ用キーを追加します。

## ファイル構成

```text
023_koukaon-ore-game/
├─ index.html
├─ css/
│  ├─ style.css
│  ├─ action.css
│  └─ puzzle.css
├─ js/
│  ├─ config.js
│  ├─ StorageManager.js
│  ├─ SoundManager.js
│  ├─ RecorderManager.js
│  ├─ GameManager.js
│  └─ app.js
├─ games/
│  ├─ shooter/ShooterGame.js
│  ├─ action/ActionGame.js
│  └─ puzzle/
│     ├─ PuzzleBoard.js
│     ├─ PuzzleRenderer.js
│     └─ PuzzleGame.js
├─ tests/
└─ assets/og.png
```

## ゲーム追加方法

1. `config.js` の `gameDefinitions` と `soundCatalog`へ定義を追加します。
2. `games/<ゲーム名>/` に、共通の開始・停止インターフェースを持つゲームクラスを追加します。
3. `app.js` で `GameManager.registerGame()` に登録し、HTMLからスクリプトを読み込みます。

ゲーム本体は音声Blobへ直接触れず、`SoundManager.play("効果音キー")` のみを呼びます。SoundManagerは同じキーへ将来複数のAudioBufferを登録できる配列構造です。

## 効果音統計

ゲーム開始時に `SoundManager.resetPlayStats()`、終了時に `SoundManager.getPlayStats()` を利用します。既存の `resetCounts()` / `getCounts()` も互換用に残しています。

## 現時点の制限

- 自動トリミングは設定のみで、録音波形の切り詰めは未実装です。
- サウンドパックの端末外への書き出し・読み込みはありません。
- アクションは1ステージ構成です。
- 3マッチは60秒モードのみで、盤面サイズと制限時間の変更UIは未実装です。
- `actionDash` は録音・試聴に対応していますが、ゲーム操作としてのダッシュは次回拡張向けです。
- MediaRecorderの録音形式はSafariの実装に依存します。
