const fs=require("fs");
const path=require("path");
const vm=require("vm");
const root=path.resolve(__dirname,"..");
const windowObject={};
const context={window:windowObject,console,Object};
for(const file of ["js/config.js","js/race-config.js","js/rhythm-config.js","js/breakout-config.js","js/fight-config.js","js/pinball-config.js"])vm.runInNewContext(fs.readFileSync(path.join(root,file),"utf8"),context);
const definition=windowObject.ORE_CONFIG.gameDefinitions.pinball;
if(!definition?.playable||definition.order!==8||definition.sounds.length!==18)throw Error("Pinball must be the eighth playable game with 18 sounds");
for(const id of ["pinballLaunch","pinballFlipper","pinballWall","pinballBumper","pinballSlingshot","pinballTarget","pinballTargetComplete","pinballLane","pinballBell","pinballBonus","pinballMultiplier","pinballMultiBall","pinballExtraBall","pinballJackpot","pinballDrain","pinballBallSave","pinballWarning","pinballGameOver"])if(!windowObject.ORE_CONFIG.soundCatalog[id])throw Error(`Missing pinball sound ${id}`);
for(const id of ["pinballFlipper","pinballWall","pinballBumper","pinballTarget"])if(!windowObject.ORE_CONFIG.soundCatalog[id].minInterval)throw Error(`${id} needs rapid-play protection`);
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),app=fs.readFileSync(path.join(root,"js/app.js"),"utf8"),css=fs.readFileSync(path.join(root,"css/pinball.css"),"utf8");
for(const token of ["pinball-config.js","PinballTable.js","PinballGame.js","pinballSoundTests","pinballChallengeHints","pinballControls","pinballResumeButton","pinballResultStats","pinballResultActions","pinballDebugTools"])if(!html.includes(token))throw Error(`Pinball HTML integration missing ${token}`);
for(const token of ['registerGame("pinball"',"pinballBestScore","runPinballRushTest","runPinballMultiTest",'classList.toggle("is-pinball"',"renderPinballDebugTools"])if(!app.includes(token))throw Error(`Pinball app integration missing ${token}`);
if(!css.includes("safe-area-inset-bottom")||!css.includes("touch-action:none"))throw Error("Pinball iPhone controls need safe area and touch isolation");
const regions={pinballSoundTests:[html.indexOf('id="testScreen"'),html.indexOf('id="libraryScreen"')],pinballChallengeHints:[html.indexOf('id="packsScreen"'),html.indexOf('id="gameScreen"')],pinballControls:[html.indexOf('id="gameScreen"'),html.indexOf('id="resultScreen"')],pinballResultActions:[html.indexOf('id="resultScreen"'),html.indexOf('id="settingsScreen"')]};
for(const[id,[start,end]]of Object.entries(regions)){const position=html.indexOf(`id="${id}"`);if(position<start||position>end)throw Error(`${id} is outside its parent screen`);}
console.log("Pinball static passed: 18 sounds, playable registration, test UI, controls, result, challenges, and debug tools.");
