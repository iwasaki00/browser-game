# MidiCommon

MIDI実験室で検証した解析・Timing処理を抽出した、ブラウザ向けの読み込み専用MIDI共通基盤です。v0.1.0の責務はStandard MIDI Fileを`ArrayBuffer`から解析して、プレーンなSongDataを返すことだけです。外部ライブラリは使用していません。

## 他のWebゲームへコピーするファイル

次の2ファイルを、ディレクトリ構造を保ってコピーしてください。

```text
midi-common/
├─ midi-timing.js
└─ midi-common.js
```

HTMLではTimingを先に読み込みます。

```html
<script src="midi-common/midi-timing.js"></script>
<script src="midi-common/midi-common.js"></script>
```

## 最小利用例

```javascript
const input = document.querySelector("#midiFile");

input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  const song = MidiCommon.parse(buffer, { fileName: file.name });

  console.log(song.title, song.bpm, song.tracks, song.totalNotes);
});
```

基本入力は`ArrayBuffer`なので、File input以外に`fetch()`、IndexedDB、Drag & Dropで取得したデータにも利用できます。動作する画面例は`example/`にあります。

## 公開API

```javascript
MidiCommon.VERSION; // "0.1.0"

MidiCommon.parse(arrayBuffer, { fileName });
MidiCommon.getTracks(song);
MidiCommon.getTrack(song, trackId);
MidiCommon.getNotes(song, trackId);
MidiCommon.noteName(noteNumber);

MidiCommon.tickToSeconds(song, tick);
MidiCommon.secondsToTick(song, seconds);
MidiCommon.tickToBarBeat(song, tick);
MidiCommon.barBeatToTick(song, bar, beat, fraction);
```

`getNotes(song)`のようにTrack IDを省略すると、全トラックのノートを返します。Track IDは現在、読込時のトラック番号を基にした数値で、そのSongData内で安定しています。

## データ構造

SongDataの主要項目:

```javascript
{
  title, fileName, format, ppq, bpm, timeSignature,
  duration, endTick, totalNotes,
  tempoMap: [],
  timeSignatureMap: [],
  tracks: []
}
```

TrackDataの主要項目:

```javascript
{
  id, index, name,
  channel, channels,
  program, programs,
  instrumentName, endTick,
  notes: [], rawEvents: []
}
```

NoteData:

```javascript
{
  noteNumber, noteName, channel, velocity,
  startTick, endTick, durationTicks,
  startTime, endTime, duration
}
```

`rawEvents`にはControl Change、Program Change、Pitch Bend、Poly/Channel Aftertouch、Text、Copyright、Track Name、Lyrics、Marker、Cue Point、その他Meta Event、SysExを保持します。v0.1.0では編集・再出力は行いません。

共通版のSongDataには、MIDI実験室のUI状態`track.enabled`や編集用の`_sourceId`、`_gridTick`、`_editStep`、`_durationTicks`を含めません。

## v0.1.0の対応範囲

対応:

- SMF Type 0 / Type 1
- PPQ time division
- Note On / Note Off / Running Status
- Tempo Map
- Time Signature Map
- Control Change / Program Change
- Pitch Bend
- Polyphonic / Channel Aftertouch
- Text / Lyrics / Marker / Cue / Copyright / Track Name
- その他Meta Event
- SysEx解析・保持
- tickと秒、小節・拍の相互変換

未対応:

- SMF Type 2の意味的統合
- SMPTE time division
- System Common / Realtimeイベント
- MIDI書き込み・保存
- MIDI編集
- 再生、Scheduler、Transport、Synth、AudioContext
- ES Modules / npm package

現在は既存プロジェクトとの互換性を優先して`window.MidiCommon`として公開します。将来ES Module対応を予定しています。

## テスト

プロジェクトの`028_cmn_midi`ディレクトリで実行します。

```powershell
node midi-common/tests/midi-common-test.js
```

4つのfixtureについて、旧`MidiCore.parse()`、共通版、Phase 0 baselineの主要結果を比較します。
