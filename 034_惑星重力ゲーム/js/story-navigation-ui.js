import {storyNavigation,storyHints,storySteps,storyObjective,optionalStoryAction,sortedStoryEntries,storyLocation} from './story-navigation.js';
export function createStoryNavigation({getContext,onInspect=()=>false,onRecord=()=>{}}){
 const $=s=>document.querySelector(s),dialog=$('#missionGuideDialog');let guide=null,tab='current',level=0,signature='',model=null;
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 function hint(){const output=$('#storyHintText');output.hidden=level===0;output.textContent=level?`LEVEL ${level}：${storyHints(getContext(),guide)[level-1]}`:'';$('#storyHint').disabled=level>=3;$('#storyHint').textContent=level>=3?'ヒント：LEVEL 3':`ヒント${level?`：次はLEVEL ${level+1}`:''}`;$('#storyHideHint').hidden=level===0;}
 function select(next){tab=next;$('#missionGuideCurrent').hidden=tab!=='current';$('#storyContent').hidden=tab==='current';for(const b of document.querySelectorAll('[data-story-tab]'))b.setAttribute('aria-pressed',String(b.dataset.storyTab===tab));if(tab!=='current')render();}
 function render(){model=storyNavigation(getContext());const box=$('#storyContent');box.replaceChildren();if(!model)return;
  box.append(node('h3',model.current),node('p',model.summary));
  if(tab==='progress'){
   box.append(node('h3','現在の目的'),node('p',`${model.completed?'完了：':'進行中：'}${model.objective}`),node('p',`次${model.nextOptional?'（任意）':''}：${model.next}`));if(model.optional)box.append(node('p',model.optional));
   for(const c of model.chapters)box.append(node('p',`${c.state} · ${c.title}`));box.append(node('p','未到達の章の名称・件数は表示しません。'));return;
  }
  const label=node('label','並び順 '),sort=node('select');sort.id='storySort';sort.setAttribute('aria-label','日誌の並び順');for(const [value,text]of [['new','新しい記録から'],['old','古い記録から']]){const o=node('option',text);o.value=value;sort.append(o);}label.append(sort);box.append(label,node('p','日時がある記録を先に表示します。日時不明の記録は別枠で保存データの記録順に並べます。'));
  const rows=node('div');box.append(rows);function items(){rows.replaceChildren();let undated=false;for(const e of sortedStoryEntries(model.entries,sort.value==='old')){
    if(e.at===null&&!undated){rows.append(node('h3','日時不明・記録順'));undated=true;}
    const details=node('details'),summary=node('summary',`${e.label} · ${e.title}`);details.dataset.storyId=e.id;details.append(summary);
    if(e.at!==null){const time=node('time',new Date(e.at).toLocaleString('ja-JP'));time.dateTime=new Date(e.at).toISOString();details.append(time);}
    details.append(node('p',e.text));if(e.target)for(const [move,label]of [[false,'天体情報（SCAN）'],[true,'場所を見る（SCAN）']]){const button=node('button',label);button.type='button';button.dataset[move?'storyLocation':'storyInfo']=e.id;button.addEventListener('click',()=>{const id=storyLocation(getContext(),e.id);if(id){dialog.close();if(!onInspect(id,{move}))$('#galleryNotice').textContent='現在の宙域では表示できません。';}});details.append(button);}
    if(e.record){const button=node('button','航行記録をCINEMATIC再生');button.type='button';button.addEventListener('click',()=>{dialog.close();onRecord(e.record);});details.append(button);}rows.append(details);
   }if(!model.entries.length)rows.append(node('p','出来事はまだ記録されていません。航行・発見した内容がここに残ります。'));}
  sort.addEventListener('change',items);items();
 }
 for(const b of document.querySelectorAll('[data-story-tab]'))b.addEventListener('click',()=>select(b.dataset.storyTab));
 $('#storyHint').addEventListener('click',()=>{level=Math.min(3,level+1);hint();});$('#storyHideHint').addEventListener('click',()=>{level=0;hint();});
 return {
  update(g){guide=g;const c=getContext(),home=c.playType==='homeward',key=[c.stage.id,c.stage.goal.id,g.code,g.title,c.launchMode,g.steps.join()].join('|');if(signature!==key){signature=key;level=0;hint();}
   $('#storyTabs').hidden=!home;$('#storyHints').hidden=!home;$('#missionGuideButton').classList.toggle('story-card',home);
   if(home){$('#missionGuideButton small').textContent=`目的：${storyObjective(c,g)}`;$('#missionGuideButton span').textContent=`次${optionalStoryAction(g)?'（任意）':''}：${storySteps(c,g)[0]}`;if(optionalStoryAction(g))$('#missionGuideDescription').textContent=`任意の確認：${g.description} 現在の目的は${storyObjective(c,g)}です。`;if(g.code==='launch')$('#missionGuideSteps').replaceChildren(...storySteps(c,g).map(text=>node('li',text)));}else{$('#missionGuideButton small').textContent='現在の任務';select('current');}
  },
  open(){level=0;hint();select('current');},
 };
}
