(function () {
  "use strict";
  const point=(x,y)=>({x,y});
  class PinballTable {
    static create(width,height) {
      const top=70,bottom=height-112,cx=width/2;
      return {
        id:"ore-machine-01",name:"ORE MACHINE 01",top,bottom,
        walls:[
          {id:"left",a:point(18,top+25),b:point(18,bottom-82)},
          {id:"leftTop",a:point(18,top+25),b:point(70,top)},
          {id:"top",a:point(70,top),b:point(width-25,top)},
          {id:"right",a:point(width-18,top+8),b:point(width-18,bottom)},
          {id:"leftGuide",a:point(18,bottom-82),b:point(width*.25,bottom-24)},
          {id:"rightGuide",a:point(width-18,bottom-82),b:point(width*.75,bottom-24)},
          {id:"plungerRail",a:point(width-58,top+80),b:point(width-58,bottom-10)}
        ],
        bumpers:[
          {id:"b1",x:cx-58,y:top+145,r:23},{id:"b2",x:cx+18,y:top+118,r:23},
          {id:"b3",x:cx+63,y:top+185,r:22},{id:"b4",x:cx-25,y:top+215,r:21}
        ],
        targets:[
          {id:"O",letter:"O",x:42,y:top+92,w:18,h:45},
          {id:"R",letter:"R",x:68,y:top+78,w:18,h:45},
          {id:"E",letter:"E",x:94,y:top+92,w:18,h:45}
        ],
        lanes:[
          {id:"laneL",x:25,y:top+18,w:31,h:13},{id:"laneC",x:cx-17,y:top+17,w:34,h:13},
          {id:"laneR",x:width-54,y:top+18,w:29,h:13}
        ],
        bell:{id:"bell",x:width-70,y:top+255,w:28,h:42},
        slings:[
          {id:"slingL",a:point(48,bottom-120),b:point(width*.28,bottom-62),push:1},
          {id:"slingR",a:point(width-48,bottom-120),b:point(width*.72,bottom-62),push:-1}
        ],
        flippers:{
          left:{id:"left",pivot:point(width*.29,bottom-25),length:78,down:.28,up:-.58},
          right:{id:"right",pivot:point(width*.71,bottom-25),length:78,down:Math.PI-.28,up:Math.PI+.58}
        },
        plunger:{x:width-47,y:bottom-42,w:22,h:92},drain:{x:width*.36,y:bottom-3,w:width*.28,h:28}
      };
    }
  }
  window.PinballTable=PinballTable;
})();
