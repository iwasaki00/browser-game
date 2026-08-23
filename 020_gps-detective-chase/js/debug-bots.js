const EARTH = 6371000;
export const BOT_SPEEDS = [0, 2, 4, 6, 10];
export function destination(position, bearing, meters) {
  const d = meters / EARTH, br = bearing * Math.PI / 180;
  const lat1 = position.lat * Math.PI / 180, lng1 = position.lng * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { ...position, lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI, heading: bearing, timestamp: Date.now() };
}
export function bearingTo(from, to) {
  const p1=from.lat*Math.PI/180,p2=to.lat*Math.PI/180,d=(to.lng-from.lng)*Math.PI/180;
  return (Math.atan2(Math.sin(d)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(d))*180/Math.PI+360)%360;
}
export function nextBotPosition(bot, players, witness) {
  const p=bot.position;if(!p||bot.paused||bot.isOnline===false)return p;
  const speed=Number(bot.debugSpeedKmh??4), meters=speed/3.6, others=Object.values(players||{});
  const criminal=others.find(x=>x.role==="criminal"), detectives=others.filter(x=>x.role==="detective"&&x.position);
  let heading=Number(p.heading)||0, pattern=bot.behavior||"random";
  if(pattern==="random"&&Math.random()<.25)heading=Math.random()*360;
  if(pattern==="straight")heading=Number(p.heading)||45;
  if(pattern==="circle")heading=(heading+18)%360;
  if(pattern==="zigzag")heading=(heading+(Math.floor(Date.now()/3000)%2?35:-35)+360)%360;
  if((pattern==="chase"||pattern==="witness")&&criminal?.position)heading=bearingTo(p,pattern==="witness"&&witness?.centerLat?{lat:witness.centerLat,lng:witness.centerLng}:criminal.position);
  if(pattern==="flee"&&detectives.length){const near=detectives.sort((a,b)=>Math.hypot(a.position.lat-p.lat,a.position.lng-p.lng)-Math.hypot(b.position.lat-p.lat,b.position.lng-p.lng))[0];heading=(bearingTo(p,near.position)+180)%360;}
  return {...destination(p,heading,meters),accuracy:Number(bot.accuracy)||5,speed:speed/3.6};
}
export function makeBot(role, index, origin) {
  const id=`bot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  return [id,{displayName:role==="criminal"?"CPU犯人":`CPU刑事${String.fromCharCode(65+index)}`,role,isBot:true,isReady:true,isOnline:true,joinedAt:Date.now(),lastSeenAt:Date.now(),gpsStatus:"virtual",behavior:role==="criminal"?"flee":"chase",debugSpeedKmh:4,accuracy:5,paused:false,position:{...origin,accuracy:5,speed:0,heading:0,timestamp:Date.now()}}];
}
