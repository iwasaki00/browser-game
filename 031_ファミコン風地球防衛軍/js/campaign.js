import {ChallengeBoard} from './challenge-ui.js?v=0.8.0';
import {ACHIEVEMENT_BY_ID} from './achievement-master.js?v=0.8.0';
import {MISSIONS,WEAPONS,WEAPON_CATEGORIES,PLAYER_CLASSES,missionStatus,canPlayMission} from './data.js?v=0.8.0';

export const CAMPAIGN_TABS=['missions','classes','weapons','achievements'];
export const MISSION_BRIEFINGS=Object.freeze({
  M01:{setting:'侵略された地上市街地',feature:'大量の敵を迎撃する地上市街戦',enemies:'E-01〜04 / B-01 マザークロウラー',background:'city'},
  M02:{setting:'分岐する地下施設',feature:'地下通路・上下ルートとスポーンネストを攻略',enemies:'E-05・06 / B-02 アビス・クイーン',background:'underground'},
  M03:{setting:'海岸・港湾施設',feature:'海上侵攻と飛行敵の編隊を迎撃',enemies:'E-07〜09 / B-03 リヴァイアサン',background:'coast'},
  M04:{setting:'空中要塞と輸送足場',feature:'外部砲台→左右装置→中央コアを破壊',enemies:'E-10〜12 / B-04 スカイフォートレス',background:'sky'},
  M05:{setting:'走行する巨大移動基地',feature:'甲板・機関・制御を突破し動力炉を破壊',enemies:'E-13〜15 / B-05 フォートレスリアクター',background:'mobile'},
  M06:{setting:'巨大異星生物の内部',feature:'脈動通路・体液流・神経網と神経中枢を攻略',enemies:'E-16〜18 / B-06 ニューラルハート',background:'living'}
});
export const campaignTime=seconds=>Number.isFinite(seconds)&&seconds>0?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'記録なし';
export function campaignProgress(save,missions=MISSIONS){
  const implemented=missions.filter(m=>m.implemented),cleared=implemented.filter(m=>save.clearedMissions.includes(m.id));
  return {cleared:cleared.length,total:implemented.length,percent:implemented.length?Math.round(cleared.length/implemented.length*100):0,next:implemented.find(m=>!save.clearedMissions.includes(m.id)&&canPlayMission(m.id,save,missions))??null};
}
const scoreText=v=>Number.isFinite(v)&&v>0?String(Math.floor(v)):'記録なし';
export function missionRecord(m,save){const s=save.missionStats[m.id],status=missionStatus(m,save);return {status,label:status==='CLEAR'?'CLEAR / クリア済み':status==='OPEN'?'OPEN / 未クリア':status==='LOCKED'?'LOCKED / 未解放':'COMING SOON',score:scoreText(s?.highScore),time:campaignTime(s?.bestTime),reward:save.campaignStats.firstRewards[m.id]?'取得済み':status==='CLEAR'?'過去分未記録':'未取得'}}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


