# ドット防衛戦線 — PIXEL DEFENSE FRONT

Version 0.1.2 — WIDE VIEW & STAGE PROGRESSION。ビルド不要で動く、オリジナルの8bit風横スクロール防衛アクションです。

## 起動

リポジトリのルートで静的HTTPサーバーを起動し、`031_ファミコン風地球防衛軍/` を開きます。

```powershell
py -3 -m http.server 8000
```

## 操作

- PC：A/Dまたは左右キーで移動、W/上/Spaceでジャンプ、マウスで照準・射撃、Q/E/Shiftで武器切替、Esc/Pでポーズ
- スマホ：横向き推奨。左側で移動・JUMP、右側で武器切替・FIREを操作します。FIREを押して射撃し、ドラッグで照準方向を変更します。縦向きでも従来のゲーム画面上段・操作面下段の構成でプレイできます。
- 左上の「← TITLE」でゲーム内タイトルへ戻れます。ミッション中は確認を表示し、キャンセルすると継続します。確定すると進行中ミッションを破棄し、取得済み武器とステージ進行記録を保持します。

## モバイル表示

- `portrait` / `landscape` を画面向きから自動判定し、HTMLの `data-layout` に反映します。
- landscape・portrait・PCともカメラ倍率は `0.70`、横方向の可視範囲は約457.14ワールドピクセルです。背景を含むワールド描画に適用し、HUDは等倍を維持します。
- `100dvh` と `visualViewport.height` を併用し、Safariのアドレスバー伸縮時にもレイアウト高を更新します。
- ヘッダー、操作面、モーダルに `env(safe-area-inset-*)` を適用しています。
- 仮想パッドのFIREは最大132pxの円形操作面とし、狭幅端末向けに104pxまで縮小します。

詳細は `docs/LAYOUT_SPEC.md` を参照してください。

## ステージ進行とセーブ

- セーブは同じlocalStorageキー `pixel-defense-front-save-v1` を継続使用し、中身を形式バージョン2へ移行します。
- `clearedMissions` にクリア済みID、`unlockedMissions` に解放済みIDを保存します。初期状態はM01のみ解放です。
- M01クリアでM02の解放記録を保存しますが、現在実装済みなのはM01のみです。M02は `COMING SOON` と表示し選択できません。
- `CLEAR` は再挑戦可能、`OPEN` は挑戦可能、`LOCKED` は未解放、`COMING SOON` は未実装を示します。
- GAME OVER、リトライ、タイトルへの復帰、リロードで解放状態は巻き戻りません。GAME OVER画面からミッション選択へ戻れます。
- 旧セーブの `cleared` を引き継ぎ、武器解放・装備・スコア・設定も保持します。将来の実装判定は `MISSIONS` で管理し、進行記録と分離しています。

## 開発

- 素材再生成：`py -3 tools/generate_assets.py`
- テスト：`npm test`
- 外部ライブラリ、外部API、ダウンロード素材は使用していません。

仕様資料は `docs/`、生成素材一覧は `docs/ASSET_MANIFEST.md` にあります。
