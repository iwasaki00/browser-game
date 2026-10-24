// Presentation only. Never writes to a simulation, stage, prediction or score.
export const EXPERIENCE_KEY = 'orbit-maker.experience.v1';
export const QUALITY = Object.freeze({standard: {particles: 64, burst: 20}, light: {particles: 12, burst: 5}});
export function loadExperience(storage) {
  try {
    const value = JSON.parse(storage?.getItem(EXPERIENCE_KEY) ?? 'null');
    return {quality: value?.quality === 'light' ? 'light' : 'standard', sound: value?.sound === true};
  } catch { return {quality: 'standard', sound: false}; }
}
export function saveExperience(storage, settings) {
  const value = {quality: settings.quality === 'light' ? 'light' : 'standard', sound: settings.sound === true};
  try { storage?.setItem(EXPERIENCE_KEY, JSON.stringify(value)); } catch { /* Optional storage. */ }
  return value;
}
function segmentDistance(a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, length = dx*dx+dy*dy;
  const t = length ? Math.max(0, Math.min(1, -(a.x*dx+a.y*dy)/length)) : 0;
  return Math.hypot(a.x+dx*t, a.y+dy*t);
}
export function failureKind(state) {
  return state.status === 'crashed' ? (state.reason ?? 'collision') : state.status;
}
export const EVENT_STYLE = Object.freeze({
  launch: ['#ffb66c', 'LIFTOFF'], approach: ['#8beaff', 'GRAVITY ASSIST'],
  swingby: ['#bc9aff', 'SWINGBY'], closecall: ['#ffe6a3', 'CLOSE CALL'],
  cleared: ['#86ffd0', 'CLEAR'], collision: ['#ff8f9c', 'IMPACT'],
  absorbed: ['#bd99ff', 'ABSORBED'], overheated: ['#ffb462', 'OVERHEAT'],
  escaped: ['#8ebeff', 'SIGNAL LOST'], timeout: ['#afbdce', 'TIME LIMIT'],
});

// Each step compares relative positions, including moving planets. Hazard sweeps
// suppress false near misses when a fast segment actually crosses a danger zone.
export class EncounterObserver {
  constructor() { this.encounters = new Map(); this.proximity = 0; this.tint = '#8beaff'; }
  update(previous, state) {
    const events = [];
    this.proximity = 0;
    for (const planet of state.planets) {
      const before = previous.planets.find(p => p.id === planet.id) ?? planet;
      const a = {x: previous.rocket.position.x-before.x, y: previous.rocket.position.y-before.y};
      const b = {x: state.rocket.position.x-planet.x, y: state.rocket.position.y-planet.y};
      const d = Math.hypot(b.x,b.y), edge = planet.radius+state.rocket.radius;
      const strength = Math.max(0, Math.min(1, 1-(d-edge)/85));
      if (strength > this.proximity) { this.proximity = strength; this.tint = planet.render?.glow ?? '#8beaff'; }
      const memory = this.encounters.get(planet.id) ?? {inside: false, turn: 0, swung: false, hazards: new Map()};
      const near = d < edge+85;
      const point = {...state.rocket.position};
      if (state.status === 'flying') {
        if (near && !memory.inside) events.push({kind:'approach', point, color:planet.render?.glow});
        if (near && memory.inside) {
          const delta = Math.atan2(a.x*b.y-a.y*b.x, a.x*b.x+a.y*b.y);
          memory.turn += delta;
          if (Math.abs(memory.turn) >= Math.PI/2 && !memory.swung) {
            events.push({kind:'swingby', point, color:planet.render?.glow}); memory.swung = true;
          }
        }
      }
      if (!near) { memory.turn = 0; memory.swung = false; }
      memory.inside = near;
      for (const [index, hazard] of (planet.hazards ?? []).entries()) {
        const radius = hazard.radius+state.rocket.radius;
        const gap = d-radius;
        const closest = segmentDistance(a,b)-radius;
        const pass = memory.hazards.get(index) ?? {active:false, minimum:Infinity, crossed:false};
        if (closest <= 14) { pass.active = true; pass.minimum = Math.min(pass.minimum, closest); pass.crossed ||= closest <= 0; }
        // Announce only after safely leaving the close region, never on entry.
        if (pass.active && gap > 14) {
          if (!pass.crossed && pass.minimum > 0 && pass.minimum <= 12 && ['flying','cleared'].includes(state.status))
            events.push({kind:'closecall', point, color:EVENT_STYLE.closecall[0]});
          pass.active = false; pass.minimum = Infinity; pass.crossed = false;
        }
        memory.hazards.set(index,pass);
      }
      this.encounters.set(planet.id,memory);
    }
    return events;
  }
}

