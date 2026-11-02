import {missionGuide} from './mission-guide.js';
import {createStoryNavigation} from './story-navigation-ui.js';
export function createMissionGuide({getContext,onOpen=()=>{},onInspect=()=>false,onRecord=()=>{}}){
 const $=s=>document.querySelector(s),button=$('#missionGuideButton'),dialog=$('#missionGuideDialog');
 let view=null,key='',last=-Infinity,updates=0;
 const story=createStoryNavigation({getContext,onInspect,onRecord});
 function clear(){document.querySelectorAll('.mission-target').forEach(e=>e.classList.remove('mission-target'));}
 function refresh(time=performance.now(),force=false){
  if(!force&&time-last<200)return;last=time;
  const next=missionGuide(getContext()),nextKey=JSON.stringify(next);
  if(key!==nextKey){key=nextKey;view=next;updates++;
   button.querySelector('span').textContent=({prepare:'発射準備',launch:'発射しよう',flying:'航行中',retry:'再調整',incomplete:'任務条件未達',arrived:'目的地に到達',ending:'航海の結末',destination:'目的地を選択',branch:'判断を選択',analysis:'通信を解析',unlocked:'新航路を確認','return-ready':'帰還の準備','survey-ready':'調査へ出発','route-policy':'航路を選択',scan:'天体情報を確認',investigated:'調査完了',tutorial:'操作練習中'})[view.code]??'次の操作';button.setAttribute('aria-label',`現在のミッション：${view.title}。次は何をすればいい？`);
   $('#missionGuideTitle').textContent=view.title;$('#missionGuideDescription').textContent=view.description;
   $('#missionGuideSteps').replaceChildren(...view.steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
   $('#missionGuideReason').textContent=`理由：${view.reason} 成功すると：${view.after}`;
   $('#missionGuideAction').textContent=view.label;dialog.dataset.state=view.code;
   story.update(view);
  }
  // Existing tutorial owns its own single focus. Never add a competing one.
  const target=$(view.selector),modal=document.querySelector('dialog[open]');
  const permitted=target&&!target.disabled&&!target.hidden&&target.getClientRects().length>0;
  if($('#missionGuideAction').disabled===Boolean(permitted))$('#missionGuideAction').disabled=!permitted;
  const detail=modal?.id==='homewardDialog'&&view.focus?$(view.focus):null;
  const wanted=detail&&!detail.disabled&&detail.getClientRects().length?detail:!modal&&!document.querySelector('.tutorial-target')&&permitted?target:null;
  const previous=document.querySelector('.mission-target');if(previous!==wanted){clear();wanted?.classList.add('mission-target');}
 }
 button.addEventListener('click',()=>{onOpen();refresh(performance.now(),true);story.open();dialog.showModal();clear();});
 $('#missionGuideClose').addEventListener('click',()=>dialog.close());
 $('#missionGuideAction').addEventListener('click',()=>{
  const target=$(view.selector);if(!target||target.disabled||target.hidden||!target.getClientRects().length)return;
  const focus=view.focus;dialog.close();
  if(target.matches('input,select,canvas'))target.focus({preventScroll:true});else target.click();
  if(focus){const e=$(focus);if(e&&!e.disabled){e.scrollIntoView({block:'center'});e.focus({preventScroll:true});clear();e.classList.add('mission-target');}}
 });
 return {refresh,isOpen:()=>dialog.open,get updates(){return updates;}};
}
