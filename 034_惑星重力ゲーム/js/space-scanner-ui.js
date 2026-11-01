import {scanObjects,filterScan,searchPlanets,cycleTarget,relativeTarget,scanLayout,ScannerCamera,SCAN_FILTERS,scanPulse} from './space-scanner.js';
import {encounterPosition} from './encounters.js';

export function createSpaceScanner({root,camera,getContext,onCamera=()=>{},onSelect=()=>{},onDestination=()=>{},onPrepare=()=>{}}){
 // The legacy input unit test has no DOM tree; model tests cover this adapter.
 if(typeof root?.querySelector!=='function')return {update(){},render(){},manual(){},tap(){},close(){}};
 const bar=document.createElement('div');bar.className='scan-toolbar';
 bar.innerHTML='<button id="scanButton" type="button" aria-pressed="false">◉ SCAN</button><button id="scanSearch" type="button">惑星を探す</button><button id="scanBack" type="button" hidden>視点を戻す</button>';
 const layer=document.createElement('div');layer.className='scan-markers';layer.hidden=true;
 const panel=document.createElement('aside');panel.id='scanPanel';panel.className='scan-panel';panel.hidden=true;panel.setAttribute('aria-label','SPACE SCAN 天体情報');
 panel.innerHTML='<header><strong>SPACE SCAN</strong><button id="scanCollapse" type="button" aria-label="説明をたたむ">たたむ</button></header><div class="scan-content"><label>表示 <select id="scanFilter"></select></label><label>対象 <select id="scanTargets" aria-label="スキャン対象"></select></label><p id="scanSummary" role="status"></p><div class="scan-cycle"><button id="scanPrev" type="button">前の惑星</button><button id="scanNext" type="button">次の惑星</button></div><h3 id="scanName"></h3><p id="scanType"></p><p id="scanInfo"></p><p id="scanActions"></p><p id="scanMethod"></p><div class="scan-actions"><button id="scanShow" type="button">表示</button><button id="scanReturn" type="button">戻る</button><button id="scanDestination" type="button">目的地に設定</button></div><button id="scanEnd" type="button">スキャン終了</button></div>';
 root.append(bar,layer,panel);const $=s=>panel.querySelector(s),button=bar.querySelector('#scanButton');
 for(const [value,text]of Object.entries(SCAN_FILTERS)){const option=document.createElement('option');option.value=value;option.textContent=text;$('#scanFilter').append(option);}
 let active=false,expanded=false,filter='all',search=false,selected=null,rows=[],lastBuild=-Infinity,lastUI=-Infinity,lastMarkers=-Infinity,started=0,oldStage=null,signature='',markers=[];
 const motion=new ScannerCamera(camera);
 document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('#scanShow,#scanBack,#scanReturn'))motion.cancel();},true);
 function refresh(time=performance.now(),force=false){
  const context=getContext(),key=[context.phase,context.gameMode,context.playType,context.stage.planets.length,context.stage.encounters?.length??0].join(':');
  if(context.stage!==oldStage){oldStage=context.stage;motion.clear();selected=null;lastBuild=-Infinity;}
  if(!force&&key===signature&&time-lastBuild<250)return;
  signature=key;rows=scanObjects(context);lastBuild=time;lastMarkers=-Infinity;
  const available=search?searchPlanets(rows,camera.center):filterScan(rows,filter);
  if(!available.some(o=>o.id===selected))selected=available[0]?.id??null;
 }
 function showInfo(time=performance.now()){
  const available=search?searchPlanets(rows,camera.center):filterScan(rows,filter),current=rows.find(o=>o.id===selected);
  const select=$('#scanTargets');const key=available.map(o=>o.id+o.name).join('|');
  if(select.dataset.items!==key){select.replaceChildren();for(const o of available){const option=document.createElement('option');option.value=o.id;option.textContent=`${o.icon} ${o.name}`;select.append(option);}select.dataset.items=key;}
  select.value=selected??'';select.disabled=!available.length;
  $('#scanSummary').textContent=search?(available.length?`操作可能な惑星 ${available.findIndex(o=>o.id===selected)+1} / ${available.length}（カメラ中心から近い順）`:'現在のモード・飛行状態に操作可能な惑星はありません。RESETや重力操作モードで再確認できます。'):`対象 ${available.length}件 · マーカーは最大6件。全対象は一覧から選択できます。`;
  $('.scan-cycle').hidden=!search;for(const id of ['#scanPrev','#scanNext'])$(id).disabled=available.length<2;
  $('#scanName').textContent=current?`${current.icon} ${current.name}`:'対象なし';
  const relative=current?relativeTarget(current,camera.center):null;
  $('#scanType').textContent=current?`${current.type} / ${current.state} / ${relative.direction} ${Math.round(relative.distance).toLocaleString()}単位`:'';
  $('#scanInfo').textContent=current?.description??'';$('#scanActions').textContent=current?[...current.permission.actions,current.permission.reason].join('。'):'';
  $('#scanMethod').textContent=current?`調査・確認：${current.method}`:'';
  $('#scanShow').disabled=!current;$('#scanReturn').disabled=!motion.origin;$('#scanDestination').hidden=!current?.destination;lastUI=time;
 }
 function open(){onPrepare();active=true;started=performance.now();button.textContent='◉ SCAN終了';button.setAttribute('aria-pressed','true');layer.hidden=false;root.classList.add('scanning');refresh(started,true);}
 function expand(){expanded=true;panel.hidden=false;root.classList.add('scan-expanded');showInfo();$('.scan-content').scrollTop=0;}
 function close(){active=false;expanded=false;panel.hidden=true;layer.hidden=true;layer.replaceChildren();delete layer.dataset.ids;markers=[];root.classList.remove('scanning','scan-expanded');button.textContent='◉ SCAN';button.setAttribute('aria-pressed','false');motion.restore(performance.now());}
 bar.querySelector('#scanBack').addEventListener('click',()=>motion.restore(performance.now()));
 button.addEventListener('click',()=>{if(active)close();else{search=false;filter='all';$('#scanFilter').value=filter;open();expand();}});
 bar.querySelector('#scanSearch').addEventListener('click',()=>{if(!active)open();search=true;filter='editable';$('#scanFilter').value=filter;refresh(performance.now(),true);selected=searchPlanets(rows,camera.center)[0]?.id??null;expand();});
 $('#scanCollapse').addEventListener('click',()=>{expanded=false;panel.hidden=true;root.classList.remove('scan-expanded');});
 $('#scanEnd').addEventListener('click',close);
 $('#scanFilter').addEventListener('change',e=>{search=false;filter=e.target.value;refresh(performance.now(),true);showInfo();});
 $('#scanTargets').addEventListener('change',e=>{selected=e.target.value;showInfo();});
 for(const [id,delta]of [['#scanPrev',-1],['#scanNext',1]])$(id).addEventListener('click',()=>{refresh(performance.now(),true);selected=cycleTarget(searchPlanets(rows,camera.center),selected,delta)?.id??null;showInfo();});
 $('#scanShow').addEventListener('click',()=>{refresh(performance.now(),true);const target=rows.find(o=>o.id===selected);if(!target)return;onPrepare();if(target.category==='planet')onSelect(target.sourceId);motion.show(target,performance.now());expanded=false;panel.hidden=true;root.classList.remove('scan-expanded');});
 // The search button reopens details; the original camera snapshot survives cycling.
 $('#scanReturn').addEventListener('click',()=>{motion.restore(performance.now());showInfo();});
 $('#scanDestination').addEventListener('click',()=>{const target=rows.find(o=>o.id===selected);if(target?.destination){onDestination(target.destination);refresh(performance.now(),true);showInfo();}});
 function manual(){motion.cancel();}
 function tap(point){
  refresh(performance.now(),true);
  const target=rows.map(o=>({o,d:Math.hypot(point.x-o.x,point.y-o.y)})).filter(v=>v.d<=Math.max(v.o.category==='planet'?v.o.radius:20,22/camera.scale)).sort((a,b)=>a.d-b.d)[0]?.o;
  if(!target)return false;if(!active)open();filter='all';search=false;$('#scanFilter').value=filter;selected=target.id;expand();return true;
 }
 function update(time){if(oldStage&&getContext().stage!==oldStage){motion.clear();oldStage=null;lastBuild=-Infinity;}if(motion.update(time))onCamera();const back=bar.querySelector('#scanBack'),hidden=!motion.origin;if(back.hidden!==hidden)back.hidden=hidden;}
 function render(ctx,time){
  if(!active)return;refresh(time);if(expanded&&time-lastUI>=250)showInfo(time);
  const current=getContext();for(const row of rows){const source=row.category==='planet'?current.stage.planets.find(p=>p.id===row.sourceId):(current.stage.encounters??[]).find(e=>e.id===row.sourceId);if(source)Object.assign(row,row.category==='planet'?{x:source.x,y:source.y}:encounterPosition(source,current.elapsed));}
  const filtered=search?searchPlanets(rows,camera.center):filterScan(rows,filter),dpr=Math.min(window.devicePixelRatio||1,3);
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const light=getContext().quality==='light';
  if(!light&&time-started<800){const f=scanPulse(time,started);ctx.strokeStyle=`rgba(102,242,221,${.35*(1-f)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(camera.width/2,camera.height/2,f*Math.hypot(camera.width,camera.height),0,Math.PI*2);ctx.stroke();}
  for(const o of filtered){const p=camera.toScreen(o),r=Math.max(14,Math.min(110,o.radius*camera.scale+5));if(p.x+r<0||p.y+r<0||p.x-r>camera.width||p.y-r>camera.height)continue;ctx.strokeStyle=o.color;ctx.lineWidth=o.permission.editable?2:1;ctx.setLineDash(o.permission.editable?[]:[3,4]);ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=o.color;ctx.font='bold 13px sans-serif';ctx.fillText(o.permission.editable?'✥':o.icon,p.x+r-2,p.y-r+6);}
  ctx.restore();
  // Rings follow every rendered frame. DOM labels need at most 10 Hz, plus
  // explicit catalogue/input changes; avoid layout reads on the other frames.
  if(time-lastMarkers<100)return;lastMarkers=time;
  const blocked=[...root.querySelectorAll('.scan-panel,.camera-controls,.flight-speed,.destination-control,.selection-bar,.frontier-notice,.homeward-coach,.result')].filter(e=>!e.hidden).map(e=>{const a=e.getBoundingClientRect(),b=root.getBoundingClientRect();return{x:a.x-b.x,y:a.y-b.y,width:a.width,height:a.height};});
  const layout=scanLayout(filtered,camera,{top:58,bottom:74,max:6,blocked,selected});
  const ids=layout.map(o=>o.id).join('|');
  if(layer.dataset.ids!==ids){layer.replaceChildren();markers=[];for(const item of layout){const b=document.createElement('button');b.type='button';b.className='scan-marker';b.dataset.scanId=item.id;b.append(document.createElement('span'),document.createElement('span'));b.addEventListener('click',()=>{selected=item.id;const target=rows.find(o=>o.id===selected);if(target?.category==='planet')onSelect(target.sourceId);expand();});layer.append(b);markers.push(b);}layer.dataset.ids=ids;}
  layout.forEach((item,i)=>{const b=markers[i],text=`${item.label}\n${item.detail}`;if(b.title!==text){b.children[0].textContent=item.label;b.children[1].textContent=item.detail;b.setAttribute('aria-label',text);b.title=text;}b.classList.toggle('offscreen',item.outside);const transform=`translate(${item.x}px,${item.y}px)`,width=item.width+'px';if(b.style.transform!==transform)b.style.transform=transform;if(b.style.width!==width)b.style.width=width;});
 }
 return {update,render,manual,tap,close};
}
