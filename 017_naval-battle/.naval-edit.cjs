const fs = require('fs');
let h=fs.readFileSync('index.html','utf8').replace(', user-scalable=no','').replace(/^.*class="back-link".*\r?\n/m,'').replace('main.js?v=naval-online-rematch-20260626','main.js?v=naval-mobile-20261017');
fs.writeFileSync('index.html',h);
let s=fs.readFileSync('main.js','utf8');
s=s.replace('  syncing: false','  syncing: false,\n  error: "",\n  connectionRef: null,\n  connectionListener: null');
s=s.replace('let firebaseApp = null;',`let cpuAttackTimer = null;
let gameGeneration = 0;

function invalidateCpuTurn() {
  gameGeneration += 1;
  window.clearTimeout(cpuAttackTimer);
  cpuAttackTimer = null;
}

let firebaseApp = null;`);
s=s.replace('function startCpuMode() {\r\n  leaveRoom(false);','function startCpuMode() {\n  invalidateCpuTurn();\n  leaveRoom(false);\n  clearOnlineLocalState();');
s=s.replace('  elements.app.classList.toggle("battle-compact", compactBattle);','  elements.app.classList.toggle("battle-compact", compactBattle);\n  elements.app.classList.toggle("fleet-setup", gameState.phase === "setup" || gameState.phase === "waiting");');
s=s.replace('  elements.messageText.textContent = gameState.logs[0] || "モードを選択してください。";','  elements.messageText.textContent = onlineState.error && online ? onlineState.error : gameState.logs[0] || "モードを選択してください。";');
s=s.replace('  renderOnlineStatus();','  if (online && (onlineState.syncing || !onlineState.connected)) {\n    [elements.readyButton, elements.startButton, elements.randomButton, elements.clearPlacementButton, elements.directionButton].forEach(button => button.disabled = true);\n  }\n  elements.restartButton.disabled = online && (onlineState.syncing || !onlineState.connected);\n  elements.resultRestartButton.disabled = elements.restartButton.disabled;\n  renderOnlineStatus();');
s=s.replace('  if (!onlineState.roomId) {','  if (onlineState.error) {\n    elements.onlineMessage.textContent = onlineState.error;\n  } else if (!onlineState.connected && onlineState.roomId) {\n    elements.onlineMessage.textContent = "接続が切れています。再接続を待つか、戻るで退出してください。";\n  } else if (!onlineState.roomId) {');
s=s.replace('  if (gameState.phase !== "setup") return;','  if (gameState.phase !== "setup" || getLocalOwner().ready || (gameState.mode === "online" && (onlineState.syncing || !onlineState.connected))) return;');
s=s.replace('    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span><b>${count}</b>`;','    button.setAttribute("aria-pressed", String(gameState.selectedCardId === card.id));\n    button.setAttribute("aria-label", `${card.name}、残り${count}回、${card.description}`);\n    button.innerHTML = `<strong>${card.name}</strong><span>${card.description}</span><b>残 ${count}</b>`;');
s=s.replace('function selectCard(cardId) {','function selectCard(cardId) {\n  if (gameState.phase !== "playerTurn" || !isLocalTurn()) return;');
s=s.replace('  if (gameState.phase !== "playerTurn") return;','  if (gameState.mode !== "cpu" || gameState.phase !== "playerTurn" || !isLocalTurn()) return;');
s=s.replace('  window.setTimeout(cpuTurn, 620);','  const generation = gameGeneration;\n  cpuAttackTimer = window.setTimeout(() => {\n    if (generation !== gameGeneration) return;\n    cpuAttackTimer = null;\n    cpuTurn(generation);\n  }, 620);');
s=s.replace('function cpuTurn() {\r\n  if (gameState.phase !== "cpuTurn") return;','function cpuTurn(generation = gameGeneration) {\n  if (generation !== gameGeneration || gameState.mode !== "cpu" || gameState.phase !== "cpuTurn") return;');
s=s.replace('function attachOnlineRoom(roomId, role) {','function attachOnlineRoom(roomId, role) {\n  invalidateCpuTurn();\n  onlineState.error = "";');
s=s.replace('function backToMenu() {','function backToMenu() {\n  invalidateCpuTurn();');
s=s.replace('function restartGame() {','function restartGame() {\n  invalidateCpuTurn();');
s=s.replace('    onlineState.connected = Boolean(roomData);\r\n    onlineState.syncing = false;','    if (onlineState.roomId !== roomId) return;');
s=s.replace('      backToMenu();','      backToMenu();\n      setModeMessage("部屋が削除されたか、ホストが退出しました。", true);');
s=s.replace('    onlineState.connected = false;\r\n    setModeMessage(error.message, true);','    onlineState.connected = false;\n    onlineState.error = `同期できません。戻るで退出し、再参加してください。${error.message}`;\n    setModeMessage(onlineState.error, true);');
s=s.replace('  onlineState.roomRef = roomRef(roomId);',`  onlineState.connectionRef = database.ref(".info/connected");
  onlineState.connectionListener = onlineState.connectionRef.on("value", snapshot => {
    if (onlineState.roomId !== roomId) return;
    onlineState.connected = snapshot.val() === true;
    render();
  });
  onlineState.roomRef = roomRef(roomId);`);
