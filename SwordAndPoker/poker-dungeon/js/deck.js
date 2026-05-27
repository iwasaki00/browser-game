(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const SUITS = [
  { key: "spades", symbol: "♠", color: "black" },
  { key: "hearts", symbol: "♥", color: "red" },
  { key: "diamonds", symbol: "♦", color: "red" },
  { key: "clubs", symbol: "♣", color: "black" },
];

const RANKS = [
  { label: "A", value: 14, straightValue: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 11 },
  { label: "Q", value: 12 },
  { label: "K", value: 13 },
];

function createDeck(jokerCount = 0) {
  let id = 0;
  const deck = SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `card-${id++}`,
      suit: suit.key,
      suitSymbol: suit.symbol,
      color: suit.color,
      rank: rank.label,
      value: rank.value,
      straightValue: rank.straightValue ?? rank.value,
    })),
  );

  for (let jokerIndex = 0; jokerIndex < jokerCount; jokerIndex += 1) {
    deck.push({
      id: `card-${id++}`,
      suit: "joker",
      suitSymbol: "★",
      color: "gold",
      rank: "JKR",
      value: 0,
      isJoker: true,
    });
  }
  return deck;
}

function shuffleDeck(cards) {
  const deck = [...cards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function drawCards(deck, count) {
  const nextDeck = [...deck];
  const drawn = nextDeck.splice(0, count);
  return { drawn, nextDeck };
}

window.RuneGridDuel.deck = {
  createDeck,
  shuffleDeck,
  drawCards,
};
})();
