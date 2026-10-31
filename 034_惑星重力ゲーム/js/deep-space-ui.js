import {DEEP_ID,DEEP_TARGETS,DEEP_GATE,DEEP_POLICIES,normalizeDeep,deepLabel,deepAvailable,deepDeparture,createDeepSpace} from './deep-space.js';
import {DEEP_COURSES} from './deep-courses.js';
export function renderDeepSpace({container,state,navigation,onDestination,onPolicy,onRecord}){
 container.replaceChildren();container.hidden=state.currentSector!==DEEP_ID||navigation.active===false;if(container.hidden)return;
 const v=normalizeDeep(state.deep),position=navigation.position??deepDeparture(v),goal=[DEEP_GATE,...DEEP_TARGETS].find(t=>t.id===v.selected);
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;container.append(e);return e;};
 add('h3','DEEP SPACE / 航路計画');
 add('p',`現在 (${Math.round(position.x)}, ${Math.round(position.y)}) → ${deepLabel(v,v.selected)} (${goal.x}, ${goal.y}) · 距離 ${Math.round(Math.hypot(goal.x-position.x,goal.y-position.y)).toLocaleString()} · ${navigation.flying?'航行中':`寄港：${v.checkpoint==='origin'?'領域入口':deepLabel(v,v.checkpoint)}`}`);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 12000 10000');svg.setAttribute('aria-label','遠方探索マップ');svg.classList.add('deep-map');container.append(svg);
 const node=(tag,attrs,text)=>{const e=document.createElementNS(svg.namespaceURI,tag);for(const[k,value]of Object.entries(attrs))e.setAttribute(k,value);if(text)e.textContent=text;svg.append(e);return e;};
 node('rect',{width:12000,height:10000,fill:'#071422'});
 for(const p of createDeepSpace(v).planets)node('circle',{cx:p.x,cy:p.y,r:100,fill:p.color});
 node('circle',{cx:5000,cy:6000,r:1400,fill:'none',stroke:'#bc96ff','stroke-width':15,'stroke-dasharray':'70 70'});node('text',{x:5000,y:6000,fill:'#e4bdff','font-size':230},'引力異常・中心は危険');
 node('circle',{cx:6300,cy:2600,r:90,fill:'#d4a577'});
 for(const t of [DEEP_GATE,...DEEP_TARGETS]){if(!deepAvailable(v,t.id))continue;
  node('circle',{cx:t.x,cy:t.y,r:t.id===v.selected?170:110,fill:t.id==='return'?'#75edb0':v.targets[t.id].state==='INVESTIGATED'?'#8cddff':'#655489',stroke:t.id===v.selected?'#fff':'#b7cfff','stroke-width':25});
  node('text',{x:t.x,y:t.y-240,fill:'#e9f5ff','font-size':240,'text-anchor':'middle'},t.id==='return'?'帰還中継点':v.targets[t.id].state==='INVESTIGATED'?t.name:`? ${t.id}`);
 }
 node('circle',{cx:position.x,cy:position.y,r:95,fill:'#fff'});
 const policies=add('div','');policies.className='deep-actions';for(const[id,p]of Object.entries(DEEP_POLICIES)){const b=document.createElement('button');b.type='button';b.dataset.deepPolicy=id;b.textContent=p.label;b.setAttribute('aria-pressed',String(v.choices.at(-1)?.policy===id));b.addEventListener('click',()=>onPolicy(id));policies.append(b);}
 add('p',DEEP_POLICIES[v.choices.at(-1)?.policy]?.description??'方針は目標選びの補助です。操縦・危険回避は自動化しません。');
 const course=DEEP_COURSES[v.checkpoint+'>'+v.selected];
 if(course&&v.rewards.includes('deep-charts')&&!navigation.flying)add('p',`回収した星図の参考：ANGLE ${course[0]}° / THRUST ${course[1]} / 約${course[2].toFixed(1)}航行秒。初期惑星配置用。ANGLEの±は0.1°、予測で再確認。自動入力はしません。`);
 const list=add('div','');list.className='deep-actions';
 for(const t of [DEEP_GATE,...DEEP_TARGETS]){if(!deepAvailable(v,t.id))continue;const b=document.createElement('button');b.type='button';b.dataset.deepDestination=t.id;b.dataset.destination=t.id;b.textContent=`${deepLabel(v,t.id)} · ${t.id==='return'?'帰還':v.targets[t.id].state} · ${Math.round(Math.hypot(t.x-position.x,t.y-position.y))}単位`;b.setAttribute('aria-pressed',String(v.selected===t.id));b.disabled=!navigation.flying&&v.checkpoint===t.id;b.addEventListener('click',()=>onDestination(t.id));list.append(b);}
 for(const t of DEEP_TARGETS){const e=v.targets[t.id];if(e.state==='UNKNOWN')continue;
  add('h4',deepLabel(v,t.id));add('p',e.information??`検出済み。${t.investigateRadius}単位以内への接近で調査。危険な本体と調査地点は別です。`);
  if(e.firstDetectedAt)add('p',`初回検出：${new Date(e.firstDetectedAt).toLocaleString('ja-JP')}${e.investigatedAt?` ／ 調査：${new Date(e.investigatedAt).toLocaleString('ja-JP')}`:''}`);
  const ref=e.investigatedFlightId??e.detectedFlightId;if(ref){const b=add('button','関連航行をCINEMATIC再生（専用保護・途中記録の場合あり）');b.type='button';b.addEventListener('click',()=>onRecord(ref));}
 }
 if(v.rewards.includes('final-voyage-chart'))add('p','FINAL VOYAGE：帰還航路候補を整理。識別列・72時間・観測網の関係は未確定。次の宙域で確認する。');
 if(v.choices.length)add('p','判断履歴：'+v.choices.map(c=>DEEP_POLICIES[c.policy]?.label??c.policy).join(' → '));
}
export function appendDeepJournal(container,raw,onRecord){
 const v=normalizeDeep(raw),add=text=>{const p=document.createElement('p');p.textContent=text;container.append(p);};
 add(`現在の寄港地：${v.checkpoint==='origin'?'遠方領域入口':deepLabel(v,v.checkpoint)}`);
 for(const t of DEEP_TARGETS){const e=v.targets[t.id];if(e.state==='UNKNOWN')continue;
  add(`${deepLabel(v,t.id)} / ${e.state}：${e.information??'反応を検出。調査は任意。'}${e.investigatedAt?` ／ ${new Date(e.investigatedAt).toLocaleString('ja-JP')}`:''}`);
  const reference=e.investigatedFlightId??e.detectedFlightId??v.records[t.id];if(reference){const b=document.createElement('button');b.type='button';b.textContent=`${t.id}の重要航行をCINEMATIC再生（途中記録の場合あり）`;b.addEventListener('click',()=>onRecord(reference));container.append(b);}
 }
 if(v.choices.length)add('判断履歴：'+v.choices.map(c=>`${DEEP_POLICIES[c.policy]?.label??c.policy} → ${deepLabel(v,c.target)}`).join(' ／ '));
 if(v.rewards.includes('final-voyage-chart'))add('FINAL VOYAGE：識別列・72時間・観測網の関連は未確定。次の帰還航路の候補を記録。');
}
