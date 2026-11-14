export const QUALITIES = Object.freeze({
  light: Object.freeze({ width: 120, height: 200 }),
  standard: Object.freeze({ width: 180, height: 300 }),
  high: Object.freeze({ width: 270, height: 450 })
});

export function simulationTiming(width) {
  // Preserve the existing 60 Hz light/standard modes. Finer cells take more
  // identical physics steps so displayed motion doesn't slow to two thirds.
  const motionScale = Math.max(1, width / 180);
  return { motionScale, stepMs: 1000 / (60 * motionScale), maxSteps: Math.ceil(4 * motionScale) };
}
