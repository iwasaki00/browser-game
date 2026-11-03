import {treasures,weights,treasure,type Treasure} from './data';
import {rng,generate,type Plot,type Find} from './engine';
import {generateRiver} from './river';import {generateGold,grainProfile} from './gold';
import {environments} from './world-rules';
const legacyAllowed:Record<string,string[]>={'B-A':['B009','B011','B012'],'R-B':['R001','R002','R003']};
export const eligibleTreasures=(area:string)=>treasures.filter(t=>t.category===area[0]&&(t.locations.includes(area)||legacyAllowed[area]?.includes(t.id)));
export function drawTreasure(area:string,random:()=>number,noJackpot=false,filter:(t:Treasure)=>boolean=()=>true){const candidates=eligibleTreasures(area).filter(filter),groups=['C','U','R','SR','J'].filter(k=>(!noJackpot||k!=='J')&&candidates.some(t=>t.rarity===k));let roll=random()*groups.reduce((n,k)=>n+weights[k],0),chosen=groups.at(-1)!;for(const k of groups){roll-=weights[k];if(roll<0){chosen=k;break;}}const options=candidates.filter(t=>t.rarity===chosen);if(!options.length)throw Error('出現候補がありません '+area);return options[Math.floor(random()*options.length)];}
export function generateWorld(seed:number,area:string,noJackpot=false):Plot {
 const r=rng(seed^0x700f),env=environments[area];if(!env)throw Error('未知のエリア');const p=area[0]==='B'?generate(seed,false,noJackpot,true):area[0]==='R'?generateRiver(seed,area):generateGold(seed,area,noJackpot);p.areaId=area;p.worldVersion=1;p.environment={...env};
 // B keeps the existing per-draw J bucket. New R/G J events are capped per plot.
 const special=area[0]!=='B'&&area.endsWith('D')&&!noJackpot&&r()<.002;
 p.items.forEach((f,i)=>{const plannedDeep=area[0]==='B'&&(i>=p.items.length-2||i>0&&env.deep>0&&r()<env.deep);let t:Treasure;if(area[0]==='G'&&f.goldRich)t=treasure(f.id);else if(area[0]==='R'&&i<6){t=area==='R-A'||area==='R-B'?treasure(['R001','R002','R003'][i%3]):drawTreasure(area,r,true,t=>t.rarity==='C'&&t.weight<=.75);}else if(special&&i===p.items.length-1){const js=eligibleTreasures(area).filter(t=>t.rarity==='J');t=js[Math.floor(r()*js.length)];}else t=drawTreasure(area,r,noJackpot||area[0]!=='B',t=>area[0]!=='B'||(i===0?t.rarity==='C':plannedDeep?t.depth[1]>280:t.depth[0]<=280));
  f.id=t.id;f.areaId=area;f.material=t.material;f.magnetic=t.magnetic;f.weight=t.weight;f.difficulty=t.difficulty;f.obstacle=area[0]==='R'&&i>=6&&r()<env.obstacles;
  if(area[0]==='B'){const deep=plannedDeep,lo=deep?Math.max(280,t.depth[0]):t.depth[0],hi=deep?Math.max(lo+1,Math.min(590,t.depth[1])):Math.min(280,t.depth[1]);f.depth=lo+r()*Math.max(1,hi-lo);if(area==='B-B')f.y=20+r()*110;if(area==='B-C'){f.x=45+(i%4)*80+(r()-.5)*25;f.y=50+Math.floor(i/4)*50;}if(i===0){f.depth=Math.max(t.depth[0],20);f.x=55+Math.floor(r()*13)*20;f.y=35+Math.floor(r()*5)*20;}}
  else if(area[0]==='R'&&i>=6){f.weight=t.weight*(area==='R-D'?env.heavy:1);f.y=area==='R-D'?10+r()*200:f.y;}
  else if(area[0]==='G'){Object.assign(f,{...grainProfile[t.id],grain:t.grain??grainProfile[t.id]?.grain??2,density:t.density??grainProfile[t.id]?.density??2.7,captureRank:Math.min(.95,(f.captureRank??.5)+env.fine*.08)});if(t.material==='magnetite')f.magnetic=true;}
 });
 if(area[0]==='B'){const f=p.items.at(-1)!;if((f.depth??0)<=420){let t=treasure(f.id);if(t.depth[1]<=420){const options=eligibleTreasures(area).filter(x=>x.rarity===t.rarity&&x.depth[1]>420);t=options[Math.floor(r()*options.length)];Object.assign(f,{id:t.id,material:t.material,magnetic:t.magnetic,weight:t.weight,difficulty:t.difficulty});}f.depth=421+r()*(Math.min(590,t.depth[1])-421);}}
 if(area[0]==='G')for(const site of p.goldSites??[]){const prior=site.total;site.total=Math.round(prior*env.volume);site.coarse=env.coarse;for(const uid of site.items){const f=p.items.find(f=>f.uid===uid)!;f.goldOffset=(f.goldOffset??0)*site.total/prior;}if(area==='G-C'){site.x=55+(Number(site.id.split('-')[1])%3)*120;site.y=45+Math.floor(Number(site.id.split('-')[1])/3)*85;}}
 const remap=new Map(p.items.map((f,i)=>[f.uid,`${area}:${seed}:world:${i}`]));for(const f of p.items)f.uid=remap.get(f.uid)!;for(const site of p.goldSites??[])site.items=site.items.map(uid=>remap.get(uid)!);p.id=area+'-'+seed;return p;
}
