export const MAX_PLANETS = 3;
const typeDefinition=(id,name,radius,mass,color,extra={})=>({id,name,radius,mass,color,gravityMultiplier:1,gravityDirection:1,collisionRadius:radius,hazards:[],effect:'solid',render:{style:'solid',glow:color},...extra});
export const PLANET_TYPES = Object.freeze({
  asteroid: typeDefinition('asteroid','小惑星',22,1800,'#d0b797'),
  earth: typeDefinition('earth','地球型',38,5200,'#6fd3ff'),
  gas: typeDefinition('gas','巨大ガス',48,8000,'#e9b677'),
  blackhole: typeDefinition('blackhole','ブラックホール',26,10000,'#170c2d',{gravityMultiplier:2,collisionRadius:0,hazards:[{radius:16,reason:'absorbed'}],effect:'absorption',render:{style:'blackhole',glow:'#d3a0ff'},description:'強い引力・中心の吸収領域に注意'}),
  repulsor: typeDefinition('repulsor','反重力惑星',28,3600,'#9880ff',{gravityDirection:-1,effect:'repulsion',render:{style:'repulsor',glow:'#9b82ff'},description:'ロケットを押し返す・表面への接触は失敗'}),
  star: typeDefinition('star','恒星',32,7000,'#ffbd45',{gravityMultiplier:1.4,hazards:[{radius:48,reason:'overheated'}],effect:'heat',render:{style:'star',glow:'#ff9d32'},description:'強い引力・外側の熱危険領域に注意'}),
  dense: typeDefinition('dense','高密度惑星',18,6800,'#8fa0b7',{effect:'dense',render:{style:'dense',glow:'#8fa0b7'},description:'小型・大質量・近距離で強く曲がる'}),
});
// 質量は半径の3乗ではなく明示倍率。通常惑星の最大は10400。
export const PLANET_SIZES = Object.freeze({
  small: { name: '小', radiusScale: .8, massScale: .7 },
  medium: { name: '中', radiusScale: 1, massScale: 1 },
  large: { name: '大', radiusScale: 1.2, massScale: 1.3 },
});
export function configurePlanet(planet, type = 'earth', size = 'medium') {
  const base = PLANET_TYPES[type], scale = PLANET_SIZES[size];
  const clean={...planet};
  for(const key of ['gravityMultiplier','gravityDirection','collisionRadius','hazards','effect','render'])delete clean[key];
  const result={ ...clean, type, size, radius: base.radius * scale.radiusScale, mass: base.mass * scale.massScale, color: base.color };
  // Preserve the exact legacy instances used by Stage01–10.
  if(base.effect!=='solid')Object.assign(result,{
    gravityMultiplier:base.gravityMultiplier,gravityDirection:base.gravityDirection,
    collisionRadius:base.collisionRadius*scale.radiusScale,
    hazards:base.hazards.map(h=>({...h,radius:h.radius*scale.radiusScale})),effect:base.effect,render:{...base.render},
  });
  return result;
}
export function planetExtent(planet){return Math.max(planet.radius,planet.collisionRadius??0,...(planet.hazards??[]).map(h=>h.radius));}
export function placementAllowed(candidate, stage) {
  const { x, y } = candidate;
  const radius=planetExtent(candidate);
  const rules=stage.rules;
  if(rules){
    if(!rules.types.includes(candidate.type??'earth')||!rules.sizes.includes(candidate.size??'medium'))return false;
    const r=rules.placement;
    if(x-radius<r.left||x+radius>r.right||y-radius<r.top||y+radius>r.bottom)return false;
  }
  if (x < radius || y < radius || x > stage.world.width-radius || y > stage.world.height-radius) return false;
  if (stage.planets.some(p => p.id !== candidate.id && Math.hypot(x-p.x,y-p.y) < radius+planetExtent(p)+8)) return false;
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
