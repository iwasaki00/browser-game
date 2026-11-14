import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const wave=Number(process.argv[2]);assert.ok([4,5,6].includes(wave));
const folder=`artwork/treasure-wave${wave}`,sheets='src/assets/treasures/sheets',out=`docs/treasure-art-wave${wave}`;
const config=JSON.parse(readFileSync(folder+'/generation.json','utf8')),targets=JSON.parse(readFileSync(folder+'/targets.json','utf8'));
const mapping=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8')),expected=targets.map(e=>e.treasureId);
const priorMap=existsSync(folder+'/map-before.json')?JSON.parse(readFileSync(folder+'/map-before.json','utf8')):mapping.map(e=>({...e}));
const priorIDs=priorMap.filter(e=>e.available).map(e=>e.treasureId);
assert.equal(priorIDs.length,114+(wave-4)*60);assert.equal(expected.length,wave===6?66:60);assert.equal(new Set(expected).size,expected.length);
for(const id of expected)assert.ok(priorMap.some(e=>e.treasureId===id&&!e.available));
const hash=b=>createHash('sha256').update(b).digest('hex'),json=(f,v)=>writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const palettes={
 pale:["424a54","6e7680","9da2a7","c2c5c4","deded8","f4f1e7","fffbed","b0a894","d3cbb7"],
 biotite:["302a2b","49372d","63503b","846a4b","a28a63","c4ac7c","e5d2a2","3c3e42","656764","98998c"],
 jasper:["48313a","704334","95543b","b66a43","cf8e5c","e3b481","f1d2a1","663c35","af6b55","d99b71"],
 flint:["303b48","4f5e6a","73828e","a0adb5","d0d5d0","faf3dc","cfc0a5","a6977f","716857","4d463d"],
 stone:["3c3940","5e5654","80736b","a39889","c5beac","e3dbca","f6efdc","4f6064","7d9294","b5c2be"],
 pegmatite:["373c43","5d646b","83858a","a9aaaa","d3d1c7","f6eddc","88686d","b58c91","d8adb0","efc8c3"],
 conglomerate:["3b373a","5c514b","817268","a3907b","c6b399","ead3af","fbecd0","734c41","a26b52","cb9270","46515e","70818f"],
 specimen:["394349","65756e","90a39a","b7c5b9","e5e9dc","fffbed","4f4325","82703d","af9955","d3bd79","f4e1a0"],
 barnacle:['303b48','52606a','75818a','9ea59f','b9b9a5','f0e0c1','fff1d6','c1a883','998367','725e4e','51453c'],
 steel:['202b40','334258','4d5d76','64768e','7e91a8','9dafc0','becdd5','e4e9e4','faf9e9','694c40','98634b','bb8562'],
 silver:['292c3b','444957','626976','818a97','a0acb6','c1cbd2','e3e6e4','faf9ed','6e665b','9d9481','c1bba4'],
 rust:['362c29','55352c','754332','965636','b9703f','d99558','edbb7b','42494e','677577','9ca6a0','d8d8bd','523e35'],
 pink:['654651','906372','b78598','d3a0b4','e9b7c6','f7cfda','ffe5e7','fff2e8','957a70','c1aa92','e3d2b9'],
 shell:['4f392c','785638','a17347','bd9464','d3b68e','e9cfab','f5e3c5','fff4dd','9b704c','d3a474','fffaf0'],
 coral:['594d43','7c6b59','9e8c75','b8a68b','d1bea0','e9d6b7','f6e8d1','fff8e7','9c8369','c7ad8a'],
 glass:['193f3e','285954','39746a','509082','6ca999','89c2ae','afe0cc','d7f3dd','f2fff0','376963','71988a','abc2a4'],
 blueglass:['17384f','285571','3e7795','589ab6','7db8d1','a5d8e9','d0f0f3','efffff','324659','627c90','9faeb7'],
 copper:['452a25','67382d','8a4932','ab5d39','c97544','e79858','f4bb7b','ffe2ab','856446','ac8760','d7b487'],
 gold:['4f351d','745020','9b681f','bb8529','d8a334','edbd48','f8d56b','ffe69a','fff3c6','cc8c23','e7ab29','fff8de'],
 brass:['3c3c25','62603a','8b7c43','b19b53','d1ba6d','e7d49a','fff0bf','72745a','a1a189','c4c3a5'],
 toolbox:['1e3339','2a4b50','38646a','4e7c80','78a09f','a0b8b0','364052','5d6875','89939a','bbc0b9','eae8d5','fff2d2','6e493a','9b654b','b9825d'],
 quartz:['435b58','637976','819590','a2b2aa','bac8bd','d0d8cf','e4e8df','f3f3e9','fffdf3','9abdc8','d5eaf0'],
 pebble:['403b4a','60556a','8a7086','b48c99','d8b5b4','f1d8ce','81786d','aaa18a','d1c9b1','f1ecd7','af8871'],
 agate:['4b3840','765143','a37658','c59973','e4be99','f4debb','fff2d9','738f91','a2c0be','d5e4d4','8b7976'],
 pinkstone:['51434b','79616d','a47f88','c79d9f','e1bcba','f2d9ce','fff0e0','8a8278','b4ad9b','d6d1bd'],
 greenstone:['293e37','3b5848','587859','78986a','9fb380','c7d0a1','e6e7c4','f6f1d7','5b786e','87a89c','b6cab2'],
 blackstone:['222c32','35434a','4a5c61','647a7e','849799','a9b8b4','d3dad0','eeeede','3d3533','63534a','947859']
};
function protectedFiles(){const r=[];function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name).replaceAll(path.sep,'/');if(e.isDirectory())walk(p);else if(!p.endsWith('.png')&&p!=='src/treasure-sprite-map.json')r.push(p);}}walk('src');return [...r,'package.json','package-lock.json','index.html','vite.config.ts'];}
function snapshot(){if(existsSync(folder+'/baseline.json'))return;mkdirSync(folder+'/before',{recursive:true});json(folder+'/map-before.json',priorMap);const files=readdirSync(sheets).filter(f=>f.endsWith('.png')).sort();assert.equal(files.length,9);for(const f of files)copyFileSync(sheets+'/'+f,folder+'/before/'+f);json(folder+'/baseline.json',{sheets:files,protected:Object.fromEntries(protectedFiles().map(f=>[f,hash(readFileSync(f))]))});}
function fromSource(file,item){const image=PNG.sync.read(readFileSync(file));let x0=image.width,y0=image.height,x1=-1,y1=-1;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.data[(y*image.width+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}assert.ok(x1>x0&&y1>y0);
 const width=x1-x0+1,height=y1-y0+1,scale=Math.min(item.maxBounds[0]/width,item.maxBounds[1]/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),left=Math.floor((32-w)/2),top=Math.floor((32-h)/2),palette=palettes[item.palette];assert.ok(palette);
 const rgb=palette.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16))),rows=Array.from({length:32},()=>Array(32).fill('.'));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(x1,x0+Math.floor((x+.5)*width/w)),sy=Math.min(y1,y0+Math.floor((y+.5)*height/h)),i=(sy*image.width+sx)*4;if(image.data[i+3]<128)continue;let best=0,distance=Infinity;for(let k=0;k<rgb.length;k++){const d=rgb[k].reduce((s,v,j)=>s+(v-image.data[i+j])**2,0);if(d<distance){distance=d;best=k;}}rows[top+y][left+x]=best.toString(16);}
 return {id:item.id,palette,rows:rows.map(r=>r.join('')),sourceSHA256:hash(readFileSync(file)),sourceBounds:{x:x0,y:y0,width,height},pixelBounds:{x:left,y:top,width:w,height:h}};
}
function pixels(){return existsSync(folder+'/pixels.json')?JSON.parse(readFileSync(folder+'/pixels.json','utf8')):[];}
function exportSprites(){mkdirSync(folder+'/sprites',{recursive:true});for(const item of pixels()){const png=new PNG({width:32,height:32});png.data=bufferFor(item);writeFileSync(folder+'/sprites/'+item.id+'.png',PNG.sync.write(png));}}
function bufferFor(item){const b=Buffer.alloc(4096);item.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.')return;const color=item.palette[parseInt(c,16)],i=(y*32+x)*4;for(let k=0;k<3;k++)b[i+k]=parseInt(color.slice(k*2,k*2+2),16);b[i+3]=255;}));return b;}
function cell(p,col,row){const b=Buffer.alloc(4096);for(let y=0;y<32;y++)p.data.copy(b,y*128,((row*32+y)*256+col*32)*4,((row*32+y)*256+col*32+32)*4);return b;}
function apply(field){const items=pixels().filter(e=>!field||e.id[0]===field),groups=new Map();for(const item of items){assert.ok(expected.includes(item.id));const c=mapping.find(e=>e.treasureId===item.id);if(!groups.has(c.sheet))groups.set(c.sheet,[]);groups.get(c.sheet).push({item,c});}for(const [name,list] of groups){const f=sheets+'/'+name+'.png',png=PNG.sync.read(readFileSync(f));assert.equal(png.width,256);assert.equal(png.height,160);for(const {item,c} of list){const b=bufferFor(item);for(let y=0;y<32;y++)b.copy(png.data,((c.row*32+y)*256+c.col*32)*4,y*128,(y+1)*128);}writeFileSync(f,PNG.sync.write(png));}const completed=new Set(pixels().map(e=>e.id));for(const e of mapping)if(expected.includes(e.treasureId))e.available=completed.has(e.treasureId);json('src/treasure-sprite-map.json',mapping);return verify();}
function verify(){const base=JSON.parse(readFileSync(folder+'/baseline.json','utf8')),data=pixels(),details=[];const currentMap=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));assert.equal(currentMap.length,300);for(let i=0;i<300;i++){const a=priorMap[i],b=currentMap[i];assert.deepEqual({...b,available:a.available},a,'map coordinate or metadata changed');assert.equal(b.available,expected.includes(b.treasureId)?data.some(e=>e.id===b.treasureId):a.available);}for(const [f,h] of Object.entries(base.protected))assert.equal(hash(readFileSync(f)),h,'protected source changed '+f);let changed=0,unchanged=0,pending=0;for(const f of base.sheets){const a=PNG.sync.read(readFileSync(folder+'/before/'+f)),b=PNG.sync.read(readFileSync(sheets+'/'+f));assert.equal(b.width,256);assert.equal(b.height,160);for(let row=0;row<5;row++)for(let col=0;col<8;col++){const e=targets.find(e=>e.sheet+'.png'===f&&e.col===col&&e.row===row),old=cell(a,col,row),current=cell(b,col,row);if(!e){assert.ok(old.equals(current),'outside target changed '+f+' '+col+','+row);unchanged++;continue;}const p=data.find(p=>p.id===e.treasureId);if(!p){assert.ok(old.equals(current),'pending target changed '+e.treasureId);pending++;continue;}assert.ok(!old.equals(current));assert.ok(current.equals(bufferFor(p)));let opaque=0;const colors=new Set();for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;assert.ok(current[i+3]===0||current[i+3]===255);if(current[i+3]){assert.ok(x>=2&&x<30&&y>=2&&y<30);opaque++;colors.add(current.subarray(i,i+3).toString('hex'));}}assert.ok(opaque>5&&colors.size<=16);changed++;details.push({...e,available:true,rgbaSHA256:hash(current),opaquePixels:opaque,colors:colors.size});}}
 assert.equal(unchanged,360-expected.length);assert.equal(changed+pending,expected.length);const result={version:JSON.parse(readFileSync('package.json','utf8')).version,comparison:'exact decoded RGBA bytes for all 360 cells',changedCells:changed,pendingTargets:pending,unchangedOutsideTargets:unchanged,nonTargetChangedPixels:0,previousCompletedUnchanged:true,protectedFilesUnchanged:Object.keys(base.protected).length,completed:Object.fromEntries(['B','R','G'].map(f=>[f,details.filter(e=>e.field===f).length])),items:details};mkdirSync(out,{recursive:true});json(out+'/pixel-comparison.json',result);console.log({changed,pending,unchanged,nonTargetChangedPixels:0});return result;}
