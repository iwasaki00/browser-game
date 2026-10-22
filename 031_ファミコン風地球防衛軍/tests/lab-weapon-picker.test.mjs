import test from "node:test";
import assert from "node:assert/strict";
import {runtime} from "./helpers/runtime.mjs";
import {WEAPONS,SAVE_KEY} from "../js/data.js";

const open=()=>{const r=runtime(null,{debug:true});r.click("test-lab");r.click("lab-weapons",undefined,undefined,"0");return r};
const choose=(r,id)=>r.get("labWeaponList").children.find(e=>e.dataset.weapon===id).listeners.click[0]();
const press=(r,id)=>r.get(id).listeners.click[0]();

test("picker uses all 20 shared records, including locked M-20, and immediately equips each",()=>{
  const r=open();
  assert.deepEqual(r.get("labWeaponList").children.map(e=>e.dataset.weapon),WEAPONS.map(w=>w.id));
  for(const w of WEAPONS){
    choose(r,w.id);
    assert.equal(r.run("activeEquipment()[0]"),w.id);
    assert.equal(r.get("labWeaponList").children.find(e=>e.dataset.weapon===w.id).attributes["aria-pressed"],"true");
    assert.match(r.get("labPickerSlot1").textContent,new RegExp(w.id));
  }
  assert.equal(r.run("save.unlocked.includes('M-20')"),false);
});

test("editing slots are independent; active slot and duplicate equipment rules remain unchanged",()=>{
  const r=open();choose(r,"M-20");press(r,"labPickerSlot2");choose(r,"D-19");
  assert.deepEqual(r.json("game.lab.equipped"),["M-20","D-19"]);
  assert.equal(r.run("game.player.weaponSlot"),0);
  choose(r,"M-20");assert.deepEqual(r.json("game.lab.equipped"),["M-20","M-20"]);
  choose(r,"P-12");r.key("keydown","Escape");r.change("labSlot","1");r.click("lab-close");
  r.run("input.aimMode='touch';input.touchDx=1;input.touchDy=0;shoot()");
  assert.equal(r.run("game.shots[0].weapon.id"),"P-12");
});

test("search supports IDs, Japanese names and normalized input without changing equipment",()=>{
  const r=open(),equipment=r.json("game.lab.equipped");
  for(const query of ["m-20","Ｍ－２０","メテオ"]){
    r.input("labWeaponSearch",query);
    assert.deepEqual(r.get("labWeaponList").children.map(e=>e.dataset.weapon),["M-20"]);
  }
  r.input("labWeaponSearch","not-a-weapon");assert.equal(r.get("labWeaponList").children[0].className,"lab-weapon-empty");
  assert.deepEqual(r.json("game.lab.equipped"),equipment);
  r.input("labWeaponSearch","");assert.equal(r.get("labWeaponList").children.length,20);
});

test("selection preserves independent list scroll and keeps keyboard focus on selected weapon",()=>{
  const r=open();r.get("labWeaponList").scrollTop=763;choose(r,"M-20");
  assert.equal(r.get("labWeaponList").scrollTop,763);
  assert.equal(r.run("document.activeElement.dataset.weapon"),"M-20");
});

test("Escape returns to paused LAB, restores opener focus and removes underlying inert",()=>{
  const r=open();press(r,"labPickerSlot2");
  assert.equal(r.get("screenLab").inert,true);r.key("keydown","Escape");
  assert.equal(r.get("labWeaponPicker").hidden,true);assert.equal(r.get("screenLab").inert,false);
  assert.equal(r.run("state"),"lab");assert.equal(r.run("document.activeElement.id"),"labWeaponSlot2");
  r.key("keydown","Escape");assert.equal(r.run("state"),"play");
});

test("Tab and Shift+Tab wrap within picker, and gameplay keys do not reach player",()=>{
  const r=open();r.get("labWeaponList").children.at(-1).focus();
  r.run("handleLabWeaponKey({key:'Tab',shiftKey:false,preventDefault(){}})");
  assert.equal(r.run("document.activeElement.id"),"labWeaponPickerClose");
  r.run("handleLabWeaponKey({key:'Tab',shiftKey:true,preventDefault(){}})");
  assert.equal(r.run("document.activeElement.dataset.weapon"),"M-20");
  r.key("keydown","d");r.key("keydown"," ");r.run("update(1)");
  assert.equal(r.run("game.player.x"),1000);assert.equal(r.run("input.fire||input.right||input.jump"),false);
});

test("pointer, touch and wheel stop propagation without canceling native scroll",()=>{
  const r=open();let stopped=0,canceled=0;
  const events=["click","pointerdown","pointermove","pointerup","pointercancel","wheel","touchstart","touchmove","touchend"];
  for(const event of events)for(const fn of r.get("labWeaponPicker").listeners[event])fn({stopPropagation(){stopped++},preventDefault(){canceled++}});
  assert.equal(stopped,events.length);assert.equal(canceled,0);
  r.pointer("game","pointerdown",{pointerType:"mouse"});r.run("update(1)");
  assert.equal(r.run("game.shots.length"),0);assert.equal(r.run("game.time"),0);
});

test("reopening resets search, title exit clears dialog, normal save stays byte-identical",()=>{
  const r=open(),before=r.storage.get(SAVE_KEY),save=r.json("save");
  choose(r,"M-20");press(r,"labPickerSlot2");choose(r,"R-10");r.input("labWeaponSearch","雷");
  press(r,"labWeaponPickerClose");r.click("lab-weapons",undefined,undefined,"1");
  assert.equal(r.get("labWeaponSearch").value,"");assert.equal(r.get("labWeaponList").children.length,20);
  r.run("discardMission();show('title')");
  assert.equal(r.get("labWeaponPicker").hidden,true);assert.equal(r.get("screenLab").inert,false);
  assert.equal(r.storage.get(SAVE_KEY),before);assert.deepEqual(r.json("save"),save);
});

test("normal launch cannot open weapon picker",()=>{
  const r=runtime();r.click("lab-weapons",undefined,undefined,"0");
  assert.equal(r.run("labWeaponPickerOpen"),false);assert.equal(r.run("game"),null);
});
