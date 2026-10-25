// Input guidance only: no simulation writes or automatic solution application.
export const TUTORIAL_STEPS={
 'homeward-01':[
  {id:'launch',target:'launch',text:'LAUNCHを押して、最初の航路を飛ぼう。'},
  {id:'observe',target:'planet',text:'星のそばで曲がる航跡を見よう。到着まで待つか、RESETで再試行。'},
 ],
 'homeward-02':[
  {id:'thrust',target:'thrust',text:'THRUSTを調整し、予測線の変化を見よう。'},
  {id:'preview',target:'preview',text:'緑の予測はゴール到達の目安。準備ができたら次へ。',manual:true},
  {id:'launch',target:'launch',text:'自分で整えた航路を発射しよう。'},
  {id:'observe',target:'planet',text:'二つの引力で曲がる航跡を追おう。失敗しても再調整できる。'},
 ],
 'homeward-03':[
  {id:'select',target:'planet',text:'紫の反重力惑星をタップ。ロケットを押し返す星です。'},
  {id:'angle',target:'angle',text:'ANGLEを変えて、吸収域を避ける方向を探そう。'},
  {id:'thrust',target:'thrust',text:'THRUSTも調整。橙の熱領域を避ける航路を探そう。'},
  {id:'preview',target:'preview',text:'紫は反発、暗い星は吸収、橙の外周は熱。予測を確認して次へ。',manual:true},
  {id:'launch',target:'launch',text:'準備できたら発射。特殊惑星の力を借りて進もう。'},
  {id:'observe',target:'planet',text:'反発と引力の間を航行中。危険領域を避けてゲートへ。'},
 ],
};
export function tutorialEntry(state,id){
 const steps=TUTORIAL_STEPS[id];if(!steps)return null;
 const raw=state.tutorial?.[id]??{},status=raw.status==='skipped'?'skipped':state.cleared.includes(id)||raw.status==='completed'?'completed':'active';
 const entry={status,step:Math.max(0,Math.min(steps.length-1,Number.isInteger(raw.step)?raw.step:0))};
 if(Number.isFinite(raw.angleDeg)&&raw.angleDeg>=-180&&raw.angleDeg<=180)entry.angleDeg=raw.angleDeg;
 if(Number.isFinite(raw.speed)&&raw.speed>=120&&raw.speed<=220)entry.speed=raw.speed;
 return entry;
}
export function tutorialTransition(entry,id,event,values={},initial={}){
 if(!entry||entry.status!=='active')return entry;
 const next={...entry},steps=TUTORIAL_STEPS[id],step=steps[entry.step];
 if(Number.isFinite(values.angleDeg))next.angleDeg=values.angleDeg;
 if(Number.isFinite(values.speed))next.speed=values.speed;
 if(event==='skip')next.status='skipped';
 else if(event==='clear')next.status='completed';
 else if(event==='launch')next.step=steps.findIndex(s=>s.id==='observe');
 else if(event==='restore'&&step.id==='observe')next.step=steps.findIndex(s=>s.id==='launch');
 else if(event==='retry')next.step=0;
 else if((event==='next'&&step.manual)||(event===step.id&&((event==='angle'&&values.angleDeg!==initial.angleDeg)||(event==='thrust'&&values.speed!==initial.speed)||event==='select')))next.step=Math.min(steps.length-1,entry.step+1);
 return next;
}
