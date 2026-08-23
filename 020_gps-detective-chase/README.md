# GPS Detective Chase

iPhone Safariを優先した、2〜6人用の位置情報オンライン鬼ごっこです。犯人1人が時間まで逃げ、刑事は定期的に届く曖昧な目撃エリアを頼りに接近します。

## 実装内容

- Firebase匿名認証、6桁ルーム、ロビー、接続状態、再戦
- 自動抽選またはホストを犯人にする役割決定
- Leaflet + OpenStreetMap、現在地、精度円、自動追従
- 犯人先行時間、ゲームタイマー、段階的な目撃エリア
- GPS鮮度・精度・維持時間を使う捕獲判定
- 高速移動警告、Safe Area、画面復帰警告、位置送信停止
- `?debug=1` に依存しない通常プレイUI

## Firebase設定

1. Firebase Consoleでプロジェクトを作成します。
2. Authenticationの「匿名」を有効にします。
3. Realtime Databaseを作成します（このリポジトリの既定値はasia-southeast1）。
4. `js/firebase-config.js` をWebアプリの設定値に置き換えます。
5. 次のRulesを出発点に、公開前に運用要件に合わせて厳格化してください。

```json
{
  "rules": {
    "rooms": {
      "gps-detective-chase": {
        "$roomId": {
          ".read": "auth != null && $roomId.matches(/^\\d{6}$/)",
          ".write": "auth != null && $roomId.matches(/^\\d{6}$/)",
          "players": {
            "$uid": {
              ".validate": "$uid === auth.uid || data.parent().parent().child('meta/hostUid').val() === auth.uid",
              "displayName": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 12" },
              "position": {
                "lat": { ".validate": "newData.isNumber() && newData.val() >= -90 && newData.val() <= 90" },
                "lng": { ".validate": "newData.isNumber() && newData.val() >= -180 && newData.val() <= 180" }
              }
            }
          }
        }
      }
    }
  }
}
```

上記はMVP向けです。Realtime Databaseのクライアントだけでは犯人の生位置を刑事クライアントから完全に秘匿できません。身内でのプレイを前提とし、本格運用では目撃情報生成と捕獲確定をCloud Functions等へ移してください。

## ローカル実行とテスト

ES Modulesと位置情報を使うため、ファイルを直接開かずHTTPサーバーを使います。

```sh
python -m http.server 8000
```

`http://localhost:8000/020_gps-detective-chase/` をPCの2ウィンドウで開き、部屋作成・参加・準備・開始・再戦を確認します。位置情報の実機確認はHTTPSのGitHub Pagesへ公開し、iPhone Safariで行います。

実機では次を確認してください。

1. Safariの位置情報を「許可」にする。
2. 2台以上で同じ6桁IDへ入り、全員を準備完了にする。
3. 役割、先行時間、目撃情報が同期することを確認する。
4. 位置が古い、または精度が50mを超える間は捕獲されないことを確認する。
5. 退出・画面復帰・ゲーム終了後に位置取得が止まることを確認する。

## 1人用デバッグモード

トップ画面の「1人でテストする」を押すと、Firebase認証・部屋作成・位置情報許可を行わずにローカルデバッグを開始できます。状態はブラウザのメモリだけに保持され、Firebaseへ送信されません。

URLへ `?debug=1` を追加する従来の起動方法も利用できます。こちらは実際のFirebaseルームへCPUやデバッグ状態を同期したい場合の開発者向けモードです。

```text
http://localhost:8000/020_gps-detective-chase/?debug=1
https://<user>.github.io/<repo>/020_gps-detective-chase/?debug=1
```

画面の「DEBUG MODE」表示と右下のDEBUGボタンが目印です。通常URLでもトップ画面から明示的に選択できますが、選択するまではデバッグ用JavaScriptとCSSを読み込まず、CPU、仮想GPS、真の位置、強制勝敗操作を実行しません。

### 最短の確認手順

1. 通常URLを開き、トップ画面の「1人でテストする」を押します。
2. 自分＝刑事、CPU犯人1人、仮想GPS、制限時間1分、目撃間隔10秒、先行時間なしが自動設定されます。
3. ロビーの「全員でゲーム開始」を押し、役割確認後にテストを開始します。
4. 地図をタップするか、方向パッド・PCの矢印キー／WASDで移動します。
5. 「即時生成」で目撃情報、「犯人を5m先へ」で捕獲維持、「残り10秒」でタイムアップを確認します。
6. 「刑事勝利」「犯人勝利」で結果画面を確認します。
7. 退出すると仮想GPSとデバッグパネルが解除され、通常のトップ画面へ戻ります。

地図タップは、即時ワープ、徒歩4km/h、早歩き6km/h、走行10km/hから選べます。緯度・経度・accuracyの直接入力にも対応します。仮想GPS設定、パネル開閉、真位置表示設定はlocalStorageへ保存され、「設定初期化」で削除できます。

### CPU・シナリオ・監視

CPU犯人とCPU刑事は `players/bot_*` に `isBot: true` として保持され、実プレイヤーとは区別されます。画面から開始したローカルテストではメモリだけに保持され、`?debug=1` で作成したFirebaseルームではFirebaseへ保存されます。CPUは停止、ランダム移動、直進、円、ジグザグ、追跡、逃走用の移動ロジックを持ち、1秒ごとに距離と方角から位置を更新します。初期行動は犯人が逃走、刑事が追跡です。

プリセットでは、最小構成、自分が犯人、捕獲直前、GPS精度不良、犯人切断、偽情報、タイムアップ、高速移動、複数刑事を作成できます。実行前にCPU、目撃情報、捕獲候補を初期化します。

状態データ欄には `meta`、`settings`、`game`、`players`、`witnessReports`、`captureCandidates` のみを整形表示します。Firebase設定値や認証情報は表示しません。JSONのコピー・保存と、最大500件のイベントログのコピー・消去ができます。

### デバッグモードの範囲と制約

- 画面から開始する1人用テストはインメモリの `LocalRoom` を使用し、ページを再読み込みすると状態が消えます。
- `?debug=1` で通常の部屋を作成した場合だけFirebaseへデバッグ状態が同期されます。
- CPUの個別編集UI、通信遅延・パケットロス、タイマー停止、高度な移動予定線・軌跡は未実装です。
- Firebase Rulesがホストによる `bot_*` 更新を拒否する構成では、CPU操作用の開発Rulesまたはサーバー側デバッグ処理が必要です。
- クライアント時刻を変更するデバッグ操作は同じ部屋へ同期します。公開中の通常プレイルームでは使用しないでください。

1台でUIとゲームロジック全体を確認できますが、最終確認では複数の実機を使い、匿名認証、同時更新の競合、ホスト切断・移譲、iPhone SafariのGPS精度、バックグラウンド復帰、モバイル回線での遅延を確認してください。

## GitHub Pages

リポジトリのSettings → Pagesで `main` / rootを指定します。位置情報APIはHTTPSまたはlocalhostでのみ利用できます。iOSでは画面ロック中・別アプリ使用中のGPS継続を保証できないため、ゲーム中は画面を表示したままにしてください。

## プライバシーと安全

位置はゲーム中の最新値だけを上書きします。長期保存、第三者公開、本名入力は行いません。道路横断中や移動中は画面を見ず、私有地・立入禁止区域へ入らず、乗り物を運転しながら遊ばないでください。古い部屋の自動削除はクライアントだけでは保証できないため、Firebase TTL相当の定期削除処理を別途設定することを推奨します。
