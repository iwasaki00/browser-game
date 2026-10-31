import {IMPOSSIBLE_ACTIONS,impossibleState,temporalUnlocked} from './impossible-signal.js';
const RESULTS={pending:'航行で確認中',superseded:'別の判断へ変更',investigated:'内側で通信を取得',observed:'外側で連続観測',returned:'帰還・再調査可能','returned-after-approach':'接近後に帰還',reset:'RESETで中断','docked-without-condition':'寄港・条件は未達',crashed:'衝突で未達',escaped:'ワールド外で未達',timeout:'時間切れで未達'};
export function renderImpossibleUI({story,container,journal,onAnalyze,onAction,onRecord}){
 if(!story.clues?.['CLUE-05'])return;
 const episode=impossibleState(story),panel=document.createElement('section');panel.id='impossiblePanel';
 const h=document.createElement('h4');h.textContent='THE IMPOSSIBLE SIGNAL / ありえない信号';panel.append(h);
 const p=document.createElement('p');p.textContent=story.clues['CLUE-07']?'同じ識別番号、基準時より72時間先の通信。未来の本船なのか、記録の異常なのか。船影は確認できません。':'回収した通信を解析できます。解析や調査をせず、帰還を続けても構いません。';panel.append(p);
 for(const [kind,label,required,done]of [['identity','識別番号を解析','CLUE-05','CLUE-06'],['timestamp','送信時刻を解析','CLUE-06','CLUE-07']]){const b=document.createElement('button');b.type='button';b.dataset.signalAnalysis=kind;b.textContent=story.clues[done]?label+' · 解析済み':label;b.disabled=!story.clues[required]||Boolean(story.clues[done]);b.addEventListener('click',()=>onAnalyze(kind));panel.append(b);}
 if(temporalUnlocked(story)){
  const wave=document.createElement('p');wave.className='echo-clue-chart';wave.textContent='⌁ ─ ∿ ─ ⌁  UNKNOWN ANOMALY';wave.setAttribute('aria-label','照合した信号の反応');panel.append(wave);
  for(const action of IMPOSSIBLE_ACTIONS){const b=document.createElement('button');b.type='button';b.dataset.impossibleAction=action.id;b.textContent=action.label;b.setAttribute('aria-pressed',String(episode.choices.at(-1)?.choice===action.id));b.addEventListener('click',()=>onAction(action.id));panel.append(b);}
  const hint=document.createElement('p');hint.textContent='調査：150以内。観測：220〜500の距離で連続1航行秒。観測は現在の目的地を維持します。操船は自動化されず、後から判断を変えられます。';panel.append(hint);
 }
 container.append(panel);
 const article=document.createElement('article'),heading=document.createElement('h4');heading.textContent='ありえない信号 / 判断・調査結果';article.append(heading);
 for(const choice of episode.choices){const line=document.createElement('p');line.textContent=`#${choice.id} ${IMPOSSIBLE_ACTIONS.find(a=>a.id===choice.choice)?.label} → ${RESULTS[choice.result]??choice.result}${Number.isFinite(choice.elapsed)?`（航行 ${choice.elapsed.toFixed(3)}秒）`:''}`;article.append(line);}
 if(story.clues['CLUE-09']){const line=document.createElement('p');line.textContent='未来の自分たちからの通信かもしれない。しかし発信元も、警告なのか救難要請なのかも確認できない。';article.append(line);}
 for(const id of ['impossible-approach','impossible-ending','impossible-result-investigate','impossible-result-avoid','impossible-result-observe'])if(story.records?.[id]){const b=document.createElement('button');b.type='button';b.textContent=`${id} 航行をCINEMATIC再生（専用保護）`;b.addEventListener('click',()=>onRecord(story.records[id]));article.append(b);}
 journal.append(article);
}
