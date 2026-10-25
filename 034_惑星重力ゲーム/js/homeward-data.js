import {getStage} from './stages.js';
import {configurePlanet} from './planets.js';

export const HOMEWARD={
 id:'homeward',title:'HOMEWARD / 帰還航路',ship:'ヒナギ',totalDistance:64000,
 opening:'調査船ヒナギが目を覚ました宙域には、知っている星座が一つもなかった。航法記録は途切れ、地球の時刻信号だけが遠くかすかに届く。星の引力を読み、次の航路標識へ渡ろう。一度の跳躍では帰れない。それでも、一つずつ故郷へ近づくことはできる。',
};
// Local geometry uses the three verified long-distance routes. Narrative and
// campaign progress are independent of FREE SPACE's editable sample data.
export const HOMEWARD_SECTORS=[
 {id:'homeward-01',number:'01',name:'消えた星図',theme:'最初の重力航路をつなぐ',distance:1200,map:{x:12,y:78},next:'homeward-02',
  enter:'白縁宙域。航法端末が、惑星をかすめる細い航路を見つけた。ゲートの先から、地球のものと似た時刻信号が届いている。まずは、この宙域を抜けよう。',
  arrival:'ゲートを通過し、欠けた星図の一片を回収した。信号は確かに故郷の方向を示している。ヒナギは次の重力潮へ向かう。',
  planets:[[1000,3300,'dense'],[1700,1900,'earth'],[2600,700,'gas']],goal:{x:2164,y:879}},
 {id:'homeward-02',number:'02',name:'ふたつの潮',theme:'離れた引力を組み合わせる',distance:1800,map:{x:35,y:62},next:'homeward-03',
  enter:'二つの高密度惑星が、見えない潮のように航路を曲げる。最初の星だけを見ていては、その先へ届かない。二つの力の間に道を描こう。',
  arrival:'二重の潮を抜けた。漂う観測標識に、青い惑星を示す古い方位記録が残っていた。帰還距離の見積もりを更新する。',
  planets:[[910,3200,'dense'],[1500,2700,'dense'],[2100,900,'gas']],goal:{x:3051,y:1615}},
 {id:'homeward-03',number:'03',name:'青い残響',theme:'反発と強い引力の境界を読む',distance:2400,map:{x:60,y:46},next:null,
  enter:'反発する星の向こうで、暗い重力源と恒星が航路を挟んでいる。熱と吸収の領域を避け、遠いゲートへ。あの先なら、故郷の信号をもう少し長く受信できる。',
  arrival:'遠い宙域に、帰還航路の基点を確保した。地球はまだ遠い。ヒナギの記録は、ここから先の未知宙域へ続いていく。',
  planets:[[1000,3200,'repulsor'],[2000,2200,'blackhole'],[2600,900,'star']],goal:{x:1798,y:768}},
];
export function getHomewardDefinition(id){return HOMEWARD_SECTORS.find(s=>s.id===id);}
export function getHomewardSector(id){
 const data=getHomewardDefinition(id);if(!data)throw Error('Unknown HOMEWARD sector');
 const base=getStage(),planets=data.planets.map(([x,y,type],i)=>configurePlanet({id:`homeward-planet-${i+1}`,x,y},type,'medium'));
 return {...base,id:data.id,name:`HOMEWARD ${data.number} / ${data.name}`,description:data.theme,
  world:{width:3750,height:5000},worldPreset:'huge',flightLimits:{maxFlightTime:180},previewSeconds:120,
  launch:{...base.launch,position:{x:250,y:4500},angleDeg:-65,speed:220,angleRange:[-180,180]},
  planets,goal:{id:'sector-exit',...data.goal,radius:60},
  rules:{minPlanets:3,maxPlanets:3,types:[...new Set(planets.map(p=>p.type))],sizes:['medium'],placement:{left:0,top:0,right:3750,bottom:5000}},
  solution:{angleDeg:-65,speed:220,planets:structuredClone(planets)},
 };
}
