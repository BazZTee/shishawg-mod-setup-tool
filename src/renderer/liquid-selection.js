/* Selection travels only after the existing navigation actually changes route.
 * Hover stays local. This layer never performs navigation or writes app state.
 */
(() => {
  'use strict';
  const sidebar=document.querySelector('.workspace-sidebar');
  if (!sidebar) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const lens=document.createElement('span');
  lens.className='liquid-selection-lens'; lens.hidden=true;
  lens.setAttribute('aria-hidden','true'); sidebar.prepend(lens);
  let selected=sidebar.querySelector('.ws-nav-item.is-active'), animation=null;
  const motionOff=()=>reduced.matches || document.body.classList.contains('ws-reduced-motion');
  const bounds=element=>{
    const r=element.getBoundingClientRect(), host=sidebar.getBoundingClientRect();
    const width=element===lens ? r.width : parseFloat(getComputedStyle(element,'::before').width) || r.width;
    return {x:r.left-host.left+sidebar.scrollLeft-sidebar.clientLeft,
      y:r.top-host.top+sidebar.scrollTop-sidebar.clientTop,width,height:r.height};
  };
  const frame=b=>({transform:`translate3d(${b.x}px,${b.y}px,0)`,width:b.width+'px',height:b.height+'px'});
  function settle() {
    animation?.cancel(); animation=null; lens.hidden=true;
    sidebar.classList.remove('liquid-selection-travel');
  }
  function update() {
    const next=sidebar.querySelector('.ws-nav-item.is-active');
    if (next===selected) return;
    const previous=selected; selected=next;
    if (!next || !previous?.getClientRects().length || motionOff()) {settle();return;}
    // Read the on-screen geometry before canceling an interrupted transition.
    const from=bounds(animation ? lens : previous), to=bounds(next);
    settle();
    Object.assign(lens.style,frame(to));
    lens.hidden=false; sidebar.classList.add('liquid-selection-travel');
    const duration=220+Math.min(80,Math.abs(to.y-from.y)*.16);
    animation=lens.animate([frame(from),frame(to)],{duration,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});
    animation.onfinish=settle;
  }
  new MutationObserver(records=>{
    if(records.some(record=>record.target.matches('.ws-nav-item'))) update();
  }).observe(sidebar,{subtree:true,attributes:true,attributeFilter:['class']});
  let width=sidebar.getBoundingClientRect().width;
  new ResizeObserver(()=>{
    const next=sidebar.getBoundingClientRect().width;
    if(Math.abs(next-width)>.1) settle();
    width=next;
  }).observe(sidebar);
  sidebar.addEventListener('scroll',settle,{passive:true});
  window.addEventListener('resize',settle,{passive:true});
  reduced.addEventListener('change',()=>{if(motionOff()) settle();});
  new MutationObserver(()=>{if(motionOff()) settle();}).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden) settle();});
})();
