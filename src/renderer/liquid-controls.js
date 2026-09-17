/* Presentation only: follow the existing selected tab. Never change a tab's
 * state, intercept its input, or move/replace the original buttons. */
(() => {
  const groups=[...document.querySelectorAll('.polls-segmented-nav, .qna-filter-tabs, #view-quickactions .sa-tabs')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const records=[];
  let frame=0;
  function update() {
    frame=0;
    for(const record of records) {
      const {group,lens}=record;
      const active=group.querySelector('button.active');
      if(!active || !active.getClientRects().length) { lens.hidden=true; record.visible=false; continue; }
      const r=active.getBoundingClientRect(), box=group.getBoundingClientRect();
      if(!record.visible || reduced.matches || document.body.classList.contains('ws-reduced-motion')) lens.classList.add('liquid-control-instant');
      lens.hidden=false;
      lens.style.width=r.width+'px'; lens.style.height=r.height+'px';
      lens.style.transform=`translate3d(${r.left-box.left+group.scrollLeft-group.clientLeft}px,${r.top-box.top+group.scrollTop-group.clientTop}px,0)`;
      if(!record.visible) { void lens.offsetWidth; }
      if(!reduced.matches && !document.body.classList.contains('ws-reduced-motion')) lens.classList.remove('liquid-control-instant');
      record.visible=true;
    }
  }
  function refresh() { if(!frame) frame=requestAnimationFrame(update); }
  const resize=new ResizeObserver(refresh);
  for(const group of groups) {
    const lens=document.createElement('span');
    lens.className='liquid-control-lens'; lens.setAttribute('aria-hidden','true'); lens.hidden=true;
    group.prepend(lens); group.classList.add('liquid-control-group');
    records.push({group,lens,visible:false});
    new MutationObserver(changes=>{ if(changes.some(change=>change.target.tagName==='BUTTON')) refresh(); }).observe(group,{subtree:true,attributes:true,attributeFilter:['class']});
    resize.observe(group);
    group.querySelectorAll('button').forEach(button=>resize.observe(button));
    group.addEventListener('scroll',refresh,{passive:true});
  }
  window.addEventListener('swg:view-changed',refresh);
  window.addEventListener('resize',refresh,{passive:true});
  reduced.addEventListener('change',refresh);
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
  refresh();
})();

