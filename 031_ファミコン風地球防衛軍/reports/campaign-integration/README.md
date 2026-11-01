# CAMPAIGN INTEGRATION QA / 1.2.0-B1

実行日時：2026-11-01T13:16:24.960Z（UTC、利用者TZ Asia/Tokyo）。終了：2026-11-01T13:18:49.711Z。Node v25.9.0 / win32。対象HEAD：dfad8500a4bf5045702dc401b00fc23770c838c3＋ローカル変更（詳細JSON）。公開・commit・push・デプロイなし。

## 集計

| 総ケース | 成功 | 失敗 | NORMAL_SIM未クリア | 未実施HUMAN | BLOCKER | HIGH | MEDIUM | LOW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 156 | 140 | 0 | 8 | 8 | 0 | 0 | 0 | 0 |

上記は試験グループ・行の数。関連Nodeスイートは別に693テスト。NOT_CLEAREDは実行済み戦闘で未クリア、NOT_RUNは未実施であり、PASSと区別する。各ケースの環境・失敗位置・兵科・武器・保存検証は[results.json](results.json)、関連詳細は[related-tests.txt](related-tests.txt)。

## 全8作戦の連続進行（ASSISTED）

| ミッション | 結果 | 保存・再初期化 |
| --- | --- | --- |
| M01 | PASS 80.68秒 | 実射撃→正式リザルト→保存→reload |
| M02 | PASS 81.48秒 | 実射撃→正式リザルト→保存→reload |
| M03 | PASS 98.42秒 | 実射撃→正式リザルト→保存→reload |
| M04 | PASS 155.02秒 | 実射撃→正式リザルト→保存→reload |
| M05 | PASS 277.78秒 | 実射撃→正式リザルト→保存→reload |
| M06 | PASS 168.82秒 | 実射撃→正式リザルト→保存→reload |
| M07 | PASS 172.87秒 | 実射撃→正式リザルト→保存→reload |
| M08 | PASS 291.80秒 | 実射撃→正式リザルト→保存→reload |

新規メモリ保存→通常司令部・装備・出撃。RANGER / A-01,S-02 / STANDARD。唯一の戦闘補助はinvuln=3600。開始後の座標ワープ、敵HP／クリアフラグの代入はなし。必須制御は実射撃。M08全6シーン、最終撃破直後の再読込、再視聴、M01/M08再クリアの初回報酬非再付与も確認。途中戦闘位置復元は既存仕様外で追加していない。

## 4兵科×8作戦：32到達ケース

| 作戦 | RANGER | SCOUT | GUARDIAN | WING |
| --- | --- | --- | --- | --- |
| M01 | PASS 43.48秒 | PASS 22.92秒 | PASS 62.78秒 | PASS 37.43秒 |
| M02 | PASS 49.72秒 | PASS 26.65秒 | PASS 72.63秒 | PASS 43.13秒 |
| M03 | PASS 57.02秒 | PASS 30.20秒 | PASS 83.33秒 | PASS 49.57秒 |
| M04 | PASS 65.45秒 | PASS 34.35秒 | PASS 94.52秒 | PASS 56.12秒 |
| M05 | PASS 72.28秒 | PASS 42.95秒 | PASS 103.60秒 | PASS 64.32秒 |
| M06 | PASS 73.12秒 | PASS 39.13秒 | PASS 107.93秒 | PASS 62.93秒 |
| M07 | PASS 81.05秒 | PASS 44.55秒 | PASS 118.42秒 | PASS 70.22秒 |
| M08 | PASS 87.55秒 | PASS 49.13秒 | PASS 127.95秒 | PASS 75.62秒 |

STRUCTURAL：LAB AREA01から実移動・必須制御射撃、攻撃除外、5エリア到達。次表の同兵科ボス実射撃・リザルトを組み合わせる。全32ケースを通常全編クリアしたとの意味ではない。

## 初期武器64ケース

