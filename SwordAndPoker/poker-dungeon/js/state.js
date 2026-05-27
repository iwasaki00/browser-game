(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const { canTakeTurn, shouldEndByBoard, evaluatePlacements } = window.RuneGridDuel.battle;
const { createBoard, getInitialPlacementIndices, placeCardsOnBoard } = window.RuneGridDuel.board;
const { createDeck, drawCards, shuffleDeck } = window.RuneGridDuel.deck;

const GAME_TITLE = "Rune Grid Duel";
const MAX_HAND_SIZE = 4;
const DEFAULT_SETTINGS = {
  playerOrder: "first",
  startHp: 24,
  jokerCount: 0,
  resolutionDelayMs: 2000,
};
const SETTINGS_STORAGE_KEY = "rune-grid-duel-settings";

function loadSettings() {
  try {
    const raw = window.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_error) {
    return { ...DEFAULT_SETTINGS };
  }
}

const state = {
  board: [],
  deck: [],
  playerHand: [],
  enemyHand: [],
  playerHp: DEFAULT_SETTINGS.playerHp,
  enemyHp: DEFAULT_SETTINGS.enemyHp,
  currentTurn: "player",
  selectedHandIds: [],
  selectedCells: [],
  pendingPlacements: [],
  logs: [],
  phase: "idle",
  winner: null,
  lastResolvedCells: [],
  draggingCardId: null,
  battleBanner: null,
  previewBanner: null,
  settings: loadSettings(),
  screen: "settings",
  settingsStatus: "",
};

function drawInitialHands(deck) {
  const playerDraw = drawCards(deck, MAX_HAND_SIZE);
  const enemyDraw = drawCards(playerDraw.nextDeck, MAX_HAND_SIZE);
  return {
    playerHand: playerDraw.drawn,
    enemyHand: enemyDraw.drawn,
    deck: enemyDraw.nextDeck,
  };
}

function initializeGameState() {
  const shuffledDeck = shuffleDeck(createDeck(state.settings.jokerCount));
  const emptyBoard = createBoard();
  const initialNine = drawCards(shuffledDeck, 9);

  const board = placeCardsOnBoard(
    emptyBoard,
    initialNine.drawn.map((card, index) => ({
      card,
      cellIndex: getInitialPlacementIndices()[index],
      owner: "neutral",
    })),
  );

  const hands = drawInitialHands(initialNine.nextDeck);

  state.board = board;
  state.deck = hands.deck;
  state.playerHand = hands.playerHand;
  state.enemyHand = hands.enemyHand;
  state.playerHp = state.settings.startHp;
  state.enemyHp = state.settings.startHp;
  state.currentTurn = state.settings.playerOrder === "first" ? "player" : "enemy";
  state.selectedHandIds = [];
  state.selectedCells = [];
  state.pendingPlacements = [];
  state.logs = ["ゲーム開始。中央3x3に9枚を配置しました。"];
  state.phase = "player-select";
  state.winner = null;
  state.lastResolvedCells = [];
  state.draggingCardId = null;
  state.battleBanner = null;
  state.previewBanner = null;
  state.screen = "game";
}

function addLog(message) {
  state.logs = [message, ...state.logs].slice(0, 16);
}

function clearSelections() {
  state.selectedHandIds = [];
  state.selectedCells = [];
  state.pendingPlacements = [];
  state.draggingCardId = null;
  state.previewBanner = null;
}

function syncSelectionsFromPending() {
  state.selectedCells = state.pendingPlacements.map((placement) => placement.cellIndex);
}

function assignCardToCell(cardId, cellIndex) {
  if (state.currentTurn !== "player" || state.winner || state.phase === "resolving") {
    return false;
  }

  if (state.board[cellIndex].card) {
    return false;
  }

  const cardExists = state.playerHand.some((card) => card.id === cardId);
  if (!cardExists) {
    return false;
  }

  state.pendingPlacements = state.pendingPlacements.filter((placement) => placement.cardId !== cardId && placement.cellIndex !== cellIndex);

  if (state.pendingPlacements.length >= 2) {
    state.pendingPlacements.shift();
  }

  state.pendingPlacements.push({ cardId, cellIndex });
  state.selectedHandIds = state.selectedHandIds.filter((id) => id !== cardId);
  syncSelectionsFromPending();
  return true;
}

function removePendingByCardId(cardId) {
  state.pendingPlacements = state.pendingPlacements.filter((placement) => placement.cardId !== cardId);
  syncSelectionsFromPending();
}

function removePendingByCellIndex(cellIndex) {
  state.pendingPlacements = state.pendingPlacements.filter((placement) => placement.cellIndex !== cellIndex);
  syncSelectionsFromPending();
}

function setDraggingCardId(cardId) {
  state.draggingCardId = cardId;
}

function setBattleBanner(banner) {
  state.battleBanner = banner;
}

function setPreviewBanner(banner) {
  state.previewBanner = banner;
}

function setScreen(screen) {
  state.screen = screen;
}

function setSettingsStatus(message) {
  state.settingsStatus = message;
}

function updateSettings(nextSettings) {
  state.settings = {
    ...state.settings,
    ...nextSettings,
  };
}

function saveSettings() {
  try {
    window.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
    return true;
  } catch (_error) {
    return false;
  }
}

function toggleSelectedHand(cardId) {
  if (state.currentTurn !== "player" || state.winner || state.phase === "resolving") {
    return;
  }

  if (state.pendingPlacements.some((placement) => placement.cardId === cardId)) {
    removePendingByCardId(cardId);
    return;
  }

  if (state.selectedHandIds.includes(cardId)) {
    state.selectedHandIds = [];
  } else {
    state.selectedHandIds = [cardId];
  }
}

function toggleSelectedCell(cellIndex) {
  if (state.currentTurn !== "player" || state.winner || state.phase === "resolving") {
    return;
  }

  if (state.pendingPlacements.some((placement) => placement.cellIndex === cellIndex)) {
    removePendingByCellIndex(cellIndex);
    return;
  }

  if (state.board[cellIndex].card) {
    return;
  }

  if (state.selectedHandIds.length > 0) {
    const cardId = state.selectedHandIds[state.selectedHandIds.length - 1];
    state.selectedHandIds = [];
    assignCardToCell(cardId, cellIndex);
    return;
  }

  if (state.selectedCells.includes(cellIndex)) {
    state.selectedCells = state.selectedCells.filter((index) => index !== cellIndex);
  } else if (state.selectedCells.length < 2) {
    state.selectedCells = [...state.selectedCells, cellIndex];
  }
}

function getSelectedPlayerCards() {
  return state.playerHand.filter((card) => state.selectedHandIds.includes(card.id));
}

function getPlayerPlacements() {
  if (state.pendingPlacements.length === 2) {
    return state.pendingPlacements
      .map((placement) => {
        const card = state.playerHand.find((handCard) => handCard.id === placement.cardId);
        if (!card) {
          return null;
        }
        return {
          card,
          cellIndex: placement.cellIndex,
          owner: "player",
        };
      })
      .filter(Boolean);
  }

  const cards = getSelectedPlayerCards();
  if (cards.length !== 2 || state.selectedCells.length !== 2) {
    return [];
  }

  return cards.map((card, index) => ({
    card,
    cellIndex: state.selectedCells[index],
    owner: "player",
  }));
}

function isConfirmReady() {
  if (state.currentTurn !== "player" || state.winner || state.phase === "resolving") {
    return false;
  }
  const placements = getPlayerPlacements();
  if (placements.length !== 2) {
    return false;
  }
  return evaluatePlacements(state.board, placements).totalDamage > 0;
}

function canPlayerPass() {
  return !state.winner && state.currentTurn === "player" && canTakeTurn(state.board, state.playerHand);
}

function evaluateEndState() {
  if (state.playerHp <= 0 && state.enemyHp <= 0) {
    state.winner = "draw";
  } else if (state.enemyHp <= 0) {
    state.winner = "player";
  } else if (state.playerHp <= 0) {
    state.winner = "enemy";
  } else if (shouldEndByBoard(state.board)) {
    if (state.playerHp > state.enemyHp) {
      state.winner = "player";
    } else if (state.enemyHp > state.playerHp) {
      state.winner = "enemy";
    } else {
      state.winner = "draw";
    }
  }

  if (state.winner) {
    state.phase = "finished";
  }
}

window.RuneGridDuel.stateModule = {
  GAME_TITLE,
  MAX_HAND_SIZE,
  state,
  initializeGameState,
  addLog,
  clearSelections,
  toggleSelectedHand,
  toggleSelectedCell,
  assignCardToCell,
  removePendingByCardId,
  removePendingByCellIndex,
  setDraggingCardId,
  setBattleBanner,
  setPreviewBanner,
  setScreen,
  setSettingsStatus,
  updateSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  getSelectedPlayerCards,
  getPlayerPlacements,
  isConfirmReady,
  canPlayerPass,
  evaluateEndState,
};
})();
