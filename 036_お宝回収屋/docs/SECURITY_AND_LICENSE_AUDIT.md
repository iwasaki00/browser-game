# Version 0.9.2 — DEVICE ACCEPTANCE & RELEASE AUDIT

## 範囲と検査結果

Git管理4944ファイルのうちテキスト2002件を走査（本番出力を含む）。大容量による除外0件。既知の秘密鍵/AWS/GitHub/Google形式、資格情報代入を検査。Git履歴・無関係な未管理ファイル・バイナリ内の任意文字列は対象外。値は出力せずパス・行・種別だけを記録。

本ゲームのソース/本番出力に上記候補なし。別ゲームのFirebase設定4ファイルで8パターン一致（同じ値への重複検出を含む）：012_paint-battle/app.js:5、017_naval-battle/main.js:4、020_gps-detective-chase/js/firebase-config.js:2、_cmn_firebase/firebase-config.js:2。今回の036 distには含まれません。

Firebaseクライアント設定を秘密鍵と同一扱いにはしていません。[Firebase公式のAPIキー説明](https://firebase.google.com/docs/projects/api-keys)ではFirebaseの認可はSecurity Rules等で行う旨を確認。これらのプロジェクトのAPI制限・有効な他API・Security Rules・App Checkは未確認であり、安全とも漏洩とも断定しません。リポジトリ全体を公開する場合の確認事項として残し、別ゲームを変更していません。

任意形式の個人情報や機密性を正規表現だけで完全判定することはできません。公開責任者による最終確認は未確認。テストの端末IPは実機接続用の意図したLAN情報として実機手順に限定。

## 外部通信と入力

ゲームは外部API/クラウド保存を使用しない構成。AudioContextのオシレーターで効果音を合成。依存JS/CSS/画像を外部CDNから取得しません。開発サーバーのVite HMR WebSocketは開発時のみ。JSONは端末内処理、送信なし。

危険なJSONキー、HTMLを含む識別子、異常品質、砂在庫矛盾を移行前/中に拒否。河原/設備の属性エスケープ、バックアッププレビューtextContent、図鑑の文字列エスケープを確認。DEVコードがソースにあることと、本番で実行できることを分けて検証。

## 依存ライブラリ

| 名称 | version | 宣言license | 用途 | 本番に含まれるもの | 表記 |
|---|---|---|---|---|---|
| playwright | 1.64.1 | Apache-2.0 | browser tests | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |
| playwright-core | 1.64.1 | Apache-2.0 | browser driver | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |
| typescript | 5.9.3 | Apache-2.0 | type checking | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |
| tsx | 4.23.15 | MIT | TypeScript tests | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |
| vite | 7.3.7 | MIT | dev server/build | 生成bootstrapのmodulepreload補助コード | MIT本文をdistへ同梱 |
| esbuild | 0.28.2 | MIT | build transformation | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |
| rollup | 4.67.2 | MIT | production bundling | ツール本体は含まれない | ツール再配布時はLICENSE/NOTICE原文を維持 |

npm audit：検出0件（info/low/moderate/high/criticalすべて0）。2026-11-12時点のレジストリ応答。依存更新なし。推移依存69件の宣言はJSONに記録。ツール一式やnode_modulesを配布する場合、各パッケージ同梱のLICENSE/NOTICE/追加依存表記を確認してください。distだけの配布とツール一式の配布を区別します。

## 素材の権利

| 素材 | 実装・出所の観測 | 商用/再配布の確認 | クレジット |
|---|---|---|---|
| お宝300種の画像 | PNG等の同梱実ファイル0。未配置時はreveal.tsのSVG仮画像 | ゲームコード/デザインの権利者確認は未完 | 全体の採用ライセンス未決定 |
| SVG仮画像/道具アイコン | reveal.ts / surface.tsのコード内パス | 出典宣言なし。権利者・制作由来を最終確認 | 利用許諾に従って決定 |
| icon.svg | プロジェクト直下の単純図形。今回のdistには参照/コピーなし | 由来・権利者は未確認 | 未決定 |
| 効果音 | main.tsのAudioContext合成。外部音源ファイルなし | コードの権利者確認と同じ | 全体の許諾に従う |
| フォント | Yu Gothic/Meiryo/system-ui。フォントファイル同梱なし | フォント自体の再配布を行わない | 外部Webフォント表記なし |
| Vite bootstrap | インストール済ViteのMIT原文 | 原文の許諾・条件を維持 | public/THIRD_PARTY_NOTICES.txtをdistへコピー |
| README/データ/その他コード | リポジトリ内の資料とマスター | リポジトリ/本ゲームのLICENSEなし、採用と権利者確認が必要 | 未決定 |

コード内生成であることだけを「自作・無条件商用利用可能」の証明にはしていません。既知の権利侵害を確認したという意味でもありません。素材の制作由来、データ/コードの配布許諾を所有者が確認するまで正式公開はREADYにしません。300画像の制作やゲーム全体へのライセンス付与は実施していません。

## 本番の除外

Chrome/Edgeの本番で__finders/DEBUG LAB/強制報酬/生成入口/隠し操作を利用できず、比較Worker/開発マーカーも除外。配布物はindex.html、JS、CSS、必要なTHIRD_PARTY_NOTICES.txt。テスト・ログ・セーブ・レポートはdist外。

[監査JSON](security-license-v092.json) / [npm audit](npm-audit-v092.json) / [本番](production-results-v092.json) / [同梱表記](../public/THIRD_PARTY_NOTICES.txt)
