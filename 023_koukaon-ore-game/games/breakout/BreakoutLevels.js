(function () {
  "use strict";

  const levels = [
    {
      id: 1, name: "オレ入門", columns: 7, itemChance: .14,
      layout: [
        "NNNNNNN",
        "NNNNNNN",
        "NNNNNNN",
        ".NNNNN.",
        "..NNN.."
      ]
    },
    {
      id: 2, name: "オレ加速", columns: 7, itemChance: .18,
      layout: [
        "HHNNNHH",
        "NHHNHHN",
        "NNHHHNN",
        "NNNNNNN",
        ".NNNNN."
      ]
    },
    {
      id: 3, name: "全部オレ祭り", columns: 7, itemChance: .25,
      layout: [
        "MHHNHHM",
        "HNNHNNH",
        "NMNNNMN",
        "NNHHHNN",
        "HNNNNNH",
        ".NNNNN."
      ]
    }
  ];

  const typeFor = symbol => symbol === "H" ? "hard" : symbol === "M" ? "metal" : "normal";

  function createBlocks(level, width, top = 108) {
    const gap = 5;
    const side = 12;
    const blockWidth = (width - side * 2 - gap * (level.columns - 1)) / level.columns;
    const blockHeight = 25;
    const blocks = [];
    level.layout.forEach((row, rowIndex) => {
      [...row].forEach((symbol, columnIndex) => {
        if (symbol === ".") return;
        const type = typeFor(symbol);
        blocks.push({
          id: `${level.id}-${rowIndex}-${columnIndex}`,
          row: rowIndex, column: columnIndex, type,
          x: side + columnIndex * (blockWidth + gap), y: top + rowIndex * (blockHeight + gap),
          w: blockWidth, h: blockHeight,
          hp: type === "hard" ? 2 : type === "metal" ? Infinity : 1,
          maxHp: type === "hard" ? 2 : type === "metal" ? Infinity : 1,
          active: true, hitFlash: 0
        });
      });
    });
    return blocks;
  }

  window.BREAKOUT_LEVELS = levels;
  window.BreakoutLevel = { createBlocks, typeFor };
})();
