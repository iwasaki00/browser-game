import {practiceStage,gravityTurn,previewDigest} from './beginner-data.js';
import {createPreview,advancePreview} from './preview.js';
import {velocityFromAngleSpeed} from './launch.js';
// Same-origin, session-bound adapter for the normal game's isolated iframe.
export function createPracticeBridge({getContext,configure,cancel}){
 const token=new URLSearchParams(location.search).get('session');let epoch=0,step=0,last=-Infinity,key='',initial=null,basePositions='',basePreview=null,turned=false,job=null,digest=null,focus='launch',highlighted=null;
 const send=data=>parent.postMessage({kind:'orbit-beginner',session:token,epoch,...data},location.origin);
 window.addEventListener('message',event=>{
  const m=event.data;if(event.source!==parent||event.origin!==location.origin||m?.kind!=='orbit-beginner-command'||m.session!==token)return;
  if(m.action==='focus'){focus=m.focus;highlight();return;}
  if(m.action==='cancel'){cancel();return;}
  if(m.action!=='configure'||!Number.isInteger(m.step)||m.step<0||m.step>5)return;
  epoch=m.epoch;step=m.step;initial=null;turned=false;key='';job=null;digest=null;
  const stage=practiceStage(step,m.destination);configure(stage);basePositions=JSON.stringify(stage.planets.map(p=>[p.x,p.y]));
  const prediction=createPreview(stage,velocityFromAngleSpeed(stage.launch.angleDeg,stage.launch.speed));while(!prediction.done)advancePreview(prediction,2000);basePreview=previewDigest(prediction);send({event:'configured',basePreview});snapshot(true);
 });
 function highlight(){
  const selector={launch:'#launchButton',reset:'#resetButton',angle:'#angleInput',speed:'#speedInput',scan:'#scanButton',scanTargets:'#scanTargets',scanCollapse:'#scanCollapse'}[focus];const next=selector?document.querySelector(selector):null;if(next!==highlighted){highlighted?.classList.remove('beginner-target');next?.classList.add('beginner-target');highlighted=next;}
 }
 function snapshot(force=false){
  const c=getContext();if(c.preview!==job){job=c.preview;digest=null;}if(job?.done&&!digest)digest=previewDigest(job);
  const positions=JSON.stringify(c.stage.planets.map(p=>[p.x,p.y]));
  const data={phase:c.phase,angle:c.angle,speed:c.speed,selected:Boolean(c.selected),moved:positions!==basePositions,previewReady:Boolean(job?.done),predictionChanged:Boolean(digest&&basePreview&&digest!==basePreview),preview:digest,basePreview,scan:document.querySelector('#scanButton')?.getAttribute('aria-pressed')==='true',infoOpen:!document.querySelector('#scanPanel')?.hidden,cleared:c.simulation?.status==='cleared'};
  const next=JSON.stringify(data);if(force||key!==next){key=next;send({event:'snapshot',data});}highlight();
 }
 // Only explicit selection/search gestures count, not the default info on SCAN.
 const inspect=event=>{if(!event.target.closest?.('#scanSearch,#scanNext,#scanPrev,#scanTargets,.scan-marker'))return;queueMicrotask(()=>{const panel=document.querySelector('#scanPanel'),target=document.querySelector('#scanTargets');if(panel&&!panel.hidden&&target?.value&&document.querySelector('#scanInfo').textContent)send({event:'inspection',id:target.value});});};
 document.addEventListener('click',inspect);document.addEventListener('change',inspect);
 window.addEventListener('blur',()=>send({event:'interrupted'}));
 send({event:'ready'});
 return {
  tick(time){if(time-last<100)return;last=time;snapshot();},
  launch(){initial={...getContext().simulation.rocket.velocity};send({event:'launch',angle:getContext().angle,speed:getContext().speed});},
  observe(previous,state){if(step===2&&!turned){const degrees=gravityTurn(initial,state);if(degrees>=5){turned=true;send({event:'gravity',degrees,time:state.elapsed});}}if(state.encounterEvents?.some(e=>e.id==='practice-station')&&!previous.encounterEvents?.some(e=>e.id==='practice-station'))send({event:'station',time:state.elapsed});},
  render(ctx,camera){if(focus!=='planet')return;const p=camera.toScreen(getContext().stage.planets[0]),dpr=Math.min(devicePixelRatio||1,3);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.strokeStyle='#ffe6a1';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(p.x,p.y,Math.max(20,getContext().stage.planets[0].radius*camera.scale+7),0,Math.PI*2);ctx.stroke();ctx.restore();},
 };
}