export class CampaignCommand {
  constructor(doc){this.document=doc;this.challenges=new ChallengeBoard(doc);this.tab='missions';this.selected='M01';this.category='ALL';this.query='';this.animation=true;this.lastPreview=-Infinity;this.previewFrame=0;this.previewFrames=0}
  render(save,icon){const document=this.document,text=(id,value)=>document.querySelector('#'+id).textContent=value;
    const progress=campaignProgress(save);if(!MISSIONS.some(m=>m.id===this.selected))this.selected=progress.next?.id??MISSIONS[0]?.id;
    text('campaignProgress',`CAMPAIGN ${progress.cleared}/${progress.total} COMPLETE · ${progress.percent}%`);text('campaignNext',progress.next?`次の目標：${progress.next.id} ${progress.next.name}`:progress.total>0&&progress.cleared===progress.total?'実装済みミッションを全クリア！兵科や装備を変えて再挑戦':'挑戦可能な未クリアミッションはありません');
    const bar=document.querySelector('#campaignProgressBar');bar.value=progress.cleared;bar.max=progress.total||1;
    for(const tab of CAMPAIGN_TABS){const active=this.tab===tab,b=document.querySelector('#campaignTab-'+tab);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;document.querySelector('#campaignPanel-'+tab).hidden=!active}
    const title=ACHIEVEMENT_BY_ID.get(save.achievements.selectedTitle)?.title;const coverage=save.campaignStats.legacyUnrecorded?'戦績は0.7.0以降のみ。過去分未記録。':'戦績は0.7.0以降の正式出撃のみ。';text('campaignCoverage',`${title?'称号：'+title+' · ':''}${coverage}`);
    const list=document.querySelector('#missionList');list.replaceChildren();
    for(const m of MISSIONS){const r=missionRecord(m,save),row=document.createElement('article');row.className='command-mission';row.dataset.status=r.status;row.dataset.selected=String(this.selected===m.id);
      row.innerHTML=`<button class="command-select" data-action="campaign-select" data-mission="${esc(m.id)}" aria-pressed="${this.selected===m.id}"><b>${esc(m.id)}</b><span><strong>${esc(m.name)}</strong><small>${esc(r.label)} · ${esc(m.description)}</small></span></button><p>BEST ${r.score} · TIME ${r.time} · 初回報酬 ${r.reward}</p><button class="command-deploy" data-action="select-mission" data-mission="${esc(m.id)}" ${canPlayMission(m.id,save)?'':'disabled'}>出撃</button>`;list.append(row)}
    const m=MISSIONS.find(m=>m.id===this.selected);if(m){const r=missionRecord(m,save),brief=MISSION_BRIEFINGS[m.id];text('campaignMissionTitle',`${m.id} ${m.name}`);text('campaignMissionSetting',brief?.setting??m.description);text('campaignMissionFeature',brief?.feature??m.description);text('campaignMissionEnemies',brief?.enemies??'詳細未公開');text('campaignMissionObjective',m.description);text('campaignMissionRecord',`${r.label} / BEST ${r.score} / TIME ${r.time} / 初回報酬 ${r.reward}`);
      const deploy=document.querySelector('#campaignDeploy');deploy.disabled=this.tab!=='missions'||!canPlayMission(m.id,save);deploy.dataset.mission=m.id;deploy.textContent=`${m.id} 出撃準備へ`;deploy.hidden=this.tab!=='missions'}
    this.renderClasses(save);this.renderWeapons(save,icon);this.challenges.render(save,this.selected);this.lastPreview=-Infinity;
  }
  renderClasses(save){const document=this.document;const grid=document.querySelector('#campaignClassList');grid.replaceChildren();for(const c of Object.values(PLAYER_CLASSES)){const r=save.campaignStats.classes[c.id],card=document.createElement('article');card.className='command-class';
    card.innerHTML=`<h3>${c.id}</h3><p>${r?'記録あり':'記録なし（0.7.0以降未出撃）'}</p><dl>${[['出撃',r?.sorties],['クリア',r?.clears],['GAME OVER',r?.gameOvers],['累計撃破',r?.kills],['実働時間',r?`${r.playSeconds.toFixed(1)}秒`:undefined]].map(([label,v])=>`<div><dt>${label}</dt><dd>${v===undefined?'未記録':v}</dd></div>`).join('')}</dl><details><summary>ミッション別記録</summary>${MISSIONS.filter(m=>m.implemented).map(m=>{const s=r?.missions[m.id];return `<p>${m.id} · BEST ${scoreText(s?.highScore)} · TIME ${campaignTime(s?.bestTime)}</p>`}).join('')}</details>`;grid.append(card)}}
  renderWeapons(save,icon){const document=this.document,text=(id,value)=>document.querySelector('#'+id).textContent=value;text('campaignWeaponProgress',`${WEAPONS.filter(w=>save.unlocked.includes(w.id)).length}/${WEAPONS.length} UNLOCKED`);const grid=document.querySelector('#campaignWeaponList');grid.replaceChildren();const query=this.query.normalize('NFKC').toLowerCase().replace(/[\s-]/g,'');
    for(const w of WEAPONS){if(this.category!=='ALL'&&w.category!==this.category||query&&!`${w.id}${w.name}`.normalize('NFKC').toLowerCase().replace(/[\s-]/g,'').includes(query))continue;
      const r=save.campaignStats.weapons[w.id],unlocked=save.unlocked.includes(w.id),card=document.createElement('article');card.className='command-weapon';card.dataset.unlocked=String(unlocked);
      card.innerHTML=`<header><span class="collection-icon"></span><div><h3>${w.id} ${w.name}</h3><small>${unlocked?'解放済み':'未解放'} · ${WEAPON_CATEGORIES[w.category]}</small></div></header><p>威力 ${w.damage}${w.pellets?' × '+w.pellets:''} / 間隔 ${w.interval}秒 / 射程 ${w.range}px</p><p>${w.detail}</p><p class="command-record">${r?`装備出撃 ${r.equipped} / 使用 ${r.uses} / 有効命中 ${r.hits}${w.type==='mine'||w.type==='turret'?` / 設置 ${r.placements}`:''}${w.type==='mine'?` / 起爆操作 ${r.detonations}（${r.minesDetonated}個）`:''}`:'使用記録なし（過去分未記録）'}</p>`;
      const pic=document.createElement('canvas');pic.width=pic.height=32;pic.className='collection-icon';pic.setAttribute('aria-label',w.name+' アイコン');const ctx=pic.getContext('2d');ctx.imageSmoothingEnabled=false;icon(ctx,w);card.append(pic);grid.append(card)
    }if(!grid.children.length){const p=document.createElement('p');p.textContent='一致する武器がありません';grid.append(p)}
  }
  preview(ts,visible,resources){const document=this.document;
    if(!visible||this.tab!=='missions')return false;
    const resource=resources[this.selected]??{},image=resource.background;if(this.previewImage!==image){this.previewImage=image;this.lastPreview=-Infinity}
    const reduced=document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false,animated=this.animation&&!reduced&&!!image;
    if(!animated&&this.lastPreview!==-Infinity||animated&&ts-this.lastPreview<100)return false;
    this.lastPreview=ts;this.previewFrame=animated?Math.floor(ts/160)%8:0;this.previewFrames++;
    const c=document.querySelector('#campaignPreview').getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#132334';c.fillRect(0,0,320,180);
    if(image)c.drawImage(image,0,0,image.width||640,image.height||360,0,0,320,180);
    if(resource.actor){const a=resource.actor,f=this.previewFrame%a.frames,x=animated?222-Math.floor(ts/80)%52:200;c.drawImage(a.image,f*a.w,a.row??0,a.w,a.h,x,148-a.dh,a.dw,a.dh)}
    if(resource.overlay){const a=resource.overlay;c.drawImage(a.image,0,0,a.w,a.h,125,90,a.dw,a.dh)}
    // Sparse, cosmetic mission accents only. No actor/AI/mission state exists.
    c.fillStyle=this.selected==='M06'?'#adcfb877':'#d0dcb955';if(animated)c.fillRect(12+(Math.floor(ts/90)%120),155,3,1);
    const canvas=document.querySelector('#campaignPreview');canvas.dataset.mission=this.selected;canvas.dataset.animated=String(animated);canvas.dataset.fallback=String(!image);canvas.setAttribute('aria-label',`${this.selected} 戦場プレビュー${image?'':'（静止背景代替）'}`);return true;
  }
}
