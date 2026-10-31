# Version 0.7.0 — CAMPAIGN COMMAND 確認レポート

確認日：2026-10-31。ローカルHTTPサーバー＋実際のChromeで確認。公開・push・デプロイなし。ブラウザの通常URLを使い、開発APIによるセーブ値／統計の注入はしていない。

## 関連テスト

```powershell
node --test --test-reporter=tap tests/campaign.test.mjs tests/data.test.mjs tests/lab-ui.test.mjs tests/mission-lab.test.mjs tests/runtime.test.mjs tests/weapons.test.mjs tests/gameplay-polish.test.mjs tests/lab-weapon-picker.test.mjs
```

**170件成功、失敗0、skip0**。うち新規キャンペーンテスト19件。既存ゲーム更新関数と独立したメモリ保存を使う自動QAであり、人手による通常難易度の全編攻略ではない。

| 項目 | 結果 |
| --- | --- |
| 旧M01〜M06スコア／時間・解放武器・進行読込 | 保持。未知の兵科／武器履歴を作らない |
| 分母・COMING SOON | 現在6、M07除外。仮マスタで実装済み7への追従、空リストも検証 |
| 出撃・クリア・GAME OVER | 各兵科の出撃、リトライ、終了重複、結果処理後の保存を検証 |
| 撃破・命中 | 死亡済み対象の重複防止、装置等とE/B撃破の区別、有効ダメージのみ計上 |
| 武器使用 | 散弾／誘導／分裂／雷雲／メテオの親操作、マイン上限・起爆、タレット自動射撃を検証 |
| 武器帰属 | ロケット爆風・サンダー連鎖・雷雲・タレットを明示IDへ集計。汎用弾をアサルトへ推測しない |
| 時間・保存 | ポーズ／非表示／フォーカスなし除外、pagehide、重複flush、射撃ごとに書かないこと、保存失敗の再試行 |
| 通常結果 | 全6ミッションの通常結果処理で旧ベスト・解放済み武器・クリア記録を維持 |
| LAB隔離 | 自由配置・指定開始・ボス撃破・通常攻略QA後も通常保存バイト列と統計不変 |
| 不正値 | 負数・無限・NaN・未知IDを正規化。累積データのサイズ制限 |
| プレビュー | 非表示停止、タブ非表示停止、OFF静止、素材なし静止代替 |
| 従来機能 | 武器・出撃導線・LAB5タブ／20武器独自リスト・関連戦闘テスト成功 |

`node --check`（game / campaign / campaign-stats）と `git diff --check` も成功。素材と親Arcade `index.html` の追跡差分はなし。作業前からあるM05/M06の未追跡素材はそのまま保持した。

## ブラウザ確認

- 通常URL → MISSION START → 司令部 → M01出撃準備 → 従来の兵科／武器選択 → 出撃を実操作。
- ポーズ → タイトル確認 → 戻る → 司令部 → RANGER出撃1・クリア0・GAME OVER0・実働6.8秒を表示。リロード後も同じ値を保持し、未使用兵科は未記録のまま。途中終了を敗北にしない。
- 全20武器の実DOM表示、M-20検索、設置・支援カテゴリ（M-18／D-19）、未解放概要を確認。装備／購入／解放操作は追加していない。
- 3タブの切替、タブ上の左右キー／Homeを実操作。プレビューOFF後の `animated=false`、6ミッションそれぞれの実素材読込（fallback=false）を確認。
- M06は詳細を閲覧できるが、出撃はdisabled。M07はCOMING SOON、進行率は0/6。通常URLにTEST LAB・BENCHボタンは出ない。
- 取得したブラウザエラーログは0件。

| CSS viewport | ヘッダー／フッター | 進行率と内容の分離 | 横はみ出し | 武器一覧の内部スクロール |
| --- | --- | --- | --- | --- |
| 844×390 | 画面内 | OK | なし | あり |
| 780×360 | 画面内 | OK | なし | あり |
| 667×375 | 画面内 | OK | なし | あり |
| 390×844 | 画面内 | OK | なし | あり |

ブラウザ検証で、既存 `.screen` の中央寄せと縦画面用の余白疑似要素が司令部Gridを押しつぶす問題を検出。司令部だけの配置指定と疑似要素OFFで修正し、再確認済み。本編レイアウトは変更しない。

## 画像

| 種類 | 画像 |
| --- | --- |
| ミッション・横844 | [missions-844x390.jpg](missions-844x390.jpg) |
| 横780 | [missions-780x360.jpg](missions-780x360.jpg) |
| 横667 | [missions-667x375.jpg](missions-667x375.jpg) |
| 縦390 | [missions-390x844.jpg](missions-390x844.jpg) |
| 新規戦績の記録後 | [classes-recorded-844x390.jpg](classes-recorded-844x390.jpg) |
| 武器コレクション | [844](weapons-844x390.jpg) / [780](weapons-780x360.jpg) / [667](weapons-667x375.jpg) / [縦390](weapons-390x844.jpg) |
| M-20検索 | [横844](weapon-search-844x390.jpg) / [縦390](weapon-search-390x844.jpg) |
| 6戦場プレビュー | [M01](preview-M01-844x390.jpg) / [M02](preview-M02-844x390.jpg) / [M03](preview-M03-844x390.jpg) / [M04](preview-M04-844x390.jpg) / [M05](preview-M05-844x390.jpg) / [M06](preview-M06-844x390.jpg) |

## 未確認・今後

- iPhone Safari実機、ホームバー／ノッチの実safe-area、ソフトキーボード表示中の操作感は未確認。ChromeのCSS viewport合格をSafari実機合格とは扱わない。
- 今回は人手の6ミッション全編クリア、実機の継続前景FPS計測を実施していない。プレビューの10fps上限は設計値であり、実機性能の保証ではない。
- 武器別撃破寄与／アシストは未対応。正確な帰属を得られる仕組みを別途検討してから拡張する。
- 次は実機での文字サイズ・タップ・検索キーボード・長時間プレイ／ページ終了時の保存確認を優先する。

仕様・統計定義・変更ファイル一覧は [CAMPAIGN_COMMAND.md](../../docs/CAMPAIGN_COMMAND.md)。
