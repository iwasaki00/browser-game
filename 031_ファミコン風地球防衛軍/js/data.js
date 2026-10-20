export const VERSION = "0.1.6";
export const SAVE_KEY = "pixel-defense-front-save-v1";
export const WORLD = { width: 4800, height: 180, ground: 148, gravity: 620, maxFall: 280 };
export const VIEW = Object.freeze({
  canvasWidth: 320,
  canvasHeight: 180
});

export const BATTLE_CAMERA = Object.freeze({
  minZoom: .35, maxZoom: .85, idleZoom: .50,
  evaluationDistance: 600, bandWidth: 100, evaluationInterval: .15,
  distanceFalloff: 215, farZoom: .38,
  crowdPenalty: .006, maxCrowdPenalty: .08,
  crowdFreeCount: 3, isolationDistance: 200, isolatedGroupLimit: 2,
  rearWeight: .65, isolatedFarWeight: .18,
  groupPadding: 48, groupScreenFraction: .80,
  zoomDeadband: .015, candidateTolerance: .04,
  engageHold: .30, idleHold: .45,
  zoomInRate: 2.2, zoomOutRate: 2.6, positionRate: 5, directionRate: 4,
  lookAhead: 32, playerMargin: 56,
  bossMinZoom: .35, bossMaxZoom: .65, bossPadding: 100,
  midbossMaxZoom: .70, midbossPadding: 80
});

export const visibleWorldWidth = zoom => VIEW.canvasWidth / zoom;

export const DENSITY_MODES = Object.freeze({
  LIGHT:{limit:30,scale:.6}, STANDARD:{limit:50,scale:1}, MASSIVE:{limit:100,scale:2}
});
export const INVASION = Object.freeze({
  gridSize:64, minSpawnDistance:180, outsideMargin:36, columnSpacing:23, columns:12,
  speedVariation:.10, separationRadius:26, separationSpeed:18, separationVerticalSpeed:12,
  contactLanes:9, contactSpacing:7, approachRange:32,
  farDistance:900, farThinkInterval:.12, maxEffects:80, maxDeathSprites:16,
  normalShotGap:.24, normalAttackWindow:.5, normalStartsPerWindow:2, maxNormalProjectiles:28,
  diveGap:.35, diveDuration:.8, diveCooldown:2.4, simultaneousDives:2,
  midbossEscorts:{LIGHT:6,STANDARD:8,MASSIVE:12}, bossMinions:{LIGHT:8,STANDARD:12,MASSIVE:18}
});

// Templates are available to future missions; only entries in M01_ENCOUNTERS are scheduled.
export const SPAWN_PATTERNS = Object.freeze({
  WAVE:{batch:3,interval:.35}, SWARM:{batch:8,interval:.06},
  PINCER:{batch:4,interval:.25,sides:"both"}, AIR_RAID:{batch:5,interval:.18,enemy:"needle"},
  REINFORCEMENT:{batch:3,interval:1.2,below:.35}
});
export const M01_ENCOUNTERS = Object.freeze([
  {id:"a1-intro",x:260,until:850,pattern:"WAVE",enemy:"crawler",count:8,batch:2,interval:.65},
  {id:"a1-rise",x:550,until:900,pattern:"WAVE",enemy:"crawler",fraction:.32,batch:3,interval:.35},
  {id:"a1-air",x:720,until:1100,pattern:"WAVE",enemy:"needle",count:6,batch:2,interval:.45},
  {id:"a2-swarm",x:1000,until:1750,pattern:"SWARM",enemy:"crawler",fraction:.90},
  {id:"a2-ceiling",x:1300,until:1750,pattern:"WAVE",enemy:"spider",count:6,batch:2,interval:.8},
  {id:"a2-air",x:1580,until:1850,pattern:"WAVE",enemy:"needle",count:10,batch:3,interval:.4},
  {id:"a3-midboss",x:1980,pattern:"WAVE",enemy:"beetle",count:1,unscaled:true,fixedX:2180},
  {id:"a3-escort",x:2020,until:2160,pattern:"WAVE",enemy:"crawler",count:4,batch:1,interval:1.1,midbossOnly:true},
  {id:"a3-recovery",x:2290,until:2800,pattern:"WAVE",enemy:"crawler",fraction:.25,afterMidboss:true},
  {id:"a3-air",x:2600,until:2880,pattern:"WAVE",enemy:"needle",count:8,afterMidboss:true},
  {id:"a4-wave",x:2940,until:3820,pattern:"WAVE",enemy:"crawler",fraction:.70,batch:5,interval:.15},
  {id:"a4-swarm",x:3090,until:3880,pattern:"SWARM",enemy:"crawler",fraction:1.25,batch:10,interval:.06},
  {id:"a4-air",x:3330,until:3890,pattern:"WAVE",enemy:"needle",fraction:.30,batch:4,interval:.3},
  {id:"a4-ceiling",x:3500,until:3890,pattern:"SWARM",enemy:"spider",fraction:.20,batch:3,interval:.3},
  {id:"a4-final",x:3720,until:3950,pattern:"SWARM",enemy:"crawler",fraction:.70,batch:8,interval:.1}
]);

// Availability is separate from saved progression. M02 has no playable content yet.
export const MISSIONS = Object.freeze([
  {id:"M01",name:"市街地防衛線",description:"侵攻群を突破し、巣の中心を破壊せよ",implemented:true},
  {id:"M02",name:"次の防衛作戦",description:"今後のアップデートで追加予定",implemented:false}
]);

