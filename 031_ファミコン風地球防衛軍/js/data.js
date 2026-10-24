export const VERSION = "0.2.3-C";
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

// World units; shared by missions and the formal-class LAB tests.
export const PLAYER_CLASSES = Object.freeze({
  RANGER:Object.freeze({id:"RANGER",hp:100,speed:95,jump:220,damageScale:1,knockback:1,row:0,ability:"標準装備・安定した機動力"}),
  SCOUT:Object.freeze({id:"SCOUT",hp:75,speed:180,jump:253,damageScale:1,knockback:1,row:1,ability:"C：短距離ダッシュ（無敵なし）",dashSpeed:360,dashDuration:.16,dashCooldown:1.2}),
  GUARDIAN:Object.freeze({id:"GUARDIAN",hp:200,speed:65,jump:209,damageScale:.75,knockback:.55,row:2,ability:"被ダメージ25%・ノックバック45%軽減"}),
  WING:Object.freeze({id:"WING",hp:65,speed:110,jump:0,damageScale:1,knockback:1,row:3,ability:"W：上昇 / Space：ホバー / S：下降",energyMax:100,ascentDrain:20,hoverDrain:8,descentDrain:0,energyRecovery:25,flightRestartEnergy:20,ascentSpeed:110,downSpeed:80})
});
export const normalizeClass = id => Object.hasOwn(PLAYER_CLASSES,id)?id:"RANGER";

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

