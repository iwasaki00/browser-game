// Focused local Chrome viewport check; uses the repository's existing Playwright.
import { chromium } from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const baseline=process.argv.includes('--baseline');
const reportDir=path.join(root,'reports','mobile');
await mkdir(reportDir,{recursive:true});
const server=createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root)){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const [width,height] of [[375,667],[390,844],[393,852],[320,568]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForTimeout(350);
  const metrics=await page.evaluate(()=>({
   viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
   board:document.querySelector('#spaceFrame').getBoundingClientRect().toJSON(),
   controls:[...document.querySelectorAll('button,select,input,summary')].filter(el=>el.getClientRects().length).map(el=>({id:el.id||el.textContent.trim(),...el.getBoundingClientRect().toJSON()})),
  }));
  await page.screenshot({path:path.join(reportDir,`${baseline?'before':'after'}-${width}x${height}.png`)});
  results.push({size:`${width}x${height}`,metrics,errors});
  if(!baseline) {
   const assert=(condition,message)=>{if(!condition)throw Error(`${width}x${height}: ${message}`);};
   assert(metrics.document[0]<=width,'horizontal overflow');
   assert(metrics.document[1]<=height,'page overflow');
   assert(metrics.board.height>=240,'board too short');
   for(const item of metrics.controls)assert(item.x>=0&&item.right<=width+1&&item.bottom<=height+1,`control clipped: ${item.id}`);
  }
  await context.close();
 }
 await writeFile(path.join(reportDir,baseline?'before.json':'after.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({size:r.size,document:r.metrics.document,boardHeight:r.metrics.board.height,errors:r.errors})),null,2));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
