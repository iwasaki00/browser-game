import {destinationInfo} from './mission-guide.js';
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
export function resetRouteGuide(section){
 const old=section.querySelector('.route-guide');if(!old)return;
 const targets=old.querySelector('[data-route-targets]');if(targets)section.append(targets);
 const details=section.querySelector('.route-map-details'),svg=details?.querySelector('svg');if(svg)section.append(svg);details?.remove();old.remove();
}
// Reorders existing controls; selection still invokes the original listeners.
export function enhanceRouteGuide({section,policies,targets,context,checkpoint,policyText,onClose}){
 if(section.hidden||!targets)return;
 const box=make('section',null,'route-guide'),step=(n,title)=>{const p=make('section',null,'route-step');p.append(make('h4',`STEP ${n} · ${title}`));box.append(p);return p;};
 const a=step(1,'航行方針・判断を選ぶ');
 if(policies.length)for(const b of policies)a.append(b);else a.append(make('p','この宙域は目的地を自分で選びます。帰還・寄り道は自由です。'));
 a.append(make('small','方針は目標選びの補助です。安全保証や自動操縦ではありません。'));
 const b=step(2,'目的地を選ぶ');targets.dataset.routeTargets='';b.append(targets);
 const c=step(3,'選択内容を確認'),info=destinationInfo(context);
 c.append(make('p',`方針・判断：${policyText||'未選択（自由に目的地を選択）'}`));
 if(info){c.append(make('strong',info.name),make('p',`現在地から ${info.distance.toLocaleString()} 単位 · ${info.state==='DETECTED'?'検出済み・未調査':info.state==='INVESTIGATED'?'調査済み':info.state}`),make('p',info.description),make('p',`調査・到達方法：${info.method}`));}
 else c.append(make('p','行き先はまだ選ばれていません。選択可能な地点を上から選んでください。'));
 const d=step(4,'航行画面へ戻る'),go=make('button',info?'この場所へ向かう · 航行画面へ':'行き先を選んでください','homeward-primary');go.type='button';go.dataset.routeContinue='';go.disabled=!info||!context.flying&&checkpoint===context.stage.goal.id;go.addEventListener('click',onClose);d.append(go,make('small','戻ってANGLE・THRUSTと予測を確認し、発射します。飛行中は現在の航行を継続します。'));
 const heading=section.querySelector(':scope > h3');if(heading)heading.after(box);else section.prepend(box);
 // Keep the map available without pushing destination choices off-screen.
 const svg=section.querySelector('svg');if(svg){const details=make('details',null,'route-map-details');details.append(make('summary','星域図を表示する'),svg);box.after(details);}
}
