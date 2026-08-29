# 効果音全部オレゲーム

自分の声や身の回りの音を録音し、その音をゲーム内の効果音として使うブラウザミニゲーム集です。

収録ゲーム：

- 縦スクロールシューティング
- 横スクロールアクション
- パズル（COMING SOON）

共通サウンドスタジオは選択中ゲームの定義から必要音を生成します。録音・保存・再生・設定画面をゲームごとに複製していません。

## 起動方法

静的ファイルだけで動作します。録音を使わず試す場合は `index.html` を開いて「すぐ遊ぶ」を選べます。録音にはHTTPSまたはlocalhostが必要です。

例：リポジトリ直下で `python -m http.server 8000` を実行し、`http://localhost:8000/023_koukaon-ore-game/` を開きます。

## アクションの操作

iPhoneでは画面下部の左右ボタン、JUMP、ATTACKを使います。Pointer Eventsで同時押しに対応しています。

PCでは次のキーを使用します。

- `←` / `→`: 移動
- `Space`: ジャンプ
- `Z`: 攻撃

穴へ落ちると開始地点または到達済みチェックポイントへ戻ります。ゴール到達後のリザルトにはクリアタイム、スコア、敵撃破、アイテム、ダメージ、落下、効果音使用回数を表示します。

## マイク利用条件とiPhone Safari

- マイク取得にはHTTPSまたはlocalhostが必要です。
- Safariでマイク許可を求められたら「許可」を選びます。拒否後はSafariのサイト設定から変更します。
- AudioContextはボタン操作時に開始・再開します。バックグラウンド復帰後に音が止まった場合は再開通知か、設定の「サウンドを再開」を押します。
- 縦持ち、Safe Area、ホームインジケータを考慮しています。
- 振動は `navigator.vibrate` がある環境だけで使います。

## 保存

録音Blob、サウンドパック、選択中ゲーム、設定、シューティング最高スコア、アクション最高スコア・最速クリアタイムをIndexedDBへ保存します。音声はサーバーへ送信しません。

既存シューティング用の音声キーは変更していないため、以前のサウンドパックをそのまま利用できます。同じパックの `sounds` へアクション用キーを追加します。

## ファイル構成

```text
023_koukaon-ore-game/
├─ index.html
├─ css/
│  ├─ style.css
│  └─ action.css
├─ js/
│  ├─ config.js              # ゲーム・効果音定義
│  ├─ StorageManager.js
│  ├─ SoundManager.js
│  ├─ RecorderManager.js
│  ├─ GameManager.js         # ゲーム登録と起動
│  └─ app.js                 # 共通UI
├─ games/
│  ├─ shooter/ShooterGame.js
│  └─ action/ActionGame.js
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
- `actionDash` は録音・試聴に対応していますが、ゲーム操作としてのダッシュは次回拡張向けです。
- MediaRecorderの録音形式はSafariの実装に依存します。
