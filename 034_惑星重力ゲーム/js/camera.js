// Presentation only: CSS pixel coordinates <-> immutable world coordinates.
export class Camera {
  constructor({minZoom=.5,maxZoom=3,padding=12}={}) {
    Object.assign(this,{minZoom,maxZoom,padding,width:1,height:1,zoom:1,center:{x:0,y:0},bounds:{left:0,top:0,right:375,bottom:500}});
  }
  resize(width,height){this.width=Math.max(1,width);this.height=Math.max(1,height);}
  get scale(){const b=this.bounds;return Math.min(Math.max(1,this.width-2*this.padding)/(b.right-b.left),Math.max(1,this.height-2*this.padding)/(b.bottom-b.top))*this.zoom;}
  get transform(){const scale=this.scale;return {scale,offsetX:this.width/2-this.center.x*scale,offsetY:this.height/2-this.center.y*scale};}
  toWorld(point){const v=this.transform;return {x:(point.x-v.offsetX)/v.scale,y:(point.y-v.offsetY)/v.scale};}
  toScreen(point){const v=this.transform;return {x:point.x*v.scale+v.offsetX,y:point.y*v.scale+v.offsetY};}
  fit(stage){
    const objects=[{...stage.launch.position,radius:18},{...stage.goal,radius:stage.goal.radius+8},...stage.planets.map(p=>({...p,radius:Math.max(p.radius+14,...(p.hazards??[]).map(h=>h.radius+4))}))];
    this.bounds={left:Math.min(0,...objects.map(p=>p.x-p.radius)),top:Math.min(0,...objects.map(p=>p.y-p.radius)),right:Math.max(stage.world.width,...objects.map(p=>p.x+p.radius)),bottom:Math.max(stage.world.height,...objects.map(p=>p.y+p.radius))};
    this.center={x:(this.bounds.left+this.bounds.right)/2,y:(this.bounds.top+this.bounds.bottom)/2};this.zoom=1;
  }
  zoomAt(value,screen={x:this.width/2,y:this.height/2}){
    const anchor=this.toWorld(screen);this.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,value));
    this.center={x:anchor.x-(screen.x-this.width/2)/this.scale,y:anchor.y-(screen.y-this.height/2)/this.scale};this.clamp();
  }
  clamp(){const b=this.bounds;this.center.x=Math.max(b.left,Math.min(b.right,this.center.x));this.center.y=Math.max(b.top,Math.min(b.bottom,this.center.y));}
  beginGesture(points){const [a,b]=points;this.anchor=this.toWorld({x:(a.x+b.x)/2,y:(a.y+b.y)/2});this.startDistance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));this.startZoom=this.zoom;}
  moveGesture(points){
    if(!this.anchor)return;const [a,b]=points;
    this.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.startZoom*Math.hypot(a.x-b.x,a.y-b.y)/this.startDistance));
    this.center={x:this.anchor.x-((a.x+b.x)/2-this.width/2)/this.scale,y:this.anchor.y-((a.y+b.y)/2-this.height/2)/this.scale};this.clamp();
  }
  endGesture(){this.anchor=null;}
}
