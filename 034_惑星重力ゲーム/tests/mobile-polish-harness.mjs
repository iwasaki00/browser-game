import {chromium} from '../../019_bomber-lab/tests/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
export const root=new URL('../',import.meta.url),dir=new URL(process.argv.includes('--story-navigation')?'reports/story-navigation/':process.argv.includes('--beginner-tutorial')?'reports/beginner-tutorial/':process.argv.includes('--mission-guide')?'reports/mission-guide/':process.argv.includes('--acceptance')?'reports/final-acceptance/':'reports/mobile-polish/',root);
export async function harness({baseline=null}={}){
 await mkdir(dir,{recursive:true});
 const server=createServer(async(req,res)=>{try{if(req.url==='/setup'){res.end('<!doctype html><title>Isolated mobile acceptance fixture</title>');return;}const pathname=new URL(req.url,'http://localhost').pathname,base=baseline&&pathname.startsWith('/baseline/')?baseline:root,relative=base===baseline?pathname.slice('/baseline'.length):pathname,u=new URL('.'+relative,base),f=u.pathname.endsWith('/')?new URL('index.html',u):u;if(!fileURLToPath(f).startsWith(fileURLToPath(base)))throw Error();res.setHeader('Content-Type',f.pathname.endsWith('.js')?'text/javascript':f.pathname.endsWith('.css')?'text/css':f.pathname.endsWith('.svg')?'image/svg+xml':f.pathname.endsWith('.json')?'application/json':'text/html');res.end(await readFile(f));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 return {browser,url:`http://127.0.0.1:${server.address().port}`,async close(){await browser.close();await new Promise(r=>server.close(r));}};
}
export async function touch(cdp,type,points=[]){await cdp.send('Input.dispatchTouchEvent',{type,timestamp:Date.now()/1000,touchPoints:points.map((p,i)=>({id:p.id??i+1,x:p.x,y:p.y,radiusX:8,radiusY:8,force:.6}))});}
export async function tap(page,cdp,selector){
 await page.waitForTimeout(350);const el=page.locator(selector);await el.evaluate(e=>e.scrollIntoView({behavior:"instant",block:"center",inline:"nearest"}));const b=await el.boundingBox();if(!b)throw Error('Hidden target '+selector);
 await page.evaluate(selector=>{window.mobileTapSeen=false;const observe=e=>{if(e.target.closest(selector))window.mobileTapSeen=true;document.removeEventListener('click',observe,true);};document.addEventListener('click',observe,true);},selector);
 await touch(cdp,'touchStart',[{x:b.x+b.width/2,y:b.y+b.height/2}]);await page.waitForTimeout(16);await touch(cdp,'touchEnd');
 for(let i=0;i<30;i++){if(await page.evaluate(()=>window.mobileTapSeen))return;await page.waitForTimeout(10);}throw Error('Touch did not produce click: '+selector+' '+JSON.stringify(await page.evaluate(([x,y])=>({hit:document.elementFromPoint(x,y)?.outerHTML,viewport:[visualViewport.scale,scrollX,scrollY],pointers:window.mobilePointerLog?.slice(-5),clicks:window.mobileClicks?.slice(-5)}),[b.x+b.width/2,b.y+b.height/2])));
}
export async function swipe(cdp,a,b){await touch(cdp,'touchStart',[a]);for(let i=1;i<=8;i++)await touch(cdp,'touchMove',[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]);await touch(cdp,'touchEnd');}
