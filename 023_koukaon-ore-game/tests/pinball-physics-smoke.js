const fs=require("fs");
const path=require("path");
const vm=require("vm");
const root=path.resolve(__dirname,"..");
const windowObject={devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
const context={window:windowObject,document:{hidden:false,addEventListener(){},removeEventListener(){}},performance:{now:()=>1000},requestAnimationFrame(){},setTimeout,clearTimeout,console,Math,Promise};
vm.runInNewContext(fs.readFileSync(path.join(root,"games/pinball/PinballTable.js"),"utf8"),context);
vm.runInNewContext(fs.readFileSync(path.join(root,"games/pinball/PinballGame.js"),"utf8"),context);
const played=[];const sound={play(id){played.push(id);return Promise.resolve();},unlock(){return Promise.resolve();},resetPlayStats(){},getPlayStats(){return{};}};
const drawingContext=new Proxy({setTransform(){}},{get(target,key){if(key==="createLinearGradient")return()=>({addColorStop(){}});if(!(key in target))target[key]=()=>{};return target[key];},set(target,key,value){target[key]=value;return true;}});
const canvas={width:0,height:0,parentElement:{},getContext(){return drawingContext;},getBoundingClientRect(){return{width:390,height:844,left:0,top:0};},addEventListener(){},removeEventListener(){},setPointerCapture(){}};
const controls={querySelector(){return null;},querySelectorAll(){return[];}};
let result=null;const game=new windowObject.PinballGame(canvas,sound,{},value=>{result=value;},{controlsRoot:controls,bestScore:500});game.resize();game.serveBall(true);
if(game.table.bumpers.length!==4||game.table.targets.length!==3||game.table.lanes.length!==3||game.table.slings.length!==2)throw Error("ORE MACHINE 01 objects are incomplete");
if(!game.launch(.8)||game.state!==windowObject.PinballGame.STATES.PLAYING||game.balls[0].vy>=-600||!played.includes("pinballLaunch"))throw Error("Plunger must launch with charge and sound");
const launchedBall=game.balls[0];let exitedLaunchLane=false;
for(let frame=0;frame<240&&launchedBall.active;frame+=1){game.update(1/120);if(!launchedBall.launchLane){exitedLaunchLane=true;break;}}
if(!exitedLaunchLane||launchedBall.y>game.table.top+30||launchedBall.vy<=0||launchedBall.x>game.width-70)throw Error(`Plunger ball must reach the top and exit into the playfield: ${JSON.stringify({exitedLaunchLane,x:launchedBall.x,y:launchedBall.y,vx:launchedBall.vx,vy:launchedBall.vy,top:game.table.top})}`);


let ball=game.createBall(180,400,20,0,"ACTIVE"),vy=ball.vy;game.stepBall(ball,.01);if(ball.vy<=vy)throw Error("Gravity must accelerate the ball downward");
ball=game.createBall(21,350,-220,0,"ACTIVE");const leftWall=game.table.walls.find(wall=>wall.id==="left");game.collideSegment(ball,leftWall.a,leftWall.b,3,.83,"wall:test","pinballWall");if(ball.vx<=0)throw Error("Wall collision must reflect the ball");
const wallSounds=played.filter(id=>id==="pinballWall").length;game.playCollision(ball,"wall:test","pinballWall",1);if(played.filter(id=>id==="pinballWall").length!==wallSounds)throw Error("Collision cooldown must prevent repeated wall sound");

const bumper=game.table.bumpers[0];ball=game.createBall(bumper.x+bumper.r+6,bumper.y,-180,0,"ACTIVE");game.collideBumper(ball,bumper);if(ball.vx<=300||game.stats.bumperHits!==1||!played.includes("pinballBumper"))throw Error("Bumper must strongly repel, score, and sound");
const left=game.flippers.left;left.angle=left.up;left.active=true;left.angularVelocity=-12;const end=game.flipperEnd(left);ball=game.createBall((left.pivot.x+end.x)/2,(left.pivot.y+end.y)/2-8,0,260,"ACTIVE");game.collideFlipper(ball,left,"left");if(ball.vy>=0)throw Error("Active flipper must add upward force");
game.flippers.left.angle=game.flippers.left.down;game.flippers.right.angle=game.flippers.right.down;game.flipperInput.left=true;game.flipperInput.right=true;const oldLeft=game.flippers.left.angle,oldRight=game.flippers.right.angle;game.updateFlippers(.02);if(game.flippers.left.angle===oldLeft||game.flippers.right.angle===oldRight)throw Error("Both flippers must update simultaneously");

game.balls=[game.createBall(180,400,80,-220,"ACTIVE")];game.state=windowObject.PinballGame.STATES.PLAYING;for(const target of game.table.targets){const targetBall=game.createBall(target.x+target.w/2,target.y+target.h/2,0,100,"ACTIVE");game.collideTarget(targetBall,target);}
if(game.stats.oreCompletes!==1||game.multiplier!==2||!game.multiballActive||game.balls.length!==3||!played.includes("pinballTargetComplete")||!played.includes("pinballMultiBall"))throw Error("ORE completion must raise multiplier and start three-ball multiball once");
const completed=game.stats.oreCompletes;game.collideTarget(game.createBall(game.table.targets[2].x,game.table.targets[2].y,0,100,"ACTIVE"),game.table.targets[2]);if(game.stats.oreCompletes!==completed)throw Error("Lit target must not complete ORE repeatedly");

const ballsBefore=game.ballsRemaining;game.balls=[game.createBall(180,400,0,-100,"ACTIVE"),game.createBall(180,900,0,100,"DRAINED")];game.balls[1].active=false;game.multiballActive=true;game.state=windowObject.PinballGame.STATES.MULTIBALL;game.update(.001);if(game.ballsRemaining!==ballsBefore||game.balls.length!==1||game.state!==windowObject.PinballGame.STATES.PLAYING)throw Error("Losing one multiball must not consume a BALL");
game.ballSave=3;game.balls=[];game.state=windowObject.PinballGame.STATES.PLAYING;game.handleAllDrained();if(game.ballsRemaining!==ballsBefore||game.state!==windowObject.PinballGame.STATES.PLUNGER||game.stats.ballSaves!==1)throw Error("BALL SAVE must re-serve without consuming a BALL");
game.ballSave=0;game.balls=[];game.state=windowObject.PinballGame.STATES.PLAYING;game.handleAllDrained();if(game.ballsRemaining!==ballsBefore-1||game.state!==windowObject.PinballGame.STATES.BALL_LOST)throw Error("All-ball drain must consume exactly one BALL");

game.multiballActive=true;game.jackpotReady=true;game.jackpot();game.jackpot();if(game.stats.jackpots!==1||played.filter(id=>id==="pinballJackpot").length!==1)throw Error("JACKPOT must fire once per ready state");
game.state=windowObject.PinballGame.STATES.PLAYING;game.pause(true);if(game.state!==windowObject.PinballGame.STATES.PAUSED)throw Error("Backgrounding must pause physics");game.resume();if(game.state!==windowObject.PinballGame.STATES.PLAYING)throw Error("Resume must restore the prior state");
if(game.toggleDebugSpeed()!==.5||game.toggleDebugSpeed()!==.25||game.toggleDebugSpeed()!==1)throw Error("Debug slow-motion cycle is wrong");
game.elapsed=10;game.totalOre=20;game.maxOrePerSecond=7;game.running=false;game.finished=false;game.finish();if(result.stats.oreDensity!==2||result.stats.maxOrePerSecond!==7)throw Error("Ore density result must be calculated");
console.log("Pinball physics passed: launch, gravity, collisions, simultaneous flippers, ORE multiball, ball save, drain, jackpot, pause, and density.");