const validMissionId = id => typeof id==="string" && /^M\d{2,}$/.test(id) && Number(id.slice(1))>0 && Number.isSafeInteger(Number(id.slice(1)));
const missionIds = value => Array.isArray(value)?value.filter(validMissionId):[];
export function missionProgress(value={}){
  const clearedMissions=[...new Set([...missionIds(value.cleared),...missionIds(value.clearedMissions)])];
  const next=clearedMissions.map(id=>`M${String(Number(id.slice(1))+1).padStart(2,"0")}`);
  const unlockedMissions=[...new Set(["M01",...missionIds(value.unlockedMissions),...clearedMissions,...next])];
  return {clearedMissions,unlockedMissions};
}
export function missionStatus(mission,progress){
  if(!mission.implemented)return "COMING SOON";
  if(progress.clearedMissions.includes(mission.id))return "CLEAR";
  return progress.unlockedMissions.includes(mission.id)?"OPEN":"LOCKED";
}
export function canPlayMission(id,progress,missions=MISSIONS){
  const mission=missions.find(m=>m.id===id);
  return !!mission?.implemented && progress.unlockedMissions.includes(id);
}
export function recordMissionClear(value,id){
  if(!validMissionId(id))return sanitizeSave(value);
  return sanitizeSave({...value,clearedMissions:[...(value.clearedMissions||[]),id]});
}

export const WEAPONS = [
  { id:"A-01", name:"アサルト", type:"bullet", damage:8, interval:.12, speed:310, range:340, color:"#37e8df", detail:"高速直進弾" },
  { id:"S-02", name:"ショットガン", type:"spread", damage:5, pellets:5, interval:.65, speed:260, range:150, spread:.34, color:"#ffe05c", detail:"5発拡散" },
  { id:"L-03", name:"レーザー", type:"laser", damage:5, interval:.08, speed:620, range:250, pierce:4, rehit:.08, color:"#6ffcff", detail:"貫通光線" },
  { id:"R-04", name:"ロケット", type:"rocket", damage:45, interval:1.1, speed:150, range:360, radius:34, color:"#ff8b42", detail:"爆発弾" },
  { id:"F-05", name:"フレイム", type:"flame", damage:3, interval:.07, speed:105, range:92, rehit:.14, color:"#ff4f6d", detail:"近距離火炎" },
  { id:"T-06", name:"サンダー", type:"thunder", damage:16, interval:.5, speed:400, range:180, chains:3, color:"#b88cff", detail:"3体連鎖" },
  { id:"G-07", name:"グレネード", type:"grenade", damage:55, interval:.9, speed:145, range:280, gravity:330, radius:42, color:"#72df8f", detail:"放物線爆発" },
  { id:"H-08", name:"ホーミング", type:"homing", damage:20, pellets:2, interval:.8, speed:135, range:400, turn:3.8, color:"#fff08b", detail:"2発誘導" }
];

export const ENEMY_TYPES = {
  crawler:{ id:"E-01", name:"グランドクロウラー", hp:24, speed:45, damage:10, score:100, w:28, h:20, row:0 },
  spider:{ id:"E-02", name:"ウォールスパイダー", hp:35, speed:35, damage:12, score:180, w:25, h:22, row:1 },
  needle:{ id:"E-03", name:"スカイニードル", hp:18, speed:70, damage:8, score:150, w:26, h:16, row:2 },
  beetle:{ id:"E-04", name:"アイアンビートル", hp:180, speed:18, damage:20, score:1200, w:42, h:40, row:3 },
  boss:{ id:"B-01", name:"マザークロウラー", hp:1200, speed:42, damage:25, score:10000, w:88, h:58, row:0 }
};

export const MISSION_AREAS = [
  {x:0, name:"侵略開始"},{x:900,name:"包囲網"},{x:1900,name:"装甲敵出現"},{x:2900,name:"最終防衛区画"},{x:3950,name:"巣の中心"}
];

export const DEFAULT_SAVE = Object.freeze({
  version:2, clearedMissions:[], unlockedMissions:["M01"], unlocked:["A-01","S-02"], equipped:["A-01","S-02"], highScore:0,
  bestTime:null, settings:{sound:true, volume:.65, shake:true, touchAim:"relative",enemyDensity:"STANDARD"}
});

export const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function sanitizeSave(value){
  const base=JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if(!value || typeof value!=="object" || ![1,2].includes(value.version)) return base;
  const validIds=new Set(WEAPONS.map(w=>w.id));
  const unlocked=Array.isArray(value.unlocked)?value.unlocked.filter(x=>validIds.has(x)):base.unlocked;
  base.unlocked=[...new Set(["A-01","S-02",...unlocked])];
  const equipped=Array.isArray(value.equipped)?value.equipped.filter(x=>base.unlocked.includes(x)).slice(0,2):base.equipped;
  base.equipped=equipped.length===2?equipped:base.equipped;
  Object.assign(base,missionProgress(value));
  base.highScore=Number.isFinite(value.highScore)?Math.max(0,Math.floor(value.highScore)):0;
  base.bestTime=Number.isFinite(value.bestTime)&&value.bestTime>0?value.bestTime:null;
  if(value.settings && typeof value.settings==="object") base.settings={...base.settings,...value.settings};
  if(!Object.hasOwn(DENSITY_MODES,base.settings.enemyDensity))base.settings.enemyDensity="STANDARD";
  return base;
}

export function pickReward(unlocked, random=Math.random){
  const remaining=WEAPONS.map(w=>w.id).filter(id=>!unlocked.includes(id));
  if(!unlocked.includes("L-03")) return "L-03";
  if(!remaining.length) return null;
  return remaining[Math.floor(random()*remaining.length)];
}
