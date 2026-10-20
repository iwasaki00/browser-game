# ドット防衛戦線 — PIXEL DEFENSE FRONT

Version 0.1.1 — PORTRAIT LAYOUT TUNE。ビルド不要で動く、オリジナルの8bit風横スクロール防衛アクションです。

## 起動

リポジトリのルートで静的HTTPサーバーを起動し、`031_ファミコン風地球防衛軍/` を開きます。

```powershell
py -3 -m http.server 8000
```

## 操作

- PC：A/Dまたは左右キーで移動、W/上/Spaceでジャンプ、マウスで照準・射撃、Q/E/Shiftで武器切替、Esc/Pでポーズ
- スマホ：縦向きが主表示です。上段のゲーム画面と下段の専用操作面を使い、左側で移動・ジャンプ、右側で武器切替・照準・射撃を行います。横向きでも基本操作ボタンを表示します。

## モバイル表示

- `portrait` / `landscape` を画面向きから自動判定し、HTMLの `data-layout` に反映します。
- 縦表示はカメラ倍率を `0.80` にして、横方向の可視範囲を320から400ワールドピクセルへ拡大します。CSS縮小ではなくCanvas描画座標へ適用します。
- `100dvh` と `visualViewport.height` を併用し、Safariのアドレスバー伸縮時にもレイアウト高を更新します。
- ヘッダー、操作面、モーダルに `env(safe-area-inset-*)` を適用しています。
- 仮想パッドのFIREは最大132pxの円形操作面とし、狭幅端末向けに104pxまで縮小します。

詳細は `docs/LAYOUT_SPEC.md` を参照してください。

## 開発

- 素材再生成：`py -3 tools/generate_assets.py`
- テスト：`npm test`
- 外部ライブラリ、外部API、ダウンロード素材は使用していません。

仕様資料は `docs/`、生成素材一覧は `docs/ASSET_MANIFEST.md` にあります。
