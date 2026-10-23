import { DEFAULT_PHYSICS, createSimulation, stepSimulation } from './physics.js';

export const PREVIEW_KEY = 'orbit-maker.preview';
export function loadPreviewEnabled(storage) {
  try { return storage?.getItem(PREVIEW_KEY) !== 'off'; } catch { return true; }
}
export function savePreviewEnabled(storage, enabled) {
  try { storage?.setItem(PREVIEW_KEY, enabled ? 'on' : 'off'); } catch { /* Optional storage. */ }
}

// Each job owns a snapshot; stepping it never mutates the editor or flight.
export function createPreview(stage, velocity, maxSteps = 1441) {
  return {
    state: createSimulation(stage, { velocity }),
    points: [{ ...stage.launch.position, time: 0 }],
    steps: 0, maxSteps: Math.max(1, Math.min(1441, Math.floor(maxSteps))), done: false,
  };
}
export function advancePreview(job, budget = 120, deadline = Infinity) {
  let count = 0;
  while (!job.done && count < budget && performance.now() < deadline) {
    job.state = stepSimulation(job.state, DEFAULT_PHYSICS.fixedTimeStep);
    job.steps++; count++;
    job.points.push({ ...job.state.rocket.position, time: job.state.elapsed });
    job.done = job.state.status !== 'flying' || job.steps >= job.maxSteps;
  }
  return job;
}

export class PreviewController {
  constructor(enabled = true) { this.enabled = enabled; this.key = null; this.job = null; }
  clear() { this.key = null; this.job = null; }
  update(stage, velocity, active = true) {
    if (!this.enabled || !active) { this.clear(); return null; }
    const key = JSON.stringify([stage, velocity]);
    if (key !== this.key) { this.key = key; this.job = createPreview(stage, velocity); }
    advancePreview(this.job, 160, performance.now() + 2);
    return this.job;
  }
}
