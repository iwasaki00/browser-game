(function () {
  "use strict";
  const config = window.ORE_CONFIG;
  const sounds = {
    pinballLaunch:{id:"pinballLaunch",label:"ボール発射",short:"LAUNCH",example:"シュポン！",max:1.2,category:"pinball"},
    pinballFlipper:{id:"pinballFlipper",label:"フリッパー",short:"FLIP",example:"カチャ！",max:.7,category:"pinball",minInterval:70,description:"0.2～0.7秒程度の短い音がおすすめ"},
    pinballWall:{id:"pinballWall",label:"壁反射",short:"WALL",example:"カン！",max:.7,category:"pinball",minInterval:55,description:"0.2～0.7秒程度の短い音がおすすめ"},
    pinballBumper:{id:"pinballBumper",label:"バンパー",short:"BUMPER",example:"ポン！",max:.7,category:"pinball",minInterval:55,description:"0.2～0.7秒程度の短い音がおすすめ"},
    pinballSlingshot:{id:"pinballSlingshot",label:"スリングショット",short:"SLING",example:"バチン！",max:.8,category:"pinball",minInterval:90},
    pinballTarget:{id:"pinballTarget",label:"ターゲット命中",short:"TARGET",example:"パキッ！",max:.7,category:"pinball",minInterval:70,description:"0.2～0.7秒程度の短い音がおすすめ"},
    pinballTargetComplete:{id:"pinballTargetComplete",label:"OREターゲット完成",short:"ORE!",example:"オレ完成！",max:2,category:"pinball"},
    pinballLane:{id:"pinballLane",label:"レーン通過",short:"LANE",example:"ピコ！",max:.8,category:"pinball",minInterval:100},
    pinballBell:{id:"pinballBell",label:"ベル",short:"BELL",example:"チーン！",max:1.2,category:"pinball",minInterval:150},
    pinballBonus:{id:"pinballBonus",label:"ボーナス",short:"BONUS",example:"キター！",max:2,category:"pinball"},
    pinballMultiplier:{id:"pinballMultiplier",label:"倍率UP",short:"MULTI UP",example:"倍だ！",max:1.5,category:"pinball"},
    pinballMultiBall:{id:"pinballMultiBall",label:"マルチボール開始",short:"MULTIBALL",example:"増えたー！",max:2.5,category:"pinball"},
    pinballExtraBall:{id:"pinballExtraBall",label:"エクストラボール",short:"EXTRA",example:"もう1個！",max:2,category:"pinball"},
    pinballJackpot:{id:"pinballJackpot",label:"ジャックポット",short:"JACKPOT",example:"ジャックポーット！！",max:3,category:"pinball"},
    pinballDrain:{id:"pinballDrain",label:"ボール落下",short:"DRAIN",example:"あーーー！",max:2.5,category:"pinball",minInterval:250},
    pinballBallSave:{id:"pinballBallSave",label:"ボールセーブ",short:"BALL SAVE",example:"セーフ！",max:2,category:"pinball"},
    pinballWarning:{id:"pinballWarning",label:"危険・TILT",short:"WARNING",example:"危ない！",max:1.5,category:"pinball",minInterval:900},
    pinballGameOver:{id:"pinballGameOver",label:"ゲームオーバー",short:"GAME OVER",example:"終わったー！",max:3,category:"pinball"}
  };
  Object.assign(config.soundCatalog,sounds);
  config.soundDefinitions=Object.values(config.soundCatalog);
  config.gameDefinitions.pinball={id:"pinball",order:8,name:"ピンボール",subtitle:"効果音全部オレ ピンボール",description:"跳ねる音も、ベルも、ジャックポットも全部オレ。",playable:true,bgm:null,sounds:Object.keys(sounds)};
})();
