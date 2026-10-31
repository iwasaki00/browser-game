import {ECHO_CLUES,ECHO_ROUTES,normalizeEchoes,signalUnlocked,storyRouteDestination} from './echoes.js';
import {renderImpossibleUI} from './impossible-ui.js';
export function renderEchoes({state,container,journal,onRoute,onRecord,onAnalyze,onAction}){
 container.replaceChildren();container.hidden=state.currentSector!=='homeward-09';
 const story=normalizeEchoes(state.echoes),h=document.createElement('h4');h.id='echoesHeading';h.textContent='消えた調査船からの信号';container.append(h);
 const line=document.createElement('p');line.textContent=story.events.at(-1)?.message??'帰還航路の途中に、まだ解読されていない通信がある。寄り道するかは、私たちが決める。';container.append(line);
 const chart=document.createElement('p');chart.className='echo-clue-chart';chart.textContent=`通信 ${story.clues['CLUE-01']?'●':'○'} ─ 惑星 ${story.clues['CLUE-02']?'●':'○'} ─ 台帳 ${story.clues['CLUE-03']?'●':'○'}${signalUnlocked(story)?' → 発信源を特定':''}`;container.append(chart);
 for(const route of ECHO_ROUTES){const button=document.createElement('button');button.type='button';button.dataset.echoRoute=route.id;button.textContent=route.label;button.disabled=!storyRouteDestination(story,state.frontier,route.id);button.setAttribute('aria-pressed',String(story.choices.at(-1)?.choice===route.id));button.addEventListener('click',()=>onRoute(route.id));container.append(button);}
 const hint=document.createElement('p');hint.textContent=signalUnlocked(story)?'判断は後から変更できます。選択した行き先へ、現在の速度のまま航行します。':'信号の追跡は、通信・惑星・台帳の照合後に選べます。帰還はいつでも可能です。';container.append(hint);
 if(!Object.keys(story.clues).length&&!story.choices.length)return;
 const article=document.createElement('article'),heading=document.createElement('h4');heading.textContent='通信解析日誌 / 消えた調査船';article.append(heading);
 for(const clue of ECHO_CLUES){const entry=story.clues[clue.id];if(!entry)continue;const p=document.createElement('p');p.textContent=`${clue.id} ${clue.name}：${clue.text}`;article.append(p);
  if(clue.related){const detail=document.createElement('p');detail.textContent=`関連：${clue.related.join('・')} ／ 条件：${clue.condition} ／ 取得：${entry.at!=null?new Date(entry.at).toLocaleString('ja-JP'):'旧記録・日時不明'}`;article.append(detail);}
  const reference=story.records[clue.id]??entry.flightId??state.frontier?.targets?.[clue.source]?.investigatedFlightId;if(reference){const b=document.createElement('button');b.type='button';b.textContent=`${clue.id} 航行をCINEMATIC再生（専用保護）`;b.addEventListener('click',()=>onRecord(reference));article.append(b);}}
 for(const event of story.events){const p=document.createElement('p');p.textContent=event.message;article.append(p);if(!ECHO_CLUES.some(c=>c.id===event.id)&&story.records[event.id]){const b=document.createElement('button');b.type='button';b.textContent='照合した航行をCINEMATIC再生（専用保護）';b.addEventListener('click',()=>onRecord(story.records[event.id]));article.append(b);}}
 for(const choice of story.choices){const p=document.createElement('p');p.textContent=`判断：${ECHO_ROUTES.find(r=>r.id===choice.choice)?.label} → ${choice.destination}`;article.append(p);}
 journal.append(article);renderImpossibleUI({story,container,journal,onAnalyze,onAction,onRecord});
}
