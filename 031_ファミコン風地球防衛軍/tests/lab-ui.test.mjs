import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtime} from './helpers/runtime.mjs';
import {SAVE_KEY,WEAPONS} from '../js/data.js';
const lab=()=>{const r=runtime(null,{debug:true});r.click('test-lab');return r};
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=html.slice(html.indexOf('<section id="screenLab"'),html.indexOf('<section id="labWeaponPicker"'));
test('five unique tab/panel pairs and all existing IDs/commands survive in one place',()=>{
  for(const tab of ['stage','loadout','enemies','visual','metrics']){
    assert.equal(ui.split(`id="labTab-${tab}"`).length,2);assert.equal(ui.split(`id="labPanel-${tab}"`).length,2);
    assert.match(ui,new RegExp(`id="labTab-${tab}"[^>]*role="tab"`));
  }
  for(const id of ['labStageMission','labStageArea','labStageRoute','labValidation','labStageDensity','labStageStatus','labPreset','labInvincible','labWeaponSlot1','labWeaponSlot2','labSlot','labBlast','labTerrain','labEnemy','labCount','labPlacement','labSpawnResult','labArtStyle','labRenderScale','labArtStatus','labCamera','labZoom','labZoomValue','labDestruction','labShake','labFps','qaResult','labRunSummary','labBenchmarkSummary','labCopyStatus','labRunReport'])assert.equal(ui.split(`id="${id}"`).length,2,id);
  for(const action of ['lab-stage-start','lab-boss-1','lab-boss-2','lab-test','lab-blast','lab-spawn','lab-clear','art-compare','lab-copy','lab-reset','lab-exit'])assert.equal(ui.split(`data-action="${action}"`).length,2,action);
  for(const mode of ['LIGHT','STANDARD','MASSIVE','LAB200'])assert.equal(ui.split(`data-benchmark="${mode}"`).length,2);
  assert.equal(html.match(/id="labWeaponPicker"/g).length,1);
});
test('five tabs maintain settings, entire game state, per-tab scroll and normal save',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset','WING');r.change('labWeapon1','M-20');r.run("const snapshot=JSON.stringify(game);document.querySelector('#labContent').scrollTop=87");
  for(const tab of ['loadout','enemies','visual','metrics','stage']){
    assert.equal(r.run(`switchLabTab('${tab}')`),true);assert.equal(r.run('JSON.stringify(game)'),r.run('snapshot'));
    for(const other of ['stage','loadout','enemies','visual','metrics'])assert.equal(r.get('labPanel-'+other).hidden,tab!==other);
    assert.equal(r.get('labTab-'+tab).attributes['aria-selected'],'true');assert.equal(r.get('labTab-'+tab).tabIndex,0);
  }
  assert.equal(r.get('labContent').scrollTop,87);assert.equal(r.storage.get(SAVE_KEY),saved);
  r.run("switchLabTab('visual')");r.click('lab-close');r.click('lab-open');assert.equal(r.run('labTab'),'visual');
});
test('terrain dropdown is non-destructive; apply or spawn explicitly resets using original backend',()=>{
  const r=lab();r.run("spawnEnemy('crawler',1230);game.score=333;game.player.hp=42;const before=JSON.stringify(game)");
  r.change('labTerrain','M02');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.equal(r.run('labTerrainChoice'),'M02');
  r.run("switchLabTab('visual');switchLabTab('enemies')");assert.equal(r.get('labTerrain').value,'M02');
  r.click('lab-terrain-apply');assert.equal(r.run('game.missionId'),'M02');assert.equal(r.run('labTerrainChoice'),null);assert.equal(r.run('game.score'),0);
  r.change('labTerrain','M01');r.change('labCount','50');r.click('lab-spawn');assert.equal(r.run('game.missionId'),'M01');assert.equal(r.run('game.liveEnemies'),50);
});
test('summaries distinguish current world/density/area from pending start candidate',()=>{
  const r=lab();r.change('labStageMission','M02');r.change('labStageArea','3');r.change('labStageDensity','LIGHT');
  assert.match(r.get('labCurrentSummary').textContent,/現在 M01.*MASSIVE.*200/);assert.match(r.get('labNextSummary').textContent,/次の開始 M02.*AREA04.*LIGHT/);
  r.click('lab-stage-start');r.click('lab-open');assert.match(r.get('labCurrentSummary').textContent,/現在 M02.*AREA04.*LIGHT.*30/);
  r.change('labInvincible',null,false);assert.match(r.get('labNextSummary').textContent,/QA:C→B/);assert.match(r.get('labCurrentSummary').textContent,/QA:B/);
});
test('preset selection is inert; explicit mass/boss/art/normal apply never spawns or restarts',()=>{
  const r=lab();r.run("spawnEnemy('crawler',1200);game.score=111;game.time=9;const p=JSON.stringify(game.player),en=JSON.stringify(game.enemies)");
  for(const preset of ['mass','boss','art','normal']){
    const before=r.run('JSON.stringify(game)');r.get('labUIPreset').value=preset;r.change('labUIPreset',preset);assert.equal(r.run('JSON.stringify(game)'),before);
    r.click('lab-preset-apply');assert.equal(r.run('game.score'),111);assert.equal(r.run('game.time'),9);assert.equal(r.run('JSON.stringify(game.enemies)'),r.run('en'));assert.equal(r.run('JSON.stringify(game.player)'),r.run('p'));
  }
  assert.equal(r.run('game.lab.count'),200);assert.equal(r.run('game.lab.stageArea'),4);assert.equal(r.run('game.lab.cameraMode'),'FIXED');assert.equal(r.run('game.lab.invincible'),false);
});
test('arrow/Home/End tab navigation, Escape/F2 resume, gameplay input stays blocked',()=>{
  const r=lab();r.get('labTab-stage').dataset.labTab='stage';r.run("handleLabKey({key:'ArrowRight',target:document.querySelector('#labTab-stage'),preventDefault(){}})");assert.equal(r.run('labTab'),'loadout');assert.equal(r.run('document.activeElement.id'),'labTab-loadout');
  r.get('labTab-loadout').dataset.labTab='loadout';r.run("handleLabKey({key:'End',target:document.querySelector('#labTab-loadout'),preventDefault(){}})");assert.equal(r.run('labTab'),'metrics');
  r.key('keydown','d');r.key('keydown',' ');r.pointer('aimPad','pointerdown');r.run('update(1/60)');assert.equal(r.run('input.right||input.jump||input.fire'),false);
  r.key('keydown','F2');assert.equal(r.run('state'),'play');r.key('keydown','F2');assert.equal(r.run('state'),'lab');assert.equal(r.run('labTab'),'metrics');r.key('keydown','Escape');assert.equal(r.run('state'),'play');
});
test('errors and both direct bosses use existing start guards without normal progression writes',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labValidation','A');r.click('lab-boss-1');assert.equal(r.run('state'),'lab');assert.match(r.get('labNotice').textContent,/開始不可/);
  r.change('labValidation','C');for(const [action,type,mission] of [['lab-boss-1','boss','M01'],['lab-boss-2','queen','M02']]){r.click(action);assert.equal(r.run('game.missionId'),mission);assert.equal(r.run(`game.enemies.some(e=>e.type==='${type}')`),true);r.click('lab-open')}
  assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('metrics use valid profiler data, actual counts and weapon damage; copy has accessible fallback',async()=>{
  const r=lab();r.click('lab-stage-start');r.click('lab-open');r.run("game.lab.run.weaponDamage['A-01']=24;syncLabUI()");
  assert.match(r.get('labMetrics').textContent,/未計測/);assert.match(r.get('labDamageSummary').textContent,/A-01 24/);
  await r.run('copyLabReport()');assert.equal(r.get('labJSON').open,true);assert.equal(r.run('labTab'),'metrics');assert.equal(r.run('document.activeElement.id'),'labRunReport');
  r.run("navigator.clipboard={writeText:async value=>{navigator.copied=value}}");await r.run('copyLabReport()');assert.equal(JSON.parse(r.run('navigator.copied')).version,'0.7.0');assert.match(r.get('labNotice').textContent,/コピーしました/);
});
test('all weapons still select in independent picker without changing normal inventory',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("switchLabTab('loadout')");r.click('lab-weapons',undefined,undefined,'1');
  for(const w of WEAPONS)r.run(`selectLabWeapon('${w.id}')`);
  assert.equal(r.run('game.lab.equipped[1]'),'M-20');r.key('keydown','Escape');assert.equal(r.run('labTab'),'loadout');assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('normal startup cannot open tabs or apply presets',()=>{
  const r=runtime();assert.equal(r.run("switchLabTab('metrics')"),false);assert.equal(r.run('applyLabUIPreset()'),false);assert.equal(r.run('applyLabTerrain(true)'),false);
});
