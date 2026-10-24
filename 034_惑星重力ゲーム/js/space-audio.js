// Only gestures unlock audio. Flight events never wait for resume or queue sounds.
const NOTES = Object.freeze({
  launch:[120,290,.18,'sawtooth'], approach:[330,440,.12,'sine'],
  swingby:[440,880,.24,'sine'], closecall:[740,1110,.18,'triangle'],
  cleared:[523,1046,.38,'sine'], collision:[140,55,.22,'triangle'],
  absorbed:[220,35,.3,'sine'], overheated:[310,90,.24,'sawtooth'],
  escaped:[260,130,.22,'sine'], timeout:[220,180,.2,'triangle'], ui:[650,800,.045,'sine'], test:[440,660,.28,'sine'],
});
export class SpaceAudio {
  constructor(enabled=false,host=globalThis,{resumeTimeoutMs=1500}={}) {
    this.enabled=enabled;this.host=host;this.context=null;this.master=null;
    this.voices=new Set();this.gains=new Map();this.last=new Map();
    this.unavailable=false;this.lastError='';this.lastTest='none';this.sentCount=0;
    this.resumeAttempts=0;this.pending=null;this.generation=0;this.recreate=false;
    this.needsGesture=true;this.clockAdvancing=null;this.clockTimer=null;
    this.resumeTimeoutMs=resumeTimeoutMs;this.onChange=()=>{};this.session=null;
  }
  notify(){try{this.onChange(this.diagnostics());}catch{/* Diagnostics cannot stop flight. */}}
  sessionType(){try{return this.host.navigator?.audioSession?.type??'unsupported';}catch{return 'unavailable';}}
  configureSession(){
    // Optional Safari API. The prior session is restored on mute.
    try{const session=this.host.navigator?.audioSession;if(session){if(!this.session)this.session={object:session,previous:session.type};session.type='playback';}}catch{/* Ordinary Web Audio remains available. */}
  }
  unlock() {
    if(!this.enabled)return Promise.resolve(false);
    try {
      this.configureSession();
      if(this.recreate||this.context?.state==='closed')this.discardContext();
      if(!this.context){
        const Audio=this.host.AudioContext??this.host.webkitAudioContext;
        if(!Audio)throw new Error('AudioContextUnsupported');
        const ctx=this.context=new Audio();
        this.master=ctx.createGain();this.master.gain.value=.055;this.master.connect(ctx.destination);
        ctx.onstatechange=()=>{
          if(this.context!==ctx)return;
          if(ctx.state!=='running'){this.needsGesture=true;this.silence();}
          if(ctx.state==='running'&&this.pending?.ctx===ctx)this.finishResume(this.pending,true);
          this.notify();
        };
        // A single zero-valued sample primes the same graph inside the gesture.
        if(ctx.createBuffer&&ctx.createBufferSource){
          try{const prime=ctx.createBufferSource();prime.buffer=ctx.createBuffer(1,1,ctx.sampleRate||44100);
          prime.connect(this.master);prime.onended=()=>prime.disconnect();prime.start(0);}catch{/* Priming is optional. */}
        }
      }
      const ctx=this.context;
      if(ctx.state==='running'){this.unavailable=false;this.lastError='';this.needsGesture=false;this.notify();return Promise.resolve(true);}
      if(this.pending)return this.pending.promise;
      const task={ctx,resolve:null,timer:null,promise:null};
      task.promise=new Promise(resolve=>{task.resolve=resolve;});this.pending=task;
      this.resumeAttempts++;
      task.timer=setTimeout(()=>this.finishResume(task,false,'ResumeTimeout'),this.resumeTimeoutMs);
      // resume() is called synchronously during the tap, before any await.
      try{Promise.resolve(ctx.resume()).then(()=>this.finishResume(task,ctx.state==='running','ResumeNotRunning'),error=>this.finishResume(task,false,error?.name??'ResumeRejected'));}
      catch(error){this.finishResume(task,false,error?.name??'ResumeRejected');}
      this.notify();return task.promise;
    }catch(error){this.unavailable=true;this.recreate=Boolean(this.context);this.lastError=error?.message??'AudioStartFailed';this.notify();return Promise.resolve(false);}
  }
  finishResume(task,ready,error=''){
    if(this.pending!==task)return;
    clearTimeout(task.timer);this.pending=null;
    this.unavailable=!ready;this.lastError=ready?'':error;this.needsGesture=!ready;
    if(!ready)this.recreate=true;
    task.resolve(ready);this.notify();
  }
  release(voice){
    try{voice.disconnect();}catch{/* Already released. */}
    try{this.gains.get(voice)?.disconnect();}catch{/* Already released. */}
    this.gains.delete(voice);this.voices.delete(voice);
  }
  silence(){for(const voice of [...this.voices]){try{voice.stop();}catch{/* Already ended. */}this.release(voice);}}
  discardContext(){
    if(this.pending)this.finishResume(this.pending,false,'ContextReplaced');
    this.silence();clearTimeout(this.clockTimer);this.generation++;
    const previous=this.context;this.context=null;this.recreate=false;this.last.clear();
    try{this.master?.disconnect();}catch{/* Optional old graph. */}this.master=null;
    if(previous){previous.onstatechange=null;try{Promise.resolve(previous.close?.()).catch(()=>{});}catch{/* Disconnected already. */}}
  }
  setEnabled(value){
    this.enabled=Boolean(value);
    if(!this.enabled){
      this.generation++;if(this.pending)this.finishResume(this.pending,false,'Muted');
      this.silence();clearTimeout(this.clockTimer);this.lastTest='none';this.needsGesture=true;
      try{if(this.session?.object.type==='playback')this.session.object.type=this.session.previous;}catch{/* Session API optional. */}this.session=null;
    }
    this.notify();
  }
  backgrounded(){
    this.generation++;if(this.pending)this.finishResume(this.pending,false,'Backgrounded');
    this.silence();clearTimeout(this.clockTimer);this.needsGesture=true;this.lastTest='none';this.notify();
  }
  foregrounded(){this.needsGesture=true;this.notify();} // No auto-play on return.
  async testSound(){
    if(!this.enabled)return false;
    clearTimeout(this.clockTimer);
    this.lastTest='waiting';this.clockAdvancing=null;this.notify();
    const ready=this.unlock(),generation=this.generation;
    if(!await ready||generation!==this.generation||!this.enabled){if(generation===this.generation){this.lastTest='failed';this.notify();}return false;}
    // Confirmation is monophonic, so a quick retry is audible without stacking.
    this.silence();this.last.delete('test');
    const sent=this.play('test');this.lastTest=sent?'sent':'failed';
    if(sent){
      const ctx=this.context,start=ctx.currentTime;clearTimeout(this.clockTimer);
      const checkClock=(retry=true)=>{
        if(this.context!==ctx||generation!==this.generation||!this.enabled)return;
        if(ctx.currentTime<=start+.01&&retry){this.clockTimer=setTimeout(()=>checkClock(false),500);return;}
        this.clockAdvancing=ctx.currentTime>start+.01;
        if(!this.clockAdvancing){this.lastError='AudioClockNotAdvancing';this.recreate=true;}
        this.notify();
      };
      this.clockTimer=setTimeout(()=>checkClock(),160);
    }
    this.notify();return sent;
  }
  diagnostics(){return{enabled:this.enabled,state:this.context?.state??'not-created',pending:Boolean(this.pending),needsGesture:this.needsGesture,resumeAttempts:this.resumeAttempts,voices:this.voices.size,sent:this.sentCount,lastTest:this.lastTest,clockAdvancing:this.clockAdvancing,sessionType:this.sessionType(),lastError:this.lastError};}
  play(kind) {
    const ctx=this.context,note=NOTES[kind];
    if(!this.enabled||this.needsGesture||!ctx||ctx.state!=='running'||!note||this.voices.size>=4)return false;
    const now=ctx.currentTime,cooldown=kind==='approach'?1.2:kind==='ui'?.08:.25;
    if(now-(this.last.get(kind)??-Infinity)<cooldown)return false;
    let oscillator;
    try{
      oscillator=ctx.createOscillator();const gain=ctx.createGain();
      oscillator.type=note[3];oscillator.frequency.setValueAtTime(note[0],now);oscillator.frequency.exponentialRampToValueAtTime(note[1],now+note[2]);
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.5,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+note[2]);
      oscillator.connect(gain);gain.connect(this.master);this.voices.add(oscillator);this.gains.set(oscillator,gain);
      oscillator.onended=()=>this.release(oscillator);
      oscillator.start(now);oscillator.stop(now+note[2]+.02);this.last.set(kind,now);this.sentCount++;return true;
    }catch(error){if(oscillator)this.release(oscillator);this.lastError=error?.name??'SynthesisFailed';this.notify();return false;}
  }
}
