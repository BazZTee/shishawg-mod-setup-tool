/* Decorative pointer response only. No domain state, IPC or input interception.
 * A shared, demand-driven spring loop stops completely when the glass settles.
 */
(() => {
  'use strict';
  const sidebar = document.querySelector('.workspace-sidebar');
  if (!sidebar) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = '.hub-tile-card, .custom-widget-card, .qa-card, .modhq-card, .giveaway-card, .qna-card, .glass-setup-editor, .generator-card, .notes-card';
  sidebar.classList.add('liquid-navigation');
  document.body.classList.add('liquid-motion-ready');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const spring = (value = 0) => ({ value, target: value, velocity: 0 });
  const cards = new WeakMap();
  const movingCards = new Set();
  let hoveredCard = null;
  let frame = 0, lastTime = 0, suspended = false;
  const motionOff = () => reduced.matches || document.body.classList.contains('ws-reduced-motion');
  const requestFrame = () => {
    if (!frame && !suspended) { lastTime = 0; frame = requestAnimationFrame(tick); }
  };
  function step(item, dt, immediate) {
    if (immediate) { item.value = item.target; item.velocity = 0; return false; }
    // Critical-ish damping with a small natural overshoot, independent of frame rate.
    item.velocity += ((item.target - item.value) * 230 - item.velocity * 25) * dt;
    item.value += item.velocity * dt;
    if (Math.abs(item.target-item.value) < .025 && Math.abs(item.velocity) < .06) {
      item.value = item.target; item.velocity = 0; return false;
    }
    return true;
  }
  function fitNavigation() {
    for (const button of sidebar.querySelectorAll('.ws-nav-item')) {
      const label=button.querySelector('.ws-nav-text');
      const r=button.getBoundingClientRect(), text=label?.getBoundingClientRect();
      const width=text?.width ? Math.min(r.width,text.right-r.left+13) : r.width;
      button.style.setProperty('--liquid-item-width',width.toFixed(2)+'px');
    }
  }
  function cardState(element) {
    let state = cards.get(element);
    if (state) return state;
    const optics = document.createElement('span');
    optics.className = 'liquid-card-optics'; optics.setAttribute('aria-hidden','true');
    element.append(optics);
    element.classList.add('liquid-surface');
    state = { element, optics, x:spring(50), y:spring(50), opacity:spring(0), angle:spring(135) };
    cards.set(element,state);
    return state;
  }
  function releaseCard() {
    if (!hoveredCard) return;
    const state = cards.get(hoveredCard);
    if (state) { state.opacity.target=0; movingCards.add(state); }
    hoveredCard = null;
  }
  function pointAtCard(element, event) {
    if (hoveredCard !== element) { releaseCard(); hoveredCard=element; }
    const state = cardState(element), r = element.getBoundingClientRect();
    state.x.target=clamp((event.clientX-r.left)/r.width*100,0,100);
    state.y.target=clamp((event.clientY-r.top)/r.height*100,0,100);
    state.angle.target=115+state.x.target*.65;
    state.opacity.target=1;
    movingCards.add(state);
  }
  function tick(now) {
    frame=0;
    const dt=lastTime ? clamp((now-lastTime)/1000,.001,.025) : 1/60;
    lastTime=now;
    const immediate=motionOff();
    let unsettled=false;
    for (const state of movingCards) {
      if (!state.element.isConnected) { movingCards.delete(state); continue; }
      let moving=false;
      for (const key of ['x','y','angle','opacity']) moving=step(state[key],dt,immediate)||moving;
      state.optics.style.setProperty('--liquid-x',state.x.value.toFixed(2)+'%');
      state.optics.style.setProperty('--liquid-y',state.y.value.toFixed(2)+'%');
      state.optics.style.setProperty('--liquid-angle',state.angle.value.toFixed(2)+'deg');
      state.optics.style.opacity=immediate ? '0' : clamp(state.opacity.value,0,1).toFixed(3);
      if (!moving) movingCards.delete(state);
      unsettled=unsettled||moving;
    }
    if (unsettled && !suspended) frame=requestAnimationFrame(tick);
  }
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || motionOff()) return;
    const card=event.target.closest(surfaces);
    if (card && !card.closest('.sa-library, .sa-fold')) pointAtCard(card,event); else releaseCard();
    if (movingCards.size) requestFrame();
  }, {passive:true});
  function resetHover() { releaseCard(); if (movingCards.size) requestFrame(); }
  document.documentElement.addEventListener('pointerleave',resetHover,{passive:true});
  window.addEventListener('blur',resetHover);
  const refresh=fitNavigation;
  window.addEventListener('swg:view-changed',() => { resetHover(); refresh(); });
  window.addEventListener('resize',refresh,{passive:true});
  // ResizeObserver also covers sidebar collapse, compact mode and font/layout changes.
  new ResizeObserver(refresh).observe(sidebar);
  sidebar.addEventListener('scroll',refresh,{passive:true});
  const preferenceChanged=() => { if (motionOff()) resetHover(); refresh(); };
  reduced.addEventListener('change',preferenceChanged);
  new MutationObserver(preferenceChanged).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',() => {
    suspended=document.hidden;
    if (suspended) { cancelAnimationFrame(frame); frame=0; }
    else { resetHover(); refresh(); }
  });
  fitNavigation();
  document.fonts.ready.then(fitNavigation);
})();
