import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
// Development-only PNG codec already bundled with the installed Playwright.
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const folder='artwork/treasure-wave1',sheets='src/assets/treasures/sheets',out='docs/treasure-art-wave1';
const config=JSON.parse(readFileSync(folder+'/generation.json','utf8'));
const mapping=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));
const expected=['B001','B007','B011','B012','R002','R004','R005','R007','G001','G003','G007','G012'];
assert.deepEqual(config.items.map(e=>e.id),expected);
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const palette={
 steel:['202b40','334258','4d5d76','64768e','7e91a8','9dafc0','becdd5','e4e9e4','faf9e9','694c40','98634b','bb8562'],
 watch:['142339','203757','2f5084','446fa4','7098bd','a0bdd8','48556b','707e95','a6b1c2','d3dbe4','f1f2ed','fffdf0'],
 cap:['263b36','40534c','60736b','7e9186','9eafa0','bac8b6','d6ddc9','f3f3dd','674a37','986248','bc805a'],
 medal:['422c25','63402c','865333','a76d3c','c88b4d','e4ad62','f2cc85','fff0bb','626547','808263'],
 gold:['4f351d','745020','9b681f','bb8529','d8a334','edbd48','f8d56b','ffe69a','fff3c6','cc8c23','e7ab29','fff8de'],
 quartz:['435b58','637976','819590','a2b2aa','bac8bd','d0d8cf','e4e8df','f3f3e9','fffdf3'],
 pyrite:['393b24','525336','727049','918556','b2a064','cebb7a','e8d99c','fff2c3','a99458','625834'],
 toolbox:['1e3339','2a4b50','38646a','4e7c80','78a09f','a0b8b0','364052','5d6875','89939a','bbc0b9','eae8d5','fff2d2','6e493a','9b654b','b9825d']
};
const paletteFor=id=>palette[id==='B001'?'cap':id==='B007'?'medal':id==='B012'?'watch':id==='B011'||id==='G007'||id==='G012'?'gold':id==='G001'?'quartz':id==='G003'?'pyrite':id==='R007'?'toolbox':'steel'];
function rgbaCell(png,col,row){const b=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)png.data.copy(b,y*128,((row*32+y)*256+col*32)*4,((row*32+y)*256+col*32+32)*4);return b;}
function protectedFiles(){const result=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name).replaceAll(path.sep,'/');if(e.isDirectory())walk(p);else if(!p.endsWith('.png'))result.push(p);}}walk('src');return [...result,'package.json','package-lock.json','index.html','vite.config.ts'];}
function pixelsFromSource(file,item){
 const image=PNG.sync.read(readFileSync(file));let x0=image.width,y0=image.height,x1=-1,y1=-1;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 assert.ok(x1>x0&&y1>y0,item.id+' has opaque subject');
 const width=x1-x0+1,height=y1-y0+1,scale=Math.min(item.maxBounds[0]/width,item.maxBounds[1]/height);
 const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),left=Math.floor((32-w)/2),top=Math.floor((32-h)/2);
 const colors=paletteFor(item.id),rgb=colors.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)));
 const rows=Array.from({length:32},()=>Array(32).fill('.'));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=Math.min(x1,x0+Math.floor((x+.5)*width/w)),sy=Math.min(y1,y0+Math.floor((y+.5)*height/h)),i=(sy*image.width+sx)*4;
  if(image.data[i+3]<128)continue;
  let best=0,distance=Infinity;for(let k=0;k<rgb.length;k++){const d=rgb[k].reduce((sum,v,j)=>sum+(v-image.data[i+j])**2,0);if(d<distance){distance=d;best=k;}}
  rows[top+y][left+x]=best.toString(16);
 }
 return {id:item.id,palette:colors,rows:rows.map(row=>row.join('')),sourceSHA256:hash(readFileSync(file)),sourceBounds:{x:x0,y:y0,width,height},pixelBounds:{x:left,y:top,width:w,height:h}};
}
function bufferFor(item){const b=Buffer.alloc(4096);item.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.')return;const rgb=item.palette[parseInt(c,16)],i=(y*32+x)*4;for(let j=0;j<3;j++)b[i+j]=parseInt(rgb.slice(j*2,j*2+2),16);b[i+3]=255;}));return b;}
function apply(){
 const pixels=JSON.parse(readFileSync(folder+'/pixels.json','utf8'));assert.deepEqual(pixels.map(e=>e.id),expected);
 const replacements=new Map();for(const item of pixels){const cell=mapping.find(e=>e.treasureId===item.id);assert.ok(cell?.available&&cell.size===32);if(!replacements.has(cell.sheet))replacements.set(cell.sheet,[]);replacements.get(cell.sheet).push({cell,item});}
 for(const [sheet,items] of replacements){const file=sheet+'.png',png=PNG.sync.read(readFileSync(sheets+'/'+file));assert.equal(png.width,256);assert.equal(png.height,160);
  for(const {cell,item} of items){const pixels=bufferFor(item);for(let y=0;y<32;y++)pixels.copy(png.data,((cell.row*32+y)*256+cell.col*32)*4,y*128,(y+1)*128);}
  writeFileSync(sheets+'/'+file,PNG.sync.write(png));
 }
 return verify();
}
function verify(){
 const baseline=JSON.parse(readFileSync(folder+'/baseline.json','utf8')),details=[],pixelData=JSON.parse(readFileSync(folder+'/pixels.json','utf8'));
 for(const [file,sha] of Object.entries(baseline.protected))assert.equal(hash(readFileSync(file)),sha,'protected file changed: '+file);
 let changed=0,unchanged=0;for(const file of baseline.sheets){const before=PNG.sync.read(readFileSync(folder+'/before/'+file)),after=PNG.sync.read(readFileSync(sheets+'/'+file));assert.equal(after.width,256);assert.equal(after.height,160);
  for(let row=0;row<5;row++)for(let col=0;col<8;col++){
   const entry=mapping.find(e=>e.sheet+'.png'===file&&e.row===row&&e.col===col),selected=entry&&expected.includes(entry.treasureId);
   const a=rgbaCell(before,col,row),b=rgbaCell(after,col,row),equal=a.equals(b);
   if(selected){assert.ok(!equal,entry.treasureId+' must be replaced');assert.ok(b.equals(bufferFor(pixelData.find(p=>p.id===entry.treasureId))));
    let opaquePixels=0;const colors=new Set();for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;assert.ok(b[i+3]===0||b[i+3]===255,'pixel art uses hard alpha');if(b[i+3]){assert.ok(x>=2&&x<30&&y>=2&&y<30,'2px transparent margin');opaquePixels++;colors.add(b.subarray(i,i+3).toString('hex'));}}
    assert.ok(opaquePixels>5);assert.ok(colors.size<=16);changed++;details.push({...entry,rgbaSHA256:hash(b),opaquePixels,colors:colors.size,transparentMarginAtLeast:2});}
   else{assert.ok(equal,'unexpected pixel change: '+file+' '+col+','+row);unchanged++;}
  }
 }
 assert.equal(changed,12);assert.equal(unchanged,348);
 const report={version:JSON.parse(readFileSync('package.json','utf8')).version,comparison:'exact decoded RGBA bytes per cell, no whole-file hash shortcut',sheets:9,changedCells:changed,unchangedCells:unchanged,nonTargetChangedPixels:0,protectedFiles:Object.keys(baseline.protected).length,protectedUnchanged:true,items:details};
 mkdirSync(out,{recursive:true});json(out+'/pixel-comparison.json',report);console.log({changed,unchanged,nonTargetChangedPixels:0,protectedUnchanged:true});return report;
}
const mode=process.argv[2];
if(mode==='import'){
 assert.ok(process.argv[3],'provide generated image directory');assert.ok(!existsSync(folder+'/baseline.json'),'baseline already exists; use apply/verify to preserve evidence');
 mkdirSync(folder+'/before',{recursive:true});const sheetFiles=readdirSync(sheets).filter(f=>f.endsWith('.png')).sort();assert.equal(sheetFiles.length,9);
 for(const f of sheetFiles)copyFileSync(sheets+'/'+f,folder+'/before/'+f);
 json(folder+'/baseline.json',{sheets:sheetFiles,protected:Object.fromEntries(protectedFiles().map(f=>[f,hash(readFileSync(f))]))});
 json(folder+'/pixels.json',config.items.map(item=>pixelsFromSource(path.join(process.argv[3],item.sourceFile),item)));
 apply();
}else if(mode==='refresh'){
 const item=config.items.find(e=>e.id===process.argv[3]);assert.ok(item&&process.argv[4]);
 const pixels=JSON.parse(readFileSync(folder+'/pixels.json','utf8'));pixels[pixels.findIndex(e=>e.id===item.id)]=pixelsFromSource(path.join(process.argv[4],item.sourceFile),item);json(folder+'/pixels.json',pixels);apply();
}else if(mode==='apply')apply();else if(mode==='verify')verify();else throw Error('Choose import <source directory>, refresh <ID> <source directory>, apply, or verify');
