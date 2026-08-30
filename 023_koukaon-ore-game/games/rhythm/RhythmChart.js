(function () {
  "use strict";
  const patterns = {
    four:[{beat:0,lane:0},{beat:.5,lane:2},{beat:1,lane:1},{beat:1.5,lane:2},{beat:2,lane:0},{beat:2.5,lane:2},{beat:3,lane:1},{beat:3.5,lane:3}],
    eight:[{beat:0,lane:0},{beat:0,lane:2},{beat:.5,lane:2},{beat:1,lane:1},{beat:1,lane:2},{beat:1.5,lane:2},{beat:2,lane:0},{beat:2,lane:2},{beat:2.5,lane:2},{beat:3,lane:1},{beat:3,lane:2},{beat:3.5,lane:3}],
    rush:[{beat:0,lane:0},{beat:0,lane:3},{beat:.5,lane:2},{beat:1,lane:1},{beat:1.5,lane:2},{beat:2,lane:0},{beat:2.5,lane:3},{beat:2.75,lane:2},{beat:3,lane:1},{beat:3,lane:2},{beat:3.5,lane:0},{beat:3.75,lane:3}]
  };
  const stages = [
    {id:"four",name:"オレ4つ打ち",bpm:100,bars:16,difficulty:"EASY",description:"キック中心のやさしい4つ打ち"},
    {id:"eight",name:"オレ8ビート",bpm:120,bars:16,difficulty:"NORMAL",description:"キック、スネア、ハイハットを刻む王道パターン"},
    {id:"rush",name:"オレラッシュ",bpm:140,bars:20,difficulty:"HARD",description:"4レーン全部と少しだけ同時押し"}
  ];
  class RhythmChart {
    static stages() { return stages.map((stage) => ({...stage,duration:1.5+stage.bars*4*60/stage.bpm+1})); }
    static create(id="eight") {
      const stage=stages.find((entry)=>entry.id===id)||stages[1];
      const secondsPerBeat=60/stage.bpm,intro=1.5,notes=[];let noteId=0;
      for(let bar=0;bar<stage.bars;bar++){
        const variation=stage.id==="rush"&&bar%4===3?[...patterns.rush,{beat:1.75,lane:3},{beat:2,lane:2}]:patterns[stage.id];
        variation.forEach((entry)=>notes.push({id:`${stage.id}-${noteId++}`,time:intro+(bar*4+entry.beat)*secondsPerBeat,lane:entry.lane,type:"tap",status:"pending"}));
      }
      return {...stage,intro,secondsPerBeat,notes,duration:intro+stage.bars*4*secondsPerBeat+1};
    }
  }
  window.RhythmChart=RhythmChart;
})();
