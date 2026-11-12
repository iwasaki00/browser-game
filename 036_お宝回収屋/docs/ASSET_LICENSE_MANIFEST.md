# Version 1.0.0-rc.1 — FINAL ACCEPTANCE & RELEASE CANDIDATE

## 調査方法

配布物の実モジュール台帳、main.tsのCSS import、実ファイル、Gitの初出履歴、過去の本会話の実装記録、同梱LICENSE/NOTICE、画像CSVを確認。Gitへの追加記録だけでは自作/生成AI/外部転用や配布許諾を証明できないため、根拠のない許諾を付与していません。外部ViteのGitHub原文URLは取得時404であり、インストール済7.3.7のLICENSE.mdと同梱本文を照合しています。

PNG等の実画像0、外部音源0、フォントファイル0。画像対応CSV300行は配置予定（implemented=false）で、現在はSVG仮画像。Canvasの砂浜/川底/河原表示も下表のコード内素材です。

## ファイル単位の棚卸し

| ファイル | 配布 | 使用箇所/役割 | 制作由来区分 | license | 再配布可否/条件 | credit | 根拠（初出） | 状態 |
|---|---|---|---|---|---|---|---|---|
| src/treasure-expansion.json | 対象 | ゲームマスターデータ | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | b8a47a5a / 2026-11-03 / VS | 未確認 |
| src/world-rules.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | b8a47a5a / 2026-11-03 / VS | 未確認 |
| src/field-tools.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 678b493b / 2026-11-02 / aaa | 未確認 |
| src/digging.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | cba74e58 / 2026-11-09 / aaa | 未確認 |
| src/ledger.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | adfdc6ea / 2026-11-02 / aaa | 未確認 |
| src/beach-tools.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 014370c4 / 2026-11-02 / aaa | 未確認 |
| src/master-source.json | 対象 | ゲームマスターデータ | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| src/data.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| src/save-validation.ts | 対象 | ゲームUI/ロジック | 生成AIで制作 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 87041c01 / 2026-11-12 / aaa | 未確認 |
| src/experience.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 13cc613e / 2026-11-10 / aaa | 未確認 |
| src/tool-value.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | dfad8500 / 2026-11-01 / aaa | 未確認 |
| src/events.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | a2c93607 / 2026-11-01 / aaa | 未確認 |
| src/measure.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 441b5fa4 / 2026-11-01 / aaa | 未確認 |
| src/gold.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 441b5fa4 / 2026-11-01 / aaa | 未確認 |
| src/river.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | a2c93607 / 2026-11-01 / aaa | 未確認 |
| src/world-generation.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | b8a47a5a / 2026-11-03 / VS | 未確認 |
| src/equipment.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 441b5fa4 / 2026-11-01 / aaa | 未確認 |
| src/engine.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| src/lines.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | adfdc6ea / 2026-11-02 / aaa | 未確認 |
| src/automation.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 679947c9 / 2026-11-02 / aaa | 未確認 |
| src/facilities.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 626d57bf / 2026-11-03 / aaa | 未確認 |
| src/save.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| src/backup-ui.ts | 対象 | ゲームUI/ロジック | 生成AIで制作 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 76154440 / 2026-11-12 / aaa | 未確認 |
| src/ux-guidance.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 13cc613e / 2026-11-10 / aaa | 未確認 |
| src/dig-input.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | cba74e58 / 2026-11-09 / aaa | 未確認 |
| src/treasure-assets.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 25dee2c5 / 2026-11-03 / aaa | 未確認 |
| src/reveal.ts | 対象 | お宝SVG・洗浄画面 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | dfad8500 / 2026-11-01 / aaa | 未確認 |
| src/collection.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 25dee2c5 / 2026-11-03 / aaa | 未確認 |
| src/surface.ts | 対象 | 道具SVG・カーソル・砂浜Canvas | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 37933a46 / 2026-11-01 / aaa | 未確認 |
| src/world-view.ts | 対象 | 探索Canvas表示 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 25dee2c5 / 2026-11-03 / aaa | 未確認 |
| src/growth.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 626d57bf / 2026-11-03 / aaa | 未確認 |
| src/lines-ui.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | adfdc6ea / 2026-11-02 / aaa | 未確認 |
| src/session.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | adfdc6ea / 2026-11-02 / aaa | 未確認 |
| src/automation-ui.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 679947c9 / 2026-11-02 / aaa | 未確認 |
| src/field-shop.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 678b493b / 2026-11-02 / aaa | 未確認 |
| src/shop.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 014370c4 / 2026-11-02 / aaa | 未確認 |
| src/field-feel-ui.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 13cc613e / 2026-11-10 / aaa | 未確認 |
| src/gold-view.ts | 対象 | 探索Canvas表示 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 441b5fa4 / 2026-11-01 / aaa | 未確認 |
| src/gold-ui.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 441b5fa4 / 2026-11-01 / aaa | 未確認 |
| src/river-view.ts | 対象 | 探索Canvas表示 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | a2c93607 / 2026-11-01 / aaa | 未確認 |
| src/feedback.ts | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 0ede9276 / 2026-11-01 / aaa | 未確認 |
| src/main.ts | 対象 | UIと合成効果音 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| src/stability.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 76154440 / 2026-11-12 / aaa | 未確認 |
| src/experience.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 13cc613e / 2026-11-10 / aaa | 未確認 |
| src/digging.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | cba74e58 / 2026-11-09 / aaa | 未確認 |
| src/field-feel.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 13cc613e / 2026-11-10 / aaa | 未確認 |
| src/world.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 25dee2c5 / 2026-11-03 / aaa | 未確認 |
| src/lines.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | adfdc6ea / 2026-11-02 / aaa | 未確認 |
| src/automation.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 679947c9 / 2026-11-02 / aaa | 未確認 |
| src/style.css | 対象 | 画面スタイル・システムフォント指定 | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| index.html | 対象 | ゲームUI/ロジック | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 8fce174b / 2026-11-01 / aaa | 未確認 |
| icon.svg | 対象外 | 未参照アイコン（dist外） | 出所不明 | 未確認 | 許諾/権原の確認後に判断。確認できなければ公開前に差替え | 未確認 | 7a4409d7 / 2026-11-01 / aaa | 配布対象外・由来未確認 |
| public/THIRD_PARTY_NOTICES.txt | 対象 | Vite MIT表記 | 外部ライブラリ同梱素材 | MIT | MIT本文・著作権表示を保持する条件で許諾 | 必要。同梱済み | 08119974 / 2026-11-13 / aaa | PASS |

