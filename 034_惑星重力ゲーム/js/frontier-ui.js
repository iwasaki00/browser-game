import {frontierTarget} from './frontier.js';
import {discoveryStyle} from './voyage-presentation.js';
export function createFrontierUI({onDetails}){
 const panel=document.querySelector('#frontierNotice'),message=document.querySelector('#frontierNoticeText');let latest=null,count=0;const badge=document.createElement('small');badge.id='frontierNoticeCount';panel.prepend(badge);
 function publish(events){count+=events.length;badge.textContent=count>1?`通信 ${count}件 · 詳細は日誌へ`:'';panel.dataset.kind=discoveryStyle(latest);}
 return {
  show(events){if(!events.length)return;panel.classList.remove('story-communication');latest=events.findLast(e=>e.state==='INVESTIGATED')??events.at(-1);publish(events);message.textContent=latest.message;panel.hidden=false;document.querySelector('#spaceFrame').classList.add('frontier-active');},
  hide(){count=0;badge.textContent='';panel.hidden=true;document.querySelector('#spaceFrame').classList.remove('frontier-active');},
  communicate(event,events=[event]){if(!event)return;panel.classList.add('story-communication');latest=event;publish(events);message.textContent=event.message;panel.hidden=false;document.querySelector('#spaceFrame').classList.add('frontier-active');},
  initialize(){document.querySelector('#frontierDetails').addEventListener('click',()=>{if(latest)onDetails(latest.destination??frontierTarget(latest.id)?.destination);});document.querySelector('#frontierDismiss').addEventListener('click',()=>{panel.hidden=true;document.querySelector('#spaceFrame').classList.remove('frontier-active');});},
 };
}
