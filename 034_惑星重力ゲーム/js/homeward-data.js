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
  enter:'航行ログ01：遠い信号を捕捉。最初の航路は端末が計算済み。発射して、星のそばで曲がる軌道を見よう。',
  arrival:'発見01：欠けた星図を回収。地球の信号が、少しだけ強くなった。',
  departure:'出航：星の力を借り、最初の信号へ。',
  initial:{angleDeg:-65,speed:220},hint:'01は初期設定のままLAUNCH。星へ近づくと航路が曲がります。',
  planets:[[1000,3300,'dense'],[1700,1900,'earth'],[2600,700,'gas']],goal:{x:2164,y:879}},
 {id:'homeward-02',number:'02',name:'ふたつの潮',theme:'離れた引力を組み合わせる',distance:1800,map:{x:35,y:62},next:'homeward-03',
  enter:'航行ログ02：二重の重力潮。今の推力では出口へ届かない。THRUSTを変え、二つの星の間へ道を探そう。',
  arrival:'発見02：観測標識に、青い惑星の方位記録。帰還航路が一つにつながった。',
  departure:'出航：二つの重力潮をつなぐ。',
  initial:{angleDeg:-65,speed:200},hint:'角度はそのまま、THRUSTを200から増やして予測を確認。解答例：ANGLE −65°、THRUST 220（218でも到達）。',
  planets:[[910,3200,'dense'],[1500,2700,'dense'],[2100,900,'gas']],goal:{x:3051,y:1615}},
 {id:'homeward-03',number:'03',name:'青い残響',theme:'反発と強い引力の境界を読む',distance:2400,map:{x:60,y:46},next:null,
  enter:'航行ログ03：反発する星、暗い吸収域、恒星の熱。押し返す力と引く力を読み、角度と推力を整えよう。',
  arrival:'発見03：故郷の時刻信号を受信。地球はまだ先。それでも、帰る方向はもう失われていない。',
  departure:'出航：反発と引力の境界を抜ける。',
  initial:{angleDeg:-60,speed:200},angleRange:[-75,-50],hint:'紫は反発、暗い星は吸収、橙の外周は熱。解答例：ANGLE −65°、THRUST 220。反発で吸収域を避け、二つの引力で出口へ曲がります。',
  planets:[[1000,3200,'repulsor'],[1250,2300,'blackhole'],[1500,2000,'star']],goal:{x:2731,y:1245,radius:80}},
];
export function getHomewardDefinition(id){return HOMEWARD_SECTORS.find(s=>s.id===id);}
export function getHomewardSector(id){
 const data=getHomewardDefinition(id);if(!data)throw Error('Unknown HOMEWARD sector');
 const base=getStage(),planets=data.planets.map(([x,y,type],i)=>configurePlanet({id:`homeward-planet-${i+1}`,x,y},type,'medium'));
 return {...base,id:data.id,name:`HOMEWARD ${data.number} / ${data.name}`,description:data.theme,
  world:{width:3750,height:5000},worldPreset:'huge',flightLimits:{maxFlightTime:180},previewSeconds:120,
  launch:{...base.launch,position:{x:250,y:4500},...data.initial,angleRange:[...(data.angleRange??[-180,180])]},
  planets,goal:{id:'sector-exit',radius:60,...data.goal},
  rules:{minPlanets:3,maxPlanets:3,types:[...new Set(planets.map(p=>p.type))],sizes:['medium'],placement:{left:0,top:0,right:3750,bottom:5000}},
  solution:{angleDeg:-65,speed:220,planets:structuredClone(planets)},
 };
}
