(function () {
  "use strict";
  class RhythmJudge {
    static windows={perfect:.05,great:.10,good:.16};
    static judge(delta){const value=Math.abs(delta);if(value<=this.windows.perfect)return"PERFECT";if(value<=this.windows.great)return"GREAT";if(value<=this.windows.good)return"GOOD";return"MISS";}
    static score(judgement){return{PERFECT:1000,GREAT:700,GOOD:300,MISS:0}[judgement]||0;}
    static accuracy(stats){const total=stats.perfect+stats.great+stats.good+stats.miss;if(!total)return 0;return(stats.perfect+stats.great*.7+stats.good*.3)/total*100;}
  }
  window.RhythmJudge=RhythmJudge;
})();
