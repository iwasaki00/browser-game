import {VIEW,unproject} from './surface';
export function fitSurface(width:number,height:number){const scale=Math.max(0,Math.min(width/VIEW.width,height/VIEW.height));return {width:VIEW.width*scale,height:VIEW.height*scale,left:(width-VIEW.width*scale)/2,top:(height-VIEW.height*scale)/2,scale};}
export function surfacePoint(x:number,y:number,rect:{left:number;top:number;width:number;height:number}){return unproject((x-rect.left)/rect.width*VIEW.width,(y-rect.top)/rect.height*VIEW.height);}
// Layout is session-local UI state; it never receives or writes a game State.
export function mountFieldLayout(main:HTMLElement,canvas:HTMLCanvasElement,onChange:()=>void){
 const el=<T extends HTMLElement=HTMLElement>(s:string)=>main.querySelector<T>(s)!;
 const header=el('header'),status=el('.status'),metrics=el('.metrics'),energy=el('.energy'),viewport=el('.surface-viewport');header.insertBefore(status,el('#help'));energy.append(metrics);
 const control=document.createElement('section');control.className='tool-control';const toggle=document.createElement('button');toggle.id='quick-toggle';toggle.dataset.visualOnly='';toggle.setAttribute('aria-controls','quick-drawer');toggle.innerHTML='<span id="current-tool-icon" aria-hidden="true"></span><span class="current-tool-copy"><small>使用中の道具</small><strong id="current-tool-name">素手</strong></span><span id="quick-toggle-label">道具 ▾</span>';
 const drawer=document.createElement('div');drawer.id='quick-drawer';drawer.hidden=true;drawer.setAttribute('aria-label','クイック道具と作業の案内');el('.equipment-label').before(control);drawer.append(el('#quick'),el('.equipment-label'));control.append(toggle,drawer);
 const focus=document.createElement('button');focus.id='focus-field';focus.dataset.visualOnly='';focus.textContent='集中';focus.setAttribute('aria-label','探索集中モード');focus.setAttribute('aria-pressed','false');el('.field-title').append(focus);el('.field').append(el('#exploration-goal'));
 let focused=false,open=false,previousOpen=false,frame=0;
 const setOpen=(value:boolean)=>{open=value;drawer.hidden=!open;toggle.setAttribute('aria-expanded',String(open));el('#quick-toggle-label').textContent=open?'閉じる ▴':'道具 ▾';};setOpen(false);
 toggle.onclick=()=>{onChange();setOpen(!open);};focus.onclick=()=>{onChange();focused=!focused;if(focused){previousOpen=open;setOpen(false);}else setOpen(previousOpen);main.dataset.focus=String(focused);focus.setAttribute('aria-pressed',String(focused));focus.textContent=focused?'戻す':'集中';schedule();};
 drawer.addEventListener('click',e=>{if((e.target as Element).closest('[data-slot],#bare'))setOpen(false);});
 document.addEventListener('pointerdown',e=>{if(open&&!control.contains(e.target as Node))setOpen(false);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){setOpen(false);toggle.focus();}});
 function size(){frame=0;const vv=window.visualViewport;if(!vv||Math.abs(vv.scale-1)<.01)main.style.setProperty('--app-height',(vv?.height??window.innerHeight)+'px');const natural=viewport.clientWidth/VIEW.width*VIEW.height;main.style.setProperty('--surface-height',natural+'px');const fit=fitSurface(viewport.clientWidth,viewport.clientHeight);for(const key of ['width','height','left','top'] as const)canvas.style[key]=fit[key]+'px';onChange();}
 function schedule(){if(!frame)frame=requestAnimationFrame(size);}
 new ResizeObserver(schedule).observe(viewport);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);schedule();
 return {setTool:(name:string,icon:string)=>{el('#current-tool-name').textContent=name;el('#current-tool-icon').innerHTML=icon;toggle.setAttribute('aria-label','使用中：'+name+'。クイック道具を'+(open?'閉じる':'開く'));},closeTools:()=>setOpen(false)};
}
