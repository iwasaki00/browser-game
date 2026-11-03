const {test}=require('node:test');
const assert=require('node:assert/strict');
const Copy=require('../copy-brush.js');
const Paint=require('../paint.js');
const Poses=require('../poses.js');
const {makeCanvas,fixture,pixel}=require('./raster-canvas.cjs');

test('S + (P - T) and its inverse hold for all poses, rotations and image scales',()=>{
  const image={width:6000,height:4000},photo={width:2048,height:1365};
  for(const pose of Poses.list)for(const angle of [0,Math.PI/4,-0.8])for(const size of [0.05,0.18,0.6]){
    const character={x:0.47,y:0.55,angle,size,poseId:pose.poseId};
    const raster=Poses.rasterSize(pose),start={x:160,y:raster.height*0.4},current={x:208,y:raster.height*0.55},source={x:1234.25,y:2345.5};
    const relation=Copy.mapping(source,start,character,pose,image,raster,photo);
    const original=Copy.localToImageMatrix(character,pose,image,raster);
    const target=Copy.transform(original,start),p=Copy.transform(original,current);
    const sample=Copy.transform(relation.sample,current);
    assert.ok(Math.abs(sample.x-(source.x+p.x-target.x)*photo.width/image.width)<1e-8);
    assert.ok(Math.abs(sample.y-(source.y+p.y-target.y)*photo.height/image.height)<1e-8);
    const local=Copy.transform(relation.draw,sample);
    assert.ok(Math.abs(local.x-current.x)<1e-8&&Math.abs(local.y-current.y)<1e-8);
  }
});

function layer(pose=Poses.get()){
  const paint=Paint.createLayer(makeCanvas);
  const mask=fixture(40,40,(x,y)=>[255,255,255,x>=5&&x<35&&y>=2&&y<38?255:0]);
  paint.setMask(mask,pose);
  const background=fixture(32,32,(x,y)=>[x*7,y*7,(x+y)*3,255]);
  const options={background,imageSize:{width:32,height:32},source:{x:16,y:16},
    character:{x:0.5,y:0.5,size:0.6,angle:0,poseId:pose.poseId},pose,brush:'large',opacity:1};
  return {paint,options,center:{x:192,y:paint.canvas.height/2}};
}

test('copy writes multiple actual texture colors into Paint Layer and clips its alpha mask',()=>{
  const {paint,options,center}=layer();
  paint.beginCopy(options);paint.dab(center);
  assert.deepEqual(pixel(paint.canvas,192,288),[112,112,96,255]);
  assert.notDeepEqual(pixel(paint.canvas,172,288),pixel(paint.canvas,212,288));
  // Move near the left silhouette boundary; the brush itself extends into transparency.
  paint.dab({x:49,y:288});paint.finish();
  assert.equal(pixel(paint.canvas,40,288)[3],0);
  assert.ok(pixel(paint.canvas,50,288)[3]>0);
  assert.equal(paint.history().undo,1);
});

for(const opacity of Copy.OPACITIES)test(`copy ${opacity*100}% does not compound on overlapping dabs`,()=>{
  const {paint,options,center}=layer();
  paint.beginCopy({...options,opacity});
  for(let i=0;i<5;i++)paint.dab(center);
  assert.equal(pixel(paint.canvas,192,288)[3],Math.round(255*opacity));
  paint.finish();
  paint.beginCopy({...options,opacity});paint.dab(center);paint.finish();
  assert.ok(Math.abs(pixel(paint.canvas,192,288)[3]-255*(opacity+opacity*(1-opacity)))<=1);
});

test('out-of-photo samples stay transparent rather than repeated or black',()=>{
  const {paint,options,center}=layer();
  paint.beginCopy({...options,source:{x:0.1,y:0.1}});paint.dab(center);
  assert.equal(pixel(paint.canvas,172,288)[3],0);
  assert.ok(pixel(paint.canvas,212,288)[3]>0);
  paint.dab({x:55,y:center.y});
  assert.equal(paint.copyOutside(),true);
  paint.finish();
});

test('mixed paint/copy/erase history restores pixels and cancelled copy preserves redo',()=>{
  const {paint,options,center}=layer();
  paint.begin('paint','#123456','large');paint.dab(center);paint.finish();
  const base=pixel(paint.canvas,192,288);
  paint.beginCopy({...options,opacity:0.7});paint.dab(center);paint.finish();
  const copied=pixel(paint.canvas,192,288);
  assert.notDeepEqual(copied,base);
  paint.begin('erase','#000000','large');paint.dab(center);paint.finish();
  assert.equal(pixel(paint.canvas,192,288)[3],0);
  paint.undo();assert.deepEqual(pixel(paint.canvas,192,288),copied);
  paint.undo();assert.deepEqual(pixel(paint.canvas,192,288),base);
  paint.beginCopy(options);paint.dab(center);paint.cancel();
  assert.deepEqual(pixel(paint.canvas,192,288),base);
  assert.equal(paint.history().redo,2);
  paint.redo();assert.deepEqual(pixel(paint.canvas,192,288),copied);
});

test('each stroke keeps S but establishes a new T and never samples the composite',()=>{
  const {paint,options,center}=layer();
  paint.beginCopy(options);paint.dab(center);paint.finish();
  const first=pixel(paint.canvas,192,288);
  paint.beginCopy(options);paint.dab({x:250,y:center.y});paint.finish();
  assert.deepEqual(pixel(paint.canvas,250,288),first);
  assert.deepEqual(options.source,{x:16,y:16});
});

for(const pose of Poses.list)test(`${pose.poseId}: texture pixels follow rotated/scaled local coordinates`,()=>{
  for(const angle of [0,Math.PI/4])for(const size of [0.2,0.6]){
    const {paint,options,center}=layer(pose);
    options.character={...options.character,angle,size};
    options.source={x:16.37,y:16.21}; // avoid a nearest-neighbor tie at an exact texel edge
    paint.beginCopy(options);paint.dab(center);paint.finish();
    const raster=Poses.rasterSize(pose),x=192,y=Math.floor(center.y);
    const map=Copy.mapping(options.source,center,options.character,pose,options.imageSize,raster,options.background);
    const sample=Copy.transform(map.sample,{x:x+0.5,y:y+0.5});
    const sx=Math.floor(sample.x),sy=Math.floor(sample.y);
    assert.deepEqual(pixel(paint.canvas,x,y),[sx*7,sy*7,(sx+sy)*3,255]);
  }
});

test('copy opacity never reduces subsequent normal paint or eraser strength',()=>{
  const {paint,options,center}=layer();
  paint.beginCopy({...options,opacity:0.4});paint.dab(center);paint.finish();
  paint.begin('paint','#FF0000','large');paint.dab(center);paint.finish();
  assert.deepEqual(pixel(paint.canvas,192,288),[255,0,0,255]);
  paint.begin('erase','#000000','large');paint.dab(center);paint.finish();
  assert.equal(pixel(paint.canvas,192,288)[3],0);
});
