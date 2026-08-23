export class GPS {
  constructor(onPosition, onStatus) { this.onPosition=onPosition; this.onStatus=onStatus; this.watch=null; this.latest=null; this.fast=0; }
  start() { if (!navigator.geolocation) throw new Error("このブラウザは位置情報に対応していません"); if (this.watch!==null) return;
    this.watch=navigator.geolocation.watchPosition(p=>{ const c=p.coords; this.latest={lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,speed:c.speed,heading:c.heading,timestamp:p.timestamp}; this.fast=(c.speed??0)>4.17?this.fast+1:0; this.onPosition(this.latest,{warning:(c.speed??0)>2.78,stopped:this.fast>=3}); this.onStatus("取得中", "ok"); }, e=>this.onStatus(e.code===1?"許可が必要":"取得できません","bad"), {enableHighAccuracy:true,maximumAge:3000,timeout:10000}); }
  stop(){ if(this.watch!==null) navigator.geolocation.clearWatch(this.watch); this.watch=null; }
}