export class SpaceExperience {
  constructor(quality='standard', onEvent=()=>{}) { this.onEvent=onEvent; this.setQuality(quality); this.reset(); }
  setQuality(value) {
    this.quality = value === 'light' ? 'light' : 'standard';
    if (this.particles) this.particles = this.particles.slice(-QUALITY[this.quality].particles);
  }
  reset() { this.observer=new EncounterObserver(); this.particles=[]; this.rings=[]; this.notice=null; this.age=0; }
  launch(state) { this.reset(); this.emit({kind:'launch',point:state.rocket.position,velocity:state.rocket.velocity}); }
  observe(previous, state) { for (const event of this.observer.update(previous,state)) this.emit(event); }
  finish(state) {
    // Escape coordinates can be outside the board; clamp the effect, not physics.
    const point = {x:Math.max(12,Math.min(state.world.width-12,state.rocket.position.x)),y:Math.max(12,Math.min(state.world.height-12,state.rocket.position.y))};
    this.emit({kind:state.status==='cleared'?'cleared':failureKind(state),point});
  }
  emit(event) {
    const style=EVENT_STYLE[event.kind]; if (!style) return;
    const color=event.color ?? style[0], heavy=['launch','cleared','collision','absorbed','overheated'].includes(event.kind);
    if(event.kind!=='approach') this.notice={text:style[1],kind:event.kind,color,left:event.kind==='closecall'?1.1:.85};
    this.rings.push({point:{...event.point},kind:event.kind,color,age:0,life:event.kind==='cleared'?1.1:.7});
    this.rings=this.rings.slice(-6);
    const count=heavy?QUALITY[this.quality].burst:(this.quality==='light'?0:5);
    const angle=event.velocity?Math.atan2(event.velocity.y,event.velocity.x)+Math.PI:0;
    for(let i=0;i<count;i++) {
      const theta=event.kind==='launch'?angle+(i/Math.max(1,count-1)-.5)*1.2:i*2.39996;
      const speed=18+(i%7)*6;
      this.particles.push({x:event.point.x,y:event.point.y,vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed,age:0,life:.4+(i%5)*.12,color,kind:event.kind});
    }
    this.particles=this.particles.slice(-QUALITY[this.quality].particles);
    this.onEvent(event.kind);
  }
  update(dt) {
    this.age+=dt;
    for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const r of this.rings)r.age+=dt;
    this.rings=this.rings.filter(r=>r.age<r.life);
    if(this.notice){this.notice.left-=dt;if(this.notice.left<=0)this.notice=null;}
  }
  draw(ctx) {
    ctx.save();
    if(this.quality==='standard')ctx.shadowBlur=8;
    for(const r of this.rings){
      const t=r.age/r.life;ctx.globalAlpha=(1-t)*.8;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.lineWidth=r.kind==='cleared'?3:1.5;
      const radius=r.kind==='absorbed'?3+30*(1-t):5+36*t;
      ctx.beginPath();ctx.arc(r.point.x,r.point.y,radius,0,Math.PI*2);ctx.stroke();
      if(r.kind==='timeout'){ctx.beginPath();ctx.moveTo(r.point.x-7,r.point.y);ctx.lineTo(r.point.x+7,r.point.y);ctx.stroke();}
      if(r.kind==='escaped'){ctx.beginPath();ctx.moveTo(r.point.x,r.point.y-9);ctx.lineTo(r.point.x,r.point.y+9);ctx.stroke();}
    }
    for(const p of this.particles){ctx.globalAlpha=1-p.age/p.life;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,1.5*(1-p.age/p.life)+.4,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}
