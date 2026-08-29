(function () {
  "use strict";

  window.ORE_CONFIG = {
    dbName: "ore-sound-arcade",
    dbVersion: 1,
    defaultPackId: "ore-default",
    soundDefinitions: [
      { id: "shot", label: "自機ショット", short: "SHOT", example: "ピュン！", max: 1 },
      { id: "enemyShot", label: "敵ショット", short: "ENEMY SHOT", example: "ビビッ！", max: 1 },
      { id: "enemyDestroy", label: "敵撃破", short: "ENEMY", example: "バシュッ！", max: 1.5 },
      { id: "explosion", label: "爆発", short: "BOOM", example: "ドカーン！", max: 2 },
      { id: "damage", label: "プレイヤーダメージ", short: "DAMAGE", example: "いてっ！", max: 1.5 },
      { id: "item", label: "アイテム取得", short: "ITEM", example: "キラーン！", max: 1.5 },
      { id: "boss", label: "ボス登場", short: "BOSS", example: "デデーン！", max: 2.5 },
      { id: "gameOver", label: "ゲームオーバー", short: "GAME OVER", example: "終わったー！", max: 3 },
      { id: "clear", label: "ステージクリア", short: "CLEAR", example: "やったー！", max: 3 }
    ],
    defaultSettings: {
      masterVolume: 0.9,
      effectVolume: 0.9,
      autoTrim: true,
      autoFire: true,
      vibration: true
    }
  };
})();
