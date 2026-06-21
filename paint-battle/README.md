# Paint Battle

iPhoneの縦画面で遊べる、30×30マスの2人用オンライン塗りつぶし対戦ゲームです。静的ファイルのみで動作し、GitHub Pagesに配置できます。

## 起動とFirebase設定

`index.html` をHTTPサーバー経由で開いてください。オンライン機能は `app.js` 冒頭の `firebaseConfig` を対象プロジェクトのWebアプリ設定に差し替えると利用できます。リポジトリ同梱値は既存の開発用プロジェクトを参照しています。

Firebaseコンソールで Realtime Database を作成し、下記ルールを設定します。本番公開では認証を追加し、書き込み可能なユーザーを制限してください。

```json
{
  "rules": {
    "rooms": {
      "paintBattle": {
        "$roomId": {
          ".read": true,
          ".write": true,
          ".validate": "$roomId.matches(/^\\d{6}$/)"
        }
      }
    }
  }
}
```

このルールはMVP動作確認用です。公開環境での無制限な書き込みを許可するため、機密情報や課金上限のないプロジェクトには使用しないでください。

## データ構成

```text
rooms/
  paintBattle/
    {6桁の部屋ID}/
      players/{playerId}
      grid/{0..899}
      status
      hostId
      createdAt
```

位置は最大100ms間隔、塗りは移動先の周囲3×3の変更セルだけを `update()` します。明示的な退出では最後のプレイヤーが部屋を削除します。通信断では `onDisconnect()` がプレイヤーを削除し、24時間以上経過した部屋は初回接続時の掃除処理で削除します。コンソールから `cleanupOldPaintBattleRooms()` を呼び、任意に掃除することもできます。

## ローカル確認

Firebaseに接続しない場合も「ひとりで練習」で、移動、3×3の塗り、60秒タイマー、集計を確認できます。
