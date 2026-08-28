(function defineHistory(global) {
  "use strict";
  const P = global.PythagoraLab;

  class HistoryManager {
    constructor(limit = P.CONFIG.historyLimit) {
      this.limit = Math.max(20, limit);
      this.past = [];
      this.future = [];
    }

    reset() {
      this.past.length = 0;
      this.future.length = 0;
    }

    push(snapshot, currentSnapshot) {
      const encoded = JSON.stringify(snapshot || []);
      if (currentSnapshot && encoded === JSON.stringify(currentSnapshot)) return false;
      if (this.past[this.past.length - 1] === encoded) return false;
      this.past.push(encoded);
      if (this.past.length > this.limit) this.past.shift();
      this.future.length = 0;
      return true;
    }

    undo(currentSnapshot) {
      if (!this.past.length) return null;
      this.future.push(JSON.stringify(currentSnapshot || []));
      return JSON.parse(this.past.pop());
    }

    redo(currentSnapshot) {
      if (!this.future.length) return null;
      this.past.push(JSON.stringify(currentSnapshot || []));
      return JSON.parse(this.future.pop());
    }

    get canUndo() { return this.past.length > 0; }
    get canRedo() { return this.future.length > 0; }
  }

  P.HistoryManager = HistoryManager;
})(window);
