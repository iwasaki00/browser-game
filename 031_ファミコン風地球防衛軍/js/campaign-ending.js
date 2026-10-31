// Presentation only. Completion/reward transactions are committed before this
// player is created. Replay, skips, hidden tabs and LAB can never grant rewards.
export const ENDING_SCENES=Object.freeze([
  {id:'SIGNAL',title:'SIGNAL TERMINATED',text:'母艦の制御信号が、静寂へと変わる。',background:'silenceBackground'},
  {id:'EARTH',title:'INVASION HALTED',text:'市街地、地下、沿岸。地球上の侵略兵器が停止した。',background:'earthBackground'},
  {id:'ESCAPE',title:'ALL UNITS RETURN',text:'崩壊する母艦から、最後の部隊が離脱する。',background:'escapeBackground'},
  {id:'MEMORIES',title:'THE SEVEN FRONTS',text:'8つの戦いは、ひとつの地球を守るためにあった。'},
  {id:'DEFENDED',title:'EARTH DEFENDED',text:'侵略の指揮生命体は消滅した。地球は守られた。',background:'earthBackground'},
  {id:'COMPLETE',title:'CAMPAIGN COMPLETE',text:'戦績と報酬を確認し、新たな兵科・装備で再び出撃できる。',background:'earthBackground'}]);
export class CampaignEnding {
  constructor(returnTo='result',lab=false){this.returnTo=returnTo;this.lab=lab;this.elapsed=0;this.scene=0;this.done=false;this.skipped=false;this.visited=new Set([0])}
  tick(dt,active=true){if(this.done||!active||!(dt>0))return;this.elapsed+=Math.min(.1,dt);this.scene=Math.min(5,Math.floor(this.elapsed/4));this.visited.add(this.scene);if(this.elapsed>=24)this.done=true}
  next(){if(this.scene>=5){this.done=true;return}this.scene++;this.elapsed=this.scene*4;this.visited.add(this.scene)}
  skip(){this.skipped=true;this.done=true}
}
export function drawCampaignEnding(c,ending,pack,history=[],summary=''){
  const scene=ENDING_SCENES[ending.scene];c.save();c.fillStyle='#071320';c.fillRect(0,0,320,180);const image=pack?.[scene.background];if(image)c.drawImage(image,0,0,640,360,0,0,320,180);
  if(scene.id==='MEMORIES')for(let i=0;i<7;i++){const x=8+(i%4)*78,y=20+Math.floor(i/4)*53,resource=history[i];if(resource?.background)c.drawImage(resource.background,0,0,resource.background.width||640,resource.background.height||360,x,y,72,44);else{c.fillStyle='#233746';c.fillRect(x,y,72,44)}c.font='6px monospace';c.fillStyle='#e6ddbd';c.fillText('M0'+(i+1),x+2,y+8)}
  // Bounded pixel stars, signal dashes and departing craft; no entities/timers.
  c.fillStyle='#dfdfbc';for(let i=0;i<12;i++)c.fillRect((i*43+Math.floor(ending.elapsed*3))%320,8+i%4*10,1,1);
  if(scene.id==='ESCAPE'){const x=240-(ending.elapsed%4)*28;c.fillStyle='#bbd3ce';c.fillRect(x,78,15,4);c.fillRect(x+4,75,7,9);c.fillStyle='#e2ba8b';c.fillRect(x+14,79,5,2)}
  c.fillStyle='#07131eeb';c.fillRect(4,127,312,49);c.textAlign='center';c.font='bold 12px monospace';c.fillStyle='#e9d6a0';c.fillText(scene.title,160,142);c.font='6px monospace';c.fillStyle='#c9ddce';c.fillText(scene.text.slice(0,49),160,154);if(ending.scene===5)c.fillText(summary.slice(0,58),160,165);c.restore();
}
