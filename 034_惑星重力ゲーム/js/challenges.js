import { configurePlanet } from './planets.js';
import { getStage } from './stages.js';
import {SPECIAL_CHALLENGES}from'./special-challenges.js';

const definitions = [
 ['はじめての引力','惑星の横を通り、引力でゲートへ曲がろう。',[[196,282,'earth','medium']],1,['earth'],['medium'],[319,105,24]],
 ['すれすれ飛行','小さめのゲートを狙い、衝突を避けよう。',[[205,275,'earth','medium']],1,['earth'],['small','medium'],[319,105,18]],
 ['大きなカーブ','巨大ガス惑星の強い引力を利用しよう。',[[220,275,'gas','medium']],1,['gas'],['small','medium'],[315,100,28]],
 ['小さな調整','弱い引力に合わせて発射角度を微調整。',[[180,275,'asteroid','medium']],1,['asteroid'],['small','medium','large'],[315,110,18]],
 ['重力の輪','惑星の外側に安全な航路を作ろう。',[[210,260,'earth','large']],1,['earth','gas'],['medium','large'],[315,95,20]],
 ['二つの引力','二つの惑星が作る合成重力を使おう。',[[190,285,'earth','medium'],[95,140,'asteroid','medium']],2,['earth','asteroid'],['small','medium'],[319,105,18]],
 ['S字飛行','左右に分かれた二つの引力を調整しよう。',[[220,300,'earth','small'],[105,160,'earth','small']],2,['earth'],['small','medium'],[320,90,16]],
 ['重力の橋','種類の異なる二惑星でゲートまで橋をかけよう。',[[220,285,'gas','small'],[85,145,'asteroid','medium']],2,['gas','asteroid'],['small','medium'],[315,100,14]],
 ['三つの星','三惑星の重力を読み、通り道を探そう。',[[210,285,'earth','small'],[85,145,'asteroid','small'],[270,190,'asteroid','small']],3,['earth','asteroid'],['small','medium'],[320,100,14]],
 ['軌道マスター','三種類を組み合わせ、小さなゲートを目指そう。',[[210,280,'gas','small'],[80,145,'asteroid','small'],[270,190,'earth','small']],3,['earth','asteroid','gas'],['small','medium'],[320,95,12]],
];
const answers=[[-72,126,2.9333333333333256],[-72,120,3.0999999999999917],[-72,136,2.6249999999999933],[-67,120,3.2666666666666577],[-72,136,2.724999999999993],[-72,120,2.941666666666659],[-60,120,3.0166666666666586],[-69,120,3.0166666666666586],[-68,120,3.033333333333325],[-69,160,2.316666666666661]];
const threeStarAnswers=[[-72,126],[-72,124],[-72,144],[-65,128],[-71,154],[-69,142],[-58,154],[-64,158],[-62,168],[-67,172]];
export const CHALLENGES = definitions.map(([name,description,planets,maxPlanets,types,sizes,goal],i)=>({
 ...getStage(), id:`stage-${String(i+1).padStart(2,'0')}`, name, description,
 planets:planets.map(([x,y,type,size],j)=>configurePlanet({id:`planet-${j+1}`,x,y},type,size)),
 goal:{id:'goal',x:goal[0],y:goal[1],radius:goal[2]},
 rules:{maxPlanets,types,sizes,placement:{left:20,top:40,right:355,bottom:470}},
 launchConditions:{precisionAngleRange:[-72,-35],slingshotAngleRange:[-180,180],speedRange:[120,220]},
 rating:{two:{maxTime:[4,4,4,4,4,3.6,3.5,3.4,3.3,3.1][i]},three:{maxTime:[3,3,2.6,3,2.55,2.65,2.55,2.45,2.35,2.25][i],maxMovement:30}},
 solution:{planets:planets.map(([x,y,type,size],j)=>configurePlanet({id:`planet-${j+1}`,x,y},type,size)),angleDeg:answers[i][0],speed:answers[i][1],liveTargets:{}},
 threeStarSolution:{angleDeg:threeStarAnswers[i][0],speed:threeStarAnswers[i][1]},
 verification:{design:'cleared',live:'cleared',elapsed:answers[i][2],fixedTimeStep:1/120},
})).concat(SPECIAL_CHALLENGES);
export function getChallenge(id) {
 const source=CHALLENGES.find(s=>s.id===id);if(!source)throw Error(`Unknown stage: ${id}`);
 return structuredClone(source);
}
