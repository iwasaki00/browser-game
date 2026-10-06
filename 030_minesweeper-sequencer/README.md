# マインスイーパシーケンサ

マインスイーパの8×8盤面を、そのまま8ステップの音楽シーケンサとして再生するブラウザゲームです。

## Version

0.3.2 PLAYHEAD SCROLL FIX

## 起動

ビルドは不要です。index.html をHTTPサーバー経由で開いてください。

通常プレイでは非表示のDEBUG表示は、URLへ ?debug=1 を付けると有効になります。

## 操作

- PC: 左クリックで開く、右クリックでフラグ
- スマートフォン: タップで開く、長押しでフラグ
- PLAY / STOP: ランダムBPMの8ステップ・ループを開始 / 停止
- NEW GAME: 盤面・MISS・再生位置を初期化

## Phase 2

- NEW GAMEごとにSLOW（90〜105）、MID（110〜125）、FAST（130〜150）からBPMを抽選
- 開封した数字セルのNOTEを短くプレビュー
- 正しくフラグした地雷をMINE ACCENTとして再生
- MISS直後の短いグリッチ音と画面演出
- CLEAR後に完成シーケンスを4ループ自動演奏
- 全地雷を正しくフラグしてCLEARするとPERFECT SWEEP
- DEBUG画面にFORCE CLEAR / FORCE PERFECTを追加

## Version 0.3.2

- BOARD PRESET: COMPACT、STANDARD、WIDE、16 STEP、LARGE、CUSTOM
- Rows 6〜12、Steps 6〜16、可変地雷数
- Difficulty: EASY（約12%）、NORMAL（約16%）、HARD（約22%）、CUSTOM
- BOARD VIEW: FIT、SCROLL、COMPACT
- SCROLL時のFOLLOW PLAYHEAD
- TOUCH MODE: STANDARD、SWITCH、TWO HAND、DOUBLE TAP
- iPhoneでの長押し文字選択・Touch Calloutを盤面内だけ抑止
- 長押し中に10pxを超えて移動した場合はFLAGをキャンセル
- 12 / 16 STEPを単一Grid行で保持し、盤面Viewport内だけ横スクロール
- 大盤面ではTRACK名を左端へsticky表示
- 旧設定のFLICKはSTANDARDへ安全にフォールバック
- FOLLOW PLAYHEADは画面外へ出たSTEPだけを必要最小限追従
- 追従対象をBOARD VIEWPORTのscrollLeftだけに限定
- 新規ユーザーのFOLLOW PLAYHEAD初期値をOFFへ変更
- 開封済み数字セルの再操作によるCHORD OPEN
- GAME SETTINGSとlocalStorage保存
- 追加TRACK: CLAP、PERC、SUB、PLUCK

初期値は従来互換のSTANDARD 8×8、NORMAL 10地雷、STANDARD操作、FIT表示です。

## テスト

node --test .\tests\game-core.test.cjs

node .\tests\browser-smoke.cjs

外部ライブラリ、MIDI、外部音源ファイルは使用していません。
