// Explains newly included legacy art-test failures without changing gameplay.
import {mkdirSync,writeFileSync} from 'node:fs';
import {versionRuntime} from '../tests/helpers/movement-comparison.mjs';
import {STUDY_FILES} from '../js/art-preview.js';
const differences=(a,b,p='')=>{
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return [{path:p,before:a,after:b}];
 return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],p+'.'+k));
};
const rows=[];
for(const version of ['A1','B','B1']){
 const r=versionRuntime(version,{recordDraw:true});r.click('test-lab');
 r.run('artPreview.basePack='+JSON.stringify(Object.fromEntries(Object.keys(STUDY_FILES).map(k=>[k,'study:'+k]))));
 r.run("artPreview.pack=artPreview.basePack;assetsReady=true;Object.keys(imageFiles).forEach(k=>images[k]='original:'+k);spawnEnemy('crawler',1400);shoot();game.player.hp=41;game.score=123;game.time=12");
 const before=r.json('game');await r.run("setArtStyle('STUDY_01')");const switched=r.json('game');r.drawCalls.length=0;r.run('setPreviewResolution(2);draw()');
 const n=versionRuntime(version),title=JSON.parse(n.storage.values().next().value);
 n.run("startMission('M01')");const deployed=JSON.parse(n.storage.values().next().value);
 n.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot();flushCampaign()");
 rows.push({version,styleSwitchDifferences:differences(before,switched),drawDifferences:differences(switched,r.json('game')),hud:r.drawCalls.filter(a=>a[0]==='fillText').slice(0,5),
  normalDeployDifferences:differences(title,deployed),normalShotDifferences:differences(deployed,JSON.parse(n.storage.values().next().value))});
}
mkdirSync('reports/movement-regression',{recursive:true});writeFileSync('reports/movement-regression/art-fixtures.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));
