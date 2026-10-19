export const VERSION = "0.1.0";
export const SAVE_KEY = "pixel-defense-front-save-v1";
export const WORLD = { width: 4800, height: 180, ground: 148, gravity: 620, maxFall: 280 };

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

export const SPAWNS = [
  [360,"crawler",4,60],[720,"needle",3,75],[1050,"crawler",7,42],[1300,"spider",3,100],
  [1600,"needle",6,48],[1980,"beetle",1,0],[2180,"crawler",7,40],[2500,"spider",5,60],
  [2850,"needle",7,42],[3200,"crawler",10,34],[3450,"spider",5,55],[3720,"needle",8,38]
];

export const DEFAULT_SAVE = Object.freeze({
  version:1, cleared:[], unlocked:["A-01","S-02"], equipped:["A-01","S-02"], highScore:0,
  bestTime:null, settings:{sound:true, volume:.65, shake:true, touchAim:"relative"}
});

export const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function sanitizeSave(value){
  const base=JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if(!value || typeof value!=="object" || value.version!==1) return base;
  const validIds=new Set(WEAPONS.map(w=>w.id));
  const unlocked=Array.isArray(value.unlocked)?value.unlocked.filter(x=>validIds.has(x)):base.unlocked;
  base.unlocked=[...new Set(["A-01","S-02",...unlocked])];
  const equipped=Array.isArray(value.equipped)?value.equipped.filter(x=>base.unlocked.includes(x)).slice(0,2):base.equipped;
  base.equipped=equipped.length===2?equipped:base.equipped;
  base.cleared=Array.isArray(value.cleared)?value.cleared.filter(x=>x==="M01"):[];
  base.highScore=Number.isFinite(value.highScore)?Math.max(0,Math.floor(value.highScore)):0;
  base.bestTime=Number.isFinite(value.bestTime)&&value.bestTime>0?value.bestTime:null;
  if(value.settings && typeof value.settings==="object") base.settings={...base.settings,...value.settings};
  return base;
}

export function pickReward(unlocked, random=Math.random){
  const remaining=WEAPONS.map(w=>w.id).filter(id=>!unlocked.includes(id));
  if(!unlocked.includes("L-03")) return "L-03";
  if(!remaining.length) return null;
  return remaining[Math.floor(random()*remaining.length)];
}
