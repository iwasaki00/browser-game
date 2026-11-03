import {treasureImage} from './treasure-assets';
import {treasure,income} from './data';
import {reward,type State,type Find} from './engine';
export function treasureShape(id:string){
 const image=treasureImage(id);if(image)return `<img src="${image}" alt="">`;let shape='';const kind=treasure(id)?.kind??'';
 if(id==='B012')shape='<rect x="43" y="7" width="34" height="106" rx="9" fill="#697f73"/><circle cx="60" cy="60" r="27" fill="#e2c87e"/><circle cx="60" cy="60" r="21" fill="#f0eee0"/><path d="M60 44v17l12 7" stroke="#405957" stroke-width="4"/>';
 else if(id==='B011'||id==='B009')shape='<circle cx="60" cy="65" r="29" fill="none" stroke="#dcb95b" stroke-width="13"/><path d="M46 36l14-18 14 18-14 12z" fill="#e9edc0"/>';
 else if(['B007','B010'].includes(id))shape='<circle cx="60" cy="60" r="36" fill="#bc9a51" stroke="#e7d17e" stroke-width="5"/><circle cx="60" cy="60" r="27" fill="none" stroke="#e6ce82" stroke-width="2"/><path d="M60 37l7 15 17 2-12 12 3 17-15-8-15 8 3-17-12-12 17-2z" fill="#e3c775"/>';
 else if(id==='B002')shape='<path d="M70 20v49c0 30-39 32-39 4V60l10 13" fill="none" stroke="#9aa89f" stroke-width="7"/><circle cx="70" cy="20" r="7" fill="none" stroke="#9aa89f" stroke-width="5"/>';
 else if(id.startsWith('G'))shape=(['G003','G007','G008','G009','G011','G012'].includes(id)||treasure(id)?.material==='gold')?'<path d="M30 63l14-23 26-6 22 24-7 25-30 8-25-12z" fill="#d9b657"/><path d="M44 40l12 27 36-9M56 67l-1 24" fill="none" stroke="#f1dfa0" stroke-width="3"/>':'<path d="M34 80l5-44 21-20 24 24 4 42-29 18z" fill="#b9c9bc"/><path d="M39 36l20 15 25-11M59 16v84M34 80l25-15 29 17" fill="none" stroke="#edf2df" stroke-width="3"/>';
 else if(id==='R007')shape='<rect x="20" y="40" width="80" height="55" rx="7" fill="#7e8c79"/><path d="M43 40V27h34v13M20 58h80M53 53v16h14V53" fill="none" stroke="#c5b99a" stroke-width="6"/>';
 else if(id==='R004')shape='<path d="M38 20l14 18 14-8-4-22c33 8 26 34 7 39l-24 54c-7 12-26 1-17-10l27-48c-17-3-25-12-17-23z" fill="#a5aea3"/>';
 else if(id==='R005')shape='<g fill="none" stroke="#8d9b8c" stroke-width="9"><ellipse cx="40" cy="35" rx="14" ry="23" transform="rotate(-30 40 35)"/><ellipse cx="62" cy="60" rx="14" ry="23" transform="rotate(-30 62 60)"/><ellipse cx="84" cy="85" rx="14" ry="23" transform="rotate(-30 84 85)"/></g>';
 else if(id==='R009')shape='<path d="M20 68h80v20H20zM51 30h18v48H51z" fill="#ab8d51"/><ellipse cx="60" cy="30" rx="29" ry="12" fill="none" stroke="#c7ae68" stroke-width="7"/>';
 else if(id==='R001')shape='<path d="M45 20h30v9H63v75l-6 10V29H45z" fill="#967764"/>';
 else if(id==='B004'||id==='R002')shape='<path d="M36 30l13-15h23l13 15-13 16H49z" fill="#96745d"/><path d="M52 42h16v58H52z" fill="#9c8870"/><path d="M48 53l24-5M48 65l24-5M48 77l24-5M48 89l24-5" stroke="#d5b896" stroke-width="3"/>';
 else if(id==='B001')shape='<path d="M31 37l5-10 10 2 8-8 8 7 11-5 6 10 11 2-1 11 8 9-8 9 1 11-11 2-6 10-11-5-8 7-8-8-10 2-5-10-10-4 4-11-4-11z" fill="#a9b5a5"/><circle cx="57" cy="54" r="24" fill="#d4d9be"/>';
 else if(['自然物','ガラス・陶片'].includes(kind))shape=kind==='自然物'?'<path d="M20 85Q10 20 60 15Q110 20 100 85L60 105z" fill="#d8cbb0"/><path d="M60 100L30 35M60 100V20M60 100L90 35" stroke="#a7997e" fill="none"/>':'<path d="M36 15h48v20l15 20-8 45H29l-8-45 15-20z" fill="#83b7b0"/>' ;
 else if(kind.includes('工具'))shape='<path d="M30 12l14 23 18-10-1-20c29 12 20 35 3 40L40 104l-17-8 28-56c-18 0-25-9-21-28z" fill="#9daaa4"/>';
 else if(kind.includes('硬貨'))shape='<circle cx="60" cy="60" r="38" fill="#b4a06b"/><circle cx="60" cy="60" r="27" fill="none" stroke="#e3d2a5" stroke-width="4"/>' ;
 else if(kind.includes('装飾')||kind.includes('精密'))shape='<circle cx="60" cy="65" r="30" fill="none" stroke="#c9b06f" stroke-width="12"/><path d="M45 34l15-18 15 18-15 14z" fill="#d8cfe8"/>';
 else if(kind.includes('重量')||kind==='容器')shape='<rect x="23" y="30" width="74" height="66" rx="7" fill="#7b9184"/><path d="M23 50h74M48 43v18h24V43" stroke="#c6bc95" fill="none" stroke-width="5"/>';
 else shape='<ellipse cx="60" cy="66" rx="25" ry="35" fill="#a5aaa1"/><circle cx="60" cy="34" r="7" fill="none" stroke="#d2d5c8" stroke-width="5"/>';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true">${shape}</svg>`;
}
export interface RevealCallbacks {settled:(fn:number,isNew:boolean)=>void;next:()=>void;close:()=>void;}
export function mountReveal(root:HTMLElement,s:State,f:Find,callbacks:RevealCallbacks){
 let live=true,phase:'dirty'|'washing'|'done'='dirty',timer=0;const t=treasure(f.id),rarity=f.rarity??t.rarity,uid=f.uid;
 root.innerHTML=`<section class="wash-card" data-phase="dirty"><div id="reveal-status" class="reveal-status">発見物 / 未洗浄</div><div class="wash-display" role="img" aria-label="砂に覆われた回収品"><div class="treasure-art">${treasureShape(f.id)}</div><div class="dirt-layer"><i></i><i></i><i></i><span>?</span></div><div class="sand-fall" aria-hidden="true">· · ·</div></div><div class="wash-info"><h3 id="reveal-name">${f.id.startsWith('R')?'泥に覆われた回収品':f.id.startsWith('G')?'砂利から見つけた鉱物':'砂まみれの小物'}</h3><p id="reveal-description">汚れを落とすと、形が見えてきそう。</p></div><div class="wash-values"><span id="reveal-quality">品質・評価：未判明</span><strong id="reveal-reward">洗浄して確認</strong></div><div class="wash-actions"><button id="clean" class="primary">洗う</button><button id="next-find" class="primary" hidden>次へ</button><button id="skip-clean">スキップ</button></div></section>`;
 root.querySelector<HTMLElement>('.wash-card')!.dataset.rarity=rarity;
 const el=<T extends HTMLElement=HTMLElement>(q:string)=>root.querySelector<T>(q)!;const card=el('.wash-card');
 function finish(){if(!live||phase==='done')return;clearTimeout(timer);phase='done';const isNew=!s.discoveredTreasures[f.id],fn=reward(s,uid);card.dataset.phase='done';card.classList.remove('washing');if(rarity==='J')card.classList.add('jackpot');else if(['R','SR'].includes(rarity))card.classList.add('rare-reveal');
  el('#reveal-status').textContent=rarity==='J'?'JACKPOT / 特別依頼達成':isNew?'新発見 / 図鑑登録':'回収完了';
  el('.wash-display').setAttribute('aria-label',t.name);el('#reveal-name').textContent=`${t.name} / ${rarity}`;el('#reveal-description').textContent=t.description;
  el('#reveal-quality').textContent=`品質 ${Math.round(f.quality*100)}% ・ 評価 ${Math.round(t.baseValueFN*f.quality).toLocaleString()} FN`;
  el('#reveal-reward').textContent=`＋ ${fn.toLocaleString()} FN${t.contractOnly?' / 依頼返却':' / 回収報酬'}`;
  el('#clean').hidden=true;el('#next-find').hidden=false;el('#skip-clean').textContent='閉じる';callbacks.settled(fn,isNew);
 }
 el<HTMLButtonElement>('#clean').onclick=()=>{if(!live||phase!=='dirty')return;phase='washing';card.dataset.phase='washing';card.style.setProperty('--wash-time',s.settings.short?'350ms':'1400ms');card.classList.add('washing');el('#reveal-status').textContent='洗浄中…';el<HTMLButtonElement>('#clean').disabled=true;timer=window.setTimeout(finish,s.settings.short?350:1400);};
 el('#skip-clean').onclick=()=>phase==='done'?callbacks.close():finish();el('#next-find').onclick=callbacks.next;
 return ()=>{live=false;clearTimeout(timer);};
}
