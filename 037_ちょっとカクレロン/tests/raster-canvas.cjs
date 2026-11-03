// Small independent Canvas reference for pixel-level unit tests. No SVG rasterizer,
// browser color management or antialiasing is simulated here.
class RasterCanvas {
  constructor() {
    this._width = 1; this._height = 1; this.pixels = new Uint8ClampedArray(4);
    this.context = new RasterContext(this);
  }
  get width() { return this._width; }
  set width(value) { this._width = value; this.reset(); }
  get height() { return this._height; }
  set height(value) { this._height = value; this.reset(); }
  reset() { this.pixels = new Uint8ClampedArray(this.width * this.height * 4); this.context?.reset(); }
  getContext() { return this.context; }
}
const inverse = ([a,b,c,d,e,f]) => {
  const det = a*d-b*c;
  return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];
};
const point = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
class RasterContext {
  constructor(canvas) { this.canvas = canvas; this.reset(); }
  reset() {
    this.globalAlpha=1; this.globalCompositeOperation='source-over'; this.matrix=[1,0,0,1,0,0];
    this.clipBox=[0,0,this.canvas.width,this.canvas.height]; this.stack=[]; this.path=null;
  }
  save() { this.stack.push({ globalAlpha:this.globalAlpha, globalCompositeOperation:this.globalCompositeOperation,
    matrix:[...this.matrix],clipBox:[...this.clipBox] }); }
  restore() { Object.assign(this,this.stack.pop()); }
  setTransform(...matrix) { this.matrix=matrix; }
  beginPath() { this.path=null; }
  rect(x,y,width,height) { this.path={kind:'rect',x,y,width,height}; }
  clip() {
    const p=this.path;
    this.clipBox=[Math.max(this.clipBox[0],p.x),Math.max(this.clipBox[1],p.y),
      Math.min(this.clipBox[2],p.x+p.width),Math.min(this.clipBox[3],p.y+p.height)];
  }
  region(x,y,width,height,callback) {
    const left=Math.max(0,Math.floor(x),Math.ceil(this.clipBox[0]));
    const top=Math.max(0,Math.floor(y),Math.ceil(this.clipBox[1]));
    const right=Math.min(this.canvas.width,Math.ceil(x+width),Math.floor(this.clipBox[2]));
    const bottom=Math.min(this.canvas.height,Math.ceil(y+height),Math.floor(this.clipBox[3]));
    for(let py=top;py<bottom;py++)for(let px=left;px<right;px++)callback(px,py);
  }
  clearRect(x,y,width,height) { this.region(x,y,width,height,(px,py)=>this.canvas.pixels.fill(0,(py*this.canvas.width+px)*4,(py*this.canvas.width+px)*4+4)); }
  blend(x,y,color) {
    const pixels=this.canvas.pixels, i=(y*this.canvas.width+x)*4;
    const sourceAlpha=color[3]/255*this.globalAlpha, destinationAlpha=pixels[i+3]/255;
    if(this.globalCompositeOperation==='destination-in'||this.globalCompositeOperation==='destination-out') {
      pixels[i+3]=Math.round(255*destinationAlpha*(this.globalCompositeOperation==='destination-in'?sourceAlpha:1-sourceAlpha));
      if(!pixels[i+3])pixels.fill(0,i,i+4);
      return;
    }
    const alpha=sourceAlpha+destinationAlpha*(1-sourceAlpha);
    for(let c=0;c<3;c++)pixels[i+c]=alpha?(color[c]*sourceAlpha+pixels[i+c]*destinationAlpha*(1-sourceAlpha))/alpha:0;
    pixels[i+3]=Math.round(alpha*255);
  }
  drawImage(image,...args) {
    const [dx,dy,dw,dh]=args.length===2?[...args,image.width,image.height]:args;
    const corners=[[dx,dy],[dx+dw,dy],[dx,dy+dh],[dx+dw,dy+dh]].map(([x,y])=>point(this.matrix,x,y));
    const minX=Math.min(...corners.map(p=>p[0])), minY=Math.min(...corners.map(p=>p[1]));
    const maxX=Math.max(...corners.map(p=>p[0])), maxY=Math.max(...corners.map(p=>p[1]));
    const inv=inverse(this.matrix);
    this.region(minX,minY,maxX-minX,maxY-minY,(x,y)=>{
      const local=point(inv,x+0.5,y+0.5),sx=Math.floor((local[0]-dx)/dw*image.width),sy=Math.floor((local[1]-dy)/dh*image.height);
      if(sx<0||sy<0||sx>=image.width||sy>=image.height)return;
      const i=(sy*image.width+sx)*4;
      this.blend(x,y,image.pixels.subarray(i,i+4));
    });
  }
  getImageData(x,y,width,height) {
    const data=new Uint8ClampedArray(width*height*4);
    for(let py=0;py<height;py++)for(let px=0;px<width;px++){
      const i=((py+y)*this.canvas.width+px+x)*4;
      data.set(this.canvas.pixels.subarray(i,i+4),(py*width+px)*4);
    }
    return {data,width,height};
  }
  putImageData(image,dx,dy,x=0,y=0,width=image.width,height=image.height) {
    for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){
      const i=(py*image.width+px)*4;
      this.canvas.pixels.set(image.data.subarray(i,i+4),((py+dy)*this.canvas.width+px+dx)*4);
    }
  }
  arc(x,y,radius) { this.path={kind:'circle',x,y,radius}; }
  moveTo(x,y) { this.path={kind:'line',x,y}; }
  lineTo(x,y) { this.path.x2=x; this.path.y2=y; }
  color(hex) { return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255]; }
  fill() {
    const p=this.path, color=this.color(this.fillStyle);
    this.region(p.x-p.radius,p.y-p.radius,p.radius*2,p.radius*2,(x,y)=>{
      if(Math.hypot(x+0.5-p.x,y+0.5-p.y)<=p.radius)this.blend(x,y,color);
    });
  }
  stroke() {
    const p=this.path,radius=this.lineWidth/2,color=this.color(this.strokeStyle);
    const vx=p.x2-p.x,vy=p.y2-p.y,length=vx*vx+vy*vy;
    this.region(Math.min(p.x,p.x2)-radius,Math.min(p.y,p.y2)-radius,Math.abs(vx)+radius*2,Math.abs(vy)+radius*2,(x,y)=>{
      const t=length?Math.max(0,Math.min(1,((x+0.5-p.x)*vx+(y+0.5-p.y)*vy)/length)):0;
      if(Math.hypot(x+0.5-p.x-t*vx,y+0.5-p.y-t*vy)<=radius)this.blend(x,y,color);
    });
  }
}
const makeCanvas=()=>new RasterCanvas();
function fixture(width,height,color) {
  const canvas=makeCanvas();canvas.width=width;canvas.height=height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)canvas.pixels.set(color(x,y),(y*width+x)*4);
  return canvas;
}
const pixel=(canvas,x,y)=>Array.from(canvas.pixels.subarray((y*canvas.width+x)*4,(y*canvas.width+x)*4+4));
module.exports={makeCanvas,fixture,pixel};
