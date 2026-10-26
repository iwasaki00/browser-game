import {getStage} from './stages.js';
import {createEncounter} from './encounters.js';
export const ENCOUNTER_SAMPLES={meteor:'METEOR FIELD',comet:'COMET RIDER',unknown:'UNKNOWN SIGNAL',ufo:'UFO ENCOUNTER',station:'DEEP SPACE STATION'};
export function getEncounterSample(type){
 if(!ENCOUNTER_SAMPLES[type])throw Error('Unknown encounter sample');
 const base=getStage(),s={...base,id:`encounter-${type}`,name:ENCOUNTER_SAMPLES[type],world:{width:1125,height:1500},worldPreset:'large',flightLimits:{maxFlightTime:45},previewSeconds:45,
  launch:{...base.launch,position:{x:120,y:1100},angleDeg:0,speed:170,angleRange:[-180,180]},goal:{id:'encounter-goal',x:970,y:1100,radius:50},planets:[]};
 let e;
 if(type==='meteor')e=createEncounter(type,'sample-meteor',560,1000,{count:8,speed:40});
 if(type==='comet')e=createEncounter(type,'sample-comet',370,1121,{speed:40,strength:60});
 if(type==='unknown')e=createEncounter(type,'sample-unknown',570,1220,{strength:60});
 if(type==='ufo')e=createEncounter(type,'sample-ufo',560,1010,{speed:80});
 if(type==='station')e=createEncounter(type,'sample-station',570,1030);
 s.encounters=[e];s.solution={angleDeg:0,speed:170};return s;
}
