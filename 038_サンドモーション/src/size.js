import { imagePlacement } from './image.js';
import { hourglassPlacement } from './hourglass.js';

export const SIZES = Object.freeze({
  free: Object.freeze({ min: 30, max: 80, initial: 70 }),
  hourglass: Object.freeze({ min: 40, max: 100, initial: 100 })
});

export function sizePlacement(source, mode, width, height, size = SIZES[mode].initial) {
  const bounds = SIZES[mode];
  const value = Number.isFinite(size) ? Math.max(bounds.min, Math.min(bounds.max, size)) : bounds.initial;
  const place = mode === 'hourglass' ? hourglassPlacement : imagePlacement;
  return place(source.naturalWidth || source.width, source.naturalHeight || source.height, width, height, value / 100);
}
