import {createServer} from 'vite';import {spawn} from 'node:child_process';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:true}});await server.listen();
try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/reveal-browser-test.mjs'],{stdio:'inherit',env:{...process.env,FINDERS_REVEAL_URL:'http://127.0.0.1:'+server.httpServer.address().port+'/'}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('legacy reveal browser failed '+code)));});}finally{await server.close();}
