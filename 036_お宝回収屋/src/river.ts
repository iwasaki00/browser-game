import {worldUnlocked,environment} from './world-rules';
import {RIVER_ADDED,riverObservation,fieldProfiles} from './field-tools';
import {CONFIG,treasure,tool} from './data';
import type {Find,Plot,State} from './engine';
import {finishQuality,recordRecovery} from './tool-value';
import {goldAreaUnlocked} from './gold';
import {measure} from './measure';
import {logEvent} from './events';

export const RIVER_TOOLS=[...RIVER_ADDED,'R101','R106','R103','R104','R110','R201','R206'];
export type RiverPhase='empty'|'hooked'|'reeling'|'lifting';
export interface RiverSession {tool:string;x:number;y:number;originX:number;originY:number;uid?:string;progress:number;phase:RiverPhase;elapsed:number;magnetic:boolean;operations:number;}
export interface RiverMetrics {attempts:number;successes:number;operations:number;uses:Record<string,number>;failures:Record<string,number>;bottleneck:string;}
export const areaId=(s:State)=>s.explorationAreas[0].areaId??'B-A';
export const isRiver=(s:State)=>areaId(s).startsWith('R-');
export function beachCount(s:State){return Object.entries(s.discoveredTreasures).filter(([id])=>id.startsWith('B')).reduce((n,[,d])=>n+d.count,0);}
export function areaUnlocked(s:State,id:string){return worldUnlocked(s,id)||goldAreaUnlocked(s,id)||id==='B-A'||id==='R-A'&&beachCount(s)>=10||id==='R-B'&&beachCount(s)>=20;}
function random(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function generateRiver(seed:number,area='R-A'):Plot {
 const r=random(seed),items:Find[]=[];
 // Every free plot contains reachable, unobstructed earnings even with bare hands.
 for(let i=0;i<14;i++){
  const shallow=i<6,ids=area==='R-A'?['R001','R002','R003','R004','R005','R009']:['R004','R005','R006','R007','R009'];
  const id=shallow?['R001','R002','R003'][i%3]:ids[Math.floor(r()*ids.length)],t=treasure(id),quality=.8+r()*.4;
  items.push({uid:`${area}:${seed}:${i}`,id,x:25+r()*310,y:shallow?235+r()*28:35+r()*180,depth:shallow?15:50+r()*150,weight:t.weight,magnetic:t.magnetic,material:t.material,difficulty:shallow?1:area==='R-B'?2:1,obstacle:!shallow&&area==='R-B'&&(i%3===0),areaId:area,initialQuality:quality,quality,state:'buried',tool:'hand'});
 }
 return {id:`${area}-${seed}`,areaId:area,seed,mask:Array(1008).fill(0),items};
}
export function riverCapabilities(s:State,id:string){
 const equipped=new Set(s.equippedTools.filter(t=>s.ownedTools.includes(t)));const valid=id==='hand'||RIVER_TOOLS.includes(id)&&s.ownedTools.includes(id);
 const magnetic=['R103','R104','R201','R202'].includes(id),rope=magnetic&&(id==='R104'||equipped.has('R104'));
 const strong=magnetic&&(id==='R201'||equipped.has('R201'));
 const reel=rope&&equipped.has('R110'),pulley=rope&&strong&&equipped.has('R206');
 const camera=equipped.has('R204')&&id==='R205',meter=equipped.has('R210');
 return {camera,meter,valid:valid&&!['R110','R206','R204','R210'].includes(id),magnetic,rope,strong,reel,pulley,
  reach:id==='R205'?330:rope?265+(s.automationAccess&&['R-C','R-D'].includes(areaId(s))&&s.ownedTools.includes('R301')?75:0):id==='R102'?190:id==='R203'?245:id==='hand'?55:id==='R101'?130:id==='R106'?210:105,
  radius:id==='R202'?48:magnetic?(strong?32:24):id==='R101'?24:18,
  adhesion:magnetic?(strong?18:id==='R202'?12:id==='R104'?4:3):Infinity,
  lift:(pulley?22*(s.automationAccess&&['R-C','R-D'].includes(areaId(s))&&s.ownedTools.includes('R301')?2.3:1):strong?8:id==='R202'?6:id==='R205'?(camera?4.5:3.2):id==='R203'?7:id==='R102'?1.5:id==='hand'?.75:id==='R101'?2:id==='R106'?2.2:3)*(1+Math.min(.25,Math.floor(s.playerStats.xp[0]/CONFIG.xpPerLevel)*.01)),
  speed:(reel?2.6:1)*(id==='R103'?1.35:1)/(s.explorationAreas[0].worldVersion?environment(s.explorationAreas[0]).current:1),hook:['R106','R203'].includes(id),combos:[...(reel?['C05']:[]),...(pulley?['C06']:[]),...(camera?['C07']:[])]};
}
export function metrics(s:State){return s.riverMetrics??={attempts:0,successes:0,operations:0,uses:{},failures:{},bottleneck:'なし'};}
function failure(s:State,reason:string){const m=metrics(s);m.failures[reason]=(m.failures[reason]??0)+1;m.bottleneck=reason;measure(s,s.riverSession?.tool??'hand','引上げ失敗',0,0,0,false);logEvent(s,/磁石が弱く|磁石に付かない/.test(reason)?'吸着失敗':/重く/.test(reason)?'引き上げ失敗':'回収失敗',reason);return {ok:false,reason};}
export function riverCheck(s:State,id:string,f:Find,includeLift=true){
 const c=riverCapabilities(s,id),weight=f.weight??treasure(f.id).weight;
 if(!c.valid)return '回収道具を選んでください。巻取り器・滑車は装備枠で組み合わせます。';
 if(f.automationJob&&s.automationAccess!==f.automationJob)return '設備に登録中です。設備パネルで作業を確認してください';
 if(!isRiver(s)||f.state!=='buried')return '回収済みです。';
 if((c.rope?Math.hypot(f.x-180,278-f.y):280-f.y)>c.reach)return c.rope?'ロープが届かない。岸に近い場所を狙おう。':'届かない。もっと長い道具が必要そうだ。';
 if(f.obstacle&&!(c.hook||c.camera&&f.riverCameraObserved))return '岩の隙間に引っかかっている。回収フックが必要そうだ。';
 if(c.magnetic&&!(f.magnetic??treasure(f.id).magnetic))return '磁石に付かない金属のようだ。トングやフックを試そう。';
 if(c.magnetic&&weight>c.adhesion)return '磁石が弱くて外れてしまう。強力な磁石が必要そうだ。';
 if(includeLift&&weight>(c.camera&&!f.riverCameraObserved?Math.min(c.lift,3.2):c.lift))return '重くて引き上げられない。もっと強い道具が必要そうだ。';
 return '';
}
export function riverStart(s:State,id:string,x:number,y:number,cast=false){
 if(!isRiver(s))return {ok:false,reason:'川底で使用します。'};
 if(riverObservation(id))return riverObserve(s,id,x,y);
 const m=metrics(s);m.attempts++;m.uses[id]=(m.uses[id]??0)+1;
 const c=riverCapabilities(s,id);if(!c.valid)return failure(s,'回収道具を選んでください。');
 if(c.rope&&!cast)return failure(s,'岸から水底へスワイプして磁石を投げよう。');
 const distance=Math.hypot(x-180,y-278),ratio=Math.min(1,c.reach/Math.max(1,distance));
 const target=c.rope?{x:180+(x-180)*ratio,y:278+(y-278)*ratio}:{x,y};
 const candidates=s.explorationAreas[0].items.filter(f=>f.state==='buried'&&(!f.automationJob||f.automationJob===s.automationAccess)&&Math.hypot(f.x-target.x,f.y-target.y)<=c.radius*(s.explorationAreas[0].worldVersion&&!f.riverCameraObserved?.75+.25*environment(s.explorationAreas[0]).visibility:1)).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y));
 const f=candidates[0];logEvent(s,c.rope?'磁石投擲':'対象選択',`${id} / ${target.x.toFixed(0)},${target.y.toFixed(0)}`);
 s.riverSession={tool:id,...target,originX:180,originY:278,progress:0,phase:'empty',elapsed:0,magnetic:c.magnetic,operations:0};
 if(!f)return failure(s,c.rope&&distance>c.reach?'ロープが届かない。もう少し近くを狙おう。':'手応えなし。違う場所を探そう。');
 if(s.explorationAreas[0].worldVersion&&f.obstacle&&(id==='R203'||c.camera&&f.riverCameraObserved)&&(280-f.y)<=c.reach&&(f.weight??treasure(f.id).weight)>c.lift){f.obstacle=false;logEvent(s,'障害物の解除',f.uid);delete s.riverSession;return {ok:false,reason:'引っかかりを外した。磁石や巻上げ構成へ持ち替えて再挑戦しよう。'};}
 const reason=riverCheck(s,id,f,c.meter&&!!f.riverLoadMeasured);if(reason)return failure(s,reason);
 s.riverSession.uid=f.uid;s.riverSession.phase='hooked';measure(s,id,'吸着・把持',1,0);logEvent(s,c.magnetic?'磁石吸着':'つかんだ','何かが引っかかった');return {ok:true,reason:'何かが引っかかった！ 手前へドラッグして引き上げよう。'};
}
export function riverPull(s:State,amount=50){
 const r=s.riverSession;if(!isRiver(s)||!r?.uid||r.phase==='empty'||!Number.isFinite(amount)||amount<=0)return {ok:false,reason:'対象をつかんでから引こう。',recovered:false};
 const f=s.explorationAreas[0].items.find(f=>f.uid===r.uid);if(!f||f.state!=='buried'){delete s.riverSession;return {ok:false,reason:'回収済み、または対象がありません。',recovered:false};}
 const reason=riverCheck(s,r.tool,f);if(reason){s.riverSession=undefined;return {...failure(s,reason),recovered:false};}
 const c=riverCapabilities(s,r.tool),weight=f.weight??treasure(f.id).weight;
 const beforeProgress=r.progress,beforeStamina=s.playerStats.stamina;r.operations++;metrics(s).operations++;r.progress=Math.min(1,r.progress+Math.min(100,amount)*c.speed*(s.playerStats.stamina<10?.5:1)/(110+weight*48+(f.difficulty??1)*12));r.phase=r.progress<.7?'reeling':'lifting';
 s.playerStats.stamina=Math.max(0,s.playerStats.stamina-(s.automationAccess?0:fieldProfiles[r.tool]?.cost??2)*Math.min(100,amount)/70);s.playerStats.xp[0]+=.3*Math.min(100,amount)/70;s.playerStats.xp[3]+=Math.min(100,amount)/70;measure(s,r.tool,'引上げ',r.progress-beforeProgress,beforeStamina-s.playerStats.stamina,Number(r.progress>=1));
 if(r.progress<1)return {ok:true,reason:r.phase==='lifting'?'重みを感じる…もう少し引き上げよう。':'手応えあり。正体はまだ分からない…',recovered:false};
 if([...s.explorationAreas[0].items,...s.retainedFinds].filter(f=>f.state==='stored').length>=CONFIG.capacity){r.progress=.99;return {ok:false,reason:'保管がいっぱいです。先に洗浄しよう。',recovered:false};}
 if(c.camera&&f.riverCameraObserved||c.meter&&f.riverLoadMeasured&&['R203','R106'].includes(r.tool))f.riverProtected=true;finishQuality(s,f,r.tool);f.evaluationFN=Math.round(treasure(f.id).baseValueFN*f.quality);f.damageState=f.quality<.95?'scratched':'worn';f.state='stored';f.tool=r.tool;f.recoveryOperations=r.operations;recordRecovery(s,f);s.playerStats.xp[2]++;metrics(s).successes++;metrics(s).bottleneck='なし';logEvent(s,'引き上げ成功',f.uid);s.riverSession=undefined;
 return {ok:true,reason:'水面まで引き上げた！ 洗浄して正体を確かめよう。',recovered:true};
}
export function riverTick(s:State,seconds:number){if(s.riverSession)s.riverSession.elapsed+=seconds;}

