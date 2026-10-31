import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MobilePlaytest,MOBILE_TEST,MOBILE_QA_ITEMS,createMobileQA,setMobileQA,mobileReportText,mobileChecklistText} from '../js/mobile-playtest.js';
import {runtime} from './helpers/runtime.mjs';
import {DEFAULT_SAVE,SAVE_KEY} from '../js/data.js';
const metadata={version:'0.3.3',environment:'手動確認環境',missionId:'M03',area:3,playerClass:'WING',weapons:['A-01','S-02'],density:'STANDARD',enemyLimit:50,initialEnemies:50,artStyle:'UNIFIED 01',resolution:'320×180',cameraMode:'AUTO',cameraZoom:.5,invincible:false,validationMode:'B',destructionLevel:1};
const counts={enemies:50,shots:8,effects:9};
const ready=()=>{const p=new MobilePlaytest();p.start(metadata,'2026-10-26T00:00:00.000Z');p.record(0,0,0,counts);p.record(1000,999,999,counts);return p};
const lab=()=>{const r=runtime(DEFAULT_SAVE,{debug:true,recordDraw:false});r.click('test-lab');return r};

test('start is ARMED while LAB is stopped, then excludes a real one-second warmup and its CPU',()=>{
  const p=new MobilePlaytest();p.start(metadata);p.record(50000,900,900,counts,false,'LAB');assert.equal(p.snapshot().status,'ARMED');assert.equal(p.snapshot().samples,0);
  p.record(100000,99,99,counts);p.record(100500,99,99,counts);p.record(100999,99,99,counts);assert.equal(p.snapshot().status,'WARMUP');
  p.record(101000,99,99,counts);assert.equal(p.snapshot().status,'RECORDING');assert.equal(p.snapshot().samples,0);p.record(101020,2,3,counts);
  assert.equal(p.snapshot().observedRafFps,50);assert.equal(p.snapshot().updateCpuMs,2);assert.equal(p.snapshot().drawCpuMs,3);assert.equal(p.snapshot().actualWarmupMs,1000);
});
for(const hz of [30,60,120,144])test(`${hz}Hz: full 30s records RAF independently of CPU, keeps high-refresh frames and fixed-second minimum`,()=>{
  const p=ready();for(let i=1;i<=hz*30;i++)p.record(1000+i*1000/hz,2,3,{enemies:i%201,shots:i%88,effects:i%80});const s=p.snapshot();
  assert.equal(s.status,'COMPLETE');assert.equal(s.valid,true);assert.equal(s.samples,hz*30);assert.ok(Math.abs(s.observedRafFps-hz)<1e-8);assert.equal(s.minimumOneSecondFps,hz);assert.equal(s.fullSecondWindows,30);
  assert.equal(s.updateCpuMs,2);assert.equal(s.drawCpuMs,3);assert.equal(s.maxEnemies,200);assert.equal(s.maxShots,87);assert.equal(s.maxEffects,79);assert.equal(p.history.length,1);
  assert.ok(Math.abs(s.p50FrameMs-1000/hz)<=.25);assert.ok(Math.abs(s.p95FrameMs-1000/hz)<=.25);assert.ok(Math.abs(s.p99FrameMs-1000/hz)<=.25);
  const frozen=JSON.stringify(s);p.record(999999,999,999,counts);assert.equal(JSON.stringify(p.snapshot()),frozen);
});
test('500 / 1000 / 1500ms ordinary foreground frames are not censored; empty second windows count as 0 FPS',()=>{
  for(const step of [500,1000,1500]){const p=ready();for(let t=1000+step;t<=31000;t+=step)p.record(t,12,8,counts);const s=p.snapshot();
    assert.equal(s.valid,true);assert.equal(s.samples,30000/step);assert.equal(s.maxFrameMs,step);assert.equal(s.p99FrameMs,step);assert.equal(s.interruptions,0);assert.equal(s.observedRafFps,1000/step);assert.equal(s.minimumOneSecondFps,step===1500?0:1000/step);
  }
});
test('histogram P50/P95/P99 uses nearest-rank with 0.25ms upper-bin precision',()=>{
  const p=ready();let t=1000;for(let i=1;i<=100;i++){t+=i;p.record(t,1,2,counts)}const s=p.snapshot();assert.equal(s.p50FrameMs,50);assert.equal(s.p95FrameMs,95);assert.equal(s.p99FrameMs,99);assert.equal(s.minimumOneSecondFps,11);assert.equal(s.samples,100);
});
test('unsignalled gap over 2s is retained as ambiguous, invalidates instead of hiding it, and never auto-resumes',()=>{
  const p=ready();p.record(1020,1,1,counts);p.record(4021,1,1,counts);const s=p.snapshot();assert.equal(s.status,'INVALID');assert.equal(s.valid,false);assert.equal(s.unclassifiedGapMs,3001);assert.equal(s.interruptions,1);assert.equal(s.samples,1);assert.match(s.reason,/判別不能/);
  p.record(4031,1,1,counts);assert.equal(p.snapshot().samples,1);assert.equal(p.history.length,1);p.start(metadata);assert.equal(p.snapshot().samples,0);
});
test('CPU-accounted long foreground frames stay in RAF/percentiles; prior callback CPU, not the following CPU, explains the delay',()=>{
  const p=ready();p.record(1010,2500,0,counts);p.record(3510,1,1,counts);let s=p.snapshot();assert.equal(s.status,'RECORDING');assert.equal(s.samples,2);assert.equal(s.maxFrameMs,2500);assert.equal(s.p99FrameMs,2500);assert.equal(s.cpuAccountedLongFrames,1);assert.equal(s.minimumOneSecondFps,0);
  for(let t=3520;t<=31000;t+=10)p.record(t,1,1,counts);s=p.snapshot();assert.equal(s.valid,true);assert.ok(s.updateCpuMs>1);
  const ambiguous=ready();ambiguous.record(1010,1,1,counts);ambiguous.record(3510,2500,0,counts);assert.equal(ambiguous.snapshot().status,'INVALID');assert.equal(ambiguous.snapshot().unclassifiedGapMs,2500);
});
for(const reason of ['タブ非表示','ポーズ','LAB表示','フォーカス喪失','GAME OVER','画面回転'])test(`${reason}: terminate the continuous run once, preserve partial values, a new test must warm up again`,()=>{
  const p=ready();p.record(1010,1,2,counts);p.record(1020,1,2,counts,false,reason);assert.equal(p.snapshot().status,'INTERRUPTED');assert.equal(p.snapshot().reason,reason);assert.equal(p.snapshot().samples,1);assert.equal(p.snapshot().interruptions,1);
  p.interrupt('second');p.record(1030,0,0,counts);assert.equal(p.history.length,1);p.start(metadata);p.record(90000,0,0,counts);assert.equal(p.snapshot().status,'WARMUP');assert.equal(p.snapshot().samples,0);
});
test('invalid timestamps / CPU are not reported as valid; history and counters use bounded storage',()=>{
  for(const values of [[NaN,1,1],[1001,NaN,1],[1001,1,-1]]){const p=ready();p.record(...values,counts);assert.equal(p.snapshot().status,'INVALID')}
  const p=ready();for(let i=0;i<30;i++){p.start(metadata);p.interrupt('test')}assert.equal(p.history.length,MOBILE_TEST.historyLimit);assert.equal(p.bins.length,8001);assert.equal(p.seconds.length,32);
});
test('Japanese performance text contains actual metadata and values, unknowns remain unknown, checklist never auto-passes',()=>{
  const p=ready();assert.match(mobileReportText(null),/未計測/);assert.match(mobileReportText(p.snapshot()),/平均観測RAF FPS：未計測/);
  for(let i=1;i<=1800;i++)p.record(1000+i*1000/60,2,3,counts);const text=mobileReportText(p.snapshot(),'人手メモ');for(const fragment of ['Version：0.3.3','M03 AREA3','WING','A-01 / S-02','UNIFIED 01','320×180','30.000秒','60.0','更新CPU平均：2.00','人手メモ'])assert.ok(text.includes(fragment),fragment);
  const qa=createMobileQA();assert.equal(Object.keys(qa).length,8);assert.equal(MOBILE_QA_ITEMS.length,8);assert.ok(Object.values(qa).every(q=>q.status==='未確認'));
  assert.equal(setMobileQA(qa,'IP-02','NG'),true);setMobileQA(qa,'IP-02','同時押しで止まる',true);assert.equal(setMobileQA(qa,'IP-99','OK'),false);assert.equal(setMobileQA(qa,'IP-01','AUTO_OK'),false);assert.match(mobileChecklistText(qa,'実機Safari'),/IP-02.*NG.*同時押しで止まる/);assert.equal(qa['IP-01'].status,'未確認');
});
test('LAB current-scene start preserves gameplay, closes panel, 30s completes without stopping the game or writing save',()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.run("game.player.x=1050;game.time=15;game.score=111;const before=JSON.stringify(game)");r.input('mobileEnvironment','手動記録');r.click('mobile-start');assert.equal(r.run('state'),'play');assert.equal(r.run('JSON.stringify(game)'),r.run('before'));assert.equal(r.run('mobilePlaytest.snapshot().status'),'ARMED');
  r.run('loop(1000);loop(2000);for(let i=1;i<=1800;i++)loop(2000+i*1000/60)');assert.equal(r.run('mobilePlaytest.snapshot().valid'),true);assert.match(r.get('mobileMeasureBadge').textContent,/計測完了/);assert.equal(r.run('state'),'play');assert.equal(r.storage.get(SAVE_KEY),saved);
  r.click('lab-open');assert.equal(r.run('mobilePlaytest.snapshot().valid'),true);assert.match(r.get('mobileMeasureStatus').textContent,/計測完了/);assert.equal(r.run('mobilePlaytest.history.length'),1);
});
for(const n of [50,100,200])test(`explicit ${n}-enemy scenario generates only on start, preserves class/weapons/settings and remains LAB-only`,()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.change('labPreset','WING');r.change('labWeapon1','M-18');r.run('const before=JSON.stringify(game)');r.get('mobileScenario').value=String(n);r.change('mobileScenario',String(n));assert.equal(r.run('JSON.stringify(game)'),r.run('before'));
  r.click('mobile-start');assert.equal(r.run('game.liveEnemies'),n);assert.equal(r.run('game.lab.preset'),'WING');assert.equal(r.run('activeEquipment()[0]'),'M-18');assert.equal(r.storage.get(SAVE_KEY),saved);
});
test('LAB interruption, remeasurement, rotation, hidden tab and normal URL guards integrate with existing input release',()=>{
  const r=lab();r.click('mobile-start');r.run('loop(1000);loop(2000);loop(2020)');r.pointer('right','pointerdown');r.pointer('aimPad','pointerdown',{pointerId:9});r.click('lab-open');assert.equal(r.run('mobilePlaytest.snapshot().status'),'INTERRUPTED');assert.equal(r.run('input.right||input.fire'),false);
  r.click('mobile-restart');r.run('loop(3000)');r.pointer('up','pointerdown');r.event('orientationchange');assert.equal(r.run('mobilePlaytest.snapshot().status'),'INTERRUPTED');assert.equal(r.run('input.up'),false);
  r.click('lab-open');r.click('mobile-start');r.run('loop(5000);document.hidden=true');r.event('visibilitychange');assert.equal(r.run('mobilePlaytest.snapshot().status'),'INTERRUPTED');assert.match(r.run('mobilePlaytest.snapshot().reason'),/非表示/);
  const normal=runtime(DEFAULT_SAVE);normal.click('mobile-start');normal.run('syncMobileUI()');assert.equal(normal.run('mobilePlaytest'),null);assert.equal(normal.get('mobileQAList').children.length,0);assert.equal(normal.get('mobileMeasureBadge').hidden,true);
});
test('text and JSON copy, manual Safari fallback, QA notes, and all temporary records leave normal save byte-identical',async()=>{
  const r=lab(),saved=r.storage.get(SAVE_KEY);r.input('mobileEnvironment','iPhone Safari（テスト入力）');r.input('mobileMemo','体感メモ');r.change('mobileQA-IP-03','NG');r.input('mobileNote-IP-03','FLYを確認中');assert.equal(r.run("mobileQA['IP-03'].note"),'FLYを確認中');assert.equal(r.get('mobileNote-IP-03').disabled,false);
  r.run("navigator.clipboard={writeText:async value=>{navigator.copied=value}};");await r.run("copyMobileResult('mobile-qa-copy')");assert.match(r.run('navigator.copied'),/IP-03.*NG.*FLY/);assert.equal(r.run("mobileQA['IP-01'].status"),'未確認');
  r.click('mobile-start');r.run('loop(1000);loop(2000);loop(2020)');r.click('lab-open');await r.run("copyMobileResult('mobile-copy')");assert.match(r.run('navigator.copied'),/中断あり/);assert.match(r.run('navigator.copied'),/体感メモ/);await r.run("copyMobileResult('mobile-json')");assert.equal(JSON.parse(r.run('navigator.copied')).current.normalProgressSaved,false);
  await r.run('copyLabReport()');assert.ok(JSON.parse(r.run('navigator.copied')).mobile.qa);r.run('navigator.clipboard=undefined');await r.run("copyMobileResult('mobile-copy')");assert.equal(r.get('mobileCopyBox').open,true);assert.match(r.get('mobileCopyStatus').textContent,/手動コピー/);assert.match(r.get('mobileCopyText').value,/観測RAF FPS/);
  r.click('lab-exit');assert.equal(r.storage.get(SAVE_KEY),saved);assert.equal(r.run('mobilePlaytest.history.length'),1);assert.equal(r.run("mobileQA['IP-01'].status"),'未確認');
});
test('current-scene measurement on all three checkpoint missions keeps ordinary QA conditions and excludes LAB operations',()=>{
  for(const id of ['M01','M02','M03']){const r=lab(),saved=r.storage.get(SAVE_KEY);r.get('labUIPreset').value='gameplay';r.click('lab-preset-apply');r.change('labStageMission',id);r.change('labStageArea','2');r.click('lab-stage-start');r.click('lab-open');r.click('mobile-start');
    assert.equal(r.run('mobilePlaytest.snapshot().metadata.missionId'),id);assert.equal(r.run('mobilePlaytest.snapshot().metadata.area'),3);assert.equal(r.run('game.lab.invincible'),false);assert.equal(r.run('game.density'),'STANDARD');assert.deepEqual(r.json('activeEquipment()'),['A-01','S-02']);assert.equal(r.storage.get(SAVE_KEY),saved);
  }
});
test('HTML preserves five tabs and shared weapon picker; mobile controls are accessible and 44px CSS targets',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');assert.equal((html.match(/id="labTab-/g)||[]).length,5);assert.match(html,/id="labWeaponList"/);assert.match(html,/30秒計測開始/);assert.match(html,/id="mobileCopyText" readonly/);assert.match(css,/#screenLab button, #screenLab select \{ min-height: 44px/);assert.match(css,/safe-area-inset-bottom/);
});
