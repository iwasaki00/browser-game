// Focused browser checks. Run: set PLAYWRIGHT_MODULE to an installed playwright/core path,
// then node tests/interaction.cjs. Firebase is simulated; no production rooms are written.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

// Test-only instrumentation appended by the HTTP fixture, never by the application.
const fixture = `
window.testGame = {
  state: () => ({board, currentPlayer, selectedSkill, gameOver, skillCounts, cpuTimer,
    gameGeneration, onlineMovePending, onlineRoomId, clientId}),
  resetLocalGame, handleOnlineMove, runCpuTurn, getLegalMovesFor, applyMoveToState,
  setupOnline() {
    modeSelect.value = 'online'; onlinePanel.hidden = false; roomControls.open = false;
    onlineRoomId = '123456'; onlinePlayerColor = BLACK;
    window.mockRoom = {board: createInitialBoard(), currentPlayer: BLACK,
      skillCounts: createInitialSkillCounts(), matchStats: createInitialMatchStats(),
      gameOver: false, message: '黒の手番です', lastEffect: null,
      players: {[clientId]: {slot: 1, color: BLACK}, opponent: {slot: 2, color: WHITE}},
      createdAt: 1, updatedAt: 1};
    window.mockCalls = 0; window.mockMessages = []; window.mockFail = false;
    firebaseTools = {
      db: {}, ref: (_db, value) => value, child: (base, value) => base + '/' + value,
      off() {}, onDisconnect: () => ({cancel: async () => {}}),
      runTransaction: async (_ref, callback) => {
        window.mockCalls++;
        await new Promise(resolve => setTimeout(resolve, 100));
        if (window.mockFail) throw new Error('simulated network failure');
        const next = callback(structuredClone(window.mockRoom));
        if (next === undefined) return {committed: false};
        window.mockRoom = next;
        // Model the existing onValue room listener, which owns live board updates.
        if (next?.board && onlineRoomId) {
          setLocalState(next); updateOnlineStatus(next);
        }
        return {committed: true, snapshot: {val: () => next}};
      },
      update: async (_ref, values) => {
        Object.assign(window.mockRoom, values); setLocalState(window.mockRoom);
        updateOnlineStatus(window.mockRoom);
      },
      push: async (ref, value) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (window.mockFail) throw new Error('simulated chat failure');
        window.mockMessages.push({ref, value}); renderMessages(window.mockMessages.map(m => m.value));
      }
    };
    setLocalState(window.mockRoom); updateOnlineStatus(window.mockRoom); setChatEnabled(true);
  },
  receiveOpponentMove() {
    const move = getLegalMovesFor(window.mockRoom.board, WHITE)[0];
    Object.assign(window.mockRoom, applyMoveToState(window.mockRoom, move.row, move.col, WHITE, NORMAL));
    setLocalState(window.mockRoom); updateOnlineStatus(window.mockRoom);
  },
  receiveChat() { renderMessages([{senderId: 'opponent', text: '相手のメッセージ'}]); },
  exhaustSkill() {skillCounts.black.bomb = 0; render();}
};`;

// Preserve exact implementations of all rules, inventories and CPU scoring.
const baseline = execFileSync('git', ['show', 'HEAD:011_skill-othello/script.js'], {cwd: root, encoding: 'utf8'});
function functionSource(code, name) {
  const start = code.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const end = code.indexOf('\nfunction ', start + 1);
  return code.slice(start, end < 0 ? code.length : end).trim();
}
for (const name of ['createCell', 'normalizeBoard', 'createInitialBoard', 'createInitialSkillCounts',
  'getFlipsForMove', 'getLegalMovesFor', 'countStones', 'applyTrapEffect', 'applyStandardFlips',
  'captureCellBySkillEffect', 'applyBombEffect', 'applyConvertEffect', 'applySkillEffect',
  'createSkillCell', 'countdownTimers', 'applyMoveToState', 'evaluateCpuMove', 'getBestCpuMove']) {
  assert.equal(functionSource(source, name), functionSource(baseline, name), name + ' unchanged');
}
assert.equal(source.slice(source.indexOf('const SKILLS'), source.indexOf('const DIRECTIONS')),
  baseline.slice(baseline.indexOf('const SKILLS'), baseline.indexOf('const DIRECTIONS')));

const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['index.html', 'script.js', 'style.css'].includes(name)) {res.writeHead(404); res.end(); return;}
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(name === 'script.js' ? source + '\n' + fixture : fs.readFileSync(path.join(root, name)));
});

