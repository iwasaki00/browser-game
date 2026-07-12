(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const { countOccupiedCells, getCardsForLine, getEmptyCellIndices, getLinesForPositions, isLineComplete, placeCardsOnBoard, TOTAL_CELLS } =
  window.RuneGridDuel.board;
const { drawCards } = window.RuneGridDuel.deck;
const { evaluatePokerHand } = window.RuneGridDuel.poker;

function evaluatePlacements(board, placements) {
  const nextBoard = placeCardsOnBoard(board, placements);
  const linesToCheck = getLinesForPositions(placements.map((placement) => placement.cellIndex));
  const scoredLines = [];
  let totalDamage = 0;

  linesToCheck.forEach((line) => {
    if (!isLineComplete(nextBoard, line)) {
      return;
    }
    const cards = getCardsForLine(nextBoard, line);
    const handResult = evaluatePokerHand(cards);
    totalDamage += handResult.damage;
    scoredLines.push({
      line,
      handResult,
      cards,
    });
  });

  return {
    nextBoard,
    scoredLines,
    totalDamage,
  };
}

function applyPlacementsAndScore({ board, placements, attacker, defender, deck, hand }) {
  const { nextBoard, scoredLines, totalDamage } = evaluatePlacements(board, placements);

  const remainingHand = hand.filter((card) => !placements.some((placement) => placement.card.id === card.id));
  const refillCount = Math.min(4 - remainingHand.length, deck.length);
  const { drawn, nextDeck } = drawCards(deck, refillCount);

  return {
    board: nextBoard,
    attacker,
    defenderHp: Math.max(0, defender.hp - totalDamage),
    hand: [...remainingHand, ...drawn],
    deck: nextDeck,
    scoredLines,
    totalDamage,
    occupiedCount: countOccupiedCells(nextBoard),
  };
}

function canTakeTurn(board, hand) {
  return getEmptyCellIndices(board).length >= 2 && hand.length >= 2;
}

function shouldEndByBoard(board) {
  return countOccupiedCells(board) >= TOTAL_CELLS || getEmptyCellIndices(board).length < 2;
}

window.RuneGridDuel.battle = {
  evaluatePlacements,
  applyPlacementsAndScore,
  canTakeTurn,
  shouldEndByBoard,
};
})();
