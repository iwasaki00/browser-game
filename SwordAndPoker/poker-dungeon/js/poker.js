(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const HAND_RANKINGS = [
  { key: "high-card", name: "ハイカード", damage: 1 },
  { key: "one-pair", name: "ワンペア", damage: 2 },
  { key: "two-pair", name: "ツーペア", damage: 4 },
  { key: "three-kind", name: "スリーカード", damage: 6 },
  { key: "straight", name: "ストレート", damage: 8 },
  { key: "flush", name: "フラッシュ", damage: 10 },
  { key: "full-house", name: "フルハウス", damage: 14 },
  { key: "four-kind", name: "フォーカード", damage: 18 },
  { key: "straight-flush", name: "ストレートフラッシュ", damage: 25 },
  { key: "royal-straight-flush", name: "ロイヤルストレートフラッシュ", damage: 40 },
];

const DAMAGE_BY_KEY = Object.fromEntries(HAND_RANKINGS.map((ranking) => [ranking.key, ranking.damage]));
const NAME_BY_KEY = Object.fromEntries(HAND_RANKINGS.map((ranking) => [ranking.key, ranking.name]));
const ALL_RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function countBy(values) {
  return values.reduce((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map());
}

function isFlush(cards) {
  return new Set(cards.map((card) => card.suit)).size === 1;
}

function isStraight(cards) {
  const rawValues = cards.map((card) => card.value).sort((left, right) => left - right);
  const uniqueValues = [...new Set(rawValues)];
  if (uniqueValues.length !== 5) {
    return false;
  }

  const isNormalStraight = uniqueValues.every((value, index) => index === 0 || value - uniqueValues[index - 1] === 1);
  if (isNormalStraight) {
    return true;
  }

  const aceLowValues = cards
    .map((card) => (card.value === 14 ? 1 : card.value))
    .sort((left, right) => left - right);
  return aceLowValues.every((value, index) => index === 0 || value - aceLowValues[index - 1] === 1);
}

function isRoyal(cards) {
  const values = cards.map((card) => card.value).sort((left, right) => left - right);
  return values.join(",") === "10,11,12,13,14";
}

function evaluateWithoutJokers(cards) {
  const rankCounts = [...countBy(cards.map((card) => card.value)).values()].sort((left, right) => right - left);
  const flush = isFlush(cards);
  const straight = isStraight(cards);

  if (flush && straight && isRoyal(cards)) {
    return createHandResult("royal-straight-flush");
  }
  if (flush && straight) {
    return createHandResult("straight-flush");
  }
  if (rankCounts[0] === 4) {
    return createHandResult("four-kind");
  }
  if (rankCounts[0] === 3 && rankCounts[1] === 2) {
    return createHandResult("full-house");
  }
  if (flush) {
    return createHandResult("flush");
  }
  if (straight) {
    return createHandResult("straight");
  }
  if (rankCounts[0] === 3) {
    return createHandResult("three-kind");
  }
  if (rankCounts[0] === 2 && rankCounts[1] === 2) {
    return createHandResult("two-pair");
  }
  if (rankCounts[0] === 2) {
    return createHandResult("one-pair");
  }
  return createHandResult("high-card");
}

function countRanks(cards) {
  return countBy(cards.map((card) => card.value));
}

function canMakeStraight(values, jokers) {
  const uniqueValues = new Set(values);
  const sequences = [
    [14, 13, 12, 11, 10],
    [13, 12, 11, 10, 9],
    [12, 11, 10, 9, 8],
    [11, 10, 9, 8, 7],
    [10, 9, 8, 7, 6],
    [9, 8, 7, 6, 5],
    [8, 7, 6, 5, 4],
    [7, 6, 5, 4, 3],
    [6, 5, 4, 3, 2],
    [5, 4, 3, 2, 14],
  ];

  return sequences.some((sequence) => sequence.filter((value) => !uniqueValues.has(value)).length <= jokers);
}

function canMakeRoyalFlush(cards, jokers) {
  const suits = ["spades", "hearts", "diamonds", "clubs"];
  return suits.some((suit) => {
    const suitedValues = new Set(cards.filter((card) => card.suit === suit).map((card) => card.value));
    const needed = [10, 11, 12, 13, 14].filter((value) => !suitedValues.has(value)).length;
    return needed <= jokers;
  });
}

function canMakeStraightFlush(cards, jokers) {
  const suits = ["spades", "hearts", "diamonds", "clubs"];
  return suits.some((suit) => canMakeStraight(cards.filter((card) => card.suit === suit).map((card) => card.value), jokers));
}

function canMakeNOfAKind(rankCounts, jokers, size) {
  return ALL_RANKS.some((rank) => (rankCounts.get(rank) ?? 0) + jokers >= size);
}

function canMakeFullHouse(rankCounts, jokers) {
  for (const tripleRank of ALL_RANKS) {
    const tripleNeed = Math.max(0, 3 - (rankCounts.get(tripleRank) ?? 0));
    if (tripleNeed > jokers) {
      continue;
    }
    const remainingJokers = jokers - tripleNeed;
    for (const pairRank of ALL_RANKS) {
      if (pairRank === tripleRank) {
        continue;
      }
      const pairNeed = Math.max(0, 2 - (rankCounts.get(pairRank) ?? 0));
      if (pairNeed <= remainingJokers) {
        return true;
      }
    }
  }
  return false;
}

function canMakeFlush(cards, jokers) {
  const suitCounts = countBy(cards.map((card) => card.suit));
  return ["spades", "hearts", "diamonds", "clubs"].some((suit) => (suitCounts.get(suit) ?? 0) + jokers >= 5);
}

function canMakeTwoPair(rankCounts, jokers) {
  for (const firstRank of ALL_RANKS) {
    const firstNeed = Math.max(0, 2 - (rankCounts.get(firstRank) ?? 0));
    if (firstNeed > jokers) {
      continue;
    }
    const remainingJokers = jokers - firstNeed;
    for (const secondRank of ALL_RANKS) {
      if (secondRank === firstRank) {
        continue;
      }
      const secondNeed = Math.max(0, 2 - (rankCounts.get(secondRank) ?? 0));
      if (secondNeed <= remainingJokers) {
        return true;
      }
    }
  }
  return false;
}

function evaluatePokerHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    throw new Error("evaluatePokerHand requires exactly 5 cards.");
  }

  const jokers = cards.filter((card) => card.isJoker).length;
  const nonJokers = cards.filter((card) => !card.isJoker);
  if (jokers === 0) {
    return evaluateWithoutJokers(nonJokers);
  }
  const rankCounts = countRanks(nonJokers);
  const values = nonJokers.map((card) => card.value);

  if (canMakeRoyalFlush(nonJokers, jokers)) {
    return createHandResult("royal-straight-flush");
  }
  if (canMakeStraightFlush(nonJokers, jokers)) {
    return createHandResult("straight-flush");
  }
  if (canMakeNOfAKind(rankCounts, jokers, 4)) {
    return createHandResult("four-kind");
  }
  if (canMakeFullHouse(rankCounts, jokers)) {
    return createHandResult("full-house");
  }
  if (canMakeFlush(nonJokers, jokers)) {
    return createHandResult("flush");
  }
  if (canMakeStraight(values, jokers)) {
    return createHandResult("straight");
  }
  if (canMakeNOfAKind(rankCounts, jokers, 3)) {
    return createHandResult("three-kind");
  }
  if (canMakeTwoPair(rankCounts, jokers)) {
    return createHandResult("two-pair");
  }
  if (canMakeNOfAKind(rankCounts, jokers, 2)) {
    return createHandResult("one-pair");
  }
  return createHandResult("high-card");
}

function createHandResult(key) {
  return {
    key,
    name: NAME_BY_KEY[key],
    damage: DAMAGE_BY_KEY[key],
  };
}

window.RuneGridDuel.poker = {
  HAND_RANKINGS,
  evaluatePokerHand,
};
})();
