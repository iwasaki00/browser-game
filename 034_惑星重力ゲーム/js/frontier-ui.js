import {frontierTarget} from './frontier.js';
export function createFrontierUI({onDetails}){
 const panel=document.querySelector('#frontierNotice'),message=document.querySelector('#frontierNoticeText');let latest=null;
 return {
  show(events){if(!events.length)return;panel.classList.remove('story-communication');latest=events.findLast(e=>e.state==='INVESTIGATED')??events.at(-1);message.textContent=latest.message;panel.hidden=false;document.querySelector('#spaceFrame').classList.add('frontier-active');},
  hide(){panel.hidden=true;document.querySelector('#spaceFrame').classList.remove('frontier-active');},
  communicate(event){if(!event)return;panel.classList.add('story-communication');latest=event;message.textContent=event.message;panel.hidden=false;document.querySelector('#spaceFrame').classList.add('frontier-active');},
  initialize(){document.querySelector('#frontierDetails').addEventListener('click',()=>{if(latest)onDetails(latest.destination??frontierTarget(latest.id)?.destination);});document.querySelector('#frontierDismiss').addEventListener('click',()=>{panel.hidden=true;document.querySelector('#spaceFrame').classList.remove('frontier-active');});},
 };
}
