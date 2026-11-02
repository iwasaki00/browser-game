// Presentation only. Progress/rewards are committed by game.js, never here.
export const FORTRESS_DEFEAT=Object.freeze({duration:2.8,burstInterval:.18,maxBursts:16});
export function createFortressDefeat(boss){
 boss.death=FORTRESS_DEFEAT.duration+1;boss.deathMax=boss.death;
 boss.deathVx=undefined;boss.deathVy=0;boss.deathSpin=0;boss.deathAngle=0;boss.deathTrail=null;
 return {boss,state:'DEATH_ANIMATION',elapsed:0,bursts:0,nextBurst:0,finished:false};
}
export function tickFortressDefeat(g,dt,effect){const d=g.bossDefeat;if(!d||d.finished)return;
 d.elapsed=Math.min(FORTRESS_DEFEAT.duration,d.elapsed+dt);
 if(!d.finalBurst&&d.elapsed>=FORTRESS_DEFEAT.duration*.65){d.finalBurst=true;effect({kind:'explosion',x:d.boss.x,y:d.boss.y+d.boss.h/2,life:.55,max:.55,r:72})}
 if(d.elapsed>=d.nextBurst&&d.bursts<FORTRESS_DEFEAT.maxBursts){const n=d.bursts++,b=d.boss;d.nextBurst=d.elapsed+FORTRESS_DEFEAT.burstInterval;
  effect({kind:'skyBreak',x:b.x+Math.sin(n*2.4)*65,y:b.y-8+(n%4)*18,life:.55,max:.55});
 }
}
export function drawFortressDefeat(c,pack,d,drawActor){
 if(!d||d.finished)return;const b=d.boss,t=d.elapsed/FORTRESS_DEFEAT.duration;
 c.save();try{
  c.globalAlpha=t<.72?1:Math.max(0,(1-t)/.28);
  drawActor(c,pack,b,b.x,b.y+Math.max(0,t-.4)*10,false);
  // Localized core/cracks, not a full-sprite white rectangle.
  c.strokeStyle='#ffe2a3';c.lineWidth=1;const y=b.y+b.h/2;
  c.beginPath();c.arc(b.x,y,8+Math.min(1,t/.7)*20,0,Math.PI*2);c.stroke();
  for(let n=0;n<4;n++){const angle=n*Math.PI/2+t*.4;c.beginPath();c.moveTo(b.x+Math.cos(angle)*10,y+Math.sin(angle)*10);c.lineTo(b.x+Math.cos(angle)*(20+t*15),y+Math.sin(angle)*(20+t*15));c.stroke()}
 }finally{c.restore()}
}
