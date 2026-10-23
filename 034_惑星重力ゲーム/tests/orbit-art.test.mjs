import test from'node:test';import assert from'node:assert/strict';
import{artLayout,artFilename,canShareImage,canvasPng}from'../js/orbit-art.js';
const record={playType:'challenge',stageId:'stage-11',stageName:'小さな巨人',createdAt:Date.UTC(2026,9,24,1,2,3),duration:2,result:'clear',world:{width:375,height:500},rocketRadius:6,launch:{position:{x:40,y:430}},goal:{x:320,y:80,radius:24},planets:[{x:180,y:280,radius:38,color:'#6fd3ff'}],frames:[[0,40,430,180,280],[1,-100,-60,200,260],[2,480,100,220,200]]};
for(const [w,h]of[[1080,1080],[1080,1920]])for(const text of[true,false])test(`${w}×${h} 文字${text}：全軌道と惑星が余白内に入る・縦横比維持`,()=>{
 const before=structuredClone(record),layout=artLayout(record,w,h,text),{bounds:b,area:a,scale:s,offsetX:x,offsetY:y}=layout;
 assert.ok(b.left*s+x>=a.x-1e-8&&b.right*s+x<=a.x+a.width+1e-8);
 assert.ok(b.top*s+y>=a.y-1e-8&&b.bottom*s+y<=a.y+a.height+1e-8);
 assert.equal(layout.planets[0].x,180);assert.deepEqual(record,before);
});
test('ファイル名：FREE・ステージID・UTC記録日時・禁止文字除外',()=>{
 assert.equal(artFilename(record),'ORBIT_MAKER_stage-11_20261024T010203Z.png');
 assert.match(artFilename({...record,playType:'free'}),/^ORBIT_MAKER_FREE_/);
 assert.ok(!/[\\/:*?"<>|]/.test(artFilename({...record,stageId:'../bad:*?<>|'})));
});
test('Web Share対応・非対応・例外の判定',()=>{
 const file={type:'image/png'};assert.equal(canShareImage({share(){},canShare:()=>true},file),true);
 for(const nav of[{}, {share(){}}, {share(){},canShare:()=>false},{share(){},canShare(){throw Error();}}])assert.equal(canShareImage(nav,file),false);
});
test('PNG生成失敗の通知境界と復旧',async()=>{
 await assert.rejects(canvasPng({toBlob:callback=>callback(null)}),/PNG/);
 await assert.rejects(canvasPng({toBlob(){throw Error('allocation failed');}}),/allocation/);
 const blob=new Blob(['png'],{type:'image/png'});assert.equal(await canvasPng({toBlob:callback=>callback(blob)}),blob);
});
