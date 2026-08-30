(function () {
  "use strict";
  class RhythmRenderer {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.colors=["#ff3b68","#ffe45d","#48e9e1","#b58cff"];this.labels=["KICK","SNARE","HI-HAT","CLAP"];}
    resize(){const rect=this.canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);this.canvas.width=Math.round(rect.width*d);this.canvas.height=Math.round(rect.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.w=rect.width;this.h=rect.height;this.judgeY=this.h-76;this.laneW=this.w/4;}
    draw(game){const c=this.ctx,w=this.w,h=this.h;c.clearRect(0,0,w,h);const glow=game.fever?"rgba(255,59,104,.16)":"rgba(72,233,225,.08)";c.fillStyle="#070a13";c.fillRect(0,0,w,h);c.fillStyle=glow;c.fillRect(0,0,w,h);
      for(let lane=0;lane<4;lane++){c.fillStyle=lane%2?"rgba(255,255,255,.025)":"rgba(255,255,255,.045)";c.fillRect(lane*this.laneW,0,this.laneW,h);c.strokeStyle="rgba(255,255,255,.1)";c.strokeRect(lane*this.laneW,0,this.laneW,h);c.fillStyle=this.colors[lane];c.font="700 11px sans-serif";c.textAlign="center";c.fillText(this.labels[lane],(lane+.5)*this.laneW,18);}
      const position=game.position(),travel=1.9;for(const note of game.notes){if(note.status!=="pending")continue;const until=note.time-position;if(until>travel||until<-.2)continue;const y=this.judgeY-until/travel*(this.judgeY-30),x=(note.lane+.5)*this.laneW;c.beginPath();c.fillStyle=this.colors[note.lane];c.shadowColor=this.colors[note.lane];c.shadowBlur=12;c.roundRect?.(x-this.laneW*.34,y-12,this.laneW*.68,24,8);if(c.roundRect)c.fill();else c.fillRect(x-this.laneW*.34,y-12,this.laneW*.68,24);c.shadowBlur=0;}
      c.strokeStyle="#fff";c.lineWidth=3;c.beginPath();c.moveTo(0,this.judgeY);c.lineTo(w,this.judgeY);c.stroke();for(let lane=0;lane<4;lane++){const flash=game.padFlash[lane]||0;c.fillStyle=flash>0?this.colors[lane]:"rgba(255,255,255,.1)";c.globalAlpha=flash>0?.75:.4;c.fillRect(lane*this.laneW+4,this.judgeY+8,this.laneW-8,46);c.globalAlpha=1;}
      if(position<0&&!game.needsRestart){const remaining=-position;c.fillStyle="rgba(5,7,16,.78)";c.fillRect(0,0,w,h);c.fillStyle=remaining>.55?"#fff":"#ffe45d";c.font=remaining>.55?"900 72px sans-serif":"900 28px sans-serif";c.fillText(remaining>.55?String(Math.ceil(remaining)):"全部オレ！",w/2,h/2);}
      c.textAlign="center";if(game.combo>=2){c.fillStyle="#fff";c.font="900 34px sans-serif";c.fillText(game.combo,w/2,78);c.fillStyle="#99a3bb";c.font="800 12px sans-serif";c.fillText("COMBO",w/2,96);}if(game.judgeText){c.fillStyle=game.judgeText==="MISS"?"#ff6b7c":"#ffe45d";c.font="900 27px sans-serif";c.fillText(game.judgeText,w/2,this.judgeY-48);}if(game.fever){c.fillStyle="#ff3b68";c.font="900 18px sans-serif";c.fillText("FEVER ×2",w/2,124);}
      if(game.needsRestart){c.fillStyle="rgba(5,7,16,.88)";c.fillRect(0,0,w,h);c.fillStyle="#fff";c.font="900 24px sans-serif";c.fillText("同期を停止しました",w/2,h/2-18);c.fillStyle="#48e9e1";c.font="700 15px sans-serif";c.fillText("パッドをタップして最初から",w/2,h/2+18);}
    }
  }
  window.RhythmRenderer=RhythmRenderer;
})();
