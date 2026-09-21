# MIDI実験室

MIDIの読み込み・解析・再生・作成・保存を、iPhone SafariとPCブラウザで検証するための独立した静的Webアプリです。将来の音楽ゲーム／音楽ツール共通基盤を検討するための実験実装であり、中間データ `SongData` はまだ正式仕様ではありません。

## 起動方法

外部依存やビルド工程はありません。`index.html` を直接開いても動作しますが、ブラウザの制限を避けるためローカルHTTPサーバーの利用を推奨します。

```powershell
cd _cmn_midi
py -3 -m http.server 8080
```

その後 `http://localhost:8080/` を開きます。同じLANのiPhoneから試す場合は、PCのローカルIPアドレスを使い、必要に応じてファイアウォールを許可してください。本番相当ではHTTPS配信を推奨します。

## MIDI読み込み方法

「読み込み」タブで `.mid` / `.midi` を選択するか、PCではドロップします。SMFヘッダー、トラック、テンポ、拍子、Program Change、Note On/Offを解析し、アプリ独自の `SongData` に変換します。「解析」タブではトラック情報と先頭200ノートを確認できます。

## MIDI作成方法

「MIDI作成」タブでBPM、拍子、ステップ単位（1/4・1/8・1/16）、Velocity、8/16/32ステップを設定し、グリッドをタップしてノートを配置します。同じ列へ複数音を置くとコードになります。音階名は短い試聴、行・列の「×」は一括消去です。「試聴」は再生列を表示し、ループ再生と停止に対応します。「再生・解析へ送る」で通常の再生・解析画面へ反映できます。「サンプル曲生成」は120 BPMのCメジャースケールを作成し、グリッドにも反映します。

読み込んだMIDIは、編集するトラックと量子化単位を選んで「グリッドへ展開」できます。音域はノート密度を基準に最大25半音へ自動調整し、表示外のノートは削除せず保持します。編集は2小節単位で前後へ移動でき、各区間の変更は曲全体へ蓄積されます。既存ノートの長さとVelocityは維持され、新規ノートには画面のVelocityとステップ長を使用します。

複数トラックを順番に開いた場合も、トラックごとのノート編集、量子化単位、最後に表示していた2小節をWorkspace内に保持します。トラック一覧には「●編集あり」または「保存済み」を表示します。

## MIDI保存方法

「MIDI作成」タブの「MIDI保存」を押すと `midi-lab-test-001.mid` をダウンロードします。保存形式はStandard MIDI File Type 1で、テンポ／拍子用トラックとノート用トラックを出力します。保存したファイルを「読み込み」から再度選び、値が復元されることを確認できます。

読み込んだMIDIを編集している場合は「編集MIDIを保存」で、選択トラックの変更と未編集トラックを含む曲全体を保存します。Control Change、Pitch Bend、SysEx、歌詞など未対応イベントを含む場合は、保存前に警告を表示します。

## iPhoneでの注意

- Safariの制約により、音声は「再生」または「試聴」をユーザーがタップした後に開始します。
- 消音モードや端末音量、Bluetooth出力先も確認してください。
- ダウンロードしたMIDIはSafariのダウンロード一覧または「ファイル」アプリに保存されます。
- 画面の自動ロックやバックグラウンド移行後はAudioContextが停止することがあります。戻った後に再生ボタンを押してください。
- 大きなMIDIは端末メモリを消費します。表示は先頭200ノートに制限しています。

## 使用ライブラリ

外部ライブラリは使用していません。`midi-timing.js` にTempo Map／Time Signature Mapと双方向時間変換、`midi-core.js` に最小限のSMFパーサー／ライター、`midi-edit.js` にMIDIと編集グリッド間の変換、`synth.js` にWeb Audio API音源とスケジューラーを実装しています。画面処理は `app.js` に分離しているため、時間変換やMIDI処理を将来の共通基盤へ移しやすい構成です。

## 実装の概要

