(function () {
  "use strict";

  class PuzzleBoard {
    constructor(cols = 8, rows = 8, typeCount = 6, random = Math.random) {
      this.cols = cols; this.rows = rows; this.typeCount = typeCount; this.random = random; this.cells = [];
    }

    randomPiece() { return { type: Math.floor(this.random() * this.typeCount), special: null }; }
    index(row, col) { return row * this.cols + col; }
    inBounds(row, col) { return row >= 0 && row < this.rows && col >= 0 && col < this.cols; }
    get(row, col) { return this.inBounds(row, col) ? this.cells[this.index(row, col)] : null; }
    set(row, col, value) { if (this.inBounds(row, col)) this.cells[this.index(row, col)] = value; }
    key(row, col) { return `${row},${col}`; }
    parseKey(key) { return key.split(",").map(Number); }

    generate() {
      for (let attempt = 0; attempt < 120; attempt++) {
        this.cells = Array(this.cols * this.rows).fill(null);
        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            let piece;
            do { piece = this.randomPiece(); }
            while ((col >= 2 && this.get(row, col - 1)?.type === piece.type && this.get(row, col - 2)?.type === piece.type) || (row >= 2 && this.get(row - 1, col)?.type === piece.type && this.get(row - 2, col)?.type === piece.type));
            this.set(row, col, piece);
          }
        }
        if (this.findValidMoves().length) return;
      }
      throw new Error("有効な初期盤面を生成できませんでした");
    }

    adjacent(a, b) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1; }
    swap(a, b) { const first = this.get(a.row, a.col); this.set(a.row, a.col, this.get(b.row, b.col)); this.set(b.row, b.col, first); }

    findMatches() {
      const groups = [];
      for (let row = 0; row < this.rows; row++) {
        let start = 0;
        for (let col = 1; col <= this.cols; col++) {
          if (col < this.cols && this.get(row, col)?.type === this.get(row, start)?.type) continue;
          if (col - start >= 3) groups.push({ orientation: "row", type: this.get(row, start).type, cells: Array.from({ length: col - start }, (_, i) => ({ row, col: start + i })) });
          start = col;
        }
      }
      for (let col = 0; col < this.cols; col++) {
        let start = 0;
        for (let row = 1; row <= this.rows; row++) {
          if (row < this.rows && this.get(row, col)?.type === this.get(start, col)?.type) continue;
          if (row - start >= 3) groups.push({ orientation: "col", type: this.get(start, col).type, cells: Array.from({ length: row - start }, (_, i) => ({ row: start + i, col })) });
          start = row;
        }
      }
      const positions = new Set(); groups.forEach((group) => group.cells.forEach((cell) => positions.add(this.key(cell.row, cell.col))));
      return { groups, positions };
    }

    hasMatch() { return this.findMatches().groups.length > 0; }

    findValidMoves(limit = Infinity) {
      const moves = [];
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          for (const [dr, dc] of [[0, 1], [1, 0]]) {
            const other = { row: row + dr, col: col + dc }; if (!this.inBounds(other.row, other.col)) continue;
            const first = { row, col }; this.swap(first, other); const valid = this.hasMatch(); this.swap(first, other);
            if (valid) { moves.push([first, other]); if (moves.length >= limit) return moves; }
          }
        }
      }
      return moves;
    }

    planSpecials(groups, preferred = []) {
      const plans = [];
      for (const group of groups) {
        if (group.cells.length < 4) continue;
        const chosen = preferred.find((cell) => group.cells.some((entry) => entry.row === cell.row && entry.col === cell.col)) || group.cells[Math.floor(group.cells.length / 2)];
        plans.push({ ...chosen, type: group.type, special: group.cells.length >= 5 ? "color" : group.orientation });
      }
      const unique = new Map(); plans.forEach((plan) => unique.set(this.key(plan.row, plan.col), plan)); return [...unique.values()];
    }

    expandSpecials(positions) {
      const expanded = new Set(positions); let activated = 0; let changed = true;
      while (changed) {
        changed = false;
        for (const key of [...expanded]) {
          const [row, col] = this.parseKey(key); const piece = this.get(row, col); if (!piece?.special || piece._activated) continue;
          piece._activated = true; activated += 1;
          if (piece.special === "row") for (let c = 0; c < this.cols; c++) { const k = this.key(row, c); if (!expanded.has(k)) { expanded.add(k); changed = true; } }
          if (piece.special === "col") for (let r = 0; r < this.rows; r++) { const k = this.key(r, col); if (!expanded.has(k)) { expanded.add(k); changed = true; } }
          if (piece.special === "color") for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.get(r, c)?.type === piece.type) { const k = this.key(r, c); if (!expanded.has(k)) { expanded.add(k); changed = true; } }
        }
      }
      this.cells.forEach((piece) => { if (piece) delete piece._activated; });
      return { positions: expanded, activated };
    }

    clear(positions, specialPlans = []) {
      const protectedKeys = new Set(specialPlans.map((plan) => this.key(plan.row, plan.col)));
      for (const key of positions) { if (protectedKeys.has(key)) continue; const [row, col] = this.parseKey(key); this.set(row, col, null); }
      specialPlans.forEach((plan) => this.set(plan.row, plan.col, { type: plan.type, special: plan.special }));
    }

    collapse() {
      for (let col = 0; col < this.cols; col++) {
        let write = this.rows - 1;
        for (let row = this.rows - 1; row >= 0; row--) { const piece = this.get(row, col); if (piece) { this.set(write, col, piece); if (write !== row) this.set(row, col, null); write--; } }
        while (write >= 0) { this.set(write, col, null); write--; }
      }
    }

    refill() { for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) if (!this.get(row, col)) this.set(row, col, this.randomPiece()); }

    shuffle() {
      for (let attempt = 0; attempt < 120; attempt++) {
        for (let i = this.cells.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.cells[i], this.cells[j]] = [this.cells[j], this.cells[i]]; }
        this.cells.forEach((piece) => { if (piece) piece.special = null; });
        if (!this.hasMatch() && this.findValidMoves(1).length) return true;
      }
      this.generate(); return true;
    }
  }

  window.PuzzleBoard = PuzzleBoard;
})();
