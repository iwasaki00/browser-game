import {encounterBodies,encounterCuts,encounterGravity,tailExposure,cometAcceleration} from './encounters.js';
export const DEFAULT_PHYSICS = Object.freeze({
  gravitationalConstant: 120,
  softening: 10,
  fixedTimeStep: 1 / 120,
  maxFlightTime: 12,
  boundsMargin: 36,
});

const cloneVector = ({ x, y }) => ({ x, y });

export function gravitationalAcceleration(position, planets, options = DEFAULT_PHYSICS) {
  const g = options.gravitationalConstant ?? DEFAULT_PHYSICS.gravitationalConstant;
  const softening = options.softening ?? DEFAULT_PHYSICS.softening;
  let ax = 0;
  let ay = 0;

  for (const planet of [...planets].sort((a,b) => a.x-b.x || a.y-b.y || a.mass-b.mass || a.radius-b.radius)) {
    const dx = planet.x - position.x;
    const dy = planet.y - position.y;
    const distanceSquared = dx * dx + dy * dy;
    const softenedSquared = Math.max(distanceSquared, softening * softening);
    const inverseDistance = 1 / Math.sqrt(softenedSquared);
    const scale = g * planet.mass / softenedSquared * inverseDistance;
    const forceScale = scale * (planet.gravityMultiplier ?? 1) * (planet.gravityDirection ?? 1);
    ax += dx * forceScale;
    ay += dy * forceScale;
  }

  return { x: ax, y: ay };
}

export function velocityVerletStep(body, planets, dt, options = DEFAULT_PHYSICS) {
  const startAcceleration = gravitationalAcceleration(body.position, planets, options);
  const position = {
    x: body.position.x + body.velocity.x * dt + 0.5 * startAcceleration.x * dt * dt,
    y: body.position.y + body.velocity.y * dt + 0.5 * startAcceleration.y * dt * dt,
  };
  const endAcceleration = gravitationalAcceleration(position, planets, options);
  const velocity = {
    x: body.velocity.x + 0.5 * (startAcceleration.x + endAcceleration.x) * dt,
    y: body.velocity.y + 0.5 * (startAcceleration.y + endAcceleration.y) * dt,
  };

  return { ...body, position, velocity };
}