| 作戦 | 兵科 | A-01 | S-02 |
| --- | --- | --- | --- |
| M01 | RANGER | PASS 19.88秒 | PASS 31.87秒 |
| M01 | SCOUT | PASS 19.88秒 | PASS 31.87秒 |
| M01 | GUARDIAN | PASS 19.88秒 | PASS 32.52秒 |
| M01 | WING | PASS 19.88秒 | PASS 31.87秒 |
| M02 | RANGER | PASS 31.35秒 | PASS 55.92秒 |
| M02 | SCOUT | PASS 31.35秒 | PASS 57.22秒 |
| M02 | GUARDIAN | PASS 32.82秒 | PASS 58.52秒 |
| M02 | WING | PASS 31.35秒 | PASS 55.27秒 |
| M03 | RANGER | PASS 40.95秒 | PASS 65.67秒 |
| M03 | SCOUT | PASS 40.68秒 | PASS 63.72秒 |
| M03 | GUARDIAN | PASS 41.48秒 | PASS 66.97秒 |
| M03 | WING | PASS 40.95秒 | PASS 65.02秒 |
| M04 | RANGER | PASS 89.42秒 | PASS 157.38秒 |
| M04 | SCOUT | PASS 84.48秒 | PASS 154.15秒 |
| M04 | GUARDIAN | PASS 91.68秒 | PASS 166.52秒 |
| M04 | WING | PASS 88.08秒 | PASS 156.08秒 |
| M05 | RANGER | PASS 75.78秒 | PASS 135.92秒 |
| M05 | SCOUT | PASS 72.18秒 | PASS 129.40秒 |
| M05 | GUARDIAN | PASS 77.78秒 | PASS 141.12秒 |
| M05 | WING | PASS 73.52秒 | PASS 130.72秒 |
| M06 | RANGER | PASS 87.80秒 | PASS 152.17秒 |
| M06 | SCOUT | PASS 80.60秒 | PASS 134.63秒 |
| M06 | GUARDIAN | PASS 98.15秒 | PASS 158.62秒 |
| M06 | WING | PASS 90.02秒 | PASS 143.07秒 |
| M07 | RANGER | PASS 90.73秒 | PASS 148.30秒 |
| M07 | SCOUT | PASS 90.87秒 | PASS 157.37秒 |
| M07 | GUARDIAN | PASS 92.20秒 | PASS 156.08秒 |
| M07 | WING | PASS 90.07秒 | PASS 148.93秒 |
| M08 | RANGER | PASS 202.48秒 | PASS 308.18秒 |
| M08 | SCOUT | PASS 193.28秒 | PASS 308.18秒 |
| M08 | GUARDIAN | PASS 202.08秒 | PASS 320.53秒 |
| M08 | WING | PASS 191.82秒 | PASS 315.33秒 |

STRUCTURALの攻撃成立性検証。ボス地点開始、LAB無敵、実際の移動・射撃・装置破壊・盾解除・撃破・LAB結果。通常人手攻略やワープなし全編戦闘ではない。M05〜08は既存入力専用controllerを共通化。ボス前制御は到達ケース・連続QAで実射撃を実施。

## 20武器・保存・隔離

| 項目 | 結果 |
| --- | --- |
| CHAIN-COMPLETE-REPLAY | PASS |
| REPEAT-M01 | PASS |
| REPEAT-M08 | PASS |
| SAVE-S01 | PASS |
| SAVE-S02 | PASS |
| SAVE-S03 | PASS |
| SAVE-S04 | PASS |
| SAVE-S05 | PASS |
| SAVE-S06 | PASS |
| SAVE-S07 | PASS |
| SAVE-S08-LEGACY | PASS |
| SAVE-S09-MISSING | PASS |
| SAVE-S10-CORRUPT | PASS |
| ISOLATION-LAB | PASS |
| ISOLATION-gameplay | PASS |
| WEAPON-A-01 | PASS |
| WEAPON-S-02 | PASS |
| WEAPON-L-03 | PASS |
| WEAPON-R-04 | PASS |
| WEAPON-F-05 | PASS |
| WEAPON-T-06 | PASS |
| WEAPON-G-07 | PASS |
| WEAPON-H-08 | PASS |
| WEAPON-B-09 | PASS |
| WEAPON-R-10 | PASS |
| WEAPON-X-11 | PASS |
| WEAPON-P-12 | PASS |
| WEAPON-P-13 | PASS |
| WEAPON-G-14 | PASS |
| WEAPON-F-15 | PASS |
| WEAPON-T-16 | PASS |
| WEAPON-S-17 | PASS |
| WEAPON-M-18 | PASS |
| WEAPON-D-19 | PASS |
| WEAPON-M-20 | PASS |

