export const MAX_PLANETS = 3;
export const PLANET_TYPES = Object.freeze({
  asteroid: { name: '小惑星', radius: 22, mass: 1800, color: '#d0b797' },
  earth: { name: '地球型', radius: 38, mass: 5200, color: '#6fd3ff' },
  gas: { name: '巨大ガス', radius: 48, mass: 8000, color: '#e9b677' },
});
// 質量は半径の3乗ではなく明示倍率で抑え、最大10400とする。
export const PLANET_SIZES = Object.freeze({
  small: { name: '小', radiusScale: .8, massScale: .7 },
  medium: { name: '中', radiusScale: 1, massScale: 1 },
  large: { name: '大', radiusScale: 1.2, massScale: 1.3 },
});
export function configurePlanet(planet, type = 'earth', size = 'medium') {
  const base = PLANET_TYPES[type], scale = PLANET_SIZES[size];
  return { ...planet, type, size, radius: base.radius * scale.radiusScale, mass: base.mass * scale.massScale, color: base.color };
}
export function placementAllowed(candidate, stage) {
  const { x, y, radius } = candidate;
  const rules=stage.rules;
  if(rules){
    if(!rules.types.includes(candidate.type??'earth')||!rules.sizes.includes(candidate.size??'medium'))return false;
    const r=rules.placement;
    if(x-radius<r.left||x+radius>r.right||y-radius<r.top||y+radius>r.bottom)return false;
  }
  if (x < radius || y < radius || x > stage.world.width-radius || y > stage.world.height-radius) return false;
  if (stage.planets.some(p => p.id !== candidate.id && Math.hypot(x-p.x,y-p.y) < radius+p.radius+8)) return false;
  const launch = stage.launch.position;
  if (Math.hypot(x-launch.x,y-launch.y) < radius+28) return false;
  return Math.hypot(x-stage.goal.x,y-stage.goal.y) >= radius+stage.goal.radius+12;
}
export function addPlanet(stage) {
  if (stage.planets.length >= (stage.rules?.maxPlanets??MAX_PLANETS)) return null;
  let index=1;
  while(stage.planets.some(p=>p.id===`added-${index}`)) index++;
  for(let y=80;y<stage.world.height;y+=20) for(let x=60;x<stage.world.width;x+=20) {
    const candidate=configurePlanet({id:`added-${index}`,x,y},stage.rules?.types[0]??'earth',stage.rules?.sizes[0]??'medium');
    if(placementAllowed(candidate,stage)) { stage.planets.push(candidate); return candidate; }
  }
  return null;
}
