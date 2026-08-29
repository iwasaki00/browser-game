(function () {
  "use strict";

  class PuzzleRenderer {
    constructor(canvas, board) { this.canvas = canvas; this.ctx = canvas.getContext("2d"); this.board = board; this.width = 0; this.height = 0; this.boardSize = 0; this.cellSize = 0; this.offsetX = 0; this.offsetY = 0; }

    resize() {
      const rect = this.canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(rect.width * ratio); this.canvas.height = Math.round(rect.height * ratio); this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.width = rect.width; this.height = rect.height; this.boardSize = Math.min(this.width - 20, this.height - 118); this.cellSize = this.boardSize / this.board.cols; this.offsetX = (this.width - this.boardSize) / 2; this.offsetY = Math.max(72, (this.height - this.boardSize) / 2 + 15);
    }

    cellAt(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect(); const x = clientX - rect.left - this.offsetX; const y = clientY - rect.top - this.offsetY;
      const col = Math.floor(x / this.cellSize), row = Math.floor(y / this.cellSize); return this.board.inBounds(row, col) ? { row, col } : null;
    }

    draw(game) {
      const ctx = this.ctx; ctx.clearRect(0, 0, this.width, this.height);
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height); gradient.addColorStop(0, "#0d1536"); gradient.addColorStop(1, "#251738"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = "rgba(255,255,255,.035)"; ctx.fillRect(this.offsetX - 5, this.offsetY - 5, this.boardSize + 10, this.boardSize + 10);
      for (let row = 0; row < this.board.rows; row++) for (let col = 0; col < this.board.cols; col++) this.drawPiece(ctx, this.board.get(row, col), row, col, game);
      if (game.selected) { ctx.strokeStyle = "#ffe45d"; ctx.lineWidth = 4; ctx.strokeRect(this.offsetX + game.selected.col * this.cellSize + 3, this.offsetY + game.selected.row * this.cellSize + 3, this.cellSize - 6, this.cellSize - 6); }
      if (game.hint?.length) { const pulse = .55 + Math.sin(game.elapsed * 7) * .3; ctx.strokeStyle = `rgba(72,233,225,${pulse})`; ctx.lineWidth = 4; for (const cell of game.hint) ctx.strokeRect(this.offsetX + cell.col * this.cellSize + 5, this.offsetY + cell.row * this.cellSize + 5, this.cellSize - 10, this.cellSize - 10); }
      if (game.chainDisplay > 0) this.drawChain(ctx, game.chainDisplay);
      if (game.banner) { ctx.fillStyle = "rgba(8,11,20,.76)"; ctx.fillRect(0, this.height * .42, this.width, 72); ctx.fillStyle = "#ffe45d"; ctx.textAlign = "center"; ctx.font = "900 30px sans-serif"; ctx.fillText(game.banner, this.width / 2, this.height * .42 + 45); }
      game.popups.forEach((popup) => { ctx.globalAlpha = Math.max(0, popup.life); ctx.fillStyle = "#ffe45d"; ctx.textAlign = "center"; ctx.font = "900 18px sans-serif"; ctx.fillText(`+${popup.score}`, popup.x, popup.y - (1 - popup.life) * 30); ctx.globalAlpha = 1; });
    }

    drawPiece(ctx, piece, row, col, game) {
      if (!piece) return; const size = this.cellSize; const x = this.offsetX + col * size + size / 2; const y = this.offsetY + row * size + size / 2;
      const colors = ["#ff4d73", "#48e9e1", "#ffe45d", "#bd66ff", "#ff914d", "#73a7ff"]; const symbols = ["●", "▲", "■", "★", "◆", "♥"];
      const clearing = game.clearing?.has(`${row},${col}`); ctx.save(); ctx.translate(x, y); if (clearing) { const scale = .45 + Math.abs(Math.sin(game.elapsed * 25)) * .4; ctx.scale(scale, scale); ctx.globalAlpha = .72; }
      ctx.fillStyle = "rgba(5,8,18,.58)"; ctx.beginPath(); ctx.roundRect(-size * .41, -size * .41, size * .82, size * .82, size * .18); ctx.fill();
      ctx.fillStyle = colors[piece.type]; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `900 ${size * .5}px sans-serif`; ctx.fillText(symbols[piece.type], 0, 1);
      if (piece.special) { ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.setLineDash(piece.special === "color" ? [3, 3] : []); ctx.beginPath(); ctx.arc(0, 0, size * .34, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "white"; ctx.font = `900 ${size * .18}px sans-serif`; ctx.fillText(piece.special === "row" ? "↔" : piece.special === "col" ? "↕" : "ALL", 0, size * .29); }
      ctx.restore();
    }

    drawChain(ctx, chain) { ctx.textAlign = "center"; ctx.fillStyle = chain >= 5 ? "#ff3b68" : "#ffe45d"; ctx.font = `900 ${chain >= 5 ? 48 : 38}px sans-serif`; ctx.fillText(`${chain} CHAIN${chain >= 5 ? "!!" : "!"}`, this.width / 2, 54); ctx.fillStyle = "white"; ctx.font = "900 13px sans-serif"; ctx.fillText(chain >= 5 ? "全部オレ！！" : "オレ連鎖！", this.width / 2, 73); }
  }

  window.PuzzleRenderer = PuzzleRenderer;
})();
