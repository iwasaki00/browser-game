const fs=require('fs');let s=fs.readFileSync('main.js','utf8');
s=s.replace('let cpuAttackTimer = null;','let onlineOperationId = 0;\nlet cpuAttackTimer = null;');
s=s.replace('function startCpuMode() {\n  invalidateCpuTurn();','function startCpuMode() {\n  onlineOperationId += 1;\n  onlineState.syncing = false;\n  invalidateCpuTurn();');
s=s.replace('  const ref = roomRef(onlineState.roomId);\n  const result = await ref.transaction','  const roomId = onlineState.roomId;\n  const generation = gameGeneration;\n  const ref = roomRef(roomId);\n  const result = await ref.transaction');
s=s.replace('  if (!result.committed) {','  if (onlineState.roomId !== roomId || generation !== gameGeneration) return;\n  if (!result.committed) {');
s=s.replace('    await startOnlineGameIfReady();','    if (onlineState.roomId === readyRoomId) await startOnlineGameIfReady(readyRoomId);');
s=s.replace('  localOwner.ready = true;\n  withFirebase','  const readyRoomId = onlineState.roomId;\n  localOwner.ready = true;\n  withFirebase');
s=s.replace('async function startOnlineGameIfReady() {\n  await roomRef(onlineState.roomId)','async function startOnlineGameIfReady(roomId = onlineState.roomId) {\n  await roomRef(roomId)');
s=s.replace('function deserializeOwner(owner) {\n  return {','function deserializeOwner(owner) {\n  owner = owner ? JSON.parse(JSON.stringify(owner)) : owner;\n  return {');
s=s.replace('  onlineState.error = "";\n  onlineState.syncing = true;','  onlineState.error = "";\n  const operationId = ++onlineOperationId;\n  onlineState.syncing = true;');
s=s.replace('    if (session !== onlineState.roomId) return;','    if (operationId !== onlineOperationId || session !== onlineState.roomId) return;');
s=s.replace('  }).finally(() => {\n    onlineState.syncing = false;','  }).finally(() => {\n    if (operationId !== onlineOperationId) return;\n    onlineState.syncing = false;');
s=s.replace('function backToMenu() {\n  invalidateCpuTurn();','function backToMenu() {\n  onlineOperationId += 1;\n  onlineState.syncing = false;\n  invalidateCpuTurn();');
s=s.replace('    onlineState.connected = false;\n    setModeMessage(error.message, true);','    if (onlineState.roomId !== roomId) return;\n    onlineState.connected = false;\n    onlineState.error = `同期できません。戻るで退出し、再参加してください。${error.message}`;\n    setModeMessage(onlineState.error, true);');
// Compare Firebase data independently of object key order.
s=s.replace('async function commitRoomUpdate(expected, updates) {',`function roomPlayersSignature(players) {
  return JSON.stringify(players, function(key, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, name) => { sorted[name] = value[name]; return sorted; }, {});
    }
    return value;
  });
}

async function commitRoomUpdate(expected, updates) {`);
s=s.replace('JSON.stringify(room.players) !== JSON.stringify(expected.players)','roomPlayersSignature(room.players) !== roomPlayersSignature(expected.players)');
// Explicitly distinguish an opponent departure from initial waiting.
s=s.replace('  onlineState.roomData = roomData;\n  if (!onlineState.role)',`  const opponentLeft = Boolean(onlineState.roomData?.guestId && !roomData.guestId);
  onlineState.roomData = roomData;
  if (opponentLeft) onlineState.error = "相手が退出しました。新しい参加者を待つか、戻るで退出してください。";
  else if (roomData.guestId && onlineState.error.startsWith("相手が退出")) onlineState.error = "";
  if (!onlineState.role)`);
fs.writeFileSync('main.js',s);
