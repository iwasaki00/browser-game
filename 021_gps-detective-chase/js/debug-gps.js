import { destination, bearingTo } from "./debug-bots.js";
export class VirtualGPS {
  constructor(onPosition){this.onPosition=onPosition;this.enabled=false;this.position=null;this.target=null;this.mode="warp";this.timer=setInterval(()=>this.step(),250);}
  setEnabled(value, fallback){this.enabled=value;if(value&&!this.position)this.set(fallback||{lat:35.6812,lng:139.7671,accuracy:5,speed:0,heading:0,timestamp:Date.now()});}
  set(p){this.position={accuracy:5,speed:0,heading:0,...p,timestamp:Date.now()};this.onPosition(this.position);}
  moveTo(target,mode="warp"){if(mode==="warp")this.set({...this.position,...target});else{this.target=target;this.mode=mode;}}
  nudge(bearing,meters=2){this.set(destination(this.position||{lat:35.6812,lng:139.7671},bearing,meters));}
  step(){if(!this.enabled||!this.target||!this.position)return;const speed={walk:4,brisk:6,run:10}[this.mode]||4,b=bearingTo(this.position,this.target),d=Math.hypot((this.position.lat-this.target.lat)*111320,(this.position.lng-this.target.lng)*90000);if(d<1){this.target=null;return}this.set({...destination(this.position,b,Math.min(d,speed/3.6/4)),speed:speed/3.6});}
  dispose(){clearInterval(this.timer)}
}
