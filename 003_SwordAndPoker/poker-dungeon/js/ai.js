(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const { getEmptyCellIndices } = window.RuneGridDuel.board;
const { applyPlacementsAndScore } = window.RuneGridDuel.battle;

function createPairs(items) {
  const pairs = [];
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      pairs.push([items[first], items[second]]);
    }
  }
  return pairs;
}

function chooseEnemyMove(state) {
  const handPairs = createPairs(state.enemyHand);
  const emptyCellPairs = createPairs(getEmptyCellIndices(state.board));

  let bestMove = null;
  let bestDamage = -1;

  handPairs.forEach((handPair) => {
    emptyCellPairs.forEach((cellPair) => {
      const placements = [
        { card: handPair[0], cellIndex: cellPair[0], owner: "enemy" },
        { card: handPair[1], cellIndex: cellPair[1], owner: "enemy" },
      ];
      const result = applyPlacementsAndScore({
        board: state.board,
        placements,
        attacker: "enemy",
        defender: { hp: state.playerHp },
        deck: state.deck,
        hand: state.enemyHand,
      });

      if (result.totalDamage > bestDamage) {
        bestDamage = result.totalDamage;
        bestMove = placements;
      } else if (result.totalDamage === bestDamage && Math.random() < 0.5) {
        bestMove = placements;
      }
    });
  });

  if (bestMove) {
    return bestMove;
  }

  const fallbackHand = state.enemyHand.slice(0, 2);
  const fallbackCells = getEmptyCellIndices(state.board).slice(0, 2);
  return fallbackHand.map((card, index) => ({
    card,
    cellIndex: fallbackCells[index],
    owner: "enemy",
  }));
}

window.RuneGridDuel.ai = {
  chooseEnemyMove,
};
})();
