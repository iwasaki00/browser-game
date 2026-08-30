const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const windowObject = { devicePixelRatio:1, addEventListener(){}, removeEventListener(){} };
const context = {
  window:windowObject,
  document:{ hidden:false, addEventListener(){}, removeEventListener(){} },
  navigator:{ vibrate:null }, performance:{ now:()=>1000 }, requestAnimationFrame(){}, console, Math, Promise
};
vm.runInNewContext(fs.readFileSync(path.join(root, "games/fight/FightGame.js"), "utf8"), context);

const played=[];
const sound={ play(id){played.push(id);return Promise.resolve();}, unlock(){return Promise.resolve();}, resetPlayStats(){}, getPlayStats(){return{};} };
const drawingContext=new Proxy({}, { get(target,key){if(!(key in target))target[key]=()=>({addColorStop(){}});return target[key];}, set(target,key,value){target[key]=value;return true;} });
const canvas={ width:0,height:0,parentElement:{},getContext(){return drawingContext;},getBoundingClientRect(){return{width:390,height:844,left:0,top:0};} };
const controls={ querySelector(){return null;},querySelectorAll(){return[];} };
const game=new windowObject.FightGame(canvas,sound,{specialMoveName:"スーパー猫パンチ",fightEffect:"electric",fightDifficulty:"easy"},()=>{}, {controlsRoot:controls,bestScore:100});
game.resize();game.player=game.character("player",140,"#fff",1);game.cpu=game.character("cpu",190,"#f00",-1);game.state=windowObject.FightGame.STATES.FIGHTING;

if (!game.startAttack(game.player,"punch")) throw Error("Player punch should start");
game.updateCharacter(game.player,game.cpu,.1);
const hpAfterPunch=game.cpu.hp;
if (hpAfterPunch !== 93 || game.stats.punchHits !== 1 || !played.includes("fightPunchSwing") || !played.includes("fightHitLight")) throw Error("Punch must hit once and play swing/hit sounds");
game.updateCharacter(game.player,game.cpu,.03);
if (game.cpu.hp !== hpAfterPunch) throw Error("One attack must not hit twice");

game.resetCharacter(game.player,140,1);game.resetCharacter(game.cpu,190,-1);game.cpu.state="GUARD";game.cpu.guardHeld=true;
game.applyHit(game.player,game.cpu,{type:"kick",damage:12,guardDamage:28});
if (game.cpu.hp !== 98 || game.cpu.guard !== 72 || !played.includes("fightGuard")) throw Error("Guard must reduce damage and consume guard gauge");
game.cpu.guard=20;game.cpu.state="GUARD";game.applyHit(game.player,game.cpu,{type:"kick",damage:12,guardDamage:28});
if (game.cpu.state !== "GUARD_BREAK" || !played.includes("fightGuardBreak")) throw Error("Empty guard gauge must cause guard break");

game.resetCharacter(game.player,140,1);game.resetCharacter(game.cpu,260,-1);game.state=windowObject.FightGame.STATES.FIGHTING;game.player.special=100;
if (!game.startSpecial(game.player) || game.player.special !== 0 || game.specialBanner.text !== "スーパー猫パンチ!!") throw Error("Full gauge must start the named special move");
game.updateCharacter(game.player,game.cpu,.44);
if (game.projectiles.length) throw Error("Projectile must wait for the voice call");
game.updateCharacter(game.player,game.cpu,.02);
if (game.projectiles.length !== 1 || !played.includes("fightSpecialCall") || !played.includes("fightSpecialEffect")) throw Error("Special projectile must fire after about 0.45 seconds");

game.resetCharacter(game.player,140,1);game.resetCharacter(game.cpu,190,-1);game.cpu.hp=5;game.state=windowObject.FightGame.STATES.FIGHTING;
game.applyHit(game.player,game.cpu,{type:"punch",damage:7,guardDamage:16});
if (game.state !== windowObject.FightGame.STATES.KO || game.cpu.state !== "KO" || game.roundWinner !== "player") throw Error("Lethal hit must enter KO state once");
const timer=game.transitionTimer;game.endRound("cpu",true);
if (game.roundWinner !== "player" || game.transitionTimer !== timer) throw Error("KO must not be counted twice");

game.state=windowObject.FightGame.STATES.FIGHTING;game.pause(true);
if (game.state !== windowObject.FightGame.STATES.PAUSED) throw Error("Visibility pause must stop the match");
game.resume();
if (game.state !== windowObject.FightGame.STATES.FIGHTING) throw Error("Resume must restore the match state");

console.log("Fight logic passed: one-hit attacks, guard/break, named delayed special, KO guard, and pause/resume.");
