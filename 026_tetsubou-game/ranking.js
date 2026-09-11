(function(root){
  'use strict';
  const KEY='tetsubou-game.ranking.v1',LIMIT=10;
  const valid=r=>r&&Number.isSafeInteger(r.score)&&r.score>=0&&['easy','normal'].includes(r.mode)
    &&Number.isSafeInteger(r.airRotationCount)&&r.airRotationCount>=0
    &&['PERFECT','GOOD','STEP','CRASH'].includes(r.landingRank)
    &&typeof r.playedAt==='string'&&Number.isFinite(Date.parse(r.playedAt));
  function clean(entries){
    if(!Array.isArray(entries))return [];
    return ['easy','normal'].flatMap(mode=>entries.filter(r=>valid(r)&&r.mode===mode)
      .map(r=>({score:r.score,mode:r.mode,airRotationCount:r.airRotationCount,landingRank:r.landingRank,playedAt:r.playedAt,id:typeof r.id==='string'?r.id:r.playedAt+'-'+r.score}))
      .sort((a,b)=>b.score-a.score||Date.parse(a.playedAt)-Date.parse(b.playedAt)).slice(0,LIMIT));
  }
  function create(storage){
    let memory=[],persistent=!!storage;
    function read(){
      if(!storage)return memory;
      try{const raw=storage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);memory=clean(parsed.version===1?parsed.entries:[]);}return memory;}
      catch(_){persistent=false;return memory;}
    }
    function list(mode){return read().filter(r=>r.mode===mode);}
    function add(record){
      if(!valid(record))throw new TypeError('Invalid ranking record');
      const entries=read(),oldBest=list(record.mode)[0]?.score??-1;
      const entry={...record,id:record.id||record.playedAt+'-'+Math.random().toString(36).slice(2)};
      if(entries.some(r=>r.id===entry.id))return {rank:0,isBest:false,persistent};
      memory=clean([...entries,entry]);
      const rank=memory.filter(r=>r.mode===entry.mode).findIndex(r=>r.id===entry.id)+1;
      if(storage){try{storage.setItem(KEY,JSON.stringify({version:1,entries:memory}));persistent=true;}catch(_){persistent=false;storage=null;}}
      return {rank,isBest:rank>0&&entry.score>oldBest,persistent};
    }
    return {list,add,get persistent(){return persistent;}};
  }
  const api={KEY,LIMIT,clean,create};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BarRanking=api;
})(typeof window!=='undefined'?window:globalThis);
