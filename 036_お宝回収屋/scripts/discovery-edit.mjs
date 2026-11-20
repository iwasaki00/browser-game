import fs from 'node:fs';
function edit(file,fn){const old=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),next=fn(old);if(next===old)throw Error('No change '+file);fs.writeFileSync(file,next);}
edit('src/reveal.ts',s=>{
 s="import {playDiscovery} from './discovery-ui';\n"+s;
 const start=s.indexOf(' root.innerHTML=`<section class="wash-card"'),end=s.indexOf('\n',start),line=s.slice(start,end);
 if(start<0)throw Error('markup missing');
 s=s.slice(0,start)+" root.innerHTML=washCardMarkup(f.id);"+s.slice(end);
 s=s.replace('export interface RevealCallbacks', 'export function washCardMarkup(id:string){'+line.trim().replace('root.innerHTML=','return ').replaceAll('f.id','id').replace('class="reveal-status"','class="reveal-status" role="status" aria-live="polite" aria-atomic="true"')+'}\nexport interface RevealCallbacks');
 s=s.replace('close:()=>void;}','close:()=>void;book?:(id:string)=>void;}');
 s=s.replace(" let live=true,phase:"," let discovery:ReturnType<typeof playDiscovery>|undefined;let live=true,phase:");
 const a=s.indexOf(' function finish(){'),b=s.indexOf(" el<HTMLButtonElement>('#clean').onclick",a);
 s=s.slice(0,a)+` function finish(){
  if(!live||phase==='done')return;clearTimeout(timer);firstEvent(s,'wash');phase='done';
  const themesBefore=themeSnapshot(s),wasNew=!s.discoveredTreasures[f.id],goalMatch=wasNew&&s.explorationGoal?.target===f.id,fn=reward(s,uid);
  const isNew=wasNew&&f.state==='paid'&&!!s.discoveredTreasures[f.id];
  card.dataset.phase='done';card.classList.remove('washing');
  el('.wash-display').setAttribute('aria-label',t.name);el('#reveal-name').textContent=t.name+' / '+rarity;el('#reveal-description').textContent=t.description;
  el('#reveal-quality').textContent='品質 '+Math.round(f.quality*100)+'% ・ 評価 '+Math.round(t.baseValueFN*f.quality).toLocaleString()+' FN';
  el('#reveal-reward').textContent='＋ '+fn.toLocaleString()+' FN'+(t.contractOnly?' / 依頼返却':' / 回収報酬');
  el('#clean').hidden=true;el('#next-find').hidden=false;el('#skip-clean').textContent='閉じる';
  const result={id:f.id,rarity,first:isNew,goal:!!(goalMatch&&s.explorationGoal?.completed.includes(f.id)),themes:newlyCompletedThemes(themesBefore,s).map(theme=>({id:theme.id,title:theme.title,found:theme.ids.length,total:theme.ids.length}))};
  callbacks.settled(fn,isNew);
  if(live)discovery=playDiscovery(card,result,{effects:effects(s),short:s.settings.short,book:callbacks.book});
 }
`+s.slice(b);
 s=s.replace("card.style.setProperty('--wash-time',s.settings.short?'350ms':'1400ms');", "const washMs=s.settings.short||window.matchMedia('(prefers-reduced-motion: reduce)').matches?350:1400;card.style.setProperty('--wash-time',washMs+'ms');");
 s=s.replace('window.setTimeout(finish,s.settings.short?350:1400)','window.setTimeout(finish,washMs)');
 s=s.replace("el('#skip-clean').onclick=()=>phase==='done'?callbacks.close():finish();el('#next-find').onclick=callbacks.next;", "el('#skip-clean').onclick=()=>{if(live)phase==='done'?callbacks.close():finish();};el('#next-find').onclick=()=>{if(live&&phase==='done')callbacks.next();};");
 return s.replace('live=false;clearTimeout(timer);','live=false;clearTimeout(timer);discovery?.dispose();');
});
edit('src/main.ts',s=>{
 s=s.replace("function wash(){", "function openThemeBook(id:string){openPanel('collection');const themes=$<HTMLDetailsElement>('#collection-themes');themes.open=true;const row=themes.querySelector<HTMLDetailsElement>('[data-theme=\"'+id+'\"]');if(row)row.open=true;themes.scrollIntoView({block:'start'});}\nfunction wash(){");
 s=s.replace('next:()=>stored(state).length?wash():close(),close});','next:()=>stored(state).length?wash():close(),close,book:openThemeBook});');
 s=s.replace('dev.openDebugLab({wash,get:', 'dev.openDebugLab({wash,book:openThemeBook,get:');
 return s+"\nimport './discovery.css';\n";
});
edit('src/dev.ts',s=>{
 s="import {mountDiscoveryLab,mountDiscoveryPreview} from './dev-discovery';\nimport {effects} from './experience';\n"+s;
 s=s.replace('interface Context {wash:', 'interface Context {book:(id:string)=>void;wash:');
 s=s.replace('let labSpeed=1;', 'let disposeDiscovery:(()=>void)|undefined;\nlet labSpeed=1;');
 s=s.replace("   mountTreasureCheck(body,s,c.changed,c.wash,next=>{c.replace(next);c.changed();render();});", "   mountTreasureCheck(body,s,c.changed,c.wash,next=>{c.replace(next);c.changed();render();});\n   mountDiscoveryLab(body,key=>{c.show('演出プレビュー / 登録・報酬なし','');document.querySelector('.sheet')!.classList.add('wash-sheet');disposeDiscovery=mountDiscoveryPreview(document.getElementById('sheet-body')!,key,{effects:effects(s),short:s.settings.short,book:c.book},render);});");
 return s.replace('export function disposeDebugLab(){', 'export function disposeDebugLab(){disposeDiscovery?.();disposeDiscovery=undefined;');
});
edit('src/discovery-ui.ts',s=>s.replace('reduced:media.matches','reduced:media.matches||document.hidden'));
