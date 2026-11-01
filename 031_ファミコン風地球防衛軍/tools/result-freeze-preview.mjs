// Local-only browser QA adapter. Not loaded by index.html or shipped game code.
// Uses a fresh, dedicated origin and never clears an existing save.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {earlyRoute} from '../tests/helpers/campaign-routes.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.argv[2]||8925);
const harness=`
const qaWasEmpty=localStorage.getItem('pfd-result-qa-origin')===null;
const qaMenu=document.createElement('aside');qaMenu.id='resultQA';qaMenu.style.cssText='position:fixed;z-index:100;top:0;left:100px;font:10px monospace;background:#032e;color:white;max-width:60vw';
qaMenu.innerHTML='<button id="qaM03">M03 WING ASSISTED QA</button><output id="qaResult">専用ポート・無敵補助・人手攻略ではありません</output>';document.body.append(qaMenu);
const qaOut=qaMenu.querySelector('output');let qaRunning=false;
qaMenu.querySelector('button').onclick=()=>{
 if(qaRunning)return;
 if(!localStorage.getItem('pfd-result-qa-origin')){if(qaInitialSave!==null){qaOut.textContent='既存セーブあり：上書き禁止。別の未使用ポートを使ってください';return}localStorage.setItem('pfd-result-qa-origin','test-only');save=sanitizeSave({...JSON.parse(JSON.stringify(DEFAULT_SAVE)),clearedMissions:['M01','M02'],selectedClass:'WING'});storeSave()}
 if(!assetsReady){qaOut.textContent='素材準備中。準備後に開始してください';return}
 document.querySelector('[data-action="start"]').click();document.querySelector('[data-action="select-mission"][data-mission="M03"]').click();document.querySelector('[data-action="select-class"][data-player-class="WING"]').click();document.querySelector('[data-action="deploy"]').click();
 game.player.invuln=3600;qaRunning=true;let frames=0;
 function batch(){try{if(state==='play'&&!game.clear&&!game.enemies.some(e=>isBoss(e)&&e.dead)){for(let i=0;i<180&&!game.clear&&!game.enemies.some(e=>isBoss(e)&&e.dead);i++){${earlyRoute}update(1/60);frames++}qaOut.textContent='ASSISTED / '+game.missionId+' AREA'+(game.area+1)+' '+game.time.toFixed(1)+'s / '+frames+' updates';if(frames>50000)throw Error('QA timeout');requestAnimationFrame(batch);return}
  if(state==='play'&&!game.clear){input.up=input.hover=input.fire=true;requestAnimationFrame(batch);return}
  qaRunning=false;qaOut.textContent='ASSISTED撃破 / 結果の実ボタンを操作してください';
 }catch(e){qaRunning=false;qaOut.textContent='QA ERROR '+e.message}}
 requestAnimationFrame(batch);
};
`;
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);res.setHeader('Cache-Control','no-store');
 if(pathname==='/js/result-qa-engine.js'){let s=await readFile(resolve(root,'js/game.js'),'utf8');res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end("const qaInitialSave=localStorage.getItem('pixel-defense-front-save-v1');\n"+s+'\n'+harness);return}
 let path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return}
 let body=await readFile(path);if(pathname==='/'||pathname==='/index.html')body=Buffer.from(body.toString('utf8').replace(/src="js\/game\.js[^\"]*"/,'src="/js/result-qa-engine.js"'));
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404);res.end('Not found')}});
server.listen(port,'127.0.0.1',()=>console.log('Result QA only: http://127.0.0.1:'+port+'/ — fresh origin required; Ctrl+C stops'));
