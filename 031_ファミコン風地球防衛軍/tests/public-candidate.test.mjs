import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {deploy} from '../tools/campaign-integration.mjs';
import {publicGameSource,publicHTML} from '../tools/public-candidate.mjs';
import {SAVE_KEY,DEFAULT_SAVE} from '../js/data.js';
const original=readFileSync(new URL('../js/game.js',import.meta.url),'utf8'),sourceText=publicGameSource(original);
for(const search of ['', '?debug=0','?debug=1','?debug=2','?debug=20','?debug=02','?debug=true','?debug=2abc'])test('public candidate actually denies debug startup: '+(search||'normal'),()=>{
 const r=runtime(structuredClone(DEFAULT_SAVE),{search,sourceText,recordDraw:false});assert.equal(r.run('DEBUG'),false);assert.equal(r.run('URL_INVINCIBLE'),false);assert.equal(r.run('window.__PDF_GAME__'),undefined);r.click('test-lab');r.run('startLab()');assert.equal(r.run('game'),null);const opened=r.json('save.unlockedMissions');r.click('debug2-unlock');assert.deepEqual(r.json('save.unlockedMissions'),opened);deploy(r,'M01');r.run('hurtPlayer(20,0)');assert.equal(r.run('game.player.hp'),80);assert.equal(r.get('urlInvincibleBadge').hidden,true);assert.equal(r.storage.has(SAVE_KEY+'-debug2'),false);assert.ok(r.writes.every(w=>w.key===SAVE_KEY));r.click('lab-open');r.key('keydown','F2');assert.equal(r.run('game.lab'),undefined);assert.notEqual(r.run('state'),'lab');
});
test('public transformation removes launch controls and leaves read-only transition diagnostics intact',()=>{
 const html=publicHTML(readFileSync(new URL('../index.html',import.meta.url),'utf8'));assert.doesNotMatch(html,/id="testLabButton"|data-action="test-lab"|data-action="debug2-unlock"|id="labToggle"[^>]*data-action/);assert.match(html,/data-action="result-diagnostics-copy"/);assert.match(html,/canvas id="game" width="320" height="180"/);assert.match(sourceText,/const debugValue=null;/);assert.equal(original.includes('new URLSearchParams(location.search)'),true);
});
test('public build fails closed if the known bootstrap/HTML anchor changes',()=>{assert.throws(()=>publicGameSource('const debugValue=custom();'),/refused/);assert.throws(()=>publicHTML('<html></html>'),/refused/)});
