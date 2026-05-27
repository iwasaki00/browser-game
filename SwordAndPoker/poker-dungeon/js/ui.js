(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const { countOccupiedCells, getEmptyCellIndices } = window.RuneGridDuel.board;
const { GAME_TITLE, canPlayerPass, isConfirmReady, state } = window.RuneGridDuel.stateModule;
const { evaluatePlacements } = window.RuneGridDuel.battle;

const boardElement = document.querySelector("#board");
const enemyHpElement = document.querySelector("#enemy-hp");
const playerHpElement = document.querySelector("#player-hp");
const mobilePlayerHpElement = document.querySelector("#mobile-player-hp");
const enemyHandElement = document.querySelector("#enemy-hand");
const playerHandElement = document.querySelector("#player-hand");
const mobilePlayerHandElement = document.querySelector("#mobile-player-hand");
const mobilePrimaryActionsElement = document.querySelector("#mobile-primary-actions");
const logListElement = document.querySelector("#log-list");
const mobileLogListElement = document.querySelector("#mobile-log-list");
const deckCountElement = document.querySelector("#deck-count");
const boardCountElement = document.querySelector("#board-count");
const turnOwnerElement = document.querySelector("#turn-owner");
const confirmButton = document.querySelector("#confirm-button");
const clearButton = document.querySelector("#clear-button");
const passButton = document.querySelector("#pass-button");
const newGameButton = document.querySelector("#new-game-button");
const openSettingsButton = document.querySelector("#open-settings-button");
const selectionSummaryElement = document.querySelector("#selection-summary");
const enemyNameElement = document.querySelector("#enemy-name");
const enemyBattleBannerElement = document.querySelector("#enemy-battle-banner");
const playerBattleBannerElement = document.querySelector("#player-battle-banner");
const settingsScreenElement = document.querySelector("#settings-screen");
const gameScreenElement = document.querySelector("#game-screen");
const settingPlayerOrderElement = document.querySelector("#setting-player-order");
const settingStartHpElement = document.querySelector("#setting-start-hp");
const settingJokerCountElement = document.querySelector("#setting-joker-count");
const startGameButton = document.querySelector("#start-game-button");
const closeSettingsButton = document.querySelector("#close-settings-button");
const saveSettingsButton = document.querySelector("#save-settings-button");
const settingsStatusElement = document.querySelector("#settings-status");
const mobileLayoutMediaQuery = window.matchMedia("(max-width: 640px)");

function syncMobilePrimaryActions() {
  if (!mobilePrimaryActionsElement) {
    return;
  }

  if (mobileLayoutMediaQuery.matches) {
    mobilePrimaryActionsElement.append(confirmButton, passButton);
    return;
  }

  const controlsElement = document.querySelector(".controls");
  if (controlsElement) {
    controlsElement.prepend(passButton);
    controlsElement.prepend(confirmButton);
  }
}

function bindUiEvents(handlers) {
  confirmButton.addEventListener("click", handlers.onConfirm);
  clearButton.addEventListener("click", handlers.onClear);
  passButton.addEventListener("click", handlers.onPass);
  newGameButton.addEventListener("click", handlers.onNewGame);
  openSettingsButton.addEventListener("click", handlers.onOpenSettings);
  saveSettingsButton.addEventListener("click", handlers.onSaveSettings);
  startGameButton.addEventListener("click", handlers.onStartGame);
  closeSettingsButton.addEventListener("click", handlers.onCloseSettings);
  syncMobilePrimaryActions();
  mobileLayoutMediaQuery.addEventListener("change", syncMobilePrimaryActions);
}

function createCardElement(card, options = {}) {
  const { small = false, hidden = false, selected = false, pending = false } = options;
  const element = document.createElement("div");
  element.className = `card ${small ? "small" : ""} ${hidden ? "card-back" : ""} ${card?.color === "red" ? "red" : ""} ${card?.isJoker ? "joker" : ""}`;

  if (selected) {
    element.classList.add("selected");
  }
  if (pending) {
    element.classList.add("pending-placement");
  }

  if (hidden) {
    element.innerHTML = `<span class="card-center">✦</span>`;
    return element;
  }

  if (card.isJoker) {
    element.innerHTML = `
      <span class="card-joker-mark">★</span>
      <span class="card-joker-text">JOKER</span>
    `;
    return element;
  }

  element.innerHTML = `
    <span class="card-rank">${card.rank}</span>
    <span class="card-suit">${card.suitSymbol}</span>
  `;
  return element;
}

function renderBoard(handlers) {
  boardElement.innerHTML = "";
  state.board.forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `board-cell ${cell.card ? "" : "empty"} ${!cell.card ? "selectable" : ""}`;

    if (state.selectedCells.includes(cell.index)) {
      button.classList.add("pending");
    }
    if (state.lastResolvedCells.includes(cell.index)) {
      button.classList.add("resolved");
    }
    if (!cell.card && state.currentTurn === "player" && !state.winner) {
      button.addEventListener("dragover", (event) => {
        event.preventDefault();
        button.classList.add("drop-target");
      });
      button.addEventListener("dragleave", () => {
        button.classList.remove("drop-target");
      });
      button.addEventListener("drop", (event) => {
        event.preventDefault();
        button.classList.remove("drop-target");
        const cardId = event.dataTransfer?.getData("text/plain") || state.draggingCardId;
        if (cardId) {
          handlers.onCardDrop(cardId, cell.index);
        }
      });
    }

    const pendingPlacement = state.pendingPlacements.find((placement) => placement.cellIndex === cell.index);

    if (cell.card) {
      button.appendChild(createCardElement(cell.card, { small: true }));
    } else if (pendingPlacement) {
      const pendingCard = state.playerHand.find((card) => card.id === pendingPlacement.cardId);
      if (pendingCard) {
        button.classList.add("preview");
        button.appendChild(createCardElement(pendingCard, { small: true, pending: true }));
      } else {
        button.innerHTML = `<span class="muted">${cell.index + 1}</span>`;
      }
    } else {
      button.innerHTML = `<span class="muted">${cell.index + 1}</span>`;
    }

    button.addEventListener("click", () => handlers.onCellClick(cell.index));
    boardElement.appendChild(button);
  });
}

