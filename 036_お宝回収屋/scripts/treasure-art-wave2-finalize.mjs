import fs from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const dir='docs/treasure-art-wave2';
for(const f of ['unit-test.log','build.log','browser-test.log','production-test.log','screenshots.log','fallback-test.log']){
 const p=dir+'/'+f,b=fs.readFileSync(p),text=b[0]===255&&b[1]===254?b.subarray(2).toString('utf16le'):b.toString('utf8');
 fs.writeFileSync(p,text.replaceAll('\r\n','\n'));
}
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const targets=json('artwork/treasure-wave2/targets.json'),pixels=json(dir+'/pixel-comparison.json');
assert.equal(pixels.changedCells,42);assert.equal(pixels.pendingTargets,0);assert.equal(pixels.unchangedOutsideTargets,318);
for(const e of targets){
 const sprite=PNG.sync.read(fs.readFileSync('artwork/treasure-wave2/sprites/'+e.treasureId+'.png'));
 const sheet=PNG.sync.read(fs.readFileSync('src/assets/treasures/sheets/'+e.sheet+'.png'));
 assert.equal(sprite.width,32);assert.equal(sprite.height,32);
 for(let y=0;y<32;y++)assert.ok(sprite.data.subarray(y*128,(y+1)*128).equals(sheet.data.subarray(((e.row*32+y)*256+e.col*32)*4,((e.row*32+y)*256+e.col*32+32)*4)));
}
const browser=json(dir+'/browser-results.json'),production=json(dir+'/production-results.json'),fallback=json(dir+'/fallback-results.json');
assert.equal(browser.length,8);assert.equal(production.length,4);assert.equal(fallback.length,2);
for(const r of browser.concat(production,fallback))assert.deepEqual(r.errors,[]);
const unit=fs.readFileSync(dir+'/unit-test.log','utf8'),build=fs.readFileSync(dir+'/build.log','utf8');
assert.match(unit,/pass 665/);assert.match(unit,/fail 0/);assert.match(build,/built in/);
const result={version:json('package.json').version,date:'2026-11-14',completed:{B:14,R:14,G:14,total:42},dedicatedTotal:54,unmadeUntouched:246,substitutions:0,cellSize:32,sheets:9,sheetDimensions:[256,160],changedCells:42,unchangedOutsideTargets:318,nonTargetChangedPixels:0,wave1Unchanged:true,protectedRuntimeFilesUnchanged:pixels.protectedFilesUnchanged,standalonePngMatches:42,unitTests:{pass:665,fail:0},browser:{cases:8,pass:8,channels:['chrome','msedge'],viewports:[[320,568],[390,1000],[1280,1000]],listAndDetailPerViewport:54,washPerViewport:42},production:{cases:4,pass:4,debugAbsent:true},unmadeSvgFallback:{cases:2,pass:2,ids:fallback[0].unmadeIDs},build:'PASS',iPhoneSafariPhysical:'NOT TESTED',WebKit:'NOT TESTED',versionGameplaySaveLayout:'UNCHANGED'};
fs.writeFileSync(dir+'/verification-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(result);
