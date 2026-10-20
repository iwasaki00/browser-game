import { type Endpoint, type WorldState } from './world';
import { freezeData } from '../challenge/stage';

export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

/** Minimum read-only shape shared by live-world rendering and immutable comparison snapshots. */
export interface WorldView {
  readonly width: number; readonly height: number;
  readonly heights: ArrayLike<number>; readonly water: ArrayLike<number>;
  readonly terrainType: ArrayLike<number>; readonly protected: ArrayLike<number>;
}
export interface WorldSnapshot extends WorldView {
  readonly heights: readonly number[]; readonly water: readonly number[];
  readonly terrainType: readonly number[]; readonly protected: readonly number[];
  readonly sources: readonly Readonly<Endpoint>[]; readonly intakes: readonly Readonly<Endpoint>[]; readonly outlets: readonly Readonly<Endpoint>[];
  readonly step: number; readonly initialWater: number; readonly cumulativeSupply: number;
  readonly cumulativeIntake: number; readonly cumulativeOutlet: number;
}
export function cloneWorld(world: WorldState): WorldState {
  return { ...world, heights: world.heights.slice(), water: world.water.slice(), terrainType: world.terrainType.slice(),
    protected: world.protected.slice(), sources: world.sources.map(e => ({ ...e })),
    intakes: world.intakes.map(e => ({ ...e })), outlets: world.outlets.map(e => ({ ...e })) };
}
export function snapshotWorld(world: WorldState): WorldSnapshot {
  return freezeData({ ...world, heights: Array.from(world.heights), water: Array.from(world.water),
    terrainType: Array.from(world.terrainType), protected: Array.from(world.protected),
    sources: world.sources.map(e => ({ ...e })), intakes: world.intakes.map(e => ({ ...e })), outlets: world.outlets.map(e => ({ ...e })) });
}
