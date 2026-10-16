const fs=require('fs');let s=fs.readFileSync('main.js','utf8').replace(/\r\n/g,'\n');
s=s.replace('function startCpuMode() {\n  leaveRoom(false);','function startCpuMode() {\n  invalidateCpuTurn();\n  leaveRoom(false);');
s=s.replace('function cpuTurn() {\n  if (gameState.phase !== "cpuTurn") return;','function cpuTurn(generation = gameGeneration) {\n  if (generation !== gameGeneration || gameState.mode !== "cpu" || gameState.phase !== "cpuTurn") return;');
s=s.replace('    onlineState.connected = Boolean(roomData);\n    onlineState.syncing = false;','    if (onlineState.roomId !== roomId) return;');
s=s.replace('  onlineState.syncing = true;\n  render();\n  return roomRef(onlineState.roomId).update','  return roomRef(onlineState.roomId).update');
s=s.replace('function withFirebase(task, fallbackMessage) {\n  if (!initFirebase()) return;','function withFirebase(task, fallbackMessage) {\n  if (onlineState.syncing || !initFirebase()) return;\n  onlineState.error = "";');
s=s.replace('  task().catch((error) => {\n    setModeMessage(`${fallbackMessage} ${error.message}`, true);','  const session = onlineState.roomId;\n  return task().catch((error) => {\n    if (session !== onlineState.roomId) return;\n    if (onlineState.roomData) applyRemoteState(onlineState.roomData);\n    onlineState.error = `${fallbackMessage} ${error.message}`;\n    setModeMessage(onlineState.error, true);');
s=s.replace('  localOwner.cards[card.id] -= 1;\n  const result = resolveAttack(remoteOwner,','  const expected = JSON.parse(JSON.stringify(onlineState.roomData));\n  localOwner.cards[card.id] -= 1;\n  const result = resolveAttack(remoteOwner,');
s=s.replace('    await updateRoomState(updates);\n  }, "攻撃結果','    await commitRoomUpdate(expected, updates);\n  }, "攻撃結果');
s=s.replace('  if (gameState.mode !== "online" || !onlineState.roomId || !onlineState.role) return;\n  const roomData = onlineState.roomData || {};','  if (gameState.mode !== "online" || !onlineState.roomId || !onlineState.role || onlineState.syncing || !onlineState.connected) return;\n  const roomData = JSON.parse(JSON.stringify(onlineState.roomData || {}));\n  if (!["playing", "finished"].includes(roomData.status)) return;');
s=s.replace('    await updateRoomState(updates);\n  }, "再戦準備','    await commitRoomUpdate(roomData, updates);\n  }, "再戦準備');
s=s.replace('async function leaveRoom(removeLocal = true) {\n  detachRoomListener();','async function leaveRoom(removeLocal = true) {\n  const roomId = onlineState.roomId;\n  const role = onlineState.role;\n  detachRoomListener();');
s=s.replace('  const roomId = onlineState.roomId;\n  const role = onlineState.role;\n  try {','  try {');
s=s.replace('  if (removeLocal && !gameState.mode) backToMenu();','');
s=s.replace('  localOwner.ready = true;\n  withFirebase','  if (gameState.phase !== "setup" || localOwner.ready) return;\n  localOwner.ready = true;\n  withFirebase');
// Keep placement writes serialized with ready and attack operations.
s=s.replace('  updateRoomState({\n    [`players/${onlineState.role}`]: { ...serializeOwner(localOwner), name: onlineState.role }\n  }).catch((error) => setModeMessage(error.message, true));','  withFirebase(() => updateRoomState({\n    [`players/${onlineState.role}`]: { ...serializeOwner(localOwner), name: onlineState.role }\n  }), "配置の同期に失敗しました。");');
s=s.replace('  elements.cpuModeButton.onclick = startCpuMode;','  elements.cpuModeButton.onclick = startCpuMode;');
s=s.replace('  elements.modePanel.hidden = gameState.phase !== "menu";','  elements.modePanel.hidden = gameState.phase !== "menu";\n  [elements.cpuModeButton, elements.createRoomButton, elements.joinRoomButton].forEach(button => button.disabled = onlineState.syncing);');
s=s.replace('function resetLocalPlacement() {','function resetLocalPlacement() {\n  if (gameState.phase !== "setup" || getLocalOwner().ready || (gameState.mode === "online" && (onlineState.syncing || !onlineState.connected))) return;');
s=s.replace('function randomPlaceFleet(ownerKey = "player", shouldSync = true) {','function randomPlaceFleet(ownerKey = "player", shouldSync = true) {\n  if (ownerKey === "player" && (gameState.phase !== "setup" || getLocalOwner().ready || (gameState.mode === "online" && (onlineState.syncing || !onlineState.connected)))) return;');
fs.writeFileSync('main.js',s);
let c=fs.readFileSync('style.css','utf8').replace('.battle-compact .battle-compact .eyebrow,','.battle-compact .eyebrow,');
c+=`
/* Only interactive surfaces suppress selection; room codes and inputs remain selectable. */
button, .board, .cards, .rules summary {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
#roomIdInput, #roomIdText { user-select: text; -webkit-user-select: text; -webkit-touch-callout: default; }
#roomIdText { overflow-wrap: anywhere; }
.cell.invalid-preview { outline-color: var(--danger); background-color: var(--danger); opacity: 0.85; }
.cell.placement-preview::after { content: "●"; color: var(--accent); position: relative; z-index: 1; }
.cell.invalid-preview::after { content: "×"; color: var(--danger); }
.card-button.active strong { color: var(--warning); }
.card-button.active:disabled { opacity: 0.8; }
@media (max-width: 820px) {
  .topbar { grid-template-columns: minmax(0, 1fr) auto; }
  .status-chip { grid-column: auto; width: auto; min-width: 80px; }
  .app { padding-left: max(6px, env(safe-area-inset-left)); padding-right: max(6px, env(safe-area-inset-right)); }
  .fleet-setup .topbar .eyebrow, .fleet-setup .rules, .fleet-setup .enemy-panel { display: none; }
  .fleet-setup .setup-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; margin-top: 6px; }
  .fleet-setup .setup-panel button { font-size: 0.8rem; padding: 4px; }
  .fleet-setup .setup-help { padding: 5px; font-size: 0.8rem; }
  .fleet-setup .command-panel { grid-template-columns: 42px 65px minmax(0, 1fr); }
  .fleet-setup .command-panel .secondary { grid-column: auto; }
  .fleet-setup .command-panel .wide { grid-column: 1 / -1; grid-row: 2; }
  .fleet-setup .boards { margin-top: 6px; }
  .fleet-setup .own-panel { width: min(100%, 440px); margin: auto; }
  .fleet-setup .log-panel { max-height: 90px; overflow-y: auto; }
  .battle-compact {
    --enemy-size: min(100vw - 44px - env(safe-area-inset-left) - env(safe-area-inset-right), 100dvh - 286px - env(safe-area-inset-top) - env(safe-area-inset-bottom), 420px);
    min-height: 100vh;
    min-height: 100dvh;
    gap: 4px;
    padding-top: max(4px, env(safe-area-inset-top));
    padding-bottom: max(4px, env(safe-area-inset-bottom));
  }
  .battle-compact .topbar { grid-template-columns: minmax(0, 1fr) auto; gap: 4px; }
  .battle-compact .status-chip { grid-column: auto; width: auto; padding: 4px; }
  .battle-compact .command-panel { order: 2; grid-template-columns: 35px 56px minmax(0, 1fr) 70px; padding: 4px; gap: 3px; }
  .battle-compact .command-panel .wide { grid-column: 1 / -1; grid-row: 2; }
  .battle-compact .command-panel .secondary { grid-column: 4; grid-row: 1; min-height: 32px; }
  .battle-compact .stat { padding: 2px 4px; }
  .battle-compact .stat strong { white-space: normal; overflow-wrap: anywhere; }
  .battle-compact .command-panel .wide span { display: none; }
  .battle-compact .online-panel { order: 6; padding: 5px; gap: 4px; }
  .battle-compact .online-panel .room-code, .battle-compact .online-grid { display: none; }
  .battle-compact .online-actions { display: flex; justify-content: flex-end; }
  .battle-compact .online-actions #readyButton { display: none; }
  .battle-compact .online-actions button { min-height: 32px; padding: 4px 12px; }
  .battle-compact #onlineMessage { display: block; padding: 3px; font-size: 0.72rem; }
  .battle-compact .enemy-panel { overflow: auto; padding: 4px; }
  .battle-compact .enemy-panel .board-wrap { width: calc(max(280px, var(--enemy-size)) + 20px); margin: auto; grid-template-columns: 18px minmax(0, 1fr); grid-template-rows: 14px auto; }
  .battle-compact .enemy-panel .coords.cols { width: auto; padding: 0 1px; align-items: center; }
  .battle-compact .enemy-panel .coords.rows { padding-top: 1px; padding-bottom: 1px; }
  .battle-compact #enemyBoard { width: 100%; aspect-ratio: 1; grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(10, minmax(0, 1fr)); }
  .battle-compact #enemyBoard .cell { width: 100%; height: 100%; }
  .battle-compact #cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; padding: 1px 0; overflow: visible; }
  .battle-compact .card-button { min-width: 0; max-width: none; min-height: 60px; padding: 4px 2px; text-align: center; }
  .battle-compact .card-button strong { font-size: 0.68rem; }
  .battle-compact .card-button span { font-size: 0.6rem; }
  .battle-compact .card-button b { font-size: 0.7rem; margin-top: 3px; }
  .battle-compact .bottom-info { gap: 4px; }
  .battle-compact .player-mini-panel { padding: 4px; }
  .battle-compact #playerBoard { width: 90px; height: 90px; grid-template-columns: repeat(10, minmax(0, 1fr)); grid-template-rows: repeat(10, minmax(0, 1fr)); }
  .battle-compact #playerBoard .cell { width: 100%; height: 100%; }
  .battle-compact .log-panel { height: 116px; max-height: 116px; overscroll-behavior: contain; }
  .battle-compact #logList li { font-size: 0.68rem; }
}
@media (max-width: 820px) and (max-height: 680px) {
  .battle-compact { --enemy-size: min(100vw - 44px, 100dvh - 280px, 340px); }
  .battle-compact .enemy-panel { max-height: max(220px, calc(100dvh - 286px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); }
  .battle-compact .enemy-panel .board-wrap { margin-top: 0; }
  .battle-compact #playerBoard { width: 70px; height: 70px; }
  .battle-compact .log-panel { height: 96px; max-height: 96px; }
}
`;
fs.writeFileSync('style.css',c);