function renderHands(handlers) {
  enemyHandElement.innerHTML = "";
  playerHandElement.innerHTML = "";
  if (mobilePlayerHandElement) {
    mobilePlayerHandElement.innerHTML = "";
  }

  state.enemyHand.forEach((card) => {
    const cardElement = createCardElement(card, { hidden: false });
    enemyHandElement.appendChild(cardElement);
  });

  function appendPlayerCard(container, card) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hand-card-button";
    button.draggable = state.currentTurn === "player" && !state.winner;
    const cardElement = createCardElement(card, {
      selected:
        state.selectedHandIds.includes(card.id) ||
        state.pendingPlacements.some((placement) => placement.cardId === card.id) ||
        state.draggingCardId === card.id,
    });
    button.appendChild(cardElement);
    button.addEventListener("click", () => handlers.onPlayerCardClick(card.id));
    button.addEventListener("dragstart", (event) => {
      handlers.onDragStart(card.id);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
      }
    });
    button.addEventListener("dragend", () => handlers.onDragEnd());
    container.appendChild(button);
  }

  state.playerHand.forEach((card) => {
    appendPlayerCard(playerHandElement, card);
    if (mobilePlayerHandElement) {
      appendPlayerCard(mobilePlayerHandElement, card);
    }
  });
}

