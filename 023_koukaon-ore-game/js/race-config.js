(function () {
  "use strict";
  const config = window.ORE_CONFIG;
  const sounds = {
    raceEngine:{id:"raceEngine",label:"エンジン",short:"ENGINE",example:"ブルルルルル…",max:2,loop:true,category:"race",description:"走行中ループします"},
    raceAccelerate:{id:"raceAccelerate",label:"加速",short:"ACCEL",example:"ブォォーン！",max:1.5,category:"race"},
    raceBrake:{id:"raceBrake",label:"ブレーキ",short:"BRAKE",example:"キキーッ！",max:1.5,category:"race"},
    raceDrift:{id:"raceDrift",label:"ドリフト",short:"DRIFT",example:"ギャギャギャ！",max:2,category:"race"},
    raceCrash:{id:"raceCrash",label:"衝突",short:"CRASH",example:"ドン！",max:1.5,category:"race"},
    raceOvertake:{id:"raceOvertake",label:"追い抜き",short:"OVERTAKE",example:"どけどけー！",max:2,category:"race"},
    raceItem:{id:"raceItem",label:"アイテム取得",short:"ITEM",example:"もらった！",max:1.5,category:"race"},
    raceBoost:{id:"raceBoost",label:"ブースト",short:"BOOST",example:"うおおお！",max:2,category:"race"},
    raceWarning:{id:"raceWarning",label:"危険警告",short:"WARNING",example:"危ない！",max:1.5,category:"race"},
    raceStart:{id:"raceStart",label:"スタート",short:"GO!",example:"ゴー！",max:2,category:"race"},
    raceGoal:{id:"raceGoal",label:"ゴール",short:"GOAL",example:"ゴォォール！",max:3,category:"race"},
    raceGameOver:{id:"raceGameOver",label:"リタイア",short:"RETIRED",example:"終わったー！",max:3,category:"race"}
  };
  Object.assign(config.soundCatalog, sounds); config.soundDefinitions = Object.values(config.soundCatalog);
  delete config.gameDefinitions.racing;
  config.gameDefinitions.race={id:"race",order:4,name:"レース",subtitle:"効果音全部オレ レース",description:"自分の声をエンジンにして走る疑似3Dアーケードレース。",playable:true,bgm:null,loopSounds:["raceEngine"],sounds:Object.keys(sounds)};
  config.gameDefinitions.breakout={id:"breakout",order:5,name:"ブロック崩し",subtitle:"ブロック崩し",description:"次回追加予定",playable:false,sounds:[]};
  config.gameDefinitions.rhythm={id:"rhythm",order:6,name:"リズムゲーム",subtitle:"リズムゲーム",description:"次回追加予定",playable:false,sounds:[]};
})();
