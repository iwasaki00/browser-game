# お宝回収屋 — THE FINDERS

**Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE**

砂浜を掘り、川底で引き上げ、河原で砂金を選別する探索ゲームです。素手から道具を揃え、洗ったお宝の報酬で次の作業を育てます。3分野・12エリア・300種類のお宝。FNはゲーム内だけの架空通貨で、課金や換金はありません。

## 遊び方

- 砂浜：タップ・長押し・ドラッグで掘削。光るお宝を回収し、採取砂は選別します。道具の得意な硬さや到達できる層を比べてください。
- 川底：岸辺でつかむ操作から、磁石の投擲・フック・引上げへ。磁性、重量、距離、障害物に合う道具を選びます。
- 河原：砂利を採取し、ふるい・皿・スルースで選別。微細な粒は最後に手動で精密回収します。
- ショップで道具を購入し、4枠へ装備。洗浄で正体と報酬を確定し、図鑑を埋めましょう。

電動ふるい・電動ウインチ・電動砂利搬送機は、実際に採取した材料や指定した対象を処理します。最大6ライン・Lv1〜Lv3。処理待ちと材料不足を見て工程を改善できます。探索・洗浄・最後の精密回収は手動です。

## Windowsで起動

Node.jsは同梱Viteの要件（^20.19.0 または >=22.12.0）を満たすものを使用してください。依存導入済みならnpm.cmd ciは不要です。

~~~powershell
Set-Location -LiteralPath "C:/_wk/github/browser-game/036_お宝回収屋"
npm.cmd ci
npm.cmd run dev -- --port 5176 --strictPort
~~~

PCでhttp://localhost:5176/を開きます。終了は起動した端末でCtrl+C。

配布候補を開発サーバーとは別に確認する場合：

~~~powershell
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4176 --strictPort
~~~

http://127.0.0.1:4176/を開きます。今回、GitHub Pages等への公開は行っていません。

## セーブとバックアップ

進行はブラウザへ保存されます。タイトル/設定の「セーブ保護・バックアップ」からJSONを退避し、内容の検証と確認を経て復元できます。端末・ブラウザ・サイトのアドレスが変わると保存領域が変わるため、移行前にJSONを保管してください。サイトデータ削除や端末故障に備え、JSONを端末外にも残してください。

開発版と本番プレビューは保存領域を分けています。複数タブの進行は1つに制限します。タブ非表示中/終了中の収益はなく、復元した設備は停止状態から手動で再開します。

## 動作確認と公開状況

Windows Chrome/Edgeと320/375/390/430pxの自動試験を実施。iPhone Safariはユーザーから0.9.2の実機受入OKとの申告を記録しました。詳細測定値/ログ未提供、Codexの実機直接操作は未実施です。WebKit自動試験は実行環境未導入のため未実施。

**公開判定はCONDITIONALです。** RCの作成・技術受入は完了しましたが、ゲーム固有素材・コード・データの配布許諾が未確定です。お宝画像は9枚の32×32セルシートへ対応し、114件を専用ドット絵のPNG表示（第1弾12件・第2弾42件・第3弾60件）、残り186件はSVG仮表示です。専用絵は[第1弾12点](docs/TREASURE_ART_WAVE1.md)・[第2弾42点](docs/TREASURE_ART_WAVE2.md)・[第3弾60点の制作結果](docs/TREASURE_ART_WAVE3.md)を参照。300種類の専用絵は未完成です。[画像管理と制作手順](docs/TREASURE_SPRITE_PLAN.md)。ゲームバランスとセーブ形式は変更していません。

[プレイヤー向けリリースノート](docs/RELEASE_NOTES_1.0.0.md) / [総合受入](docs/FINAL_ACCEPTANCE_1.0.0.md) / [素材許諾](docs/ASSET_LICENSE_MANIFEST.md) / [配布監査](docs/RELEASE_PACKAGE_AUDIT.md) / [公開判断](docs/RELEASE_DECISION_1.0.0.md) / [28項目最終報告](docs/FINAL_REPORT_1.0.0-rc.1.md)。

## 開発検証

npm.cmd test（665件）／npm.cmd run test:rc（7ブラウザ回帰）／node scripts/rc-test.mjs acceptance（保存・端末・本番等）／npm.cmd run test:rc-stress（24ゲーム時間）／npm.cmd run test:rc-preview（本番preview稼働中）／npm.cmd run audit:rc-build（ビルド台帳）。試験は使い捨てブラウザ環境で行い、通常プレイの保存を使用しません。DEBUG LABは開発版専用で、本番から除外されます。

配布候補の第三者表記はpublic/THIRD_PARTY_NOTICES.txtからdistへ同梱します。ツール一式やnode_modulesを配布する場合は、各依存のLICENSE/NOTICEの確認も必要です。過去の開発履歴は[CHANGELOG](docs/CHANGELOG.md)と[仕様](docs/GAME_SPEC.md)に保持しています。

画像基盤の検証：npm.cmd run assets:prototype（開発サーバー5176で試作PNG再生成。完成絵の上書きに注意）／npm.cmd run test:sprites-browser（Chrome/Edgeの表示とフォールバック）。既存RC監査資料は変更前ビルドの記録で、現在のローカルdistとはハッシュが異なります。
