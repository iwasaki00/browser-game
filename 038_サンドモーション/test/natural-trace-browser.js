import { PathEngine } from '../src/paths.js';
import { TraceV063Engine } from '../scripts/fixtures/trace-v0.6.3.mjs';
import { naturalFixture, naturalRaster, referenceStroke, referenceMetrics, referenceSheet } from './natural-reference.js';
const $ = id => document.getElementById(id), wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, why) => { if (!value) throw new Error(why); };
$('run').addEventListener('click', async () => {
  $('run').disabled = true;
  const report = { version: '0.6.4', userAgent: navigator.userAgent,
    environment: 'Real Canvas and app iframe, synthetic PointerEvents with capture adapter; no Safari/iPhone claim',
    references: [], app: [], layouts: [] }, images = {};
  const win = $('app').contentWindow, doc = $('app').contentDocument, get = id => doc.getElementById(id), canvas = get('sand');
  const captureMethods = ['setPointerCapture','hasPointerCapture','releasePointerCapture'], originals = captureMethods.map(name => canvas[name]);
  let capture = null;
  canvas.setPointerCapture = id => { capture = id; }; canvas.hasPointerCapture = id => capture === id; canvas.releasePointerCapture = () => { capture = null; };
  const choose = name => { get('tools-open').click(); get('tool-' + name).click(); };
  const stroke = () => {
    const rect = canvas.getBoundingClientRect(), start = win.performance.now();
    for (const [type, x, elapsed] of [['pointerdown',.3,0],['pointermove',.7,800],['pointerup',.7,800]]) {
      const event = new win.PointerEvent(type, { bubbles:true, cancelable:true, pointerId:43, pointerType:'touch',button:0,
        clientX:rect.left+rect.width*x,clientY:rect.top+rect.height*.4 });
      Object.defineProperty(event,'timeStamp',{value:start+elapsed}); canvas.dispatchEvent(event);
    }
  };
  function visible() {
    const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let n=0; for(let i=3;i<pixels.length;i+=4)if(pixels[i])n++; return n;
  }
  try {
    for (const [quality,w,h] of [['standard',180,300],['high',270,450]]) {
      $('status').textContent = quality + '：比較描画';
      for (const previous of [true,false]) {
        const engine = naturalFixture(previous ? TraceV063Engine : PathEngine,w,h), frames=[naturalRaster(engine)], samples=[{stroke:0,...referenceMetrics(engine,undefined,previous?4:6)}], times=[];
        engine.beginTrace();
        for(let i=1;i<=30;i++) {
          const start=performance.now(); engine.traceSegment(w*.3,h*.45,w*.7,h*.45,(previous?3:5)*w/180,800,'standard'); times.push(performance.now()-start); engine.assertIntegrity();
          if([1,10,30].includes(i)){frames.push(naturalRaster(engine));samples.push({stroke:i,...referenceMetrics(engine,undefined,previous?4:6)});}
        }
        const c=document.createElement('canvas');c.width=w*4;c.height=h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(referenceSheet(w,h,frames)),w*4,h),0,0);
        const label=document.createElement('p');label.textContent=quality+(previous?' v0.6.3':' v0.6.4')+'：初期／1回／10回／30回';$('comparisons').append(label,c);
        images[`browser-${quality}-${previous?'before':'after'}`]=c.toDataURL();times.sort((a,b)=>a-b);
        report.references.push({quality,version:previous?'0.6.3':'0.6.4',cpuMedianMs:times[15],cpuP95Ms:times[28],samples});
      }
      $('status').textContent=quality+'：実アプリ入力';
      choose('sand');get('quality').value=quality;get('quality').dispatchEvent(new win.Event('change'));
      const fixture=doc.createElement('canvas');fixture.width=600;fixture.height=700;
      const ctx=fixture.getContext('2d');ctx.fillStyle='#db8c50';ctx.fillRect(0,0,600,350);ctx.fillStyle='#3f8cc0';ctx.fillRect(0,350,600,350);
      const blob=await new Promise(resolve=>fixture.toBlob(resolve)), transfer=new win.DataTransfer(), filename=`natural-${quality}.png`;
      transfer.items.add(new win.File([blob],filename,{type:'image/png'}));get('image-file').files=transfer.files;get('image-file').dispatchEvent(new win.Event('change'));
      const loading=performance.now();while(get('source-name').textContent!==filename){assert(performance.now()-loading<10000,'画像読込失敗');await wait(20);}
      choose('trace');assert(get('gravity-open').textContent==='重力なし','重力表示');
      const count=Number(get('total').textContent.replaceAll(',','')), initial=canvas.toDataURL(), imported=visible(), samples=[{stroke:0,total:count,visible:imported}];
      assert(imported===count,'初期可視数');images[`browser-app-${quality}-0`]=initial;
      const start=performance.now();
      for(let i=1;i<=30;i++) {
        stroke();assert(visible()===count,'実Canvasの可視粒子減少');
        if([1,10,30].includes(i)){samples.push({stroke:i,total:count,visible:visible()});images[`browser-app-${quality}-${i}`]=canvas.toDataURL();}
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      const elapsedMs=performance.now()-start, still=canvas.toDataURL();await wait(250);assert(canvas.toDataURL()===still,'指離し後に移動');
      get('tools-open').click();get('trace-size-large').click();get('trace-force-strong').click();get('tools-close').click();
      assert(canvas.toDataURL()===still,'設定で配置再生成');get('tools-open').click();get('trace-size-medium').click();get('trace-force-standard').click();get('tools-close').click();
      get('mode-hourglass').click();assert(get('tools-open').hidden,'砂時計に道具');get('mode-free').click();assert(canvas.toDataURL()===still,'往復で状態変化');
      get('reassemble').click();const returning=performance.now();while(canvas.dataset.reassembling==='true'){assert(performance.now()-returning<6000,'復元timeout');await wait(30);}
      assert(canvas.toDataURL()===initial,'復元不一致');stroke();get('reset').click();assert(canvas.toDataURL()===initial,'リセット不一致');
      report.app.push({quality,count,samples,thirtyFramesMs:elapsedMs,inputFramesPerSecond:30*1000/elapsedMs,still:true,resetExact:true,returnExact:true,settingsAndModesPreserved:true});
    }
    for(const [width,height] of [[390,844],[375,667],[390,712],[375,535]]) {
      $('app').style.width=width+'px';$('app').style.height=height+'px';await wait(70);
      for(const id of ['settings-open','collapse','reassemble','reset','image-open','size-open','gravity-open','tools-open']) {
        const rect=get(id).getBoundingClientRect();assert(rect.left>=0&&rect.right<=width&&rect.top>=0&&rect.bottom<=height,id+'画面外');
      }
      assert(doc.documentElement.scrollWidth<=width,'横はみ出し');
      get('settings-open').click();get('settings-panel').querySelector('.panel-body').scrollTop=10000;const close=get('settings-close').getBoundingClientRect();assert(close.top>=0&&close.bottom<=height,'設定を閉じられない');get('settings-close').click();
      report.layouts.push({width,height,buttonsVisible:true,settingsCloseVisible:true,scrollWidth:doc.documentElement.scrollWidth});
    }
    assert(!document.hidden,'前面タブで再実行');
    const response=await fetch('/__qa/flow-trace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...report,images})});assert(response.ok,'結果保存失敗');
    $('status').textContent='完了：実ブラウザ検証成功';$('results').textContent=JSON.stringify(report,null,2);
  }catch(error){$('status').textContent='失敗：'+error.message;$('results').textContent=error.stack;}
  finally{captureMethods.forEach((name,i)=>{canvas[name]=originals[i];});$('run').disabled=false;}
});
