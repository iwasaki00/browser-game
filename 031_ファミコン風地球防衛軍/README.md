# ドット防衛戦線 — PIXEL DEFENSE FRONT

Version 0.1.0 — First Mission。ビルド不要で動く、オリジナルの8bit風横スクロール防衛アクションです。

## 起動

リポジトリのルートで静的HTTPサーバーを起動し、`031_ファミコン風地球防衛軍/` を開きます。

```powershell
py -3 -m http.server 8000
```

## 操作

- PC：A/Dまたは左右キーで移動、W/上/Spaceでジャンプ、マウスで照準・射撃、Q/E/Shiftで武器切替、Esc/Pでポーズ
- スマホ：横向き推奨。左パッドで移動・ジャンプ、右パッドで照準・射撃、SWで武器切替

## 開発

- 素材再生成：`py -3 tools/generate_assets.py`
- テスト：`npm test`
- 外部ライブラリ、外部API、ダウンロード素材は使用していません。

仕様資料は `docs/`、生成素材一覧は `docs/ASSET_MANIFEST.md` にあります。
