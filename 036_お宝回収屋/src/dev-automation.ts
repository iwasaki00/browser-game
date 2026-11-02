import {mountAutomationCompare} from './dev-auto-ui';
import {createState,addPlot,plot,dig,refresh,stored,reward,type State} from './engine';
import {collectGravel,availableGrains,collectGrain} from './gold';
import {auto,machines,purchaseMachine,enqueueMaterial,setMachineRunning,automationTick,automationReport,type MachineId} from './automation';
import {migrate} from './save';
export const automationScenarios=['砂浜の自動選別開始','砂浜の材料不足','砂浜の選別待ち増加','砂浜の回収品出力','川底の連続回収成功','川底の重量不足失敗','川底の磁性不一致','河原の砂利連続供給','河原の処理待ち増加','河原の最終回収待ち','設備の途中停止・再開','処理中の保存・復元','大量材料の連続処理','設備を跨ぐ在庫整合性','設備の長時間稼働'].map((name,i)=>({id:'AUTO-'+String(i+1).padStart(2,'0'),name}));
export function automationFixture(seed=5001,field:'B'|'R'|'G'='B',combo=false){const s=createState(seed);s.currentFN=1e6;s.discoveredTreasures.B001={count:20,first:'',best:0,locations:['B-A'],tools:['hand']};s.ownedTools=['B101','B104','R104','R106','R110','G101','G103','G102','G203',...(combo?['B105','B208','R201','R206','G106','G202','G108','G205','G204']:[])];refresh(s);addPlot(s,seed,true,field==='B'?'B-A':field==='R'?'R-B':'G-B');for(const d of machines)purchaseMachine(s,d.id);s.currentFN=0;return s;}
export function collectAutomationSand(s:State){for(const f of [...plot(s).items].slice(0,6))for(let i=0;i<4;i++)dig(s,'B101',f.x,f.y,12);return s.sandBatches.filter(b=>!b.processed&&!b.automationJob);}
export function supplyAutomation(s:State,field:'B'|'R'|'G',combo=false){let count=0;
 if(field==='B'){for(const b of collectAutomationSand(s))if(enqueueMaterial(s,'B301',b.id).ok)count++;}
 else if(field==='R'){for(const f of plot(s).items.filter(f=>f.state==='buried').slice(0,6))if(enqueueMaterial(s,'R301',f.uid,combo?'R201':'R104',combo?['R104','R110','R206']:['R110']).ok)count++;}
 else{for(const site of plot(s).goldSites!.slice(0,3))for(let n=0;n<4;n++)collectGravel(s,combo?'G106':'G101',site.x,site.y,24);for(const b of s.gravelBatches??[])if(enqueueMaterial(s,'G304',b.id,'G203',combo?['G202','G205','G108']:['G103']).ok)count++;}return count;
}
export function drainAutomation(s:State){let picked=0,fn=0;for(const b of s.gravelBatches??[])for(const f of availableGrains(s,b))for(let n=0;n<3&&f.state==='batch';n++){collectGrain(s,b.id,f.uid,s.ownedTools.includes('G204')?'G204':'hand');picked++;}for(const f of stored(s))fn+=reward(s,f.uid);return {picked,fn};}
export function applyAutomationScenario(id:string){const index=automationScenarios.findIndex(x=>x.id===id);if(index<0)throw Error('未知の設備シナリオ');const field=index>=4&&index<=6?'R':index>=7&&index<=9?'G':'B';let s=automationFixture(5500+index,field,true);if(index!==1)supplyAutomation(s,field,true);
 if(index===5||index===6){const f=plot(s).items[0];Object.assign(f,index===5?{weight:50}:{magnetic:false});}
 for(const d of machines)setMachineRunning(s,d.id,true);
 if([3,9].includes(index))automationTick(s,120);
 if(index===10){automationTick(s,1);setMachineRunning(s,'B301',false);}
 if(index===11){automationTick(s,1);s=migrate(structuredClone(s));}
 if(index===12){for(let n=0;n<4;n++){addPlot(s,5600+n,true,'B-A');supplyAutomation(s,'B',true);}}
 if(index===13){addPlot(s,5701,true,'R-B');supplyAutomation(s,'R',true);addPlot(s,5702,true,'G-B');supplyAutomation(s,'G',true);}
 if(index===14){for(let n=0;n<360;n++){automationTick(s,10);drainAutomation(s);}}
 return {state:s,tool:'hand'};
}
export function mountAutomationLab(root:HTMLElement,get:()=>State,replace:(s:State)=>void,changed:()=>void){const box=document.createElement('details');box.id='automation-lab';box.innerHTML='<summary>SEMI AUTOMATION / 設備・工程試験</summary><p>通常セーブと分離したテスト状態だけを変更します。</p><div class="auto-debug-grid">'+automationScenarios.map(x=>`<button data-auto-scenario="${x.id}">${x.id} ${x.name}</button>`).join('')+'</div><button id="auto-lab-stats-refresh">設備統計を更新</button><button id="auto-lab-copy">設備情報JSONコピー</button><pre id="auto-lab-stats"></pre>';root.append(box);const disposeCompare=mountAutomationCompare(box);const stats=()=>Object.fromEntries(machines.map(d=>[d.id,{...automationReport(get(),d.id),configuration:get().automation?.jobs.filter(j=>j.machine===d.id).map(j=>({id:j.id,stage:j.stage,tools:j.tools,remaining:j.remaining})),capacities: d.id==='G304'?{feed:180,screenG103:60/(.3*3),screenG202:60/(.24*3),sluice:'60 / (.45 + coarse × .25 × (1 - screened)) / C10係数',pan:'既存 GoldWork.required × 0.6秒 / load',precision:'手動、未計測はデータ不足'}:d.rate}]));const update=()=>{box.querySelector('#auto-lab-stats')!.textContent=JSON.stringify(stats(),null,2);};box.querySelectorAll<HTMLButtonElement>('[data-auto-scenario]').forEach(b=>b.onclick=()=>{if(!confirm('設備テスト用にテスト状態を再生成しますか？'))return;replace(applyAutomationScenario(b.dataset.autoScenario!).state);changed();update();});box.querySelector<HTMLButtonElement>('#auto-lab-stats-refresh')!.onclick=update;box.querySelector<HTMLButtonElement>('#auto-lab-copy')!.onclick=()=>void navigator.clipboard.writeText(JSON.stringify({stats:stats(),automation:auto(get())},null,2));update();const timer=setInterval(()=>{if(box.open&&box.isConnected)update();},1000);return()=>{disposeCompare();clearInterval(timer);};}
