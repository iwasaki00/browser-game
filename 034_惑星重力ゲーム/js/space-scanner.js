// Read-only presentation adapter. Never writes stage, simulation or progress.
import {PLANET_TYPES,planetExtent} from './planets.js';
import {ENCOUNTER_TYPES,encounterPosition} from './encounters.js';
import {DESTINATIONS} from './open-voyage.js';
import {targetAvailable,targetLabel,frontierTarget,discoveryEntry} from './frontier.js';
import {DEEP_GATE,DEEP_TARGETS,deepAvailable,deepLabel} from './deep-space.js';
import {FINAL_DESTINATIONS} from './final-voyage.js';

export const SCAN_FILTERS={all:'すべて',editable:'操作可能',planet:'惑星',exploration:'探索対象',danger:'危険領域',destination:'目的地'};
// rAF timestamps can precede a click's performance.now within the same frame.
export const scanPulse=(time,start)=>Math.max(0,Math.min(1,(time-start)/800));
export function planetPermissions(stage,p,phase='editing',gameMode='design'){
 const range=stage.rules?.planetRanges?.[p.id]??stage.rules?.placement??{left:0,top:0,right:stage.world.width,bottom:stage.world.height};
 const extent=planetExtent(p),w=range.right-range.left,h=range.bottom-range.top,room=w>=2*extent&&h>=2*extent&&(w>2*extent+1e-6||h>2*extent+1e-6);
 const movable=!p.fixed&&room&&(phase==='editing'||phase==='flying'&&gameMode==='live');
 const removable=phase==='editing'&&!p.fixed&&!stage.rules?.fixedPlanets&&stage.planets.length>(stage.rules?.minPlanets??0);
 const reason=p.fixed||!room?'この天体の位置は固定です':phase==='flying'&&gameMode!=='live'?'軌道設計では飛行中に移動できません':!['editing','flying'].includes(phase)?'RESET後に配置を調整できます':stage.rules?.planetRanges?.[p.id]?'許可された狭い配置範囲内で移動できます':'惑星・発射地点・ゴールを避けて移動できます';
 return {select:true,movable,removable,editable:movable||removable,reason,actions:['タップして選択できます',...(movable?['ドラッグで位置を変更できます']:[]),...(removable?['選択後に削除できます']:[])]};
}
export function scanObjects({stage,phase='editing',gameMode='design',playType='free',progress={},elapsed=0}){
 const rows=[];
 for(const [i,p]of stage.planets.entries()){
  const d=PLANET_TYPES[p.type??'earth'],permission=planetPermissions(stage,p,phase,gameMode),special=d.effect!=='solid';
  rows.push({id:'planet:'+p.id,sourceId:p.id,x:p.x,y:p.y,radius:planetExtent(p),name:`${d.name} ${i+1}`,type:d.name,icon:permission.editable?'✥':'🔒',color:permission.editable?'#6dffd3':'#b5bfd5',category:'planet',danger:true,special,permission,state:permission.editable?'操作可能':'位置操作不可',description:d.description??'引力でロケットの航路を曲げます。表面への接触は失敗。',method:permission.reason,destination:null});
 }
 for(const e of stage.encounters??[]){
  // The station in Sector09 is itself a hidden destination until detected.
  if(stage.openVoyage&&e.id==='voyage-station'&&!targetAvailable(progress.frontier,'station',progress.echoes))continue;
  if(stage.deepSpace&&e.id==='deep-structure'&&!deepAvailable(progress.deep,'DS03'))continue;
  const p=encounterPosition(e,elapsed),d=ENCOUNTER_TYPES[e.type];if(!d)continue;
  const editable=playType==='free'&&phase==='editing'&&!e.fixed;
  rows.push({id:'encounter:'+e.id,sourceId:e.id,...p,radius:e.reactionRadius??e.radius,name:d.name,type:d.name,icon:e.type==='station'?'▣':'◇',color:e.type==='station'?'#ffe0a1':'#d1a8ff',category:e.type==='station'?'exploration':'encounter',danger:e.type!=='station',permission:{editable,movable:editable,select:true,removable:editable,actions:editable?['タップして選択、ドラッグで配置、削除できます']:[],reason:editable?'フリープレイの発射前のみ配置を編集できます':'配置は固定です。接近・回避して航行します'},state:editable?'配置操作可能':'観測対象',description:d.description,method:e.type==='station'?'反応範囲へ接近してログを確認':'本体への接触を避け、予測航路を確認',destination:null});
 }
 const destinations=stage.finalVoyage?FINAL_DESTINATIONS:stage.deepSpace?[DEEP_GATE,...DEEP_TARGETS]:stage.openVoyage?DESTINATIONS:[stage.goal];
 for(const d of destinations){
  if(stage.openVoyage&&!targetAvailable(progress.frontier,d.id,progress.echoes)||stage.deepSpace&&!deepAvailable(progress.deep,d.id))continue;
  const f=stage.openVoyage?frontierTarget(d.id):null,entry=stage.deepSpace?progress.deep?.targets?.[d.id]:f?discoveryEntry(progress.frontier,d.id):null;
  const known=entry?.state==='INVESTIGATED',name=stage.deepSpace?deepLabel(progress.deep,d.id):stage.openVoyage?targetLabel(progress.frontier,d.id,progress.echoes):d.name??'ゴール';
  const isGoal=d.id===stage.goal.id||!stage.goal.id;
  const goalEditable=isGoal&&playType==='free'&&phase==='editing'&&Boolean(stage.worldPreset);
  const goalPermission={editable:goalEditable,movable:goalEditable,select:false,actions:goalEditable?['ドラッグでゴール位置を変更できます']:[],reason:goalEditable?'惑星と発射地点を避けて配置できます':'目的地は位置を操作できません'};
  rows.push({id:'destination:'+(d.id??'goal'),sourceId:d.id,x:d.x,y:d.y,radius:d.radius,name,type:['gate','return','earth'].includes(d.id)?'帰還地点':'目的地',icon:isGoal?'◎':'⚑',color:d.color??'#7bf3b5',category:!stage.openVoyage&&!stage.deepSpace&&!stage.finalVoyage||['gate','return','earth'].includes(d.id)?'destination':'exploration',danger:false,permission:goalPermission,state:entry?.state??(isGoal?'選択中の目的地':'航行先'),description:known?entry.information??'調査済みの航行先です':entry?'未解析の反応。接近・調査で情報を取得します':'実際に航行して領域内へ到達してください',method:f?.dock?'目的地に選択して寄港':f?.trackSeconds?`反応の近くを${f.trackSeconds}航行秒追跡`:f?`対象の${f.investigateRadius}単位以内へ接近`:stage.deepSpace&&entry?`${d.investigateRadius}単位以内へ接近`:d.id==='temporal-anomaly'?'既存の調査・観測判断を宇宙マップで確認':'予測を確認し、航路を調整して到達',destination:stage.openVoyage||stage.deepSpace||stage.finalVoyage?d.id:null});
 }
 return rows;
}
export const filterScan=(objects,filter)=>objects.filter(o=>filter==='editable'?o.permission.editable:filter==='planet'?o.category==='planet':filter==='exploration'?o.category==='exploration':filter==='danger'?o.danger:filter==='destination'?Boolean(o.destination)||o.category==='destination':true);
export function relativeTarget(target,center){const dx=target.x-center.x,dy=target.y-center.y,angle=Math.atan2(dy,dx),directions=['東','南東','南','南西','西','北西','北','北東'];return {distance:Math.hypot(dx,dy),direction:directions[(Math.round(angle/(Math.PI/4))+8)%8],angle};}
export const searchPlanets=(objects,center)=>objects.filter(o=>o.category==='planet'&&o.permission.editable).map(o=>({...o,...relativeTarget(o,center)})).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
export function cycleTarget(rows,id,delta){if(!rows.length)return null;const i=rows.findIndex(o=>o.id===id);return rows[((i<0?0:i)+delta+rows.length)%rows.length];}

