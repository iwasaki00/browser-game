# FINAL GAME POLISH / 1.2.0-B

実施日：2026-11-01。ローカル実装・Node QAまで。実ブラウザ画像・実FPS・iPhone Safari・通常人手攻略は未確認。A1のHIGHリザルト停止は実機クローズ待ち。

## 1. Version

1.2.0-B — FINAL GAME POLISH。公開・commit・push・デプロイなし。

## 2. 変更ファイル

| 分類 | パス |
| --- | --- |
| 描画・入力・版 | `js/game.js`, `js/readability.js`（新規）, `js/camera.js`, `js/data.js`（VERSIONのみ） |
| UI・版 | `index.html`, `styles.css`, `package.json` |
| 試験 | `tests/final-polish.test.mjs`（新規）, `tests/helpers/runtime.mjs`, `tests/campaign-integration.test.mjs`, `tools/campaign-integration.mjs` |
| 手動比較・参考計測 | `tests/helpers/polish-scenes.js`, `tools/final-polish-preview.mjs`, `tools/polish-render-benchmark.mjs`（新規） |
| 仕様 | `README.md`, `docs/GAME_SPEC.md`, `docs/TEST_LAB_UI.md`, `docs/FINAL_GAME_POLISH.md`（新規） |
| 実行記録 | 本README, `cpu-before.json`, `cpu-after.json`, `reports/campaign-integration/README.md`, 同`results.json`, 同`related-tests.txt` |

UTF-8/BOMなし・LFを維持。適用範囲の.gitattributes/.editorconfigなし、core.autocrlf=true。GitのLF→CRLF警告は残るが、設定変更や全行変換はしていない。game.jsは26行追加・21行削除の局所差分。既存PNG変更なし。

## 3. 改善前の問題と根拠

修正前の新規12テストは1 PASS／11 FAIL。ただし未実装の新UI等の失敗も含み、11件すべてが既存不具合という意味ではない。実問題として、4兵科の無敵中drawImageが0件、装飾FXがプレイヤー・予兆より後、キャプチャ例外が未処理、pagehideで押下残留、微小方向反転が先読みを反転することをソース／隔離VMで確認。80 hitの各々が無関係な6ミッションFXへディスパッチされる480呼出しも確認した。

## 4. プレイヤー視認性

無敵点滅を消失ではなく70〜100%表示へ変更。RANGER／SCOUT／GUARDIAN／WINGに異なる淡色と小記号、足元補助を追加。既存画像・サイズ・装備アンカー・アニメーションは維持。4兵科とも描画が残り、描画前後のHP・位置・敵・保存状態が不変であることをテスト。背景上の実際の見やすさは未確認。

## 5. 敵弾・予兆

小型敵弾へ菱形の縁取り・方向線。既存素材も維持。6ミッションの既存予兆を装飾より後に描く。M06脈動、M07転移、M08複合攻撃も既存表示を優先し、実攻撃矩形の補助線を画面内24件まで追加。予兆位置・時間・攻撃判定は不変。元の予兆は間引かない。

## 6. タッチ

pagehide時にA1のresetInputを実行。残touchが0のtouchcancelで全解除。個別cancel／capture失敗では他の指を維持。FIRE／移動／FLY／HOLD／ジャンプ／SW長押しの所有権処理、パネル中入力遮断と一覧スクロールを保護。ヘッダーPAUSEはプレイ時だけ表示し、既存pause／resumeを利用する。DOMアダプターのイベント試験であり、実機の指操作の証拠ではない。

## 7. FX

混雑時は画面内hit/muzzle16描画・粒子48描画・通常爆発透過率72%。画面外装飾は予算を消費しない。配列・寿命・ダメージ更新はそのまま。ボス／固定部位の死亡表示と専用崩壊FXを優先。既存の3演出レベル・ヒットストップ・揺れ・発生総数上限は維持。50／100／200体×3演出レベルで既存の死亡・FX上限テストが通過した。

## 8. カメラ

先読み方向のみ0.12秒の継続で確定。正負交互の速度ノイズでは反転せず、持続した反転は追従することを30／60／144Hzで確認。倍率式・範囲0.35〜0.85・補間率・ボス枠・画面座標変換は維持。実プレイ中の感覚は未確認。

## 9. 性能の参考観測

実ブラウザ有効サンプル **0**：操作環境がOS error 3で起動不可。rAF FPS・実描画CPU・GPU時間は測定不能。以下は同じ80 hit描画fixtureを用いた**Node VM / Canvas proxy**で、実ブラウザではない。30 warmup＋120描画×7組の中央値。更新処理の計測ではない。

| 敵数 | 修正前proxy描画ms | 修正後proxy描画ms |
| --- | ---: | ---: |
| 30 | 2.205 | 0.400 |
| 50 | 1.896 | 0.329 |
| 100 | 2.478 | 0.371 |
| 200 | 4.341 | 0.722 |

前後でHP・敵数不変。80 hitに対する無関係なmission-FX呼出しは480→0、混雑時hit描画は80→16。削減した処理量の根拠はあるが、VMの負荷・JIT・実行順による変動があり、実機FPS改善率には換算しない。GPU描画／音声／入力遅延／AI負荷の改善を主張しない。

