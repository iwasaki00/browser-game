import {MISSION_AREAS,PLAYER_CLASSES,WEAPON_BY_ID,WORLD} from './data.js?v=0.2.3';
import {followCamera} from './camera.js?v=0.2.2';
import {M06} from './mission06.js?v=0.6.0';
import {M05} from './mission05.js?v=0.5.0';
import {M04} from './mission04.js?v=0.4.1';
import {M03} from './mission03.js?v=0.3.1';
import {M02} from './mission02.js?v=0.2.2';
import {RunProfiler} from './profiler.js?v=0.3.1';

export const VALIDATION_MODES=Object.freeze({A:'地形到達性',B:'戦闘QA',C:'無敵QA',D:'通常プレイ条件'});
const checkpoint=(missionId,areaIndex,x,y,route='MAIN',boss=false)=>Object.freeze({
  id:`${missionId}-A${areaIndex+1}-${boss?'BOSS':route}`,missionId,areaId:`AREA ${String(areaIndex+1).padStart(2,'0')}`,areaIndex,
  name:(missionId==='M06'?M06.areas:missionId==='M05'?M05.areas:missionId==='M04'?M04.areas:missionId==='M03'?M03.areas:missionId==='M02'?M02.areas:MISSION_AREAS)[areaIndex].name,x,y,route,
  safety:{clearance:72,bodyWidth:14,bodyHeight:32},
  progression:{areaIndex,completedBeforeX:(missionId==='M06'?M06.areas:missionId==='M05'?M05.areas:missionId==='M04'?M04.areas:missionId==='M03'?M03.areas:missionId==='M02'?M02.areas:MISSION_AREAS)[areaIndex].x,midbossCleared:missionId==='M01'&&areaIndex>=3},
  enemies:{restore:'remaining-area-encounters',clearPrevious:true},
  midboss:{state:missionId==='M01'&&areaIndex===2?'pending':'not-active'},
  boss:{state:boss?'active':'pending',type:missionId==='M06'?'neuralheart':missionId==='M05'?'reactor':missionId==='M04'?'fortress':missionId==='M03'?'leviathan':missionId==='M01'?'boss':'queen'},
  nests:{state:missionId==='M02'?'restore-ahead':'none',destroyedBeforeX:x-72},
  camera:{mode:'AUTO',zoom:.5,direction:1,x:followCamera(x,.5,1,missionId==='M06'?M06.world:missionId==='M05'?M05.world:missionId==='M04'?M04.world:missionId==='M03'?M03.world:missionId==='M02'?M02.world:WORLD),anchorY:y+16},events:{clear:false,requiredNests:[],previousTimers:'cancel'}
});
export const LAB_CHECKPOINTS=Object.freeze([
  checkpoint('M01',0,64,116),checkpoint('M01',1,940,116),checkpoint('M01',2,1920,116),checkpoint('M01',3,2920,116),checkpoint('M01',4,3980,116),
  checkpoint('M02',0,64,116),checkpoint('M02',1,940,116),checkpoint('M02',2,2220,116,'LOWER'),checkpoint('M02',2,2220,40,'UPPER'),checkpoint('M02',3,3340,116),checkpoint('M02',4,4540,116),
  checkpoint('M03',0,64,116),checkpoint('M03',1,1140,116),checkpoint('M03',2,2340,116),checkpoint('M03',3,3740,116),checkpoint('M03',4,5160,116),checkpoint('M03',4,5500,116,'MAIN',true),
  checkpoint('M06',0,64,116),checkpoint('M06',1,1440,116),checkpoint('M06',2,3140,116),checkpoint('M06',3,4840,116),checkpoint('M06',4,6540,116),checkpoint('M06',4,7080,116,'MAIN',true),
  checkpoint('M05',0,64,116),checkpoint('M05',1,1440,92),checkpoint('M05',2,3060,116),checkpoint('M05',3,4660,116),checkpoint('M05',4,6260,116),checkpoint('M05',4,6880,116,'MAIN',true),
  checkpoint('M04',0,64,116),checkpoint('M04',1,1240,116),checkpoint('M04',2,2640,116),checkpoint('M04',3,4140,116),checkpoint('M04',4,5640,116),checkpoint('M04',4,6220,116,'MAIN',true),
  checkpoint('M01',4,4160,116,'MAIN',true),checkpoint('M02',4,4800,116,'MAIN',true)
]);
export function findCheckpoint(mission,area,route='LOWER',boss=false){return LAB_CHECKPOINTS.find(c=>c.missionId===mission&&c.areaIndex===Number(area)&&(c.boss.state==='active')===boss&&(mission!=='M02'||Number(area)!==2||c.route===route))}
export function validationClass(requested,lab,save){
  if(!Object.hasOwn(VALIDATION_MODES,requested))throw new Error('検証区分を選択してください');
  if(requested==='D'){
    if(lab.invincible||!Object.hasOwn(PLAYER_CLASSES,lab.preset)||lab.equipped.some(id=>!save.unlocked.includes(id)))throw new Error('Dは無敵OFF・正式兵科・解放済み武器2枠が必要です');
    return 'D';
  }
  return requested==='A'?'A':lab.invincible?'C':'B';
}