武器試験は解放済みテスト保存・通常装備導線・静止HP50000の射撃標的を使用。実ダメージ、使用1回（複数弾も1）、有効命中統計、設置／jobs／弾の再出撃初期化を検証。マインはV起爆、メテオは実照準位置に標的を配置。これは連続QAの敵性能変更ではない。S01〜07は同一実行の正式連続クリアスナップショット、S08は既存v1 cleared形式、S09欠損、S10不正値。LABの200体生成・消去・ボス撃破・仮想完結・終了と通常攻略QAプリセットは、保存内容だけでなくsetItem呼出数も不変。起動時の正常化保存は監視の基準前として分離。

## NORMAL_SIM：被ダメージ有効の代表8ケース

| 作戦 | 兵科 | 結果 | HP最大/残 | 被弾/被害 | 到達AREA | 撃破 | ボス到達 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M01 | RANGER | NOT_CLEARED | 100/0 | 13/125.0 | 3 | 50 | NO |
| M02 | GUARDIAN | NOT_CLEARED | 200/0 | 41/300.0 | 5 | 74 | YES |
| M03 | SCOUT | NOT_CLEARED | 75/0 | 7/75.0 | 2 | 1 | NO |
| M04 | WING | NOT_CLEARED | 65/0 | 4/65.0 | 2 | 3 | NO |
| M05 | RANGER | NOT_CLEARED | 100/0 | 14/162.0 | 2 | 6 | NO |
| M06 | GUARDIAN | NOT_CLEARED | 200/0 | 23/231.5 | 3 | 20 | NO |
| M07 | SCOUT | NOT_CLEARED | 75/0 | 4/75.0 | 2 | 1 | NO |
| M08 | WING | NOT_CLEARED | 65/0 | 4/65.0 | 1 | 0 | NO |

無敵なし・通常HP・初期装備・STANDARD。死亡原因候補のsourceX／致死量／位置／時刻、観測予兆フレーム数をJSON収録。全般的な予兆回避方策を持たないcontrollerのため、未クリアはE（自動操作能力不足）の暫定分類。A〜Dの進行・当たり判定不具合や理論的回避不能をこの結果から断定せず、難易度を下げていない。HUMAN全8件は未実施。

## 修正と保護

ゲーム本体の進行不能・保存破損・攻撃性能不具合は今回の範囲で再現せず、戦闘パラメータを変更していない。修正はQAのボス撃破後遅延コールバック処理、起動時保存を含めない書込監視、M07実装後もCOMING SOONを期待していた旧テスト、リトライ時の正当な出撃統計加算を禁止していた旧テストの整合。回帰テスト3件追加。バージョン表示以外、武器・兵科・AI・地形・アート・カメラ・保存形式・Arcade031は維持。

## ブラウザ・未確認・1.2.0引継ぎ

ブラウザ操作はNode VMとは別証拠。[ブラウザ確認記録](browser-check.md)を参照。HUMAN全編・iPhone Safari実機・タップ位置・アート最終品質・前景30秒FPSは今回保証しない。Nodeの高速シミュレーション所要時間は実機FPSではない。精密な回避AIの追加や無敵なし成功を得るための難易度変更はしていない。

## 再実行

`npm run qa:campaign`。部分実行：`node tools/campaign-integration.mjs --section=chain|matrix|normal|saves|weapons`（実際には1値を指定）。固定乱数seed11001008・1/60秒。ユーザーのlocalStorageへ接続せず、各runtimeの隔離Mapだけへ書込。結果のUTC時刻と実績取得日時は毎回変わるが、固定条件の戦闘結果は再現可能。試験は既存game.jsのVM実行であり、ブラウザ描画・実機性能の保証ではない。
