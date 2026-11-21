import fs from 'node:fs';
function edit(file,fn){const old=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),s=fn(old);if(s===old)throw Error('No edit '+file);fs.writeFileSync(file,s);}
edit('src/main.ts',s=>{
 s="import {harvestFeedback} from './harvest-feedback';\nimport {paintHarvestFeedback} from './harvest-feedback-view';\n"+s;
 s=s.replace("import './discovery.css';","import './discovery.css';\nimport './harvest-feedback.css';");
 s=s.replace("function positionToast(){", "let fieldVisible=true,feedbackPlot:ReturnType<typeof plot>|undefined;const fieldObserver=new IntersectionObserver(entries=>{fieldVisible=entries[0].isIntersecting;if(!fieldVisible)harvestFeedback.clearField();});fieldObserver.observe(canvas);const harvestMotion=window.matchMedia('(prefers-reduced-motion: reduce)');const syncHarvestMotion=()=>{harvestFeedback.motion=!harvestMotion.matches;harvestFeedback.clearField();};syncHarvestMotion();harvestMotion.addEventListener('change',syncHarvestMotion);\nfunction positionToast(){");
 s=s.replace("if(effects(state)==='off')return;const p=project(x,y);", "if(effects(state)==='off'||!harvestFeedback.motion)return;const p=project(x,y);");
 s=s.replaceAll('drawDebug?.(ctx);','paintHarvestFeedback(ctx,performance.now(),effects(state));drawDebug?.(ctx);');
 s=s.replace('if(isRiver(state)){riverTick(state,dt);renderRiver','if(isRiver(state)){renderRiver');
 s=s.replace("visualTime+=dt;if(pointer!==null)","visualTime+=dt;if(feedbackPlot!==plot(state)){harvestFeedback.reset();feedbackPlot=plot(state);}if(pointer!==null)");
 const old="if(DEBUG_AVAILABLE){const start=performance.now();draw(dt);renderSamples.push(performance.now()-start);if(renderSamples.length>300)renderSamples.shift();}else draw(dt);";
 if(!s.includes(old))throw Error('frame missing');
 s=s.replace(old,"if(isRiver(state))riverTick(state,dt);const drawField=fieldVisible&&$('#overlay').hidden;harvestFeedback.frame(drawField);if(drawField){"+old+"}else{harvestFeedback.clearField();particles.length=0;}");
 s=s.replace("if(document.hidden&&running){emergencySave", "if(document.hidden){harvestFeedback.clearField();particles.length=0;}if(document.hidden&&running){emergencySave");
 s=s.replace("getRenderSamples:()=>[...renderSamples],", "getRenderSamples:()=>[...renderSamples],getHarvestDiagnostics:()=>({...harvestFeedback.stats(performance.now()),particles:particles.length,fieldVisible}),");
 s=s.replace("dev.openDebugLab({wash,book:","dev.openDebugLab({harvest:{enabled:()=>harvestFeedback.enabled,set:on=>harvestFeedback.setEnabled(on),stats:()=>harvestFeedback.stats(performance.now()),reset:()=>{harvestFeedback.resetMetrics();renderSamples.length=0;}},wash,book:");
 s=s.replace("const old=[...state.unlockedTools],amount=digForTime(state,active,x,y,seconds),after=depthAt(p,x,y);", "const old=[...state.unlockedTools];if(harvestFeedback.allowed(effects(state)))harvestFeedback.prepareBeach(p);const amount=digForTime(state,active,x,y,seconds),after=depthAt(p,x,y);");
 s=s.replace("if(amount){lastWork=state.playTime;", "if(amount){if(harvestFeedback.allowed(effects(state)))harvestFeedback.dug(p,x,y,performance.now(),amount);lastWork=state.playTime;");
 s=s.replace("if(r.recovered){tone();toast(r.reason);void persist();}else if(!r.ok&&r.reason!==fieldNotice)", "if(harvestFeedback.allowed(effects(state))){const text=r.recovered?'回収完了':state.riverSession?.uid?Math.round(state.riverSession.progress*100)+'%':'条件を確認';if($('#signal').textContent!==text)$('#signal').textContent=text;}if(r.recovered){tone();if(harvestFeedback.allowed(effects(state)))harvestFeedback.pulse('recovered',180,278,performance.now());else toast(r.reason);void persist();}else if(!r.ok&&r.reason!==fieldNotice)");
 s=s.replace("$('#hint').textContent=result.reason;toast(result.reason);}else toast('岸から", "$('#hint').textContent=result.reason;if(!result.ok||!harvestFeedback.allowed(effects(state)))toast(result.reason);}else toast('岸から");
 return s;
});
edit('src/river-view.ts',s=>{
 s="import {harvestFeedback,riverVisualPoint} from './harvest-feedback';\nimport {effects} from './experience';\n"+s;
 s=s.replace("const p=s.explorationAreas[0];", "const p=s.explorationAreas[0],r=s.riverSession,enhanced=harvestFeedback.allowed(effects(s));");
 s=s.replace("if(f.state!=='buried')continue;", "if(f.state!=='buried'||enhanced&&r?.uid===f.uid)continue;");
 s=s.replace('const r=s.riverSession,c=riverCapabilities','const c=riverCapabilities');
 s=s.replace('const flight=Math.min(1,r.elapsed/.45),progress=r.progress;', 'const progress=r.progress;');
 s=s.replace('const q=project(r.originX+(r.x-r.originX)*flight*(1-progress),r.originY+(r.y-r.originY)*flight*(1-progress));', "const at=riverVisualPoint(r),q=project(at.x,at.y);if(enhanced&&r.uid){ctx.fillStyle='#344d47';ctx.beginPath();ctx.ellipse(q.x,q.y,8,4,-.3,0,Math.PI*2);ctx.fill();}");
 return s;
});
edit('src/gold-ui.ts',s=>{
 s="import {harvestFeedback,panBulkScale} from './harvest-feedback';\nimport {effects} from './experience';\n"+s;
 s=s.replace("const input=new DigInput();", "let captureTimer=0;const input=new DigInput();");
 s=s.replace('<div id="pan-grains" class="pan-grains"></div>', '<div id="pan-grains" class="pan-grains"></div><span id="grain-capture-pulse" class="grain-capture-pulse" aria-hidden="true" hidden></span>');
 s=s.replace(' function render(){if(!live)return;', ` function renderSand(){const b=batch(),w=s.goldWork,active=!!w&&w.batchId===batchId,progress=active?Math.min(1,w.work/w.required):0,enhanced=harvestFeedback.allowed(effects(s));const scale=enhanced?panBulkScale(b,w):active?1-progress*.83:b&&b.processed>=b.amount?.15:.85;const value=\`translate(-50%,-50%) translate(\${sway.x}px,\${sway.y}px) scale(\${scale})\`;if(el('pan-sand').style.transform!==value){el('pan-sand').style.transform=value;if(enhanced)harvestFeedback.panWrite();}el('pan-sand').style.opacity=b?'1':'0';el('pan-bowl').dataset.harvestMotion=harvestFeedback.motion&&effects(s)==='full'?'move':'still';}
 function capture(button:HTMLButtonElement){if(!harvestFeedback.allowed(effects(s)))return;const pulse=el('grain-capture-pulse');clearTimeout(captureTimer);pulse.style.left=button.style.left;pulse.style.top=button.style.top;pulse.hidden=false;pulse.style.animation='none';void pulse.offsetWidth;pulse.style.animation='';harvestFeedback.grainActive=1;captureTimer=window.setTimeout(()=>{pulse.hidden=true;harvestFeedback.grainActive=0;},450);}
 function render(){if(!live||document.hidden||!root.isConnected)return;`);
 const a=s.indexOf("el('pan-sand').style.transform=`"),b=s.indexOf(";\n",a);
 if(a<0||b<0)throw Error('sand expression missing');
 s=s.slice(0,a)+'renderSand()'+s.slice(b);
 s=s.replace("const result=collectGrain(s,batchId,uid,selected);el('grain-info')", "const result=collectGrain(s,batchId,uid,selected);if(result)capture(button);el('grain-info')");
 s=s.replace('if(pointer!==null)input.step(now,advance);', 'if(pointer!==null){input.step(now,advance);if(harvestFeedback.allowed(effects(s)))renderSand();}');
 s=s.replace("const hidden=()=>{if(document.hidden)stopWork();};", "const hidden=()=>{if(document.hidden){stopWork();clearTimeout(captureTimer);el('grain-capture-pulse').hidden=true;harvestFeedback.grainActive=0;}};");
 s=s.replace('return()=>{live=false;cancelAnimationFrame(raf);', 'return()=>{live=false;clearTimeout(captureTimer);harvestFeedback.grainActive=0;cancelAnimationFrame(raf);');
 return s;
});
