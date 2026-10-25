# 0.3.0 — COASTAL DEFENSE / 3ミッション比較・QA

2026-10-25 / Windows Chrome / ローカルHTTP。実ブラウザ操作で取得。iPhone実機ではない。

## 同条件の3枚

[横並び比較PNG（2532×434）](missions-side-by-side.png) ／ [画像一覧](index.html)。

- RANGER・A-01、UNIFIED 01、固定カメラ0.50、描画640×360（LAB）、CSS画面844×390。
- 既存LAB自由配置を使用。3ミッションともプレイヤーworld x1000/y116、カメラx680、HP100、敵消去、スコア0、FPSオーバーレイOFF、LEVEL1。
- 画面ごとの経過時間／アニメーション位相は一致させていない。敵出現やミッション攻略の比較ではない。
- 開始告知を消すための通常ゲーム用撮影コードは追加していない。既存の敵生成／全消去で自由配置状態を作成。
- [各画面のDOM設定記録](comparison-settings.json)。PNGは実JPEGを原寸のまま横に並べ、44pxの条件ラベルだけを上へ追加。元画像はリサイズ・補正なし。
- 再結合：`py -3 tools/build_mission_comparison.py`。

| M01 | M02 | M03 |
| --- | --- | --- |
| [市街地](m01-ranger-unified640.jpg) | [地下](m02-ranger-unified640.jpg) | [港湾](m03-ranger-unified640.jpg) |
| 青黒い都市と建物 | 閉じた天井・配管・紫灰岩盤 | 海の水平線・侵略艦影・クレーン・岸壁道路 |

RANGERのサイズ・足元・装備は共通。港湾は遠景の彩度を抑え、地面上面を明るくして操作領域を区別できる。M01/M02の既存素材は変更していない。0.50倍・640での代表比較であり、320遠景の全ポーズ／大量重複／全武器FXの視認性を保証するものではない。

## 参考画像

- [B-03 直接開始（警告・カメラ追従遷移中）](m03-boss-unified640.jpg)
- [E-08 200体・LAB限定](m03-rays200.jpg)
- [E-07 海上侵攻テスト](m03-sea-invasion.jpg)
- [M03 LAB 横画面](lab-m03-844x390.jpg)
- [M03 LAB 縦画面](lab-m03-390x844.jpg)

B-03画像は開始直後の警告と追従途中。通常のカメラ基本仕様は維持し、定常状態のフレーミングは自動テストでも確認。参考画像のズーム／敵数は主比較3枚とは異なる。

## ブラウザで実行した操作

- M03全5チェックポイントをCで開始し、各M03-A1〜A5-MAINのステータスを確認。
- B-03直接開始でHPバー・海洋ボス・ボスカメラを表示。
- E-08の200体生成、E-07の海上侵攻30体再配置、砲台ON/OFFを操作。
- LAB5タブを維持。844×390と390×844でパネル／フッター画面内、中央横はみ出し0、外枠縦スクロール0。
- コンソールの警告／エラー0件。
- [操作・矩形記録](browser-verification.json)。

ブラウザはLAB経路の実表示確認。通常URLからM02クリアしてM03を全編攻略した確認ではない。正常進行／報酬保存は下記の実更新QAで検証した。

## 関連テスト・攻略区分

Node関連 **204件成功、失敗0**。新規M03 20件に、既存のミッション／保存・LAB・武器・密度・カメラ・撃破演出・正式アートの影響範囲だけを合わせた。最終表示調整後に39件、海上侵攻調整後に34件、安全復帰／全兵科弱点命中の追加確認で20件を再実行し成功。無関係な全件テストは実行していない。

Python素材5件成功。固定シード再現、既存PNG不変、全寸法・二値透過・遠景外形・核アンカーを確認。構文／diff検査成功。Arcade親indexの差分なし。

| QA | 結果 | 区別 |
| --- | --- | --- |
| A 地形 | RANGER57.02s / SCOUT30.20s / GUARDIAN83.33s / WING49.57s、全5エリア・ワープなし・落下復帰0・侵入診断なし | 敵攻撃を止めた実移動 |
| C 無敵戦闘 | RANGER/L-03/STANDARD、70.77s・ボス13.35s・75撃破、全エリア→実射撃→B-03結果 | 通常セーブ不変 |
| 通常エンジンの保存QA | 同じ実移動／実射撃、ダメージ無効だけを補助、M03開始→ボス→通常リザルト・報酬・保存成功 | 人手のDではない |
| B スポット | 被弾・海面ダメージ・衝突・射撃・ボス攻撃の判定を確認 | 無敵なし全編攻略は未確認 |
| D 通常人手攻略 | 未確認 | A/C成功をD成功と呼ばない |

初期の32px切れ目はGUARDIANの早めジャンプで反復落下したため、M03だけ24pxへ調整。兵科性能や既存M01/M02を変えず、全4兵科で通過を再確認した。

## FPS・CPU

[実ブラウザの計測表示記録](performance-observations.json)。

| LABの生存敵数 | 有効サンプル | 除外中断 | FPS・更新／描画CPU |
| ---: | ---: | ---: | --- |
| 50 | 0 | 4 | 測定不能 |
| 100 | 0 | 4 | 測定不能 |
| 200 | 0 | 4 | 測定不能 |

各区間で約1001msのフレーム中断が記録された。既存計測器は正常FPSへ加算せず除外表示した。この環境のブラウザ停止・低頻度実行をゲーム性能の優劣として評価しない。Nodeテスト実行時間も実FPSやiPhoneのCPU時間へ換算しない。

## 作成・変更ファイル

- 新規ロジック／描画：`js/mission03.js`、`js/coastal-art.js`。
- 接続：`js/game.js`、`js/data.js`、`js/invasion.js`、`js/camera.js`、`js/impact.js`、`js/mission-lab.js`、`js/playground.js`、`js/weapons.js`、`js/mission02.js`（isBossへのB-03追加のみ）。
- UI／version：`index.html`、`package.json`。CSSの再設計なし。
- 素材：`tools/coastal_assets.py`、`tools/generate_assets.py`（専用CLI入口）、`assets/coastal-01/`（19シート＋一覧PNG、manifest、218セル）。実行時は16シート、分離3背景は合成元。
- テスト：`tests/coastal.test.mjs`、`tests/test_coastal_assets.py`、`tests/helpers/runtime.mjs`、`tests/data.test.mjs`、`tests/lab-ui.test.mjs`、`tests/mission-lab.test.mjs`、`tests/mission02.test.mjs`（version・新ミッション・チェックポイント期待値）。
- 文書：README、GAME_SPEC、ASSET_MANIFEST、DEBUG_PLAYGROUND、ART_UNIFICATION、新規[MISSION_03](../../docs/MISSION_03.md)。
- 比較：`tools/build_mission_comparison.py`、本フォルダ。

## 未確認・次の改善候補

実機iPhone Safari・実タッチ・長時間前景のFPS/CPU/GPUメモリ、無敵なしの人手通常攻略D、初期武器の難易度、全20武器FXと新地形の全組合せの目視、通常URLからの全編M03ブラウザ攻略は未確認。

次はDで対空射撃・回復配置・Phase3の予兆回避・海面復帰を検証し、実機50/100体の有効前景測定を優先する。QAの短いクリア時間だけでバランスを無断変更しない。

