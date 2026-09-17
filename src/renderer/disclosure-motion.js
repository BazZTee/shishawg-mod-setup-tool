/* Presentation only: existing handlers own open/closed state and persistence.
 * Capture the current geometry before those handlers run, then animate the
 * resulting layout. Dashboard re-renders are matched by the existing widget ID.
 */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const active=new Map();
  const motionOff=()=>reduced.matches || document.body.classList.contains('ws-reduced-motion');
  function disclosure(button) {
    if (button.matches('#btn-toggle-notes')) return {element:document.getElementById('notes-card'),kind:'hidden'};
    if (button.matches('#btn-toggle-promo')) return {element:document.getElementById('promo-block'),kind:'collapsed'};
    if (button.matches('.optional-fields-toggle')) return {element:button.parentElement.querySelector('.optional-fields-collapsible'),kind:'collapsed'};
    if (button.matches('.btn-widget-collapse')) return {element:button.closest('.custom-widget-card'),kind:'widget'};
    return null;
  }
  const closed=(el,kind)=>el.classList.contains(kind==='widget'?'is-collapsed':kind);
  function finish(element) { active.get(element)?.cleanup(); }
  function animate(element,kind,before) {
    finish(element);
    if (motionOff() || !element.isConnected) return;
    const closing=closed(element,kind);
    // Measure the final layout before temporarily revealing closing content.
    const target=element.getBoundingClientRect().height;
    const targetStyle=getComputedStyle(element);
    const paddingTop=targetStyle.paddingTop, paddingBottom=targetStyle.paddingBottom;
    const opacity=kind==='widget' ? 1 : closing ? 0 : 1;
    const content=kind==='widget' ? element.querySelector('.custom-widget-body') : element;
    const inert=content.inert;
    if (closing) content.inert=true;
    element.classList.add('disclosure-animating');
    if (closing && kind==='hidden') {
      element.style.setProperty('--disclosure-display',before.display);
      element.classList.add('disclosure-closing');
    }
    if (closing && kind==='widget') element.classList.add('disclosure-widget-closing');
    const from={height:before.height+'px',opacity:before.opacity};
    const to={height:target+'px',opacity};
    if (kind==='hidden') {
      from.paddingTop=before.height ? before.paddingTop : '0px';
      from.paddingBottom=before.height ? before.paddingBottom : '0px';
      to.paddingTop=closing?'0px':paddingTop;
      to.paddingBottom=closing?'0px':paddingBottom;
    }
    const animation=element.animate([from,to],{duration:250,easing:'cubic-bezier(.22,.72,.2,1)',fill:'both'});
    const record={cleanup() {
      if (active.get(element)!==record) return;
      active.delete(element);
      animation.cancel();
      element.classList.remove('disclosure-animating','disclosure-closing','disclosure-widget-closing');
      element.style.removeProperty('--disclosure-display');
      content.inert=inert;
    }};
    active.set(element,record);
    animation.onfinish=record.cleanup;
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button || motionOff()) return;
    const info=disclosure(button);
    if (!info?.element) return;
    const {element,kind}=info;
    const style=getComputedStyle(element);
    const before={height:element.getBoundingClientRect().height,opacity:style.opacity,
      display:style.display==='none'?'flex':style.display,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom};
    const wasClosed=closed(element,kind), widgetId=element.dataset.widgetId;
    requestAnimationFrame(()=>{
      const current=kind==='widget'
        ? [...document.querySelectorAll('.custom-widget-card')].find(card=>card.dataset.widgetId===widgetId)
        : element;
      if (!current || closed(current,kind)===wasClosed) return;
      // Geometry was captured before canceling, so repeated clicks reverse from
      // the on-screen height instead of restarting at an endpoint.
      finish(element);
      animate(current,kind,before);
    });
  },true);
  const settle=()=>{ for (const element of [...active.keys()]) finish(element); };
  window.addEventListener('swg:view-changed',settle);
  reduced.addEventListener('change',()=>{if(motionOff()) settle();});
  new MutationObserver(()=>{if(motionOff()) settle();}).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
