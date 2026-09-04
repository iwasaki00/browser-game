(function () {
  "use strict";
  const STATES=Object.freeze({READY:"READY",PLUNGER:"PLUNGER",PLAYING:"PLAYING",BALL_LOST:"BALL_LOST",MULTIBALL:"MULTIBALL",PAUSED:"PAUSED",GAME_OVER:"GAME_OVER"});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const closestPoint=(point,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy||1,t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length,0,1);return{x:a.x+dx*t,y:a.y+dy*t,t};};
  const circleRect=(ball,rect)=>{const x=clamp(ball.x,rect.x,rect.x+rect.w),y=clamp(ball.y,rect.y,rect.y+rect.h),dx=ball.x-x,dy=ball.y-y;return{hit:dx*dx+dy*dy<=ball.r*ball.r,x,y,dx,dy};};

  class PinballGame {
    constructor(canvas,sound,settings,onEnd,options={}) {
      this.canvas=canvas;this.ctx=canvas.getContext("2d");this.sound=sound;this.settings=settings;this.onEnd=onEnd;
      this.controlsRoot=options.controlsRoot||canvas.parentElement||document;this.bestScore=options.bestScore||0;
      this.resumeButton=this.controlsRoot.querySelector?.("#pinballResumeButton")||null;
      this.running=false;this.finished=false;this.state=STATES.READY;this.beforePause=STATES.PLUNGER;this.cleanup=[];this.boundLoop=time=>this.loop(time);
      this.score=0;this.ballNumber=1;this.ballsRemaining=3;this.multiplier=1;this.elapsed=0;this.fps=60;this.last=0;this.physicsSteps=1;this.timeScale=1;
      this.balls=[];this.particles=[];this.trails=[];this.oreLit=new Set();this.lanesLit=new Set();this.targetReset=0;this.ballSave=0;this.plungerCharge=.45;this.plungerPointer=null;
      this.flipperInput={left:false,right:false};this.pointerSides=new Map();this.nudgeTimes=[];this.tiltTimer=0;this.warningCooldown=0;this.shake=0;this.flash=0;
      this.multiballActive=false;this.jackpotReady=false;this.debugHitboxes=false;this.banner={text:"",sub:"",timer:0};
      this.soundTimes=[];this.totalOre=0;this.maxOrePerSecond=0;
      this.stats={jackpots:0,maxMultiball:1,bumperHits:0,targetHits:0,oreCompletes:0,extraBalls:0,drains:0,ballSaves:0,multiballs:0,bellHits:0,flips:0,nudges:0};
    }

    start(){this.sound.resetPlayStats();this.resize();this.bind();this.serveBall(true);this.running=true;this.last=performance.now();requestAnimationFrame(this.boundLoop);}
    stop(){this.running=false;this.finished=true;this.cleanup.splice(0).forEach(remove=>remove());this.flipperInput.left=this.flipperInput.right=false;if(this.resumeButton)this.resumeButton.hidden=true;}
    resize(){
      const rect=this.canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(rect.width*ratio));this.canvas.height=Math.max(1,Math.round(rect.height*ratio));this.ctx.setTransform(ratio,0,0,ratio,0,0);
      this.width=Math.max(300,rect.width);this.height=Math.max(560,rect.height);this.table=window.PinballTable.create(this.width,this.height);
      const previous=this.flippers||{};this.flippers={};for(const side of ["left","right"]){const data=this.table.flippers[side];this.flippers[side]={...data,angle:previous[side]?.angle??data.down,angularVelocity:0,active:false};}
      for(const ball of this.balls){ball.x=clamp(ball.x,25,this.width-25);ball.y=clamp(ball.y,this.table.top+10,this.table.bottom+40);}
    }

    bind(){
      const press=(side,active)=>{if(this.tiltTimer>0)return;if(this.flipperInput[side]===active)return;this.flipperInput[side]=active;if(active){this.stats.flips+=1;this.play("pinballFlipper");}};
      this.controlsRoot.querySelectorAll?.("[data-pinball-control]").forEach(button=>{
        const action=button.dataset.pinballControl;
        const down=event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);if(action==="left"||action==="right")press(action,true);else if(action==="launch")this.launch(.78);else if(action==="nudge")this.nudge();button.classList.add("is-pressed");};
        const up=event=>{event.preventDefault();if(action==="left"||action==="right")press(action,false);button.classList.remove("is-pressed");};
        button.addEventListener("pointerdown",down);button.addEventListener("pointerup",up);button.addEventListener("pointercancel",up);button.addEventListener("lostpointercapture",up);
        this.cleanup.push(()=>{button.removeEventListener("pointerdown",down);button.removeEventListener("pointerup",up);button.removeEventListener("pointercancel",up);button.removeEventListener("lostpointercapture",up);});
      });
      const local=event=>{const rect=this.canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};};
      const down=event=>{event.preventDefault();const p=local(event);this.canvas.setPointerCapture?.(event.pointerId);
        if(this.state===STATES.PLUNGER&&p.x>this.width-82){this.plungerPointer={id:event.pointerId,startY:p.y};return;}
        if(p.y>this.height*.58){const side=p.x<this.width/2?"left":"right";this.pointerSides.set(event.pointerId,side);press(side,true);}
      };
      const move=event=>{if(!this.plungerPointer||this.plungerPointer.id!==event.pointerId)return;event.preventDefault();this.plungerCharge=clamp(.2+(local(event).y-this.plungerPointer.startY)/125,.2,1);};
      const up=event=>{event.preventDefault();if(this.plungerPointer?.id===event.pointerId){this.launch(this.plungerCharge);this.plungerPointer=null;}const side=this.pointerSides.get(event.pointerId);if(side){this.pointerSides.delete(event.pointerId);if(![...this.pointerSides.values()].includes(side))press(side,false);}};
      this.canvas.addEventListener("pointerdown",down);this.canvas.addEventListener("pointermove",move);this.canvas.addEventListener("pointerup",up);this.canvas.addEventListener("pointercancel",up);
      const keydown=event=>{let handled=true;if(["KeyZ","ArrowLeft"].includes(event.code))press("left",true);else if(["Slash","ArrowRight"].includes(event.code))press("right",true);else if(event.code==="Space")this.launch(.78);else if(event.code==="KeyN")this.nudge();else if(event.code==="KeyP")this.togglePause();else handled=false;if(handled)event.preventDefault();};
      const keyup=event=>{if(["KeyZ","ArrowLeft"].includes(event.code)){event.preventDefault();press("left",false);}if(["Slash","ArrowRight"].includes(event.code)){event.preventDefault();press("right",false);}};
      const visibility=()=>{if(document.hidden&&[STATES.PLUNGER,STATES.PLAYING,STATES.MULTIBALL].includes(this.state))this.pause(true);};
      const resume=event=>{event.preventDefault();this.resume();};
      window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);document.addEventListener("visibilitychange",visibility);this.resumeButton?.addEventListener("click",resume);
      this.cleanup.push(()=>{this.canvas.removeEventListener("pointerdown",down);this.canvas.removeEventListener("pointermove",move);this.canvas.removeEventListener("pointerup",up);this.canvas.removeEventListener("pointercancel",up);window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);document.removeEventListener("visibilitychange",visibility);this.resumeButton?.removeEventListener("click",resume);});
    }

    createBall(x=this.width-36,y=this.table.bottom-40,vx=0,vy=0,state="PLUNGER"){return{id:`ball-${Date.now()}-${Math.random()}`,x,y,vx,vy,r:7,state,active:true,launchLane:state==="PLUNGER",still:0,cooldowns:{},trail:[]};}
    serveBall(initial=false){this.balls=[this.createBall()];this.state=STATES.PLUNGER;this.ballSave=0;this.plungerCharge=.45;this.multiballActive=false;this.jackpotReady=false;this.banner={text:initial?"PINBALL":"BALL READY",sub:`BALL ${this.ballNumber}`,timer:1.4};}
    launch(charge=.65){const ball=this.balls.find(entry=>entry.state==="PLUNGER");if(this.state!==STATES.PLUNGER||!ball)return false;const power=clamp(charge,.2,1);ball.state="ACTIVE";ball.launchLane=true;ball.x=this.width-36;ball.vx=0;ball.vy=-(720+power*180);this.state=STATES.PLAYING;this.ballSave=5;this.banner={text:`BALL ${this.ballNumber}`,sub:"BALL SAVE 5 SEC",timer:1};this.play("pinballLaunch");return true;}
    pause(automatic=false){if(this.state===STATES.PAUSED||this.state===STATES.GAME_OVER)return;this.beforePause=this.state;this.state=STATES.PAUSED;this.autoPaused=automatic;this.flipperInput.left=this.flipperInput.right=false;this.pointerSides.clear();this.plungerPointer=null;if(this.resumeButton)this.resumeButton.hidden=false;}
    resume(){if(this.state!==STATES.PAUSED)return;Promise.resolve(this.sound.unlock?.()).catch(()=>{});this.state=this.beforePause||STATES.PLUNGER;this.last=performance.now();this.autoPaused=false;if(this.resumeButton)this.resumeButton.hidden=true;}
    togglePause(){if(this.state===STATES.PAUSED)this.resume();else this.pause(false);}
    play(id){const playedAt=this.elapsed;Promise.resolve(this.sound.play(id)).then(result=>{if(result===false)return;this.totalOre+=1;this.soundTimes.push(playedAt);while(this.soundTimes.length&&this.soundTimes[0]<playedAt-1)this.soundTimes.shift();this.maxOrePerSecond=Math.max(this.maxOrePerSecond,this.soundTimes.length);}).catch(()=>{});}
    playCollision(ball,key,sound,interval=.075){const last=ball.cooldowns[key]??-99;if(this.elapsed-last<interval)return false;ball.cooldowns[key]=this.elapsed;this.play(sound);return true;}
    addScore(points){this.score+=Math.round(points*this.multiplier);}

    loop(time){if(!this.running)return;const raw=Math.min(.04,Math.max(0,(time-this.last)/1000));this.last=time;this.fps+=(1/Math.max(.001,raw)-this.fps)*.08;if(this.state!==STATES.PAUSED)this.update(raw*this.timeScale);this.draw();requestAnimationFrame(this.boundLoop);}
    update(dt){
      this.elapsed+=dt;this.shake=Math.max(0,this.shake-dt);this.flash=Math.max(0,this.flash-dt);this.banner.timer=Math.max(0,this.banner.timer-dt);this.warningCooldown=Math.max(0,this.warningCooldown-dt);this.tiltTimer=Math.max(0,this.tiltTimer-dt);this.targetReset=Math.max(0,this.targetReset-dt);this.updateParticles(dt);this.updateFlippers(dt);
      if(this.targetReset===0&&this.oreLit.size===3)this.oreLit.clear();
      if(this.state===STATES.BALL_LOST){this.ballLostTimer-=dt;if(this.ballLostTimer<=0)this.serveBall(false);return;}
      if(![STATES.PLAYING,STATES.MULTIBALL].includes(this.state))return;
      this.ballSave=Math.max(0,this.ballSave-dt);
      const active=this.balls.filter(ball=>ball.active&&ball.state==="ACTIVE"),maxSpeed=active.reduce((max,ball)=>Math.max(max,Math.hypot(ball.vx,ball.vy)),0);
      this.physicsSteps=clamp(Math.ceil(maxSpeed*dt/5),1,8);const stepDt=dt/this.physicsSteps;
      for(let step=0;step<this.physicsSteps;step+=1)for(const ball of active)if(ball.active)this.stepBall(ball,stepDt);
      this.balls=this.balls.filter(ball=>ball.active);
      if(this.multiballActive&&this.balls.length===1){this.multiballActive=false;this.jackpotReady=false;this.state=STATES.PLAYING;this.banner={text:"MULTIBALL END",sub:"LAST BALL",timer:1};}
      if(!this.balls.length)this.handleAllDrained();
      if(this.balls.some(ball=>ball.y>this.table.bottom-100)&&this.warningCooldown<=0){this.warningCooldown=2.2;this.play("pinballWarning");}
    }
    updateFlippers(dt){for(const side of ["left","right"]){const flipper=this.flippers[side],active=this.flipperInput[side]&&this.tiltTimer<=0,target=active?flipper.up:flipper.down,previous=flipper.angle;flipper.angle+=(target-flipper.angle)*Math.min(1,dt*(active?24:14));flipper.angularVelocity=(flipper.angle-previous)/Math.max(.001,dt);flipper.active=active;}}

    stepBall(ball,dt){
      if(ball.state!=="ACTIVE")return;ball.vy+=245*dt;ball.vx*=Math.pow(.996,dt*60);ball.vy*=Math.pow(.998,dt*60);ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
      if(ball.launchLane&&ball.x>this.width-70&&ball.y<this.table.top+24){ball.launchLane=false;ball.x=this.width-72;ball.vx=-190;ball.vy=Math.max(120,Math.abs(ball.vy)*.38);this.playCollision(ball,"lane-exit","pinballLane",.2);}
      for(const wall of this.table.walls)if(!ball.launchLane||wall.id==="right"||wall.id==="plungerRail")this.collideSegment(ball,wall.a,wall.b,3,.83,"wall:"+wall.id,"pinballWall");
      if(!ball.launchLane){
        for(const bumper of this.table.bumpers)this.collideBumper(ball,bumper);
        for(const sling of this.table.slings)if(this.collideSegment(ball,sling.a,sling.b,10,.95,"sling:"+sling.id,"pinballSlingshot")){ball.vx+=sling.push*170;ball.vy-=135;this.capSpeed(ball);}
        for(const target of this.table.targets)this.collideTarget(ball,target);
        this.collideBell(ball,this.table.bell);
        for(const lane of this.table.lanes)if(ball.x>lane.x&&ball.x<lane.x+lane.w&&ball.y>lane.y&&ball.y<lane.y+lane.h&&this.playCollision(ball,"lane:"+lane.id,"pinballLane",.35)){this.lanesLit.add(lane.id);this.addScore(250);if(this.lanesLit.size===3){this.lanesLit.clear();this.increaseMultiplier();this.bonus("ALL LANES",2500);}}
        for(const side of ["left","right"])this.collideFlipper(ball,this.flippers[side],side);
      }
      const speed=Math.hypot(ball.vx,ball.vy);this.capSpeed(ball);if(speed<42&&ball.y<this.table.bottom-70){ball.still+=dt;if(ball.still>1.8){ball.vx+=(Math.random()-.5)*95;ball.vy-=80;ball.still=0;}}else ball.still=0;
      ball.trail.push({x:ball.x,y:ball.y,life:.8});while(ball.trail.length>48)ball.trail.shift();for(const point of ball.trail)point.life-=dt;ball.trail=ball.trail.filter(point=>point.life>0);
      if(ball.y-ball.r>this.table.bottom+35){ball.active=false;ball.state="DRAINED";this.stats.drains+=1;this.play("pinballDrain");}
    }

    collideSegment(ball,a,b,thickness,restitution,key,sound){
      const point=closestPoint(ball,a,b),dx=ball.x-point.x,dy=ball.y-point.y,distance=Math.hypot(dx,dy),limit=ball.r+thickness;if(distance>=limit)return false;
      let nx=distance?dx/distance:-(b.y-a.y),ny=distance?dy/distance:b.x-a.x;if(!distance){const length=Math.hypot(nx,ny)||1;nx/=length;ny/=length;}
      ball.x+=nx*(limit-distance+.15);ball.y+=ny*(limit-distance+.15);const approach=ball.vx*nx+ball.vy*ny;if(approach<0){ball.vx-=(1+restitution)*approach*nx;ball.vy-=(1+restitution)*approach*ny;this.addScore(10);if(sound)this.playCollision(ball,key,sound);return true;}return false;
    }
    collideBumper(ball,bumper){const dx=ball.x-bumper.x,dy=ball.y-bumper.y,distance=Math.hypot(dx,dy),limit=ball.r+bumper.r;if(distance>=limit)return;const nx=distance?dx/distance:1,ny=distance?dy/distance:-1;ball.x=bumper.x+nx*(limit+.3);ball.y=bumper.y+ny*(limit+.3);const speed=Math.max(360,Math.hypot(ball.vx,ball.vy)*1.08);ball.vx=nx*speed;ball.vy=ny*speed;bumper.flash=.16;this.stats.bumperHits+=1;this.addScore(100);this.playCollision(ball,"bumper:"+bumper.id,"pinballBumper",.07);this.spawnParticles(bumper.x,bumper.y,"#ffe45d",7);if(this.stats.bumperHits%10===0)this.bonus("BUMPER BONUS",3000);this.capSpeed(ball);}
    reflectRect(ball,rect,restitution=.85){const hit=circleRect(ball,rect);if(!hit.hit)return false;let nx=hit.dx,ny=hit.dy,distance=Math.hypot(nx,ny),penetration;if(!distance){const edge=[{d:Math.abs(ball.x-rect.x),x:-1,y:0},{d:Math.abs(ball.x-(rect.x+rect.w)),x:1,y:0},{d:Math.abs(ball.y-rect.y),x:0,y:-1},{d:Math.abs(ball.y-(rect.y+rect.h)),x:0,y:1}].sort((a,b)=>a.d-b.d)[0];nx=edge.x;ny=edge.y;penetration=ball.r+edge.d;}else{nx/=distance;ny/=distance;penetration=ball.r-distance;}ball.x+=nx*(penetration+.2);ball.y+=ny*(penetration+.2);const approach=ball.vx*nx+ball.vy*ny;if(approach<0){ball.vx-=(1+restitution)*approach*nx;ball.vy-=(1+restitution)*approach*ny;}return true;}
    collideTarget(ball,target){if(!this.reflectRect(ball,target,.88)||this.oreLit.has(target.id))return;if(!this.playCollision(ball,"target:"+target.id,"pinballTarget",.18))return;const before=this.oreLit.size;this.stats.targetHits+=1;this.addScore(500);this.oreLit.add(target.id);this.spawnParticles(target.x+target.w/2,target.y+target.h/2,"#48e9e1",6);if(this.multiballActive)this.jackpotReady=true;if(before<3&&this.oreLit.size===3)this.completeORE();}
    collideBell(ball,bell){if(!this.reflectRect(ball,bell,.92))return;if(!this.playCollision(ball,"bell","pinballBell",.28))return;this.stats.bellHits+=1;this.addScore(1000);this.spawnParticles(bell.x+bell.w/2,bell.y+bell.h/2,"#ffe45d",9);if(this.multiballActive&&this.jackpotReady)this.jackpot();}
    flipperEnd(flipper){return{x:flipper.pivot.x+Math.cos(flipper.angle)*flipper.length,y:flipper.pivot.y+Math.sin(flipper.angle)*flipper.length};}
    collideFlipper(ball,flipper,side){const end=this.flipperEnd(flipper);if(!this.collideSegment(ball,flipper.pivot,end,9,.78,"flipper:"+side,null))return;const strength=flipper.active?260+Math.min(180,Math.abs(flipper.angularVelocity)*38):75;ball.vy-=strength;ball.vx+=(side==="left"?1:-1)*(flipper.active?85:25);this.capSpeed(ball);}
    capSpeed(ball){const speed=Math.hypot(ball.vx,ball.vy),limit=ball.launchLane?900:680;if(speed>limit){ball.vx*=limit/speed;ball.vy*=limit/speed;}}

    completeORE(){this.stats.oreCompletes+=1;this.targetReset=4;this.addScore(3000);this.play("pinballTargetComplete");this.increaseMultiplier();this.banner={text:"ORE COMPLETE!",sub:`MULTI ×${this.multiplier}`,timer:1.4};this.flash=.22;this.spawnParticles(this.width/2,this.table.top+150,"#ff3b68",20);if(!this.multiballActive)this.startMultiball();else this.jackpotReady=true;if(this.stats.oreCompletes%2===0){this.ballsRemaining+=1;this.stats.extraBalls+=1;this.play("pinballExtraBall");}}
    increaseMultiplier(){if(this.multiplier>=5)return;this.multiplier+=1;this.play("pinballMultiplier");}
    bonus(label,points){this.addScore(points);this.play("pinballBonus");this.banner={text:label,sub:`+${points*this.multiplier}`,timer:1};}
    startMultiball(){const source=this.balls.find(ball=>ball.active);if(!source)return;for(const offset of [-.42,.42])if(this.balls.length<3)this.balls.push(this.createBall(source.x,source.y,source.vx+Math.sin(offset)*220,-Math.abs(source.vy||320),"ACTIVE"));this.multiballActive=true;this.jackpotReady=true;this.state=STATES.MULTIBALL;this.stats.multiballs+=1;this.stats.maxMultiball=Math.max(this.stats.maxMultiball,this.balls.length);this.play("pinballMultiBall");this.banner={text:"MULTIBALL!",sub:"HIT THE BELL",timer:1.7};this.flash=.3;}
    jackpot(){if(!this.jackpotReady)return;this.jackpotReady=false;const points=25000;this.addScore(points);this.stats.jackpots+=1;this.play("pinballJackpot");this.banner={text:"JACKPOT!",sub:`+${points*this.multiplier}`,timer:1.8};this.shake=.28;this.flash=.35;this.spawnParticles(this.width/2,this.height*.42,"#ffe45d",28);}
    handleAllDrained(){if(this.state===STATES.BALL_LOST||this.state===STATES.GAME_OVER)return;if(this.ballSave>0){this.stats.ballSaves+=1;this.play("pinballBallSave");this.banner={text:"BALL SAVE",sub:"TRY AGAIN",timer:1.2};this.balls=[this.createBall()];this.state=STATES.PLUNGER;this.ballSave=0;return;}this.ballsRemaining-=1;if(this.ballsRemaining<=0){this.gameOver();return;}this.ballNumber+=1;this.multiplier=1;this.oreLit.clear();this.lanesLit.clear();this.multiballActive=false;this.state=STATES.BALL_LOST;this.ballLostTimer=1.15;this.banner={text:"BALL LOST",sub:`BALL ${this.ballNumber} READY`,timer:1.1};}
    gameOver(){if(this.finished||this.state===STATES.GAME_OVER)return;this.state=STATES.GAME_OVER;this.running=false;this.play("pinballGameOver");setTimeout(()=>this.finish(),700);}
    finish(){if(this.finished)return;this.finished=true;const duration=Math.max(.1,this.elapsed),oreDensity=this.totalOre/duration;this.onEnd({mode:"pinball",clear:false,score:this.score,counts:this.sound.getPlayStats(),stats:{...this.stats,totalOre:this.totalOre,maxOrePerSecond:this.maxOrePerSecond,oreDensity,duration,multiplier:this.multiplier}});}
    nudge(){if(![STATES.PLAYING,STATES.MULTIBALL].includes(this.state))return;const now=this.elapsed;this.nudgeTimes=this.nudgeTimes.filter(time=>time>now-2);this.nudgeTimes.push(now);this.stats.nudges+=1;const direction=this.stats.nudges%2?1:-1;for(const ball of this.balls)ball.vx+=direction*105;this.shake=.1;if(this.nudgeTimes.length>=3){this.tiltTimer=2.2;this.flipperInput.left=this.flipperInput.right=false;this.banner={text:"TILT!",sub:"FLIPPERS LOCKED",timer:1.2};this.play("pinballWarning");}}
    toggleDebugSpeed(){this.timeScale=this.timeScale===1?.5:this.timeScale===.5?.25:1;return this.timeScale;}
    debugMultiball(){if([STATES.PLAYING,STATES.MULTIBALL].includes(this.state))this.startMultiball();}
    spawnParticles(x,y,color,count){for(let i=0;i<count;i+=1)this.particles.push({x,y,vx:(Math.random()-.5)*230,vy:(Math.random()-.5)*210,life:.3+Math.random()*.55,size:2+Math.random()*4,color});if(this.particles.length>120)this.particles.splice(0,this.particles.length-120);}
    updateParticles(dt){for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;}this.particles=this.particles.filter(p=>p.life>0);for(const bumper of this.table?.bumpers||[])bumper.flash=Math.max(0,(bumper.flash||0)-dt);}

    getHudState(){return{mode:"pinball",score:this.score,best:this.bestScore,balls:this.ballsRemaining,multiplier:this.multiplier};}
    getDebugState(){return{game:"pinball",playerState:this.state,fps:Math.round(this.fps),balls:this.balls.length,ballPositions:this.balls.map(ball=>`${Math.round(ball.x)},${Math.round(ball.y)}`).join(" | ")||"--",ballSpeeds:this.balls.map(ball=>Math.round(Math.hypot(ball.vx,ball.vy))).join(" | ")||"--",flippers:`${this.flippers.left.angle.toFixed(2)} / ${this.flippers.right.angle.toFixed(2)}`,currentBall:this.ballNumber,multiplier:this.multiplier,ore:["O","R","E"].map(id=>this.oreLit.has(id)?id:"-").join(""),ballSave:this.ballSave.toFixed(1),multiball:this.multiballActive,jackpot:this.jackpotReady,substeps:this.physicsSteps,timeScale:this.timeScale,totalOre:this.totalOre,maxOre:this.maxOrePerSecond};}

    draw(){const ctx=this.ctx,w=this.width,h=this.height;ctx.save();ctx.clearRect(0,0,w,h);if(this.shake>0)ctx.translate((Math.random()-.5)*7,(Math.random()-.5)*7);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#161137");bg.addColorStop(1,"#060913");ctx.fillStyle=bg;ctx.fillRect(-8,-8,w+16,h+16);this.drawTable(ctx);this.drawObjects(ctx);this.drawBalls(ctx);this.drawParticles(ctx);this.drawHud(ctx);this.drawBanner(ctx);if(this.debugHitboxes)this.drawDebug(ctx);if(this.flash>0){ctx.fillStyle=`rgba(255,255,255,${Math.min(.42,this.flash)})`;ctx.fillRect(0,0,w,h);}ctx.restore();if(this.resumeButton)this.resumeButton.hidden=this.state!==STATES.PAUSED;}
    drawTable(ctx){ctx.strokeStyle="#48e9e1";ctx.lineWidth=5;ctx.shadowBlur=10;ctx.shadowColor="#48e9e1";for(const wall of this.table.walls){ctx.beginPath();ctx.moveTo(wall.a.x,wall.a.y);ctx.lineTo(wall.b.x,wall.b.y);ctx.stroke();}ctx.shadowBlur=0;ctx.fillStyle="rgba(72,233,225,.05)";ctx.fillRect(20,this.table.top,this.width-40,this.table.bottom-this.table.top);ctx.fillStyle="#99a3bb";ctx.font="900 10px sans-serif";ctx.textAlign="center";ctx.fillText(this.table.name,this.width/2,this.table.top+48);}
    drawObjects(ctx){
      for(const lane of this.table.lanes){ctx.fillStyle=this.lanesLit.has(lane.id)?"#ffe45d":"rgba(255,228,93,.16)";ctx.fillRect(lane.x,lane.y,lane.w,lane.h);}
      for(const bumper of this.table.bumpers){const scale=1+(bumper.flash||0)*1.8;ctx.save();ctx.translate(bumper.x,bumper.y);ctx.scale(scale,scale);ctx.fillStyle="#ff3b68";ctx.shadowBlur=bumper.flash?24:9;ctx.shadowColor="#ff3b68";ctx.beginPath();ctx.arc(0,0,bumper.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffe45d";ctx.beginPath();ctx.arc(0,0,bumper.r*.48,0,Math.PI*2);ctx.fill();ctx.restore();}
      for(const target of this.table.targets){ctx.fillStyle=this.oreLit.has(target.id)?"#ffe45d":"#29324a";ctx.fillRect(target.x,target.y,target.w,target.h);ctx.fillStyle=this.oreLit.has(target.id)?"#080b14":"#f5f7ff";ctx.font="900 13px sans-serif";ctx.textAlign="center";ctx.fillText(target.letter,target.x+target.w/2,target.y+28);}
      const bell=this.table.bell;ctx.fillStyle="#ffe45d";ctx.beginPath();ctx.arc(bell.x+bell.w/2,bell.y+bell.h*.4,bell.w*.48,Math.PI,0);ctx.lineTo(bell.x+bell.w,bell.y+bell.h);ctx.lineTo(bell.x,bell.y+bell.h);ctx.closePath();ctx.fill();ctx.fillStyle="#080b14";ctx.font="900 7px sans-serif";ctx.fillText("BELL",bell.x+bell.w/2,bell.y+bell.h-8);
      ctx.strokeStyle="#ff7c45";ctx.lineWidth=12;for(const sling of this.table.slings){ctx.beginPath();ctx.moveTo(sling.a.x,sling.a.y);ctx.lineTo(sling.b.x,sling.b.y);ctx.stroke();}
      for(const side of ["left","right"]){const flipper=this.flippers[side],end=this.flipperEnd(flipper);ctx.strokeStyle=flipper.active?"#ffe45d":"#f5f7ff";ctx.lineWidth=18;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(flipper.pivot.x,flipper.pivot.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.lineCap="butt";}
      const plunger=this.table.plunger;ctx.strokeStyle="#99a3bb";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(plunger.x,plunger.y);for(let y=plunger.y;y<plunger.y+plunger.h;y+=10){ctx.lineTo(plunger.x+(y%20?plunger.w:0),y);}ctx.stroke();ctx.fillStyle="#ff3b68";ctx.fillRect(plunger.x,plunger.y+plunger.h*(1-this.plungerCharge),plunger.w,6);
    }
    drawBalls(ctx){for(const ball of this.balls){ctx.fillStyle="#f5f7ff";ctx.shadowBlur=12;ctx.shadowColor="#fff";ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
    drawParticles(ctx){for(const p of this.particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;}
    drawHud(ctx){ctx.fillStyle="rgba(3,5,10,.78)";ctx.fillRect(24,this.table.top+54,this.width-48,34);ctx.font="900 8px sans-serif";ctx.textAlign="left";ctx.fillStyle="#99a3bb";ctx.fillText("SCORE",34,this.table.top+67);ctx.fillStyle="#f5f7ff";ctx.font="900 13px monospace";ctx.fillText(String(this.score).padStart(7,"0"),34,this.table.top+82);ctx.textAlign="center";ctx.fillStyle="#99a3bb";ctx.font="900 8px sans-serif";ctx.fillText("BALL",this.width*.64,this.table.top+67);ctx.fillStyle="#f5f7ff";ctx.font="900 13px sans-serif";ctx.fillText(this.ballsRemaining,this.width*.64,this.table.top+82);ctx.fillStyle="#99a3bb";ctx.font="900 8px sans-serif";ctx.fillText("MULTI",this.width*.82,this.table.top+67);ctx.fillStyle="#ffe45d";ctx.font="900 13px sans-serif";ctx.fillText(`×${this.multiplier}`,this.width*.82,this.table.top+82);if(this.ballSave>0&&Math.floor(this.elapsed*6)%2===0){ctx.fillStyle="#48e9e1";ctx.font="900 10px sans-serif";ctx.fillText("BALL SAVE",this.width/2,this.table.bottom-92);}if(this.tiltTimer>0){ctx.fillStyle="#ff3b68";ctx.font="900 15px sans-serif";ctx.fillText("TILT",this.width/2,this.table.bottom-72);}}
    drawBanner(ctx){if(this.state===STATES.PAUSED){ctx.fillStyle="rgba(3,5,10,.7)";ctx.fillRect(0,0,this.width,this.height);}if(this.banner.timer<=0&&this.state!==STATES.PLUNGER&&this.state!==STATES.PAUSED)return;const text=this.state===STATES.PAUSED?"PAUSED":this.banner.timer>0?this.banner.text:"PULL & RELEASE",sub=this.state===STATES.PAUSED?"再開ボタンをタップ":this.banner.timer>0?this.banner.sub:"PLUNGER";ctx.textAlign="center";ctx.fillStyle="#ffe45d";ctx.font="900 27px sans-serif";ctx.fillText(text,this.width/2,this.height*.48);ctx.fillStyle="#f5f7ff";ctx.font="900 11px sans-serif";ctx.fillText(sub,this.width/2,this.height*.48+22);}
    drawDebug(ctx){ctx.lineWidth=1;ctx.strokeStyle="#48e9e1";for(const wall of this.table.walls){ctx.beginPath();ctx.moveTo(wall.a.x,wall.a.y);ctx.lineTo(wall.b.x,wall.b.y);ctx.stroke();}ctx.strokeStyle="#ff3b68";for(const bumper of this.table.bumpers){ctx.beginPath();ctx.arc(bumper.x,bumper.y,bumper.r,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle="#ffe45d";for(const target of [...this.table.targets,this.table.bell])ctx.strokeRect(target.x,target.y,target.w,target.h);ctx.strokeStyle="rgba(255,255,255,.4)";for(const ball of this.balls){ctx.beginPath();for(const point of ball.trail)ctx.lineTo(point.x,point.y);ctx.stroke();}ctx.fillStyle="#fff";ctx.font="9px monospace";ctx.textAlign="left";ctx.fillText(`substeps ${this.physicsSteps} · speed ×${this.timeScale}`,22,this.height-118);}
  }

  PinballGame.STATES=STATES;PinballGame.closestPoint=closestPoint;PinballGame.circleRect=circleRect;
  window.PinballGame=PinballGame;
})();
