/** A single UI-only deadline. It never repeats itself and owns no simulation callback. */
export class RafDisplayDeadline {
  #timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly invalidate: () => void) {}
  refresh(enabled: boolean): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    if (enabled) this.#timer = setTimeout(() => { this.#timer = null; this.invalidate(); }, 1100);
  }
}
