// Appended only by tools/final-polish-preview.mjs; explicit LAB QA controls.
const polishScenes=[['A','M01',0,'RANGER',50],['B','M01',0,'GUARDIAN',100],['C','M03',2,'WING',12],['D','M06',1,'SCOUT',0],['E','M07',3,'RANGER',0],['F','M08',4,'WING',0]];
const polishBar=document.createElement('aside');polishBar.style.cssText='position:fixed;z-index:100;top:0;left:90px;max-width:65vw;font:10px monospace;background:#052833;color:#eee';polishBar.innerHTML=polishScenes.map(([id])=>`<button data-polish-scene="${id}">比較${id}</button>`).join('')+'<button id="polishMeasure">現在場面30秒計測</button><output id="polishSceneStatus">LAB専用・比較は一時停止</output>';document.body.append(polishBar);
for(const b of polishBar.querySelectorAll('[data-polish-scene]'))b.onclick=async()=>{try{
 if(!DEBUG||!assetsReady)throw Error('debug=1・素材準備完了が必要');
 let [id,mission,area,playerClass,count]=polishScenes.find(s=>s[0]===b.dataset.polishScene);
 if(!game?.lab)startLab(true);else{show('play');openLabPanel()}
 let rng=12345;const oldRandom=Math.random;Math.random=()=>((rng=(rng*1664525+1013904223)>>>0)/4294967296);
 try{for(const [key,value]of [['labPreset',playerClass],['labStageMission',mission],['labStageArea',String(area)],['labValidation','C'],['labStageDensity','MASSIVE'],['labWeapon1','R-04'],['labFinalForm','3']])changeLabSetting({id:key,value});startLabCheckpoint(id==='F'?'M08':null);openLabPanel();
 if(count){clearLabEnemies();for(let i=0;i<count;i++)spawnEnemy(id==='C'?'skyray':'crawler',game.player.x+100+i%12*22,id==='C'?45+i%4*14:126);game.grid.rebuild(game.enemies)}
 show('play');for(let i=0;i<75;i++)update(1/60);game.time=10;game.areaTimer=0;game.lab.showFps=false;game.lab.cameraMode='FIXED';game.lab.fixedZoom=.5;game.lab.settings.shake=false;game.battleCamera.zoom=game.battleCamera.targetZoom=.5;game.battleCamera.x=followCameraForPolish(game.player.x);syncCameraView();
 // Deterministic visual fixtures only: no normal save, no collider/HP edits.
 for(let i=0;i<6;i++)game.enemyShots.push({x:game.player.x+50+i*25,y:100-i%3*13,vx:-40,vy:0,w:6,h:6,life:3,damage:1,kind:'orb'});
 for(let i=0;i<4;i++)pushEffect({kind:'explosion',x:game.player.x+45+i*45,y:120,life:.25,max:.45,r:30});
 if(id==='D'&&game.living.pulses[0])game.living.pulses[0].state='WARNING';
 // F keeps the real form-3 attack plan; do not fabricate an invalid boss action.
 }finally{Math.random=oldRandom}
 await artPreview.select('UNIFIED_01');beginArtComparison();document.querySelector('#polishSceneStatus').textContent=`${VERSION} / ${id} ${mission} ${playerClass} / ${game.liveEnemies}敵 / .50 / 320 / PAUSED`;
 }catch(e){document.querySelector('#polishSceneStatus').textContent='QA ERROR '+e.message}};
function followCameraForPolish(x){return Math.max(0,Math.min(game.world.width-640,x-200))}
document.querySelector('#polishMeasure').onclick=()=>{if(!game?.lab)return;show('play');openLabPanel();acceptanceSeconds=30;acceptanceTestId='IP-10';acceptanceHud=true;document.querySelector('#acceptanceHudToggle').checked=true;startAcceptance()};
