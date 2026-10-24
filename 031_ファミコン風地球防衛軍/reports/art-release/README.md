# 0.2.3-E — ART RELEASE 検証

2026-10-25 / Windows Chrome / ローカルHTTP、844×390 CSS px。Sitesローカル開発手順で既存ソースを修正し、公開・デプロイは行っていない。

## 実装

通常用 `releaseArt` とLAB用 `artPreview` を別インスタンスにし、既存の読込・欠損代替・全描画アダプターを共用。通常用はdebugなしでもページ起動時にUNIFIEDを読み込み、完了までORIGINALを描画する。通常320、LABのみ640比較。通常の兵科／武器装備プレビューも統合アトラスへ対応。

セーブにアート項目を追加せず、LABのリクエスト完了・選択・解像度は通常用へ書き戻さない。世界座標・判定・発射位置・B-02弱点・更新処理は変更なし。

## ブラウザで確認した範囲

| 項目 | 結果 |
| --- | --- |
| 通常URL（クエリなし）の標準 | UNIFIED_01、320x180、読込完了、代替素材なし |
| 通常装備画面 | 4兵科と全20武器の統合Canvasプレビュー。未解放武器はLOCKEDのまま |
| 通常M01開始 | RANGERと市街地・地形・武器・HUD表示。開発UI・比較UI・LABボタン非表示 |
| LABの初期状態 | ORIGINAL／320。通常用のUNIFIEDと混同なし |
| LAB M02 AREA02 | WING・地下・ネスト等の実シーン、UNIFIED／640 |
| LABのORIGINAL切替 | HP65・x940・M02-A2-MAINを停止中に維持 |
| 両ボス | M01-A5-BOSS／M02-A5-BOSS、UNIFIED／320、ボスカメラ有効 |
| LAB終了後の通常開始 | LABでORIGINAL／640を選択→管理から終了→通常M01でUNIFIED／320・通常RANGERへ復帰 |
| コンソール | エラー・警告0 |

通常M02はこのテスト用ブラウザoriginではLOCKEDのため、通常ミッション選択からは開始していない。通常M02経路はNodeテスト、ブラウザの地下表示はLABで確認した。LABでのボス開始・討伐を通常攻略とは扱わない。全4兵科×20武器の実射撃はNode、全ポーズ・全武器FXの人手目視完了とは区別する。

## 画像

[画像一覧](index.html)。UNIFIEDとORIGINALのM02画像は停止中の切替で同じチェックポイント・HP・位置を維持したが、撮影時は再開しているため厳密な同一フレーム比較ではない。

- [通常装備：4兵科・全20武器アイコン](normal-equipment-844x390.jpg)
- [通常URL：M01 RANGER / UNIFIED / 320](normal-m01-ranger-844x390.jpg)
- [LAB：M02 WING / UNIFIED / 640](lab-m02-wing-unified640.jpg)
- [LAB：M02 WING / ORIGINAL / 640（別フレーム）](lab-m02-wing-original640.jpg)
- [LAB：M01 B-01 / UNIFIED / 320](lab-b01-unified320.jpg)
- [LAB：M02 B-02 / UNIFIED / 320](lab-b02-unified320.jpg)
- [LABのORIGINAL・640設定を終了後：通常M01 / UNIFIED / 320](normal-after-lab-844x390.jpg)

読取可能なDOMの検証記録：[verification.json](verification.json)。FPSオーバーレイの短時間値は性能比較の測定結果として採用しない。

## 関連テスト

**94件成功、失敗0**。新規 `tests/art-release.test.mjs` 9件、既存のアート読込・切替／統合描画／視認性アダプター／LAB UI・武器選択／データ互換の影響範囲のみ実行。

```powershell
node --test tests/art-release.test.mjs tests/art-preview.test.mjs tests/unification.test.mjs tests/readability.test.mjs tests/lab-ui.test.mjs tests/data.test.mjs tests/lab-weapon-picker.test.mjs
node --check js/game.js
git diff --check -- .
```

- 通常M01/M02描画、全4兵科×20武器の実射撃入口、装備・アイコン・背景・地形・全敵種・両ボス・ネスト。
- 全体ロード完了まで旧表示を維持し、HP・位置・スコア・時間・進行・保存バイトを維持。
- 部分欠損／全画像失敗、未読込画像・null画像を描画しないこと、既存ローダーの寸法検証。
- LABの4スタイル、状態維持、ORIGINAL／640の通常用への非伝播、LAB終了後に旧リクエストが完了しても通常UNIFIEDを維持。
- 通常M01/M02でORIGINALとUNIFIEDに同じ120更新入力を与え、ゲーム全体・保存バイトが一致。
- 旧v1セーブのクリア・解放武器・装備・スコア・選択兵科を維持。
- 統合マニフェスト47素材のSHA256が全一致。素材・生成スクリプト・武器／兵科／敵／カメラ／ミッション処理のファイル差分なし。画像の再生成は不要のため未実行。

## 変更ファイル

- 実装：`js/game.js`（通常用の描画状態、通常装備プレビュー）。
- バージョン：`index.html`、`js/data.js`（VERSIONのみ）、`package.json`。
- テスト：新規`tests/art-release.test.mjs`、既存`tests/art-preview.test.mjs`・`tests/readability.test.mjs`（ロード待ちのテスト名を明確化）、`tests/data.test.mjs`・`tests/lab-ui.test.mjs`（version期待値）。
- 文書：`README.md`、`docs/ART_UNIFICATION.md`、`docs/GAME_SPEC.md`、本フォルダ。
- `js/art-preview.js`の既存41アトラスローダー・各描画アダプター自体は変更していない。

## 未確認

iPhone Safari実機・実タッチ、GPUメモリ・初回ネットワーク読込時間、全場面／全武器FXの目視、通常URLからのM02ブラウザ開始、実ブラウザで通信遮断した場合の欠損表示（代替処理は自動テストで検証）。長時間性能・60fpsを保証しない。

320遠景では薄い部位の欠落や敵の完全重複、洞窟の高頻度エッジは既知の残課題。今回は既存アートの正式採用であり、素材やゲーム性能は調整していない。

