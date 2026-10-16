import { distanceMeters } from "./utils.js";
export function validPosition(p) {
  return !!p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180 && Number.isFinite(p.accuracy) && p.accuracy>=0 && Number.isFinite(p.timestamp) && p.timestamp>0;
}
export function freshPosition(p, now) {
  return validPosition(p) && Number.isFinite(now) && p.timestamp<=now && now-p.timestamp<10000;
}
export function captureState(detective, criminal, settings, since, now) {
  const fresh=p=>freshPosition(p,now)&&p.accuracy<=50;
  const invalid={valid:false,progress:0,distance:Infinity};
  if(!fresh(detective)||!fresh(criminal)||!Number.isFinite(settings?.captureDistanceMeters)||settings.captureDistanceMeters<=0||!Number.isFinite(settings?.captureHoldSeconds)||settings.captureHoldSeconds<=0)return invalid;
  const d=distanceMeters(detective,criminal);
  if(!Number.isFinite(d)||d>settings.captureDistanceMeters)return {...invalid,distance:d};
  return {valid:true,progress:Number.isFinite(since)&&since>0&&since<=now?Math.min(1,(now-since)/(settings.captureHoldSeconds*1000)):0,distance:d};
}
