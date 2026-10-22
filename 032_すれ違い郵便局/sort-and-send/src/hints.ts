import data from './hints-data.json';
import { stageFingerprint } from './fingerprint';
import type { Direction, Stage } from './stage';

export type HintLevel = 1 | 2 | 3;
export type HintMode = 'DESIGN' | 'RUN' | 'PAUSED' | 'RESULT';
export interface StageHints {
  stageId: string;
  stageFingerprint: string;
  hint1: string;
  hint2: string;
  hint3: string;
  focusSwitchIds: string[];
  checks: {
    parcelNumbers: number[];
    routes: { from: string; direction: Direction; to: string }[];
    slots: { switchId: string; slot: number; direction: Direction }[];
    requiredVisits: { parcelNumber: number; switchId: string }[];
  };
}
// The fingerprint is stored in this static file, never regenerated from the live stage on load.
export const stageHints = data as StageHints[];
export const hintTitles = ['発想', '注目点', '手掛かり'] as const;
export function hintForStage(stage: Stage): StageHints | undefined {
  const entries = stageHints.filter(h => h.stageId === stage.id);
  return entries.length === 1 && entries[0].stageFingerprint === stageFingerprint(stage) ? entries[0] : undefined;
}
export function hintText(hints: StageHints, level: HintLevel): string {
  return hints[`hint${level}`];
}

/** Page-only disclosure state. No references to delivery, RESCUE, scoring or storage. */
export class HintSession {
  private opened = false;
  private unlocked = 0;
  private selected: HintLevel = 1;
  constructor(readonly hints: StageHints | undefined) {}
  get snapshot() { return { opened: this.opened, unlocked: this.unlocked, selected: this.selected }; }
  open(mode: HintMode): boolean {
    if (mode !== 'DESIGN' || !this.hints) return false;
    this.opened = true;
    if (!this.unlocked) this.unlocked = 1;
    return true;
  }
  view(level: HintLevel, mode: HintMode): boolean {
    if (mode !== 'DESIGN' || !this.opened || ![1, 2, 3].includes(level) || level > this.unlocked) return false;
    this.selected = level; return true;
  }
  revealNext(mode: HintMode): boolean {
    if (mode !== 'DESIGN' || !this.opened || this.unlocked >= 3) return false;
    this.selected = ++this.unlocked as HintLevel; return true;
  }
  close() { this.opened = false; }
}
