export const LAUNCH_MODES = Object.freeze({
  PRECISION: "precision",
  SLINGSHOT: "slingshot",
});

export const LAUNCH_MODE_STORAGE_KEY = "orbit-maker.launch-mode";

export const DEFAULT_SLINGSHOT = Object.freeze({
  cancelDistance: 14,
  maxPullDistance: 105,
  minSpeed: 120,
  maxSpeed: 220,
  rocketTouchRadius: 28,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeLaunchMode(value) {
  return value === LAUNCH_MODES.SLINGSHOT ? LAUNCH_MODES.SLINGSHOT : LAUNCH_MODES.PRECISION;
}

export function loadLaunchMode(storage) {
  try {
    return normalizeLaunchMode(storage?.getItem(LAUNCH_MODE_STORAGE_KEY));
  } catch {
    return LAUNCH_MODES.PRECISION;
  }
}

export function saveLaunchMode(storage, launchMode) {
  const normalized = normalizeLaunchMode(launchMode);
  try {
    storage?.setItem(LAUNCH_MODE_STORAGE_KEY, normalized);
  } catch {
    // Private browsing and storage restrictions must not block play.
  }
  return normalized;
}

export function velocityFromAngleSpeed(angleDeg, speed) {
  const angle = angleDeg * Math.PI / 180;
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

export function slingshotLaunch(origin, pointer, options = DEFAULT_SLINGSHOT) {
  const pullX = pointer.x - origin.x;
  const pullY = pointer.y - origin.y;
  const distance = Math.hypot(pullX, pullY);
  const cancelDistance = options.cancelDistance ?? DEFAULT_SLINGSHOT.cancelDistance;
  const maxPullDistance = options.maxPullDistance ?? DEFAULT_SLINGSHOT.maxPullDistance;
  const minSpeed = options.minSpeed ?? DEFAULT_SLINGSHOT.minSpeed;
  const maxSpeed = options.maxSpeed ?? DEFAULT_SLINGSHOT.maxSpeed;

  if (distance <= cancelDistance || distance === 0) {
    return { cancelled: true, distance, speed: 0, angleDeg: null, velocity: { x: 0, y: 0 } };
  }

  const strength = clamp((distance - cancelDistance) / (maxPullDistance - cancelDistance), 0, 1);
  const speed = minSpeed + (maxSpeed - minSpeed) * strength;
  const directionX = -pullX / distance;
  const directionY = -pullY / distance;
  const velocity = { x: directionX * speed, y: directionY * speed };

  return {
    cancelled: false,
    distance,
    strength,
    speed,
    angleDeg: Math.atan2(velocity.y, velocity.x) * 180 / Math.PI,
    velocity,
  };
}

export function classifyDragTarget(point, rocketPosition, planets, launchMode, options = DEFAULT_SLINGSHOT) {
  const rocketTouchRadius = options.rocketTouchRadius ?? DEFAULT_SLINGSHOT.rocketTouchRadius;
  if (launchMode === LAUNCH_MODES.SLINGSHOT
    && Math.hypot(point.x - rocketPosition.x, point.y - rocketPosition.y) <= rocketTouchRadius) {
    return { type: "rocket" };
  }

  const planet = planets
    .map((item) => ({ item, distance: Math.hypot(point.x - item.x, point.y - item.y) }))
    .filter(({ item, distance }) => distance <= item.radius + 12)
    .sort((a, b) => a.distance - b.distance)[0]?.item;

  return planet ? { type: "planet", id: planet.id } : null;
}