export function segmentCircleHit(start, end, circle, radius = circle.radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const fx = start.x - circle.x;
  const fy = start.y - circle.y;
  const a = dx * dx + dy * dy;

  if (a === 0) {
    return fx * fx + fy * fy <= radius * radius ? 0 : null;
  }

  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;

  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

export function planetContactZones(planet) {
  const zones=(planet.hazards??[]).map(h=>({...h}));
  const radius=planet.collisionRadius??planet.radius;
  if(radius>0)zones.push({radius});
  return zones;
}

function earliestContact(start, end, planets, goal, rocketRadius) {
  const contacts = [];
  for (const planet of planets) {
    for(const zone of planetContactZones(planet)){
      const t = segmentCircleHit(start, end, planet, zone.radius + rocketRadius);
      if (t !== null) contacts.push({ t, status: "crashed", target: planet.id, ...(zone.reason?{reason:zone.reason}:{}) });
    }
  }
  const goalHit = segmentCircleHit(start, end, goal, goal.radius);
  if (goalHit !== null) contacts.push({ t: goalHit, status: "cleared", target: goal.id });
  contacts.sort((a, b) => a.t - b.t || (a.status === "crashed" ? -1 : 1));
  return contacts[0] ?? null;
}

export function createSimulation(stage, launch = {}) {
  const speed = launch.speed ?? stage.launch.speed;
  const angle = (launch.angleDeg ?? stage.launch.angleDeg) * Math.PI / 180;
  const velocity = launch.velocity
    ? cloneVector(launch.velocity)
    : { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  return {
    status: "flying",
    elapsed: 0,
    rocket: {
      radius: stage.rocketRadius,
      position: cloneVector(stage.launch.position),
      velocity,
    },
    planets: structuredClone(stage.planets),
    goal: { ...stage.goal },
    world: { ...stage.world },
    ...(stage.flightLimits?{flightLimits:{...stage.flightLimits}}:{}),
    ...(stage.encounters?.length?{encounters:structuredClone(stage.encounters),encounterEvents:[]}:{}),
  };
}

export function stepSimulation(state, dt, options = {}) {
  if (state.status !== "flying") return state;
  if(state.encounters?.length)return stepEncounterFlight(state,dt,options);

  const previous = state.rocket.position;
  const rocket = velocityVerletStep(state.rocket, state.planets, dt, options);
  const elapsed = state.elapsed + dt;
  const contact = earliestContact(previous, rocket.position, state.planets, state.goal, rocket.radius);

  if (contact) {
    const position = {
      x: previous.x + (rocket.position.x - previous.x) * contact.t,
      y: previous.y + (rocket.position.y - previous.y) * contact.t,
    };
    return { ...state, rocket: { ...rocket, position }, elapsed, status: contact.status, target: contact.target, ...(contact.reason?{reason:contact.reason}:{}) };
  }

  const margin = options.boundsMargin ?? DEFAULT_PHYSICS.boundsMargin;
  const outside = rocket.position.x < -margin || rocket.position.x > state.world.width + margin
    || rocket.position.y < -margin || rocket.position.y > state.world.height + margin;
  const timedOut = elapsed >= (options.maxFlightTime ?? state.flightLimits?.maxFlightTime ?? DEFAULT_PHYSICS.maxFlightTime);

  return {
    ...state,
    rocket,
    elapsed,
    status: outside ? "escaped" : timedOut ? "timeout" : "flying",
  };
}

// Optional encounter path. The planet-only Verlet implementation above remains
// byte-for-byte unchanged, and is still used for all legacy stages.
function stepEncounterFlight(state,dt,options){
 const objects=state.encounters,t0=state.elapsed,t1=t0+dt,body=state.rocket,start=body.position;
 const acceleration=(position,time)=>{const a=gravitationalAcceleration(position,state.planets,options),b=encounterGravity(position,objects,time);return {x:a.x+b.x,y:a.y+b.y};};
 const initial=acceleration(start,t0);
 const predicted={x:start.x+body.velocity.x*dt+.5*initial.x*dt*dt,y:start.y+body.velocity.y*dt+.5*initial.y*dt*dt};
 const tails=objects.filter(e=>e.type==='comet').sort((a,b)=>a.id.localeCompare(b.id)).map(e=>({e,f:tailExposure(e,start,predicted,t0,t1)}));
 const a0={...initial};for(const {e,f}of tails){const a=cometAcceleration(e,body.velocity,f);a0.x+=a.x;a0.y+=a.y;}
 const position={x:start.x+body.velocity.x*dt+.5*a0.x*dt*dt,y:start.y+body.velocity.y*dt+.5*a0.y*dt*dt};
 const a1=acceleration(position,t1),estimate={x:body.velocity.x+a0.x*dt,y:body.velocity.y+a0.y*dt};
 for(const {e,f}of tails){const a=cometAcceleration(e,estimate,f);a1.x+=a.x;a1.y+=a.y;}
 const velocity={x:body.velocity.x+.5*(a0.x+a1.x)*dt,y:body.velocity.y+.5*(a0.y+a1.y)*dt};
 let contact=earliestContact(start,position,state.planets,state.goal,body.radius);
 if(options.previousPlanets){
  const goalHit=segmentCircleHit(start,position,state.goal);contact=goalHit===null?null:{t:goalHit,status:'cleared',target:state.goal.id};
  for(const p of state.planets){const old=options.previousPlanets.find(q=>q.id===p.id)??p;for(const zone of planetContactZones(p)){
   const hit=segmentCircleHit({x:start.x-old.x,y:start.y-old.y},{x:position.x-p.x,y:position.y-p.y},{x:0,y:0,radius:zone.radius+body.radius});
   if(hit!==null&&(!contact||hit<=contact.t))contact={t:hit,status:'crashed',target:p.id,...(zone.reason?{reason:zone.reason}:{})};
  }}
 }
 const triggers=[];
 const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 for(const e of objects){
  const cuts=encounterCuts(e,t0,t1);
  for(let k=0;k<cuts.length-1;k++){
   const lo=(cuts[k]-t0)/dt,hi=(cuts[k+1]-t0)/dt,from=lerp(start,position,lo),to=lerp(start,position,hi);
   const before=encounterBodies(e,cuts[k]),after=encounterBodies(e,cuts[k+1]);
   for(let i=0;i<before.length;i++){
    const a={x:from.x-before[i].x,y:from.y-before[i].y},b={x:to.x-after[i].x,y:to.y-after[i].y};
    if(e.type!=='station'){
     const hit=segmentCircleHit(a,b,{x:0,y:0,radius:e.radius+body.radius});
     if(hit!==null){const t=lo+(hi-lo)*hit;if(!contact||t<=contact.t)contact={t,status:'crashed',target:e.id,reason:`encounter-${e.type}`};}
    }
    if(['station','unknown'].includes(e.type)&&!state.encounterEvents.some(event=>event.id===e.id)){
     const hit=segmentCircleHit(a,b,{x:0,y:0,radius:e.reactionRadius});
     if(hit!==null)triggers.push({id:e.id,type:e.type,fraction:lo+(hi-lo)*hit,time:t1});
    }
   }
  }
 }
 const encounterEvents=[...state.encounterEvents];for(const event of triggers.sort((a,b)=>a.fraction-b.fraction||a.id.localeCompare(b.id)))if(event.fraction<=(contact?.t??1)&&!encounterEvents.some(old=>old.id===event.id)){const {fraction,...saved}=event;encounterEvents.push(saved);}
 const margin=options.boundsMargin??DEFAULT_PHYSICS.boundsMargin,outside=position.x<-margin||position.x>state.world.width+margin||position.y<-margin||position.y>state.world.height+margin;
 const timedOut=t1>=(options.maxFlightTime??state.flightLimits?.maxFlightTime??DEFAULT_PHYSICS.maxFlightTime);
 return {...state,elapsed:t1,encounterEvents,rocket:{...body,position:contact?lerp(start,position,contact.t):position,velocity},status:contact?.status??(outside?'escaped':timedOut?'timeout':'flying'),...(contact?{target:contact.target,...(contact.reason?{reason:contact.reason}:{})}:{})};
}

export function simulateTrajectory(stage, launch = {}, options = {}) {
  const dt = options.fixedTimeStep ?? DEFAULT_PHYSICS.fixedTimeStep;
  const maxSteps = Math.ceil((options.maxFlightTime ?? stage.flightLimits?.maxFlightTime ?? DEFAULT_PHYSICS.maxFlightTime) / dt) + 1;
  let state = createSimulation(stage, launch);
  const points = [cloneVector(state.rocket.position)];

  for (let i = 0; i < maxSteps && state.status === "flying"; i += 1) {
    state = stepSimulation(state, dt, options);
    points.push(cloneVector(state.rocket.position));
  }
  return { state, points };
}
