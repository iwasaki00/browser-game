export const STAGES = [
  {
    id: "gravity-core-01",
    name: "最初のスイングバイ",
    world: { width: 375, height: 500 },
    rocketRadius: 6,
    launch: {
      position: { x: 48, y: 430 },
      angleDeg: -55,
      speed: 170,
      angleRange: [-72, -35],
      speedRange: [120, 220],
    },
    planets: [
      { id: "planet-a", x: 196, y: 282, radius: 38, mass: 5200, color: "#6fd3ff" },
    ],
    goal: { id: "goal-a", x: 319, y: 105, radius: 24 },
  },
];

export function getStage(stageId = STAGES[0].id) {
  const source = STAGES.find((stage) => stage.id === stageId);
  if (!source) throw new Error(`Unknown stage: ${stageId}`);
  return structuredClone(source);
}
