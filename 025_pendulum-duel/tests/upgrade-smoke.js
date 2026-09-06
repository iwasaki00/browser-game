'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const weaponsSource=fs.readFileSync(path.join(root,'weapons.js'),'utf8');
const gameSource=fs.readFileSync(path.join(root,'game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const mobileCss=fs.readFileSync(path.join(root,'iphone.css'),'utf8');
const weaponsCss=fs.readFileSync(path.join(root,'weapons.css'),'utf8');
const context={};
vm.createContext(context);
vm.runInContext(weaponsSource+';this.result={WEAPONS,WEAPON_IDS};',context);
const {WEAPONS,WEAPON_IDS}=context.result;

function assert(condition,message){if(!condition)throw new Error(message);}

assert(JSON.stringify(WEAPON_IDS)===JSON.stringify(['balanced','long','heavy','light','chaos']),'Five weapons must be registered in display order');
assert(WEAPONS.balanced.segmentLength===1&&WEAPONS.balanced.motorPower===1&&WEAPONS.balanced.damageMultiplier===1,'BALANCED must preserve baseline values');
assert(WEAPONS.long.segmentLength>=1.25&&WEAPONS.long.segmentLength<=1.35,'LONG reach multiplier is out of range');
assert(WEAPONS.heavy.tipMass>=1.8&&WEAPONS.heavy.tipMass<=2.2&&WEAPONS.heavy.damageMultiplier>1,'HEAVY mass or damage is invalid');
assert(WEAPONS.light.segmentLength>=.8&&WEAPONS.light.segmentLength<=.9&&WEAPONS.light.tipMass<1&&WEAPONS.light.motorPower>1,'LIGHT mobility values are invalid');
assert(WEAPONS.chaos.segments===5&&WEAPONS.chaos.segmentLength*5/(WEAPONS.balanced.segmentLength*3)>=1.1&&WEAPONS.chaos.segmentLength*5/(WEAPONS.balanced.segmentLength*3)<=1.25,'CHAOS segment count or total reach is invalid');
for(const weapon of Object.values(WEAPONS))assert(Number.isInteger(weapon.segments)&&weapon.segments>=3,'Every weapon needs an extensible segment count');

for(const id of ['ccw0','lock0','cw0','ccw1','lock1','cw1','weapon0','weapon1'])assert(html.includes('id="'+id+'"'),'Missing control or HUD element: '+id);
for(const mapping of ["a:[0,'ccw']","s:[0,'lock']","d:[0,'cw']","j:[1,'ccw']","k:[1,'lock']","l:[1,'cw']"])assert(gameSource.includes(mapping),'Missing keyboard mapping: '+mapping);
for(const token of ['p.nodes.length','weapon.damageMultiplier','WEAPON_IDS[Math.floor(Math.random()','state=\'countdown\'','countdownNumber','setPointerCapture','pointercancel','lostpointercapture','MIN_HIT_SPEED','MAX_DAMAGE_PER_HIT','normalizedPosition','Math.sqrt','hitCooldowns','TIP HIT','CRITICAL'])assert(gameSource.includes(token),'Missing upgraded game behavior: '+token);
for(const token of ['CHAOS_CONFIG','EVENT_CONFIG','GAME_CONFIG','OVER CHAOS','LOW GRAVITY','REVERSE GRAVITY','spawnBomb','explodeBomb','JOINT BREAK','stepDebris','adaptCpuToHazards'])assert(gameSource.includes(token),'Missing chaos feature: '+token);
assert(!gameSource.includes("input.swing")&&!gameSource.includes("nodes[3]"),'Legacy one-way or fixed-three-segment physics remains');
for(const token of ['touch-action:none','user-select:none'])assert(fs.readFileSync(path.join(root,'style.css'),'utf8').includes(token),'Base touch safeguard missing: '+token);
for(const token of ['safe-area-inset-top','safe-area-inset-bottom','overscroll-behavior'])assert(mobileCss.includes(token),'iPhone safeguard missing: '+token);
for(const token of ['weapon-select-grid','preview-swing','weapon-ready'])assert(weaponsCss.includes(token),'Weapon UI styling missing: '+token);

console.log('Pendulum upgrade smoke passed: weapons, controls, extensible physics, READY flow, CPU randomization, and iPhone safeguards.');
