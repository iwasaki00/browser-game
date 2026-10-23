import {getStage} from './stages.js';
import {configurePlanet,PLANET_TYPES} from './planets.js';
export const SPECIAL_SAMPLES=Object.freeze({
 blackhole:{x:196,y:282,angleDeg:-55,speed:170},
 repulsor:{x:200,y:260,angleDeg:-55,speed:170},
 star:{x:196,y:282,angleDeg:-55,speed:170},
 dense:{x:185,y:280,angleDeg:-72,speed:154},
});
export function getSpecialSample(type){
 const sample=SPECIAL_SAMPLES[type];if(!sample)throw Error('Unknown special sample');
 const stage=getStage();stage.id=`sample-${type}`;stage.name=`体験：${PLANET_TYPES[type].name}`;
 stage.planets=[configurePlanet({id:'sample-planet',x:sample.x,y:sample.y},type)];
 stage.launch.angleDeg=sample.angleDeg;stage.launch.speed=sample.speed;
 return stage;
}
