import { pathRef, connectionRef, get, update, remove, onValue, onDisconnect, runTransaction, push } from "./firebase-service.js";
import { freshPosition } from "./capture.js";
export const DEFAULTS={durationSeconds:900,witnessIntervalSeconds:45,captureDistanceMeters:25,captureHoldSeconds:5,headStartSeconds:30,positionSendIntervalSeconds:5,roleAssignmentMode:"random"};
export class Room {
  constructor(uid,onChange,onStatus=()=>{}) {
    Object.assign(this,{uid,onChange,onStatus,id:"",unsub:null,connectionUnsub:null,disconnect:null,epoch:0,closed:false,connected:null});
  }
  async create(name) {
    const epoch=this.epoch;
    for(let i=0;i<20;i++) {
      if(this.closed||epoch!==this.epoch)throw Error("部屋操作を中止しました");
      const id=String(Math.floor(100000+Math.random()*900000));
      const r=await runTransaction(pathRef(id),v=>this.closed||epoch!==this.epoch||v?undefined:{meta:{hostUid:this.uid,status:"lobby",createdAt:Date.now(),expiresAt:Date.now()+21600000},settings:DEFAULTS,game:{phase:"lobby",generationId:0},players:{[this.uid]:this.player(name)}},{applyLocally:false});
      if(r.committed){if(this.closed||epoch!==this.epoch){await remove(pathRef(`${id}/players/${this.uid}`));throw Error("部屋操作を中止しました")}await this.watch(id);return id;}
    }
    throw Error("部屋IDを作成できませんでした");
  }
  player(name){return {displayName:name,role:"",isReady:false,isOnline:true,joinedAt:Date.now(),gpsStatus:"starting",safetyAccepted:true}}
  async join(id,name) {
    if(!/^\d{6}$/.test(id))throw Error("6桁の部屋IDを入力してください");
    const epoch=this.epoch;
    const r=await runTransaction(pathRef(id),d=>{
      if(this.closed||epoch!==this.epoch)return;
      // A transaction may first receive null before the server value is cached.
      // Return null as a no-op candidate so Firebase can retry with server data.
      if(d===null)return null;
      if(d.meta?.status!=="lobby"||Object.keys(d.players||{}).length>=6&&!d.players?.[this.uid])return;
      return {...d,players:{...d.players,[this.uid]:this.player(name)}};
    },{applyLocally:false});
    if(!r.committed||!r.snapshot.val()?.players?.[this.uid])throw Error("参加できません：部屋ID・人数・開始状態を確認してください");
    if(this.closed||epoch!==this.epoch){await remove(pathRef(`${id}/players/${this.uid}`));throw Error("部屋操作を中止しました")}
    await this.watch(id);
  }
  async watch(id) {
    this.unsub?.();this.connectionUnsub?.();
    this.id=id;const epoch=this.epoch;
    sessionStorage.setItem("gps-room",id);
    this.unsub=onValue(pathRef(id),s=>{if(!this.closed&&epoch===this.epoch)this.onChange(s.val())},e=>{if(!this.closed)this.onStatus(`読込失敗：${e.code||e.message}`,false)});
    this.connectionUnsub=onValue(connectionRef,s=>{
      if(this.closed||epoch!==this.epoch)return;
      this.connected=s.val()===true;this.onStatus(this.connected?"接続中":"切断中：通信復帰を待っています",this.connected);
      if(this.connected) {
        const disconnect=onDisconnect(pathRef(`${id}/players/${this.uid}/isOnline`));this.disconnect=disconnect;
        disconnect.set(false).then(()=>{
          if(this.closed||epoch!==this.epoch)return disconnect.cancel();
          return update(pathRef(`${id}/players/${this.uid}`),{isOnline:true});
        }).catch(e=>{if(!this.closed)this.onStatus(`接続登録失敗：${e.code||e.message}`,false)});
      }
    },e=>this.onStatus(`通信確認失敗：${e.code||e.message}`,false));
  }
  target(path="") {
    if(this.closed||!this.id)throw Error("部屋から退出しています");
    if(this.connected===false)throw Error("通信切断中です。復帰後に操作してください");
    return pathRef(`${this.id}/${path}`);
  }
  async checkConnection(){const s=await get(connectionRef);this.connected=s.val()===true;return this.connected}
  async transactionRoom(mutator){const epoch=this.epoch;return runTransaction(this.target(),d=>this.closed||epoch!==this.epoch?undefined:mutator(d),{applyLocally:false})}
  async patch(path,data){return update(this.target(path),data)}
  async bulkPatch(updates){return update(this.target(),updates)}
  async transactionGame(mutator){const epoch=this.epoch;return runTransaction(this.target("game"),g=>this.closed||epoch!==this.epoch?undefined:mutator(g),{applyLocally:false})}
  async addWitness(report){return push(this.target("witnessReports"),report)}
  // Generation claim and report are one atomic write; retrying a slow transaction cannot publish a duplicate.
  async publishWitness(generation,report,startedAt,active=()=>true) {
    const epoch=this.epoch;
    return runTransaction(this.target(),d=>{
      if(!active()||this.closed||epoch!==this.epoch||!d||d.meta?.hostUid!==this.uid||d.game?.phase!=="playing"||d.game.startedAt!==startedAt||(d.game.generationId||0)>=generation||!freshPosition(report.sourcePosition,Date.now()))return;
      const {sourcePosition,...publicReport}=report;
      return {...d,game:{...d.game,generationId:generation},witnessReports:{...d.witnessReports,[`generation_${generation}`]:publicReport}};
    },{applyLocally:false});
  }
  subscribeWitness(callback){const epoch=this.epoch;return onValue(this.target("witnessReports"),s=>{if(!this.closed&&epoch===this.epoch)callback(s.val()||{})},e=>this.onStatus(`目撃情報取得失敗：${e.code||e.message}`,false))}
  async removeNode(path){return remove(this.target(path))}
  async ready(v){return this.patch(`players/${this.uid}`,{isReady:v})}
  close() {
    this.closed=true;++this.epoch;this.unsub?.();this.unsub=null;this.connectionUnsub?.();this.connectionUnsub=null;
    sessionStorage.removeItem("gps-room");
  }
  async leave() {
    const id=this.id;this.close();this.id="";
    if(!id)return;
    // Keep the onDisconnect fallback if removing the player fails.
    await remove(pathRef(`${id}/players/${this.uid}`));
    await this.disconnect?.cancel();this.disconnect=null;
  }
}