async function checkLayout(page, size, mode) {
  await page.setViewportSize(size);
  if (mode === 'online') await page.evaluate(() => window.testGame.setupOnline());
  await page.waitForTimeout(100);
  const metrics = await page.evaluate(() => {
    const rect = el => {const r = el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    return {board: rect(document.querySelector('#board')), skills: rect(document.querySelector('.skill-panel')),
      buttons: [...document.querySelectorAll('.skill-button')].map(rect),
      viewport: {width: innerWidth, height: innerHeight}, scrollWidth: document.documentElement.scrollWidth,
      cells: document.querySelectorAll('#board .cell').length,
      boardTouch: getComputedStyle(document.querySelector('.cell')).touchAction,
      gridTouch: getComputedStyle(document.querySelector('#board')).touchAction,
      gridSelect: getComputedStyle(document.querySelector('#board')).webkitUserSelect,
      boardSelect: getComputedStyle(document.querySelector('.cell')).webkitUserSelect,
      bodyOverflow: getComputedStyle(document.body).overflow,
      viewportMeta: document.querySelector('meta[name=viewport]').content};
  });
  assert.equal(metrics.cells, 64);
  assert(Math.abs(metrics.board.width - metrics.board.height) < 1, 'square board');
  assert(metrics.board.x >= 0 && metrics.board.right <= size.width + 1, 'board fits horizontally');
  assert(metrics.scrollWidth <= size.width, 'no horizontal overflow');
  assert(metrics.skills.bottom <= size.height + 1, 'board and skills fit height');
  assert(metrics.buttons.every(b => b.height >= 44 && b.width >= 44), 'tap sizes');
  assert.equal(new Set(metrics.buttons.map(b => Math.round(b.y))).size, 2, 'two skill rows');
  assert.equal(metrics.boardTouch, 'manipulation');
  assert.equal(metrics.gridTouch, 'manipulation');
  assert.equal(metrics.gridSelect, 'none');
  assert.equal(metrics.boardSelect, 'none');
  assert.notEqual(metrics.bodyOverflow, 'hidden');
  assert(!/user-scalable\s*=\s*no|maximum-scale/.test(metrics.viewportMeta));
  console.log(JSON.stringify({mode, size, board: Math.round(metrics.board.width), skillsBottom: metrics.skills.bottom}));
  if (process.env.SCREENSHOT_DIR && size.width === 320) {
    fs.mkdirSync(process.env.SCREENSHOT_DIR, {recursive: true});
    await page.screenshot({path: path.join(process.env.SCREENSHOT_DIR, `${page.context().browser().browserType().name()}-${mode}.png`)});
  }
}

async function interactions(page) {
  await page.goto(baseUrl);
  assert.equal(await page.locator('.back-link, .topbar').count(), 0);
  // Save the old callback and invoke it explicitly after reset, including a new white turn.
  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout;
    window.setTimeout = (callback, ms, ...args) => {
      if (ms === 360) window.oldCpuCallback = callback;
      return nativeSetTimeout(callback, ms, ...args);
    };
  });
  await page.locator('.cell.legal').first().click();
  const oldGeneration = await page.evaluate(() => window.testGame.state().gameGeneration);
  await page.locator('#restartButton').click();
  await page.evaluate(() => window.savedCpuCallback = window.oldCpuCallback);
  await page.locator('.cell.legal').first().click();
  const beforeOld = await page.evaluate(() => JSON.stringify(window.testGame.state().board));
  await page.evaluate(() => window.savedCpuCallback());
  assert.equal(await page.evaluate(() => JSON.stringify(window.testGame.state().board)), beforeOld);
  assert((await page.evaluate(() => window.testGame.state().gameGeneration)) > oldGeneration);
  await page.waitForTimeout(420);
  assert.equal(await page.locator('.stone').count(), 6, 'only new CPU moves');
  await page.locator('#restartButton').click();
  await page.locator('.cell.legal').first().click();
  await page.locator('#modeSelect').selectOption('online');
  await page.evaluate(() => window.oldCpuCallback());
  await page.waitForTimeout(420);
  assert.equal(await page.locator('.stone').count(), 4, 'mode cancels CPU');
  await page.locator('#modeSelect').selectOption('cpu');
  await page.locator('[data-skill=bomb]').click();
  assert.equal(await page.locator('[data-skill=bomb]').getAttribute('aria-pressed'), 'true');
  await page.locator('.cell.legal').first().click();
  assert.equal(await page.locator('[data-skill=normal]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-skill-count=bomb]').innerText(), '1');
  await page.locator('#restartButton').click();
  await page.evaluate(() => window.testGame.exhaustSkill());
  assert(await page.locator('[data-skill=bomb]').isDisabled());
  assert(await page.locator('[data-skill=bomb]').evaluate(el => el.classList.contains('exhausted')));
  await page.locator('#skillHelpButton').click();
  assert(await page.locator('#skillModal').isVisible());
  assert.equal(await page.locator('.skill-descriptions article').count(), 7);
  await page.keyboard.press('Escape');
  assert(await page.locator('#skillModal').isHidden());

  await page.evaluate(() => window.testGame.setupOnline());
  await page.locator('[data-skill=wall]').click();
  await page.evaluate(() => {
    window.firstMove = window.testGame.handleOnlineMove(2, 3);
    window.secondMove = window.testGame.handleOnlineMove(3, 2);
  });
  assert(await page.locator('#restartButton').isDisabled());
  assert(await page.locator('#modeSelect').isDisabled());
  assert.equal(await page.locator('.cell:not(:disabled)').count(), 0);
  await page.evaluate(() => Promise.all([window.firstMove, window.secondMove]));
  assert.equal(await page.evaluate(() => window.mockCalls), 1, 'one transaction for rapid taps');
  assert.equal(await page.locator('[data-skill=normal]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-skill-count=wall]').innerText(), '1');
  const payload = await page.evaluate(() => window.mockRoom);
  assert.deepEqual(Object.keys(payload.lastMove).sort(), ['at','col','color','row','skill']);
  assert.deepEqual(Object.keys(payload.board[2][3]).sort(), ['color','durability','owner','remainingTurns','skill']);
  await page.evaluate(() => window.testGame.receiveOpponentMove());
  assert.equal(await page.locator('.stone').count(), 6, 'opponent update applied');
  await page.evaluate(() => window.testGame.setupOnline());
  await page.evaluate(() => {window.mockFail = true; window.failedMove = window.testGame.handleOnlineMove(2, 3);});
  await page.evaluate(() => window.failedMove);
  assert(!(await page.locator('#restartButton').isDisabled()));
  assert((await page.locator('.cell:not(:disabled)').count()) > 0);
  await page.evaluate(() => {window.mockFail = false; return window.testGame.handleOnlineMove(2, 3);});
  assert.equal(await page.locator('.stone').count(), 5, 'retry works after failure');
  await page.locator('#restartButton').click();
  await page.waitForFunction(() => !document.querySelector('#restartButton').disabled);
  assert.equal(await page.locator('.stone').count(), 4, 'online restart');
  await page.locator('.chat-details summary').click();
  const boardBeforeChat = await page.evaluate(() => JSON.stringify(window.testGame.state().board));
  await page.locator('#chatInput').fill('編集可能なチャット');
  await page.locator('#chatInput').evaluate(el => el.setSelectionRange(0, 4));
  assert.equal(await page.locator('#chatInput').evaluate(el => el.selectionEnd - el.selectionStart), 4);
  await page.locator('#sendChatButton').click();
  await page.locator('#chatInput').press('Enter');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.mockMessages.length), 1, 'one chat message');
  const chatPayload = await page.evaluate(() => window.mockMessages[0]);
  assert.equal(chatPayload.ref, 'rooms/skill-othello/123456/messages');
  assert.deepEqual(Object.keys(chatPayload.value).sort(), ['createdAt','senderId','text']);
  await page.evaluate(() => window.testGame.receiveChat());
  assert.equal(await page.locator('.chat-text').innerText(), '相手のメッセージ');
  assert.equal(await page.locator('.chat-messages').evaluate(el => getComputedStyle(el).webkitUserSelect), 'text');
  await page.locator('#chatInput').fill('失敗後の再送');
  await page.evaluate(() => {window.mockFail = true;});
  await page.locator('#sendChatButton').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#chatInput').inputValue(), '失敗後の再送');
  assert(!(await page.locator('#sendChatButton').isDisabled()));
  await page.evaluate(() => {window.mockFail = false;});
  await page.locator('#sendChatButton').click();
  await page.locator('#chatInput').fill('送信中に書いた次の文章');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#chatInput').inputValue(), '送信中に書いた次の文章');
  await page.locator('.chat-details summary').click();
  assert.equal(await page.evaluate(() => JSON.stringify(window.testGame.state().board)), boardBeforeChat);
  await page.locator('#roomControls summary').click();
  await page.locator('#leaveRoomButton').click();
  await page.waitForFunction(() => !document.querySelector('#leaveRoomButton').disabled);
  assert.equal(await page.locator('#roomIdText').innerText(), '未参加');
  await page.locator('#modeSelect').selectOption('cpu');
  assert.equal(await page.locator('.stone').count(), 4);
}

let baseUrl;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  for (const engine of ['chromium', 'webkit']) {
    const browser = await playwright[engine].launch({headless: true});
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      console.log(engine);
      for (const size of [{width:320,height:568},{width:375,height:667},{width:390,height:844},
        {width:430,height:932},{width:1280,height:900}]) {
        await page.goto(baseUrl); await checkLayout(page, size, 'cpu');
        await checkLayout(page, size, 'online');
      }
      // Emulate reserved safe-area space without claiming an iPhone device test.
      await page.addStyleTag({content: '.app {padding-top:44px; padding-bottom:34px;}'});
      await checkLayout(page, {width:390,height:844}, 'online');
      await page.locator('.chat-details summary').click();
      await page.setViewportSize({width:320,height:400});
      await page.waitForTimeout(100);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
      await page.setViewportSize({width:375,height:667});
      await interactions(page);
      assert.deepEqual(errors, [], 'no browser runtime errors');
      console.log(engine + ': PASS');
    } finally { await browser.close(); }
  }
  console.log('PASS: rules unchanged; focused layout, timer, online and chat checks');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => server.close());
