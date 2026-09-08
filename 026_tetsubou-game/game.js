(() => {
  'use strict';
  const P = window.BarPhysics, C = P.CONFIG, $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  let state = P.create(), debug = false, lastTime = 0, accumulator = 0;
  let cameraX = 0, cameraY = 0, scale = 1, width = 960, height = 400;
  let shownGiants = 0, badgeUntil = 0, resultTime = 0, audio = null;
  const keys = new Set(), pointers = new Set(), trail = [], particles = [], sprites = {};
  for (const name of ['body', 'arm', 'leg']) { const image = new Image(); image.src = `assets/${name}.png`; sprites[name] = image; }
  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    width = rect.width; height = rect.height; scale = Math.min(width / 960, height / 400);
  }
  function updateHeld() {
    state.held = state.phase !== 'result' && (keys.size > 0 || pointers.size > 0);
    $('tuck').setAttribute('aria-pressed', String(state.held));
  }
  function clearInput() { keys.clear(); pointers.clear(); updateHeld(); }
  function tone(frequency, duration = 0.09, type = 'sine') {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, audio.currentTime);
      gain.gain.setValueAtTime(0.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) { /* Sound is optional. */ }
  }
  function release() { if (P.release(state)) { tone(620, 0.15); $('release').disabled = true; trail.length = 0; } }
  function reset() {
    clearInput(); state = P.create(); shownGiants = 0; badgeUntil = 0; resultTime = 0;
    cameraX = cameraY = accumulator = 0; trail.length = particles.length = 0;
    $('result').hidden = true; $('release').disabled = false; $('badge').textContent = '';
    $('tuck').disabled = false; $('score').textContent = '0'; $('retry').blur(); updateHeld();
  }
  const tuck = $('tuck');
  tuck.addEventListener('pointerdown', e => {
    e.preventDefault(); if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.add(e.pointerId); updateHeld(); tone(220, 0.035);
  });
  for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) tuck.addEventListener(event, e => { pointers.delete(e.pointerId); updateHeld(); });
  for (const event of ['pointerup', 'pointercancel']) window.addEventListener(event, e => { pointers.delete(e.pointerId); updateHeld(); });
  for (const event of ['touchend', 'touchcancel']) window.addEventListener(event, e => {
    if (event === 'touchcancel' || e.touches.length === 0) { pointers.clear(); updateHeld(); }
  }, { passive: true });
  $('release').addEventListener('pointerdown', e => { e.preventDefault(); release(); });
  $('release').addEventListener('click', e => { if (e.detail === 0) release(); });
  $('retry').addEventListener('click', reset);
  $('debug').addEventListener('click', () => { debug = !debug; $('debug').setAttribute('aria-pressed', String(debug)); $('telemetry').hidden = !debug; });
  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const isTuck = e.code === 'Space' || e.code === 'KeyZ';
    if (e.code === 'Enter' && document.activeElement.tagName === 'BUTTON') return;
    if (isTuck || ['KeyX', 'Enter', 'KeyR'].includes(e.code)) e.preventDefault();
    if (isTuck) { keys.add(e.code); updateHeld(); }
    if (!e.repeat && (e.code === 'KeyX' || e.code === 'Enter')) release();
    if (!e.repeat && e.code === 'KeyR') reset();
  });
  window.addEventListener('keyup', e => { keys.delete(e.code); updateHeld(); });
  window.addEventListener('blur', clearInput); window.addEventListener('pagehide', clearInput);
  document.addEventListener('visibilitychange', () => { clearInput(); lastTime = 0; accumulator = 0; });
  window.addEventListener('resize', () => { clearInput(); resize(); });
  window.addEventListener('contextmenu', e => e.preventDefault());
  function roundRect(x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function line(x1, y1, x2, y2, color, lineWidth) {
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  function text(value, x, y, size, color) { ctx.fillStyle = color; ctx.font = `600 ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`; ctx.fillText(value,x,y); }
  function environment() {
    const left = cameraX - 1400, right = cameraX + 2400;
    ctx.fillStyle = '#edf4fa'; ctx.fillRect(left, cameraY - 1800, right-left, 2400);
    ctx.fillStyle = '#e1ebf4'; ctx.fillRect(left, 256, right-left, 98); line(left,257,right,257,'#d1deeb',2);
    for (let x = Math.floor(left/180)*180; x < right; x += 180) line(x,260,x,354,'#d7e3ef',1);
    ctx.fillStyle = '#d0e0ef'; ctx.fillRect(left,C.groundY,right-left,1400); line(left,C.groundY,right,C.groundY,'#bacfe0',2);
    for (let x = Math.floor(left/120)*120; x < right; x += 120) line(x,C.groundY+1,x-50,430,'#c0d4e6',1);
    line(C.barX-24,C.groundY-4,C.barX-24,C.barHeight+10,'#b4c5d6',13);
    line(C.barX-26,C.groundY-4,C.barX-26,C.barHeight+10,'#f9fcff',4);
    roundRect(C.barX-56,C.groundY-8,66,10,5,'#819bb4'); line(C.barX-24,C.barHeight+10,C.barX,C.barHeight,'#94aabd',10);
    ctx.save();ctx.setLineDash([4,8]);ctx.strokeStyle='#bfd5e5';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(C.barX,C.barHeight,122,0,Math.PI*2);ctx.stroke();ctx.restore();
    roundRect(C.matX-5,C.groundY-3,C.matWidth+10,9,5,'#adc4d8');
    roundRect(C.matX,C.groundY-C.matThickness,C.matWidth,C.matThickness,5,'#08768e');
    roundRect(C.matX,C.groundY-C.matThickness,C.matWidth,8,4,'#21a4bb');
    const mid=C.matX+C.matWidth/2;roundRect(mid-54,C.groundY-C.matThickness,108,6,2,'#94e2e7');
    line(mid,C.groundY-C.matThickness-8,mid,C.groundY-C.matThickness-20,'#389aae',2);
    ctx.textAlign='center';text('着地マット',mid,C.groundY+30,13,'#52718d');ctx.textAlign='left';
  }
  function drawSprite(name,x,y,w,h) { const image=sprites[name];if(image.complete&&image.naturalWidth){ctx.drawImage(image,x,y,w,h);return true;}return false; }
  function gymnast() {
    ctx.save();ctx.translate(state.x,state.y);ctx.rotate(state.angle);
    const t=state.tuck,armX=-7*t,armY=-17,handY=-state.radius;
    ctx.save();ctx.translate(0,14);ctx.rotate(-2.3*t);
    const legScale=C.legLength/Math.hypot(25,689);
    ctx.rotate(Math.atan2(25,689));
    if(!drawSprite('leg',-101*legScale,-92*legScale,320*legScale,850*legScale))line(0,0,0,C.legLength,'#fff',14);ctx.restore();
    if(!drawSprite('body',-20,-46,43,70)){circle(2,-29,15,'#fff');roundRect(-14,-16,28,32,10,'#ec5347');roundRect(-14,8,28,14,5,'#2774b1');}
    ctx.save();ctx.translate(armX,armY);const dx=-armX,dy=handY-armY,length=Math.hypot(dx,dy);
    const armScale=length/Math.hypot(-33,630);ctx.rotate(Math.atan2(dy,dx)-Math.atan2(630,-33));
    if(!drawSprite('arm',-176*armScale,-115*armScale,267*armScale,835*armScale))line(0,0,0,length,'#fff',12);ctx.restore();ctx.restore();
    if(state.phase==='swing'){circle(C.barX,C.barHeight,7,'#59738c');circle(C.barX-2,C.barHeight-2,3,'#eaf5ff');}
  }
  function diagnostics() {
    const p=P.pose(state);ctx.save();ctx.strokeStyle='#ed3ea4';ctx.lineWidth=1;
    for(const [part,r] of [['head',C.headRadius],['torso',C.torsoRadius],['foot',C.footRadius]]){ctx.beginPath();ctx.arc(p[part].x,p[part].y,r,0,Math.PI*2);ctx.stroke();}
    line(p.shoulder.x,p.shoulder.y,p.hand.x,p.hand.y,'#ef359c',1);line(p.hip.x,p.hip.y,p.foot.x,p.foot.y,'#ef359c',1);
    for(const key of ['shoulder','hip','hand'])circle(p[key].x,p[key].y,3,'#f42bb3');
    line(C.barX,C.barHeight,state.x,state.y,'#ef359c',1);line(C.matX,C.groundY-C.matThickness,C.matX+C.matWidth,C.groundY-C.matThickness,'#ec338a',2);ctx.restore();
    $('telemetry').textContent=[`状態: ${state.phase}`,`速度: ${Math.hypot(state.vx,state.vy).toFixed(1)} px/s`,`角速度: ${state.omega.toFixed(2)} rad/s`,
      `鉄棒角度: ${(P.wrap(state.angle)*180/Math.PI).toFixed(1)}°`,`最大振幅: ${(state.amplitude*180/Math.PI).toFixed(1)}°`,`最高高度: ${state.maxHeight.toFixed(2)} m`,
      `空中回転量: ${(state.airRotation/(2*Math.PI)).toFixed(2)}`,`縮み量: ${state.tuck.toFixed(2)}`,`大車輪: ${state.giants}`,`接触: ${state.impact?state.impact.part:'なし'}`].join('\n');
  }
  function showResult() {
    resultTime=performance.now();clearInput();$('tuck').disabled=true;const r=state.result;
    $('grade').textContent=r.grade+(r.grade==='PERFECT'||r.grade==='CRASH'?'!':'');$('grade').style.color=r.grade==='CRASH'?'#dd664e':'#087d99';
    $('reason').textContent=r.reason;$('finalScore').textContent=r.score.toLocaleString('ja-JP');
    $('summary').textContent=`${r.flips}回転 · 最高 ${state.maxHeight.toFixed(1)}m · 飛距離 ${r.distance.toFixed(1)}m`;
    $('score').textContent=r.score.toLocaleString('ja-JP');$('release').disabled=true;tone(r.grade==='CRASH'?100:880,0.25,r.grade==='CRASH'?'triangle':'sine');
    const p=P.pose(state).foot;
    for(let i=0;i<24;i++)particles.push({x:p.x,y:C.groundY-15,vx:(Math.random()-.5)*200,vy:-Math.random()*210,life:1,color:r.grade==='CRASH'?'#9ab3c8':['#ffbe4d','#19a8bd','#ef6952'][i%3]});
  }
  function draw(dt,now) {
    const desiredX=state.phase==='swing'?0:Math.max(state.x-760,Math.min(0,state.x-180)),desiredY=state.phase==='swing'?0:Math.min(0,state.y-90);
    cameraX+=(desiredX-cameraX)*(1-Math.exp(-3*dt));cameraY+=(desiredY-cameraY)*(1-Math.exp(-2*dt));
    const dpr=canvas.width/width;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.translate((width-960*scale)/2,(height-400*scale)/2);ctx.scale(scale,scale);ctx.translate(-cameraX,-cameraY);environment();
    if(state.phase!=='result'&&Math.abs(state.omega)>3){trail.push({x:state.x,y:state.y});if(trail.length>22)trail.shift();}else if(trail.length)trail.shift();
    trail.forEach((p,i)=>circle(p.x,p.y,2+i/12,`rgba(36,137,186,${i/trail.length*.18})`));
    ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#335978';ctx.beginPath();ctx.ellipse(state.x,C.groundY-2,22,4,0,0,Math.PI*2);ctx.fill();ctx.restore();gymnast();
    for(const p of particles){p.life-=dt;p.vy+=300*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life);roundRect(p.x,p.y,5,5,1,p.color);}ctx.globalAlpha=1;
    while(particles.length&&particles[0].life<=0)particles.shift();if(debug)diagnostics();
    if(state.giants>shownGiants){shownGiants=state.giants;$('badge').textContent=`大車輪！ ×${shownGiants}`;badgeUntil=now+1400;tone(880,0.12);}if(now>badgeUntil)$('badge').textContent='';
    $('flips').innerHTML=`${Math.floor(state.airRotation/(2*Math.PI))}<span>回</span>`;$('height').innerHTML=`${state.maxHeight.toFixed(1)}<span>m</span>`;
    const cue=state.phase==='swing'?(state.amplitude>2.9?'大車輪！右上へ向かう瞬間に「離す！」':state.held?'上がったら、ボタンを離して伸びよう':'下を通る直前に縮む → 上がったらボタンを離す'):state.phase==='flight'?'縮んで回る → 着地の前にボタンを離して伸びる':'Rキーでも、すぐにリトライ';
    if($('cue').textContent!==cue)$('cue').textContent=cue;if(state.phase==='result'&&now-resultTime>400)$('result').hidden=false;
  }
  function frame(now) {
    const dt=lastTime?Math.min(C.maxFrame,(now-lastTime)/1000):0;lastTime=now;
    if(!document.hidden){accumulator+=dt;while(accumulator>=C.fixedStep){const phase=state.phase;P.step(state,C.fixedStep);accumulator-=C.fixedStep;if(phase!=='result'&&state.phase==='result')showResult();}draw(dt,now);}
    requestAnimationFrame(frame);
  }
  resize();requestAnimationFrame(frame);
})();
