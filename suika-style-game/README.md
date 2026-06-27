# スイカ・ドロップ

Matter.js と Canvas API で実装したスイカ風の落ち物マージゲームです。

## 遊び方

- PC: マウス移動で落下位置を選び、左クリックでフルーツを落とします。
- スマホ: タップした位置からフルーツを落とします。
- 同じ種類のフルーツが接触すると一段階上のフルーツに合体します。
- ラインを超えた状態が続くとゲームオーバーです。
- 「揺らす」は盤面へ左右方向の力を加えます。使用後は10秒のクールダウンがあります。

## 構成

```text
suika-style-game/
├── assets/
├── css/
│   └── style.css
├── js/
│   └── main.js
├── index.html
└── README.md
```

## 技術

- HTML / CSS / JavaScript
- Canvas API
- Matter.js
- localStorage

## Asset ID

- fruit_01 ～ fruit_11
- effect_merge
- background_main
- ui_buttons
- ui_icons
- logo_title

フルーツ画像は `assets/suika-style-game_sprits.png` の `fruit_01` ～ `fruit_11` を使用します。画像読み込みに失敗した場合は Canvas の円描画へフォールバックします。`AudioManager` は将来の効果音追加用の空実装です。
