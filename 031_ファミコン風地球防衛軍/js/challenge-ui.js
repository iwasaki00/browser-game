import {ACHIEVEMENTS,ACHIEVEMENT_BY_ID,ACHIEVEMENT_CATEGORIES} from './achievement-master.js?v=0.8.0';
import {achievementProgress,achievementSummary,recommendAchievements} from './challenges.js?v=0.8.0';

const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scopeLabel=a=>a.past==='save'?'既存の正式保存記録から判定':a.past==='stats'?'根拠のある正式統計のみ（0.7.0以前を推測しない）':'0.8.0以降の正式出撃のみ';
const progressText=(a,value,done)=>value===null?(done?'達成済み / 進捗の根拠は未記録':'未記録'):`${Math.min(a.target,value)}/${a.target}${a.method==='runKills'?'（1出撃の最高）':a.method==='streak'?'（最高連続）':a.method==='exposures'?'（通常クリア時の最高）':''}`;
const badge=a=>`<i class="achievement-badge" data-category="${a.category}" aria-hidden="true"></i>`;

export class ChallengeBoard {
 constructor(doc){this.document=doc;this.category='ALL';this.status='ALL';this.selected=ACHIEVEMENTS[0].id}
 render(save,missionId){
  const d=this.document,summary=achievementSummary(save),list=d.querySelector('#achievementList');
  d.querySelector('#achievementProgress').textContent=`${summary.done}/${summary.total} 達成 · ${summary.percent}%`;
  const filtered=ACHIEVEMENTS.filter(a=>a.implemented&&(this.category==='ALL'||a.category===this.category)&&(this.status==='ALL'||Object.hasOwn(save.achievements.unlocked,a.id)===(this.status==='DONE')));
  if(!filtered.some(a=>a.id===this.selected))this.selected=filtered[0]?.id??null;
  const scroll=list.scrollTop||0;list.replaceChildren();
  for(const a of filtered){const done=Object.hasOwn(save.achievements.unlocked,a.id),value=achievementProgress(a,save),row=d.createElement('button');row.type='button';row.className='achievement-card';row.dataset.action='achievement-select';row.dataset.achievement=a.id;row.dataset.earned=String(done);row.setAttribute('aria-pressed',String(this.selected===a.id));
   row.innerHTML=`${badge(a)}<span><strong>${escape(a.name)}</strong><small>${done?'✓ 達成済み':'未達成'} · ${progressText(a,value,done)}</small></span><span class="achievement-stars" aria-label="難易度${a.difficulty}">${'★'.repeat(a.difficulty)}</span>`;list.append(row)
  }
  if(!filtered.length){const p=d.createElement('p');p.textContent='条件に一致する実績はありません';list.append(p)}list.scrollTop=scroll;
  const a=ACHIEVEMENT_BY_ID.get(this.selected),detail=d.querySelector('#achievementDetail');
  if(a){const done=Object.hasOwn(save.achievements.unlocked,a.id),value=achievementProgress(a,save);detail.innerHTML=`<header data-earned="${done}">${badge(a)}<h3>${escape(a.name)}</h3></header><p>${a.id} · ${ACHIEVEMENT_CATEGORIES[a.category]} · ${'★'.repeat(a.difficulty)}</p><p>${escape(a.condition)}</p><p><strong>${progressText(a,value,done)}</strong> / ${done?'達成済み':'未達成'}</p><progress max="${a.target}" value="${done?a.target:Math.min(a.target,value??0)}" aria-label="${escape(a.name)}の進捗"></progress><p>${scopeLabel(a)}</p>${done?`<p>達成日時：${new Date(save.achievements.unlocked[a.id]).toISOString().replace('T',' ').slice(0,19)} UTC</p>`:''}${a.title?`<p>称号：${escape(a.title)}（戦闘性能への効果なし）</p>`:''}`}
  else detail.innerHTML='<p>一覧の条件を変更してください。</p>';
  const recommendations=d.querySelector('#achievementRecommendations');recommendations.replaceChildren();
  for(const a of recommendAchievements(save,missionId)){const b=d.createElement('button');b.type='button';b.dataset.action='achievement-recommend';b.dataset.achievement=a.id;b.textContent=`${a.name} · ${progressText(a,achievementProgress(a,save),false)}`;recommendations.append(b)}
  if(!recommendations.children.length){const p=d.createElement('p');p.textContent='実装済み実績をすべて達成！';recommendations.append(p)}
  const titles=d.querySelector('#achievementTitles');titles.replaceChildren();
  const choices=[{id:null,title:'称号なし'},...ACHIEVEMENTS.filter(a=>a.title)];
  for(const a of choices){const owned=a.id===null||Object.hasOwn(save.achievements.unlocked,a.id),b=d.createElement('button');b.type='button';b.disabled=!owned;b.dataset.action='achievement-title';b.dataset.achievement=a.id??'';b.setAttribute('aria-pressed',String(save.achievements.selectedTitle===a.id));b.textContent=`${owned?'':'🔒 '}${a.title}`;titles.append(b)}
  d.querySelector('#achievementSelectedTitle').textContent=`表示称号：${ACHIEVEMENT_BY_ID.get(save.achievements.selectedTitle)?.title??'なし'}`;
 }
}
