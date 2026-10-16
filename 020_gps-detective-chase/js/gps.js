import { freshPosition, validPosition } from "./capture.js";

export class GPS {
  constructor(onPosition, onStatus) {
    Object.assign(this, {onPosition, onStatus, watch:null, latest:null, fast:0, epoch:0, timer:null, error:null});
  }
  status() {
    if (this.error) return this.onStatus(this.error, "bad");
    if (!freshPosition(this.latest, Date.now())) return this.onStatus(this.latest ? "更新停止：再取得待ち" : "位置を取得中", "stale");
    this.onStatus(this.latest.accuracy > 50 ? "精度不足：捕獲判定できません" : "正常", this.latest.accuracy > 50 ? "poor" : "ok");
  }
  start() {
    if (this.watch !== null) return;
    this.latest=null; this.fast=0; this.error=null;
    if (!navigator.geolocation) { this.error="取得失敗：位置情報非対応"; this.status(); return; }
    const epoch=++this.epoch;
    const failed=e=>{
      if(epoch!==this.epoch)return;
      this.latest=null;
      this.error=e.code===1?"権限拒否：Safariの位置情報設定を確認してください":e.code===3?"タイムアウト：位置を再取得できません":"取得失敗：GPS信号を確認してください";
      this.status();
    };
    this.status();
    this.timer=setInterval(()=>this.status(),1000);
    try {
      this.watch=navigator.geolocation.watchPosition(p=>{
        if(epoch!==this.epoch)return;
        const c=p.coords, next={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,speed:c.speed??null,heading:c.heading??null,timestamp:p.timestamp};
        if(!validPosition(next)||!freshPosition(next,Date.now())||(this.latest&&next.timestamp<=this.latest.timestamp))return;
        this.latest=next; this.error=null;
        this.fast=(c.speed??0)>4.17?this.fast+1:0;
        this.onPosition(next,{warning:(c.speed??0)>2.78,stopped:this.fast>=3});
        this.status();
      },failed,{enableHighAccuracy:true,maximumAge:3000,timeout:10000});
    } catch { this.stop(); this.error="取得失敗：位置情報を開始できません"; this.status(); }
  }
  stop() {
    ++this.epoch;
    if(this.watch!==null)navigator.geolocation?.clearWatch(this.watch);
    clearInterval(this.timer); this.timer=null; this.watch=null; this.latest=null; this.fast=0; this.error=null;
    this.onStatus("更新停止", "stale");
  }
}
