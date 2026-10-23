/** All persistent progress and LAB mutations share one origin-scoped Web Lock. */
export class SaveCoordinator {
  held = false;
  constructor(private locks?: Pick<LockManager, 'request'>, private memoryOnly = false) {}
  get available() { return this.memoryOnly || !!this.locks; }
  async run<T>(operation: () => T): Promise<T> {
    const execute = () => { this.held = true; try { return operation(); } finally { this.held = false; } };
    if (this.memoryOnly) return execute();
    if (!this.locks) return operation(); // Adapters deny persistence; play stays page-local.
    let entered = false;
    try { return await this.locks.request('sort-and-send.save', { mode: 'exclusive' }, () => { entered = true; return execute(); }); }
    catch (error) { if (entered) throw error; return operation(); }
  }
}
