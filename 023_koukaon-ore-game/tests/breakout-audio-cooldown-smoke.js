const fs = require("fs");
const path = require("path");
const vm = require("vm");

let now = 100;
const FakeDate = { now:() => now };
class BaseSoundManager {
  constructor(config) {
    this.config=config; this.counts={}; this.loops=new Map(); this.master={};
    this.context={ state:"running", createBufferSource(){return{playbackRate:{value:1},connect(node){return node;},start(){}};}, createGain(){return{gain:{value:1},connect(node){return node;}};} };
  }
  async unlock(){return this.context;} async loadPack(){return true;} resetPlayStats(){this.counts={};}
  async play(id){this.counts[id]=(this.counts[id]||0)+1;return "fallback";} async startLoop(){return false;}
}
const windowObject={SoundManager:BaseSoundManager};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../js/sound-library-manager.js"),"utf8"),{window:windowObject,console,Map,Object,Math,Set,Date:FakeDate});
const sound=new windowObject.SoundManager({defaultGameId:"breakout",soundDefinitions:[],soundCatalog:{breakoutBlock:{minInterval:30}}});
sound.setAssetLibrary([{id:"voice",volume:1,playbackRate:1}],[{soundKey:"breakoutBlock",assetIds:["voice"],playMode:"fixed"}],"breakout");
sound.assetBuffers.set("voice",{});
(async()=>{
  if(await sound.play("breakoutBlock")!=="voice")throw Error("First collision sound must play");
  if(await sound.play("breakoutBlock")!==false)throw Error("Same-frame collision sound must be throttled");
  now=129;if(await sound.play("breakoutBlock")!==false)throw Error("Sound must remain throttled before minInterval");
  now=130;if(await sound.play("breakoutBlock")!=="voice")throw Error("Sound must play again at minInterval");
  if(sound.getAssetPlayStats().voice!==2)throw Error("Only audible collision sounds should be counted");
  console.log("Breakout audio cooldown passed: rapid collisions are bounded without collapsing the sound stream.");
})().catch(error=>{console.error(error);process.exitCode=1;});