export function riverObserve(s:State,id:string,x:number,y:number){
 if(!isRiver(s)||!riverObservation(id)||!s.ownedTools.includes(id))return {ok:false,reason:'観察道具を選んでください。'};
 const f=s.explorationAreas[0].items.filter(f=>f.state==='buried'&&(!f.automationJob||f.automationJob===s.automationAccess)&&Math.hypot(f.x-x,f.y-y)<22).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
 if(!f||Math.hypot(f.x-180,278-f.y)>330)return {ok:false,reason:'観察できる影がありません。'};
 f.riverObserved=true;if(id==='R204')f.riverCameraObserved=true;else f.riverLoadMeasured=true;const before=s.playerStats.stamina;s.playerStats.stamina=Math.max(0,before-fieldProfiles[id].cost);measure(s,id,'川底観察',1,before-s.playerStats.stamina,1);logEvent(s,'川底観察',id);
 return {ok:true,reason:id==='R210'?'荷重の目安 '+(f.weight??treasure(f.id).weight).toFixed(1)+'kg。引き上げ能力を確認しよう。':(f.magnetic??treasure(f.id).magnetic)?'鉄系の反応'+(f.obstacle?'・隙間にある':'・障害物なし'):'磁石に付かない反応'+(f.obstacle?'・隙間にある':'・障害物なし')};
}
