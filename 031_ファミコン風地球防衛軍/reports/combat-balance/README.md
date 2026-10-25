# Version 0.3.1 — COMBAT BALANCE & BOSS POLISH

2026-10-25 / ローカルChrome。通常攻略D・iPhone Safari実機の認定ではない。

## 実装と変更ファイル

- B-03 Phase1/2/3候補と明示開始。HP3000/1950/900、完全な戦闘初期化、装備・兵科・無敵の維持、通常保存なし。
- 予兆と判定が同じ `attackPlan` を使用。HP境界で予告内容を変更せず、発射時の再照準も廃止。触手の端間隔、地上波の排他的回避時間を修正。
- 4兵科・初期武器の実更新QA、E-08の編隊重複・降下予兆、連続前景のみ採用する計測器。

| 分類 | ファイル |
| --- | --- |
| 起動・UI・表示版数 | `index.html`, `package.json`, `js/data.js`（版数のみ） |
| 戦闘・LAB・描画 | `js/game.js`, `js/mission03.js`, `js/coastal-art.js`, `js/invasion.js`（E-08降下予約を既存枠へ計上する1条件のみ） |
| LAB状態・記録・計測 | `js/playground.js`, `js/mission-lab.js`, `js/profiler.js` |
| 関連テスト | `tests/boss-polish.test.mjs`（新規38件）, `tests/data.test.mjs`, `tests/lab-ui.test.mjs`, `tests/mission-lab.test.mjs`, `tests/playground.test.mjs` |
| 文書 | `README.md`, `docs/MISSION_03.md`, `docs/TEST_LAB_UI.md`, `docs/COMBAT_BALANCE.md`（新規） |
| 検証記録 | このREADME、`performance.json`, `browser-verification.json`, 同フォルダの実画像 |

## ブラウザで確認したこと

Phase1→2→3→1を実行し、M03／B-03のHP3000／1950／900と画面内のPhase表示を確認。Phase候補の選択だけでは現在ステージを変更しない。Tabで候補から開始ボタンへ移動し、Enterでも開始できる。LAB開閉、5タブ、統合アートの選択、計測表示、50体のE-08生成を実操作した。

| CSS画面 | Phase候補／開始 | 操作高さ | 中央の横はみ出し | LAB外枠の縦はみ出し | ヘッダー・フッター |
| --- | --- | ---: | ---: | ---: | --- |
| 844×390 | 到達可能、候補のみでは再開始なし | 44px | 0 | 0 | 画面内固定 |
| 780×360 | 到達可能、EnterでPhase2開始 | 44px | 0 | 0 | 画面内固定 |
| 390×844 | 到達可能、タップ相当でPhase3開始 | 44px | 0 | 0 | 画面内固定 |

中央は必要に応じて内部スクロールする。1画面に全項目を押し込んだ検証ではない。実タッチ・ノッチ・Safariアドレスバーの変化は未確認。

### 実画像

- [Phase選択 844×390](lab-phase-844x390.jpg)
- [Phase選択 780×360](lab-phase-780x360.jpg)
- [Phase選択 390×844](lab-phase-390x844.jpg)
- [B-03 Phase3／GUARDIAN／統合アート](b03-phase3-844x390.jpg)
- [E-08 50体／統合アート](e08-50-844x390.jpg)
- [最終版BENCHの有効サンプル不足表示](lab-metrics-844x390.jpg)

画像はブラウザの実画面。撮影タイミング・カメラ条件の異なる場面を性能比較用の同一フレームとは扱わない。

## 関連テスト

以下の影響範囲 **171件成功、失敗0**。B-03初期待機・砲撃予告表示・フォーカス判定の最終修正後に実行。無関係な全件回帰や全画面GUIテストは実施していない。

```powershell
node --test tests/boss-polish.test.mjs tests/coastal.test.mjs tests/mission-lab.test.mjs tests/playground.test.mjs tests/lab-ui.test.mjs tests/invasion.test.mjs tests/data.test.mjs tests/classes.test.mjs tests/art-release.test.mjs
```

