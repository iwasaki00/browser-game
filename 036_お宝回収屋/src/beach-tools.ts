import {recoveryCount} from './ledger';
import type {State,Plot} from './engine';
export const BEACH_ADDED=['B103','B106','B107','B108','B109','B110','B202','B203','B204','B205','B206','B207','B208','B209','B302'];
export type BeachKind='掘削'|'探知'|'回収'|'選別'|'補助';
export interface BeachProfile {kind:BeachKind;limit?:number;radius?:number;ry?:number;stroke?:number;cost:number;sample?:boolean;hard?:number;damage?:number;range?:number;senseDepth?:number;grid?:number;units?:number;fine?:number;seconds?:number;benefit:string;unlock:string;}
export const beachProfiles:Record<string,BeachProfile>={
 hand:{kind:'掘削',limit:80,radius:7,stroke:.45,cost:5,benefit:'素手で表層を探す',unlock:'初期'},
 B101:{kind:'掘削',limit:180,radius:15,stroke:.85,cost:7,sample:true,benefit:'小さな穴を丁寧に掘り、採砂する',unlock:'回収2個'},
 B102:{kind:'掘削',limit:80,radius:34,ry:7,stroke:.85,cost:6,benefit:'表面を横に広く探索',unlock:'回収5個'},
 B104:{kind:'選別',cost:4,units:15,fine:1,seconds:.6,benefit:'手選別3→15単位、小物も回収',unlock:'回収8個 または 採砂'},
 B105:{kind:'掘削',limit:280,radius:26,stroke:.85,cost:12,sample:true,benefit:'第3層まで大量採砂',unlock:'3区画 または 回収15個'},
 B201:{kind:'探知',cost:3,range:95,senseDepth:280,grid:40,benefit:'粗い金属反応の跡を残す',unlock:'回収20個'},
 B103:{kind:'掘削',limit:180,radius:35,stroke:.65,cost:11,sample:true,damage:.045,benefit:'浅・中層を広く一括採砂。深さより面積を優先',unlock:'回収12個'},
 B106:{kind:'回収',limit:280,radius:10,stroke:.14,cost:2,hard:.55,damage:0,benefit:'露出前の最後の薄い砂をブラシで払い、傷を防ぐ',unlock:'回収2個'},
 B107:{kind:'掘削',limit:280,radius:10,stroke:.6,cost:4,sample:true,hard:1.2,damage:.003,benefit:'狭い穴を省体力で精密に掘る',unlock:'回収5個'},
 B108:{kind:'補助',cost:0,benefit:'装備中は採砂袋を集約。C02で一括選別量も増加',unlock:'採砂 または 回収8個'},
 B109:{kind:'回収',cost:1,damage:0,benefit:'露出済みの小物を周囲からまとめてつかむ',unlock:'回収5個'},
 B110:{kind:'補助',cost:0,benefit:'装備中は保管24→48個、砂袋をまとめる作業を補助',unlock:'回収20個'},
 B202:{kind:'探知',cost:1,range:30,senseDepth:420,grid:10,benefit:'近い反応を絞る。B201の走査跡で範囲を補完',unlock:'回収20個'},
 B203:{kind:'掘削',limit:420,radius:19,stroke:.32,cost:14,sample:true,hard:1.6,damage:.055,benefit:'湿った第4層へ到達。採砂時に粗い砂を予備選別',unlock:'回収30個 または 掘削80回'},
 B204:{kind:'探知',cost:4,range:115,senseDepth:420,grid:40,benefit:'湿った奥側でも反応を落とさず広域走査',unlock:'回収30個'},
 B205:{kind:'探知',cost:5,range:80,senseDepth:600,grid:30,benefit:'第5層の反応と浅・中・深の手掛かり。数値深度は表示しない',unlock:'回収35個'},
 B206:{kind:'探知',cost:4,range:90,senseDepth:420,grid:30,benefit:'鉄系と非鉄系の反応を区別し、ブラシで慎重に回収',unlock:'回収35個'},
 B207:{kind:'掘削',limit:80,radius:55,ry:10,stroke:.65,cost:3,damage:.02,benefit:'軽い熊手で広い表面を低疲労探索',unlock:'回収20個'},
 B208:{kind:'選別',cost:3,units:24,fine:.5,seconds:.85,benefit:'粗目は大量、細目は小物の残渣を半分の作業で回収',unlock:'回収20個'},
 B209:{kind:'補助',cost:0,benefit:'探知機と同時装備で小さい金属の反応と範囲を強化',unlock:'回収30個'},
 B302:{kind:'掘削',limit:600,radius:13,stroke:.22,cost:22,sample:true,hard:2.2,damage:.12,benefit:'押してなぞる手動吸引で締まった第5層へ。自動採取はしない',unlock:'回収50個 または 掘削180回'},
};
export const detectorTool=(id:string)=>beachProfiles[id]?.kind==='探知';
export const sieveTool=(id:string)=>beachProfiles[id]?.kind==='選別';
export const equippedBeach=(s:State,id:string)=>s.equippedTools.includes(id)&&s.ownedTools.includes(id);
export const plotDepthScale=(p:Plot)=>p.beachDepthVersion===1?600:280;
export const beachCapacity=(s:State)=>equippedBeach(s,'B110')?48:24;
export function beachUnlocks(s:State){const n=recoveryCount(s);return Object.fromEntries(BEACH_ADDED.map(id=>[id,id==='B106'?n>=2:['B107','B109'].includes(id)?n>=5:id==='B108'?s.sandSampled||n>=8:id==='B103'?n>=12:id==='B203'?n>=30||s.digs>=80:id==='B302'?n>=50||s.digs>=180:['B204','B209'].includes(id)?n>=30:['B205','B206'].includes(id)?n>=35:n>=20]));}
export function sieveSettings(s:State,id:string,mesh:'fine'|'coarse'='fine'){
 const p=beachProfiles[id];let units=p?.units??3,cost=p?.cost??6,fine=id==='B208'&&mesh==='fine'?.5:1;
 if(id==='B208'&&mesh==='coarse')units=40;
 const c02=id==='B104'&&['B105','B104','B108'].every(t=>equippedBeach(s,t));if(c02)units=30;
 return {units,cost,fine,seconds:p?.seconds??.6,c02};
}
export function beachComparisonText(id:string){const p=beachProfiles[id];if(!p)return '';return [p.limit?'到達 '+(p.limit<=80?'表層':p.limit<=180?'中層':p.limit<=280?'第3層':p.limit<=420?'第4層':'第5層'):'',p.radius?'範囲 '+p.radius:'',p.units?'処理 '+p.units+'単位':'',p.range?'探知範囲 '+p.range:'','体力 '+p.cost].filter(Boolean).join(' / ');}
