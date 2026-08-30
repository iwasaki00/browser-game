(function () {
  "use strict";

  const STATES = Object.freeze({ READY:"READY", ROUND_START:"ROUND_START", FIGHTING:"FIGHTING", HIT_STOP:"HIT_STOP", ROUND_END:"ROUND_END", KO:"KO", RESULT:"RESULT", PAUSED:"PAUSED" });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  class FightGame {
    constructor(canvas, sound, settings, onEnd, options = {}) {
      this.canvas=canvas; this.ctx=canvas.getContext("2d"); this.sound=sound; this.settings=settings; this.onEnd=onEnd;
      this.controlsRoot=options.controlsRoot||canvas.parentElement||document; this.bestScore=options.bestScore||0;
      this.specialName=(settings.specialMoveName||"オレファイヤー").trim()||"オレファイヤー";
      this.effect=settings.fightEffect||"fire"; this.difficulty=settings.fightDifficulty||"easy";
      this.running=false; this.finished=false; this.state=STATES.READY; this.stateBeforePause=STATES.FIGHTING;
      this.last=0; this.elapsed=0; this.fps=60; this.score=0; this.round=1; this.time=60; this.playerWins=0; this.cpuWins=0;
      this.transitionTimer=0; this.roundWinner=null; this.koAnnounced=false; this.hitStop=0; this.shake=0; this.flash=0;
      this.input={left:false,right:false,guard:false}; this.pressed={punch:false,kick:false,special:false,jump:false}; this.cleanup=[];
      this.projectiles=[]; this.particles=[]; this.specialBanner={text:"",timer:0}; this.comboBanner={text:"",timer:0};
      this.stats={damageDealt:0,damageTaken:0,punchHits:0,kickHits:0,maxCombo:0,specialUses:0,specialHits:0,guards:0,counters:0};
      this.cpuAI="WAIT"; this.cpuDecision=0; this.cpuEnabled=true; this.boundLoop=time=>this.loop(time);
      this.resumeButton=this.controlsRoot.querySelector?.("#fightResumeButton")||null;
    }

    character(id, x, color, facing) {
      return { id,x,y:this.groundY,w:42,h:88,color,facing,vx:0,vy:0,onGround:true,hp:100,guard:100,special:0,state:"IDLE",stateTimer:0,attack:null,combo:0,comboTimer:0,specialTimer:0,specialSpawned:false,guardHeld:false,invincible:false };
    }

    start() {
      this.sound.resetPlayStats(); this.resize();
      this.player=this.character("player",this.width*.27,"#48e9e1",1); this.cpu=this.character("cpu",this.width*.73,"#ff3b68",-1);
      this.bind(); this.startRound(); this.running=true; this.last=performance.now(); requestAnimationFrame(this.boundLoop);
    }

    stop() {
      this.running=false; this.finished=true; this.cleanup.splice(0).forEach(remove=>remove());
      if(this.resumeButton)this.resumeButton.hidden=true;
      this.input.left=this.input.right=this.input.guard=false;
    }

    resize() {
      const rect=this.canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);
      this.canvas.width=Math.max(1,Math.round(rect.width*ratio)); this.canvas.height=Math.max(1,Math.round(rect.height*ratio)); this.ctx.setTransform(ratio,0,0,ratio,0,0);
      this.width=Math.max(300,rect.width); this.height=Math.max(520,rect.height); this.groundY=this.height-190;
      if(this.player){this.player.y=this.groundY;this.cpu.y=this.groundY;this.player.x=clamp(this.player.x,30,this.width-30);this.cpu.x=clamp(this.cpu.x,30,this.width-30);}
    }

    bind() {
      const set=(name,active)=>{
        if(["punch","kick","special","jump"].includes(name)&&active)this.pressed[name]=true;
        else if(name in this.input)this.input[name]=active;
      };
      this.controlsRoot.querySelectorAll?.("[data-fight-control]").forEach(button=>{
        const name=button.dataset.fightControl;
        const down=event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);set(name,true);button.classList.add("is-pressed");};
        const up=event=>{event.preventDefault();if(name in this.input)set(name,false);button.classList.remove("is-pressed");};
        button.addEventListener("pointerdown",down); button.addEventListener("pointerup",up); button.addEventListener("pointercancel",up); button.addEventListener("lostpointercapture",up);
        this.cleanup.push(()=>{button.removeEventListener("pointerdown",down);button.removeEventListener("pointerup",up);button.removeEventListener("pointercancel",up);button.removeEventListener("lostpointercapture",up);});
      });
      const map={ArrowLeft:"left",ArrowRight:"right",KeyA:"punch",KeyS:"kick",KeyD:"guard",KeyF:"special",Space:"jump"};
      const keydown=event=>{const name=map[event.code];if(!name)return;event.preventDefault();if(!event.repeat||name==="left"||name==="right"||name==="guard")set(name,true);};
      const keyup=event=>{const name=map[event.code];if(!name)return;event.preventDefault();if(name in this.input)set(name,false);};
      const visibility=()=>{if(document.hidden&&[STATES.FIGHTING,STATES.ROUND_START].includes(this.state))this.pause(true);};
      const resume=event=>{event.preventDefault();this.resume();};
      window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);document.addEventListener("visibilitychange",visibility);this.resumeButton?.addEventListener("click",resume);
      this.cleanup.push(()=>{window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);document.removeEventListener("visibilitychange",visibility);this.resumeButton?.removeEventListener("click",resume);});
    }

    play(id){Promise.resolve(this.sound.play(id)).catch(()=>{});}

    startRound() {
      this.time=60; this.roundWinner=null; this.koAnnounced=false; this.projectiles=[];
      this.resetCharacter(this.player,this.width*.27,1); this.resetCharacter(this.cpu,this.width*.73,-1);
      this.state=STATES.ROUND_START; this.transitionTimer=1; this.comboBanner={text:this.playerWins===1&&this.cpuWins===1?"FINAL ROUND":`ROUND ${this.round}`,timer:1};
      if(this.playerWins===1&&this.cpuWins===1)this.play("fightFinalRound"); else this.play("fightRoundStart");
    }

    resetCharacter(character,x,facing){character.x=x;character.y=this.groundY;character.vx=0;character.vy=0;character.onGround=true;character.hp=100;character.guard=100;character.special=0;character.state="IDLE";character.stateTimer=0;character.attack=null;character.combo=0;character.comboTimer=0;character.facing=facing;}

    pause(automatic=false){if(this.state===STATES.PAUSED||[STATES.RESULT,STATES.KO].includes(this.state))return;this.stateBeforePause=this.state;this.state=STATES.PAUSED;this.autoPaused=automatic;if(this.resumeButton)this.resumeButton.hidden=false;}
    resume(){if(this.state!==STATES.PAUSED)return;Promise.resolve(this.sound.unlock?.()).catch(()=>{});this.state=this.stateBeforePause||STATES.FIGHTING;this.last=performance.now();this.autoPaused=false;if(this.resumeButton)this.resumeButton.hidden=true;}

    loop(time){if(!this.running)return;const dt=Math.min(.04,Math.max(0,(time-this.last)/1000));this.last=time;this.fps+=(1/Math.max(.001,dt)-this.fps)*.08;if(this.state!==STATES.PAUSED)this.update(dt);this.draw();requestAnimationFrame(this.boundLoop);}

    update(dt) {
      this.elapsed+=dt;this.shake=Math.max(0,this.shake-dt);this.flash=Math.max(0,this.flash-dt);this.specialBanner.timer=Math.max(0,this.specialBanner.timer-dt);this.comboBanner.timer=Math.max(0,this.comboBanner.timer-dt);this.updateParticles(dt);
      if(this.state===STATES.HIT_STOP){this.hitStop-=dt;if(this.hitStop<=0)this.state=STATES.FIGHTING;return;}
      if(this.state===STATES.ROUND_START){this.transitionTimer-=dt;if(this.transitionTimer<=0){this.state=STATES.FIGHTING;this.comboBanner={text:"FIGHT!",timer:.65};}return;}
      if(this.state===STATES.KO){this.updateKO(dt);return;}
      if(this.state===STATES.ROUND_END){this.transitionTimer-=dt;if(this.transitionTimer<=0)this.advanceRound();return;}
      if(this.state===STATES.RESULT){this.transitionTimer-=dt;if(this.transitionTimer<=0)this.finish();return;}
      if(this.state!==STATES.FIGHTING)return;
      this.time=Math.max(0,this.time-dt);if(this.time<=0){const winner=this.player.hp===this.cpu.hp?"draw":this.player.hp>this.cpu.hp?"player":"cpu";this.endRound(winner,false);return;}
      this.handlePlayerInput();this.updateCPU(dt);this.updateCharacter(this.player,this.cpu,dt);this.updateCharacter(this.cpu,this.player,dt);this.separateCharacters();this.updateProjectiles(dt);
    }

    handlePlayerInput(){
      this.player.guardHeld=this.input.guard;
      if(this.pressed.punch){this.pressed.punch=false;this.startAttack(this.player,"punch");}
      if(this.pressed.kick){this.pressed.kick=false;this.startAttack(this.player,"kick");}
      if(this.pressed.special){this.pressed.special=false;this.startSpecial(this.player);}
      if(this.pressed.jump){this.pressed.jump=false;this.jump(this.player);}
      this.player.moveIntent=Number(this.input.right)-Number(this.input.left);
    }

    updateCPU(dt){
      const cpu=this.cpu,player=this.player;cpu.guardHeld=false;cpu.moveIntent=0;this.cpuDecision-=dt;
      if(!this.cpuEnabled){this.cpuAI="OFF";return;}
      if(this.cpuDecision>0){if(this.cpuAI==="APPROACH")cpu.moveIntent=Math.sign(player.x-cpu.x);if(this.cpuAI==="GUARD")cpu.guardHeld=true;return;}
      const easy=this.difficulty==="easy",distance=Math.abs(player.x-cpu.x),roll=Math.random();this.cpuDecision=(easy?.38:.2)+Math.random()*(easy?.42:.28);
      if(cpu.special>=100&&roll>(easy?.82:.65)){this.cpuAI="SPECIAL";this.startSpecial(cpu);return;}
      if(player.attack&&distance<85&&roll<(easy?.18:.38)){this.cpuAI="GUARD";cpu.guardHeld=true;this.cpuDecision=.35;return;}
      if(distance>72){this.cpuAI="APPROACH";cpu.moveIntent=Math.sign(player.x-cpu.x);return;}
      if(roll<(easy?.42:.6)){this.cpuAI="PUNCH";this.startAttack(cpu,"punch");}else if(roll<(easy?.65:.83)){this.cpuAI="KICK";this.startAttack(cpu,"kick");}else{this.cpuAI="WAIT";}
    }

    canAct(character){return character.hp>0&&!["DAMAGE","DOWN","GUARD_BREAK","SPECIAL","ATTACK_PUNCH","ATTACK_KICK","KO"].includes(character.state);}

    startAttack(character,type){
      if(!this.canAct(character)||character.guardHeld)return false;
      const punch=type==="punch";character.state=punch?"ATTACK_PUNCH":"ATTACK_KICK";character.stateTimer=punch?.3:.48;
      character.attack={type,elapsed:0,duration:character.stateTimer,activeStart:punch?.075:.16,activeEnd:punch?.17:.3,reach:punch?49:69,damage:punch?7:12,guardDamage:punch?16:28,hit:false};
      this.play(punch?"fightPunchSwing":"fightKickSwing");return true;
    }

    startSpecial(character){
      if(!this.canAct(character)||character.special<100)return false;
      character.special=0;character.state="SPECIAL";character.stateTimer=.82;character.specialTimer=0;character.specialSpawned=false;
      this.specialBanner={text:this.specialName.toUpperCase()+"!!",timer:1.25};this.play("fightSpecialCall");if(character===this.player)this.stats.specialUses+=1;return true;
    }

    jump(character){if(!this.canAct(character)||!character.onGround)return false;character.vy=-390;character.onGround=false;character.state="JUMP";this.play("fightJump");return true;}

    updateCharacter(character,opponent,dt){
      character.comboTimer=Math.max(0,character.comboTimer-dt);if(character.comboTimer<=0)character.combo=0;
      character.guard=Math.min(100,character.guard+(character.state==="GUARD"?4:11)*dt);
      if(["DAMAGE","DOWN","GUARD_BREAK"].includes(character.state)){character.stateTimer-=dt;character.x+=character.vx*dt;character.vx*=Math.pow(.05,dt);if(character.stateTimer<=0)character.state="IDLE";this.updateVertical(character,dt);return;}
      if(character.state==="SPECIAL"){
        character.specialTimer+=dt;character.stateTimer-=dt;
        if(!character.specialSpawned&&character.specialTimer>=.45){character.specialSpawned=true;this.spawnProjectile(character);this.play("fightSpecialEffect");}
        if(character.stateTimer<=0)character.state="IDLE";this.updateVertical(character,dt);return;
      }
      if(character.attack){
        character.attack.elapsed+=dt;const attack=character.attack;
        if(!attack.hit&&attack.elapsed>=attack.activeStart&&attack.elapsed<=attack.activeEnd&&overlaps(this.attackBox(character,attack),this.hurtBox(opponent))){attack.hit=true;this.applyHit(character,opponent,attack);}
        character.stateTimer-=dt;if(character.stateTimer<=0){character.attack=null;character.state="IDLE";}
      } else if(character.guardHeld&&character.guard>0&&character.onGround){
        character.state="GUARD";
        const retreat=character.moveIntent&&Math.sign(character.moveIntent)!==character.facing;
        character.vx=retreat?character.moveIntent*58:0;character.x+=character.vx*dt;
      }
      else if(character.state==="GUARD")character.state="IDLE";
      if(!character.attack&&character.state!=="SPECIAL"&&character.state!=="GUARD"){
        const speed=character.id==="cpu"&&this.difficulty==="easy"?105:145;character.vx=(character.moveIntent||0)*speed;character.x+=character.vx*dt;if(character.onGround)character.state=Math.abs(character.vx)>1?"WALK":"IDLE";
      }
      this.updateVertical(character,dt);character.x=clamp(character.x,24,this.width-24);if(!character.attack)character.facing=character.x<opponent.x?1:-1;
    }

    updateVertical(character,dt){
      if(!character.onGround){character.vy+=900*dt;character.y+=character.vy*dt;if(character.y>=this.groundY){character.y=this.groundY;character.vy=0;character.onGround=true;if(character.state==="JUMP"){character.state="IDLE";this.play("fightLand");}}}
    }

    hurtBox(character){return{x:character.x-character.w/2,y:character.y-character.h,w:character.w,h:character.h};}
    attackBox(character,attack){const x=character.facing>0?character.x+character.w*.3:character.x-character.w*.3-attack.reach;return{x,y:character.y-character.h*.72,w:attack.reach,h:attack.type==="kick"?34:27};}

    applyHit(attacker,target,attack){
      if(target.invincible){this.comboBanner={text:"INVINCIBLE",timer:.45};this.play("fightGuard");return;}
      const counter=target.attack&&target.attack.elapsed<target.attack.activeStart;
      if(counter){this.comboBanner={text:"COUNTER!",timer:.7};this.play("fightCounter");if(attacker===this.player)this.stats.counters+=1;}
      const guarding=target.state==="GUARD"&&target.facing===-attacker.facing;
      if(guarding){
        const damage=Math.max(1,Math.round(attack.damage*.2));target.hp=Math.max(0,target.hp-damage);target.guard=Math.max(0,target.guard-attack.guardDamage);this.play("fightGuard");
        if(target===this.player){this.stats.guards+=1;this.stats.damageTaken+=damage;}else if(attacker===this.player)this.stats.damageDealt+=damage;
        if(target.guard<=0){target.state="GUARD_BREAK";target.stateTimer=.9;target.guardHeld=false;this.play("fightGuardBreak");this.comboBanner={text:"GUARD BREAK!",timer:.8};this.shake=.12;}
      } else {
        target.hp=Math.max(0,target.hp-attack.damage);target.vx=attacker.facing*(attack.type==="kick"?165:95);target.state=attack.type==="kick"&&target.hp>0&&Math.random()<.28?"DOWN":"DAMAGE";target.stateTimer=target.state==="DOWN"?.68:.3;target.attack=null;
        this.play(attack.type==="kick"?"fightHitHeavy":"fightHitLight");this.play("fightDamage");if(target.state==="DOWN")this.play("fightDown");
        const playerWasReady=this.player.special>=100;
        attacker.special=clamp(attacker.special+attack.damage*2.1,0,100);target.special=clamp(target.special+attack.damage*1.15,0,100);
        if(!playerWasReady&&this.player.special>=100)this.flash=.18;
        if(attacker===this.player){this.stats.damageDealt+=attack.damage;this.stats[attack.type==="kick"?"kickHits":"punchHits"]+=1;}if(target===this.player)this.stats.damageTaken+=attack.damage;
        this.registerCombo(attacker);this.spawnHitParticles(target.x,target.y-target.h*.55,attack.type==="kick"?"#ffe45d":"#f5f7ff");
      }
      this.enterHitStop(attack.type==="kick"?.07:.04);if(attack.type==="kick")this.shake=.1;if(target.hp<=0)this.endRound(attacker.id,true);
    }

    registerCombo(attacker){attacker.combo=attacker.comboTimer>0?attacker.combo+1:1;attacker.comboTimer=.9;if(attacker===this.player){this.stats.maxCombo=Math.max(this.stats.maxCombo,attacker.combo);if(attacker.combo>=2)this.comboBanner={text:`${attacker.combo} HIT!`,timer:.7};}if([3,5].includes(attacker.combo))this.play("fightCombo");}

    enterHitStop(duration){this.hitStop=duration;this.state=STATES.HIT_STOP;}

    spawnProjectile(owner){
      this.projectiles.push({owner,x:owner.x+owner.facing*36,y:owner.y-owner.h*.56,vx:owner.facing*260,r:18,active:true,hit:false,effect:this.effect});
      this.flash=.12;
    }

    updateProjectiles(dt){
      for(const projectile of this.projectiles){
        if(!projectile.active)continue;projectile.x+=projectile.vx*dt;const target=projectile.owner===this.player?this.cpu:this.player;
        const box={x:projectile.x-projectile.r,y:projectile.y-projectile.r,w:projectile.r*2,h:projectile.r*2};
        if(!projectile.hit&&overlaps(box,this.hurtBox(target))){projectile.hit=true;projectile.active=false;this.applySpecialHit(projectile.owner,target);}
        if(projectile.x<-40||projectile.x>this.width+40)projectile.active=false;
      }
      this.projectiles=this.projectiles.filter(projectile=>projectile.active);
    }

    applySpecialHit(owner,target){
      if(target.invincible){this.comboBanner={text:"INVINCIBLE",timer:.45};this.play("fightGuard");return;}
      const guarding=target.state==="GUARD"&&target.facing===-owner.facing;const damage=guarding?7:25;
      target.hp=Math.max(0,target.hp-damage);target.guard=guarding?Math.max(0,target.guard-45):target.guard;target.vx=owner.facing*245;target.state=guarding?"GUARD":"DOWN";target.stateTimer=guarding?.25:.85;target.attack=null;
      this.play(guarding?"fightGuard":"fightSpecialHit");if(!guarding){this.play("fightDamage");this.play("fightDown");}
      if(owner===this.player){this.stats.damageDealt+=damage;this.stats.specialHits+=1;}if(target===this.player)this.stats.damageTaken+=damage;
      this.registerCombo(owner);this.spawnHitParticles(target.x,target.y-target.h*.55,"#ff7c45",18);this.shake=.22;this.enterHitStop(.1);if(target.hp<=0)this.endRound(owner.id,true);
    }

    separateCharacters(){const minimum=48,distance=this.cpu.x-this.player.x;if(Math.abs(distance)<minimum){const push=(minimum-Math.abs(distance))/2;const direction=distance>=0?1:-1;this.player.x-=push*direction;this.cpu.x+=push*direction;}this.player.x=clamp(this.player.x,24,this.width-24);this.cpu.x=clamp(this.cpu.x,24,this.width-24);}

    endRound(winner,ko){
      if([STATES.KO,STATES.ROUND_END,STATES.RESULT].includes(this.state))return;
      this.roundWinner=winner;this.state=ko?STATES.KO:STATES.ROUND_END;this.transitionTimer=ko?.3:1;this.koAnnounced=!ko;
      this.comboBanner={text:ko?"K.O.":winner==="draw"?"DRAW":"TIME UP",timer:1.4};
      if(ko){const loser=winner==="player"?this.cpu:this.player;loser.state="KO";loser.attack=null;loser.vx=(winner==="player"?1:-1)*150;this.shake=.3;}
    }

    updateKO(dt){this.transitionTimer-=dt;if(this.transitionTimer>0)return;if(!this.koAnnounced){this.koAnnounced=true;this.play("fightKO");this.transitionTimer=1.15;return;}this.advanceRound();}

    advanceRound(){
      if(this.roundWinner==="player")this.playerWins+=1;else if(this.roundWinner==="cpu")this.cpuWins+=1;
      if(this.playerWins>=2||this.cpuWins>=2){const win=this.playerWins>this.cpuWins;this.state=STATES.RESULT;this.transitionTimer=1.1;this.comboBanner={text:win?"YOU WIN":"YOU LOSE",timer:2};this.play(win?"fightWin":"fightLose");return;}
      this.round+=1;this.startRound();
    }

    finish(){if(this.finished)return;this.finished=true;this.running=false;const win=this.playerWins>this.cpuWins;const draw=this.playerWins===this.cpuWins;this.onEnd({mode:"fight",clear:win,draw,score:this.score+Math.round(this.stats.damageDealt*100)+this.playerWins*5000,counts:this.sound.getPlayStats(),stats:{...this.stats,remainingHp:this.player.hp,cpuRemainingHp:this.cpu.hp,specialAccuracy:this.stats.specialUses?this.stats.specialHits/this.stats.specialUses*100:0,rounds:`${this.playerWins}-${this.cpuWins}`,time:this.elapsed}});}

    spawnHitParticles(x,y,color,count=10){for(let index=0;index<count;index+=1)this.particles.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*180,life:.25+Math.random()*.35,size:3+Math.random()*5,color});if(this.particles.length>100)this.particles.splice(0,this.particles.length-100);}
    updateParticles(dt){this.particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt;});this.particles=this.particles.filter(p=>p.life>0);}

    toggleDebugOption(option){
      if(option==="cpu")this.cpuEnabled=!this.cpuEnabled;
      if(option==="playerInvincible"&&this.player)this.player.invincible=!this.player.invincible;
      if(option==="cpuInvincible"&&this.cpu)this.cpu.invincible=!this.cpu.invincible;
      return this.getDebugOptions();
    }
    getDebugOptions(){return{cpuEnabled:this.cpuEnabled,playerInvincible:Boolean(this.player?.invincible),cpuInvincible:Boolean(this.cpu?.invincible)};}

    getHudState(){return{mode:"fight",score:this.score+Math.round(this.stats.damageDealt*100),time:this.time,best:this.bestScore};}
    getDebugState(){return{game:"fight",playerState:this.player?.state||this.state,cpuState:this.cpu?.state||"--",fps:Math.round(this.fps),playerHp:this.player?.hp??0,cpuHp:this.cpu?.hp??0,playerX:Math.round(this.player?.x||0),cpuX:Math.round(this.cpu?.x||0),special:Math.round(this.player?.special||0),cpuAI:this.cpuEnabled?this.cpuAI:"OFF",playerInvincible:Boolean(this.player?.invincible),cpuInvincible:Boolean(this.cpu?.invincible),round:this.round,time:this.time.toFixed(1),attacks:Number(Boolean(this.player?.attack))+Number(Boolean(this.cpu?.attack)),projectiles:this.projectiles.length};}

    draw(){
      const ctx=this.ctx,w=this.width,h=this.height;ctx.save();ctx.clearRect(0,0,w,h);if(this.shake>0)ctx.translate((Math.random()-.5)*9,(Math.random()-.5)*6);
      const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#151b3e");sky.addColorStop(.6,"#342047");sky.addColorStop(1,"#0a0d18");ctx.fillStyle=sky;ctx.fillRect(-8,-8,w+16,h+16);this.drawArena(ctx,w,h);this.drawFightHud(ctx,w);
      if(this.player&&this.cpu){this.drawCharacter(ctx,this.player,"ORE-01");this.drawCharacter(ctx,this.cpu,"CPU");}
      this.drawProjectiles(ctx);this.drawParticles(ctx);this.drawBanners(ctx,w,h);if(this.debugHitboxes)this.drawHitboxes(ctx);if(this.flash>0){ctx.fillStyle=`rgba(255,255,255,${this.flash*2})`;ctx.fillRect(0,0,w,h);}ctx.restore();
      if(this.resumeButton)this.resumeButton.hidden=this.state!==STATES.PAUSED;
    }

    drawArena(ctx,w,h){ctx.fillStyle="rgba(72,233,225,.08)";for(let x=0;x<w;x+=40)ctx.fillRect(x,115,2,this.groundY-115);ctx.fillStyle="#192238";ctx.fillRect(0,this.groundY,w,h-this.groundY);ctx.fillStyle="#48e9e1";ctx.fillRect(0,this.groundY,w,4);ctx.strokeStyle="rgba(255,255,255,.12)";ctx.beginPath();ctx.ellipse(w/2,this.groundY+12,w*.42,36,0,0,Math.PI*2);ctx.stroke();}

    drawFightHud(ctx,w){
      const bar=(x,y,width,value,color,flip=false)=>{ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(x,y,width,11);ctx.fillStyle=color;const filled=width*clamp(value/100,0,1);ctx.fillRect(flip?x+width-filled:x,y,filled,11);};
      ctx.font="900 10px sans-serif";ctx.fillStyle="#f5f7ff";ctx.textAlign="left";ctx.fillText(`PLAYER ${this.playerWins}`,12,75);ctx.textAlign="right";ctx.fillText(`${this.cpuWins} CPU`,w-12,75);
      bar(12,81,w*.39,this.player?.hp||0,"#48e9e1");bar(w-w*.39-12,81,w*.39,this.cpu?.hp||0,"#ff3b68",true);
      bar(12,96,w*.39,this.player?.special||0,"#ffe45d");bar(w-w*.39-12,96,w*.39,this.cpu?.special||0,"#ffe45d",true);
      ctx.textAlign="center";ctx.fillStyle=this.time<=10?"#ff3b68":"#f5f7ff";ctx.font="900 17px sans-serif";ctx.fillText(String(Math.ceil(this.time)).padStart(2,"0"),w/2,93);
      ctx.font="900 8px sans-serif";ctx.fillStyle=this.player?.special>=100?"#ffe45d":"#99a3bb";ctx.fillText(this.player?.special>=100?"SPECIAL READY!":"SPECIAL",w*.22,108);ctx.fillStyle="#99a3bb";ctx.fillText(`GUARD ${Math.ceil(this.player?.guard||0)}`,w*.78,108);
    }

    drawCharacter(ctx,character,name){
      const down=character.state==="DOWN"||character.state==="KO";ctx.save();ctx.translate(character.x,character.y);if(down)ctx.rotate(character.facing*.95);ctx.scale(character.facing,1);
      ctx.globalAlpha=character.hp<=0?.55:1;ctx.fillStyle=character.color;ctx.fillRect(-17,-62,34,48);ctx.beginPath();if(character.id==="cpu"){ctx.moveTo(-18,-65);ctx.lineTo(-10,-91);ctx.lineTo(-2,-68);ctx.lineTo(10,-91);ctx.lineTo(18,-65);ctx.closePath();}else ctx.arc(0,-76,18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#081012";ctx.fillRect(3,-80,5,5);ctx.strokeStyle=character.color;ctx.lineWidth=8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-10,-50);ctx.lineTo(-24,-34);ctx.moveTo(10,-50);ctx.lineTo(25,-33);ctx.moveTo(-9,-14);ctx.lineTo(-13,0);ctx.moveTo(9,-14);ctx.lineTo(14,0);ctx.stroke();
      if(character.state==="ATTACK_PUNCH"){ctx.strokeStyle="#ffe45d";ctx.beginPath();ctx.moveTo(10,-48);ctx.lineTo(48,-48);ctx.stroke();}
      if(character.state==="ATTACK_KICK"){ctx.strokeStyle="#ffe45d";ctx.beginPath();ctx.moveTo(8,-19);ctx.lineTo(56,-31);ctx.stroke();}
      if(character.state==="GUARD"){ctx.strokeStyle="rgba(72,233,225,.75)";ctx.lineWidth=5;ctx.beginPath();ctx.arc(15,-48,35,-1.45,1.45);ctx.stroke();}
      if(character.state==="SPECIAL"){ctx.strokeStyle="#ffe45d";ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,-44,28+i*8,0,Math.PI*2);ctx.stroke();}}
      ctx.restore();ctx.textAlign="center";ctx.fillStyle="#f5f7ff";ctx.font="900 9px sans-serif";ctx.fillText(name,character.x,character.y+16);
    }

    drawProjectiles(ctx){const colors={fire:["#ff3b68","#ffe45d"],electric:["#bd66ff","#48e9e1"],light:["#f5f7ff","#ffe45d"]};for(const p of this.projectiles){const pair=colors[p.effect]||colors.fire;const gradient=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,p.r*1.6);gradient.addColorStop(0,"white");gradient.addColorStop(.35,pair[1]);gradient.addColorStop(1,pair[0]+"00");ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(p.x,p.y,p.r*1.6,0,Math.PI*2);ctx.fill();}}
    drawParticles(ctx){for(const p of this.particles){ctx.globalAlpha=clamp(p.life*3,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;}

    drawBanners(ctx,w,h){
      if(this.specialBanner.timer>0){ctx.textAlign="center";ctx.fillStyle="#ffe45d";ctx.font=`900 ${Math.min(30,w/12)}px sans-serif`;ctx.fillText(this.specialBanner.text,w/2,h*.34);}
      if(this.comboBanner.timer>0){ctx.textAlign="center";ctx.fillStyle="#f5f7ff";ctx.font="900 28px sans-serif";ctx.fillText(this.comboBanner.text,w/2,h*.43);}
      if(this.state===STATES.PAUSED){ctx.fillStyle="rgba(4,7,15,.74)";ctx.fillRect(24,h*.38,w-48,100);ctx.fillStyle="#f5f7ff";ctx.textAlign="center";ctx.font="900 27px sans-serif";ctx.fillText("PAUSED",w/2,h*.38+43);ctx.fillStyle="#99a3bb";ctx.font="900 11px sans-serif";ctx.fillText("ボタンを押して再開",w/2,h*.38+70);}
    }

    drawHitboxes(ctx){ctx.lineWidth=1;ctx.strokeStyle="#48e9e1";for(const character of [this.player,this.cpu]){const hurt=this.hurtBox(character);ctx.strokeRect(hurt.x,hurt.y,hurt.w,hurt.h);if(character.attack){ctx.strokeStyle="#ff3b68";const attack=this.attackBox(character,character.attack);ctx.strokeRect(attack.x,attack.y,attack.w,attack.h);ctx.strokeStyle="#48e9e1";}}ctx.strokeStyle="#ffe45d";for(const p of this.projectiles)ctx.strokeRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);}
  }

  FightGame.STATES=STATES;FightGame.overlaps=overlaps;
  window.FightGame=FightGame;
})();
