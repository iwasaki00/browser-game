(function () {
  "use strict";
  const config = window.ORE_CONFIG;
  const sounds = {
    breakoutLaunch:{id:"breakoutLaunch",label:"ボール発射",short:"LAUNCH",example:"いくぞ！",max:1.5,category:"breakout"},
    breakoutPaddle:{id:"breakoutPaddle",label:"パドル反射",short:"PADDLE",example:"ポン！",max:.8,category:"breakout",minInterval:25,description:"短い音がおすすめ（0.2～0.6秒）"},
    breakoutWall:{id:"breakoutWall",label:"壁反射",short:"WALL",example:"カン！",max:.8,category:"breakout",minInterval:45,description:"短い音がおすすめ（0.2～0.6秒）"},
    breakoutBlock:{id:"breakoutBlock",label:"通常ブロック破壊",short:"BLOCK",example:"パキッ！",max:.8,category:"breakout",minInterval:28,description:"短時間に連続再生されます（0.2～0.6秒推奨）"},
    breakoutHardBlock:{id:"breakoutHardBlock",label:"硬いブロック命中",short:"HARD HIT",example:"ガン！",max:1,category:"breakout",minInterval:40,description:"短い音がおすすめ"},
    breakoutHardBreak:{id:"breakoutHardBreak",label:"硬いブロック破壊",short:"HARD BREAK",example:"バキン！",max:1.2,category:"breakout",minInterval:35},
    breakoutCombo:{id:"breakoutCombo",label:"連続破壊",short:"COMBO",example:"いいぞ！",max:1.5,category:"breakout",minInterval:120},
    breakoutItem:{id:"breakoutItem",label:"アイテム取得",short:"ITEM",example:"キター！",max:1.5,category:"breakout"},
    breakoutPowerUp:{id:"breakoutPowerUp",label:"パワーアップ",short:"POWER UP",example:"でかくなった！",max:1.5,category:"breakout"},
    breakoutMultiBall:{id:"breakoutMultiBall",label:"マルチボール",short:"MULTI",example:"増えたー！",max:2,category:"breakout"},
    breakoutMiss:{id:"breakoutMiss",label:"ボール落下",short:"MISS",example:"あー！",max:2,category:"breakout"},
    breakoutLifeUp:{id:"breakoutLifeUp",label:"残機UP",short:"LIFE UP",example:"もう一回！",max:1.5,category:"breakout"},
    breakoutWarning:{id:"breakoutWarning",label:"残りブロック警告",short:"WARNING",example:"あと少し！",max:1.5,category:"breakout"},
    breakoutClear:{id:"breakoutClear",label:"ステージクリア",short:"CLEAR",example:"全部壊した！",max:3,category:"breakout"},
    breakoutGameOver:{id:"breakoutGameOver",label:"ゲームオーバー",short:"GAME OVER",example:"終わったー！",max:3,category:"breakout"}
  };
  Object.assign(config.soundCatalog, sounds);
  config.soundDefinitions = Object.values(config.soundCatalog);
  config.gameDefinitions.breakout = {
    id:"breakout",order:6,name:"ブロック崩し",subtitle:"効果音全部オレ ブロック崩し",
    description:"跳ね返る音も壊れる音も全部オレ。",playable:true,bgm:null,sounds:Object.keys(sounds)
  };
  config.gameDefinitions.fighting = {
    id:"fighting",order:7,name:"格闘",subtitle:"効果音全部オレ 格闘",description:"次回追加予定",playable:false,sounds:[]
  };
})();
