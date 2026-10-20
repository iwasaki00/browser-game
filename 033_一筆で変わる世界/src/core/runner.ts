import { stepWorld } from './simulation';
import { createWorld, MAX_STEPS, type WorldDefinition, type WorldState } from './world';

export const SPEEDS = [5, 20, 60] as const;
export class SimulationRunner {
  world: WorldState;
  playing = false;
  speed: number = 20;
  private elapsed = 0;
  private readonly initial: WorldDefinition;
  constructor(definition: WorldDefinition) {
    const world = createWorld(definition);
    this.initial = { ...definition, heights: world.heights.slice(), water: world.water.slice(),
      protected: world.protected.slice(), sources: world.sources.map(e => ({ ...e })),
      intakes: world.intakes.map(e => ({ ...e })), outlets: world.outlets.map(e => ({ ...e })) };
    this.world = world;
  }
  play(): void { if (this.world.step < MAX_STEPS) this.playing = true; }
  pause(): void { this.playing = false; this.elapsed = 0; }
  step(): boolean {
    const advanced = stepWorld(this.world);
    if (this.world.step === MAX_STEPS) this.pause();
    return advanced;
  }
  reset(): void { this.pause(); this.world = createWorld(this.initial); }
  setSpeed(speed: number): void {
    if (!SPEEDS.some(value => value === speed)) throw new Error('未対応の実行速度です');
    this.speed = speed; this.elapsed = 0;
  }
  advance(milliseconds: number): number {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('不正な経過時間です');
    if (!this.playing) return 0;
    this.elapsed += Math.min(milliseconds, 250);
    let count = 0;
    while (this.playing && this.elapsed >= 1000 / this.speed && count < 8) {
      this.elapsed -= 1000 / this.speed; this.step(); count++;
    }
    if (count === 8) this.elapsed = 0;
    return count;
  }
}
