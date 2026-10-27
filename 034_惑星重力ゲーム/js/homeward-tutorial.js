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
for(const [number,target,text]of [
 ['04','thrust','THRUSTで隕石群と交差する時刻を変えよう。'],
 ['05','angle','ANGLEを変え、蒼い尾に重なる航路を探そう。'],
 ['06','angle','灯台へ接近してから、ゲートへ向かおう。'],
 ['07','angle','追跡／回避のヒントを参考に、動体との接触を避けよう。'],
 ['08','thrust','推力を変え、異常重力で下へ曲がる航路を探そう。'],
])TUTORIAL_STEPS[`homeward-${number}`]=[
 {id:target,target,text},
 {id:'preview',target:'preview',text:'予測で接触と出口を確認。到着予測とは別に、各セクターの遭遇条件も必要です。',manual:true},
 {id:'launch',target:'launch',text:'調整した航路で発射しよう。失敗したらヒントを見て再挑戦。'},
 {id:'observe',target:'preview',text:'航行中。発見は日誌へ記録されます。速度倍率やカメラも利用できます。'},
];
TUTORIAL_STEPS['homeward-09']=[
 {id:'preview',target:'preview',text:'「目的地」から行き先を選び、ANGLE・THRUSTで航路を調整。予測を確認して次へ。',manual:true},
 {id:'launch',target:'launch',text:'発射して選んだ目的地へ。寄り道をせず帰還ゲートに向かっても構いません。'},
 {id:'observe',target:'preview',text:'「目的地」から飛行中も目標を変更できます。寄港したら次の行き先を選び、再発射できます。'},
];
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