構文検査と `git diff --check` も実施。生成素材が変わらないため、素材再生成や無関係なPythonテストは実行しない。

| 確認 | 結果と範囲 |
| --- | --- |
| Phase初期化／再開始 | 各Phase3回。旧弾・FX・触手・設置・召喚・編隊なし、タイマー・行動・弱点・カメラ整合 |
| 予兆→判定 | 端を含め、同じ矩形が実判定へ移る。Phase跨ぎで予告数不変、弾の照準も固定 |
| 4兵科・触手 | 反応0.25秒＋実移動。最遅RANGER0.783／SCOUT0.533／GUARDIAN1.033／WING0.717秒、予兆1.25秒未満 |
| 広範囲波 | 実ジャンプ／飛行で上端Y136を越えられる。古いボス弾と波の準備が重ならず、波の後は5.25秒待機 |
| 単独の扇状弾 | 各兵科×全Phase、無敵なしB・実弾当たり判定で無被弾の回避経路を確認 |
| 初期武器 | 4兵科×A-01/S-02、地上／空中／砲撃敵・ボス核へ実弾命中 |
| 初期武器ボス撃破 | 各兵科でC固定射撃。A-01 44.83秒／S-02 82.58秒、全Phaseを通り結果へ。無敵あり・直接開始でありDではない |
| M03地形 | 全4兵科が実移動Aで全5エリア→ボス入口、救助0。戦闘なしの到達性 |
| E-08 | 50体、V字6個体の異なる座標、降下予兆と同時枠、HP45維持、非攻撃姿勢の地上クリアランス、配列順不変 |
| 保存・既存進行 | LABの保存バイト列不変、旧セーブ移行・解放・報酬・M01/M02のA/C基本進行を確認 |
| 計測器 | ウォームアップ・非表示・操作中断・長い間隔・短断片の破棄・採用条件・終了後の停止を確認。合成60Hzは実機FPSではない |

## FPS・CPU参考値

最終版の同条件BENCHは844×390／ORIGINAL／320×180／既存M01自動射撃。50・100・200体は全て**測定不能**。連続区間が不足したため、FPS・p95・CPU平均をnullで記録した。

| 個体数 | 採用サンプル／区間 | 除外中断 | 最大除外間隔 | FPS・CPU |
| --- | ---: | ---: | ---: | --- |
| 50 | 0／0 | 6 | 1000.9ms | 測定不能 |
| 100 | 0／0 | 7 | 1001.1ms | 測定不能 |
| 200（LAB） | 0／0 | 6 | 1001.0ms | 測定不能 |

途中の確認では表示中タブの短い区間から参考値を得たが、フォーカスの確認が不足していたため最終結果へ採用しない。最終版は非表示・フォーカスなし・LAB操作・長いフレーム間隔・ウォームアップ・短い断片を別々に除外する。正常な前景サンプルが不足する環境でFPSやCPU平均を無理に算出しない。実機の持続FPSや描画性能の優劣は未確認で、根拠のない性能改修は行わない。

[生データ](performance.json)。手動計測手順は [COMBAT_BALANCE](../../docs/COMBAT_BALANCE.md)。

## 保護と未確認

基準0.3.0に対して `js/data.js` はVERSIONだけ変更。武器・兵科数値、`js/weapons.js`, `js/player.js`, `js/mission02.js`, `js/camera.js`, 全既存assetsに差分なし。M03の地形・エリア・敵配置・解放・報酬も維持。Arcade031のリンクは編集していない。

未確認：iPhone Safari実機・マルチタッチ・VoiceOver、4兵科で初期武器を使った全編無敵なし人手D、あらゆる召喚・弾幕配置の複合回避保証、実機の持続FPS／GPU負荷。A/Bの単独回避・Cの撃破をDの攻略成功とは表現しない。

次はGuardian＋初期武器の人手Dと実機50/100体の連続前景測定を優先する。今回M04・武器・兵科・敵の追加、素材の再制作はしていない。
