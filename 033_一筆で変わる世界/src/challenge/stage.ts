import { buildStroke, type StrokeMode } from '../core/stroke';
import { createWorld, integer, MAX_STEPS, MAX_WATER, type WorldDefinition } from '../core/world';

export interface StageFacility { readonly id: string; readonly index: number; readonly rate: number }
export interface TownDefinition {
  readonly id: string; readonly name: string; readonly centerCell: number;
  readonly linkedIntakeId?: string; readonly floodThreshold: number; readonly requiredIntake?: number;
}
export interface GoalDefinition {
  readonly type: 'WATER_DELIVERY' | 'FLOOD_PREVENTION' | 'COMBINED';
  readonly townIds: readonly string[];
  readonly deliveryDeadlineStep?: number;
  /** Observation is inclusive, from initial step 0 through this step. */
  readonly floodObservationEndStep?: number;
}
export interface StageDefinition {
  readonly id: string; readonly title: string; readonly description: string;
  readonly terrain: { readonly width: number; readonly height: number; readonly heights: readonly number[] };
  readonly initialWater: readonly number[];
  readonly sources: readonly StageFacility[]; readonly intakes: readonly StageFacility[]; readonly outlets: readonly StageFacility[];
  readonly protectedCells: readonly number[]; readonly towns: readonly TownDefinition[];
  readonly strokeMode: StrokeMode; readonly maxStrokeLength: number; readonly brushRadius: number; readonly heightDelta: number;
  readonly maxSimulationSteps: number; readonly goalDefinition: GoalDefinition;
}
export function freezeData<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
export function stageWorld(stage: StageDefinition): WorldDefinition {
  const flags = new Uint8Array(stage.terrain.width * stage.terrain.height);
  for (const index of stage.protectedCells) flags[index] = 1;
  const facilities = (items: readonly StageFacility[]) => items.map(({ index, rate }) => ({ index, rate }));
  return { width: stage.terrain.width, height: stage.terrain.height, heights: stage.terrain.heights,
    water: stage.initialWater, protected: flags, sources: facilities(stage.sources), intakes: facilities(stage.intakes), outlets: facilities(stage.outlets) };
}
export function loadStage(input: StageDefinition): StageDefinition {
  if (!input || !input.terrain || !input.goalDefinition) throw new Error('ステージ定義がありません');
  const name = (value: string, label: string) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}が不正です`); };
  name(input.id, 'ステージID'); name(input.title, 'タイトル'); name(input.description, '説明');
  integer(input.terrain.width, '幅', 4096); integer(input.terrain.height, '高さ', 4096);
  if (!input.terrain.width || !input.terrain.height) throw new Error('盤面サイズが不正です');
  const size = input.terrain.width * input.terrain.height;
  if (input.initialWater?.length !== size || input.terrain.heights?.length !== size) throw new Error('地形・初期水量の配列長が不正です');
  const ids = new Set<string>(), positions = new Set<number>();
  for (const items of [input.sources, input.intakes, input.outlets]) {
    if (!Array.isArray(items)) throw new Error('施設配列が不正です');
    for (const facility of items) {
      name(facility.id, '施設ID');
      if (ids.has(facility.id)) throw new Error('施設IDが重複しています');
      ids.add(facility.id); integer(facility.index, '施設セル', size - 1); positions.add(facility.index);
    }
  }
  if (!Array.isArray(input.protectedCells) || new Set(input.protectedCells).size !== input.protectedCells.length) throw new Error('保護セル配列が不正です');
  input.protectedCells.forEach(i => integer(i, '保護セル', size - 1));
  const validatedWorld = createWorld(stageWorld(input)); // Reuse existing numeric and overlapping-facility validation.
  integer(input.maxSimulationSteps, 'ステップ上限', MAX_STEPS);
  if (!input.maxSimulationSteps) throw new Error('ステップ上限は1以上が必要です');
  const supplyBudget = input.sources.reduce((sum, source) => sum + BigInt(source.rate), 0n) * BigInt(input.maxSimulationSteps);
  if (BigInt(validatedWorld.initialWater) + supplyBudget > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('指定ステップまでの供給量が安全な整数範囲を超えます');
  buildStroke([], input.terrain.width, input.terrain.height, {
    mode: input.strokeMode, maxLength: input.maxStrokeLength, radius: input.brushRadius, heightDelta: input.heightDelta,
  });
  if (!Array.isArray(input.towns) || !input.towns.length) throw new Error('町が必要です');
  const townIds = new Set<string>(), townCells = new Set<number>();
  for (const town of input.towns) {
    name(town.id, '町ID'); name(town.name, '町名'); integer(town.centerCell, '町の中心セル', size - 1);
    if (townIds.has(town.id) || townCells.has(town.centerCell)) throw new Error('町のID・中心セルが重複しています');
    if (positions.has(town.centerCell)) throw new Error('町の中心セルと施設セルは区別してください');
    townIds.add(town.id); townCells.add(town.centerCell);
    integer(town.floodThreshold, '危険水深', MAX_WATER);
    if (!town.floodThreshold) throw new Error('危険水深は1以上が必要です');
    if (town.linkedIntakeId !== undefined || town.requiredIntake !== undefined) {
      if (!input.intakes.some(i => i.id === town.linkedIntakeId)) throw new Error('町の取水参照が不正です');
      integer(town.requiredIntake!, '必要取水量', MAX_WATER);
      if (!town.requiredIntake) throw new Error('必要取水量は1以上が必要です');
    }
  }
  const goal = input.goalDefinition;
  if (!['WATER_DELIVERY', 'FLOOD_PREVENTION', 'COMBINED'].includes(goal.type)
    || !Array.isArray(goal.townIds) || !goal.townIds.length || new Set(goal.townIds).size !== goal.townIds.length
    || goal.townIds.some(id => !townIds.has(id))) throw new Error('目標の種類・町参照が不正です');
  const checkpoint = (value: number | undefined, label: string) => integer(value!, label, input.maxSimulationSteps);
  if (goal.deliveryDeadlineStep !== undefined) checkpoint(goal.deliveryDeadlineStep, '給水期限');
  if (goal.floodObservationEndStep !== undefined) checkpoint(goal.floodObservationEndStep, '浸水観測終了');
  if (goal.type !== 'FLOOD_PREVENTION') {
    checkpoint(goal.deliveryDeadlineStep, '給水期限');
    if (input.towns.some(t => goal.townIds.includes(t.id) && !t.linkedIntakeId)) throw new Error('給水目標には町の取水施設が必要です');
  }
  if (goal.type !== 'WATER_DELIVERY') checkpoint(goal.floodObservationEndStep, '浸水観測終了');
  // Snapshot using ordinary arrays so nested definitions can be frozen without sharing caller data.
  return freezeData({ ...input, terrain: { ...input.terrain, heights: Array.from(input.terrain.heights) },
    initialWater: Array.from(input.initialWater), protectedCells: [...input.protectedCells],
    sources: input.sources.map(e => ({ ...e })), intakes: input.intakes.map(e => ({ ...e })), outlets: input.outlets.map(e => ({ ...e })),
    towns: input.towns.map(t => ({ ...t })), goalDefinition: { ...goal, townIds: [...goal.townIds] } });
}
