(function () {
  "use strict";

  const soundCatalog = {
    shot: { id: "shot", label: "自機ショット", short: "SHOT", example: "ピュン！", max: 1 },
    enemyShot: { id: "enemyShot", label: "敵ショット", short: "ENEMY SHOT", example: "ビビッ！", max: 1 },
    enemyDestroy: { id: "enemyDestroy", label: "敵撃破", short: "ENEMY", example: "バシュッ！", max: 1.5 },
    explosion: { id: "explosion", label: "爆発", short: "BOOM", example: "ドカーン！", max: 2 },
    damage: { id: "damage", label: "プレイヤーダメージ", short: "DAMAGE", example: "いてっ！", max: 1.5 },
    item: { id: "item", label: "アイテム取得", short: "ITEM", example: "キラーン！", max: 1.5 },
    boss: { id: "boss", label: "ボス登場", short: "BOSS", example: "デデーン！", max: 2.5 },
    gameOver: { id: "gameOver", label: "ゲームオーバー", short: "GAME OVER", example: "終わったー！", max: 3 },
    clear: { id: "clear", label: "ステージクリア", short: "CLEAR", example: "やったー！", max: 3 },
    actionJump: { id: "actionJump", label: "ジャンプ", short: "JUMP", example: "よいしょ！", max: 1.5 },
    actionLand: { id: "actionLand", label: "着地", short: "LAND", example: "ドスン！", max: 1.5 },
    actionAttack: { id: "actionAttack", label: "攻撃", short: "ATTACK", example: "とうっ！", max: 1.5 },
    actionEnemyHit: { id: "actionEnemyHit", label: "敵に攻撃命中", short: "HIT", example: "バシッ！", max: 1.2 },
    actionEnemyDestroy: { id: "actionEnemyDestroy", label: "敵撃破", short: "K.O.", example: "やった！", max: 1.8 },
    actionDamage: { id: "actionDamage", label: "プレイヤーダメージ", short: "DAMAGE", example: "いてっ！", max: 1.5 },
    actionItem: { id: "actionItem", label: "アイテム取得", short: "ITEM", example: "いただき！", max: 1.5 },
    actionFall: { id: "actionFall", label: "穴へ落下", short: "FALL", example: "うわぁぁぁ！", max: 3 },
    actionCheckpoint: { id: "actionCheckpoint", label: "チェックポイント", short: "CHECK", example: "ここから！", max: 2 },
    actionClear: { id: "actionClear", label: "ステージクリア", short: "CLEAR", example: "イェーイ！", max: 3 },
    actionGameOver: { id: "actionGameOver", label: "ゲームオーバー", short: "GAME OVER", example: "もうダメだ！", max: 3 },
    actionDash: { id: "actionDash", label: "ダッシュ", short: "DASH", example: "ビューン！", max: 1.2 },
    actionPowerUp: { id: "actionPowerUp", label: "パワーアップ", short: "POWER UP", example: "パワー全開！", max: 2 }
  };

  const gameDefinitions = {
    shooter: {
      id: "shooter", order: 1, name: "シューティング", subtitle: "縦スクロールシューティング",
      description: "声のショットを連射して、敵とボスを吹き飛ばそう。", playable: true,
      sounds: ["shot", "enemyShot", "enemyDestroy", "explosion", "damage", "item", "boss", "gameOver", "clear"]
    },
    action: {
      id: "action", order: 2, name: "アクション", subtitle: "横スクロールアクション",
      description: "ジャンプも攻撃も落下もオレ。声だらけの1ステージを駆け抜けよう。", playable: true,
      sounds: ["actionJump", "actionLand", "actionAttack", "actionEnemyHit", "actionEnemyDestroy", "actionDamage", "actionItem", "actionFall", "actionCheckpoint", "actionClear", "actionGameOver", "actionDash", "actionPowerUp"]
    },
    puzzle: {
      id: "puzzle", order: 3, name: "パズル", subtitle: "パズルゲーム",
      description: "ひらめきの音まで全部オレ。", playable: false, sounds: []
    }
  };

  window.ORE_CONFIG = {
    dbName: "ore-sound-arcade",
    dbVersion: 1,
    defaultPackId: "ore-default",
    defaultGameId: "shooter",
    soundCatalog,
    soundDefinitions: Object.values(soundCatalog),
    gameDefinitions,
    getGameSounds(gameId) {
      const game = gameDefinitions[gameId] || gameDefinitions.shooter;
      return game.sounds.map((id) => soundCatalog[id]);
    },
    defaultSettings: { masterVolume: 0.9, effectVolume: 0.9, autoTrim: true, autoFire: true, vibration: true }
  };
})();
