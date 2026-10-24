import {getStage} from './stages.js';
import {configurePlanet} from './planets.js';
export const WORLD_PRESETS=Object.freeze({
 standard:{name:'STANDARD',width:375,height:500,maxFlightTime:12,previewSeconds:12},
 large:{name:'LARGE',width:1125,height:1500,maxFlightTime:45,previewSeconds:45},
 huge:{name:'HUGE',width:3750,height:5000,maxFlightTime:180,previewSeconds:120},
});
export function createFreeWorld(id='standard'){
 const preset=WORLD_PRESETS[id]??WORLD_PRESETS.standard,s=getStage();
 if(id==='standard'||!WORLD_PRESETS[id])return s;
 const factor=preset.width/375;
 return {...s,id:`free-${id}`,name:`FREE / ${preset.name}`,world:{width:preset.width,height:preset.height},worldPreset:id,
  flightLimits:{maxFlightTime:preset.maxFlightTime},previewSeconds:preset.previewSeconds,
  launch:{...s.launch,position:{x:48*factor,y:430*factor},angleRange:[-180,180]},
  planets:s.planets.map(p=>({...p,x:p.x*factor,y:p.y*factor})),goal:{...s.goal,x:s.goal.x*factor,y:s.goal.y*factor}};
}
export const HUGE_SAMPLES={
 voyage:{name:'LONG VOYAGE',description:'離れた惑星の引力で長距離を航行します。',planets:[[1000,3300,'dense'],[1700,1900,'earth'],[2600,700,'gas']],goal:{x:2164,y:879}},
 swing:{name:'MULTI SWING-BY',description:'離れた星の引力を順に利用します。',planets:[[910,3200,'dense'],[1500,2700,'dense'],[2100,900,'gas']],goal:{x:3051,y:1615}},
 deep:{name:'DEEP SPACE',description:'反発と強い引力を読み、深宇宙へ。',planets:[[1000,3200,'repulsor'],[2000,2200,'blackhole'],[2600,900,'star']],goal:{x:1798,y:768}},
};
export function getHugeSample(id){
 const data=HUGE_SAMPLES[id];if(!data)throw Error('Unknown HUGE sample');
 const s=createFreeWorld('huge');s.id=`huge-${id}`;s.name=data.name;s.description=data.description;
 s.launch={...s.launch,position:{x:250,y:4500},angleDeg:-65,speed:220};
 s.planets=data.planets.map(([x,y,type],i)=>configurePlanet({id:`distant-${i}`,x,y},type,'medium'));
 s.goal={id:'distant-goal',...data.goal,radius:60};return s;
}
