// Read-only observations. Never change simulation state or terminal decisions.
export function segmentDistance(a,b,p){
 const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy;
 const t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;
 return Math.hypot(a.x+t*dx-p.x,a.y+t*dy-p.y);
}
export const goalKey=g=>JSON.stringify([g.id,g.x,g.y,g.radius]);
export function observeApproach(metric,previous,next){
 const goal=next.goal,key=goalKey(goal),position=next.rocket.position;
 const fresh=metric?.key===key?metric:{key,minimum:Infinity,closestTime:next.elapsed};
 const distance=segmentDistance(previous.rocket.position,position,goal);
 return distance<fresh.minimum?{...fresh,minimum:distance,closestTime:next.elapsed}:fresh;
}
export function inputStep(kind,fine){return kind==='angle'?(fine?.01:1):(fine?1:10);}
export function adjustInput(value,direction,kind,fine,min,max){return Math.max(min,Math.min(max,Math.round((value+direction*inputStep(kind,fine))*100)/100));}
export function launchInput(velocity){return {angleDeg:Math.atan2(velocity.y,velocity.x)*180/Math.PI,speed:Math.hypot(velocity.x,velocity.y)};}
export function attemptKey(stage,playType){return JSON.stringify([playType,stage.id,stage.launch.position,stage.goal]);}
export function flightFeedback(state,metric,missionFailed=false){
 const gap=Math.max(0,(metric?.minimum??Math.hypot(state.rocket.position.x-state.goal.x,state.rocket.position.y-state.goal.y))-state.goal.radius);
 const reason=missionFailed?'航路条件が未達成':state.status==='cleared'?'目的地に到達':state.status==='crashed'?({absorbed:'ブラックホールに吸収',overheated:'恒星の熱領域へ侵入','encounter-meteor':'隕石に接触','encounter-ufo':'UFOに接触','encounter-comet':'彗星に接触','encounter-unknown':'未知の物体に接触'}[state.reason]??'惑星に衝突'):state.status==='escaped'?'ワールド外へ逸脱':state.status==='timeout'?'時間上限までに未到達':'航行を中断';
 // Do not assert “insufficient thrust” from a missed goal: gravity may reverse it.
 return {gap,reason,hint:state.status==='cleared'?'':gap<state.goal.radius?'目的地付近を通過。予測を見ながら角度を微調整。':'予測の最接近距離を比較し、角度と推力を一つずつ調整。'};
}