s=s.replace('function detachRoomListener() {','function detachRoomListener() {\n  if (onlineState.connectionRef && onlineState.connectionListener) onlineState.connectionRef.off("value", onlineState.connectionListener);\n  onlineState.connectionRef = null;\n  onlineState.connectionListener = null;');
s=s.replace('  onlineState.roomData = null;','  onlineState.roomData = null;\n  onlineState.error = "";');
s=s.replace('  onlineState.syncing = true;\r\n  render();\r\n  return roomRef(onlineState.roomId).update({ ...partialData, updatedAt: Date.now() });','  return roomRef(onlineState.roomId).update({ ...partialData, updatedAt: Date.now() });');
s=s.replace('function withFirebase(task, fallbackMessage) {\r\n  if (!initFirebase()) return;','function withFirebase(task, fallbackMessage) {\n  if (onlineState.syncing || !initFirebase()) return;\n  onlineState.error = "";');
s=s.replace('  task().catch((error) => {\r\n    setModeMessage(`${fallbackMessage} ${error.message}`, true);','  return task().catch((error) => {\n    if (onlineState.roomData) applyRemoteState(onlineState.roomData);\n    onlineState.error = `${fallbackMessage} ${error.message}`;\n    setModeMessage(onlineState.error, true);');
s=s.replace('  if (gameState.mode !== "online" || !onlineState.role) return;','  if (gameState.mode !== "online" || !onlineState.role || onlineState.syncing || !onlineState.connected) return;');
s=s.replace('  return onlineState.roomData?.currentTurn === onlineState.role;','  return onlineState.connected && !onlineState.syncing && onlineState.roomData?.status === "playing" && Boolean(onlineState.roomData?.hostId && onlineState.roomData?.guestId) && onlineState.roomData?.currentTurn === onlineState.role;');
// Atomic compare-and-update uses only existing room fields. A stale operation aborts.
s=s.replace('function updateRoomState(partialData) {',`async function commitRoomUpdate(expected, updates) {
  const ref = roomRef(onlineState.roomId);
  const result = await ref.transaction(room => {
    if (!room || room.status !== expected.status || room.currentTurn !== expected.currentTurn ||
        room.turnCount !== expected.turnCount || room.hostId !== expected.hostId || room.guestId !== expected.guestId ||
        JSON.stringify(room.players) !== JSON.stringify(expected.players)) return;
    Object.entries(updates).forEach(([key, value]) => {
      const parts = key.split("/");
      let target = room;
      parts.slice(0, -1).forEach(part => { target = target[part] ||= {}; });
      target[parts[parts.length - 1]] = value;
    });
    room.updatedAt = Date.now();
    return room;
  }, undefined, false);
  if (!result.committed) {
    if (result.snapshot.exists()) applyRemoteState(result.snapshot.val());
    throw new Error("部屋の状態が変わりました。最新の状態を確認してください。");
  }
  applyRemoteState(result.snapshot.val());
}

function updateRoomState(partialData) {`);
s=s.replace('  localOwner.cards[card.id] -= 1;\r\n  const result = resolveAttack(remoteOwner,','  const expected = structuredClone(onlineState.roomData);\n  localOwner.cards[card.id] -= 1;\n  const result = resolveAttack(remoteOwner,');
s=s.replace('    await updateRoomState(updates);\r\n  }, "攻撃結果','    await commitRoomUpdate(expected, updates);\n  }, "攻撃結果');
s=s.replace('  if (gameState.mode !== "online" || !onlineState.roomId || !onlineState.role) return;\r\n  const roomData = onlineState.roomData || {};','  if (gameState.mode !== "online" || !onlineState.roomId || !onlineState.role || onlineState.syncing || !onlineState.connected) return;\n  const roomData = structuredClone(onlineState.roomData || {});\n  if (!["playing", "finished"].includes(roomData.status)) return;');
s=s.replace('    await updateRoomState(updates);\r\n  }, "再戦準備','    await commitRoomUpdate(roomData, updates);\n  }, "再戦準備');
let a=s.indexOf('async function startOnlineGameIfReady()');let b=s.indexOf('\nfunction onlinePlayerAttack',a);
s=s.slice(0,a)+`async function startOnlineGameIfReady() {
  await roomRef(onlineState.roomId).transaction(room => {
    if (!room || !room.hostId || !room.guestId || !["setup", "waiting"].includes(room.status) ||
        !room.players?.host?.ready || !room.players?.guest?.ready) return;
    return { ...room, status: "playing", currentTurn: "host", turnCount: 1,
      updatedAt: Date.now(), logs: prependLog(room.logs, "オンライン対戦開始。hostの攻撃です。") };
  }, undefined, false);
}
`+s.slice(b);
a=s.indexOf('function copyRoomId()');b=s.indexOf('\nfunction setModeMessage',a);
s=s.slice(0,a)+`async function copyRoomId() {
  if (!onlineState.roomId) return;
  try {
    if (typeof navigator.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(onlineState.roomId);
    elements.onlineMessage.textContent = "部屋IDをコピーしました。";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(elements.roomIdText);
    selection?.removeAllRanges();
    selection?.addRange(range);
    elements.onlineMessage.textContent = "コピーできませんでした。表示中の部屋IDを長押しして手動コピーしてください。";
  }
}
`+s.slice(b);
s=s.replace('  if (!onlineState.roomId || !database) {','  const departingRoomData = onlineState.roomData;\n  clearOnlineLocalState();\n  if (!roomId || !database) {');
// Capture identifiers before clearing local state, so async departure cannot corrupt a new session.
s=s.replace('  detachRoomListener();\r\n  const departingRoomData','  const roomId = onlineState.roomId;\n  const role = onlineState.role;\n  detachRoomListener();\n  const departingRoomData');
s=s.replace('  const roomId = onlineState.roomId;\r\n  const role = onlineState.role;\r\n  try {','  try {');
s=s.replace('logs: prependLog(onlineState.roomData?.logs, "guest が退出しました。")','logs: prependLog(departingRoomData?.logs, "guest が退出しました。")');
s=s.replace('  if (removeLocal) backToMenu();','  if (removeLocal && !gameState.mode) backToMenu();');
s=s.replace('  const departingRoomData = onlineState.roomData;','  const departingRoomData = onlineState.roomData;\n  if (removeLocal) backToMenu();');
s=s.replace('  if (onlineState.roomId && database) updateRoomState({ updatedAt: Date.now() });','  if (onlineState.roomId && database) updateRoomState({ updatedAt: Date.now() }).catch(() => {});');
fs.writeFileSync('main.js',s);
let c=fs.readFileSync('style.css','utf8').replace(/\.back-link \{[\s\S]*?\}\s*/g,'').replace(/\.battle-compact \.back-link \{[\s\S]*?\}\s*/g,'').replace('grid-template-columns: 46px 1fr auto;','grid-template-columns: 1fr auto;').replace('grid-template-columns: 44px 1fr;','grid-template-columns: 1fr auto;');
// Compact mode is for phones; preserve the original desktop grid.
let start=c.indexOf('.battle-compact {'); c=c.slice(0,start)+'@media (max-width: 820px) {\n'+c.slice(start)+'\n}\n';
fs.writeFileSync('style.css',c);