- MIDI解析: バイナリをDataView相当のReaderで読み、可変長値、Running Status、メタイベント、チャンネルイベントを処理します。Note OnとNote Offをペアにして秒へ変換します。
- 再生: AudioContextの `currentTime` を基準に、25msごとに120ms先までのノートを予約します。`setInterval()` は予約処理を起こすためだけに使い、再生位置の基準にはしません。
- 音源: 三角波の基音と小さな正弦波倍音に短いアタック／減衰を付けた軽量な内蔵音源です。
- MIDI出力: 480 PPQ、Type 1としてテンポ、拍子、トラック名、Program Change、Note On/Off、End of Trackを書き出します。
- 時間変換: `midi-timing.js` が全テンポ区間を積算してtick↔秒を変換し、拍子区間を継続する小節番号でtick↔小節／拍へ変換します。
- ループ試聴: AudioContextの絶対時刻上で周回番号を加算し、境界をまたぐノートも先読み予約します。
- リアルタイム打ち込み: ループ中は25msごとに最新グリッドを読み直し、120ms先までだけ予約します。未来のステップへの追加・未予約ノートの削除は停止せず反映されます。
- MIDIグリッド編集: MIDI tickを選択した1/4・1/8・1/16単位へ丸め、Time Signature Mapから求めた2小節のstartTick/endTickへ展開します。各セルはabsoluteTickを持ち、4/4→3/4→5/4では1/8グリッドが16→12→20ステップへ変化します。
- 可変テンポ区間試聴: ノートtickと区間境界をTempo Mapで秒へ変換します。再生ハイライトはAudioContext経過秒→tick→ローカルステップの逆変換で追従します。
- 複数トラック編集: 1曲の共有Workspace内にトラック別Sessionを持ち、ノート配列、量子化、表示小節、dirty／saved状態を保持します。
- イベント保持: グリッドはノートだけを編集し、Control Change、Pitch Bend、Aftertouch、Program Change、Text／Lyrics／Marker／Cue／Copyright、SysExは `rawEvents` として元tickと値を保持して再出力します。

## テスト

```powershell
node self-test.js
node scheduler-test.js
node midi-edit-test.js
node generate-timing-fixtures.js
node timing-test.js
node generate-event-fixture.js
node multi-track-edit-test.js
node event-preservation-test.js
node facade-compat-test.js
node baseline-test.js
node midi-common/tests/midi-common-test.js
```

`generate-timing-fixtures.js` はTempo／拍子テストを、`generate-event-fixture.js` は非ノートイベントfixtureを `test-data` へ再生成します。`multi-track-edit-test.js` は3トラックの編集・切替・保存を、`event-preservation-test.js` はノート編集後もCC、Sustain、Pitch Bend、Aftertouch、複数Program Change、Meta、SysExのtickと値が一致することを検証します。既存の保存、scheduler、8小節編集、時間変換テストも引き続き実行します。

## 共通基盤化 Phase 0・1

`baseline/` は共通化前のTempo／拍子変換、イベント、編集状態、SongData、fixtureのparse→write→再parse結果を固定した基準です。意図的に基準を更新するときだけ `node generate-baseline.js` を実行してください。

`midi-api.js` は既存ロジックを移動せずに追加した互換Facadeです。従来の `MidiTiming`、`MidiCore`、`MidiEdit`、`MidiAudio` はそのまま利用できます。

```javascript
const song = MidiApi.parse(arrayBuffer, { fileName: "song.mid" });
const bytes = MidiApi.write(song);
const seconds = MidiApi.timing.tickToSeconds(song, 1920);
const workspace = MidiApi.editor.createWorkspace(song);
const transport = MidiApi.transport.create(synth, onStateChange);
```

## 読み込み専用共通基盤 v0.1.0

`midi-common/` は他のWebゲームへコピーできる、DOM・AudioContext非依存の読み込み専用共通基盤です。実行に必要なのは `midi-common/midi-timing.js` と `midi-common/midi-common.js` の2ファイルです。公開API、対応イベント、コピー方法、最小サンプルは `midi-common/README.md` を参照してください。

MIDI実験室のファイル読込だけは `MidiCommon.parse()` を使用します。読込後に実験室固有の再生状態として `track.enabled` を追加します。Writer、Editor、Scheduler、SynthとPhase 1互換Facade `MidiApi` は変更していません。

## 現在の制限

- SMPTE time divisionは未対応です。
- MIDI Type 2は未対応です。CC、Pitch Bend、Aftertouch、Program Change、Meta Event、SysExは保存しますが、内蔵シンセの音色・音量・サステイン等の再生表現には反映しません。
- テンポ／拍子変更イベントは再生・位置表示・2小節編集・区間試聴・再保存へ反映します。拍子変更が小節途中に置かれた場合は、その変更tickを新しい小節の先頭として扱います。
- SysExは元バイト列を再出力しますが、接続機器固有データの完全互換性は保証しません。保存前に警告を表示します。
- 同一ノートが重なるケースはFIFOでNote Offと対応付けます。
- ドラムチャンネルも同じ簡易シンセ音で鳴ります。
- SoundFont、外部MIDI機器、複雑な編集、全件ノート表示は未対応です。
- ブラウザや端末負荷により発音タイミングには小さな揺れが生じます。

## 今後の拡張候補

SoundFont音源、ドラム専用音源、Control Change／サステイン対応、テンポ／拍子イベントのGUI編集、ピアノロール、任意ループ範囲、メトロノーム、MIDI Web API入力、Web Workerでの大規模ファイル解析、`midi-timing.js` の共通パッケージ化が候補です。
