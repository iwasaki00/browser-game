'use strict';
const assert=require('node:assert/strict'),R=require('../ranking.js');
let raw=null;const storage={getItem:()=>raw,setItem:(k,v)=>{assert.equal(k,R.KEY);raw=v;}};
const store=R.create(storage);
function record(score,mode='easy',i=score){return {id:mode+'-'+i,score,mode,airRotationCount:2,landingRank:'GOOD',playedAt:new Date(1700000000000+i*1000).toISOString()};}
for(const mode of ['easy','normal'])for(let i=1;i<=15;i++)store.add(record(i*100,mode,i));
for(const mode of ['easy','normal']){const list=R.create(storage).list(mode);assert.equal(list.length,10);assert.equal(list[0].score,1500);assert.equal(list.at(-1).score,600);}
assert.equal(store.add(record(1,'easy',20)).rank,0);
const best=store.add(record(2000,'easy',21));assert.equal(best.rank,1);assert(best.isBest);
assert.equal(store.add(record(2000,'easy',21)).rank,0);assert.equal(store.list('easy').length,10);
assert.equal(store.list('normal')[0].score,1500);
raw='{broken';const corrupt=R.create(storage);assert.deepEqual(corrupt.list('easy'),[]);assert(corrupt.add(record(100)).persistent);
raw=JSON.stringify({version:1,entries:[record(1),record(-1),{...record(2),mode:'evil'}, {...record(3),playedAt:'invalid'}, {...record(4),score:NaN}]});
assert.equal(R.create(storage).list('easy').length,1);
const blocked=R.create({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});
assert.equal(blocked.add(record(10)).persistent,false);assert.equal(blocked.list('easy')[0].score,10);
blocked.add(record(20));assert.equal(blocked.list('easy').length,2);
const unavailable=R.create(null);assert.equal(unavailable.add(record(0)).persistent,false);assert.equal(unavailable.list('easy').length,1);
console.log('Ranking: mode separation, top 10, new record, reload, duplicate, corruption, unavailable storage OK');
