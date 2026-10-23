# iPhone Safari 手動受入表

対象：0.5.0-Cの現存実装／1.0.0-A公開前監査。作成日：2026-10-23。**iPhone実機を操作していません。下表は全件UNVERIFIEDであり、Chrome375pxの結果を転記してPASSにしてはいけません。** Quality Fix後の候補でも同じ手順を使用できます。

記録欄：端末名＿＿／iOS＿＿／Safari＿＿／確認日＿＿／候補コミット＿＿／縦横＿＿／文字サイズ＿＿。各行には実際の結果と証拠を追記してください。

## 環境を分ける

公開サイトの進行保存へテストデータを投入しません。初期化試験も公開サイトでは行いません。保存を残したい普段の開発オリジンを使わず、未使用の専用ポートを使用します。

既存distを確認する場合、アプリディレクトリから次を実行します。ビルドは行いません。

```sh
npm run preview -- --configLoader native --host 0.0.0.0 --port 8044 --strictPort
```

iPhoneを開発PCと同じ信頼できるLANへ接続し、`http://<開発PCのLAN IP>:8044/`をSafariで開きます。PC側でファイアウォールの許可が必要なら管理者に確認してください。localhostはiPhone自身を指すためPCへは接続できません。広域公開・トンネルは不要です。

全解放・再現用の既存DEVモードは別サーバーで使用します。

```sh
npm run dev -- --configLoader native --host 0.0.0.0 --port 8045 --strictPort
```

| 確認用途 | URL・保存特性 |
|---|---|
| 通常の順次解放／再読込 | 専用previewのクエリなし。専用オリジン内のProductionキーを使用。テスト投入はしない |
| 任意ステージの画面 | DEVの`/?testMode=1`。メモリ限定、再読込でリセット |
| LAB解放後の画面だけ | DEVの`/?testMode=1&labTest=1`。星1×20・発見0から開始。メモリ限定 |
| LAB永続保存 | DEVのクエリなし＋後述の隔離fixture。DEV専用保存キーを使用 |

IP-01〜09を通常版で先に確認し、IP-10の高度なLAB試験だけDEVへ分けます。確認終了後は起動したサーバーをCtrl+Cで停止します。

## IP-01〜12

| ID | 項目・操作 | 期待結果 | 状態 | 実測／証拠 |
|---|---|---|---|---|
| IP-01 | 通常版を新しい専用オリジンで起動 | 起動し、0.5.0-C表示、Stage01のみプレイ可能。盤面・矢印・開始ボタンが読める | UNVERIFIED | 未実施 |
| IP-02 | 縦画面で上下スクロール、Safariバーの伸縮、必要に応じ文字拡大 | 横スクロールなし。切欠き・ホームインジケータと主要ボタンが重ならず、ダイアログ内をスクロールして閉じられる | UNVERIFIED | 未実施 |
| IP-03 | Aの2枚を何度かタップし、最後にLRへ設定 | 各カードが1タップでL/R切替。意図しない文字選択・ダブルタップ拡大が頻発しない。必要なピンチ拡大は利用可能 | UNVERIFIED | 未実施 |
| IP-04 | LRで配送開始。RUN中に設定やLABを試す | 荷物が順番に滑らかに移動。RUN中の変更は拒否。全荷物が処理される | UNVERIFIED | 未実施 |
| IP-05 | LRの通常配送完了 | 3/3 CLEAR・星3・コスト2、Stage02解放。各荷物の履歴を読める | UNVERIFIED | 未実施 |
| IP-06 | 再挑戦→初期設定LLで配送 | 2/3 FAILED・星0。BLUEもREDへ。最高星3を保持し、残り荷物の配送を続ける | UNVERIFIED | 未実施 |
| IP-07 | RUN直後RESCUE→対象情報→キャンセル。別RUNで確定 | PAUSEDで位置・tick停止。キャンセルは未消費。同方向Lなら初めてのREDで通常成功を維持でき、LRなら星1CLEAR。方向を変えれば対象イベントだけ変化。使用後再使用不可、再挑戦で復活。履歴に上書きが出る | UNVERIFIED | 未実施 |
| IP-08 | DESIGNでHINT1→2→3、再閲覧、閉じる。RUN/PAUSEDも確認 | 段階開放、読める・閉じられる。星減点・RESCUE消費なし。RUN/PAUSEDでは開けない | UNVERIFIED | 未実施 |
| IP-09 | SFX/BGM/音量/演出を変更→ページ再読込 | 最高星・CLEAR・解放・設定が復元。Stageは01からの表示でよい。保存拒否時は通知しプレイ継続 | UNVERIFIED | 未実施 |
| IP-10 | 隔離DEV fixtureで通常CLEAR→LAB詳細→再挑戦 | NEW、全分岐設定とコストが一致。再挑戦は設定付きDESIGN、HINT/RESCUE/配送初期化、自動RUNなし。下記の再読込試験も実施 | UNVERIFIED | 未実施 |
| IP-11 | 操作後SFX/BGM、消音、アプリ切替・画面ロック→復帰→再操作 | OS音声設定を考慮して実聴。非表示中に鳴り続けない。復帰後の許可された操作で音声を再開し、ゲーム操作は音声障害で止まらない | UNVERIFIED | 未実施 |
| IP-12 | DESIGN/RUN/各ダイアログで縦→横→縦、バー伸縮 | Canvas比率が保たれ、操作ボタン・閉じるへ到達可能。回転で配送が二重進行・消失しない | UNVERIFIED | 未実施 |

