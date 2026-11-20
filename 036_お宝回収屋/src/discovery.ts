export interface DiscoveryTheme {id:string;title:string;found:number;total:number;}
export interface DiscoveryResult {id:string;rarity:string;first:boolean;goal:boolean;themes:readonly DiscoveryTheme[];}
export interface DiscoveryPreferences {effects:'full'|'light'|'off';short:boolean;reduced:boolean;}
export function discoveryDuration(result:DiscoveryResult,prefs:DiscoveryPreferences){
 if(!result.first||prefs.reduced||prefs.effects==='off')return 0;
 const duration=result.rarity==='J'||result.rarity==='SR'?1500:result.rarity==='R'?1000:700;
 return prefs.short||prefs.effects==='light'?Math.min(duration,300):duration;
}
