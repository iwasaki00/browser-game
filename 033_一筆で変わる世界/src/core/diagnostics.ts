import { stepWorld } from './simulation';
import { createWorld, assertConservation, type WorldDefinition } from './world';

export interface MirrorMetric { l1: number; maximum: number; normalizedL1: number }
function mirror(values: ArrayLike<number>, width: number, height: number, axis: 'X' | 'Y'): number[] {
  return Array.from({ length: width * height }, (_, i) => {
    const x = i % width, y = Math.floor(i / width);
    return values[(axis === 'Y' ? height - 1 - y : y) * width + (axis === 'X' ? width - 1 - x : x)];
  });
}
/** Compare F(input) to mirror(F(mirror(input))) with identical phase and initial water. */
export function diagnoseMirroring(definition: WorldDefinition, steps: number, axis: 'X' | 'Y'): MirrorMetric {
  if (!Number.isInteger(steps) || steps < 0 || steps > 600) throw new Error('診断ステップ数が不正です');
  const { width, height } = definition;
  const index = (i: number) => {
    const x = i % width, y = Math.floor(i / width);
    return (axis === 'Y' ? height - 1 - y : y) * width + (axis === 'X' ? width - 1 - x : x);
  };
  const reflected: WorldDefinition = {
    ...definition, heights: mirror(definition.heights, width, height, axis),
    water: definition.water ? mirror(definition.water, width, height, axis) : undefined,
    protected: definition.protected ? mirror(definition.protected, width, height, axis) : undefined,
    sources: definition.sources?.map(e => ({ ...e, index: index(e.index) })),
    intakes: definition.intakes?.map(e => ({ ...e, index: index(e.index) })),
    outlets: definition.outlets?.map(e => ({ ...e, index: index(e.index) })),
  };
  const a = createWorld(definition), b = createWorld(reflected);
  for (let i = 0; i < steps; i++) { stepWorld(a); stepWorld(b); }
  const reflectedResult = mirror(b.water, width, height, axis);
  let l1 = 0, maximum = 0;
  for (let i = 0; i < a.water.length; i++) {
    const difference = Math.abs(a.water[i] - reflectedResult[i]);
    l1 += difference; maximum = Math.max(maximum, difference);
  }
  const total = assertConservation(a); assertConservation(b);
  return { l1, maximum, normalizedL1: total ? l1 / total : 0 };
}
