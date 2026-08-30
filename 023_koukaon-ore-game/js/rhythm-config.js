(function () {
  "use strict";
  const config = window.ORE_CONFIG;
  const sounds = {
    rhythmKick:{id:"rhythmKick",label:"キック",short:"KICK",example:"ドン！",max:1,category:"rhythm",description:"「ドン」「ボッ」など低く短い音がおすすめ"},
    rhythmSnare:{id:"rhythmSnare",label:"スネア",short:"SNARE",example:"パン！",max:1,category:"rhythm",description:"「パン」「タン」など歯切れのよい音がおすすめ"},
    rhythmHiHat:{id:"rhythmHiHat",label:"ハイハット",short:"HI-HAT",example:"チッ！",max:.8,category:"rhythm",description:"「チッ」「ツッ」など短く鋭い音がおすすめ"},
    rhythmClap:{id:"rhythmClap",label:"クラップ",short:"CLAP",example:"パッ！",max:1,category:"rhythm",description:"手拍子でも声でも、短い音がおすすめ"},
    rhythmGood:{id:"rhythmGood",label:"GOOD",short:"GOOD",example:"よし！",max:1,category:"rhythm"},
    rhythmGreat:{id:"rhythmGreat",label:"GREAT",short:"GREAT",example:"いいぞ！",max:1.2,category:"rhythm"},
    rhythmPerfect:{id:"rhythmPerfect",label:"PERFECT",short:"PERFECT",example:"完璧！",max:1.2,category:"rhythm"},
    rhythmMiss:{id:"rhythmMiss",label:"MISS",short:"MISS",example:"ミスった！",max:1.2,category:"rhythm"},
    rhythmCombo10:{id:"rhythmCombo10",label:"10 COMBO",short:"10 COMBO",example:"きた！",max:1.5,category:"rhythm"},
    rhythmCombo30:{id:"rhythmCombo30",label:"30 COMBO",short:"30 COMBO",example:"きたきた！",max:2,category:"rhythm"},
    rhythmCombo50:{id:"rhythmCombo50",label:"50 COMBO",short:"50 COMBO",example:"うおおお！",max:2.5,category:"rhythm"},
    rhythmFever:{id:"rhythmFever",label:"FEVER",short:"FEVER",example:"いけー！",max:2,category:"rhythm"},
    rhythmStart:{id:"rhythmStart",label:"スタート",short:"START",example:"全部オレ、スタート！",max:2,category:"rhythm"},
    rhythmFinish:{id:"rhythmFinish",label:"フィニッシュ",short:"FINISH",example:"全部オレ！",max:3,category:"rhythm"},
    rhythmGameOver:{id:"rhythmGameOver",label:"ゲームオーバー",short:"GAME OVER",example:"終わったー！",max:3,category:"rhythm"}
  };
  Object.assign(config.soundCatalog, sounds);
  config.soundDefinitions = Object.values(config.soundCatalog);
  config.gameDefinitions.rhythm={id:"rhythm",order:5,name:"リズム",subtitle:"効果音全部オレ リズムゲーム",description:"ドン、パン、チッ、パッ。自分の声を叩いてリズムを完成させよう。",playable:true,bgm:null,sounds:Object.keys(sounds)};
  if(config.gameDefinitions.breakout)config.gameDefinitions.breakout.order=6;
  config.defaultSettings={...config.defaultSettings,rhythmOffset:0,rhythmJudgeVoice:"important",rhythmMetronomeBpm:120};
})();
