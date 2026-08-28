(function defineStages(global) {
  "use strict";
  const P = global.PythagoraLab;

  P.STAGES = Object.freeze([
    Object.freeze({
      id: "stage-1",
      number: 1,
      name: "坂道を作ろう",
      short: "はじめの一歩",
      description: "坂道を置いて、ボールを赤いGOALへ届けよう。",
      fieldWidth: 760,
      fieldHeight: 440,
      startPosition: Object.freeze({ x: 92, y: 126, velocity: Object.freeze({ x: 3.4, y: 0 }) }),
      goalPosition: Object.freeze({ x: 650, y: 354, width: 84, height: 106 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s1-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s1-ledge", type: "floor", x: 150, y: 176, width: 220, height: 24, locked: true }),
        Object.freeze({ id: "s1-left-wall", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true })
      ]),
      starterParts: Object.freeze([]),
      availableParts: Object.freeze({ ramp: 1 }),
      maxParts: 1,
      clearConditions: Object.freeze({ target: "ball", minChain: 0, threeStarsParts: 1, twoStarsParts: 1 })
    })
  ]);

  P.getStage = function getStage(stageId) {
    return P.STAGES.find((stage) => stage.id === stageId) || P.STAGES[0];
  };
})(window);
