import{drawOrbitArt,canvasPng}from'./orbit-art.js';
self.onmessage=async({data})=>{let canvas;
 try{canvas=new OffscreenCanvas(data.width,data.height);if(!canvas.getContext('2d')){self.postMessage({error:'Worker Canvas unavailable',unavailable:true});return;}await drawOrbitArt(canvas,data.record,data.options);const blob=await canvasPng(canvas);self.postMessage({blob});}
 catch(error){self.postMessage({error:error.message});}
 finally{if(canvas){canvas.width=1;canvas.height=1;}self.close();}
};