function progress(){
 const plan=JSON.parse(readFileSync('artwork/treasure-final/plan.json','utf8')),mapNow=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));
 const records=plan.filter(e=>e.lot!=='prior').map(e=>({...e,status:mapNow.find(m=>m.treasureId===e.treasureId).available?'integrated':'pending'}));
 json('artwork/treasure-final/progress.json',{version:JSON.parse(readFileSync('package.json','utf8')).version,updated:new Date().toISOString(),completed:records.filter(e=>e.status==='integrated').length,pending:records.filter(e=>e.status==='pending').length,lots:Object.fromEntries([4,5,6].map(n=>[n,{completed:records.filter(e=>e.lot===n&&e.status==='integrated').length,total:n===6?66:60}])),records});
 const lines=['# TREASURE ART FINAL — 作業進捗','','本資料は制作途中の再開用記録です。完了報告ではありません。','', '既存114点を保持し、第4〜6弾で186点を制作します。Version・仕様・セーブ・図鑑レイアウトは変更しません。','', '| ロット | 組み込み済み | 対象 |','|---|---:|---:|',...[4,5,6].map(n=>'| 第'+n+'弾 | '+records.filter(e=>e.lot===n&&e.status==='integrated').length+' | '+(n===6?66:60)+' |'),'','ID・正式名称・シート・座標・ロットの全件一覧: [TREASURE_ART_FINAL_TARGETS.md](TREASURE_ART_FINAL_TARGETS.md)','','個別の完了ID・残りID: [progress.json](../artwork/treasure-final/progress.json)','','iPhone Safari実機は未確認です。commit・push・公開は行っていません。',''];
 writeFileSync('docs/TREASURE_ART_FINAL.md',lines.join('\n'));
}
const mode=process.argv[3];
if(mode==='ingest'){
 const id=process.argv[4],file=process.argv[5],item=config.items.find(e=>e.id===id);assert.ok(item&&file);snapshot();
 const old=pixels().filter(e=>e.id!==id);const entry=fromSource(file,item);json(folder+'/pixels.json',[...old,entry].sort((a,b)=>expected.indexOf(a.id)-expected.indexOf(b.id)));
 item.sourceFile=path.basename(file);item.sourcePath=file;item.status='completed';json(folder+'/generation.json',config);
 apply(id[0]);exportSprites();progress();
}else if(mode==='apply'){snapshot();apply();exportSprites();}else if(mode==='verify')verify();else if(mode==='snapshot')snapshot();else if(mode==='progress')progress();else throw Error('Use <4/5/6> ingest <id> <file>, apply, verify, snapshot');
