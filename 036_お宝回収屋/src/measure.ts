import type {State} from './engine';
export interface OperationMetric {uses:number;amount:number;stamina:number;finds:number;successes:number;seconds:number;}
export function measure(s:State,tool:string,stage:string,amount:number,stamina:number,finds=0,success=amount>0){
 const area=tool.startsWith('G')||['採取','手選別','精密回収'].includes(stage)?'G':s.explorationAreas[0].areaId?.[0]??'B',key=`${area}:${tool}:${stage}`;
 const m=(s.operationMetrics??={})[key]??={uses:0,amount:0,stamina:0,finds:0,successes:0,seconds:0};
 m.uses++;m.amount+=Math.max(0,amount);m.stamina+=Math.max(0,stamina);m.finds+=Math.max(0,finds);m.successes+=Number(success);s.lastOperationKey=key;
}
export function measureSeconds(s:State,seconds:number,key=s.lastOperationKey){const m=key?s.operationMetrics?.[key]:undefined;if(m&&Number.isFinite(seconds)&&seconds>0)m.seconds+=seconds;}
