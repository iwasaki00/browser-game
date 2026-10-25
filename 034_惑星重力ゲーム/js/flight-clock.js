// Scheduling only. Every callback advances exactly one unchanged physics step.
export const FLIGHT_RATES = Object.freeze([1, 2, 5, 10, 50, 100]);
export class FlightClock {
  constructor({dt=1/120, maxSteps=240, budgetMs=4, now=()=>performance.now()}={}) {
    Object.assign(this,{dt,maxSteps,budgetMs,now});this.reset();
  }
  reset(){this.rate=1;this.pending=0;this.serviceCredit=0;this.wall=0;this.advanced=0;this.effective=0;this.lastSteps=0;this.lastCost=0;}
  setRate(value){
    const rate=Number(value);
    if(FLIGHT_RATES.includes(rate)&&rate!==this.rate){this.rate=rate;this.serviceCredit=0;this.wall=0;this.advanced=0;this.effective=0;}
  }
  advance(seconds,step){
    seconds=Math.max(0,Number.isFinite(seconds)?seconds:0);
    this.pending+=seconds*this.rate;this.wall+=seconds;
    // Work tokens limit catch-up bursts; discarded tokens never discard pending
    // simulation time. On a rate change the new rate gets a fresh work allowance.
    this.serviceCredit=Math.min(this.maxSteps*this.dt,this.serviceCredit+seconds*this.rate);
    const start=this.now();let count=0;
    // A lower selection takes effect immediately, even with outstanding work.
    const limit=Math.min(this.maxSteps,Math.floor((this.serviceCredit+1e-12)/this.dt));
    while(this.pending+1e-12>=this.dt&&count<limit&&(count===0||this.now()-start<this.budgetMs)){
      const keepGoing=step(this.dt);
      this.pending=Math.max(0,this.pending-this.dt);this.serviceCredit=Math.max(0,this.serviceCredit-this.dt);count++;this.advanced+=this.dt;
      if(keepGoing===false)break;
    }
    this.lastSteps=count;this.lastCost=this.now()-start;
    if(this.wall>=.5){this.effective=this.advanced/this.wall;this.wall=0;this.advanced=0;}
    return count;
  }
}
