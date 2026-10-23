import{drawOrbitArt,canvasPng,artFilename,canShareImage}from'./orbit-art.js';
const aborted=()=>new DOMException('画像作成を中止しました。','AbortError');
export async function renderArtBlob(record,{shape='square',text=true,background='space',preview=false}={},signal){
 const width=preview?360:1080,height=shape==='portrait'?width*16/9:width;
 if(signal?.aborted)throw aborted();
 if(typeof Worker!=='undefined'&&typeof OffscreenCanvas!=='undefined'){
  try{return await new Promise((resolve,reject)=>{
   let worker;try{worker=new Worker(new URL('./orbit-art-worker.js',import.meta.url),{type:'module'});}catch(error){error.workerUnavailable=true;reject(error);return;}
   const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',cancel);};
   const cancel=()=>{cleanup();reject(aborted());};signal?.addEventListener('abort',cancel,{once:true});
   worker.onmessage=({data})=>{cleanup();if(data.error){const error=Error(data.error);error.workerUnavailable=Boolean(data.unavailable);reject(error);}else resolve(data.blob);};
   worker.onerror=()=>{cleanup();const error=Error('画像用Workerが利用できません。');error.workerUnavailable=true;reject(error);};
   try{worker.postMessage({record,width,height,options:{text,background}});}catch(error){cleanup();reject(error);}
  });}catch(error){if(!error.workerUnavailable)throw error;}
 }
 let canvas;
 try{
  canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const yieldTask=async()=>{await new Promise(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw aborted();};
  await yieldTask();await drawOrbitArt(canvas,record,{text,background},yieldTask);const blob=await canvasPng(canvas);if(signal?.aborted)throw aborted();return blob;
 }finally{if(canvas){canvas.width=1;canvas.height=1;}}
}
export function createOrbitShareUI({getRecord,onEnter,onExit}){
 const $=s=>document.querySelector(s);let controller=null,previewUrl=null,fullUrl=null,blob=null,record=null,version=0;
 const message=text=>{$('#artMessage').textContent=text;};
 function release(){controller?.abort();controller=null;version++;for(const url of [previewUrl,fullUrl])if(url)URL.revokeObjectURL(url);previewUrl=fullUrl=null;blob=null;$('#artPreview').removeAttribute('src');$('#artOpenImage').removeAttribute('href');$('#artOpenImage').hidden=true;$('#artSave').disabled=$('#artShare').disabled=true;}
 function options(){return{shape:$('#artShape').value,text:$('#artText').checked,background:$('#artBackground').value};}
 async function preview(){
  release();const job=version;controller=new AbortController();$('#artGenerate').disabled=true;message('プレビューを作成しています…');
  try{const image=await renderArtBlob(record,{...options(),preview:true},controller.signal);if(job!==version)return;previewUrl=URL.createObjectURL(image);$('#artPreview').src=previewUrl;message('構図を確認して「画像作成」を押してください。');}
  catch(error){if(error.name!=='AbortError')message('プレビューを作成できません。設定を変えてもう一度お試しください。');}
  finally{if(job===version)$('#artGenerate').disabled=false;}
 }
 $('#openArt').addEventListener('click',()=>{record=getRecord();if(!record)return;onEnter();$('#galleryPlayer').hidden=true;$('#artView').hidden=false;void preview();});
 $('#artBack').addEventListener('click',()=>{release();$('#artView').hidden=true;$('#galleryPlayer').hidden=false;onExit();});
 for(const id of ['artShape','artText','artBackground'])$('#'+id).addEventListener('change',()=>void preview());
 $('#artGenerate').addEventListener('click',async()=>{
  release();const job=version;controller=new AbortController();$('#artGenerate').disabled=true;message('PNG画像を作成しています…');
  try{const image=await renderArtBlob(record,options(),controller.signal);if(job!==version)return;blob=image;fullUrl=URL.createObjectURL(blob);$('#artPreview').src=fullUrl;
   $('#artOpenImage').href=fullUrl;$('#artOpenImage').hidden=false;$('#artSave').disabled=$('#artShare').disabled=false;message('PNGを作成しました。保存または共有できます。');
  }catch(error){if(error.name!=='AbortError')message('画像を作成できません。再試行するか、正方形をお試しください。元の記録は変更されません。');}
  finally{if(job===version)$('#artGenerate').disabled=false;}
 });
 $('#artSave').addEventListener('click',()=>{if(!blob||!fullUrl)return;const link=document.createElement('a');link.href=fullUrl;link.download=artFilename(record);document.body.append(link);link.click();link.remove();message('保存を開始しました。保存できない場合は「画像を開く」から長押ししてください。');});
 $('#artShare').addEventListener('click',async()=>{
  if(!blob)return;const file=new File([blob],artFilename(record),{type:'image/png'});
  if(!canShareImage(navigator,file)){message('この環境では画像共有を利用できません。「画像保存」または「画像を開く」をお使いください。');return;}
  try{await navigator.share({files:[file],title:'ORBIT MAKER'});message('共有操作を終了しました。');}
  catch(error){message(error.name==='AbortError'?'共有をキャンセルしました。':'共有できません。「画像保存」または「画像を開く」をお使いください。');}
 });
 return{dispose(){release();$('#artView').hidden=true;record=null;}};
}
