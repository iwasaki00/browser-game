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

`http://localhost:8000/gps-detective-chase/` をPCの2ウィンドウで開き、部屋作成・参加・準備・開始・再戦を確認します。位置情報の実機確認はHTTPSのGitHub Pagesへ公開し、iPhone Safariで行います。

実機では次を確認してください。

1. Safariの位置情報を「許可」にする。
2. 2台以上で同じ6桁IDへ入り、全員を準備完了にする。
3. 役割、先行時間、目撃情報が同期することを確認する。
4. 位置が古い、または精度が50mを超える間は捕獲されないことを確認する。
5. 退出・画面復帰・ゲーム終了後に位置取得が止まることを確認する。

## GitHub Pages

リポジトリのSettings → Pagesで `main` / rootを指定します。位置情報APIはHTTPSまたはlocalhostでのみ利用できます。iOSでは画面ロック中・別アプリ使用中のGPS継続を保証できないため、ゲーム中は画面を表示したままにしてください。

## プライバシーと安全

位置はゲーム中の最新値だけを上書きします。長期保存、第三者公開、本名入力は行いません。道路横断中や移動中は画面を見ず、私有地・立入禁止区域へ入らず、乗り物を運転しながら遊ばないでください。古い部屋の自動削除はクライアントだけでは保証できないため、Firebase TTL相当の定期削除処理を別途設定することを推奨します。
