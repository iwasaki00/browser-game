import type {State,Plot} from './engine';
export const worldRequirements:Record<string,string>={'B-B':'砂浜回収5個','B-C':'砂浜回収25個＋B-B探索＋FN500または購入実績','B-D':'砂浜回収50個＋B-C探索＋FN1000または購入実績','R-C':'川底回収20個＋R-B探索＋FN500または購入実績','R-D':'川底回収40個＋R-C探索＋FN1000または購入実績','G-C':'河原回収20個＋G-B探索＋FN500または購入実績','G-D':'河原回収40個＋G-C探索＋FN1000または購入実績'};
export interface Environment {hardness:number;stones:number;deep:number;wet:number;visibility:number;current:number;obstacles:number;heavy:number;coarse:number;crevice:number;volume:number;fine:number;}
const base:Environment={hardness:1,stones:0,deep:0,wet:0,visibility:1,current:1,obstacles:.1,heavy:1,coarse:.55,crevice:0,volume:1,fine:0};
export const environments:Record<string,Environment>=Object.fromEntries(Object.entries({
 'B-A':{},'B-B':{wet:1,hardness:1.15},'B-C':{hardness:1.9,stones:.55,deep:.3},'B-D':{hardness:1.25,stones:.15,deep:.65,volume:1.25},
 'R-A':{},'R-B':{obstacles:.25},'R-C':{obstacles:.7,current:1.2,visibility:.7},'R-D':{obstacles:.3,heavy:1.2,current:1.35,visibility:.4},
 'G-A':{},'G-B':{fine:.25},'G-C':{crevice:1,volume:.6,coarse:.3,fine:.7},'G-D':{volume:1.5,coarse:.7,fine:.5}
}).map(([id,e])=>[id,{...base,...e}]));
export const environment=(p:Plot)=>p.environment??environments[p.areaId??'B-A']??base;
export const fieldRecovered=(s:State,field:string)=>Object.entries(s.discoveredTreasures).filter(([id])=>id.startsWith(field)).reduce((n,[,d])=>n+d.count,0);
export function worldUnlocked(s:State,id:string){if(s.world?.unlocked.includes(id))return true;const f=id[0],n=fieldRecovered(s,f);if(id==='B-B')return n>=5;if(!worldRequirements[id])return false;const last=id.at(-1),prior=f+'-'+(last==='C'?'B':'C'),threshold=last==='C'?(f==='B'?25:20):(f==='B'?50:40);const visited=(s.world?.visits[prior]??0)>0||Object.values(s.discoveredTreasures).some(d=>d.locations.includes(prior));return n>=threshold&&visited&&(s.currentFN>=(last==='C'?500:1000)||s.purchases.length>0);}
export function recordVisit(s:State,id:string){s.world??={version:1,unlocked:[],visits:{},milestones:{}};s.world.visits[id]=(s.world.visits[id]??0)+1;if(!s.world.unlocked.includes(id))s.world.unlocked.push(id);}
export function collectionMilestones(s:State){const output:Record<string,number[]>={};for(const f of ['B','R','G']){const n=Object.keys(s.discoveredTreasures).filter(id=>id.startsWith(f)).length;output[f]=[10,25,50,75,100].filter(x=>n>=x);}return output;}