生値：[修正前](cpu-before.json)／[修正後](cpu-after.json)。再実行：`node tools/polish-render-benchmark.mjs after`。これは`cpu-after.json`を更新するローカル試験。

## 10. UI・音声

UIはPAUSEの追加のみ。司令部4タブ・LAB5タブ・武器リスト・リザルトボタンを維持。新設定なし。既存Web Audioのユーザー操作unlock、ミュート／音量、8voice・24starts/秒、同種音間引き、失敗してもゲームを止めない処理を既存テストで確認。音声自体は変更せず、Safariでの聞き比べは未実施。

## 11. M03リザルトの回帰

既存`result-freeze`17件PASS。WINGのFLY/HOLD/移動/FIRE保持・全解放後のクリア、キャプチャ明示解放、cancel・連打、司令部復帰、M04解放と再読込、初回報酬／戦績／実績二重付与防止、保存失敗の再試行、他3兵科・代表ミッション・M08結末・LAB隔離を維持。実際のSafariで報告された完全停止は今回も検証できていない。Safariセーブを参照／初期化していない。

## 12. 関連テスト

- `node --test tests/final-polish.test.mjs tests/camera.test.mjs`：25 PASS／0 FAIL（新規15＋既存10）。
- キャンペーン内の関連20スイート：613 PASS／0 FAIL。新規描画順・入力・上限と、既存武器・兵科・各ミッション／ボス・保存・実績・LAB UI・実機診断を含む。無関係な全件テストは未実行。
- `node --check`：game.js／比較helper／比較serverの構文確認。`git diff --check`：空白エラーなし。
- 通常ミッション用AI／地形／兵科／武器データ・アート・保存ロジックは変更していない。

## 13. npm run qa:campaign

終了0。**140 PASS／0 FAIL／8 NOT_CLEARED／8 NOT_RUN**。M01〜M08連続は無敵補助のASSISTED、4兵科到達・初期武器攻撃はSTRUCTURAL。保存互換・報酬・LAB隔離・20武器は通過。無敵なしNORMAL_SIMは8件とも未クリア、HUMAN8件は未実施。全8件の通常難易度攻略成功とは表現しない。[結果JSON](../campaign-integration/results.json)／[関連613件ログ](../campaign-integration/related-tests.txt)。

## 14. ブラウザ・比較画像

ブラウザランタイム起動失敗→1回再初期化→同じOS error 3。追加再試行・代替自動ブラウザ起動はしていない。今回取得した比較画像は**0枚**。844×390、780×360、667×375、390×844すべて実表示未確認。リザルト・司令部もNodeとブラウザの証拠を混同しない。

手動確認：

1. テスト用プロファイルで`node tools/final-polish-preview.mjs 8930`、`http://127.0.0.1:8930/?debug=1`を開く。通常起動には比較UIを追加していない。
2. A=M01/50、B=M01/100、C=M03/WING飛行敵、D=M06脈動、E=M07混成、F=M08第3形態。固定乱数12345・320描画・カメラ0.50。LAB途中開始／無敵であり通常攻略ではない。再選択で戦闘を初期化する。
3. 各4サイズで一時停止画像を保存。`A-844x390-after.png`等とし、背景からの分離・敵弾・予兆・爆発・操作ボタンを確認。修正前の画像は未取得。別の旧版比較環境がある場合のみ同条件のbeforeを保存し、前後画像とする。
4. 「現在場面30秒計測」は既存IP-10を使用。前景で継続し、LAB・ポーズへ戻らず完了を待つ。中断・サンプル不足は有効FPSとしない。JSONの更新CPU／描画CPU／rAFを別々に記録。
5. 通常URLでもM03 WING→リザルト→司令部→M04とM08結末を確認。比較serverはCtrl+Cで終了。

比較helperは構文確認のみで、実ブラウザ操作は未確認。これを今回取得した比較画像の代わりとは扱わない。

## 15. iPhone実機の再確認

- 横／縦、Safariアドレスバー伸縮、画面外への指移動、中断・復帰、タッチキャンセル。
- WINGのFLY＋HOLD＋FIRE＋移動、GUARDIANの移動＋ジャンプ＋射撃、SCOUT DASH、マイン長押し。PAUSE後に操作が残らないこと。
- WING飛行・射撃入力保持のM03撃破→リザルトのタップ→司令部→M04。全入力解放でも比較。保存警告があればページを閉じず保存だけ再試行。
- 小倍率・大群・M06閉鎖予兆・M07転移・M08複合攻撃、音声復帰、50／100／200体の前景計測。

## 16. 残存問題

実表示・操作感・実FPS・画像比較・音声品質の受入は未完了。Safari停止の実機解消は未確定。通常難易度の人手全編クリアも未確認。Nodeの描画API呼出し試験だけで最終受入合格にしない。

## 17. 次の推奨対応

まずChrome代表4サイズとiPhoneで上記操作を確認し、A1のHIGH問題を優先して再判定。その後Phase A診断で正常な前景30秒以上の計測・画面評価を保存する。実測と画像で問題が残った箇所だけを調整し、難易度やアートを推測で改変しない。
