// Independent art viewer. No game modules, storage, input, progression or timers.
const base='../../assets/',study=base+'art-refresh/study-01/';
const files={
  oldPlayer:base+'sprites/player/classes.png',oldEnemy:base+'sprites/enemies/enemies.png',oldBoss:base+'sprites/bosses/mother_crawler.png',
  oldCity:base+'backgrounds/city.png',oldUnderground:base+'backgrounds/underground.png',oldCityTiles:base+'tiles/city_tiles.png',oldUnderTiles:base+'tiles/underground_tiles.png',
  ranger:study+'sprites/ranger.png',wing:study+'sprites/wing.png',crawler:study+'sprites/crawler.png',needle:study+'sprites/needle.png',boss:study+'sprites/mother_crawler.png',
  city:study+'backgrounds/city.png',underground:study+'backgrounds/underground.png',cityTiles:study+'tiles/city.png',underTiles:study+'tiles/underground.png'
};
const images={},status=document.querySelector('#conditions'),controls=['stage','resolution','zoom'].map(id=>document.getElementById(id));
const variants=[0,0,1,0,0,2,0,3,0,0,1,0,2,0,0,0];
function draw(canvas,modern){
  const resolution=Number(controls[1].value),zoom=Number(controls[2].value),underground=controls[0].value==='underground';
  canvas.width=320*resolution;canvas.height=180*resolution;
  const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#091723';ctx.fillRect(0,0,canvas.width,canvas.height);
  const camera=Math.max(0,Math.min(1024-320/zoom,400-96/zoom));
  ctx.setTransform(resolution*zoom,0,0,resolution*zoom,-camera*resolution*zoom,148*(1-zoom)*resolution);
  const bg=images[modern?(underground?'underground':'city'):(underground?'oldUnderground':'oldCity')];
  for(let x=Math.floor(camera/320)*320-320;x<camera+320/zoom+320;x+=320)ctx.drawImage(bg,0,0,bg.width,bg.height,x,0,320,180);
  const ts=images[modern?(underground?'underTiles':'cityTiles'):(underground?'oldUnderTiles':'oldCityTiles')],cell=modern?32:16;
  for(let x=Math.floor(camera/16)*16-16;x<camera+320/zoom+16;x+=16){
    const n=modern?variants[((x/16)%16+16)%16]:((x/16)%8+8)%8;
    ctx.drawImage(ts,n% (modern?4:8)*cell,Math.floor(n/(modern?4:8))*cell,cell,cell,x,148,16,16);
  }
  const sprite=(image,sx,sy,sw,sh,x,y,w,h,flip=false)=>{ctx.save();ctx.translate(x,y);if(flip){ctx.translate(w,0);ctx.scale(-1,1)}ctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);ctx.restore()};
  if(modern){
    sprite(images.wing,0,0,48,64,468,83,24,32);
    sprite(images.needle,0,0,64,64,634,85,32,32);
    sprite(images.ranger,0,0,48,64,388,116,24,32);
    for(const x of [530,571,856])sprite(images.crawler,0,0,64,64,x-16,116,32,32);
    sprite(images.boss,0,0,192,128,736,84,96,64);
  }else{
    sprite(images.oldPlayer,0,96,24,32,468,83,24,32);
    sprite(images.oldEnemy,0,96,48,48,634,85,32,32);
    sprite(images.oldPlayer,0,0,24,32,388,116,24,32);
    for(const x of [530,571,856])sprite(images.oldEnemy,0,0,48,48,x-16,116,32,32,true);
    sprite(images.oldBoss,0,0,96,64,736,84,96,64);
  }
  canvas.dataset.resolution=String(resolution);canvas.dataset.zoom=String(zoom);canvas.dataset.stage=controls[0].value;
}
function refresh(){
  draw(document.querySelector('#current'),false);draw(document.querySelector('#study'),true);
  status.textContent=`${controls[0].selectedOptions[0].textContent} / ${controls[1].selectedOptions[0].textContent} / WORLD ×${Number(controls[2].value).toFixed(2)} / nearest-neighbor / 静止美術比較`;
}
const entries=[
  ['RANGER','sprites/ranger.png','48×64 × 2ポーズ / 標準装備・歩幅見本'],['WING','sprites/wing.png','48×64 × 2ポーズ / 双翼・噴射'],
  ['E-01 / GROUND','sprites/crawler.png','64×64 × 2ポーズ / 分節甲殻・六脚'],['E-03 / AIR','sprites/needle.png','64×64 × 2ポーズ / 翼膜・腹部'],
  ['B-01','sprites/mother_crawler.png','192×128 × 2ポーズ / 重なる甲殻・大顎'],['5 WEAPON ICONS','weapons/icons.png','32×32 × 5 / A-01 R-04 H-08 T-06 D-19'],
  ['EQUIPMENT','weapons/equipped.png','32×32 × 5 / 論理16×16の形状見本'],['PROJECTILES','weapons/projectiles.png','32×32 × 5 / 実体弾・誘導・電撃'],
  ['IMPACT STUDIES','weapons/impacts.png','64×64 × 4段階 × 5武器'],['M01 TILES','tiles/city.png','32×32 × 8 / 道路・足場・補給材'],['M02 TILES','tiles/underground.png','32×32 × 8 / パネル・配管・警告材']
];
const list=document.querySelector('#assetList');
for(const [name,path,description]of entries){
  const article=document.createElement('article');article.className='asset';
  const title=document.createElement('h3');title.textContent=name;
  const detail=document.createElement('small');detail.textContent=description;
  const link=document.createElement('a');link.href=study+path;link.setAttribute('aria-label',`${name}の原寸PNG`);
  const img=document.createElement('img');img.src=study+path;img.alt=name+' サンプル原画';img.loading='lazy';link.append(img);article.append(title,detail,link);list.append(article);
}
try{
  await Promise.all(Object.entries(files).map(async([key,url])=>{const image=new Image();image.src=url;await image.decode();images[key]=image}));
  controls.forEach(control=>control.addEventListener('change',refresh));refresh();
}catch(error){status.textContent='素材を読み込めませんでした。HTTPサーバー経由で開き、--art-study-onlyで素材を生成してください。';status.setAttribute('role','alert');console.error(error)}
