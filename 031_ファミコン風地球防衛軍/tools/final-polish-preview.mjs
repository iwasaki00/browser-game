// Local-only, deterministic LAB scene adapter. Never referenced by index.html.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.argv[2]||8930);
const script=await readFile(new URL('../tests/helpers/polish-scenes.js',import.meta.url),'utf8');
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);res.setHeader('Cache-Control','no-store');
 if(pathname==='/js/polish-qa.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(resolve(root,'js/game.js'),'utf8')+'\n'+script);return}
 const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return}
 let body=await readFile(path);if(pathname==='/'||pathname==='/index.html')body=Buffer.from(body.toString('utf8').replace(/src="js\/game\.js[^\"]*"/,'src="/js/polish-qa.js"'));
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(body);
 }catch(e){res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log('LAB comparison only: http://127.0.0.1:'+port+'/?debug=1'));
