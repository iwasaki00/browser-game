export const PROGRESS_KEY='orbit-maker.stage-progress.v1';
export function loadProgress(storage){
 const result={design:{},live:{}};
 try{const data=JSON.parse(storage?.getItem(PROGRESS_KEY)??'null');
  for(const mode of ['design','live'])for(let i=1;i<=10;i++){
   const id=`stage-${String(i).padStart(2,'0')}`,value=data?.[mode]?.[id];
   if(Number.isInteger(value)&&value>=1&&value<=3)result[mode][id]=value;
  }
 }catch{/* A corrupt or unavailable store starts a fresh campaign. */}
 return result;
}
export function isUnlocked(progress,index,stages){return index===0||Boolean(progress.design[stages[index-1].id]||progress.live[stages[index-1].id]);}
export function rateClear(stage,status,metrics,mode){
 if(status!=='cleared')return 0;
 const meets=rule=>metrics.elapsed<=rule.maxTime&&(mode!=='live'||metrics.movement<=(rule.maxMovement??Infinity));
 return meets(stage.rating.three)?3:meets(stage.rating.two)?2:1;
}
export function recordClear(progress,storage,id,mode,stars){
 if(!['design','live'].includes(mode)||!Number.isInteger(stars)||stars<1||stars>3)return progress;
 const next=structuredClone(progress);next[mode][id]=Math.max(next[mode][id]??0,stars);
 try{storage?.setItem(PROGRESS_KEY,JSON.stringify(next));}catch{/* Play remains available without storage. */}
 return next;
}
