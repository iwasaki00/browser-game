const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
(async()=>{
  let now=100000,watchCount=0,clears=[],success,error,status=[],positions=[],timers=new Map(),sequence=0;
  const ctx=vm.createContext({console,sessionStorage:{setItem(){},removeItem(){}},structuredClone,setTimeout,clearTimeout,Date:class extends Date {static now(){return now}},navigator:{geolocation:{watchPosition(ok,bad){watchCount++;success=ok;error=bad;return watchCount},clearWatch(id){clears.push(id)}}},setInterval(fn){timers.set(++sequence,fn);return sequence},clearInterval(id){timers.delete(id)}});
  const modules=new Map();
  async function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const m=new vm.SourceTextModule(fs.readFileSync(file.endsWith('firebase-service.js')?path.resolve('tests/firebase-mock.js'):file,'utf8'),{context:ctx,identifier:file});modules.set(file,m);await m.link((s,from)=>load(path.resolve(path.dirname(from.identifier),s)));return m}
  const capture=await load('js/capture.js');await capture.evaluate();const {captureState,freshPosition,validPosition}=capture.namespace;
  const p={lat:35,lng:139,accuracy:50,timestamp:now-9999},settings={captureDistanceMeters:25,captureHoldSeconds:5};
  assert.equal(captureState(p,p,settings,now-5000,now).progress,1);
  for(const bad of [{...p,timestamp:now-10000},{...p,timestamp:now+1},{...p,timestamp:NaN},{...p,timestamp:'100000'},{...p,accuracy:50.01},{...p,accuracy:-1},{...p,lat:91},{...p,lng:Infinity},{...p,lat:'35'},null])assert.equal(captureState(p,bad,settings,now-5000,now).valid,false);
  assert.equal(captureState(p,{...p,lat:35.001},settings,now-5000,now).valid,false);
  assert.equal(captureState(p,p,settings,now+1,now).progress,0);
  assert.equal(captureState(p,p,settings,now-4999,now).progress,.9998);
  const wm=await load('js/witness.js');await wm.evaluate();const witness=wm.namespace.makeWitness(now,{...p,timestamp:now},{...p,timestamp:now-45000});assert.ok(witness.message.includes('移動'));assert.equal(witness.radius,300);assert.equal(witness.expiresAt,now+120000);assert.throws(()=>wm.namespace.makeWitness(now,{...p,timestamp:now-10000},null));
  const gm=await load('js/gps.js');await gm.evaluate();const gps=new gm.namespace.GPS(p=>positions.push(p),(m,s)=>status.push([m,s]));
  gps.start();gps.start();assert.equal(watchCount,1);assert.equal(timers.size,1);
  const deliver=t=>success({coords:{latitude:35,longitude:139,accuracy:5,speed:0},timestamp:t});
  deliver(now-30000);assert.equal(positions.length,0);deliver(now);assert.equal(positions.length,1);assert.equal(status.at(-1)[1],'ok');
  deliver(now);deliver(now-1);assert.equal(positions.length,1);
  now+=10000;for(const tick of timers.values())tick();assert.equal(status.at(-1)[1],'stale');
  for(const [code,word]of [[1,'権限拒否'],[2,'取得失敗'],[3,'タイムアウト']]){error({code});assert.ok(status.at(-1)[0].includes(word));assert.equal(gps.latest,null)}
  const old=success;gps.stop();assert.equal(clears.length,1);assert.equal(timers.size,0);old({coords:{latitude:35,longitude:139,accuracy:5},timestamp:now});assert.equal(positions.length,1);
  gps.start();deliver(now);assert.equal(watchCount,2);gps.stop();
  const {LocalRoom}=await import('../js/local-room.js');let changes=0;const room=new LocalRoom('me',()=>changes++);await room.create('test');
  await room.patch('game',{phase:'playing',startedAt:123,generationId:0});
  const report={message:'test',createdAt:now,sourcePosition:p};const result=await Promise.all(Array.from({length:6},()=>room.publishWitness(1,report,123)));
  assert.equal(result.filter(r=>r.committed).length,1);assert.equal(Object.keys(room.data.witnessReports).length,1);assert.equal(room.data.witnessReports.generation_1.sourcePosition,undefined);
  await room.patch('game',{startedAt:456});assert.equal((await room.publishWitness(2,report,123)).committed,false);
  let wins=0;await Promise.all(Array.from({length:5},()=>room.transactionGame(g=>{if(g.phase!=='playing')return;wins++;return {...g,phase:'finished'}})));assert.equal(wins,1);
  await room.leave();assert.equal(room.witnessSubscribers.size,0);
  const rm=await load('js/room.js');await rm.evaluate();let remoteChanges=0;const remote=new rm.namespace.Room('host',()=>remoteChanges++);const id=await remote.create('host');
  const mock=ctx.__firebase;mock.put(`${id}/game`,{phase:'playing',startedAt:123,generationId:0});
  const rep={message:'test',createdAt:now,sourcePosition:{...p,timestamp:now}};
  const atomic=await Promise.all(Array.from({length:5},()=>remote.publishWitness(1,rep,123)));assert.equal(atomic.filter(r=>r.committed).length,1);
  mock.setDelay(15);const oldWrite=remote.transactionGame(g=>({...g,phase:'finished'}));remote.close();assert.equal((await oldWrite).committed,false);assert.equal(mock.listeners,0);assert.throws(()=>remote.target());
  mock.setDelay(0);mock.put(`${id}/meta/status`,'lobby');mock.put(`${id}/game`,{phase:'lobby'});mock.coldNext();
  const guest=new rm.namespace.Room('guest',()=>{});await guest.join(id,'guest');assert.ok(mock.db[id].players.guest);assert.equal(guest.id,id);
  assert.ok(mock.writes.filter(w=>w.transaction).every(w=>w.applyLocally===false));
  await guest.leave();await remote.leave();assert.equal(mock.listeners,0);
  console.log('PASS production Room cold-cache join, atomic witness, closed-session transaction and unsubscribe, server-confirmed transactions');
  console.log('PASS capture boundaries, malformed coordinates/timestamps, GPS duplicate/stale/error/late callback/stop/restart, atomic local witness and finish');
})().catch(e=>{console.error(e);process.exitCode=1});

