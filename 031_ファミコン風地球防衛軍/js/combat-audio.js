// Local Web Audio only. Creation/resume is allowed exclusively from a user gesture.
export const AUDIO_LIMITS=Object.freeze({voices:8,startsPerSecond:24,eventGap:.065});
export class CombatAudio {
  constructor(factory){this.factory=factory;this.context=null;this.voices=new Set();this.starts=0;this.windowStart=0;this.events=new Map();this.dropped=0;this.peak=0;this.status='locked'}
  unlock(){
    try{
      this.context??=this.factory();const c=this.context;if(!c){this.status='unavailable';return}
      if(c.state==='suspended'){this.status='suspended';Promise.resolve(c.resume()).catch(()=>{this.status='blocked'})}
      else this.status=c.state;
    }catch{this.status='unavailable'}
  }
  play(frequency,duration,type,volume,event='generic'){
    const c=this.context;if(!c||c.state!=='running')return false;const now=c.currentTime;
    this.prune(now);
    if(now-this.windowStart>=1){this.windowStart=now;this.starts=0}
    const gap=event==='weak'?.1:event==='large'?.2:AUDIO_LIMITS.eventGap;
    if(this.voices.size>=AUDIO_LIMITS.voices||this.starts>=AUDIO_LIMITS.startsPerSecond||event!=='generic'&&now-(this.events.get(event)??-100)<gap){this.dropped++;return false}
    let o,g,voice;try{
      o=c.createOscillator();g=c.createGain();o.type=type;o.frequency.value=Math.max(20,Math.min(4000,frequency));o.connect(g);g.connect(c.destination);
      const length=Math.max(.01,Math.min(.8,duration)),level=Math.max(.0001,Math.min(.05,volume));g.gain.setValueAtTime(level,now);g.gain.exponentialRampToValueAtTime(.0001,now+length);
      voice={o,g,until:now+length};this.voices.add(voice);this.peak=Math.max(this.peak,this.voices.size);this.starts++;this.events.set(event,now);
      o.onended=()=>{this.voices.delete(voice);try{o.disconnect();g.disconnect()}catch{}};
      o.start();o.stop(now+length);return true;
    }catch{if(voice)this.voices.delete(voice);try{o?.disconnect();g?.disconnect()}catch{}this.status='unavailable';return false}
  }
  stop(){for(const v of this.voices){try{v.o.stop();v.o.disconnect();v.g.disconnect()}catch{}}this.voices.clear()}
  prune(now){for(const v of this.voices)if(v.until<=now){this.voices.delete(v);try{v.o.disconnect();v.g.disconnect()}catch{}}}
  snapshot(){this.prune(this.context?.currentTime??0);return {voices:this.voices.size,peak:this.peak,dropped:this.dropped,status:this.status==='blocked'||this.status==='unavailable'?this.status:this.context?.state??this.status,limit:AUDIO_LIMITS.voices}}
}
