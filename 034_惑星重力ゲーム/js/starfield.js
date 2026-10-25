// Region seeds fix every star to a world coordinate. Cache size and overview
// density are bounded independently of world area; no physics data is touched.
const TILE=500, COLORS=['#c9dfff','#eef3ff','#fff0d8','#d4d0ff'];
function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
export class Starfield {
  constructor(seed=0x4f524249){this.seed=seed;this.cache=new Map();this.generated=0;}
  tile(x,y){
    const key=`${x},${y}`;
    if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);return value;}
    const rng=random(this.seed^Math.imul(x,73856093)^Math.imul(y,19349663));
    const count=70+Math.floor(rng()*150),cx=rng(),cy=rng();
    const stars=Array.from({length:count},(_,id)=>{
      const clustered=rng()<.45;
      const u=clustered?Math.max(0,Math.min(1,cx+(rng()+rng()+rng()-1.5)*.28)):rng();
      const v=clustered?Math.max(0,Math.min(1,cy+(rng()+rng()+rng()-1.5)*.28)):rng();
      return {x:(x+u)*TILE,y:(y+v)*TILE,radius:.25+rng()**3*.95,alpha:.16+rng()*.52,color:COLORS[Math.floor(rng()*COLORS.length)],rank:rng(),id};
    });
    this.generated++;this.cache.set(key,stars);
    if(this.cache.size>128)this.cache.delete(this.cache.keys().next().value);
    return stars;
  }
  visible(a,b,world,scale,light=false){
    const stars=[],density=Math.min(1,Math.max(.025,scale*scale*1.7))*(light?.5:1);
    const left=Math.max(0,a.x),top=Math.max(0,a.y),right=Math.min(world.width,b.x),bottom=Math.min(world.height,b.y);
    for(let y=Math.floor(top/TILE);y<=Math.floor(bottom/TILE);y++)for(let x=Math.floor(left/TILE);x<=Math.floor(right/TILE);x++){
      for(const s of this.tile(x,y))if(s.rank<density&&s.x>=left&&s.x<=right&&s.y>=top&&s.y<=bottom)stars.push(s);
    }
    return stars;
  }
}