export class MissionLabRun {
  constructor(g,cp,mode){
    this.checkpoint=cp;this.mode=mode;this.outcome='RUNNING';this.elapsed=0;this.arrivals=[];this.damageTaken=0;this.weaponDamage={};this.kills=0;this.maxLiveEnemies=g.liveEnemies;
    this.startClass=g.lab.preset;this.startWeapons=[...g.lab.equipped];this.density=g.density;this.level=g.lab.settings.destructionLevel;this.startedInvincible=g.lab.invincible;
    this.gameOver=null;this.bossStartedAt=cp.boss.state==='active'?0:null;this.bossDefeatedAt=null;this.resultAt=null;this.warnings=[];this.changes=[];this.requiredNests=new Map();this.timers={};this.logged=new Set();
    this.lastX=g.player.x;this.lastY=g.player.y;this.lastDiagnostic=0;this.profile=new RunProfiler();this.arrive(g.area,g);
  }
  arrive(index,g){if(!this.arrivals.some(a=>a.areaIndex===index))this.arrivals.push({areaIndex:index,areaId:`AREA ${String(index+1).padStart(2,'0')}`,time:g.time,x:g.player.x,y:g.player.y})}
  damage(id,amount){const key=WEAPON_BY_ID.has(id)?id:'UNATTRIBUTED';this.weaponDamage[key]=(this.weaponDamage[key]??0)+Math.max(0,amount)}
  change(reason,g){
    this.changes.push({time:g.time,reason,class:g.lab.preset,weapons:[...g.lab.equipped],invincible:g.lab.invincible});if(this.changes.length>64)this.changes.shift();
    if(this.mode==='D'||this.mode==='B'||this.mode==='C')this.mode=g.lab.invincible?'C':'B';
  }
  warn(code,g,context={}){
    if(this.logged.has(code))return;this.logged.add(code);
    if(this.warnings.length>=128)this.warnings.shift();
    this.warnings.push({code,severity:'SUSPECTED',time:g.time,x:g.player.x,y:g.player.y,...context});
  }
  held(key,condition,dt,threshold,g,context){this.timers[key]=condition?(this.timers[key]??0)+dt:0;if(this.timers[key]>=threshold)this.warn(key,g,context)}
  tick(g,input,dt){
    this.elapsed=g.time;this.maxLiveEnemies=Math.max(this.maxLiveEnemies,g.liveEnemies);if(g.bossStarted&&this.bossStartedAt===null)this.bossStartedAt=g.time;
    if(g.time-this.lastDiagnostic<.2)return;
    const span=g.time-this.lastDiagnostic;this.lastDiagnostic=g.time;const p=g.player;
    const intent=(input.right?1:0)-(input.left?1:0),still=Math.abs(p.x-this.lastX)<.2&&Math.abs(p.y-this.lastY)<.2;
    let contact=null,onPlatform=false;
    for(const b of g.platforms){if(b.active===false)continue;const h=b.h??8;
      // M01 ground classes may jump through a one-way floor without reaching its top.
      // That legal ascent/descent is not a solid-terrain intrusion; a stationary embed is.
      const legalOneWayPass=!b.solid&&g.missionId==='M01'&&p.vy!==0&&p.classId!=='WING'&&g.lab.preset!=='FLIGHT';
      if(!legalOneWayPass&&p.x+7>b.x+.25&&p.x-7<b.x+b.w-.25&&p.y+32>b.y+.25&&p.y<b.y+h-.25)this.warn('TERRAIN_INTRUSION',g,{terrain:{x:b.x,y:b.y,w:b.w,h}});
      if(p.x+7>b.x&&p.x-7<b.x+b.w&&Math.abs(p.y+32-b.y)<.25)onPlatform=true;
      if(p.y+32>b.y&&p.y<b.y+h&&(intent>0&&Math.abs(p.x+7-b.x)<1||intent<0&&Math.abs(p.x-7-b.x-b.w)<1))contact=b;
    }
    this.held('OBSTACLE_STALL',!!intent&&still&&!!contact&&!p.dead,span,3,g,{input:{left:input.left,right:input.right,jump:input.jump,up:input.up},onGround:p.onGround,onPlatform,velocity:{x:p.vx,y:p.vy},terrain:contact&&{x:contact.x,y:contact.y,w:contact.w,h:contact.h??8}});
    this.held('PLATFORM_EXIT_STALL',!!intent&&still&&!!contact&&onPlatform,span,3,g,{jump:input.jump,flight:input.up});
    const threshold=g.missionId==='M06'?M06.bossX:g.missionId==='M05'?M05.bossX:g.missionId==='M04'?M04.bossX:g.missionId==='M03'?M03.bossX:g.missionId==='M02'?M02.bossX:4100;
    this.held('BOSS_EVENT_MISSING',this.mode!=='A'&&p.x>threshold+8&&!g.bossStarted&&!g.clear,span,1,g,{bossStarted:g.bossStarted,area:g.area});
    const leader=g.director.entries.some(e=>e.definition.enemy==='beetle'&&e.active&&!e.done);
    this.held('SPAWN_CAP_EVENT_STALL',leader&&!g.midbossAlive&&g.liveEnemies>=g.enemyLimit&&!g.clear,span,3,g,{enemies:g.liveEnemies,limit:g.enemyLimit});
    this.held('BOSS_RESULT_MISSING',this.bossDefeatedAt!==null&&g.time-this.bossDefeatedAt>3&&!g.clear,span,.2,g,{});
    for(const e of g.enemies)if(e.type==='nest'&&e.required&&!e.dead){
      const old=this.requiredNests.get(e.uid),range=WEAPON_BY_ID.get(g.lab.equipped[p.weaponSlot])?.range??0;
      const wait=old&&old.hp===e.hp&&input.fire&&Math.abs(e.x-p.x)<range?old.wait+span:0;
      this.requiredNests.set(e.uid,{hp:e.hp,wait});if(wait>5)this.warn(`REQUIRED_NEST_UNDAMAGED:${e.uid}`,g,{nestId:e.uid,hp:e.hp,range});
    }
    this.lastX=p.x;this.lastY=p.y;
  }
  snapshot(g){return {schemaVersion:1,missionId:this.checkpoint.missionId,areaId:this.checkpoint.areaId,checkpointId:this.checkpoint.id,route:this.checkpoint.route,
    validationMode:this.mode,validationLabel:VALIDATION_MODES[this.mode],coverage:this.checkpoint.areaIndex===0?'FROM_MISSION_START':'CHECKPOINT_ONLY',inputMethod:'MANUAL_OR_QA_NOT_AUTOMATICALLY_CERTIFIED',
    outcome:this.outcome,elapsed:this.elapsed,class:this.startClass,weapons:this.startWeapons,density:this.density,destructionLevel:this.level,startedInvincible:this.startedInvincible,
    startedWithGameplayQA:!!this.gameplayQA,gameplayQA:!!this.gameplayQA&&!g.lab.invincible&&Object.hasOwn(PLAYER_CLASSES,g.lab.preset)&&g.lab.equipped[0]==='A-01'&&g.lab.equipped[1]==='S-02'&&g.density==='STANDARD',
    areaArrivals:this.arrivals,damageTaken:this.damageTaken,kills:this.kills,weaponDamage:{...this.weaponDamage},remainingHp:this.finalHp??g.player.hp,gameOver:this.gameOver,
    bossStartPhase:this.bossStartPhase??null,bossStartedAt:this.bossStartedAt,bossDefeatedAt:this.bossDefeatedAt,bossDefeatTime:this.bossDefeatedAt===null?null:this.bossDefeatedAt-(this.bossStartedAt??0),
    maxLiveEnemies:this.maxLiveEnemies,performance:this.profile.snapshot(),diagnostics:[...this.warnings],configurationChanges:[...this.changes],
    normalProgressSaved:false,normalClearCertified:false};}
}