src/save-validation.ts（0.9.2）とsrc/backup-ui.ts（0.9.1）は、本会話でCodexが新規作成した実装記録を根拠に生成AIと分類。それ以外は初期制作の区分を証明する申告/出典が不足。既存ファイルへのAIによる編集と、そのファイル全体の制作由来は区別します。生成AI由来だけで非侵害や第三者許諾が自動的に確定するとは扱いません。

## フォント・依存関係

Yu Gothic/Meiryo/system-ui/sans-serif/Georgia/serifは端末側のフォントを指定し、フォントファイルを再配布しません。

| パッケージ | version | 宣言license | 用途 | 本番取り込み | 許諾/表記の扱い |
|---|---|---|---|---|---|
| playwright | 1.64.1 | Apache-2.0 | browser tests | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |
| playwright-core | 1.64.1 | Apache-2.0 | browser driver | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |
| typescript | 5.9.3 | Apache-2.0 | type checking | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |
| tsx | 4.23.15 | MIT | TypeScript tests | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |
| vite | 7.3.7 | MIT | dev server/build | modulepreload補助コードのみ | MIT本文・著作権表示を同梱済み |
| esbuild | 0.28.2 | MIT | build transformation | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |
| rollup | 4.67.2 | MIT | production bundling | なし | SDK/ツール再配布時には各LICENSE/NOTICEを維持 |

実ビルドの外部モジュールはvite:modulepreload-polyfillの1件。他はプロジェクト内コード/データ。CSSとシステムフォント指定も上表に列挙しました。推移依存69件の宣言とnpm auditの結果は[監査JSON](security-license-v100rc1.json)。ツール全体を配布する場合は別途その配布物に含める全依存のLICENSE/NOTICEを保持してください。今回はnode_modulesを配布物へ含めません。

MITの表示条件は[OSIのMIT本文](https://opensource.org/license/mit)とローカルVite原文で確認。Apache-2.0ツールの再配布条件は[Apache公式本文](https://www.apache.org/licenses/LICENSE-2.0)と同梱LICENSE/NOTICEを参照。これらのライセンスでゲーム固有コード/データを勝手に許諾したことにはなりません。

## 未確認素材と必要な対応

配布に入る51ファイルの制作権原/条件が未確定。下記は確認または公開前の差替え対象です。生成AIの2ファイルも権利確認の対象として残します。

- src/treasure-expansion.json
- src/world-rules.ts
- src/field-tools.ts
- src/digging.ts
- src/ledger.ts
- src/beach-tools.ts
- src/master-source.json
- src/data.ts
- src/save-validation.ts
- src/experience.ts
- src/tool-value.ts
- src/events.ts
- src/measure.ts
- src/gold.ts
- src/river.ts
- src/world-generation.ts
- src/equipment.ts
- src/engine.ts
- src/lines.ts
- src/automation.ts
- src/facilities.ts
- src/save.ts
- src/backup-ui.ts
- src/ux-guidance.ts
- src/dig-input.ts
- src/treasure-assets.ts
- src/reveal.ts
- src/collection.ts
- src/surface.ts
- src/world-view.ts
- src/growth.ts
- src/lines-ui.ts
- src/session.ts
- src/automation-ui.ts
- src/field-shop.ts
- src/shop.ts
- src/field-feel-ui.ts
- src/gold-view.ts
- src/gold-ui.ts
- src/river-view.ts
- src/feedback.ts
- src/main.ts
- src/stability.css
- src/experience.css
- src/digging.css
- src/field-feel.css
- src/world.css
- src/lines.css
- src/automation.css
- src/style.css
- index.html

根拠のある自作/権利者申告、AI制作記録、外部素材の出典と利用条件を揃える。確認できない場合は公開前に当該素材/実装を差し替える。特にSVGはreveal.ts/surface.ts、Canvasはworld-view.ts/river-view.ts/gold-view.ts等、音はmain.ts、データは2マスターを中心に影響。SVG差替えは見た目とカーソル、データ差替えは図鑑/保存ID/経済へ影響し得ます。今回、大規模な削除・差替え・全体へのLICENSE付与は実施していません。

既知の権利侵害を確認したという意味ではありません。所有/許諾を確認できないため正式公開を保留します。プロジェクト全体にLICENSEがないことだけで所有者自身の利用可否を決めず、公開者の権原と採用する配布条件を確認する必要があります。

[根拠・ハッシュ一覧](asset-license-manifest-v100rc1.json) / [配布物台帳](release-build-v100rc1.json) / [実際の同梱表記](../public/THIRD_PARTY_NOTICES.txt)
