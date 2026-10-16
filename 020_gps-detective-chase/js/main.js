import { GPS } from "./gps.js";
import { GameMap } from "./map.js";
import { SAFETY_ITEMS,isNameValid } from "./safety.js";
import { makeWitness } from "./witness.js";
import { captureState,freshPosition,validPosition } from "./capture.js";
import { formatClock,normalizeRoomId } from "./utils.js";
const $=s=>document.querySelector(s), screens=[...document.querySelectorAll(".screen")];
let mode="create",uid,room,data,myPos,map,gps,sendTimer,tickTimer,witnessUnsub=null,captureSince=0,lastWitnessPos=null,roleSeen=false,debugController=null,useVirtualGps=false;
let epoch=0,runtime=0,connected=false,gpsUsable=false,sendBusy=false,tickBusy=false,lastSent=0,sendFailed=false,lastTick=0,shownWitness=null;
const debugRequestedByUrl=new URLSearchParams(location.search).get("debug")==="1"||globalThis.GPS_CHASE_DEV===true;
let debugLoadPromise=null,leafletReadyPromise=null;
const activeGame=()=>["headstart","playing"].includes(data?.game?.phase);
const show=id=>{screens.forEach(x=>x.classList.toggle("active",x.id===id));if(id==="game"){map??=new GameMap("map");map.show()}};
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3500)};
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const roleLabel=r=>r==="criminal"?"犯人":"刑事";
const pending=new Set();
function bind(id,action,key="room") {
  $(id).onclick=async()=>{
    if(pending.has(key))return;
    pending.add(key);const button=$(id);button.disabled=true;
    try{await action()}catch(e){toast(e.message||"通信に失敗しました")}finally{pending.delete(key);button.disabled=false;if(id==="#start"&&data)button.disabled=Object.keys(data.players||{}).length<2||!Object.values(data.players).every(p=>p.isReady)}
  };
}
function ensureLeaflet(){
  if(globalThis.L)return Promise.resolve();if(leafletReadyPromise)return leafletReadyPromise;
  leafletReadyPromise=new Promise((resolve,reject)=>{
    let script=$("#leafletScript");if(script)script.remove();
    script=document.createElement("script");script.id="leafletScript";script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    const timer=setTimeout(()=>reject(Error("地図の読み込みがタイムアウトしました。再操作してください")),15000);
    script.onload=()=>{clearTimeout(timer);globalThis.L?resolve():reject(Error("地図を読み込めませんでした"))};
    script.onerror=()=>{clearTimeout(timer);reject(Error("地図の通信に失敗しました。再操作してください"))};document.head.append(script);
  }).catch(e=>{leafletReadyPromise=null;throw e});return leafletReadyPromise;
}
function addDebugOption(selector,value,label){const select=$(selector);if(![...select.options].some(o=>o.value===value))select.add(new Option(label,value))}
function removeDebugOptions(){for(const [selector,value]of [["#duration","60"],["#witness","10"],["#headstart","0"]]){[...$(selector).options].find(o=>o.value===value)?.remove()}}
function resetSessionUI(){lastWitnessPos=null;captureSince=0;lastTick=0;shownWitness=null;$("#witnessCard").hidden=true;$("#capture").hidden=true;$("#warning").hidden=true;map?.witness(null)}
function connectionStatus(message,ok){
  const recovered=!connected&&ok;connected=ok;$("#connectionStatus").textContent=message;$("#connectionStatus").dataset.state=ok?"ok":"bad";
  $("#lobbyMsg").textContent=message;
  if(!ok){captureSince=0;$("#capture").hidden=true}
  if(recovered){sendFailed=false;lastSent=0}
}
function gpsStatus(message,state){
  gpsUsable=state==="ok"||state==="poor";
  $("#gpsStatus").textContent=message;$("#gpsStatus").dataset.state=state||"stale";
  $("#gpsFeedback").textContent=message;
  if(!gpsUsable){myPos=null;captureSince=0;$("#capture").hidden=true;map?.clearPosition()}
}
function startGps(){
  if(document.hidden||!room?.id)return;
  if(room.isLocal){debugController?.resume();return}
  gps??=new GPS((p,s)=>{
    if(useVirtualGps||room?.isLocal||!room?.id)return;
    myPos=p;map?.position(p);$("#warning").hidden=!s.warning;$("#warning").textContent=s.stopped?"安全停止：乗り物から降り、安全な場所で停止してください":"速度が高いようです。周囲を確認してください";
  },gpsStatus);gps.start();
}
function stopRuntime(){
  ++runtime;clearInterval(sendTimer);sendTimer=null;clearInterval(tickTimer);tickTimer=null;
  witnessUnsub?.();witnessUnsub=null;gps?.stop();myPos=null;gpsUsable=false;captureSince=0;lastTick=0;
  sendBusy=false;tickBusy=false;lastSent=0;map?.clearPosition();
}
function loadDebug(){
  if(debugController)return Promise.resolve(debugController);if(debugLoadPromise)return debugLoadPromise;
  if(!document.querySelector('link[href="css/debug.css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href="css/debug.css";document.head.append(link)}
  debugLoadPromise=ensureLeaflet().then(()=>import("./debug.js")).then(({initDebug})=>{
    debugController=initDebug({getState:()=>room?.isLocal?data:null,getRoom:()=>room?.isLocal?room:null,getUid:()=>uid,getPosition:()=>myPos,
      setPosition:p=>{if(!room?.isLocal||!validPosition(p))return;myPos=p;gpsStatus(freshPosition(p,Date.now())?(p.accuracy>50?"精度不足：捕獲判定できません":"正常（仮想GPS）"):"更新停止",freshPosition(p,Date.now())?(p.accuracy>50?"poor":"ok"):"stale");if(myPos){map?.position(p);room.patch(`players/${uid}/position`,p).catch(e=>toast(e.message))}},
      useVirtual:v=>{useVirtualGps=!!v&&!!room?.isLocal;if(useVirtualGps)gps?.stop()},toast,
      resetCapture:()=>{captureSince=0;$("#capture").hidden=true},showWarning:m=>{$("#warning").hidden=false;$("#warning").textContent=m},
      onMapClick:cb=>{map??=new GameMap("map");map.onDebugClick(cb)},showDebugPlayers:(players,distance)=>{map??=new GameMap("map");map.debugPlayers(room?.isLocal?players:null,distance)}});
    return debugController;
  }).catch(e=>{debugLoadPromise=null;throw e});return debugLoadPromise;
}
if(debugRequestedByUrl)loadDebug().catch(e=>toast(e.message));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{if(pending.has("entry"))return;const to=b.dataset.go;if(to==="create"||to==="join"){mode=to;$("#entryTitle").textContent=to==="create"?"部屋を作る":"部屋に参加";$("#roomField").hidden=to!=="join";show("profile")}else show(to)});
$("#safetyItems").innerHTML=SAFETY_ITEMS.map(x=>`<p>✓ ${x}</p>`).join("");
$("#agree").onchange=e=>$("#gpsStart").disabled=!e.target.checked;
$("#roomId").oninput=e=>e.target.value=normalizeRoomId(e.target.value);
$("[data-modal=how]").onclick=()=>$("#how").showModal();$(".dialog-close").onclick=()=>$("#how").close();
$("#toSafety").onclick=()=>{if(!isNameValid($("#name").value))return toast("表示名を1〜12文字で入力してください");if(mode==="join"&&$("#roomId").value.length!==6)return toast("6桁の部屋IDを入力してください");show("safety")};
bind("#localDebugStart",async()=>{
  await loadDebug();await leave(false);addDebugOption("#duration","60","1分（Debug）");addDebugOption("#witness","10","10秒（Debug）");addDebugOption("#headstart","0","なし（Debug）");
  const {LocalRoom}=await import("./local-room.js");uid="debug_user";connected=true;connectionStatus("ローカルデバッグ（Firebase送信なし）",true);
  myPos={lat:35.6812,lng:139.7671,accuracy:5,speed:0,heading:0,timestamp:Date.now()};
  room=new LocalRoom(uid,renderRoom);roleSeen=false;await room.create("デバッグプレイヤー");await debugController.activateLocalMode();show("lobby");
},"entry");
bind("#gpsStart",async()=>{
  const token=++epoch;let candidate;
  try{
    const [{authenticate},{Room}]=await Promise.all([import("./firebase-service.js"),import("./room.js")]);
    const user=await authenticate();if(token!==epoch)return;uid=user.uid;useVirtualGps=false;myPos=null;
    candidate=new Room(uid,next=>{if(token===epoch&&room===candidate)renderRoom(next)},(message,ok)=>{if(token===epoch&&room===candidate)connectionStatus(message,ok)});room=candidate;
    connectionStatus("接続確認中",false);
    if(mode==="create")await room.create($("#name").value.trim());else await room.join($("#roomId").value,$("#name").value.trim());
    if(token!==epoch)return;startGps();show("lobby");
  }catch(e){if(token===epoch){stopRuntime();candidate?.close();room=null;data=null;connectionStatus("接続失敗：再操作してください",false)}throw e}
},"entry");
function renderRoom(next){if(!next){void leave();toast("部屋が終了しました");return}data=next;if(room?.isLocal)debugController?.render(data);const me=data.players?.[uid];if(!me){void leave();return};$("#roomCode").textContent=room.isLocal?"LOCAL TEST":room.id;$("#copyRoom").hidden=!!room.isLocal;const settingValues={duration:data.settings?.durationSeconds,witness:data.settings?.witnessIntervalSeconds,distance:data.settings?.captureDistanceMeters,headstart:data.settings?.headStartSeconds,roles:data.settings?.roleAssignmentMode};for(const [id,value]of Object.entries(settingValues)){const select=$(`#${id}`);if([...select.options].some(option=>option.value===String(value)))select.value=String(value)}const list=Object.entries(data.players||{});$("#count").textContent=`${list.length} / 6`;$("#players").innerHTML=list.map(([id,p])=>`<div class="player"><b>${escapeHtml(p.displayName)}${p.isBot?" 🤖":""}${id===data.meta.hostUid?" ★":""}</b><small>${p.role?roleLabel(p.role):"役割未定"}・${p.isReady?"準備OK":"準備中"}・${p.isOnline===false?"切断":"接続中"}</small></div>`).join("");const host=data.meta.hostUid===uid;$("#settings").style.opacity=host?1:.65;$("#settings").querySelectorAll("select").forEach(x=>x.disabled=!host);$("#start").hidden=!host;$("#start").disabled=list.length<2||!list.every(([,p])=>p.isReady);$("#ready").textContent=me.isReady?"準備を取り消す":"準備完了";if($("#game").classList.contains("active")){$("#roleBadge").textContent=roleLabel(me.role);$("#roleBadge").style.color=me.role==="criminal"?"var(--red)":"var(--blue)"}
 if(data.game?.phase==="headstart"||data.game?.phase==="playing"){if(!roleSeen){resetSessionUI();startGps();roleSeen=true;$("#roleName").textContent=roleLabel(me.role);$("#roleName").style.color=me.role==="criminal"?"var(--red)":"var(--blue)";$("#roleHelp").textContent=me.role==="criminal"?"制限時間まで逃げ切ってください。刑事の位置は表示されません。":"目撃情報を手掛かりに犯人を追跡してください。";show("role")}}
 if(data.game?.phase==="finished"){stopRuntime();debugController?.pause();$("#winner").textContent=data.game.winnerRole==="criminal"?"犯人の勝利":"刑事の勝利";const capturer=data.players?.[data.game.capturedByUid]?.displayName;$("#resultText").textContent=capturer?`${capturer} が犯人を捕獲しました。`:"犯人が制限時間まで逃げ切りました。";show("result")}}

bind("#copyRoom",async()=>{
  try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(room.id);toast("部屋IDをコピーしました")}
  catch{$("#manualRoomId").value=room.id;$("#copyFallback").hidden=false;$("#manualRoomId").focus();$("#manualRoomId").select();toast("部屋IDを長押しして手動コピーしてください")}
},"copy");
bind("#ready",()=>room.ready(!data.players[uid].isReady));
$("#leave").onclick=()=>void leave();$("#resultLeave").onclick=()=>void leave();$("#gameLeave").onclick=()=>void leave();
async function leave(goHome=true){
  ++epoch;const previous=room;room=null;data=null;stopRuntime();
  debugController?.deactivateLocalMode(true);useVirtualGps=false;roleSeen=false;uid=null;
  debugController?.render(null);resetSessionUI();removeDebugOptions();$("#copyFallback").hidden=true;
  connectionStatus("未接続",false);if(goHome)show("home");
  if(previous){previous.close?.();try{await previous.leave()}catch{toast("端末の監視は停止しました。部屋からの削除に失敗しました")}}
}
document.querySelectorAll("#settings select").forEach(x=>x.onchange=async()=>{
  if(pending.has("room"))return;
  pending.add("room");try{await room.patch("settings",{durationSeconds:+$("#duration").value,witnessIntervalSeconds:+$("#witness").value,captureDistanceMeters:+$("#distance").value,headStartSeconds:+$("#headstart").value,roleAssignmentMode:$("#roles").value})}catch(e){toast(e.message)}finally{pending.delete("room")}
});
bind("#start",async()=>{
  if(!data||data.meta.hostUid!==uid)return;
  const now=Date.now(),random=Math.random();
  await room.transactionRoom(d=>{
    if(!d||d.game?.phase!=="lobby"||d.meta.hostUid!==uid)return;
    const ids=Object.keys(d.players||{});if(ids.length<2||ids.length>6||!ids.every(id=>d.players[id].isReady))return;
    const assigned=room.isLocal?ids.find(id=>d.players[id].role==="criminal"):null;
    const criminal=assigned||(d.settings.roleAssignmentMode==="manual"?uid:ids[Math.floor(random*ids.length)]);
    return {...d,meta:{...d.meta,status:"playing"},players:Object.fromEntries(ids.map(id=>[id,{...d.players[id],role:id===criminal?"criminal":"detective"}])),witnessReports:null,
      game:{phase:"headstart",startedAt:now,headStartEndsAt:now+d.settings.headStartSeconds*1000,endsAt:now+(d.settings.headStartSeconds+d.settings.durationSeconds)*1000,generationId:0}};
  });
});
bind("#roleOk",enterGame,"game");
async function enterGame(){
  const session=epoch,target=room;await ensureLeaflet();if(session!==epoch||target!==room||!activeGame())return;
  show("game");const me=data.players[uid];$("#roleBadge").textContent=roleLabel(me.role);$("#roleBadge").style.color=me.role==="criminal"?"var(--red)":"var(--blue)";
  startRuntime();
}
function startRuntime(){
  if(!activeGame()||document.hidden||!room?.id)return;
  // Starting twice must not add another timer or subscription.
  if(tickTimer)return;
  const run=++runtime,target=room,session=epoch;
  sendBusy=false;tickBusy=false;lastTick=0;sendFailed=false;startGps();
  sendTimer=setInterval(()=>void sendPosition(run,target), (data.settings.positionSendIntervalSeconds||5)*1000);
  tickTimer=setInterval(()=>void tick(run,target),1000);
  // Room already subscribes to the whole node, including reports. No second Firebase subscription.
  renderWitness();void tick(run,target);
}
async function sendPosition(run,target){
  if(run!==runtime||target!==room||!activeGame()||document.hidden||target.isLocal||!connected||sendBusy||sendFailed||!gpsUsable||!freshPosition(myPos,Date.now())||myPos.timestamp<=lastSent)return;
  sendBusy=true;const p={...myPos};
  try{await target.patch(`players/${uid}/position`,p);if(run===runtime)lastSent=p.timestamp}
  catch{if(run===runtime){sendFailed=true;connectionStatus("位置送信失敗：通信確認・再開を押してください",false)}}
  finally{if(run===runtime)sendBusy=false}
}
function renderWitness(){
  if(!map)return;
  const now=Date.now(),reports=Object.values(data?.witnessReports||{}).filter(w=>Number.isFinite(w.createdAt)&&w.createdAt<=now&&Number.isFinite(w.expiresAt)&&w.expiresAt>now&&w.createdAt>=data.game.startedAt).sort((a,b)=>b.createdAt-a.createdAt);
  const w=data?.players?.[uid]?.role==="detective"?reports[0]:null;
  $("#witnessCard").hidden=!w;
  if(w){$("#witnessText").textContent=w.message;$("#witnessAge").textContent=`目撃情報（${Math.max(0,Math.floor((now-w.createdAt)/1000))}秒前）`}
  const key=w?`${w.createdAt}:${w.sourceTimestamp}`:null;if(key!==shownWitness){map.witness(w);shownWitness=key}
}
async function tick(run=runtime,target=room){
  if(tickBusy||run!==runtime||target!==room||!activeGame()||document.hidden)return;
  tickBusy=true;const snapshot=data,startedAt=snapshot.game.startedAt,session=epoch;
  const current=()=>run===runtime&&session===epoch&&target===room&&data?.game?.startedAt===startedAt&&activeGame();
  try{
    const now=Date.now(),me=snapshot.players[uid];if(!me)return;
    if(lastTick&&(now-lastTick>2000||now<lastTick))captureSince=0;lastTick=now;
    if(room.isLocal){const p=myPos;gpsStatus(freshPosition(p,now)?(p.accuracy>50?"精度不足：捕獲判定できません":"正常（仮想GPS）"):"更新停止",freshPosition(p,now)?(p.accuracy>50?"poor":"ok"):"stale")}
    const head=Math.max(0,Math.ceil((snapshot.game.headStartEndsAt-now)/1000)),remaining=Math.max(0,Math.ceil((snapshot.game.endsAt-now)/1000));
    $("#timer").textContent=head?`先行 ${head}`:formatClock(remaining);
    const interval=snapshot.settings.witnessIntervalSeconds,elapsed=Math.max(0,Math.floor((now-snapshot.game.headStartEndsAt)/1000));
    $("#nextWitness").textContent=head?"待機中":`${interval-(elapsed%interval)}秒`;renderWitness();
    if(!connected)return;
    if(snapshot.game.phase==="headstart"&&now>=snapshot.game.headStartEndsAt&&snapshot.meta.hostUid===uid){
      await target.transactionGame(g=>current()&&g?.startedAt===startedAt&&g.phase==="headstart"?{...g,phase:"playing"}:undefined);
    }
    if(!current())return;
    if(remaining<=0){if(snapshot.meta.hostUid===uid)await finish("criminal",target,startedAt,current);return}
    if(data.game.phase==="playing"&&snapshot.meta.hostUid===uid&&elapsed>=interval){
      const generation=Math.floor(elapsed/interval),criminal=Object.values(snapshot.players).find(p=>p.role==="criminal");
      if((snapshot.game.generationId||0)<generation&&freshPosition(criminal?.position,now)){
        const report=makeWitness(now,criminal.position,lastWitnessPos,Math.min(3,1+Math.floor(elapsed/(interval*3))));
        const r=await target.publishWitness(generation,{...report,sourcePosition:criminal.position},startedAt);
        if(!current())return;if(r.committed)lastWitnessPos=criminal.position;
      }
    }
    if(!current())return;
    if(me.role==="detective"&&data.game.phase==="playing"){
      const criminal=Object.values(data.players).find(p=>p.role==="criminal");
      const state=captureState(gpsUsable?myPos:null,criminal?.position,snapshot.settings,captureSince,Date.now());
      if(state.valid&&!captureSince)captureSince=Date.now();if(!state.valid)captureSince=0;
      $("#capture").hidden=!state.valid;$("#capture").textContent=`接近中 ${Math.floor(state.progress*snapshot.settings.captureHoldSeconds)} / ${snapshot.settings.captureHoldSeconds}秒`;
      if(state.progress>=1)await target.transactionGame(g=>current()&&g?.phase==="playing"&&g.startedAt===startedAt&&captureState(gpsUsable?myPos:null,Object.values(data.players).find(p=>p.role==="criminal")?.position,data.settings,captureSince,Date.now()).progress>=1?{...g,phase:"finished",winnerRole:"detective",capturedByUid:uid,capturedAt:Date.now()}:undefined);
    }
  }catch(e){if(current()){captureSince=0;connectionStatus(`ゲーム更新失敗：${e.message}（通信確認・再開）`,false)}}
  finally{if(run===runtime)tickBusy=false}
}
async function finish(winner,target,startedAt,current){await target.transactionGame(g=>current()&&g?.startedAt===startedAt&&["headstart","playing"].includes(g.phase)?{...g,phase:"finished",winnerRole:winner,finishedAt:Date.now()}:undefined)}
$("#locate").onclick=()=>{if(gpsUsable&&freshPosition(myPos,Date.now()))map.center(myPos);else toast("GPSを再取得できるまで現在地操作を停止しています")};
$("#fold").onclick=()=>$("#details").hidden=!$("#details").hidden;
$("#gameSafety").onclick=()=>$("#how").showModal();
async function resume(){
  if(document.hidden||!room?.id)return;
  if(!room.isLocal){connectionStatus("通信を再確認中",false);try{const target=room,session=epoch;const ok=await target.checkConnection();if(target!==room||session!==epoch)return;connectionStatus(ok?"接続中":"切断中：通信復帰を待っています",ok)}catch{connectionStatus("通信確認失敗：再操作してください",false)}}
  if(!room?.id)return;
  gps?.stop();myPos=null;captureSince=0;startGps();
  if(activeGame()&&$("#game").classList.contains("active"))startRuntime();
}
$("#retryConnection").onclick=()=>{sendFailed=false;void resume()};
bind("#rematch",async()=>{
  const target=room;roleSeen=false;stopRuntime();resetSessionUI();
  await target.transactionRoom(d=>{
    if(d?.game?.phase!=="finished")return;
    const firstBotId=Object.entries(d.players||{}).find(([,p])=>p.isBot)?.[0];
    return {...d,meta:{...d.meta,status:"lobby"},game:{phase:"lobby",generationId:0},witnessReports:null,captureCandidates:null,
      players:Object.fromEntries(Object.entries(d.players).map(([id,p])=>[id,{...p,isReady:!!target.isLocal,role:target.isLocal?(id===firstBotId?"criminal":"detective"):"",position:target.isLocal?p.position:null}]))};
  });
  if(target!==room)return;startGps();show("lobby");
});
function suspend(){stopRuntime();debugController?.pause();gpsStatus("更新停止：画面復帰時に再取得します","stale")}
document.addEventListener("visibilitychange",()=>{if(document.hidden)suspend();else void resume()});
window.addEventListener("pagehide",suspend);window.addEventListener("pageshow",()=>{if(room?.id)void resume()});
window.addEventListener("offline",()=>connectionStatus("オフライン：位置送信・捕獲判定を停止中",false));
window.addEventListener("online",()=>void resume());
show("home");
