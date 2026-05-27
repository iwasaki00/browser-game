(() => {
window.RuneGridDuel = window.RuneGridDuel || {};

const { chooseEnemyMove } = window.RuneGridDuel.ai;
const { applyPlacementsAndScore, canTakeTurn, evaluatePlacements } = window.RuneGridDuel.battle;
const {
  clearSelections,
  addLog,
  evaluateEndState,
  getPlayerPlacements,
  initializeGameState,
  state,
  toggleSelectedCell,
  toggleSelectedHand,
  assignCardToCell,
  setDraggingCardId,
  setBattleBanner,
  setScreen,
  setSettingsStatus,
  updateSettings,
  saveSettings,
} =
  window.RuneGridDuel.stateModule;
const { bindUiEvents, renderAll } = window.RuneGridDuel.ui;

function formatScoredLines(scoredLines) {
  if (scoredLines.length === 0) {
    return "役なしで0ダメージ";
  }

  return scoredLines
    .map((entry) => `${entry.handResult.name}で${entry.handResult.damage}ダメージ`)
    .join(" / ");
}

function finalizeTurn({ actor, placements }) {
  const isPlayer = actor === "player";
  const result = applyPlacementsAndScore({
    board: state.board,
    placements,
    attacker: actor,
    defender: { hp: isPlayer ? state.enemyHp : state.playerHp },
    deck: state.deck,
    hand: isPlayer ? state.playerHand : state.enemyHand,
  });

  state.board = result.board;
  state.deck = result.deck;
  state.lastResolvedCells = placements.map((placement) => placement.cellIndex);
  state.phase = "resolving";
  setBattleBanner({
    actor,
    totalDamage: result.totalDamage,
    lines: result.scoredLines,
  });

  if (isPlayer) {
    state.enemyHp = result.defenderHp;
    state.playerHand = result.hand;
    addLog(`プレイヤー配置: ${formatScoredLines(result.scoredLines)} 合計${result.totalDamage}`);
  } else {
    state.playerHp = result.defenderHp;
    state.enemyHand = result.hand;
    addLog(`敵配置: ${formatScoredLines(result.scoredLines)} 合計${result.totalDamage}`);
  }

  clearSelections();
  evaluateEndState();
}

function finishResolutionAfterDelay(nextStep) {
  render();
  window.setTimeout(() => {
    setBattleBanner(null);
    state.phase = state.winner ? "finished" : "idle";
    nextStep();
    render();
  }, state.settings.resolutionDelayMs);
}

function handlePlayerConfirm() {
  if (state.currentTurn !== "player" || state.winner) {
    return;
  }

  const placements = getPlayerPlacements();
  if (placements.length !== 2) {
    addLog("2枚のカードと2つの空きマスを選んでください。");
    render();
    return;
  }
  const preview = evaluatePlacements(state.board, placements);
  if (preview.totalDamage <= 0) {
    addLog("役が完成していないため決定できません。パスしてください。");
    render();
    return;
  }

  finalizeTurn({ actor: "player", placements });
  if (!state.winner) {
    finishResolutionAfterDelay(() => {
      state.currentTurn = "enemy";
      runEnemyTurn();
    });
    return;
  }
  finishResolutionAfterDelay(() => {});
}

function handlePlayerPass() {
  if (state.currentTurn !== "player" || state.winner || state.phase === "resolving") {
    return;
  }

  clearSelections();
  addLog("プレイヤーはパスしました。");
  state.currentTurn = "enemy";
  render();
  window.setTimeout(runEnemyTurn, state.settings.resolutionDelayMs);
}

function runEnemyTurn() {
  if (state.winner) {
    render();
    return;
  }

  if (!canTakeTurn(state.board, state.enemyHand)) {
    addLog("敵は行動できません。");
    evaluateEndState();
    if (!state.winner) {
      state.currentTurn = "player";
    }
    render();
    return;
  }

  const placements = chooseEnemyMove(state);
  finalizeTurn({ actor: "enemy", placements });

  finishResolutionAfterDelay(() => {
    if (!state.winner) {
      state.currentTurn = "player";
      state.phase = "player-select";
      if (!canTakeTurn(state.board, state.playerHand)) {
        addLog("プレイヤーはこれ以上2枚置けないため戦闘終了です。");
        evaluateEndState();
      }
    }
  });
}

function handleNewGame() {
  initializeGameState();
  if (state.currentTurn === "enemy") {
    render();
    window.setTimeout(runEnemyTurn, state.settings.resolutionDelayMs);
    return;
  }
  render();
}

function handleClear() {
  if (state.phase === "resolving") {
    return;
  }
  clearSelections();
  render();
}

function handleCardClick(cardId) {
  if (state.phase === "resolving") {
    return;
  }
  toggleSelectedHand(cardId);
  render();
}

function handleDragStart(cardId) {
  if (state.phase === "resolving") {
    return;
  }
  setDraggingCardId(cardId);
}

function handleDragEnd() {
  setDraggingCardId(null);
  render();
}

function handleCardDrop(cardId, cellIndex) {
  if (state.phase === "resolving") {
    return;
  }
  const assigned = assignCardToCell(cardId, cellIndex);
  if (!assigned) {
    addLog("そのカードはそのマスに配置できません。");
  }
  setDraggingCardId(null);
  render();
}

function handleCellClick(cellIndex) {
  if (state.phase === "resolving") {
    return;
  }
  toggleSelectedCell(cellIndex);
  render();
}

function handleSaveSettings() {
  const playerOrder = document.querySelector("#setting-player-order").value === "second" ? "second" : "first";
  const startHp = Math.max(1, Math.min(99, Number(document.querySelector("#setting-start-hp").value) || state.settings.startHp));
  const jokerCount = Math.max(0, Number(document.querySelector("#setting-joker-count").value) || state.settings.jokerCount);

  updateSettings({
    playerOrder,
    startHp,
    jokerCount,
  });

  if (saveSettings()) {
    setSettingsStatus("設定を保存しました。");
  } else {
    setSettingsStatus("保存に失敗しました。このセッションには反映されています。");
  }
  render();
}

function handleStartGame() {
  handleSaveSettings();
  setScreen("game");
  initializeGameState();
  render();
  if (state.currentTurn === "enemy") {
    window.setTimeout(runEnemyTurn, state.settings.resolutionDelayMs);
  }
}

function handleOpenSettings() {
  if (state.phase === "resolving") {
    return;
  }
  setSettingsStatus("");
  setScreen("settings");
  render();
}

function handleCloseSettings() {
  if (state.logs.length === 0) {
    return;
  }
  setSettingsStatus("");
  setScreen("game");
  render();
}

const handlers = {
  onConfirm: handlePlayerConfirm,
  onClear: handleClear,
  onPass: handlePlayerPass,
  onNewGame: handleNewGame,
  onPlayerCardClick: handleCardClick,
  onCellClick: handleCellClick,
  onDragStart: handleDragStart,
  onDragEnd: handleDragEnd,
  onCardDrop: handleCardDrop,
  onSaveSettings: handleSaveSettings,
  onStartGame: handleStartGame,
  onOpenSettings: handleOpenSettings,
  onCloseSettings: handleCloseSettings,
  getPreviewPlacements: getPlayerPlacements,
};

function render() {
  renderAll(handlers);
}

bindUiEvents(handlers);
render();
})();
