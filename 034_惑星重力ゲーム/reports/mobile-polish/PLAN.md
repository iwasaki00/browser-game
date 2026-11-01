# v1.9.3 MOBILE POLISH

## Plan → Tasks

1. v1.9.2の未変更状態、405件の試験、表示・操作・音声・再生・保存を調査。
2. 320×568 / 375×667 / 390×844 / 430×932、横画面、短いビューポート、セーフエリアの変更前測定。
3. 必要最小限のCSS・操作抑止・音声停止の調整。物理・ステージ・保存形式は維持。
4. ChromeのCDP実タッチ、実Web Audio、広域航行・CINEMATIC、PNG・保存を検証。
5. 全Node試験と関連ブラウザ試験を実行し、性能・差分・IP-01〜14を文書化。

初期：v1.9.2、対象内の未コミット変更なし。プロジェクトのUTF-8/LF方針を継承。実機のノッチ・Safariバー・音声出力・発熱はPC再現で合格としない。

BGMは現行版に存在しない。新機能を追加する回ではないため実装せず、NOT APPLICABLEとして仕様を明記する。一時停止は既存のメニュー・設定・マップ表示による停止を使う。

## Build ? Test ? Docs

- [x] Minimal scoped UI / gesture / audio-stop fixes
- [x] All 405 Node tests; preserve initial 404/1 failure evidence
- [x] Native Chrome audio and PNG / share branch tests
- [x] Real-time 120-second protected replay / DEEP performance sampling
- [x] Isolated old-save and protected-record preservation
- [x] IP-01?14 acceptance checklist and verification report

The final browser logs and JSON files are the evidence; iPhone acceptance remains UNVERIFIED.
