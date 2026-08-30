(function () {
  "use strict";
  const config = window.ORE_CONFIG;
  const sounds = {
    fightPunchSwing:{id:"fightPunchSwing",label:"パンチを振る音",short:"PUNCH",example:"シュッ！",max:.8,category:"fight",minInterval:80},
    fightKickSwing:{id:"fightKickSwing",label:"キックを振る音",short:"KICK",example:"ふんっ！",max:1,category:"fight",minInterval:120},
    fightHitLight:{id:"fightHitLight",label:"軽い攻撃命中",short:"LIGHT HIT",example:"バシッ！",max:.8,category:"fight",minInterval:55},
    fightHitHeavy:{id:"fightHitHeavy",label:"強い攻撃命中",short:"HEAVY HIT",example:"ドカッ！",max:1,category:"fight",minInterval:80},
    fightDamage:{id:"fightDamage",label:"被弾ボイス",short:"DAMAGE",example:"いてっ！",max:1.2,category:"fight",minInterval:180,description:"複数登録して順番再生すると会話のように変化します"},
    fightGuard:{id:"fightGuard",label:"ガード",short:"GUARD",example:"カン！",max:.8,category:"fight",minInterval:100},
    fightGuardBreak:{id:"fightGuardBreak",label:"ガード崩し",short:"BREAK",example:"割れた！",max:1.5,category:"fight"},
    fightJump:{id:"fightJump",label:"ジャンプ",short:"JUMP",example:"よいしょ！",max:1,category:"fight"},
    fightLand:{id:"fightLand",label:"着地",short:"LAND",example:"ドスン！",max:1,category:"fight"},
    fightSpecialCall:{id:"fightSpecialCall",label:"🔥 必殺技名",short:"SPECIAL CALL",example:"オレファイヤー！！",max:3,category:"fight",description:"思い切り技名を叫ぶと面白い"},
    fightSpecialEffect:{id:"fightSpecialEffect",label:"必殺技発動音",short:"SPECIAL FX",example:"ドカーン！",max:2,category:"fight"},
    fightSpecialHit:{id:"fightSpecialHit",label:"必殺技命中",short:"SPECIAL HIT",example:"ズドーン！",max:2,category:"fight",minInterval:120},
    fightDown:{id:"fightDown",label:"ダウン",short:"DOWN",example:"ぐわぁ！",max:2,category:"fight",minInterval:300},
    fightKO:{id:"fightKO",label:"KO",short:"K.O.",example:"うわぁぁぁ！",max:3,category:"fight"},
    fightWin:{id:"fightWin",label:"勝利",short:"YOU WIN",example:"俺の勝ち！",max:3,category:"fight"},
    fightLose:{id:"fightLose",label:"敗北",short:"YOU LOSE",example:"負けたー！",max:3,category:"fight"},
    fightRoundStart:{id:"fightRoundStart",label:"ラウンド開始",short:"FIGHT",example:"ファイト！",max:2,category:"fight"},
    fightFinalRound:{id:"fightFinalRound",label:"最終ラウンド",short:"FINAL",example:"最後だ！",max:2,category:"fight"},
    fightCombo:{id:"fightCombo",label:"コンボ達成",short:"COMBO",example:"いいぞ！",max:1.5,category:"fight",minInterval:250},
    fightCounter:{id:"fightCounter",label:"カウンター",short:"COUNTER",example:"今だ！",max:1.5,category:"fight",minInterval:250}
  };
  Object.assign(config.soundCatalog, sounds);
  config.soundDefinitions = Object.values(config.soundCatalog);
  delete config.gameDefinitions.fighting;
  config.gameDefinitions.fight = {
    id:"fight",order:7,name:"格闘",subtitle:"効果音全部オレ 格闘ゲーム",
    description:"殴る声も、痛がる声も、必殺技も全部オレ。",playable:true,bgm:null,sounds:Object.keys(sounds)
  };
  config.defaultSettings = { ...config.defaultSettings, specialMoveName:"オレファイヤー", fightEffect:"fire", fightDifficulty:"easy" };
})();