RESCUE対象は操作タイミングで変わります。必ず表示された荷物・通常方向を読んでください。キャンセル確認は「再開後のRESCUE表示が未使用か」、星1確認はLRの成功設定で表示の通常方向をそのまま確定すると再現しやすくなります。

## 永続LABのための隔離テストデータ

既存の`testMode=1&labTest=1`はメモリ限定なので、再読み込み保存試験には使えません。以下は**担当者がSafari Web Inspectorを利用できる場合だけ**のデータ投入手順です。利用できない場合は無理に公開データへ投入せず、永続LAB試験をUNVERIFIEDのまま残してください。

1. 専用ポート8045のDEVをクエリなしで開きます。公開ドメインやpreview8044では実施しません。
2. MacのSafariリモートWeb Inspectorで、そのiPhoneの専用DEVタブを選びます。既存のテスト設定や進行があれば別の未使用環境を用意します。
3. 次のコードはDEV注入タグ・専用ポート・既存キーが空であることを検査します。条件を緩めずに実行します。これは星だけのfixtureで、発見や正解設定は生成しません。

```js
(() => {
  const progressKey = 'sort-and-send.dev.progress.v1';
  const labKey = 'sort-and-send.dev.lab.v1';
  if (location.port !== '8045' || location.search ||
      !document.querySelector('script[src="/@vite/client"]')) {
    throw new Error('専用DEVタブ以外では実行しません');
  }
  if (localStorage.getItem(progressKey) !== null ||
      localStorage.getItem(labKey) !== null) {
    throw new Error('既存データがあります。別の未使用テスト環境を使ってください');
  }
  const ids = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));
  localStorage.setItem(progressKey, JSON.stringify({
    schemaVersion: 1, unlockedStageIds: ids, clearedStageIds: ids,
    bestStars: Object.fromEntries(ids.map(id => [id, 1])),
    settings: { sfx: false, bgm: false, volume: 0, reducedMotion: true }
  }));
  localStorage.setItem(labKey, JSON.stringify({ schemaVersion: 1, discoveries: [] }));
  location.reload();
})();
```

このコードは今回実機では実行していません。PCのlocalhostとiPhoneのLAN IPは異なるオリジンなので、PC側で付与した星はiPhoneへ自動反映されません。Productionの`sort-and-send.progress.v1`・`sort-and-send.lab.v1`は操作対象外です。

## 保存・LABの追加受入

| ID | 手順 | 期待結果 | 状態 |
|---|---|---|---|
| LAB-IP-01 | fixture後、研究室を開く | 解放20/20、全20面の発見0件。未発見設定は表示されない | UNVERIFIED |
| LAB-IP-02 | Stage01のAをLR、RESCUEなしでCLEAR | NEW DISCOVERY、Stage01が1/1件・コスト2・A LR | UNVERIFIED |
| LAB-IP-03 | ページを再読込し研究室へ | 星と発見1件を復元。再読込で0件になるメモリfixtureではこの確認を代用しない | UNVERIFIED |
| LAB-IP-04 | その発見で再挑戦→通常CLEAR | DESIGNのLRへ適用、手動RUN後「登録済み」、件数1のまま | UNVERIFIED |
| LAB-IP-05 | LRでRESCUEの通常方向をそのまま確定→CLEAR | 星1・LAB対象外・最高星3維持・発見1件のまま | UNVERIFIED |
| LAB-IP-06 | 音声／演出設定変更後、進行初期化の確認を開いてキャンセル | 「研究室の発見記録も削除されます」と表示。キャンセル後星・発見・設定は維持 | UNVERIFIED |
| LAB-IP-07 | テスト専用環境でのみ初期化確定→再読込 | 星・CLEAR・順次解放・LABを初期化、Stage01のみ、LAB0/20、音声・演出設定は保持 | UNVERIFIED |

初期化は取り消せません。テスト用と確認できたオリジンだけで実施してください。未知形式・壊れたデータの注入はこの実機表の必須手順には含めず、隔離単体テストとQuality Fixの回帰試験で扱います。既知の保存不具合AUD-001/002は解消前のため、実進行の保全確認は修正後に再判定してください。
