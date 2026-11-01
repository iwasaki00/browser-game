// Local loopback/subdirectory smoke check, NOT a browser or a remote Pages audit.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {VERSION} from '../js/data.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const audit=JSON.parse(await readFile(resolve(root,'reports/final-acceptance/release-audit.json'),'utf8'));
if(audit.version!==VERSION||audit.status!=='PASS')throw Error('Run the current release audit first');
const files=new Map(audit.runtimeFiles.map(f=>[f.path,f]));
const prefix='/browser-game/031_ファミコン風地球防衛軍/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const path=pathname.startsWith(prefix)?pathname.slice(prefix.length):null;
 if(!files.has(path)){res.writeHead(404);res.end('Not found');return}
 const body=await readFile(resolve(root,path));
 const type=mime[extname(path)];res.writeHead(200,{'Content-Type':type+(type.startsWith('text/')?'; charset=utf-8':''),'Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(400);res.end('Bad request')}});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
const rows=[];
try{
 const base='http://127.0.0.1:'+server.address().port+prefix.split('/').map(encodeURIComponent).join('/');
 for(const f of files.values()){
  const response=await fetch(base+f.path.split('/').map(encodeURIComponent).join('/')+'?v='+encodeURIComponent(VERSION));
  const body=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type')?.split(';')[0];
  rows.push({path:f.path,status:response.status===200&&body.length===f.bytes&&createHash('sha256').update(body).digest('hex')===f.sha256&&type===mime[extname(f.path)]?'PASS':'FAIL',httpStatus:response.status,contentType:type,bytes:body.length});
 }
 const missing=await fetch(base+'missing-acceptance-fixture.png');await missing.arrayBuffer();
 rows.push({path:'missing-acceptance-fixture.png',status:missing.status===404?'PASS':'FAIL',httpStatus:missing.status});
 const result={version:VERSION,generatedAt:new Date().toISOString(),status:rows.every(r=>r.status==='PASS')?'PASS':'FAIL',method:'Temporary Node loopback allowlist server; URL-encoded Japanese project subdirectory + version queries; every runtime file byte/hash/MIME checked',runtimeFileCount:files.size,checks:rows.length,rows,limitations:['Not the production hosting configuration','No JavaScript execution, rendering, input or browser-cache validation','No GitHub Pages/CDN/remote HTTP or iPhone test; no publishing']};
 await writeFile(resolve(root,'reports/final-acceptance/local-http.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,runtimeFiles:result.runtimeFileCount,checks:result.checks}));if(result.status!=='PASS')process.exitCode=1;
}finally{await new Promise(ok=>server.close(ok));server.closeAllConnections()}