// Edge buttons are laid out in reserved lanes. Extra targets use the list.
export function scanLayout(objects,camera,{top=58,bottom=80,left=8,right=8,max=6,blocked=[],selected=null}={}){
 const w=camera.width,h=camera.height,usable=h-top-bottom;if(w<220||usable<44)return [];
 const placed=[],rects=[...blocked],candidates=objects.map(o=>({...o,...relativeTarget(o,camera.center)})).sort((a,b)=>(b.id===selected)-(a.id===selected)||a.distance-b.distance);
 for(const o of candidates){
  const p=camera.toScreen(o),outside=p.x<0||p.x>w||p.y<0||p.y>h;
  let x,y,width=outside?120:124;
  if(outside){const dx=p.x-w/2,dy=p.y-h/2,t=Math.min((w/2-left-width/2)/Math.max(1,Math.abs(dx)),(usable/2-22)/Math.max(1,Math.abs(dy)));x=w/2+dx*Math.max(0,t)-width/2;y=top+usable/2+dy*Math.max(0,t)-22;}
  else{x=p.x+10;y=p.y-22;}
  x=Math.max(left,Math.min(w-right-width,x));y=Math.max(top,Math.min(h-bottom-44,y));
  // Limited candidates keep dense clusters legible without stacking arrows.
  const slots=[y,...Array.from({length:Math.floor((usable-44)/48)+1},(_,i)=>top+i*48),h-bottom-44];
  let rect;for(const yy of slots){const r={x,y:yy,width,height:44};if(rects.every(q=>r.x+r.width+4<q.x||q.x+q.width+4<r.x||r.y+48<q.y||q.y+q.height+4<r.y)){rect=r;break;}}
  if(!rect)continue;const arrow=['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(o.angle/(Math.PI/4))+8)%8];rects.push(rect);placed.push({id:o.id,...rect,outside,label:`${outside?o.direction+' '+arrow:o.icon} ${o.name}`,detail:`${Math.round(o.distance).toLocaleString()}単位 · ${o.type}`,angle:o.angle});if(placed.length>=max)break;
 }return placed;
}
export class ScannerCamera {
 constructor(camera){this.camera=camera;this.origin=null;this.motion=null;}
 show(target,time){const c=this.camera;this.origin??={center:{...c.center},zoom:c.zoom};const zoom=Math.max(c.minZoom,Math.min(c.maxZoom,Math.max(c.zoom,Math.min(1.2,90/(Math.max(1,target.radius)*c.baseScale)))));this.motion={start:time,from:{center:{...c.center},zoom:c.zoom},to:{center:{x:target.x,y:target.y},zoom}};c.mode='fixed';}
 restore(time){if(!this.origin)return false;const c=this.camera;this.motion={start:time,from:{center:{...c.center},zoom:c.zoom},to:this.origin};this.origin=null;c.mode='fixed';return true;}
 cancel(){this.motion=null;}
 clear(){this.cancel();this.origin=null;}
 update(time){if(!this.motion)return false;const m=this.motion,t=Math.max(0,Math.min(1,(time-m.start)/300)),f=t*t*(3-2*t),c=this.camera;c.center={x:m.from.center.x+(m.to.center.x-m.from.center.x)*f,y:m.from.center.y+(m.to.center.y-m.from.center.y)*f};c.zoom=m.from.zoom+(m.to.zoom-m.from.zoom)*f;c.clamp();if(t===1)this.motion=null;return true;}
}
