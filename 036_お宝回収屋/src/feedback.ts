import {CONFIG} from './data';
import {depthAt,diggingLimit,plot,reachedFind,type State} from './engine';
export interface HandFeedback {plotId:string;x:number;y:number;attemptedAt:number;hinted:boolean;}
export type HandReaction={kind:'limit'|'hint';text:string};
// This is a fallible hint only. It never digs, exposes, collects or rolls new treasure.
export function handReaction(s:State,id:string,x:number,y:number,random:()=>number=Math.random):HandReaction|null {
 if(id!=='hand'||depthAt(plot(s),x,y)<diggingLimit('hand')-CONFIG.handHintNearLimit)return null;
 const limit:HandReaction={kind:'limit',text:'素手ではこれ以上掘りにくい'};
 if(depthAt(plot(s),x,y)>diggingLimit('hand')+CONFIG.handHintNearLimit)return limit;
 const p=plot(s),nearby=p.items.some(f=>f.state==='buried'&&!reachedFind(p,f)&&(f.depth??f.y)>diggingLimit('hand')&&Math.hypot(f.x-x,f.y-y)<=CONFIG.handHintRadius);
 if(!nearby)return limit;
 const history=s.handFeedback??(s.handFeedback=[]);
 let hole=history.find(h=>h.plotId===p.id&&Math.hypot(h.x-x,h.y-y)<=CONFIG.handHintHoleRadius);
 if(hole&&(hole.hinted||s.playTime-hole.attemptedAt<CONFIG.handHintCooldown))return limit;
 if(!hole){hole={plotId:p.id,x,y,attemptedAt:s.playTime,hinted:false};history.push(hole);}else hole.attemptedAt=s.playTime;
 if(random()>=CONFIG.handHintChance)return limit;
 hole.hinted=true;return {kind:'hint',text:'何か手応えが…？'};
}