function renderStatus() {
  document.title = GAME_TITLE;
  enemyNameElement.textContent = "Obsidian Warden";
  enemyHpElement.textContent = String(state.enemyHp);
  playerHpElement.textContent = String(state.playerHp);
  if (mobilePlayerHpElement) {
    mobilePlayerHpElement.textContent = String(state.playerHp);
  }
  deckCountElement.textContent = String(state.deck.length);
  boardCountElement.textContent = `${countOccupiedCells(state.board)} / 25`;
  turnOwnerElement.textContent =
    state.winner === "draw"
      ? "Draw"
      : state.winner
        ? state.winner === "player"
          ? "Player Victory"
          : "Enemy Victory"
        : state.currentTurn === "player"
          ? "Player"
          : "Enemy";
  confirmButton.disabled = !isConfirmReady();
  clearButton.disabled = state.selectedHandIds.length === 0 && state.selectedCells.length === 0 && state.pendingPlacements.length === 0;
  passButton.disabled = !canPlayerPass() || state.phase === "resolving";
  newGameButton.disabled = state.phase === "resolving";
  openSettingsButton.disabled = state.phase === "resolving";

  if (state.winner) {
    selectionSummaryElement.textContent =
      state.winner === "draw" ? "引き分けです" : `${state.winner === "player" ? "プレイヤー" : "敵"}の勝利`;
  } else if (state.currentTurn !== "player") {
    selectionSummaryElement.textContent = state.phase === "resolving" ? "役を解決中です" : "敵が行動中です";
  } else {
    const emptyCells = getEmptyCellIndices(state.board).length;
    selectionSummaryElement.textContent = `仮置き ${state.pendingPlacements.length}/2, 空き ${emptyCells}。役が出ない手は決定できません。`;
  }
}

function renderLogs() {
  logListElement.innerHTML = "";
  if (mobileLogListElement) {
    mobileLogListElement.innerHTML = "";
  }

  state.logs.forEach((message, index) => {
    const item = document.createElement("li");
    item.textContent = message;
    if (index === 0 && state.winner === "player") {
      item.classList.add("winner");
    }
    if (index === 0 && state.winner === "enemy") {
      item.classList.add("loser");
    }
    logListElement.appendChild(item);

    if (mobileLogListElement && index < 2) {
      mobileLogListElement.appendChild(item.cloneNode(true));
    }
  });
}

function renderBattleBanner() {
  enemyBattleBannerElement.innerHTML = "";
  playerBattleBannerElement.innerHTML = "";
  enemyBattleBannerElement.className = "combat-result";
  playerBattleBannerElement.className = "combat-result";

  const banner = state.battleBanner ?? state.previewBanner;
  if (!banner) {
    return;
  }

  const targetElement = banner.actor === "player" ? playerBattleBannerElement : enemyBattleBannerElement;
  const modeClass = banner.mode === "preview" ? "preview-mode" : banner.actor === "player" ? "player-hit" : "enemy-hit";
  targetElement.classList.add("visible", modeClass);
  const details =
    banner.lines.length > 0
      ? banner.lines.map((line) => `<li>${line.handResult.name} ${line.handResult.damage}</li>`).join("")
      : "<li>役なし 0</li>";

  targetElement.innerHTML = `
    <p class="combat-result-label">${banner.mode === "preview" ? "Preview" : banner.actor === "player" ? "Player Attack" : "Enemy Attack"}</p>
    <p class="combat-result-damage">${banner.mode === "preview" ? banner.totalDamage : `-${banner.totalDamage}`}</p>
    <ul class="combat-result-lines">${details}</ul>
  `;
}

function renderSettingsScreen() {
  settingsScreenElement.classList.toggle("hidden", state.screen !== "settings");
  gameScreenElement.classList.toggle("hidden", state.screen !== "game");

  settingPlayerOrderElement.value = state.settings.playerOrder;
  settingStartHpElement.value = String(state.settings.startHp);
  settingJokerCountElement.value = String(state.settings.jokerCount);
  settingsStatusElement.textContent = state.settingsStatus;
  closeSettingsButton.disabled = state.logs.length === 0;
}

function renderPreviewBanner(placements) {
  if (state.phase === "resolving" || state.currentTurn !== "player" || placements.length !== 2) {
    state.previewBanner = null;
    return;
  }

  const result = evaluatePlacements(state.board, placements);
  state.previewBanner = {
    actor: "player",
    mode: "preview",
    totalDamage: result.totalDamage,
    lines: result.scoredLines,
  };
}

function renderAll(handlers) {
  syncMobilePrimaryActions();
  renderPreviewBanner(handlers.getPreviewPlacements());
  renderSettingsScreen();
  renderStatus();
  renderBoard(handlers);
  renderHands(handlers);
  renderLogs();
  renderBattleBanner();
}

window.RuneGridDuel.ui = {
  bindUiEvents,
  renderBoard,
  renderHands,
  renderStatus,
  renderLogs,
  renderBattleBanner,
  renderSettingsScreen,
  renderAll,
};
})();
