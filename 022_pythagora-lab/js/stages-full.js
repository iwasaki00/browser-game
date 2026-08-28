(function defineCompleteStages(global) {
  "use strict";
  const P = global.PythagoraLab;
  const R = P.util.radians;

  P.STAGES = Object.freeze([
    Object.freeze({
      id: "stage-1", number: 1, name: "坂道を作ろう", short: "坂道でボールを導こう",
      description: "坂道を置いて、ボールを赤いGOALへ届けよう。",
      fieldWidth: 760, fieldHeight: 440,
      startPosition: Object.freeze({ x: 92, y: 126, velocity: Object.freeze({ x: 3.4, y: 0 }) }),
      goalPosition: Object.freeze({ x: 650, y: 354, width: 84, height: 106 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s1-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s1-ledge", type: "floor", x: 150, y: 176, width: 220, height: 24, locked: true }),
        Object.freeze({ id: "s1-left-wall", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true })
      ]),
      starterParts: Object.freeze([]),
      availableParts: Object.freeze({ ramp: 1 }), maxParts: 1,
      clearConditions: Object.freeze({ target: "ball", minChain: 0, threeStarsParts: 1, twoStarsParts: 1 }),
      debugSolution: Object.freeze([{ type: "ramp", x: 385, y: 282, width: 330, angle: R(34) }])
    }),
    Object.freeze({
      id: "stage-2", number: 2, name: "ドミノをつなげよう", short: "カタカタ連鎖の基本",
      description: "5枚のドミノをつないで、待機ボールをGOALへ押し出そう。",
      fieldWidth: 760, fieldHeight: 440,
      startPosition: Object.freeze({ x: 78, y: 112, velocity: Object.freeze({ x: 3.1, y: 0 }) }),
      goalPosition: Object.freeze({ x: 694, y: 354, width: 94, height: 106 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s2-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s2-launch", type: "ramp", x: 172, y: 190, width: 250, height: 22, angle: R(16), locked: true }),
        Object.freeze({ id: "s2-waiting-ball", type: "ball", x: 598, y: 390, locked: true, settings: Object.freeze({ role: "waiting" }) }),
        Object.freeze({ id: "s2-left-wall", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true })
      ]),
      starterParts: Object.freeze([
        Object.freeze({ id: "s2-domino-a", type: "domino", x: 352, y: 372 }),
        Object.freeze({ id: "s2-domino-b", type: "domino", x: 402, y: 372 })
      ]),
      availableParts: Object.freeze({ domino: 5 }), maxParts: 5,
      clearConditions: Object.freeze({ target: "ball", minChain: 2, threeStarsParts: 5, twoStarsParts: 5 }),
      debugSolution: Object.freeze([330, 380, 430, 480, 530].map((x) => Object.freeze({ type: "domino", x, y: 372 })))
    }),
    Object.freeze({
      id: "stage-3", number: 3, name: "跳ね上げろ", short: "重さを力に変えよう",
      description: "箱をシーソーへ落とし、反対側のボールを跳ね上げよう。",
      fieldWidth: 760, fieldHeight: 440,
      startPosition: Object.freeze({ x: 72, y: 100, velocity: Object.freeze({ x: 3.3, y: 0 }) }),
      goalPosition: Object.freeze({ x: 694, y: 190, width: 108, height: 126 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s3-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s3-launch", type: "ramp", x: 156, y: 170, width: 210, height: 22, angle: R(14), locked: true }),
        Object.freeze({ id: "s3-shelf", type: "floor", x: 330, y: 236, width: 360, height: 22, locked: true }),
        Object.freeze({ id: "s3-waiting-ball", type: "ball", x: 650, y: 326, locked: true, settings: Object.freeze({ role: "waiting" }) }),
        Object.freeze({ id: "s3-back-wall", type: "wall", x: 744, y: 245, width: 24, height: 190, locked: true })
      ]),
      starterParts: Object.freeze([
        Object.freeze({ id: "s3-box", type: "box", x: 466, y: 195 }),
        Object.freeze({ id: "s3-seesaw", type: "seesaw", x: 586, y: 362, width: 230 }),
        Object.freeze({ id: "s3-ramp", type: "ramp", x: 668, y: 274, width: 180, angle: R(-18) })
      ]),
      availableParts: Object.freeze({ ramp: 1, box: 1, seesaw: 1 }), maxParts: 3,
      clearConditions: Object.freeze({ target: "ball", minChain: 1, threeStarsParts: 3, twoStarsParts: 3 }),
      debugSolution: Object.freeze([
        Object.freeze({ type: "box", x: 466, y: 195 }),
        Object.freeze({ type: "seesaw", x: 586, y: 362, width: 230 }),
        Object.freeze({ type: "ramp", x: 668, y: 274, width: 180, angle: R(-18) })
      ])
    }),
    Object.freeze({
      id: "stage-4", number: 4, name: "バネを使え", short: "ポーンと高台へ",
      description: "バネの向きを調整して、高い位置のGOALへ飛ばそう。",
      fieldWidth: 760, fieldHeight: 440,
      startPosition: Object.freeze({ x: 82, y: 94, velocity: Object.freeze({ x: 3.5, y: 0 }) }),
      goalPosition: Object.freeze({ x: 686, y: 206, width: 116, height: 132 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s4-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s4-goal-shelf", type: "floor", x: 686, y: 280, width: 144, height: 20, locked: true }),
        Object.freeze({ id: "s4-back-wall", type: "wall", x: 748, y: 206, width: 22, height: 180, locked: true }),
        Object.freeze({ id: "s4-left-wall", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true })
      ]),
      starterParts: Object.freeze([
        Object.freeze({ id: "s4-ramp", type: "ramp", x: 328, y: 262, width: 410, angle: R(24) }),
        Object.freeze({ id: "s4-spring", type: "spring", x: 588, y: 390, angle: R(29) })
      ]),
      availableParts: Object.freeze({ ramp: 1, spring: 1 }), maxParts: 2,
      clearConditions: Object.freeze({ target: "ball", minChain: 1, threeStarsParts: 2, twoStarsParts: 2 }),
      debugSolution: Object.freeze([
        Object.freeze({ type: "ramp", x: 328, y: 262, width: 410, angle: R(24) }),
        Object.freeze({ type: "spring", x: 588, y: 390, angle: R(29) })
      ])
    }),
    Object.freeze({
      id: "stage-5", number: 5, name: "大連鎖", short: "全部つないで5 CHAIN",
      description: "坂道、ドミノ、箱、シーソー、バネ、スイッチを5CHAIN以上つなげよう。",
      fieldWidth: 760, fieldHeight: 440,
      startPosition: Object.freeze({ x: 58, y: 80, velocity: Object.freeze({ x: 3.4, y: 0 }) }),
      goalPosition: Object.freeze({ x: 690, y: 178, width: 112, height: 120 }),
      fixedObjects: Object.freeze([
        Object.freeze({ id: "s5-floor", type: "floor", x: 380, y: 426, width: 780, height: 32, locked: true }),
        Object.freeze({ id: "s5-shelf", type: "floor", x: 330, y: 230, width: 500, height: 22, locked: true }),
        Object.freeze({ id: "s5-left-wall", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true }),
        Object.freeze({ id: "s5-back-wall", type: "wall", x: 748, y: 220, width: 22, height: 260, locked: true })
      ]),
      starterParts: Object.freeze([
        Object.freeze({ id: "s5-ramp-a", type: "ramp", x: 158, y: 156, width: 230, angle: R(18) }),
        Object.freeze({ id: "s5-domino-a", type: "domino", x: 322, y: 181 }),
        Object.freeze({ id: "s5-domino-b", type: "domino", x: 360, y: 181 }),
        Object.freeze({ id: "s5-domino-c", type: "domino", x: 398, y: 181 }),
        Object.freeze({ id: "s5-domino-d", type: "domino", x: 436, y: 181 }),
        Object.freeze({ id: "s5-box", type: "box", x: 504, y: 191 }),
        Object.freeze({ id: "s5-seesaw", type: "seesaw", x: 570, y: 360, width: 220 }),
        Object.freeze({ id: "s5-spring", type: "spring", x: 646, y: 390, angle: R(30) }),
        Object.freeze({ id: "s5-switch", type: "switch", x: 704, y: 316, settings: Object.freeze({ spawn: Object.freeze({ x: 610, y: 82, velocity: Object.freeze({ x: 3.2, y: 0 }) }) }) }),
        Object.freeze({ id: "s5-ramp-b", type: "ramp", x: 640, y: 144, width: 190, angle: R(18) })
      ]),
      availableParts: Object.freeze({ ball: 1, ramp: 2, domino: 5, box: 1, seesaw: 1, spring: 1, switch: 1 }), maxParts: 12,
      clearConditions: Object.freeze({ target: "ball", minChain: 5, threeStarsParts: 10, twoStarsParts: 12 }),
      debugSolution: Object.freeze([
        Object.freeze({ type: "ramp", x: 158, y: 156, width: 230, angle: R(18) }),
        ...[322, 360, 398, 436, 474].map((x) => Object.freeze({ type: "domino", x, y: 181 })),
        Object.freeze({ type: "box", x: 526, y: 191 }),
        Object.freeze({ type: "seesaw", x: 570, y: 360, width: 220 }),
        Object.freeze({ type: "spring", x: 646, y: 390, angle: R(30) }),
        Object.freeze({ type: "switch", x: 704, y: 316, settings: Object.freeze({ spawn: Object.freeze({ x: 610, y: 82, velocity: Object.freeze({ x: 3.2, y: 0 }) }) }) }),
        Object.freeze({ type: "ramp", x: 640, y: 144, width: 190, angle: R(18) })
      ])
    })
  ]);

  P.getStage = function getStage(stageId) {
    return P.STAGES.find((stage) => stage.id === stageId) || P.STAGES[0];
  };

  P.createFreeStage = function createFreeStage(work = null) {
    const initialParts = work?.parts?.length ? P.util.deepClone(work.parts) : [
      { id: P.util.uid("free-start"), type: "start", x: 95, y: 92 },
      { id: P.util.uid("free-goal"), type: "goal", x: 670, y: 350, width: 86, height: 104 }
    ];
    return {
      id: work ? `free-${work.id}` : `free-${Date.now().toString(36)}`,
      number: 0, free: true, workId: work?.id || null, workName: work?.name || "新しい工作",
      name: work?.name || "自由工作", short: "OPEN WORKBENCH",
      description: "全部品が使い放題。好きな連鎖を組み立てよう。",
      fieldWidth: Number(work?.fieldWidth) || 760, fieldHeight: Number(work?.fieldHeight) || 440,
      startPosition: { x: 95, y: 92, velocity: { x: 3.1, y: 0 } },
      goalPosition: { x: 670, y: 350, width: 86, height: 104 },
      fixedObjects: [
        { id: "free-left-bound", type: "wall", x: -10, y: 220, width: 30, height: 460, locked: true },
        { id: "free-right-bound", type: "wall", x: 770, y: 220, width: 30, height: 460, locked: true }
      ],
      starterParts: initialParts,
      availableParts: { ball: Infinity, floor: Infinity, ramp: Infinity, wall: Infinity, domino: Infinity, box: Infinity, seesaw: Infinity, spring: Infinity, pendulum: Infinity, switch: Infinity, start: Infinity, goal: Infinity },
      maxParts: Infinity,
      clearConditions: { target: "ball", minChain: 0, threeStarsParts: Infinity, twoStarsParts: Infinity }
    };
  };
})(window);
