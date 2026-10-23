# 1.0.0-B — QUALITY FIX

実施日：2026-10-23。対象は[監査AUD-001/002](release-audit-evidence.md)のP1保存不具合2件。ステージ・配送エンジン・Solver・コスト・RESCUE・HINT・LABの正規化と成功判定・公開URL・親メニューは変更していません。監査当時の文書は履歴として維持します。

## 原因と修正

| 指摘 | 原因 | 修正箇所・結果 |
|---|---|---|
| AUD-001 | 1項目の不正でschema1全体を破棄 | progress.tsのdecode。星・IDは要素別、設定は項目別に復旧し、正常な記録を維持 |
| AUD-002 | 起動時の状態を保存時に再検証せず上書き | progress.tsのsync/persist、save-coordinator.ts、main.ts。Web Lock内で最新を取得・同世代を統合し、未知schema・別世代・初期化中は書込停止 |
| AUD-003（直接関連） | 未知schemaを初期化するよう案内するが実装は拒否 | main.tsの状態文を「未対応版では保存・初期化不可」に統一 |

変更ファイル：`src/progress.ts`、`src/progress.test.ts`、`src/lab-integration.ts`、`src/main.ts`、新規`src/save-coordinator.ts`・`src/save-protection.test.ts`、`index.html`、`package.json`、`package-lock.json`、`../README.md`、本書、更新された`dist/index.html`とハッシュ付きJS。CSS内容は変更していません。

## 部分破損と移行

進行キーとschemaVersion 1は維持します。既知の旧schema1は読み取りだけでは書き換えず、正常な星・CLEAR・解放・設定を復元します。繰り返し復元・保存しても重複しません。不正な星・IDだけを除外し、設定の不正プロパティだけを既定値にします。有効な未知ステージIDの既存記録も維持します。既知面の正常なCLEARからその面と次面を解放しますが、星だけからCLEARは生成しません。

JSON全体の破損、未知schema、不正な保存世代情報は原文保護・保存停止です。移行のために旧JSONを先に削除する処理はありません。容量超過時は新しい結果がページ内だけとなり、保存失敗を表示します。正常な旧記録は残ります。

## 排他・世代・保証範囲

進行・設定・LAB収集・初期化は、同じオリジンの`sort-and-send.save` Web Lockへ集約します。ロック内の同期処理だけが永続setItemを使えます。最高星はステージ別max、正常CLEARと解放は集合統合。設定は操作した項目を更新します。storageイベントも同じsyncを呼びます。保存前後の文字列照合は非協調変更の検出用であり、CASの代替ではありません。

Web Locksがない場合・ロック要求が失敗する場合は永続保存・LAB登録・初期化を停止します。読み取りとページ内プレイは継続できますが、未保存の結果は再読込で失われます。HTTPSまたはlocalhost等の安全なコンテキストで利用してください。

保証は同じロック方式の修正版同士に限ります。旧0.5.0-CタブやWeb Inspector等による非協調的な書き込みとの完全排他は保証しません。更新時は旧版タブを閉じて再読込してください。

通常更新では旧schema1をそのまま使用し、初期化時だけUUIDの任意項目`generation`を付けます。世代がない旧データは内部的にlegacyです。確認後、新世代と`resetPending:true`を先に保存→LAB削除→進行初期化とpending解除の順で処理します。音声・演出設定は保持します。

別世代を検出した古いタブは保存とLAB収集を停止し、再読込を要求します。新しい初期状態へ古い進行をマージせず、消した星や発見を復活させません。2キーの更新は原子的ではありません。途中で失敗するとマーカーが残り、通常保存・LAB収集を止めます。再読込後、ユーザーが初期化を再確認することで完了できます。LABが未知schema・破損・読取不能ならマーカー作成前に拒否します。キャンセルは両キー無変更です。

LABは独立キー・schema1を維持し、正規化・成功判定は無変更。部分破損で正常な最高星を捨てないため、不要な再ロックも防ぎます。

## 実行した検証

```sh
node node_modules/vitest/vitest.mjs run src/progress.test.ts src/save-protection.test.ts src/lab.test.ts src/lab-ui.test.ts src/scoring.test.ts src/audio.test.ts --configLoader native --maxWorkers=1
npm run build
```

| 検証 | 結果 |
|---|---|
| 新規AUD-001/002回帰 | 17件成功 |
| 進行15・LAB30・LAB UI6・採点15・音声5 | 71件成功 |
| 合計 | 6ファイル88件成功、失敗0 |
| TypeScript | 成功 |
| ヒント参照 | 20面60件VALID |
| Productionビルド | 成功、dist更新 |

混在不正値・再保存・旧schema・壊れたJSON・未知schema・異なる面のCLEAR・星2→別タブ星3→古いタブ保存・同期・初期化世代・LAB復活防止・初期化中断と再開・ロック非対応／拒否・容量例外・再ロードを検証しました。近接保存は共有の直列化テスト用LockManagerでPromise.allを実行。既存LABテストでRESCUE星1、解放RUN、再挑戦、キャンセル、設定保持、未知LAB保護も確認しました。

初回はJSON全体破損／未知schemaの保護方針に合わせ旧テストの期待値とテスト側の型を修正しました。最終88件はすべて成功。通常buildの初回はVite一時ファイル権限で停止し、承認済み権限で再実行して成功しました。全設定探索・監査の74設定再配送は実行していません。

## Chrome操作

専用オリジン`http://127.0.0.1:8047/`でProductionの2タブA/Bを確認しました。

- Bを未保存で開いたままAでStage01 LRを実行し星3CLEAR。Bもstorageイベントで最高星3・Stage02解放・LAB1/20へ更新。
- Bで効果音OFFを保存。A再読込でも最高星3を維持。
- Bで初期化確定。AでBGMを操作すると「別タブで進行が初期化されました。このタブの保存を停止しています。再読み込みしてください。」を表示。
- B再読込後も星なし・Stage02ロック。古いAの操作から進行は復活しない。
- 最終ビルド後のBで再びLRのCLEARを実行。再読込で星3と効果音OFF・BGM OFFを復元し、初期化後の新世代では通常保存できることを確認。対象タブのwarn/errorログ0件。

星2→3の実ブラウザ並行プレイは未実施（単体テストでPASS）。永続LABのGUI登録→再読込、iPhone Safari、非対応端末のGUIは未実施です。ストア再生成によるLAB復元の単体結果と混同していません。

## 手動追試・1.0.0-Cへの引き継ぎ

アプリディレクトリで`npm run preview -- --configLoader native --host 127.0.0.1 --port 8047 --strictPort`を起動し、専用ポートで2タブを開くと上記を追試できます。初期化はテスト専用保存だけで行ってください。

永続LABは[既存iPhone受入表](iphone-acceptance.md)の隔離DEV fixtureとLAB-IP-01〜07で追試できます。メモリfixtureでは永続復元を確認できません。Safari実機は安全なコンテキストでの保存と、非対応時の停止案内を別々に確認してください。

本工程後の既知未解決指摘はP0=0、P1=0、P2=0、P3=1（AUD-004：初回評価説明）。全環境の安全保証ではありません。1.0.0-Cへ永続LAB GUI、iPhone IP-01〜12、旧版タブの更新手順、初回説明、権利Human Review、公開ホスト・キャッシュ受入を引き継ぎます。
