export interface DigPoint {x:number;y:number;time:number;}
// Pointer events only describe the path. Visible frame time supplies the work budget.
export class DigInput {pointer:number|null=null;private points:DigPoint[]=[];private cursor=0;private last=0;events=0;elapsed=0;
start(pointer:number,x:number,y:number,now:number){if(this.pointer!==null)return false;this.pointer=pointer;this.points=[{x,y,time:now}];this.cursor=now;this.last=now;this.events=1;this.elapsed=0;return true;}
move(pointer:number,x:number,y:number,now:number){if(pointer!==this.pointer)return;this.events++;this.points.push({x,y,time:Math.max(now,this.points.at(-1)!.time)});if(this.points.length>256)this.points.splice(1,this.points.length-256);}
private position(time:number){while(this.points.length>1&&this.points[1].time<=time)this.points.shift();const a=this.points[0],b=this.points[1];if(!b||b.time<=a.time)return a;const t=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,time};}
step(now:number,work:(seconds:number,x:number,y:number)=>void,flush=false){if(this.pointer===null)return;now=Math.max(this.last,now);if(now-this.last>100)this.cursor=Math.max(this.cursor,now-100);this.last=now;while(now-this.cursor>=20-1e-7){const p=this.position(this.cursor+10);work(.02,p.x,p.y);this.cursor+=20;this.elapsed+=.02;}if(flush&&now-this.cursor>1e-7){const dt=(now-this.cursor)/1000,p=this.position((now+this.cursor)/2);work(dt,p.x,p.y);this.elapsed+=dt;this.cursor=now;}}
stop(){this.pointer=null;this.points=[];}
}
