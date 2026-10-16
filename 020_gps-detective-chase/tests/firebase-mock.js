// Browser-only Firebase substitute: never connects to a real project.
const clone=v=>v===undefined?null:structuredClone(v);
let db={},listeners=[],connected=true,delay=0,fail=false,writes=[],cold=false;
const parts=p=>p.split('/').filter(Boolean);
function read(p){if(p==='.info/connected')return connected;return parts(p).reduce((v,k)=>v?.[k],db)??null}
function put(p,v){const keys=parts(p),last=keys.pop();let cur=db;for(const key of keys)cur=cur[key]??={};if(v===null)delete cur[last];else cur[last]=clone(v)}
function snapshot(p){const v=clone(read(p));return {val:()=>clone(v),exists:()=>v!==null}}
function notify(){for(const l of [...listeners]){const key=JSON.stringify(read(l.p));if(key!==l.key){l.key=key;l.cb(snapshot(l.p))}}}
export const pathRef=p=>p.replace(/\/$/,'');
export const connectionRef='.info/connected';
export async function authenticate(){return {uid:'test_user'}}
export async function get(p){return snapshot(p)}
export function onValue(p,cb){const l={p,cb,key:JSON.stringify(read(p))};listeners.push(l);cb(snapshot(p));return ()=>{listeners=listeners.filter(x=>x!==l)}}
export function onDisconnect(){return {set:async()=>{},cancel:async()=>{}}}
async function wait(){if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw Error('mock communication failure')}
export async function update(p,u){await wait();writes.push({p,u});for(const [k,v]of Object.entries(u))put(`${p}/${k}`,v);notify()}
export async function remove(p){await wait();writes.push({p,remove:true});put(p,null);notify()}
export async function runTransaction(p,fn,options){await wait();if(cold){cold=false;if(fn(null)===undefined)return {committed:false,snapshot:snapshot(p)}}const next=fn(clone(read(p)));if(next===undefined)return {committed:false,snapshot:snapshot(p)};writes.push({p,transaction:true,applyLocally:options?.applyLocally});put(p,next);notify();return {committed:true,snapshot:snapshot(p)}}
export async function push(p,v){await update(p,{['push_'+writes.length]:v})}
globalThis.__firebase={coldNext(){cold=true},get db(){return db},get writes(){return writes},get listeners(){return listeners.length},setDelay(v){delay=v},setFail(v){fail=v},connect(v){connected=v;notify()},put(p,v){put(p,v);notify()}};
