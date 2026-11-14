import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {treasure} from '../src/data.ts';
const require=createRequire(import.meta.url),{PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
const field=process.argv[2]??'B',targets=[];
const original=JSON.parse(readFileSync('artwork/treasure-final/map-before.json','utf8'));
const mapping=JSON.parse(readFileSync('src/treasure-sprite-map.json','utf8'));
const groups={B:[['B001','B007','B046','B047','B049','B051'],['B043','B055','B059','B064'],['B036','B079','B086','B088']],R:[['R016','R017'],['R004','R025','R026','R056'],['R028','R036','R073','R096']],G:[['G007','G098','G089','G090','G091','G100'],['G003','G049','G052'],['G016','G017','G018']]};
const ids=groups[field].flat();
const references=[];
function tile(id,silhouette=false){
 const e=mapping.find(e=>e.treasureId===id),sheet=PNG.sync.read(readFileSync('src/assets/treasures/sheets/'+e.sheet+'.png')),png=new PNG({width:32,height:32});
 for(let y=0;y<32;y++)sheet.data.copy(png.data,y*128,((e.row*32+y)*256+e.col*32)*4,((e.row*32+y)*256+e.col*32+32)*4);
 if(silhouette)for(let i=0;i<png.data.length;i+=4)if(png.data[i+3]){png.data[i]=47;png.data[i+1]=57;png.data[i+2]=54;}
 return 'data:image/png;base64,'+PNG.sync.write(png).toString('base64');
}
function card(id){const prior=original.find(e=>e.treasureId===id).available;return `<section class="item"><h2>${id}<span style="float:right;font-size:11px;color:${prior?'#377b70':'#ab693e'}">${prior?'既存・変更なし':'新作・第4〜6弾'}</span></h2><h3>${treasure(id).name}</h3><div class="art-row"><div><img class="large checker" src="${tile(id)}"><div class="caption">4× / 128px</div></div><div class="views"><img class="small checker" src="${tile(id)}"><span>1× / 32px</span><img class="small checker" src="${tile(id,true)}"><span>輪郭 1×</span></div></div></section>`;}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1548,height:900},deviceScaleFactor:1});
 await p.setContent(`<html lang="ja"><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#eeeee5;color:#293f3e;font-family:Arial,'Yu Gothic',sans-serif}h1{font-size:23px;margin:0 0 8px}header p{margin:0;font-size:13px}main,.comparison{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:20px}.item{padding:14px;background:#fafaf5;border:1px solid #c8d0c7;border-radius:10px;height:252px}.item h2{margin:0;font-size:15px}.item h3{margin:5px 0 12px;font-size:12px;line-height:16px;font-weight:400;height:32px}.art-row{display:flex;gap:12px;align-items:center}.large{width:128px;height:128px}.small{width:32px;height:32px}.views{display:grid;justify-items:center;gap:8px;font-size:10px}.checker{background:conic-gradient(#e2e4da 25%,#f7f7f0 0 50%,#e2e4da 0 75%,#f7f7f0 0);background-size:8px 8px}img{display:block;image-rendering:pixelated}.caption{font-size:11px;text-align:center;margin-top:5px}footer{font-size:12px;margin-top:14px;color:#62736b}.compare-title{font-size:17px;margin:24px 0 0}</style><header><h1>THE FINDERS — お宝ドット絵 ${({B:'砂浜',R:'川底',G:'河原'})[field]} / 最終・類似品比較</h1><p>原寸32×32・4倍128×128・原寸シルエット / 左上光・透過PNG・枠と発光は素材に含めません</p></header>${groups[field].map((g,i)=>'<h2 class="compare-title">比較 '+(i+1)+'</h2><main>'+g.map(card).join('')+'</main>').join('')}<footer>類似品の比較用です。既存114点のセルは変更していません。制作件数とは別の抜粋表示です。</footer></html>`);
 await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 mkdirSync('docs/treasure-art-final',{recursive:true});await p.screenshot({path:'docs/treasure-art-final/contact-'+field+'.png',fullPage:true});
}finally{await browser.close();}
