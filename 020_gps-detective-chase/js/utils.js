export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const normalizeRoomId = (v) => String(v).trim().replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, "").slice(0, 6);
export const formatClock = (seconds) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
export function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export const bearingName = (a, b) => {
  if (!a || !b) return "不明";
  const y = Math.sin((b.lng-a.lng)*Math.PI/180)*Math.cos(b.lat*Math.PI/180);
  const x = Math.cos(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)-Math.sin(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos((b.lng-a.lng)*Math.PI/180);
  return ["北","北東","東","南東","南","南西","西","北西"][Math.round(((Math.atan2(y,x)*180/Math.PI+360)%360)/45)%8];
};
