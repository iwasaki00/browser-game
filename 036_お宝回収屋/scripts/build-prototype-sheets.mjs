import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto(process.env.BASE_URL??'http://localhost:5176');
 const sheets=await page.evaluate(async()=>{
  const {treasureFallbackSVG}=await import('/src/reveal.ts');
  const {treasureSpriteMap,SHEET_NAMES}=await import('/src/treasure-sprite-map.ts');
  const result=[];
  for(const name of SHEET_NAMES){
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=160;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   for(const entry of Object.values(treasureSpriteMap).filter(e=>e.sheet===name&&e.available)){
    const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(treasureFallbackSVG(entry.treasureId));
    await img.decode();ctx.drawImage(img,entry.col*32,entry.row*32,32,32);
   }
   result.push({name,data:canvas.toDataURL('image/png')});
  }
  return result;
 });
 mkdirSync('src/assets/treasures/sheets',{recursive:true});
 for(const sheet of sheets)writeFileSync('src/assets/treasures/sheets/'+sheet.name+'.png',Buffer.from(sheet.data.split(',')[1],'base64'));
 console.log(JSON.stringify({sheets:sheets.length,prototypeCount:54,cellSize:32,width:256,height:160}));
}finally{await browser.close();}
