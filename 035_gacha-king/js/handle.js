// Clockwise angular tracking, independent of DOM and animation timing.
export const TURN_ANGLE = 240;
export function createTurnTracker({ threshold = TURN_ANGLE, detent = 15 } = {}) {
  let pointerId = null;
  let previous = 0;
  let progress = 0;
  let complete = false;
  return {
    begin(id, angle) {
      if (pointerId !== null) return false;
      pointerId = id; previous = angle; progress = 0; complete = false;
      return true;
    },
    move(id, angle) {
      if (id !== pointerId || complete) return null;
      const delta = ((angle - previous + 540) % 360) - 180;
      previous = angle;
      // Reject jumps across the center or discontinuous synthetic input.
      if (Math.abs(delta) > 75) return { progress, tick: false, complete: false };
      const before = Math.floor(progress / detent);
      progress = Math.max(0, Math.min(threshold, progress + delta));
      complete = progress >= threshold;
      return { progress, tick: Math.floor(progress / detent) > before, complete };
    },
    end(id) {
      if (id !== pointerId) return null;
      pointerId = null;
      return { complete, progress };
    },
    cancel() { pointerId = null; previous = 0; progress = 0; complete = false; },
    get active() { return pointerId !== null; }
  };
}
