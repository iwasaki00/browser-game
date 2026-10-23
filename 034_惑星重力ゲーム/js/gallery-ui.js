import {GalleryStore,galleryErrorMessage} from './gallery-store.js';
import {ReplayClock,replayFrame} from './flight-record.js';
import {createOrbitShareUI}from'./orbit-share-ui.js';

export function drawReplay(canvas,record,time,full=false){
 const ctx=canvas.getContext('2d'),frame=replayFrame(record,time),{width,height}=record.world;
 const scale=Math.min(canvas.width/width,canvas.height/height);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#030713';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.setTransform(scale,0,0,scale,(canvas.width-width*scale)/2,(canvas.height-height*scale)/2);
 ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
 const goal=record.goal;ctx.strokeStyle='#70f6b3';ctx.lineWidth=2;ctx.beginPath();ctx.arc(goal.x,goal.y,goal.radius,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle=record.result==='clear'?'#7be7be':'#72d8ff';ctx.lineWidth=1.8;
 ctx.beginPath();ctx.moveTo(record.frames[0][1],record.frames[0][2]);
 const end=full?record.frames.length-1:frame.index;
 for(let i=1;i<=end;i++)ctx.lineTo(record.frames[i][1],record.frames[i][2]);
 if(!full)ctx.lineTo(frame.rocket.x,frame.rocket.y);ctx.stroke();
 for(const p of frame.planets){
  for(const h of p.hazards??[]){ctx.strokeStyle=h.reason==='overheated'?'#ff9b45':'#bd9dff';ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(p.x,p.y,h.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle=p.color??'#6fd3ff';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();
  if(p.effect==='absorption'||p.effect==='repulsion'){ctx.strokeStyle=p.render?.glow??'#ba9aff';ctx.beginPath();ctx.ellipse(p.x,p.y,p.radius+8,p.radius*.7,-.3,0,Math.PI*2);ctx.stroke();}
 }
 const a=record.frames[Math.max(0,frame.index-1)],b=record.frames[Math.min(record.frames.length-1,frame.index+1)];
 ctx.save();ctx.translate(frame.rocket.x,frame.rocket.y);ctx.rotate(Math.atan2(b[2]-a[2],b[1]-a[1]));ctx.fillStyle='#fff';
 ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-4,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();ctx.restore();ctx.restore();
}

export function createGallery({canOpen=()=>true,onOpen=()=>{},store=new GalleryStore()}={}){
 const $=s=>document.querySelector(s),dialog=$('#galleryDialog'),list=$('#galleryList'),player=$('#galleryPlayer'),listView=$('#galleryListView');
 let clock=null,record=null,full=false,raf=null,last=0,noticeTimer=null;
 const art=createOrbitShareUI({getRecord:()=>record,onEnter:()=>{stop();paint();},onExit:paint});
 function notify(message){
  $('#galleryNotice').textContent=message;$('#galleryMessage').textContent=message;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('#galleryNotice').textContent='';},message==='軌道を保存しました。'?2500:8000);
 }
 async function save(flight){try{await store.save(flight);notify('軌道を保存しました。');}catch(error){notify(galleryErrorMessage(error));}}
 function stop(){if(raf!==null)cancelAnimationFrame(raf);raf=null;if(clock)clock.playing=false;}
 function paint(){
  if(!clock)return;drawReplay($('#replayCanvas'),record,clock.time,full);
  $('#replayTime').textContent=`${clock.time.toFixed(2)} / ${record.duration.toFixed(2)}秒`;
  $('#replayPlay').textContent=clock.playing?'一時停止':'再生';
  $('#replayResult').textContent=clock.time>=record.duration?(record.result==='clear'?'CLEAR':'FAIL'):'';
 }
 function tick(now){
  if(!dialog.open||!clock){raf=null;return;}
  clock.advance(Math.min(.25,Math.max(0,(now-last)/1000)));last=now;paint();
  if(clock.playing)raf=requestAnimationFrame(tick);else raf=null;
 }
 function schedule(){if(raf===null&&clock?.playing){last=performance.now();raf=requestAnimationFrame(tick);}}
 function play(row){stop();art.dispose();record=row;clock=new ReplayClock(row);full=false;$('#replayFull').setAttribute('aria-pressed','false');$('#replaySpeed').value='1';listView.hidden=true;player.hidden=false;
  $('#replayTitle').textContent=row.stageName;clock.restart();paint();schedule();
 }
 async function refresh(){
  try{
   const rows=await store.list();list.replaceChildren();$('#galleryCount').textContent=`自動 ${rows.filter(r=>!r.favorite).length}/20 ・ お気に入り ${rows.filter(r=>r.favorite).length}/30`;
   if(!rows.length)list.textContent='まだ記録がありません。ロケットを発射してみましょう。';
   for(const row of rows){
    const item=document.createElement('article'),open=document.createElement('button');open.className='gallery-record';open.type='button';
    const thumb=document.createElement('canvas');thumb.width=120;thumb.height=160;thumb.setAttribute('aria-hidden','true');drawReplay(thumb,row,row.duration,true);
    const copy=document.createElement('span');copy.textContent=`${row.favorite?'★ ':''}${row.stageName}`;
    const info=document.createElement('small');info.textContent=`${new Date(row.createdAt).toLocaleString('ja-JP')}\n${row.gameMode==='live'?'重力操作':'軌道設計'} / ${row.launchMode==='slingshot'?'スリングショット':'精密発射'}\n${row.result==='clear'?'CLEAR':'FAIL'} · ${row.duration.toFixed(2)}秒`;
    copy.append(info);open.append(thumb,copy);open.addEventListener('click',()=>play(row));
    const favorite=document.createElement('button');favorite.type='button';favorite.textContent=row.favorite?'★ 解除':'☆ お気に入り';favorite.setAttribute('aria-pressed',String(row.favorite));
    favorite.addEventListener('click',async()=>{try{if(!await store.setFavorite(row.id,!row.favorite))notify('お気に入りは最大30件です。解除してから登録してください。');await refresh();}catch(error){notify(galleryErrorMessage(error));}});
    const remove=document.createElement('button');remove.type='button';remove.textContent='削除';remove.addEventListener('click',async()=>{try{await store.delete(row.id);await refresh();}catch(error){notify(galleryErrorMessage(error));}});
    item.append(open,favorite,remove);list.append(item);
   }
  }catch(error){notify(galleryErrorMessage(error));list.textContent='保存された軌道を表示できません。ゲームはそのまま遊べます。';}
 }
 $('#openGallery').addEventListener('click',()=>{if(!canOpen())return;onOpen();stop();art.dispose();listView.hidden=false;player.hidden=true;dialog.showModal();void refresh();});
 $('#closeGallery').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{stop();art.dispose();});
 $('#replayBack').addEventListener('click',()=>{stop();art.dispose();player.hidden=true;listView.hidden=false;void refresh();});
 $('#replayPlay').addEventListener('click',()=>{if(!clock)return;if(clock.time>=record.duration)clock.time=0;clock.playing=!clock.playing;paint();schedule();});
 $('#replayRestart').addEventListener('click',()=>{clock?.restart();paint();schedule();});
 $('#replaySpeed').addEventListener('change',event=>{clock?.setSpeed(Number(event.target.value));});
 $('#replayFull').addEventListener('click',()=>{full=!full;$('#replayFull').setAttribute('aria-pressed',String(full));paint();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();paint();}});
 return {save,notify,isOpen:()=>Boolean(dialog.open)};
}
