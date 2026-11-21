const frame=document.getElementById('app'),run=document.getElementById('run'),out=document.getElementById('results');
frame.addEventListener('load',()=>{run.disabled=false;});
run.addEventListener('click',async()=>{
  run.disabled=true;const results=[];
  const win=frame.contentWindow,doc=frame.contentDocument,get=id=>doc.getElementById(id);
  const tick=()=>new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));
  const assert=(value,message)=>{if(!value)throw Error(message);};
  function hit(id){const el=get(id),r=el.getBoundingClientRect();assert(r.width>0&&r.left>=-1&&r.right<=win.innerWidth+1&&r.top>=-1&&r.bottom<=win.innerHeight+1,`${id} is outside viewport`);assert(el.contains(doc.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),`${id} cannot be hit`);}
  try{
    for(const [width,height]of[[390,844],[375,667],[390,712],[375,535]]){
      frame.style.width=width+'px';frame.style.height=height+'px';await tick();
      get('mode-free').click();get('tools-open').click();get('tool-trace').click();await tick();
      for(const id of ['settings-open','collapse','reassemble','reset','image-open','size-open','gravity-open','tools-open'])hit(id);
      assert(doc.documentElement.scrollWidth<=win.innerWidth,'horizontal overflow');
      const a=get('app').getBoundingClientRect(),c=get('sand').getBoundingClientRect();
      const before=get('sand').toDataURL(),count=get('total').textContent;
      get('tools-open').click();await tick();
      for(const id of ['trace-force-weak','trace-force-standard','trace-force-strong','trace-size-small','trace-size-medium','trace-size-large','tools-close'])hit(id);
      get('trace-force-strong').click();get('trace-size-large').click();get('tools-close').click();
      assert(get('sand').toDataURL()===before&&get('total').textContent===count,'settings regenerated grains');
      assert(get('tools-open').textContent.includes('強・太'),'selected values missing');
      get('settings-open').click();get('settings-panel').querySelector('.panel-body').scrollTop=10000;await tick();hit('settings-close');get('settings-close').click();
      results.push({width,height,app:{width:a.width,height:a.height,left:a.left},canvas:{cssWidth:c.width,cssHeight:c.height,left:c.left,gridWidth:get('sand').width,gridHeight:get('sand').height},visualViewport:{width:win.visualViewport?.width,scale:win.visualViewport?.scale,offsetLeft:win.visualViewport?.offsetLeft},scrollWidth:doc.documentElement.scrollWidth,quickSettingsVisible:true,statePreserved:true});
    }
    out.textContent=JSON.stringify({version:'0.6.4',userAgent:navigator.userAgent,results},null,2);
  }catch(error){out.textContent='FAILED: '+error.stack+'\n'+JSON.stringify(results);}
  finally{run.disabled=false;}
});
