import {GalleryStore,galleryErrorMessage} from './gallery-store.js';
import {FlightReplay,replaySnapshot} from './flight-replay.js';
import {drawEncounters} from './encounter-render.js';
import {createOrbitShareUI}from'./orbit-share-ui.js';

export function drawReplay(canvas,record,time,full=false,view=null){
 const ctx=canvas.getContext('2d'),snapshot=view?.snapshot??replaySnapshot(record,time),frame={...snapshot.frame,planets:snapshot.planets},{width,height}=record.world;
 const camera=view?.mode!=='normal'?view?.camera:null;
 const scale=camera?.scale??Math.min(canvas.width/width,canvas.height/height);
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#030713';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(camera){const v=camera.transform,dpr=canvas.width/camera.width;ctx.setTransform(v.scale*dpr,0,0,v.scale*dpr,v.offsetX*dpr,v.offsetY*dpr);}
 else ctx.setTransform(scale,0,0,scale,(canvas.width-width*scale)/2,(canvas.height-height*scale)/2);
 ctx.save();
 if(!camera){ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();}
 else for(const star of view.stars.visible(camera.toWorld({x:0,y:0}),camera.toWorld({x:camera.width,y:camera.height}),record.world,scale)){
  ctx.globalAlpha=star.alpha;ctx.fillStyle=star.color;ctx.beginPath();ctx.arc(star.x,star.y,star.radius/scale,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 const goal=record.goal;ctx.strokeStyle='#70f6b3';ctx.lineWidth=camera?1.5/scale:2;ctx.beginPath();ctx.arc(goal.x,goal.y,camera?Math.max(goal.radius,5/scale):goal.radius,0,Math.PI*2);ctx.stroke();
 for(const d of record.destinations??[]){if(d.id===goal.id)continue;ctx.strokeStyle=d.color;ctx.lineWidth=camera?1/scale:2;ctx.beginPath();ctx.arc(d.x,d.y,Math.max(d.radius,5/scale),0,Math.PI*2);ctx.stroke();}
 if(camera){const first=record.frames[0];ctx.fillStyle='#ffce8b';ctx.beginPath();ctx.arc(first[1],first[2],3/scale,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle=record.result==='clear'?'#7be7be':'#72d8ff';ctx.lineWidth=camera?1.5/scale:1.8;
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
 if(record.encounters?.length)drawEncounters(ctx,record.encounters,frame.time,frame.rocket,camera?scale:scale/(canvas.width/(canvas.clientWidth||canvas.width)),null,camera);
 ctx.save();ctx.translate(frame.rocket.x,frame.rocket.y);ctx.rotate(camera?Math.atan2(snapshot.rocket.velocity.y,snapshot.rocket.velocity.x):Math.atan2(b[2]-a[2],b[1]-a[1]));if(camera){const size=Math.max(1,.7/scale);ctx.scale(size,size);}ctx.fillStyle='#fff';
 ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-4,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();ctx.restore();ctx.restore();
}

export function createGallery({canOpen=()=>true,onOpen=()=>{},store=new GalleryStore(),archive=null}={}){
 const $=s=>document.querySelector(s),dialog=$('#galleryDialog'),list=$('#galleryList'),player=$('#galleryPlayer'),listView=$('#galleryListView');
 let replay=null,record=null,full=false,raf=null,last=0,noticeTimer=null;
 const canvas=$('#replayCanvas'),cameraPointers=new Map();let pan=null,multi=false;
 const art=createOrbitShareUI({getRecord:()=>record,onEnter:()=>{stop();paint();},onExit:paint});
 function notify(message){
  $('#galleryNotice').textContent=message;$('#galleryMessage').textContent=message;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('#galleryNotice').textContent='';},message==='軌道を保存しました。'?2500:8000);
 }
 async function save(flight){try{await store.save(flight);notify('軌道を保存しました。');return true;}catch(error){notify(galleryErrorMessage(error));return false;}}
 function clearGesture(){pan=null;multi=false;cameraPointers.clear();replay?.camera.endPan();replay?.camera.endGesture();}
 function stop(){if(raf!==null)cancelAnimationFrame(raf);raf=null;replay?.pause();clearGesture();}
 function resize(){
  if(!replay||player.hidden)return;
  const b=canvas.getBoundingClientRect();if(b.width<=0||b.height<=0)return;
  const dpr=Math.min(window.devicePixelRatio||1,3),w=Math.round(b.width*dpr),h=Math.round(b.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;replay.resize(b.width,b.height);}
 }
 function paint(){
  if(!replay)return;resize();drawReplay(canvas,record,replay.time,full,replay);
  $('#replayTime').textContent=`${replay.time.toFixed(2)} / ${record.duration.toFixed(2)}秒`;
  $('#replayPlay').textContent=replay.playing?'一時停止':'再生';
  $('#replayResult').textContent=replay.time>=record.duration&&replay.phase!=='intro'?(record.result==='clear'?'CLEAR':'FAIL'):'';
  $('#replayPosition').value=String(replay.time);$('#replayCamera').value=replay.mode;
  $('#replayPhase').textContent=replay.phase==='intro'?'出航準備':replay.phase==='outro'?'航行終了':replay.mode.toUpperCase();
  const event=replay.snapshot.frame.encounterEvents?.at(-1);$('#replayEncounterLog').textContent=event?(event.type==='station'?'発見：宇宙ステーションを記録':'重力異常の反応を観測'):'';
 }
 function tick(now){
  if(!dialog.open||!replay){raf=null;return;}
  replay.advance(Math.min(.25,Math.max(0,(now-last)/1000)));last=now;paint();
  if(replay.playing)raf=requestAnimationFrame(tick);else raf=null;
 }
 function schedule(){if(raf===null&&replay?.playing){last=performance.now();raf=requestAnimationFrame(tick);}}
 function play(row){stop();art.dispose();record=row;replay=new FlightReplay(row);full=false;$('#replayFull').setAttribute('aria-pressed','false');$('#replaySpeed').value='1';$('#replayPosition').max=String(row.duration);listView.hidden=true;player.hidden=false;
  $('#replayTitle').textContent=row.stageName;replay.setMode($('#galleryDefaultCamera').value);replay.restart();paint();schedule();
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
 $('#replayPlay').addEventListener('click',()=>{if(!replay)return;replay.toggle();paint();schedule();});
 $('#replayRestart').addEventListener('click',()=>{clearGesture();replay?.restart();paint();schedule();});
 $('#replaySpeed').addEventListener('change',event=>{replay?.setSpeed(Number(event.target.value));});
 $('#replayCamera').addEventListener('change',event=>{clearGesture();replay?.setMode(event.target.value);$('#galleryDefaultCamera').value=event.target.value;paint();schedule();});
 $('#replayPosition').addEventListener('input',event=>{stop();replay?.seek(Number(event.target.value));paint();});
 $('#replayFull').addEventListener('click',()=>{full=!full;$('#replayFull').setAttribute('aria-pressed',String(full));paint();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();paint();}});
 window.addEventListener('resize',paint);
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(dialog.open&&!player.hidden)paint();}).observe(canvas);
 const point=event=>{const b=canvas.getBoundingClientRect();return {x:event.clientX-b.left,y:event.clientY-b.top};};
 const manual=()=>{if(replay){replay.manual();paint();}};
 for(const [id,factor]of [['replayZoomIn',1.25],['replayZoomOut',.8]])$('#'+id).addEventListener('click',()=>{if(!replay)return;clearGesture();manual();replay.camera.zoomAt(replay.camera.zoom*factor);paint();});
 $('#replayOverview').addEventListener('click',()=>{clearGesture();replay?.setMode('overview');paint();});
 canvas.addEventListener('pointerdown',event=>{
  if(!replay||event.button!==0)return;cameraPointers.set(event.pointerId,point(event));canvas.setPointerCapture(event.pointerId);
  if(cameraPointers.size>=2){pan=null;multi=true;manual();if(cameraPointers.size===2)replay.camera.beginGesture([...cameraPointers.values()]);}
  else if(!multi){pan={id:event.pointerId,start:point(event),dragging:false};replay.camera.beginPan(pan.start);}
  event.preventDefault();
 });
 canvas.addEventListener('pointermove',event=>{
  if(!replay||!cameraPointers.has(event.pointerId))return;const p=point(event);cameraPointers.set(event.pointerId,p);
  if(multi){if(cameraPointers.size===2)replay.camera.moveGesture([...cameraPointers.values()]);}
  else if(pan?.id===event.pointerId){if(Math.hypot(p.x-pan.start.x,p.y-pan.start.y)>=6&&!pan.dragging){pan.dragging=true;manual();}if(pan.dragging)replay.camera.movePan(p);}
  paint();event.preventDefault();
 });
 const endPointer=event=>{cameraPointers.delete(event.pointerId);if(pan?.id===event.pointerId){pan=null;replay?.camera.endPan();}if(multi){if(cameraPointers.size===2)replay?.camera.beginGesture([...cameraPointers.values()]);else replay?.camera.endGesture();if(!cameraPointers.size)multi=false;}};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,endPointer);
 window.addEventListener('blur',clearGesture);
 async function openRecord(id){
  if(!canOpen())return false;
  try{
   let row=null;if(archive)try{row=await archive.find(id);}catch{/* Try the ordinary gallery when the archive cannot be read. */}
   row??=(await store.list()).find(row=>row.id===id);
   if(!row){notify('参照先の航行記録がありません。自動整理・個別削除された記録は再生できません。');return false;}
   onOpen();if(!dialog.open)dialog.showModal();$('#galleryDefaultCamera').value='cinematic';play(row);return true;
  }catch(error){notify(galleryErrorMessage(error));return false;}
 }
 return {save,notify,openRecord,isOpen:()=>Boolean(dialog.open)};
}
