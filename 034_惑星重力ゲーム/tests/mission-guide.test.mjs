import test from 'node:test';
import assert from 'node:assert/strict';
import {missionGuide,destinationInfo} from '../js/mission-guide.js';
import {getStage} from '../js/stages.js';
import {getHomewardSector} from '../js/homeward-data.js';
import {createOpenVoyage} from '../js/open-voyage.js';
import {createDeepSpace} from '../js/deep-space.js';
import {createFinalVoyage} from '../js/final-voyage.js';
const base=()=>({stage:getStage(),phase:'editing',playType:'free',progress:{}});
for(const [name,extra,code,selector]of [
 ['ゲーム開始',{},'prepare','#angleInput'],['調整後',{adjusted:true},'launch','#launchButton'],
 ['飛行中',{phase:'flying'},'flying','#flightRate'],['失敗',{phase:'crashed'},'retry','#retryLastResult'],
 ['到達',{phase:'cleared'},'arrived','#nextStage'],['次のない到達',{phase:'cleared',canNext:false},'arrived','#openMenuSettings'],
 ['結末',{phase:'cleared',ending:'END-05'},'ending','#nextStage'],
 ['スリング',{launchMode:'slingshot'},'prepare','#gameCanvas'],
 ['既存チュートリアル',{tutorial:{title:'練習',text:'角度を調整',selector:'#angleInput'}},'tutorial','#angleInput'],
 ['SCAN情報の確認中',{scanExpanded:true},'scan','#scanButton'],
 ['到達したが任務未達',{phase:'cleared',missionComplete:false},'incomplete','#retryLastResult'],
])test('案内 / '+name,()=>{const c={...base(),...extra},before=JSON.stringify(c),g=missionGuide(c);assert.equal(g.code,code);assert.equal(g.selector,selector);assert.equal(JSON.stringify(c),before);assert.ok(g.steps.length>0);assert.ok(!g.steps.join().includes('−65'));});
test('目的地が選択されていない場合は選択へ案内',()=>{const stage=createOpenVoyage();stage.goal.id='not-available';const c={stage,playType:'homeward',progress:{voyage:{selected:null}},phase:'editing'};assert.equal(destinationInfo(c),null);assert.equal(missionGuide(c).code,'destination');});
test('寄港中の同一目的地へ再発射を案内しない',()=>{const stage=createOpenVoyage();const g=missionGuide({stage,playType:'homeward',progress:{voyage:{checkpoint:stage.goal.id}}});assert.equal(g.selector,'#openDestinations');});
test('Sector07未選択の判断は既存画面へ',()=>{const c={stage:getHomewardSector('homeward-07'),playType:'homeward',progress:{}};assert.equal(missionGuide(c).code,'branch');assert.equal(missionGuide(c).selector,'#openHomeward');});
for(const [clues,kind]of [[{'CLUE-05':true},'identity'],[{'CLUE-05':true,'CLUE-06':true},'timestamp']])test('取得済み通信のみ解析案内 '+kind,()=>{const c={stage:createOpenVoyage(),playType:'homeward',progress:{echoes:{clues}}};const g=missionGuide(c);assert.equal(g.code,'analysis');assert.match(g.focus,new RegExp(kind));assert.ok(!JSON.stringify(g).includes('72時間'));});
test('未取得の通信を解析案内しない',()=>{assert.notEqual(missionGuide({stage:createOpenVoyage(),playType:'homeward',progress:{}}).code,'analysis');});
test('調査完了後も飛行状態を維持した案内',()=>{const stage=createDeepSpace({selected:'DS01',targets:{DS01:{state:'INVESTIGATED'}}}),progress={deep:{targets:{DS01:{state:'INVESTIGATED'}}}};assert.equal(missionGuide({stage,progress,playType:'homeward',phase:'flying'}).code,'investigated');});
test('追加航行先の解放を任意の操作として案内',()=>{const g=missionGuide({stage:createOpenVoyage(),playType:'homeward',progress:{echoes:{clues:{'CLUE-01':true,'CLUE-02':true,'CLUE-03':true,'CLUE-04':true}}}});assert.equal(g.code,'unlocked');assert.match(g.description,/帰還/);});
test('帰還可能な場合は準備を案内',()=>{assert.equal(missionGuide({stage:createDeepSpace(),playType:'homeward',progress:{deep:{choices:[{policy:'direct'}]}}}).code,'return-ready');});
test('最初の広域航路は方針・行き先の確認を案内',()=>{assert.equal(missionGuide({stage:createDeepSpace(),playType:'homeward',progress:{}}).code,'route-policy');});
test('検出済み対象への調査条件を案内',()=>{const stage=createOpenVoyage({selected:'probe'}),progress={frontier:{targets:{D01:{state:'DETECTED'}}},echoes:{choices:[{choice:'explore'}]}};const g=missionGuide({stage,progress,playType:'homeward'});assert.equal(g.code,'survey-ready');assert.match(g.description,/以内/);assert.ok(!g.title.includes('探査機'));});
test('最終判断の未選択と選択済みを区別',()=>{const stage=createFinalVoyage();assert.equal(missionGuide({stage,playType:'homeward',progress:{}}).code,'branch');assert.notEqual(missionGuide({stage,playType:'homeward',progress:{finalVoyage:{decision:'home'}}}).code,'branch');});
test('未知の対象は選択も正式名称の開示もしない',()=>{const c={stage:createDeepSpace(),playType:'homeward',progress:{}};assert.equal(destinationInfo(c,'DS06'),null);c.progress.deep={targets:{DS06:{state:'DETECTED'}}};const info=destinationInfo(c,'DS06');assert.match(info.name,/DS06/);assert.ok(!JSON.stringify(info).includes('時間異常観測点'));assert.match(info.description,/未解析/);});
test('調査済み対象は取得済み情報だけ表示',()=>{const c={stage:createDeepSpace(),playType:'homeward',progress:{deep:{targets:{DS01:{state:'INVESTIGATED',information:'回収した記録'}}}}};assert.equal(destinationInfo(c,'DS01').description,'回収した記録');});
test('旧保存・再読込でも同じ案内で、保存形式を追加変更しない',()=>{const c={stage:createOpenVoyage(),playType:'homeward',progress:{version:1,voyage:{selected:'gate'},echoes:{clues:{'CLUE-05':{at:1}}}}};const before=JSON.stringify(c);assert.deepEqual(missionGuide(c),missionGuide(JSON.parse(before)));assert.equal(JSON.stringify(c),before);});