// Availability remains separate from saved progression.
export const MISSIONS = Object.freeze([
  {id:"M01",name:"市街地防衛線",description:"侵攻群を突破し、巣の中心を破壊せよ",implemented:true},
  {id:"M02",name:"地下侵攻作戦",description:"配管と上下分岐を突破し、アビス・クイーンを撃破せよ",implemented:true},
  {id:"M03",name:"次の防衛作戦",description:"今後のアップデートで追加予定",implemented:false}
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

export const WEAPON_CATEGORIES=Object.freeze({rapid:"連射・貫通",blast:"爆発",energy:"エネルギー",flame:"火炎",special:"特殊",support:"設置・支援"});
const LEGACY_CATEGORIES=["rapid","rapid","energy","blast","flame","special","blast","special"];
export const WEAPONS = [
  { id:"A-01", name:"アサルト", type:"bullet", damage:8, interval:.12, speed:310, range:340, color:"#37e8df", detail:"高速直進弾" },
  { id:"S-02", name:"ショットガン", type:"spread", damage:5, pellets:5, interval:.65, speed:260, range:150, spread:.34, color:"#ffe05c", detail:"5発拡散" },
  { id:"L-03", name:"レーザー", type:"laser", damage:5, interval:.08, speed:620, range:250, pierce:4, rehit:.08, color:"#6ffcff", detail:"貫通光線" },
  { id:"R-04", name:"ロケット", type:"rocket", damage:45, interval:1.1, speed:150, range:360, radius:34, color:"#ff8b42", detail:"爆発弾" },
  { id:"F-05", name:"フレイム", type:"flame", damage:3, interval:.07, speed:105, range:92, rehit:.14, color:"#ff4f6d", detail:"近距離火炎" },
  { id:"T-06", name:"サンダー", type:"thunder", damage:16, interval:.5, speed:400, range:180, chains:3, color:"#b88cff", detail:"3体連鎖" },
  { id:"G-07", name:"グレネード", type:"grenade", damage:55, interval:.9, speed:145, range:280, gravity:330, radius:42, color:"#72df8f", detail:"放物線爆発" },
  { id:"H-08", name:"ホーミング", type:"homing", damage:20, pellets:2, interval:.8, speed:135, range:400, turn:3.8, color:"#fff08b", detail:"2発誘導" },
  {id:"B-09",name:"バウンドレーザー",type:"bounce",category:"energy",damage:13,interval:.35,speed:300,range:900,bounces:3,color:"#6ffcff",effectType:"laser",detail:"地面・足場・世界端で3回反射"},
  {id:"R-10",name:"スプリットロケット",type:"split",category:"blast",damage:18,interval:1.6,speed:140,range:360,radius:20,children:5,maxGeneration:1,splitAfter:.38,proximity:56,color:"#ff8b42",effectType:"rocket",detail:"1世代のみ5発へ分裂・個別爆発"},
  {id:"X-11",name:"チェインボム",type:"chain",category:"blast",damage:32,interval:2,speed:145,range:340,radius:38,chainLimit:6,chainDelay:.10,color:"#ff4f6d",effectType:"grenade",detail:"撃破起点で最大6爆発・キュー処理"},
  {id:"P-12",name:"ドリルショット",type:"drill",category:"rapid",damage:22,interval:.45,speed:360,range:400,pierce:8,color:"#ffe05c",effectType:"laser",detail:"最大8体貫通・同じ敵には1回"},
  {id:"P-13",name:"プラズマキャノン",type:"plasma",category:"energy",damage:65,interval:1.4,speed:95,range:340,radius:36,size:20,color:"#37e8df",effectType:"rocket",detail:"低速大型弾・範囲内へ1回65ダメージ"},
  {id:"G-14",name:"クラスターグレネード",type:"cluster",category:"blast",damage:12,interval:1.8,speed:145,range:240,radius:26,gravity:330,children:8,maxGeneration:1,fuse:.8,color:"#72df8f",effectType:"grenade",detail:"親弾から8子爆弾・再分裂なし"},
  {id:"F-15",name:"ワイドフレイム",type:"wideflame",category:"flame",damage:4,interval:.12,speed:125,range:110,pellets:5,spread:.32,rehit:.18,color:"#ff4f6d",effectType:"flame",detail:"扇状5粒子・粒子ごと0.18秒間隔"},
  {id:"T-16",name:"ライトニングストーム",type:"storm",category:"special",damage:18,interval:2.2,speed:1,range:380,life:2.2,strikes:8,strikeInterval:.24,targetRadius:120,targetLimit:2,color:"#b88cff",effectType:"thunder",detail:"雷雲から8落雷・同一対象は2回まで"},
  {id:"S-17",name:"スパイラルショット",type:"spiral",category:"rapid",damage:9,interval:.18,speed:235,range:350,pellets:2,amplitude:10,frequency:14,color:"#fff08b",effectType:"laser",detail:"逆位相の2発螺旋・実座標で命中"},
  {id:"M-18",name:"リモートマイン",type:"mine",category:"support",damage:70,interval:.8,speed:1,range:180,life:20,radius:48,installLimit:3,color:"#ff4f6d",effectType:"grenade",detail:"最大3個・V / SW長押しで一斉起爆"},
  {id:"D-19",name:"オートタレット",type:"turret",category:"support",damage:7,interval:3,speed:260,range:240,life:15,installLimit:2,shotInterval:.32,color:"#37e8df",effectType:"bullet",detail:"最大2基・15秒稼働・近傍を自動射撃"},
  {id:"M-20",name:"メテオランチャー",type:"meteor",category:"special",damage:35,interval:2.8,speed:220,range:420,life:2,strikes:6,strikeInterval:.18,radius:34,color:"#ff8b42",effectType:"rocket",detail:"照準付近へ6発を時間差降下"}
].map((w,index)=>Object.freeze({category:LEGACY_CATEGORIES[index],life:w.range/w.speed,pierce:0,bounces:0,radius:0,effectType:w.type,specialEffect:w.type,assetId:w.id,assetIndex:index,expanded:index>=8,...w}));
export const WEAPON_BY_ID=new Map(WEAPONS.map(w=>[w.id,w]));
if(WEAPON_BY_ID.size!==WEAPONS.length)throw new Error("Duplicate weapon ID");

export const ENEMY_TYPES = {
  crawler:{ id:"E-01", name:"グランドクロウラー", hp:24, speed:45, damage:10, score:100, w:28, h:20, row:0 },
  spider:{ id:"E-02", name:"ウォールスパイダー", hp:35, speed:35, damage:12, score:180, w:25, h:22, row:1 },
  needle:{ id:"E-03", name:"スカイニードル", hp:18, speed:70, damage:8, score:150, w:26, h:16, row:2 },
  beetle:{ id:"E-04", name:"アイアンビートル", hp:180, speed:18, damage:20, score:1200, w:42, h:40, row:3 },
  boss:{ id:"B-01", name:"マザークロウラー", hp:1200, speed:42, damage:25, score:10000, w:88, h:58, row:0 },
  worm:{id:"E-05",name:"トンネルワーム",hp:32,speed:72,damage:9,score:140,w:32,h:20},
  spitter:{id:"E-06",name:"シーリングスピッター",hp:55,speed:0,damage:12,score:240,w:28,h:24},
  nest:{id:"H-01",name:"スポーンネスト",hp:250,speed:0,damage:0,score:1500,w:48,h:48},
  queen:{id:"B-02",name:"アビス・クイーン",hp:2400,speed:120,damage:25,score:18000,w:120,h:96},
  barrier:{id:"O-01",name:"破壊障害物",hp:48,speed:0,damage:0,score:50,w:24,h:32}
};

export const MISSION_AREAS = [
  {x:0, name:"侵略開始"},{x:900,name:"包囲網"},{x:1900,name:"装甲敵出現"},{x:2900,name:"最終防衛区画"},{x:3950,name:"巣の中心"}
];

export const DESTRUCTION_LEVELS=Object.freeze({
  1:Object.freeze({id:1,name:"STANDARD",speed:1,spin:1,particles:1,explosion:1,shake:1,life:1,trails:0,trailAlpha:0,fragmentSpeed:1,gravity:1,bounce:false}),
  2:Object.freeze({id:2,name:"POWERFUL",speed:1.8,spin:1.5,particles:1.5,explosion:1.4,shake:1.3,life:1.2,trails:1,trailAlpha:.13,fragmentSpeed:1,gravity:1.8,bounce:true}),
  3:Object.freeze({id:3,name:"EXTREME",speed:3,spin:2.5,particles:2.5,explosion:1.8,shake:1.6,life:1.4,trails:3,trailAlpha:.24,fragmentSpeed:1.45,gravity:3,bounce:true})
});
export function normalizeDestructionLevel(value){return (typeof value==="number"||typeof value==="string")&&Object.hasOwn(DESTRUCTION_LEVELS,value)?Number(value):1}

export const DEFAULT_SAVE = Object.freeze({
  version:2, selectedClass:"RANGER", clearedMissions:[], unlockedMissions:["M01"], unlocked:["A-01","S-02"], equipped:["A-01","S-02"], highScore:0,
  bestTime:null, missionStats:{}, settings:{sound:true, volume:.65, shake:true, touchAim:"relative",enemyDensity:"STANDARD",destructionLevel:1}
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
  base.selectedClass=normalizeClass(value.selectedClass);
  Object.assign(base,missionProgress(value));
  base.highScore=Number.isFinite(value.highScore)?Math.max(0,Math.floor(value.highScore)):0;
  base.bestTime=Number.isFinite(value.bestTime)&&value.bestTime>0?value.bestTime:null;
  if(value.missionStats&&typeof value.missionStats==='object')for(const [id,stats] of Object.entries(value.missionStats)){
    if(!validMissionId(id)||!stats||typeof stats!=='object')continue;
    base.missionStats[id]={highScore:Number.isFinite(stats.highScore)?Math.max(0,stats.highScore):0,bestTime:Number.isFinite(stats.bestTime)&&stats.bestTime>0?stats.bestTime:null};
  }
  if(base.clearedMissions.includes('M01')&&!base.missionStats.M01)base.missionStats.M01={highScore:base.highScore,bestTime:base.bestTime};
  if(value.settings && typeof value.settings==="object") base.settings={...base.settings,...value.settings};
  if(!Object.hasOwn(DENSITY_MODES,base.settings.enemyDensity))base.settings.enemyDensity="STANDARD";
  base.settings.destructionLevel=normalizeDestructionLevel(base.settings.destructionLevel);
  if(typeof base.settings.shake!=="boolean")base.settings.shake=true;
  return base;
}

export function pickReward(unlocked, random=Math.random,firstClear=true){
  const remaining=WEAPONS.map(w=>w.id).filter(id=>!unlocked.includes(id));
  if(firstClear&&!unlocked.includes("L-03")) return "L-03";
  if(!remaining.length) return null;
  return remaining[Math.floor(random()*remaining.length)];
}
