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

  for (const planet of planets) {
    const dx = planet.x - position.x;
    const dy = planet.y - position.y;
    const distanceSquared = dx * dx + dy * dy;
    const softenedSquared = Math.max(distanceSquared, softening * softening);
    const inverseDistance = 1 / Math.sqrt(softenedSquared);
    const scale = g * planet.mass / softenedSquared * inverseDistance;
    ax += dx * scale;
    ay += dy * scale;
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

function earliestContact(start, end, planets, goal, rocketRadius) {
  const contacts = [];
  for (const planet of planets) {
    const t = segmentCircleHit(start, end, planet, planet.radius + rocketRadius);
    if (t !== null) contacts.push({ t, status: "crashed", target: planet.id });
  }
  const goalHit = segmentCircleHit(start, end, goal, goal.radius);
  if (goalHit !== null) contacts.push({ t: goalHit, status: "cleared", target: goal.id });
  contacts.sort((a, b) => a.t - b.t || (a.status === "crashed" ? -1 : 1));
  return contacts[0] ?? null;
}

export function createSimulation(stage, launch = {}) {
  const speed = launch.speed ?? stage.launch.speed;
  const angle = (launch.angleDeg ?? stage.launch.angleDeg) * Math.PI / 180;
  return {
    status: "flying",
    elapsed: 0,
    rocket: {
      radius: stage.rocketRadius,
      position: cloneVector(stage.launch.position),
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    },
    planets: stage.planets.map((planet) => ({ ...planet })),
    goal: { ...stage.goal },
    world: { ...stage.world },
  };
}

export function stepSimulation(state, dt, options = DEFAULT_PHYSICS) {
  if (state.status !== "flying") return state;

  const previous = state.rocket.position;
  const rocket = velocityVerletStep(state.rocket, state.planets, dt, options);
  const elapsed = state.elapsed + dt;
  const contact = earliestContact(previous, rocket.position, state.planets, state.goal, rocket.radius);

  if (contact) {
    const position = {
      x: previous.x + (rocket.position.x - previous.x) * contact.t,
      y: previous.y + (rocket.position.y - previous.y) * contact.t,
    };
    return { ...state, rocket: { ...rocket, position }, elapsed, status: contact.status, target: contact.target };
  }

  const margin = options.boundsMargin ?? DEFAULT_PHYSICS.boundsMargin;
  const outside = rocket.position.x < -margin || rocket.position.x > state.world.width + margin
    || rocket.position.y < -margin || rocket.position.y > state.world.height + margin;
  const timedOut = elapsed >= (options.maxFlightTime ?? DEFAULT_PHYSICS.maxFlightTime);

  return {
    ...state,
    rocket,
    elapsed,
    status: outside ? "escaped" : timedOut ? "timeout" : "flying",
  };
}

export function simulateTrajectory(stage, launch = {}, options = DEFAULT_PHYSICS) {
  const dt = options.fixedTimeStep ?? DEFAULT_PHYSICS.fixedTimeStep;
  const maxSteps = Math.ceil((options.maxFlightTime ?? DEFAULT_PHYSICS.maxFlightTime) / dt) + 1;
  let state = createSimulation(stage, launch);
  const points = [cloneVector(state.rocket.position)];

  for (let i = 0; i < maxSteps && state.status === "flying"; i += 1) {
    state = stepSimulation(state, dt, options);
    points.push(cloneVector(state.rocket.position));
  }
  return { state, points };
}
