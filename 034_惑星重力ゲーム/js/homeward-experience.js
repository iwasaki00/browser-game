import {createOpenVoyage,dockVoyage,destination} from './open-voyage.js';
import {normalizeFrontier,observeFrontier,targetAvailable} from './frontier.js';
// A disposable voyage. No HOMEWARD storage, tutorial, unlock or archive access.
export class HomewardExperience {
 constructor(){this.voyage={selected:'gate'};this.frontier=normalizeFrontier();this.recordId=null;}
 stage(){const s=createOpenVoyage(this.voyage);return {...s,id:'homeward-experience',name:'HOMEWARD EXPERIENCE',openVoyage:false,experience:true,launch:{...s.launch,angleDeg:-55,speed:200}};}
 observe(a,b){const r=observeFrontier(this.frontier,a,b);this.frontier=r.frontier;return r.events;}
 select(id){if(!['gate','probe','rescue'].includes(id)||!targetAvailable(this.frontier,id))return false;this.voyage={...this.voyage,selected:id};return true;}
 dock(state){const next=dockVoyage(this.voyage,state);if(!next)return false;this.voyage=next;return true;}
 get target(){return destination(this.voyage.selected??'gate');}
}
