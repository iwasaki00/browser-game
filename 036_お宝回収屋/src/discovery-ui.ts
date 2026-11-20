import {discoveryDuration,type DiscoveryResult,type DiscoveryPreferences} from './discovery';
export interface DiscoveryOptions {effects:DiscoveryPreferences['effects'];short:boolean;book?:(id:string)=>void;preview?:boolean;}
// A visual consumer of an already committed result. No State, reward or persistence dependency.
export function playDiscovery(card:HTMLElement,result:DiscoveryResult,options:DiscoveryOptions){
 const media=window.matchMedia('(prefers-reduced-motion: reduce)'),duration=discoveryDuration(result,{...options,reduced:media.matches||document.hidden});
 let live=true,ended=false;const timers:number[]=[];
 let group:HTMLElement|undefined;
 const display=card.querySelector<HTMLElement>('.wash-display')!,status=card.querySelector<HTMLElement>('#reveal-status')!,info=card.querySelector<HTMLElement>('.wash-info')!;
 if(card.dataset.discovery){card.dataset.revealActive='false';void card.offsetWidth;}
 card.dataset.first=String(result.first);card.dataset.discovery=options.preview?'preview':'registered';card.dataset.revealActive=String(duration>0);card.dataset.discoveryStage=duration?'item':'achievement';card.style.setProperty('--discovery-time',duration+'ms');
 status.textContent=result.rarity==='J'?'JACKPOT / '+(result.first?'初発見':'再発見'):result.first?'新発見 / 図鑑登録':'回収完了';
 if(options.preview)status.textContent='PREVIEW / 登録・報酬なし';
 if(result.first){const badge=document.createElement('b');badge.className='discovery-new';badge.textContent='NEW！';status.append(badge);}
 if(result.goal){const note=document.createElement('span');note.className='exploration-achieved';note.textContent='探索目標を達成';status.append(note);}
 for(const theme of result.themes){const note=document.createElement('span');note.className='theme-completed';note.textContent='テーマ完成！ — '+theme.title;status.append(note);}
 if(result.themes.length){
  card.dataset.themeComplete='true';card.querySelector<HTMLElement>('#reveal-description')!.hidden=true;
  group=document.createElement('div');group.className='discovery-theme-result';group.setAttribute('aria-label',result.themes.map(t=>t.title).join('・'));
  const progress=document.createElement('strong');progress.textContent=result.themes.map(t=>t.found+' / '+t.total).join('・');group.append(progress);
  if(options.book){const book=document.createElement('button');book.id='discovery-book';book.textContent='図鑑で見る';book.onclick=()=>{if(live){stop();options.book!(result.themes[0].id);}};group.append(book);}
  info.append(group);
 }
 const skip=document.createElement('button');skip.id='discovery-skip';skip.textContent='演出終了';skip.hidden=!duration;skip.setAttribute('aria-label','発見演出を終了');display.append(skip);
 function stop(){if(!live||ended)return;ended=true;for(const t of timers)clearTimeout(t);card.dataset.revealActive='false';card.dataset.discoveryStage='achievement';skip.hidden=true;}
 const tap=()=>stop(),visibility=()=>{if(document.hidden)stop();},reduce=()=>{if(media.matches)stop();};
 skip.onclick=stop;display.addEventListener('click',tap);document.addEventListener('visibilitychange',visibility);media.addEventListener('change',reduce);
 if(duration){timers.push(window.setTimeout(()=>{if(live)card.dataset.discoveryStage='achievement';},Math.min(750,duration*.6)));timers.push(window.setTimeout(stop,duration));}
 return {skip:stop,dispose:()=>{stop();live=false;display.removeEventListener('click',tap);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',reduce);skip.onclick=null;skip.remove();group?.remove();}};
}
