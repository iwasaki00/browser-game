// No AudioContext is created until a user gesture explicitly calls unlock().
const NOTES = Object.freeze({
  launch:[120,290,.18,'sawtooth'], approach:[330,440,.12,'sine'],
  swingby:[440,880,.24,'sine'], closecall:[740,1110,.18,'triangle'],
  cleared:[523,1046,.38,'sine'], collision:[140,55,.22,'triangle'],
  absorbed:[220,35,.3,'sine'], overheated:[310,90,.24,'sawtooth'],
  escaped:[260,130,.22,'sine'], timeout:[220,180,.2,'triangle'], ui:[650,800,.045,'sine'],
});
export class SpaceAudio {
  constructor(enabled=false, host=globalThis) { this.enabled=enabled;this.host=host;this.context=null;this.voices=new Set();this.last=new Map();this.unavailable=false; }
  unlock() {
    if(!this.enabled)return;
    try {
      if(!this.context){
        const Audio=this.host.AudioContext??this.host.webkitAudioContext;
        if(!Audio){this.unavailable=true;return;}
        this.context=new Audio();
        this.master=this.context.createGain();this.master.gain.value=.055;this.master.connect(this.context.destination);
      }
      if(this.context.state!=='running' && this.context.state!=='closed') Promise.resolve(this.context.resume()).catch(()=>{this.unavailable=true;});
    }catch{this.unavailable=true;}
  }
  setEnabled(value){this.enabled=Boolean(value);if(!this.enabled)this.silence();}
  silence(){for(const voice of this.voices){try{voice.stop();}catch{/* Already ended. */}voice.disconnect();}this.voices.clear();}
  play(kind) {
    const ctx=this.context,note=NOTES[kind];
    if(!this.enabled||!ctx||ctx.state!=='running'||!note||this.voices.size>=4)return false;
    const now=ctx.currentTime,cooldown=kind==='approach'?1.2:kind==='ui'?.08:.25;
    if(now-(this.last.get(kind)??-Infinity)<cooldown)return false;
    try{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.type=note[3];oscillator.frequency.setValueAtTime(note[0],now);oscillator.frequency.exponentialRampToValueAtTime(note[1],now+note[2]);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.5,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+note[2]);
      oscillator.connect(gain);gain.connect(this.master);this.voices.add(oscillator);
      oscillator.onended=()=>{this.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      oscillator.start(now);oscillator.stop(now+note[2]+.02);this.last.set(kind,now);return true;
    }catch{return false;}
  }
}
