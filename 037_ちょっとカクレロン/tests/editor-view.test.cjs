const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const View=require('../editor-view.js');
const Paint=require('../paint.js');
const Copy=require('../copy-brush.js');
const Poses=require('../poses.js');
const {makeCanvas,fixture}=require('./raster-canvas.cjs');

test('zoom shares exact local/image coordinates at every pose, scale, angle and viewport',()=>{
  const image={width:800,height:500};
  for(const viewport of [{width:390,height:420},{width:375,height:270},{width:1000,height:700}])
    for(const pose of Poses.list)for(const angle of [0,Math.PI/4,-1.2])for(const size of [0.05,0.3,0.6]){
      const character={x:0.4,y:0.55,size,angle,poseId:pose.poseId},raster=Poses.rasterSize(pose);
      const local={x:220,y:raster.height*0.4};
      const world=Copy.transform(Copy.localToImageMatrix(character,pose,image,raster),local);
      for(const scale of [1,2,4,8]){
        const fit=View.fitRect(image,viewport,{enabled:scale!==1,scale,center:{x:0.44,y:0.53}});
        const screen={x:fit.x+world.x/image.width*fit.width,y:fit.y+world.y/image.height*fit.height};
        const actual=Paint.screenToLocal(screen,character,fit);
        assert.ok(Math.abs(actual.x-local.x)<1e-8&&Math.abs(actual.y-local.y)<1e-8);
      }
    }
});

test('normal, 2x, 4x and 8x copy strokes produce the same Paint Layer pixels',()=>{
  const pose=Poses.get('P04'),image={width:32,height:32},viewport={width:390,height:300};
  const background=fixture(32,32,(x,y)=>[x*7,y*7,(x+y)*3,255]);
  const mask=fixture(40,20,()=>[255,255,255,255]);
  const character={x:0.5,y:0.5,size:0.6,angle:Math.PI/4,poseId:pose.poseId};
  const raster=Poses.rasterSize(pose),worldMatrix=Copy.localToImageMatrix(character,pose,image,raster);
  let expected;
  for(const scale of [1,2,4,8]){
    const paint=Paint.createLayer(makeCanvas);paint.setMask(mask,pose);
    const fit=View.fitRect(image,viewport,{enabled:scale!==1,scale,center:{x:0.5,y:0.5}});
    paint.beginCopy({background,imageSize:image,source:{x:16.37,y:16.21},character,pose,brush:'medium',opacity:0.7});
    for(const local of [{x:192,y:96},{x:214,y:102}]){
      const world=Copy.transform(worldMatrix,local);
      const screen={x:fit.x+world.x/image.width*fit.width,y:fit.y+world.y/image.height*fit.height};
      paint.dab(Paint.screenToLocal(screen,character,fit));
    }
    paint.finish();
    if(expected)assert.deepEqual(paint.canvas.pixels,expected);
    else expected=new Uint8ClampedArray(paint.canvas.pixels);
  }
});

test('viewport backing store is bounded and animation settles to the exact pose',()=>{
  for(const viewport of [{width:390,height:844},{width:375,height:667},{width:4000,height:2000}]){
    const size=View.backingSize(viewport,4);assert.ok(size.width<=2048&&size.height<=2048);
    assert.ok(size.ratio<=3);
  }
  assert.ok(View.POSE_DURATION>=300&&View.POSE_DURATION<=450);
  assert.equal(View.poseFrame(0).old.alpha,1);assert.equal(View.poseFrame(0).next.alpha,0);
  assert.deepEqual(View.poseFrame(1).next,{alpha:1,scaleX:1,scaleY:1,tilt:0});
  const center=View.panCenter({x:0.5,y:0.5},{x:100,y:-50},{width:1000,height:500});
  assert.deepEqual(center,{x:0.4,y:0.6});
});

test('document version, local asset cache keys and responsive layout rules are consistent',()=>{
  const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('style.css','utf8');
  assert.match(html,/application-version" content="0\.7\.1/);
  assert.match(html,/v0\.7\.1/);
  for(const [,file,version]of html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css))\?v=([^"]+)"/g)){
    assert.ok(fs.existsSync(file));assert.equal(version,'0.7.1');
  }
  assert.match(css,/height:100dvh/);assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/min-height:44px/);assert.match(css,/\.mode-settings\{[^}]*overflow-y:auto/);
  assert.match(css,/@media\(min-width:960px\)/);
});
